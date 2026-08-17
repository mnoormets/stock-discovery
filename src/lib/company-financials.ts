import { createHash } from 'node:crypto';
import { pool } from './db';
import { normalizeTicker } from './investment';

export type FinancialMetric =
  | 'revenue'
  | 'net_income'
  | 'operating_cash_flow'
  | 'capital_expenditure'
  | 'free_cash_flow'
  | 'cash'
  | 'debt'
  | 'shares_outstanding';

export type FinancialPeriodKind = 'quarter' | 'ytd' | 'annual' | 'instant';

export interface FinancialPoint {
  id: number | null;
  metric: FinancialMetric;
  value: number;
  unit: string;
  periodStart: string | null;
  periodEnd: string;
  periodKind: FinancialPeriodKind;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  form: string;
  filedAt: string;
  accessionNumber: string;
  taxonomy: string;
  tag: string;
  derived: boolean;
  sourceUrl: string;
}

export interface FinancialMetricSummary {
  latest: FinancialPoint;
  previousComparable: FinancialPoint | null;
  yearOverYearPercent: number | null;
}

export interface CompanyFinancialSummary {
  ticker: string;
  cik: string;
  companyName: string | null;
  refreshedAt: string | null;
  metrics: Partial<Record<FinancialMetric, FinancialMetricSummary>>;
}

export interface FinancialEnrichmentResult {
  status: 'completed' | 'disabled';
  financialUniverse: number;
  coveredBefore: number;
  coveredAfter: number;
  attempted: number;
  enriched: number;
  unavailable: number;
  failed: number;
  dailyLimit: number;
  attemptedTodayBefore: number;
  dailyRemaining: number;
  attemptedTickers: string[];
  unavailableTickers: string[];
  failedTickers: string[];
}

type ConceptSource = {
  taxonomy: 'us-gaap' | 'dei';
  tags: string[];
};

type MetricDefinition = {
  metric: FinancialMetric;
  taxonomy: 'us-gaap' | 'dei';
  tags: string[];
  unit: 'USD' | 'shares';
  duration: boolean;
  // Prioriteetjärjestuses varuallikad. Neid kasutatakse AINULT siis, kui
  // primaarne allikas ei andnud ühtegi punkti (nt foreign private issuer,
  // kelle CompanyFactsis puudub `dei` sektsioon). Nii jääb olemasolevate
  // esitajate käitumine muutumatuks ega teki duplikaatridu.
  fallbacks?: ConceptSource[];
};

type SecUnit = {
  val?: unknown;
  start?: string;
  end?: string;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};

type SecCompanyFacts = {
  cik?: number;
  entityName?: string;
  facts?: Record<string, Record<string, { units?: Record<string, SecUnit[]> }>>;
};

const SEC_TIMEOUT_MS = 10_000;
const CACHE_MS = 6 * 60 * 60_000;
export const DAILY_FINANCIAL_ENRICHMENT_LIMIT = 5;
export const ENRICHMENT_DELAY_MS = 175;
const ALLOWED_FORMS = new Set(['10-Q', '10-K', '20-F', '40-F']);
const financialCache = new Map<string, { expires: number; value: CompanyFinancialSummary | null }>();
const financialRefreshes = new Map<string, Promise<CompanyFinancialSummary | null>>();
let tickerMapCache: { expires: number; rows: Array<{ ticker: string; cik_str: number; title?: string }> } | null = null;
let schemaPromise: Promise<void> | null = null;

const DEFINITIONS: MetricDefinition[] = [
  {
    metric: 'revenue', taxonomy: 'us-gaap', unit: 'USD', duration: true,
    tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  },
  {
    metric: 'net_income', taxonomy: 'us-gaap', unit: 'USD', duration: true,
    tags: ['NetIncomeLoss', 'ProfitLoss'],
  },
  {
    metric: 'operating_cash_flow', taxonomy: 'us-gaap', unit: 'USD', duration: true,
    tags: ['NetCashProvidedByUsedInOperatingActivities'],
  },
  {
    metric: 'capital_expenditure', taxonomy: 'us-gaap', unit: 'USD', duration: true,
    tags: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsForAdditionsToPropertyPlantAndEquipment'],
  },
  {
    metric: 'cash', taxonomy: 'us-gaap', unit: 'USD', duration: false,
    tags: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  },
  {
    metric: 'shares_outstanding', taxonomy: 'dei', unit: 'shares', duration: false,
    tags: ['EntityCommonStockSharesOutstanding'],
    // 20-F / foreign private issuer (nt Agora/API) CompanyFacts ei sisalda `dei`
    // sektsiooni, kuid `us-gaap:CommonStockSharesOutstanding` on olemas õiges
    // ühikus ja lubatud vormis. NB: `CommonStockSharesIssued` sisaldab treasury
    // aktsiaid ega kirjelda outstanding'ut — seda teadlikult ei kasutata.
    fallbacks: [{ taxonomy: 'us-gaap', tags: ['CommonStockSharesOutstanding'] }],
  },
];

