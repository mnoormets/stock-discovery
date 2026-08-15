import type { PoolClient } from 'pg';
import { ensureSchema, pool } from './db';
import { toDateOnly } from './date-only';
import { CANONICAL_RUN_TYPE, DISCOVERY_MODEL_VERSION } from './discovery-validation';

export type PriorCoverage = 'included' | 'excluded' | 'radar_data_gap' | 'universe_gap';

export interface MissedMoveAudit {
  ticker: string;
  name: string | null;
  currency: string | null;
  previousDate: string;
  observedDate: string;
  previousPrice: number;
  observedPrice: number;
  changePercent: number;
  priorCoverage: PriorCoverage;
  exclusionReasons: string[];
  radarSeenBeforeMove: boolean;
  intervalNews: number;
  intervalSecEvents: number;
  intervalEarnings: number;
}

export function classifyPriorCoverage(input: {
  decisionIncluded: boolean | null;
  hadDecision: boolean;
  radarSeenBeforeMove: boolean;
}): PriorCoverage {
  if (input.hadDecision) return input.decisionIncluded ? 'included' : 'excluded';
  return input.radarSeenBeforeMove ? 'radar_data_gap' : 'universe_gap';
}

type MissedMoveOptions = {
  thresholdPercent?: number;
  lookbackDays?: number;
};

async function queryMissedMoveAudits(
  queryable: Pick<PoolClient, 'query'> | typeof pool,
  options: MissedMoveOptions = {},
): Promise<MissedMoveAudit[]> {
  const thresholdPercent = Math.max(1, Math.min(50, options.thresholdPercent ?? 8));
  const lookbackDays = Math.max(7, Math.min(365, options.lookbackDays ?? 60));

  const { rows } = await queryable.query(
    `WITH daily AS (
       SELECT DISTINCT ON (p.company_id, (p.captured_at AT TIME ZONE 'Europe/Tallinn')::date)
         p.company_id,
         c.ticker,
         c.name,
         COALESCE(p.currency, c.currency) AS currency,
         (p.captured_at AT TIME ZONE 'Europe/Tallinn')::date AS price_date,
         p.captured_at,
         p.price
       FROM price_snapshots p
       JOIN companies c ON c.id = p.company_id
       WHERE p.price IS NOT NULL AND p.price > 0
         AND p.captured_at >= now() - ($2::int + 10) * interval '1 day'
       ORDER BY p.company_id, (p.captured_at AT TIME ZONE 'Europe/Tallinn')::date,
                p.captured_at DESC, p.id DESC
     ), paired AS (
       SELECT daily.*,
              lag(price) OVER (PARTITION BY company_id ORDER BY price_date) AS previous_price,
              lag(price_date) OVER (PARTITION BY company_id ORDER BY price_date) AS previous_date,
              lag(captured_at) OVER (PARTITION BY company_id ORDER BY price_date) AS previous_captured_at
       FROM daily
     ), canonical_runs AS (
       SELECT DISTINCT ON (decision_date) id, decision_date
       FROM discovery_runs
       WHERE run_type = $3 AND model_version = $4
       ORDER BY decision_date, run_at DESC, id DESC
     )
     SELECT p.*,
            d.id AS decision_id,
            d.included AS decision_included,
            d.exclusion_reasons,
            EXISTS (
              SELECT 1 FROM snapshots s
              WHERE s.ticker = p.ticker
                AND s.capture_date <= p.previous_date
                AND s.capture_date >= p.previous_date - interval '30 days'
            ) AS radar_seen_before_move,
            (SELECT count(*)::int FROM news_items n
             WHERE n.company_id = p.company_id
               AND n.published_at > p.previous_captured_at
               AND n.published_at <= p.captured_at) AS interval_news,
            (SELECT count(*)::int FROM sec_events se
             WHERE se.company_id = p.company_id
               AND se.filed_at > p.previous_date
               AND se.filed_at <= p.price_date) AS interval_sec_events,
            (SELECT count(*)::int FROM earnings_events ee
             WHERE ee.company_id = p.company_id
               AND ee.event_at > p.previous_captured_at
               AND ee.event_at <= p.captured_at) AS interval_earnings
     FROM paired p
     LEFT JOIN canonical_runs r ON r.decision_date = p.previous_date
     LEFT JOIN discovery_decisions d ON d.run_id = r.id AND d.ticker = p.ticker
     WHERE p.previous_price IS NOT NULL AND p.previous_price > 0
       AND p.price_date >= (now() AT TIME ZONE 'Europe/Tallinn')::date - $2::int
       AND p.price_date - p.previous_date BETWEEN 1 AND 7
       AND abs(((p.price / p.previous_price) - 1) * 100) >= $1
     ORDER BY p.price_date DESC, abs(((p.price / p.previous_price) - 1) * 100) DESC, p.ticker
     LIMIT 100`,
    [thresholdPercent, lookbackDays, CANONICAL_RUN_TYPE, DISCOVERY_MODEL_VERSION],
  );

  return rows.map((row) => {
    const radarSeenBeforeMove = Boolean(row.radar_seen_before_move);
    const hadDecision = row.decision_id != null;
    return {
      ticker: String(row.ticker),
      name: row.name || null,
      currency: row.currency || null,
      previousDate: toDateOnly(row.previous_date),
      observedDate: toDateOnly(row.price_date),
      previousPrice: Number(row.previous_price),
      observedPrice: Number(row.price),
      changePercent: (Number(row.price) / Number(row.previous_price) - 1) * 100,
      priorCoverage: classifyPriorCoverage({
        decisionIncluded: hadDecision ? Boolean(row.decision_included) : null,
        hadDecision,
        radarSeenBeforeMove,
      }),
      exclusionReasons: Array.isArray(row.exclusion_reasons) ? row.exclusion_reasons.map(String) : [],
      radarSeenBeforeMove,
      intervalNews: Number(row.interval_news || 0),
      intervalSecEvents: Number(row.interval_sec_events || 0),
      intervalEarnings: Number(row.interval_earnings || 0),
    };
  });
}

export async function getMissedMoveAudits(options: MissedMoveOptions = {}): Promise<MissedMoveAudit[]> {
  await ensureSchema();
  return queryMissedMoveAudits(pool, options);
}

// `/today` hoiab mitme SELECT-i brief'i ühe PostgreSQL READ ONLY
// transaktsiooni sees. Selle variandiga ei kutsuta runtime DDL-i ega avata uut
// ühendust; caller peab andma read-only transaktsioonis oleva kliendi.
export function getMissedMoveAuditsReadOnly(
  client: PoolClient,
  options: MissedMoveOptions = {},
): Promise<MissedMoveAudit[]> {
  return queryMissedMoveAudits(client, options);
}
