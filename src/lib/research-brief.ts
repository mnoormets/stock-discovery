import { createHash } from 'node:crypto';
import { pool } from './db';
import { ensureResearchSchema } from './company-research-store';
import { getCompanyFinancials, type FinancialMetricSummary } from './company-financials';
import { normalizeTicker } from './investment';
import { buildSignalBrief } from './signals/engine';
import type { BriefSource, ResearchBriefContent } from './signals/types';

export type {
  BriefConfidence,
  BriefEvidenceItem,
  BriefItemKind,
  BriefSource,
  ResearchBriefContent,
  ThesisImpact,
} from './signals/types';

export interface StoredResearchBrief {
  id: number;
  inputHash: string;
  model: string;
  generatedAt: string;
  content: ResearchBriefContent;
  sources: BriefSource[];
}

export interface ResearchBriefState {
  ticker: string;
  configured: boolean;
  sufficient: boolean;
  reason: string | null;
  inputHash: string | null;
  brief: StoredResearchBrief | null;
  stale: boolean;
}

interface ResearchInput {
  companyId: number;
  ticker: string;
  companyName: string | null;
  sources: BriefSource[];
  inputHash: string;
  sufficient: boolean;
  reason: string | null;
}

const GENERATOR_VERSION = 'signals-v3';
const generations = new Map<string, Promise<StoredResearchBrief>>();

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sourceHash(ticker: string, sources: BriefSource[]): string {
  return createHash('sha256').update(JSON.stringify({ ticker, version: GENERATOR_VERSION, sources })).digest('hex');
}