const DEBT_TOTAL_TAGS = ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebt'];
const DEBT_CURRENT_TAGS = ['LongTermDebtAndFinanceLeaseObligationsCurrent', 'LongTermDebtCurrent'];
const DEBT_NONCURRENT_TAGS = ['LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebtNoncurrent'];

export function ensureFinancialSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS sec_cik TEXT;
      CREATE TABLE IF NOT EXISTS financial_facts (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        metric TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        period_start DATE,
        period_end DATE NOT NULL,
        period_kind TEXT NOT NULL,
        fiscal_year INTEGER,
        fiscal_period TEXT,
        form_type TEXT NOT NULL,
        filed_at DATE NOT NULL,
        accession_number TEXT NOT NULL,
        taxonomy TEXT NOT NULL,
        tag TEXT NOT NULL,
        is_derived BOOLEAN NOT NULL DEFAULT false,
        source_url TEXT NOT NULL,
        fact_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (company_id, fact_key)
      );
      CREATE INDEX IF NOT EXISTS idx_financial_facts_company_metric_period
        ON financial_facts (company_id, metric, period_end DESC, filed_at DESC);
      CREATE TABLE IF NOT EXISTS financial_enrichment_status (
        company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_success_at TIMESTAMPTZ,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_financial_enrichment_retry
        ON financial_enrichment_status (status, last_attempt_at);
    `).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function durationDays(start: string, end: string): number {
  return Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000);
}

function periodKind(unit: SecUnit, duration: boolean): FinancialPeriodKind | null {
  if (!duration) return 'instant';
  if (!unit.start || !unit.end) return null;
  const days = durationDays(unit.start, unit.end);
  if (days < 60 || days > 430) return null;
  if (days <= 120) return 'quarter';
  if (days >= 300) return 'annual';
  return 'ytd';
}

function filingUrl(cik: string, accession: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/`;
}

function factKey(point: Omit<FinancialPoint, 'id'>): string {
  return createHash('sha256').update(JSON.stringify([
    point.metric, point.periodStart, point.periodEnd, point.periodKind,
    point.accessionNumber, point.tag, point.value, point.unit,
  ])).digest('hex');
}

function extractDefinition(data: SecCompanyFacts, cik: string, definition: MetricDefinition): FinancialPoint[] {
  const taxonomyFacts = data.facts?.[definition.taxonomy] || {};
  const tag = definition.tags.find((candidate) => Array.isArray(taxonomyFacts[candidate]?.units?.[definition.unit]));
  if (!tag) return [];
  const units = taxonomyFacts[tag]?.units?.[definition.unit] || [];
  const deduped = new Map<string, FinancialPoint>();

  for (const unit of units) {
    const value = numberValue(unit.val);
    const end = dateValue(unit.end);
    const start = dateValue(unit.start);
    const filedAt = dateValue(unit.filed);
    const accession = typeof unit.accn === 'string' ? unit.accn : null;
    const form = typeof unit.form === 'string' ? unit.form : '';
    const kind = periodKind(unit, definition.duration);
    if (value == null || !end || !filedAt || !accession || !kind || !ALLOWED_FORMS.has(form)) continue;
    const point: FinancialPoint = {
      id: null,
      metric: definition.metric,
      value,
      unit: definition.unit,
      periodStart: definition.duration ? start : null,
      periodEnd: end,
      periodKind: kind,
      fiscalYear: Number.isInteger(unit.fy) ? Number(unit.fy) : null,
      fiscalPeriod: typeof unit.fp === 'string' ? unit.fp : null,
      form,
      filedAt,
      accessionNumber: accession,
      taxonomy: definition.taxonomy,
      tag,
      derived: false,
      sourceUrl: filingUrl(cik, accession),
    };
    const key = `${point.periodStart || ''}:${end}:${kind}:${form}`;
    const previous = deduped.get(key);
    if (!previous || `${filedAt}:${accession}` > `${previous.filedAt}:${previous.accessionNumber}`) deduped.set(key, point);
  }
  return [...deduped.values()].sort((a, b) => `${b.periodEnd}:${b.filedAt}`.localeCompare(`${a.periodEnd}:${a.filedAt}`)).slice(0, 30);
}

