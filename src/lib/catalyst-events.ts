import { createHash } from 'crypto';
import { ensureSchema, pool } from './db';
import type { CompanyFinancialSummary, FinancialPeriodKind } from './company-financials';
import type { DataQualitySummary } from './data-quality';
import {
  buildCatalystSignals,
  deriveCatalystEvidence,
  type AssessedCatalystEvent,
  type CatalystEventObservation,
  type CatalystEvidence,
} from './catalyst-evidence';

const SEC_EVENT_LOOKBACK_DAYS = 90;
const NEWS_LOOKBACK_DAYS = 30;
const MAX_FACT_DISCLOSURES_PER_COMPANY = 3;
const MAX_SEC_EVENTS_PER_COMPANY = 5;
const MAX_NEWS_PER_COMPANY = 2;
const MAX_LINKED_FACT_IDS = 50;

export interface CatalystEvidenceInput {
  companyId: number;
  ticker: string;
  financials: CompanyFinancialSummary | null;
  dataQuality: DataQualitySummary;
  marketCap: number | null;
}

interface CompanyObservations {
  events: CatalystEventObservation[];
  nextScheduledAt: string | null;
  lastScheduledAt: string | null;
}

// Kuupäevaveerud loetakse SQL-ist juba `YYYY-MM-DD` kujul (sama muster nagu
// company-financials), timestamptz tuleb Date objektina.
function isoDay(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isFinite(day.getTime()) ? day.toISOString() : null;
  }
  const date = new Date(value as string);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// Avaldatud tõend tuleb olemasolevatest SEC CompanyFactsi ridadest: üks
// accession on üks avaldus ja sellega saabunud fact ID-d ongi sild sündmuselt
// tõendile. Tuletatud kombineeritud accession'eid (A+B) ei kasutata ankruna.
async function factDisclosures(companyIds: number[]): Promise<Map<number, CatalystEventObservation[]>> {
  const result = await pool.query(
    `WITH groups AS (
       SELECT f.company_id, f.accession_number,
              min(f.form_type) AS form_type,
              max(f.filed_at) AS filed_at,
              max(f.period_end) AS period_end,
              (array_agg(f.id ORDER BY f.id))[1:${MAX_LINKED_FACT_IDS}] AS fact_ids
       FROM financial_facts f
       WHERE f.company_id = ANY($1::bigint[])
         AND f.accession_number IS NOT NULL
         AND f.accession_number NOT LIKE '%+%'
       GROUP BY f.company_id, f.accession_number
     ), ranked AS (
       SELECT g.*, row_number() OVER (
         PARTITION BY g.company_id ORDER BY g.filed_at DESC, g.accession_number DESC
       ) AS rn
       FROM groups g
     )
     SELECT r.company_id, r.accession_number, r.form_type, r.fact_ids,
            to_char(r.filed_at, 'YYYY-MM-DD') AS filed_at,
            to_char(r.period_end, 'YYYY-MM-DD') AS period_end,
            newest.period_kind, newest.source_url
     FROM ranked r
     LEFT JOIN LATERAL (
       SELECT ff.period_kind, ff.source_url FROM financial_facts ff
       WHERE ff.company_id = r.company_id AND ff.accession_number = r.accession_number
       ORDER BY ff.period_end DESC, ff.id DESC LIMIT 1
     ) newest ON true
     WHERE r.rn <= ${MAX_FACT_DISCLOSURES_PER_COMPANY}
     ORDER BY r.company_id, r.filed_at DESC`,
    [companyIds],
  );
  const map = new Map<number, CatalystEventObservation[]>();
  for (const row of result.rows) {
    const companyId = Number(row.company_id);
    const events = map.get(companyId) || [];
    events.push({
      id: null,
      kind: 'earnings_disclosed',
      sourceKind: 'primary_sec',
      sourceRef: String(row.accession_number),
      occurredAt: isoDay(row.filed_at),
      headline: `${row.form_type || 'SEC aruanne'} · ${row.fact_ids?.length || 0} fakti`,
      url: row.source_url || null,
      accessionNumber: String(row.accession_number),
      form: row.form_type || null,
      linkedFactIds: (row.fact_ids || []).map((id: unknown) => Number(id)),
      linkedPeriodEnd: row.period_end ? String(row.period_end).slice(0, 10) : null,
      linkedPeriodKind: (row.period_kind || null) as FinancialPeriodKind | null,
    });
    map.set(companyId, events);
  }
  return map;
}