async function buildResearchInput(rawTicker: string): Promise<ResearchInput | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return null;
  await ensureResearchSchema();

  const companyResult = await pool.query('SELECT id, ticker, name FROM companies WHERE ticker = $1', [ticker]);
  if (companyResult.rowCount === 0) return null;
  const company = companyResult.rows[0];

  const [prices, news, sec, earnings, analyst, theses, financials] = await Promise.all([
    pool.query(
      `SELECT id, price, previous_close, currency, captured_at
       FROM price_snapshots WHERE company_id = $1 AND price IS NOT NULL
       ORDER BY captured_at DESC, id DESC LIMIT 2`,
      [company.id],
    ),
    pool.query(
      `SELECT id, title, publisher, url, published_at, discovered_at
       FROM news_items
       WHERE company_id = $1 AND COALESCE(published_at, discovered_at) >= now() - interval '14 days'
       ORDER BY COALESCE(published_at, discovered_at) DESC LIMIT 8`,
      [company.id],
    ),
    pool.query(
      `SELECT id, form_type, to_char(filed_at, 'YYYY-MM-DD') AS filed_at,
              description, url, discovered_at
       FROM sec_events
       WHERE company_id = $1 AND discovered_at >= now() - interval '90 days'
       ORDER BY discovered_at DESC, filed_at DESC NULLS LAST LIMIT 8`,
      [company.id],
    ),
    pool.query(
      `SELECT id, event_at, timing FROM earnings_events
       WHERE company_id = $1 AND event_at >= now() AND event_at <= now() + interval '90 days'
       ORDER BY event_at ASC LIMIT 1`,
      [company.id],
    ),
    pool.query(
      `SELECT id, captured_at, target_mean_price, target_high_price, target_low_price,
              recommendation_mean, recommendation_key, analyst_count
       FROM analyst_targets WHERE company_id = $1
       ORDER BY captured_at DESC, id DESC LIMIT 1`,
      [company.id],
    ),
    pool.query(
      `SELECT p.id, p.status, t.thesis, t.time_horizon, t.created_at
       FROM portfolio_positions p
       JOIN investment_theses t ON t.position_id = p.id AND t.is_current
       WHERE p.ticker = $1 AND p.status <> 'closed'
       ORDER BY p.updated_at DESC LIMIT 3`,
      [ticker],
    ),
    getCompanyFinancials(ticker).catch((error) => {
      console.error(`Ettevõtte ${ticker} finantsfakte ei saanud Research Briefi lisada:`, error);
      return null;
    }),
  ]);

  const sources: BriefSource[] = [];
  prices.rows.forEach((row, index) => sources.push({
    id: `price:${row.id}`,
    type: 'price',
    label: index === 0 ? 'Viimane hinnasnapshot' : 'Eelmine hinnasnapshot',
    url: null,
    occurredAt: asIso(row.captured_at),
    data: { price: asNumber(row.price), previousClose: asNumber(row.previous_close), currency: row.currency || null },
  }));
  news.rows.forEach((row) => sources.push({
    id: `news:${row.id}`,
    type: 'news',
    label: row.title,
    url: row.url,
    occurredAt: asIso(row.published_at || row.discovered_at),
    data: { title: row.title, publisher: row.publisher || null },
  }));
  sec.rows.forEach((row) => sources.push({
    id: `sec:${row.id}`,
    type: 'sec',
    label: `${row.form_type || 'SEC filing'} · ${row.description || 'SEC dokument'}`,
    url: row.url,
    occurredAt: row.filed_at || asIso(row.discovered_at),
    data: { form: row.form_type || null, description: row.description || null },
  }));
  earnings.rows.forEach((row) => sources.push({
    id: `earnings:${row.id}`,
    type: 'earnings',
    label: 'Järgmine tulemuste avaldamine',
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`,
    occurredAt: asIso(row.event_at),
    data: { eventAt: asIso(row.event_at), timing: row.timing || null },
  }));
  analyst.rows.forEach((row) => sources.push({
    id: `analyst:${row.id}`,
    type: 'analyst',
    label: 'Yahoo Finance analüütikute konsensus',
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/analysis`,
    occurredAt: asIso(row.captured_at),
    data: {
      targetMeanPrice: asNumber(row.target_mean_price),
      targetHighPrice: asNumber(row.target_high_price),
      targetLowPrice: asNumber(row.target_low_price),
      recommendationMean: asNumber(row.recommendation_mean),
      recommendationKey: row.recommendation_key || null,
      analystCount: asNumber(row.analyst_count),
    },
  }));
  theses.rows.forEach((row) => sources.push({
    id: `thesis:${row.id}`,
    type: 'thesis',
    label: 'Portfelli praegune investeerimistees',
    url: null,
    occurredAt: asIso(row.created_at),
    data: { thesis: row.thesis, timeHorizon: row.time_horizon || null, status: row.status },
  }));

  if (financials) {
    (Object.entries(financials.metrics) as Array<[string, FinancialMetricSummary | undefined]>).forEach(([metric, summary]) => {
      if (!summary) return;
      const previous = summary.previousComparable;
      const previousSourceId = previous?.id != null ? `financial:${previous.id}` : null;
      sources.push({
        id: `financial:${summary.latest.id}`,
        type: 'financial',
        label: `${metric.replaceAll('_', ' ')} · ${summary.latest.periodEnd}`,
        url: summary.latest.sourceUrl,
        occurredAt: `${summary.latest.filedAt}T00:00:00.000Z`,
        data: {
          metric,
          role: 'latest',
          value: summary.latest.value,
          unit: summary.latest.unit,
          periodStart: summary.latest.periodStart,
          periodEnd: summary.latest.periodEnd,
          periodKind: summary.latest.periodKind,
          form: summary.latest.form,
          derived: summary.latest.derived,
          yearOverYearPercent: summary.yearOverYearPercent,
          previousSourceId,
        },
      });
      if (previous && previousSourceId) sources.push({
        id: previousSourceId,
        type: 'financial',
        label: `${metric.replaceAll('_', ' ')} · võrdlus ${previous.periodEnd}`,
        url: previous.sourceUrl,
        occurredAt: `${previous.filedAt}T00:00:00.000Z`,
        data: {
          metric,
          role: 'previous',
          value: previous.value,
          unit: previous.unit,
          periodStart: previous.periodStart,
          periodEnd: previous.periodEnd,
          periodKind: previous.periodKind,
          form: previous.form,
          derived: previous.derived,
        },
      });
    });
  }

  const sufficient = sources.length >= 1;
  return {
    companyId: Number(company.id),
    ticker,
    companyName: company.name || null,
    sources,
    inputHash: sourceHash(ticker, sources),
    sufficient,
    reason: sufficient ? null : 'Kokkuvõtte jaoks pole veel kogutud andmeid.',
  };
}