// Concept alias mapping: proovi primaarset allikat, ja alles selle tühjaks
// jäädes prioriteetjärjestuses varuallikaid. Tagastab ainult ÜHE allika punktid,
// seega sama mõõdiku kohta ei teki duplikaatridu.
function extractMetricPoints(data: SecCompanyFacts, cik: string, definition: MetricDefinition): FinancialPoint[] {
  const primary = extractDefinition(data, cik, definition);
  if (primary.length > 0) return primary;
  for (const fallback of definition.fallbacks || []) {
    const points = extractDefinition(data, cik, {
      ...definition,
      taxonomy: fallback.taxonomy,
      tags: fallback.tags,
    });
    if (points.length > 0) return points;
  }
  return [];
}

function extractInstantTag(data: SecCompanyFacts, cik: string, tags: string[]): FinancialPoint[] {
  return extractDefinition(data, cik, {
    metric: 'debt', taxonomy: 'us-gaap', unit: 'USD', duration: false, tags,
  });
}

function deriveDebt(data: SecCompanyFacts, cik: string): FinancialPoint[] {
  const direct = extractInstantTag(data, cik, DEBT_TOTAL_TAGS);
  if (direct.length) return direct;
  const current = extractInstantTag(data, cik, DEBT_CURRENT_TAGS);
  const noncurrent = extractInstantTag(data, cik, DEBT_NONCURRENT_TAGS);
  const currentByEnd = new Map(current.map((point) => [point.periodEnd, point]));
  return noncurrent.flatMap((longTerm) => {
    const shortTerm = currentByEnd.get(longTerm.periodEnd);
    if (!shortTerm) return [];
    return [{
      ...longTerm,
      value: longTerm.value + shortTerm.value,
      accessionNumber: longTerm.accessionNumber === shortTerm.accessionNumber
        ? longTerm.accessionNumber
        : `${longTerm.accessionNumber}+${shortTerm.accessionNumber}`,
      tag: `${shortTerm.tag}+${longTerm.tag}`,
      derived: true,
      sourceUrl: longTerm.sourceUrl,
    }];
  });
}

function deriveFreeCashFlow(operating: FinancialPoint[], capex: FinancialPoint[]): FinancialPoint[] {
  const capexByPeriod = new Map(capex.map((point) => [`${point.periodStart}:${point.periodEnd}:${point.periodKind}`, point]));
  return operating.flatMap((cashFlow) => {
    const investment = capexByPeriod.get(`${cashFlow.periodStart}:${cashFlow.periodEnd}:${cashFlow.periodKind}`);
    if (!investment) return [];
    return [{
      ...cashFlow,
      metric: 'free_cash_flow' as const,
      value: cashFlow.value - Math.abs(investment.value),
      accessionNumber: cashFlow.accessionNumber === investment.accessionNumber
        ? cashFlow.accessionNumber
        : `${cashFlow.accessionNumber}+${investment.accessionNumber}`,
      tag: `${cashFlow.tag}-${investment.tag}`,
      derived: true,
    }];
  });
}

async function getSecIdentity(ticker: string): Promise<{ cik: string; name: string | null } | null> {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) return null;
  if (!tickerMapCache || tickerMapCache.expires < Date.now()) {
    const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(SEC_TIMEOUT_MS),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error(`SEC ticker mapping vastas ${response.status}.`);
    tickerMapCache = { expires: Date.now() + 86_400_000, rows: Object.values(await response.json()) };
  }
  const row = tickerMapCache.rows.find((candidate) => String(candidate.ticker).toUpperCase() === ticker);
  return row ? { cik: String(row.cik_str).padStart(10, '0'), name: row.title || null } : null;
}

