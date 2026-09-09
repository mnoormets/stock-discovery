import { pool } from './db';

export type ThesisReviewState = 'review_due' | 'awaiting_evidence' | 'reviewed';
export type ThesisAssumptionState = ThesisReviewState | 'missing';

export interface ThesisReviewEvidence {
  kind: 'financial_filing' | 'sec_event' | 'earnings_date_passed';
  label: string;
  occurredAt: string;
  observedAt: string | null;
  sourceUrl: string | null;
}

export interface ThesisReviewAssumption {
  key: string;
  label: string;
  text: string;
  state: ThesisAssumptionState;
}

export interface ThesisReviewItem {
  positionId: number;
  ticker: string;
  companyName: string | null;
  thesisId: number;
  thesisVersion: number;
  thesisStatus: string;
  thesisCreatedAt: string;
  state: ThesisReviewState;
  decisionPrice: number | null;
  decisionCurrency: string | null;
  decisionPriceAt: string | null;
  latestPrice: number | null;
  latestCurrency: string | null;
  latestPriceAt: string | null;
  priceChangePercent: number | null;
  nextEarningsAt: string | null;
  nextReviewTrigger: string;
  assumptions: ThesisReviewAssumption[];
  dueEvidence: ThesisReviewEvidence[];
}

export interface ThesisReviewQueue {
  items: ThesisReviewItem[];
  dueCount: number;
}

interface ThesisRow {
  position_id: string | number;
  company_id: string | number;
  ticker: string;
  company_name: string | null;
  thesis_id: string | number;
  thesis_version: string | number;
  thesis_status: string;
  thesis_created_at: Date | string;
  revenue_assumption: string | null;
  margin_assumption: string | null;
  cash_flow_assumption: string | null;
  dilution_assumption: string | null;
  valuation_assumption: string | null;
  downside_scenario: string | null;
  reverse_valuation_question: string | null;
  next_review_trigger: string | null;
  decision_price: string | number | null;
  decision_currency: string | null;
  decision_price_at: Date | string | null;
  latest_price: string | number | null;
  latest_currency: string | null;
  latest_price_at: Date | string | null;
}