async function secFilingEvents(companyIds: number[]): Promise<Map<number, CatalystEventObservation[]>> {
  const result = await pool.query(
    `SELECT company_id, id, form_type, to_char(filed_at, 'YYYY-MM-DD') AS filed_at,
            discovered_at, description, url
     FROM (
       SELECT s.*, row_number() OVER (
         PARTITION BY s.company_id
         ORDER BY COALESCE(s.filed_at, s.discovered_at::date) DESC, s.id DESC
       ) AS rn
       FROM sec_events s
       WHERE s.company_id = ANY($1::bigint[])
         AND COALESCE(s.filed_at, s.discovered_at::date) >= (now() - interval '${SEC_EVENT_LOOKBACK_DAYS} days')::date
     ) ranked
     WHERE rn <= ${MAX_SEC_EVENTS_PER_COMPANY}
     ORDER BY company_id, filed_at DESC NULLS LAST, id DESC`,
    [companyIds],
  );
  const map = new Map<number, CatalystEventObservation[]>();
  for (const row of result.rows) {
    const companyId = Number(row.company_id);
    const events = map.get(companyId) || [];
    events.push({
      id: null,
      kind: 'sec_filing',
      sourceKind: 'primary_sec',
      sourceRef: String(row.id),
      occurredAt: isoDay(row.filed_at) || isoDay(row.discovered_at),
      headline: row.description || row.form_type || null,
      url: row.url || null,
      accessionNumber: String(row.id),
      form: row.form_type || null,
      linkedFactIds: [],
      linkedPeriodEnd: null,
      linkedPeriodKind: null,
    });
    map.set(companyId, events);
  }
  return map;
}

async function newsEvents(companyIds: number[]): Promise<Map<number, CatalystEventObservation[]>> {
  const result = await pool.query(
    `SELECT company_id, id, title, url, event_at
     FROM (
       SELECT n.company_id, n.id, n.title, n.url,
              COALESCE(n.published_at, n.discovered_at) AS event_at,
              row_number() OVER (
                PARTITION BY n.company_id
                ORDER BY COALESCE(n.published_at, n.discovered_at) DESC, n.id DESC
              ) AS rn
       FROM news_items n
       WHERE n.company_id = ANY($1::bigint[])
         AND COALESCE(n.published_at, n.discovered_at) >= now() - interval '${NEWS_LOOKBACK_DAYS} days'
     ) ranked
     WHERE rn <= ${MAX_NEWS_PER_COMPANY}
     ORDER BY company_id, event_at DESC`,
    [companyIds],
  );
  const map = new Map<number, CatalystEventObservation[]>();
  for (const row of result.rows) {
    const companyId = Number(row.company_id);
    const events = map.get(companyId) || [];
    events.push({
      id: null,
      kind: 'news_headline',
      sourceKind: 'secondary_news',
      sourceRef: String(row.id),
      occurredAt: isoDay(row.event_at),
      headline: row.title || null,
      url: row.url || null,
      accessionNumber: null,
      form: null,
      linkedFactIds: [],
      linkedPeriodEnd: null,
      linkedPeriodKind: null,
    });
    map.set(companyId, events);
  }
  return map;
}

interface ScheduledEarnings {
  nextId: string | null;
  nextAt: string | null;
  lastId: string | null;
  lastAt: string | null;
}

async function scheduledEarnings(companyIds: number[]): Promise<Map<number, ScheduledEarnings>> {
  const result = await pool.query(
    `SELECT e.company_id,
       (array_agg(e.id ORDER BY e.event_at ASC) FILTER (WHERE e.event_at >= now()))[1] AS next_id,
       (array_agg(e.event_at ORDER BY e.event_at ASC) FILTER (WHERE e.event_at >= now()))[1] AS next_at,
       (array_agg(e.id ORDER BY e.event_at DESC) FILTER (WHERE e.event_at < now()))[1] AS last_id,
       (array_agg(e.event_at ORDER BY e.event_at DESC) FILTER (WHERE e.event_at < now()))[1] AS last_at
     FROM earnings_events e
     WHERE e.company_id = ANY($1::bigint[])
     GROUP BY e.company_id`,
    [companyIds],
  );
  return new Map(result.rows.map((row) => [Number(row.company_id), {
    nextId: row.next_id == null ? null : String(row.next_id),
    nextAt: isoDay(row.next_at),
    lastId: row.last_id == null ? null : String(row.last_id),
    lastAt: isoDay(row.last_at),
  }]));
}

function mergeObservations(
  disclosures: CatalystEventObservation[],
  filings: CatalystEventObservation[],
  news: CatalystEventObservation[],
  earnings: ScheduledEarnings | undefined,
): CompanyObservations {
  // sec_events.id on accession number, seega faktidega seotud avaldus ja sama
  // filing ei tohi tekitada kahte sündmust.
  const disclosedAccessions = new Set(disclosures.map((event) => event.accessionNumber));
  const events: CatalystEventObservation[] = [
    ...disclosures,
    ...filings.filter((event) => !disclosedAccessions.has(event.accessionNumber)),
    ...news,
  ];
  if (earnings?.nextAt) {
    events.push({
      id: null,
      kind: 'earnings_scheduled',
      sourceKind: 'secondary_news',
      sourceRef: earnings.nextId || `next:${earnings.nextAt}`,
      occurredAt: earnings.nextAt,
      headline: 'Planeeritud earnings kuupäev',
      url: null,
      accessionNumber: null,
      form: null,
      linkedFactIds: [],
      linkedPeriodEnd: null,
      linkedPeriodKind: null,
    });
  }
  return { events, nextScheduledAt: earnings?.nextAt || null, lastScheduledAt: earnings?.lastAt || null };
}