async function fetchCompanyFacts(ticker: string): Promise<{ identity: { cik: string; name: string | null }; facts: SecCompanyFacts } | null> {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) return null;
  const identity = await getSecIdentity(ticker);
  if (!identity) return null;
  const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${identity.cik}.json`, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(SEC_TIMEOUT_MS),
    // CompanyFactsi vastus võib ületada Next.js 2 MB fetch-cache piiri.
    // Püsiv cache ja retry-ajalugu on meil PostgreSQL-is, seega ära dubleeri seda siin.
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`SEC CompanyFacts vastas ${response.status}.`);
  return { identity, facts: await response.json() };
}

async function saveFacts(ticker: string, identity: { cik: string; name: string | null }, points: FinancialPoint[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyResult = await client.query(
      `INSERT INTO companies (ticker, name, source, sec_cik)
       VALUES ($1, $2, 'sec-companyfacts', $3)
       ON CONFLICT (ticker) DO UPDATE SET
         name = COALESCE(companies.name, EXCLUDED.name),
         sec_cik = EXCLUDED.sec_cik,
         updated_at = now()
       RETURNING id`,
      [ticker, identity.name, identity.cik],
    );
    const companyId = Number(companyResult.rows[0].id);
    for (const point of points) {
      await client.query(
        `INSERT INTO financial_facts
           (company_id, metric, value, unit, period_start, period_end, period_kind,
            fiscal_year, fiscal_period, form_type, filed_at, accession_number,
            taxonomy, tag, is_derived, source_url, fact_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (company_id, fact_key) DO UPDATE SET
           value = EXCLUDED.value,
           filed_at = EXCLUDED.filed_at,
           source_url = EXCLUDED.source_url,
           updated_at = now()`,
        [
          companyId, point.metric, point.value, point.unit, point.periodStart,
          point.periodEnd, point.periodKind, point.fiscalYear, point.fiscalPeriod,
          point.form, point.filedAt, point.accessionNumber, point.taxonomy,
          point.tag, point.derived, point.sourceUrl, factKey(point),
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function comparable(previous: FinancialPoint[], latest: FinancialPoint): FinancialPoint | null {
  const latestEnd = new Date(`${latest.periodEnd}T00:00:00Z`).getTime();
  const latestDuration = latest.periodStart ? durationDays(latest.periodStart, latest.periodEnd) : 0;
  return previous
    .filter((point) => point.periodKind === latest.periodKind)
    .map((point) => ({
      point,
      dayGap: Math.abs((latestEnd - new Date(`${point.periodEnd}T00:00:00Z`).getTime()) / 86_400_000 - 365),
      durationGap: latest.periodStart && point.periodStart
        ? Math.abs(durationDays(point.periodStart, point.periodEnd) - latestDuration)
        : 0,
    }))
    .filter(({ dayGap, durationGap }) => dayGap <= 70 && durationGap <= 20)
    .sort((a, b) => (a.dayGap + a.durationGap) - (b.dayGap + b.durationGap))[0]?.point || null;
}

function preferredLatest(metric: FinancialMetric, points: FinancialPoint[]): FinancialPoint | null {
  const sorted = [...points].sort((a, b) => `${b.periodEnd}:${b.filedAt}`.localeCompare(`${a.periodEnd}:${a.filedAt}`));
  if (metric === 'revenue' || metric === 'net_income') {
    return sorted.find((point) => point.periodKind === 'quarter')
      || sorted.find((point) => point.periodKind === 'annual')
      || sorted[0]
      || null;
  }
  return sorted[0] || null;
}

function summarize(ticker: string, cik: string, companyName: string | null, rows: any[]): CompanyFinancialSummary {
  const points: FinancialPoint[] = rows.map((row) => ({
    id: Number(row.id),
    metric: row.metric,
    value: Number(row.value),
    unit: row.unit,
    periodStart: row.period_start || null,
    periodEnd: row.period_end,
    periodKind: row.period_kind,
    fiscalYear: row.fiscal_year == null ? null : Number(row.fiscal_year),
    fiscalPeriod: row.fiscal_period || null,
    form: row.form_type,
    filedAt: row.filed_at,
    accessionNumber: row.accession_number,
    taxonomy: row.taxonomy,
    tag: row.tag,
    derived: Boolean(row.is_derived),
    sourceUrl: row.source_url,
  }));
  const metrics: CompanyFinancialSummary['metrics'] = {};
  for (const metric of [...new Set(points.map((point) => point.metric))]) {
    const metricPoints = points.filter((point) => point.metric === metric);
    const latest = preferredLatest(metric, metricPoints);
    if (!latest) continue;
    const previousComparable = comparable(metricPoints.filter((point) => point !== latest), latest);
    metrics[metric] = {
      latest,
      previousComparable,
      yearOverYearPercent: previousComparable && previousComparable.value !== 0
        ? ((latest.value - previousComparable.value) / Math.abs(previousComparable.value)) * 100
        : null,
    };
  }
  const refreshedAt = rows.map((row) => row.updated_at).filter(Boolean).sort().at(-1) || null;
  return { ticker, cik, companyName, refreshedAt, metrics };
}

async function readStored(ticker: string): Promise<CompanyFinancialSummary | null> {
  await ensureFinancialSchema();
  const companyResult = await pool.query('SELECT id, name, sec_cik FROM companies WHERE ticker = $1', [ticker]);
  if (!companyResult.rowCount) return null;
  const company = companyResult.rows[0];
  const result = await pool.query(
    `SELECT id, metric, value, unit, to_char(period_start, 'YYYY-MM-DD') AS period_start,
            to_char(period_end, 'YYYY-MM-DD') AS period_end, period_kind, fiscal_year,
            fiscal_period, form_type, to_char(filed_at, 'YYYY-MM-DD') AS filed_at,
            accession_number, taxonomy, tag, is_derived, source_url, updated_at
     FROM financial_facts WHERE company_id = $1
     ORDER BY period_end DESC, filed_at DESC`,
    [company.id],
  );
  if (!result.rowCount) return null;
  return summarize(ticker, company.sec_cik || '', company.name || null, result.rows);
}

export async function getAllStoredCompanyFinancials(): Promise<CompanyFinancialSummary[]> {
  await ensureFinancialSchema();
  const result = await pool.query(
    `SELECT c.id AS company_id, c.ticker, c.name, c.sec_cik,
            f.id, f.metric, f.value, f.unit,
            to_char(f.period_start, 'YYYY-MM-DD') AS period_start,
            to_char(f.period_end, 'YYYY-MM-DD') AS period_end,
            f.period_kind, f.fiscal_year, f.fiscal_period, f.form_type,
            to_char(f.filed_at, 'YYYY-MM-DD') AS filed_at,
            f.accession_number, f.taxonomy, f.tag, f.is_derived,
            f.source_url, f.updated_at
     FROM companies c
     JOIN financial_facts f ON f.company_id = c.id
     ORDER BY c.id, f.period_end DESC, f.filed_at DESC`,
  );
  const grouped = new Map<number, any[]>();
  for (const row of result.rows) {
    const companyId = Number(row.company_id);
    const rows = grouped.get(companyId) || [];
    rows.push(row);
    grouped.set(companyId, rows);
  }
  return [...grouped.values()].map((rows) => summarize(
    rows[0].ticker,
    rows[0].sec_cik || '',
    rows[0].name || null,
    rows,
  ));
}

async function financialUniverseCoverage(): Promise<{ universe: number; covered: number }> {
  const result = await pool.query(
    `SELECT count(*)::int AS universe,
            count(*) FILTER (
              WHERE EXISTS (SELECT 1 FROM financial_facts f WHERE f.company_id = c.id)
            )::int AS covered
     FROM companies c
     WHERE c.ticker <> 'SPY'
       AND c.quote_type IS DISTINCT FROM 'ETF'
       AND EXISTS (
         SELECT 1 FROM price_snapshots p
         WHERE p.company_id = c.id AND p.captured_at >= now() - interval '30 days'
       )`,
  );
  return {
    universe: Number(result.rows[0]?.universe || 0),
    covered: Number(result.rows[0]?.covered || 0),
  };
}

async function financialEnrichmentQueue(limit: number): Promise<Array<{ companyId: number; ticker: string }>> {
  const result = await pool.query(
    `SELECT c.id AS company_id, c.ticker
     FROM companies c
     JOIN LATERAL (
       SELECT max(p.captured_at) AS latest_price_at
       FROM price_snapshots p WHERE p.company_id = c.id
     ) prices ON true
     LEFT JOIN LATERAL (
       SELECT max(f.updated_at) AS facts_updated_at
       FROM financial_facts f WHERE f.company_id = c.id
     ) facts ON true
     LEFT JOIN financial_enrichment_status enrichment ON enrichment.company_id = c.id
     WHERE c.ticker <> 'SPY'
       AND c.quote_type IS DISTINCT FROM 'ETF'
       AND prices.latest_price_at >= now() - interval '30 days'
       AND (
         (
           facts.facts_updated_at IS NULL
           AND (
             enrichment.last_attempt_at IS NULL
             OR (enrichment.status = 'error' AND enrichment.last_attempt_at < now() - interval '1 day')
             OR (enrichment.status = 'unavailable' AND enrichment.last_attempt_at < now() - interval '30 days')
           )
         )
         OR (
           facts.facts_updated_at < now() - interval '7 days'
           AND (enrichment.last_attempt_at IS NULL OR enrichment.last_attempt_at < now() - interval '1 day')
         )
       )
     ORDER BY (facts.facts_updated_at IS NULL) DESC,
              (enrichment.last_attempt_at IS NULL) DESC,
              enrichment.last_attempt_at ASC NULLS FIRST,
              prices.latest_price_at DESC,
              c.ticker
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({ companyId: Number(row.company_id), ticker: String(row.ticker) }));
}