const assumptionFields = [
  ['revenue_assumption', 'Revenue'],
  ['margin_assumption', 'Margin'],
  ['cash_flow_assumption', 'Cash flow'],
  ['dilution_assumption', 'Dilution'],
  ['valuation_assumption', 'Valuation'],
  ['downside_scenario', 'Downside'],
  ['reverse_valuation_question', 'Reverse valuation'],
  ['next_review_trigger', 'Next review trigger'],
] as const;

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function numberOrNull(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function priceChange(
  decisionPrice: number | null,
  latestPrice: number | null,
  decisionCurrency: string | null,
  latestCurrency: string | null,
): number | null {
  if (decisionPrice == null || latestPrice == null || decisionPrice <= 0) return null;
  if (!decisionCurrency || !latestCurrency || decisionCurrency !== latestCurrency) return null;
  return ((latestPrice / decisionPrice) - 1) * 100;
}

/**
 * Reads current, non-rejected theses and evidence in one repeatable read-only
 * transaction. Free-text assumptions are never parsed into pass/fail claims.
 */
export async function getThesisReviewQueue(now = new Date()): Promise<ThesisReviewQueue> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const thesisResult = await client.query<ThesisRow>(
      `SELECT p.id AS position_id, p.company_id, p.ticker, c.name AS company_name,
              t.id AS thesis_id, t.version AS thesis_version, t.status AS thesis_status,
              t.created_at AS thesis_created_at,
              t.revenue_assumption, t.margin_assumption, t.cash_flow_assumption,
              t.dilution_assumption, t.valuation_assumption, t.downside_scenario,
              t.reverse_valuation_question, t.next_review_trigger,
              decision_price.price AS decision_price,
              decision_price.currency AS decision_currency,
              COALESCE(decision_price.market_at, decision_price.captured_at) AS decision_price_at,
              latest_price.price AS latest_price,
              latest_price.currency AS latest_currency,
              COALESCE(latest_price.market_at, latest_price.captured_at) AS latest_price_at
       FROM investment_theses t
       JOIN portfolio_positions p ON p.id = t.position_id
       LEFT JOIN companies c ON c.id = p.company_id
       LEFT JOIN price_snapshots decision_price
         ON decision_price.id = t.valuation_price_snapshot_id
        AND decision_price.company_id = p.company_id
       LEFT JOIN LATERAL (
         SELECT ps.price, ps.currency, ps.market_at, ps.captured_at
         FROM price_snapshots ps
         WHERE ps.company_id = p.company_id AND ps.price IS NOT NULL AND ps.price > 0
         ORDER BY COALESCE(ps.market_at, ps.captured_at) DESC, ps.captured_at DESC, ps.id DESC
         LIMIT 1
       ) latest_price ON true
       WHERE t.is_current = true
         AND t.status <> 'rejected'
         AND p.status IN ('active', 'watch')
       ORDER BY p.ticker, p.id`,
    );

    if (thesisResult.rows.length === 0) {
      await client.query('COMMIT');
      return { items: [], dueCount: 0 };
    }

    const companyIds = thesisResult.rows.map((row) => Number(row.company_id));
    const positionIds = thesisResult.rows.map((row) => Number(row.position_id));
    const financialResult = await client.query(
      `SELECT p.id AS position_id, f.company_id, f.accession_number,
              min(f.form_type) AS form_type, max(f.filed_at)::text AS filed_at,
              max(f.created_at) AS observed_at,
              (array_agg(f.source_url ORDER BY f.id DESC))[1] AS source_url
       FROM financial_facts f
       JOIN portfolio_positions p ON p.company_id = f.company_id
       JOIN investment_theses t ON t.position_id = p.id AND t.is_current = true
       WHERE f.company_id = ANY($1::bigint[])
         AND p.id = ANY($2::bigint[])
         AND (f.created_at > t.created_at OR f.filed_at > (t.created_at AT TIME ZONE 'UTC')::date)
         AND f.created_at <= $3::timestamptz
         AND f.filed_at <= ($3::timestamptz AT TIME ZONE 'UTC')::date
       GROUP BY p.id, f.company_id, f.accession_number
       ORDER BY max(f.created_at) DESC, max(f.filed_at) DESC`,
      [companyIds, positionIds, now],
    );
    const catalystResult = await client.query(
      `SELECT p.id AS position_id, e.id, e.event_kind, e.headline, e.url,
              COALESCE(e.occurred_at, e.first_seen_at) AS occurred_at,
              e.first_seen_at AS observed_at, a.thesis_relevance
       FROM catalyst_events e
       JOIN portfolio_positions p ON p.company_id = e.company_id
       JOIN investment_theses t ON t.position_id = p.id AND t.is_current = true
       JOIN LATERAL (
         SELECT ca.thesis_relevance
         FROM catalyst_assessments ca
         WHERE ca.catalyst_event_id = e.id
         ORDER BY ca.assessed_at DESC, ca.id DESC
         LIMIT 1
       ) a ON true
       WHERE e.company_id = ANY($1::bigint[])
         AND p.id = ANY($2::bigint[])
         AND e.event_kind = 'sec_filing'
         AND a.thesis_relevance IN ('decisive', 'supporting')
         AND (e.first_seen_at > t.created_at OR e.occurred_at > t.created_at)
         AND COALESCE(e.occurred_at, e.first_seen_at) <= $3::timestamptz
       ORDER BY COALESCE(e.occurred_at, e.first_seen_at) DESC, e.id DESC`,
      [companyIds, positionIds, now],
    );
    const earningsResult = await client.query(
      `SELECT p.id AS position_id, e.event_at
       FROM earnings_events e
       JOIN portfolio_positions p ON p.company_id = e.company_id
       WHERE e.company_id = ANY($1::bigint[])
         AND p.id = ANY($2::bigint[])
       ORDER BY p.id, e.event_at`,
      [companyIds, positionIds],
    );

    const financialByPosition = new Map<number, ThesisReviewEvidence[]>();
    for (const row of financialResult.rows) {
      const positionId = Number(row.position_id);
      const evidence = financialByPosition.get(positionId) || [];
      evidence.push({
        kind: 'financial_filing',
        label: `${row.form_type || 'SEC filing'} ${row.filed_at || ''}`.trim(),
        occurredAt: new Date(`${row.filed_at}T00:00:00.000Z`).toISOString(),
        observedAt: iso(row.observed_at),
        sourceUrl: row.source_url || null,
      });
      financialByPosition.set(positionId, evidence);
    }

    const catalystByPosition = new Map<number, ThesisReviewEvidence[]>();
    for (const row of catalystResult.rows) {
      const positionId = Number(row.position_id);
      const evidence = catalystByPosition.get(positionId) || [];
      evidence.push({
        kind: 'sec_event',
        label: row.headline?.trim() || `SEC ${row.event_kind}`,
        occurredAt: iso(row.occurred_at)!,
        observedAt: iso(row.observed_at),
        sourceUrl: row.url || null,
      });
      catalystByPosition.set(positionId, evidence);
    }

    const earningsByPosition = new Map<number, string[]>();
    for (const row of earningsResult.rows) {
      const positionId = Number(row.position_id);
      const dates = earningsByPosition.get(positionId) || [];
      dates.push(new Date(row.event_at).toISOString());
      earningsByPosition.set(positionId, dates);
    }

    const items = thesisResult.rows.map((row): ThesisReviewItem => {
      const positionId = Number(row.position_id);
      const thesisCreatedAt = new Date(row.thesis_created_at).toISOString();
      const earnings = earningsByPosition.get(positionId) || [];
      const nextEarningsAt = earnings.find((eventAt) => new Date(eventAt) >= now) || null;
      const financialEvidence = financialByPosition.get(positionId) || [];
      const dueEvidence = [
        ...financialEvidence,
        ...(catalystByPosition.get(positionId) || []),
      ];
      const passedEarnings = earnings
        .filter((eventAt) => new Date(eventAt) > new Date(thesisCreatedAt) && new Date(eventAt) < now)
        .at(-1);
      if (passedEarnings && financialEvidence.length === 0) {
        dueEvidence.push({
          kind: 'earnings_date_passed',
          label: 'Scheduled results date passed; no newer financial filing is stored',
          occurredAt: passedEarnings,
          observedAt: null,
          sourceUrl: null,
        });
      }
      dueEvidence.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
      const state: ThesisReviewState = dueEvidence.length > 0
        ? 'review_due'
        : nextEarningsAt
          ? 'awaiting_evidence'
          : 'reviewed';
      const assumptions = assumptionFields.map(([key, label]): ThesisReviewAssumption => {
        const text = String(row[key] || '').trim();
        return { key, label, text, state: text ? state : 'missing' };
      });
      const decisionPrice = numberOrNull(row.decision_price);
      const latestPrice = numberOrNull(row.latest_price);
      return {
        positionId,
        ticker: String(row.ticker),
        companyName: row.company_name || null,
        thesisId: Number(row.thesis_id),
        thesisVersion: Number(row.thesis_version),
        thesisStatus: String(row.thesis_status),
        thesisCreatedAt,
        state,
        decisionPrice,
        decisionCurrency: row.decision_currency || null,
        decisionPriceAt: iso(row.decision_price_at),
        latestPrice,
        latestCurrency: row.latest_currency || null,
        latestPriceAt: iso(row.latest_price_at),
        priceChangePercent: priceChange(
          decisionPrice,
          latestPrice,
          row.decision_currency,
          row.latest_currency,
        ),
        nextEarningsAt,
        nextReviewTrigger: String(row.next_review_trigger || '').trim(),
        assumptions,
        dueEvidence: dueEvidence.slice(0, 5),
      };
    });
    const stateOrder: Record<ThesisReviewState, number> = {
      review_due: 0,
      awaiting_evidence: 1,
      reviewed: 2,
    };
    items.sort((left, right) => stateOrder[left.state] - stateOrder[right.state]
      || left.ticker.localeCompare(right.ticker));

    await client.query('COMMIT');
    return { items, dueCount: items.filter((item) => item.state === 'review_due').length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