function mapStoredBrief(row: any): StoredResearchBrief {
  const stored = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
  return {
    id: Number(row.id),
    inputHash: row.input_hash,
    model: row.model,
    generatedAt: new Date(row.generated_at).toISOString(),
    content: stored.brief,
    sources: Array.isArray(stored.sources) ? stored.sources : [],
  };
}

async function findBrief(companyId: number, inputHash?: string): Promise<StoredResearchBrief | null> {
  const result = inputHash
    ? await pool.query(
      'SELECT id, input_hash, model, content, generated_at FROM research_briefs WHERE company_id = $1 AND input_hash = $2 LIMIT 1',
      [companyId, inputHash],
    )
    : await pool.query(
      'SELECT id, input_hash, model, content, generated_at FROM research_briefs WHERE company_id = $1 ORDER BY generated_at DESC, id DESC LIMIT 1',
      [companyId],
    );
  return result.rows[0] ? mapStoredBrief(result.rows[0]) : null;
}

export async function getResearchBriefState(rawTicker: string): Promise<ResearchBriefState> {
  const ticker = normalizeTicker(rawTicker) || '';
  const input = ticker ? await buildResearchInput(ticker) : null;
  if (!input) return { ticker, configured: true, sufficient: false, reason: 'Ettevõtte andmeid ei leitud.', inputHash: null, brief: null, stale: false };
  const current = await findBrief(input.companyId, input.inputHash);
  if (current) return { ticker, configured: true, sufficient: input.sufficient, reason: input.reason, inputHash: input.inputHash, brief: current, stale: false };
  const latest = await findBrief(input.companyId);
  return { ticker, configured: true, sufficient: input.sufficient, reason: input.reason, inputHash: input.inputHash, brief: latest, stale: Boolean(latest) };
}

async function generate(rawTicker: string, force: boolean): Promise<StoredResearchBrief> {
  const input = await buildResearchInput(rawTicker);
  if (!input) throw new Error('Ettevõtte andmeid ei leitud.');
  if (!input.sufficient) throw new Error(input.reason || 'Kokkuvõtte jaoks pole piisavalt andmeid.');
  if (!force) {
    const cached = await findBrief(input.companyId, input.inputHash);
    if (cached) return cached;
  }
  const generated = { model: GENERATOR_VERSION, content: buildSignalBrief(input) };
  const result = await pool.query(
    `INSERT INTO research_briefs (company_id, input_hash, model, content, source_count)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (company_id, input_hash) DO UPDATE SET
       model = EXCLUDED.model, content = EXCLUDED.content,
       source_count = EXCLUDED.source_count, generated_at = now()
     RETURNING id, input_hash, model, content, generated_at`,
    [input.companyId, input.inputHash, generated.model, JSON.stringify({ brief: generated.content, sources: input.sources }), input.sources.length],
  );
  return mapStoredBrief(result.rows[0]);
}

export function generateResearchBrief(rawTicker: string, force = false): Promise<StoredResearchBrief> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return Promise.reject(new Error('Ticker pole korrektne.'));
  const key = `${ticker}:${force ? 'force' : 'normal'}`;
  const running = generations.get(key);
  if (running) return running;
  const promise = generate(ticker, force).finally(() => generations.delete(key));
  generations.set(key, promise);
  return promise;
}