async function enrichmentAttemptsToday(): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS attempts
     FROM financial_enrichment_status
     WHERE last_attempt_at >= (
       date_trunc('day', now() AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'Europe/Tallinn'
     )`,
  );
  return Number(result.rows[0]?.attempts || 0);
}

function truncateEnrichmentError(error: string | null, limit = 500): string | null {
  if (!error) return null;
  return [...error].slice(0, limit).join('');
}

async function saveEnrichmentAttempt(
  companyId: number,
  status: 'success' | 'unavailable' | 'error',
  error: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO financial_enrichment_status
       (company_id, status, last_attempt_at, last_success_at, consecutive_failures, last_error)
     VALUES ($1, $2, now(), CASE WHEN $2 = 'success' THEN now() ELSE NULL END,
             CASE WHEN $2 = 'error' THEN 1 ELSE 0 END, $3)
     ON CONFLICT (company_id) DO UPDATE SET
       status = EXCLUDED.status,
       last_attempt_at = now(),
       last_success_at = CASE
         WHEN EXCLUDED.status = 'success' THEN now()
         ELSE financial_enrichment_status.last_success_at
       END,
       consecutive_failures = CASE
         WHEN EXCLUDED.status = 'error' THEN financial_enrichment_status.consecutive_failures + 1
         ELSE 0
       END,
       last_error = EXCLUDED.last_error,
       updated_at = now()`,
    [companyId, status, truncateEnrichmentError(error)],
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function enrichStoredCompanyFinancials(
  limit = DAILY_FINANCIAL_ENRICHMENT_LIMIT,
): Promise<FinancialEnrichmentResult> {
  await ensureFinancialSchema();
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit) || DAILY_FINANCIAL_ENRICHMENT_LIMIT));
  const before = await financialUniverseCoverage();
  if (!process.env.SEC_USER_AGENT) {
    return {
      status: 'disabled',
      financialUniverse: before.universe,
      coveredBefore: before.covered,
      coveredAfter: before.covered,
      attempted: 0,
      enriched: 0,
      unavailable: 0,
      failed: 0,
      dailyLimit: safeLimit,
      attemptedTodayBefore: 0,
      dailyRemaining: safeLimit,
      attemptedTickers: [],
      unavailableTickers: [],
      failedTickers: [],
    };
  }

  const attemptedTodayBefore = await enrichmentAttemptsToday();
  const availableToday = Math.max(0, safeLimit - attemptedTodayBefore);
  const queue = availableToday > 0 ? await financialEnrichmentQueue(availableToday) : [];
  const attemptedTickers: string[] = [];
  const unavailableTickers: string[] = [];
  const failedTickers: string[] = [];
  let enriched = 0;

  for (const [index, item] of queue.entries()) {
    attemptedTickers.push(item.ticker);
    try {
      const summary = await refreshCompanyFinancials(item.ticker);
      if (summary) {
        enriched += 1;
        await saveEnrichmentAttempt(item.companyId, 'success', null);
      } else {
        unavailableTickers.push(item.ticker);
        await saveEnrichmentAttempt(item.companyId, 'unavailable', 'SEC CompanyFacts ei andnud skooritavat finantsajalugu.');
      }
    } catch (error) {
      failedTickers.push(item.ticker);
      const message = (error as Error).message || 'Tundmatu SEC enrichment viga.';
      console.error(`Ettevõtte ${item.ticker} päevane SEC enrichment ebaõnnestus:`, message);
      await saveEnrichmentAttempt(item.companyId, 'error', message).catch((statusError) => {
        console.error(`Ettevõtte ${item.ticker} enrichment staatuse salvestamine ebaõnnestus:`, statusError);
      });
    }
    if (index < queue.length - 1) await wait(ENRICHMENT_DELAY_MS);
  }

  const after = await financialUniverseCoverage();
  return {
    status: 'completed',
    financialUniverse: after.universe,
    coveredBefore: before.covered,
    coveredAfter: after.covered,
    attempted: attemptedTickers.length,
    enriched,
    unavailable: unavailableTickers.length,
    failed: failedTickers.length,
    dailyLimit: safeLimit,
    attemptedTodayBefore,
    dailyRemaining: Math.max(0, safeLimit - attemptedTodayBefore - attemptedTickers.length),
    attemptedTickers,
    unavailableTickers,
    failedTickers,
  };
}