function assessmentHash(assessed: AssessedCatalystEvent): string {
  const { assessment, status } = assessed;
  return createHash('sha256').update(JSON.stringify([
    assessment.materiality, assessment.materialityBasis, assessment.materialityRatio,
    assessment.direction, assessment.directionBasis, assessment.novelty, assessment.noveltyBasis,
    assessment.sourceQuality, assessment.thesisRelevance, assessment.relevanceTarget,
    assessment.mandateRelevance, assessment.mandateBasis, assessment.evidenceFreshness,
    assessment.notes, status,
  ])).digest('hex');
}

async function persistEvents(companyId: number, events: CatalystEventObservation[]): Promise<void> {
  for (const event of events) {
    const inserted = await pool.query(
      `INSERT INTO catalyst_events
        (company_id, event_kind, source_kind, source_ref, occurred_at, headline, url,
         accession_number, form_type, linked_fact_ids, linked_period_end, linked_period_kind)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
       ON CONFLICT (company_id, event_kind, source_ref) DO UPDATE
         SET last_seen_at = now(),
             occurred_at = COALESCE(catalyst_events.occurred_at, EXCLUDED.occurred_at),
             headline = COALESCE(catalyst_events.headline, EXCLUDED.headline),
             url = COALESCE(catalyst_events.url, EXCLUDED.url),
             form_type = COALESCE(catalyst_events.form_type, EXCLUDED.form_type),
             linked_fact_ids = EXCLUDED.linked_fact_ids,
             linked_period_end = EXCLUDED.linked_period_end,
             linked_period_kind = EXCLUDED.linked_period_kind
       RETURNING id`,
      [
        companyId, event.kind, event.sourceKind, event.sourceRef, event.occurredAt,
        event.headline, event.url, event.accessionNumber, event.form,
        JSON.stringify(event.linkedFactIds), event.linkedPeriodEnd, event.linkedPeriodKind,
      ],
    );
    event.id = Number(inserted.rows[0].id);
  }
}

// Hinnang on vaatlusest eraldi rida. Identne kordushinnang ei tekita
// duplikaati; muutunud hinnang lisab uue rea ja jätab vana ajaloo alles.
async function persistAssessments(evidence: CatalystEvidence): Promise<void> {
  for (const assessed of evidence.events) {
    if (assessed.event.id == null) continue;
    const prior = assessed.assessment.novelty === 'repeat_of_prior_event'
      ? evidence.events.find((item) => item.event.id != null
        && item.event.id !== assessed.event.id
        && item.event.kind === assessed.event.kind)?.event.id ?? null
      : null;
    await pool.query(
      `INSERT INTO catalyst_assessments
        (catalyst_event_id, assessment_version, materiality, materiality_basis, materiality_ratio,
         direction, direction_basis, novelty, novelty_basis, prior_event_id, source_quality,
         thesis_relevance, relevance_target, mandate_relevance, mandate_basis,
         evidence_freshness, evidence_status, assessed_by, notes, input_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (catalyst_event_id, assessment_version, assessed_by, input_hash) DO NOTHING`,
      [
        assessed.event.id, assessed.assessment.version, assessed.assessment.materiality,
        assessed.assessment.materialityBasis, assessed.assessment.materialityRatio,
        assessed.assessment.direction, assessed.assessment.directionBasis,
        assessed.assessment.novelty, assessed.assessment.noveltyBasis, prior,
        assessed.assessment.sourceQuality, assessed.assessment.thesisRelevance,
        assessed.assessment.relevanceTarget, assessed.assessment.mandateRelevance,
        assessed.assessment.mandateBasis, assessed.assessment.evidenceFreshness,
        assessed.status, assessed.assessment.assessedBy, assessed.assessment.notes,
        assessmentHash(assessed),
      ],
    );
  }
}

export async function getCatalystEvidenceMap(
  inputs: CatalystEvidenceInput[],
  asOf = new Date(),
): Promise<Map<string, CatalystEvidence>> {
  const map = new Map<string, CatalystEvidence>();
  if (inputs.length === 0) return map;
  await ensureSchema();
  const companyIds = inputs.map((input) => input.companyId);
  const [disclosures, filings, news, earnings] = await Promise.all([
    factDisclosures(companyIds),
    secFilingEvents(companyIds),
    newsEvents(companyIds),
    scheduledEarnings(companyIds),
  ]);
  for (const input of inputs) {
    const observations = mergeObservations(
      disclosures.get(input.companyId) || [],
      filings.get(input.companyId) || [],
      news.get(input.companyId) || [],
      earnings.get(input.companyId),
    );
    await persistEvents(input.companyId, observations.events);
    const signals = buildCatalystSignals(input.financials, input.dataQuality, input.marketCap, asOf);
    const evidence = deriveCatalystEvidence(observations.events, signals, {
      asOf,
      nextScheduledAt: observations.nextScheduledAt,
      lastScheduledAt: observations.lastScheduledAt,
    });
    await persistAssessments(evidence);
    map.set(input.ticker, evidence);
  }
  return map;
}
