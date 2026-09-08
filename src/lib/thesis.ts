import { createHash } from 'crypto';
import { ensureSchema, pool } from './db';

export type ThesisStatus = 'draft' | 'researching' | 'ready' | 'rejected';

export interface ThesisCardInput {
  summary: string;
  business: string;
  whyNow: string;
  moat: string;
  mispricing: string;
  catalyst: string;
  invalidation: string;
  twelveMonthCheckpoint: string;
  checkpointIsMeasurable: boolean;
  revenueAssumption: string;
  marginAssumption: string;
  cashFlowAssumption: string;
  dilutionAssumption: string;
  valuationAssumption: string;
  downsideScenario: string;
  reverseValuationQuestion: string;
  nextReviewTrigger: string;
  timeHorizon: string;
  status: ThesisStatus;
  scoreSnapshotId: number | null;
  valuationPriceSnapshotId: number | null;
}

export interface ValuationPriceContext {
  id: number;
  price: number;
  currency: string | null;
  marketCap: number | null;
  capturedAt: string;
  marketAt: string | null;
}

export interface ThesisVersion extends ThesisCardInput {
  id: number;
  version: number;
  createdAt: string;
  isCurrent: boolean;
  scoreVersion: string | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number | null;
  valuationPrice: ValuationPriceContext | null;
}

export interface ThesisWorkspace {
  positionId: number;
  ticker: string;
  companyName: string | null;
  positionStatus: string;
  current: ThesisVersion | null;
  history: ThesisVersion[];
  latestValuationPrice: ValuationPriceContext | null;
}

const TEXT_LIMIT = 5000;

function clean(value: string): string {
  return value.trim().replace(/\r\n/g, '\n');
}

function canonicalize(input: ThesisCardInput): ThesisCardInput {
  return {
    summary: clean(input.summary),
    business: clean(input.business),
    whyNow: clean(input.whyNow),
    moat: clean(input.moat),
    mispricing: clean(input.mispricing),
    catalyst: clean(input.catalyst),
    invalidation: clean(input.invalidation),
    twelveMonthCheckpoint: clean(input.twelveMonthCheckpoint),
    checkpointIsMeasurable: Boolean(input.checkpointIsMeasurable),
    revenueAssumption: clean(input.revenueAssumption),
    marginAssumption: clean(input.marginAssumption),
    cashFlowAssumption: clean(input.cashFlowAssumption),
    dilutionAssumption: clean(input.dilutionAssumption),
    valuationAssumption: clean(input.valuationAssumption),
    downsideScenario: clean(input.downsideScenario),
    reverseValuationQuestion: clean(input.reverseValuationQuestion),
    nextReviewTrigger: clean(input.nextReviewTrigger),
    timeHorizon: clean(input.timeHorizon),
    status: input.status,
    scoreSnapshotId: input.scoreSnapshotId,
    valuationPriceSnapshotId: input.valuationPriceSnapshotId,
  };
}