async function refreshCompanyFinancialsUncached(rawTicker: string): Promise<CompanyFinancialSummary | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return null;
  await ensureFinancialSchema();
  const response = await fetchCompanyFacts(ticker);
  if (!response) return null;
  const extracted = DEFINITIONS.flatMap((definition) => extractMetricPoints(response.facts, response.identity.cik, definition));
  const operating = extracted.filter((point) => point.metric === 'operating_cash_flow');
  const capex = extracted.filter((point) => point.metric === 'capital_expenditure');
  const points = [...extracted, ...deriveDebt(response.facts, response.identity.cik), ...deriveFreeCashFlow(operating, capex)];
  await saveFacts(ticker, response.identity, points);
  return readStored(ticker);
}

export function refreshCompanyFinancials(rawTicker: string): Promise<CompanyFinancialSummary | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return Promise.resolve(null);
  const running = financialRefreshes.get(ticker);
  if (running) return running;
  const promise = refreshCompanyFinancialsUncached(ticker).finally(() => financialRefreshes.delete(ticker));
  financialRefreshes.set(ticker, promise);
  return promise;
}

export async function getCompanyFinancials(rawTicker: string): Promise<CompanyFinancialSummary | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return null;
  const cached = financialCache.get(ticker);
  if (cached && cached.expires > Date.now()) return cached.value;

  const stored = await readStored(ticker).catch((error) => {
    console.error(`Ettevõtte ${ticker} SEC finantsfaktide lugemine ebaõnnestus:`, error);
    return null;
  });
  if (stored) {
    financialCache.set(ticker, { expires: Date.now() + CACHE_MS, value: stored });
    if (!stored.refreshedAt || Date.now() - new Date(stored.refreshedAt).getTime() >= CACHE_MS) {
      void refreshCompanyFinancials(ticker).then((value) => {
        financialCache.set(ticker, { expires: Date.now() + CACHE_MS, value });
      }).catch((error) => console.error(`Ettevõtte ${ticker} SEC CompanyFactsi taustavärskendus ebaõnnestus:`, error));
    }
    return stored;
  }

  try {
    const fresh = await refreshCompanyFinancials(ticker);
    financialCache.set(ticker, { expires: Date.now() + CACHE_MS, value: fresh });
    return fresh;
  } catch (error) {
    console.error(`Ettevõtte ${ticker} SEC CompanyFactsi päring ebaõnnestus:`, error);
    return null;
  }
}

// Detailvaate kiire tee: ainult DB-lugemine, SEC võrgupäring toimub taustal.
// Nii ei jää põhilehe avanemine CompanyFactsi vastust ootama.
export async function getCompanyFinancialsDbFirst(rawTicker: string): Promise<CompanyFinancialSummary | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return null;
  const cached = financialCache.get(ticker);
  if (cached && cached.expires > Date.now()) return cached.value;

  const stored = await readStored(ticker).catch((error) => {
    console.error(`Ettevõtte ${ticker} SEC finantsfaktide DB-lugemine ebaõnnestus:`, error);
    return null;
  });
  if (stored) financialCache.set(ticker, { expires: Date.now() + CACHE_MS, value: stored });
  else financialCache.delete(ticker);
  const stale = !stored?.refreshedAt || Date.now() - new Date(stored.refreshedAt).getTime() >= CACHE_MS;
  if (stale) {
    void refreshCompanyFinancials(ticker).then((value) => {
      financialCache.set(ticker, { expires: Date.now() + CACHE_MS, value });
    }).catch((error) => console.error(`Ettevõtte ${ticker} SEC CompanyFactsi taustavärskendus ebaõnnestus:`, error));
  }
  return stored;
}