function inputHash(input: ThesisCardInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function validateThesisCard(raw: ThesisCardInput): string | null {
  const input = canonicalize(raw);
  if (!['draft', 'researching', 'ready', 'rejected'].includes(input.status)) return 'Teesi staatus ei ole lubatud.';
  const values = [
    input.summary, input.business, input.whyNow, input.moat, input.mispricing,
    input.catalyst, input.invalidation, input.twelveMonthCheckpoint,
    input.revenueAssumption, input.marginAssumption, input.cashFlowAssumption,
    input.dilutionAssumption, input.valuationAssumption, input.downsideScenario,
    input.reverseValuationQuestion, input.nextReviewTrigger,
  ];
  if (values.some((value) => value.length > TEXT_LIMIT) || input.timeHorizon.length > 200) {
    return 'Üks teesi väljadest on liiga pikk.';
  }
  if (input.status === 'ready') {
    if (!input.invalidation) return 'Enne staatust “ready” kirjelda mõõdetav invalidation-tingimus.';
    if (!input.twelveMonthCheckpoint) return 'Enne staatust “ready” lisa 12 kuu kontrollpunkt.';
    if (!input.checkpointIsMeasurable) return 'Kinnita, et 12 kuu kontrollpunkti saab objektiivselt hinnata.';
    const checkpoint = input.twelveMonthCheckpoint.toLocaleLowerCase('et-EE');
    if (checkpoint === input.summary.toLocaleLowerCase('et-EE') || checkpoint === input.business.toLocaleLowerCase('et-EE')) {
      return '12 kuu kontrollpunkt peab erinema teesi kokkuvõttest ja ettevõtte kirjeldusest.';
    }
  }
  return null;
}

function mapVersion(row: any): ThesisVersion {
  return {
    id: Number(row.id),
    version: Number(row.version || 1),
    summary: row.thesis || '',
    business: row.business || '',
    whyNow: row.why_now || '',
    moat: row.moat || '',
    mispricing: row.mispricing || '',
    catalyst: row.catalyst || '',
    invalidation: row.invalidation || '',
    twelveMonthCheckpoint: row.twelve_month_checkpoint || '',
    checkpointIsMeasurable: Boolean(row.checkpoint_is_measurable),
    revenueAssumption: row.revenue_assumption || '',
    marginAssumption: row.margin_assumption || '',
    cashFlowAssumption: row.cash_flow_assumption || '',
    dilutionAssumption: row.dilution_assumption || '',
    valuationAssumption: row.valuation_assumption || '',
    downsideScenario: row.downside_scenario || '',
    reverseValuationQuestion: row.reverse_valuation_question || '',
    nextReviewTrigger: row.next_review_trigger || '',
    timeHorizon: row.time_horizon || '',
    status: (row.status || 'draft') as ThesisStatus,
    scoreSnapshotId: row.score_snapshot_id == null ? null : Number(row.score_snapshot_id),
    valuationPriceSnapshotId: row.valuation_price_snapshot_id == null ? null : Number(row.valuation_price_snapshot_id),
    createdAt: new Date(row.created_at).toISOString(),
    isCurrent: Boolean(row.is_current),
    scoreVersion: row.scoring_version || null,
    growthScore: row.growth_score == null ? null : Number(row.growth_score),
    healthScore: row.health_score == null ? null : Number(row.health_score),
    coverageScore: row.coverage_score == null ? null : Number(row.coverage_score),
    valuationPrice: row.valuation_price_snapshot_id == null || row.valuation_price == null ? null : {
      id: Number(row.valuation_price_snapshot_id),
      price: Number(row.valuation_price),
      currency: row.valuation_currency || null,
      marketCap: row.valuation_market_cap == null ? null : Number(row.valuation_market_cap),
      capturedAt: new Date(row.valuation_captured_at).toISOString(),
      marketAt: row.valuation_market_at == null ? null : new Date(row.valuation_market_at).toISOString(),
    },
  };
}

export async function getThesisWorkspace(positionId: number): Promise<ThesisWorkspace | null> {
  if (!Number.isInteger(positionId) || positionId <= 0) return null;
  await ensureSchema();
  const position = await pool.query(
    `SELECT p.id, p.ticker, p.status, c.name,
       latest_price.id AS latest_price_snapshot_id, latest_price.price AS latest_price,
       latest_price.currency AS latest_currency, latest_price.market_cap AS latest_market_cap,
       latest_price.captured_at AS latest_captured_at, latest_price.market_at AS latest_market_at
     FROM portfolio_positions p
     LEFT JOIN companies c ON c.id = p.company_id
     LEFT JOIN LATERAL (
       SELECT ps.id, ps.price, ps.currency, ps.market_cap, ps.captured_at, ps.market_at
       FROM price_snapshots ps WHERE ps.company_id = p.company_id AND ps.price IS NOT NULL
       ORDER BY ps.captured_at DESC, ps.id DESC LIMIT 1
     ) latest_price ON true
     WHERE p.id = $1`,
    [positionId],
  );
  if (!position.rowCount) return null;
  const { rows } = await pool.query(
    `SELECT t.*, s.scoring_version, s.growth_score, s.health_score, s.coverage_score,
       valuation_price.price AS valuation_price, valuation_price.currency AS valuation_currency,
       valuation_price.market_cap AS valuation_market_cap,
       valuation_price.captured_at AS valuation_captured_at,
       valuation_price.market_at AS valuation_market_at
     FROM investment_theses t
     LEFT JOIN company_score_snapshots s ON s.id = t.score_snapshot_id
     LEFT JOIN price_snapshots valuation_price ON valuation_price.id = t.valuation_price_snapshot_id
     WHERE t.position_id = $1
     ORDER BY t.version DESC, t.created_at DESC, t.id DESC`,
    [positionId],
  );
  const history = rows.map(mapVersion);
  const latest = position.rows[0];
  return {
    positionId,
    ticker: position.rows[0].ticker,
    companyName: position.rows[0].name || null,
    positionStatus: position.rows[0].status,
    current: history.find((version) => version.isCurrent) || null,
    history,
    latestValuationPrice: latest.latest_price_snapshot_id == null ? null : {
      id: Number(latest.latest_price_snapshot_id),
      price: Number(latest.latest_price),
      currency: latest.latest_currency || null,
      marketCap: latest.latest_market_cap == null ? null : Number(latest.latest_market_cap),
      capturedAt: new Date(latest.latest_captured_at).toISOString(),
      marketAt: latest.latest_market_at == null ? null : new Date(latest.latest_market_at).toISOString(),
    },
  };
}

export async function saveThesisCard(positionId: number, raw: ThesisCardInput): Promise<{ created: boolean; version: number }> {
  if (!Number.isInteger(positionId) || positionId <= 0) throw new Error('Vigane positsiooni ID.');
  const input = canonicalize(raw);
  const validationError = validateThesisCard(input);
  if (validationError) throw new Error(validationError);
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const position = await client.query(
      `SELECT id, company_id, ticker FROM portfolio_positions WHERE id = $1 FOR UPDATE`,
      [positionId],
    );
    if (!position.rowCount) throw new Error('Watchlisti või portfelli kirjet ei leitud.');

    let scoreSnapshotId = input.scoreSnapshotId;
    if (scoreSnapshotId != null) {
      const score = await client.query(
        `SELECT id FROM company_score_snapshots WHERE id = $1 AND company_id = $2`,
        [scoreSnapshotId, position.rows[0].company_id],
      );
      if (!score.rowCount) scoreSnapshotId = null;
    }
    let valuationPriceSnapshotId = input.valuationPriceSnapshotId;
    if (valuationPriceSnapshotId != null) {
      const price = await client.query(
        `SELECT id FROM price_snapshots WHERE id = $1 AND company_id = $2`,
        [valuationPriceSnapshotId, position.rows[0].company_id],
      );
      if (!price.rowCount) valuationPriceSnapshotId = null;
    }
    const normalized = { ...input, scoreSnapshotId, valuationPriceSnapshotId };
    const hash = inputHash(normalized);
    const current = await client.query(
      `SELECT id, version, content_hash, thesis FROM investment_theses
       WHERE position_id = $1 AND is_current = true
       ORDER BY version DESC, id DESC LIMIT 1 FOR UPDATE`,
      [positionId],
    );
    if (current.rows[0]?.content_hash === hash) {
      await client.query('COMMIT');
      return { created: false, version: Number(current.rows[0].version || 1) };
    }
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM investment_theses WHERE position_id = $1`,
      [positionId],
    );
    const version = Number(versionResult.rows[0].next_version);
    await client.query(`UPDATE investment_theses SET is_current = false WHERE position_id = $1 AND is_current = true`, [positionId]);
    await client.query(
      `INSERT INTO investment_theses
       (position_id, thesis, business, why_now, moat, mispricing, catalyst, invalidation,
        twelve_month_checkpoint, checkpoint_is_measurable, revenue_assumption,
        margin_assumption, cash_flow_assumption, dilution_assumption, valuation_assumption,
        downside_scenario, reverse_valuation_question, next_review_trigger, time_horizon,
        status, version, content_hash, score_snapshot_id, valuation_price_snapshot_id, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,true)`,
      [
        positionId, normalized.summary, normalized.business, normalized.whyNow,
        normalized.moat, normalized.mispricing, normalized.catalyst, normalized.invalidation,
        normalized.twelveMonthCheckpoint, normalized.checkpointIsMeasurable,
        normalized.revenueAssumption, normalized.marginAssumption,
        normalized.cashFlowAssumption, normalized.dilutionAssumption,
        normalized.valuationAssumption, normalized.downsideScenario,
        normalized.reverseValuationQuestion, normalized.nextReviewTrigger,
        normalized.timeHorizon || null, normalized.status, version, hash,
        normalized.scoreSnapshotId, normalized.valuationPriceSnapshotId,
      ],
    );
    await client.query(
      `INSERT INTO thesis_change_events (position_id, previous_thesis, new_thesis, change_reason)
       VALUES ($1,$2,$3,$4)`,
      [positionId, current.rows[0]?.thesis || null, normalized.summary || null, `Thesis Builder v${version}`],
    );
    await client.query(`UPDATE portfolio_positions SET updated_at = now() WHERE id = $1`, [positionId]);
    await client.query('COMMIT');
    return { created: true, version };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
