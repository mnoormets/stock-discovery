import { pool } from '../../src/lib/db';

// Enrichment-fixture'id. Kõik ajapiirid (`1 day`, `7 days`, `30 days`, Tallinna
// päeva algus) on PostgreSQL-i poolel `now()` suhtes — erinevalt A- ja C-blokist
// EI ole `enrichStoredCompanyFinancials`-il injekteeritavat kella. Seetõttu
// kontrollitakse aega fixture'i ajatemplite kaudu, SQL-avaldistega, mitte
// JS `Date`-iga: nii ei saa JS-i ja DB kella vahe tulemust muuta.
//
// Ajaabid on TEADLIKULT kinnise hulgaga: fixture API ei võta vastu vaba
// SQL-fragmenti. Ainult allpool defineeritud võtmed on lubatud.

export interface TimeExpression {
  readonly sql: string;
}

const AGO_SQL = {
  '2 hours': `now() - interval '2 hours'`,
  '25 hours': `now() - interval '25 hours'`,
  '2 days': `now() - interval '2 days'`,
  '3 days': `now() - interval '3 days'`,
  '8 days': `now() - interval '8 days'`,
  '29 days': `now() - interval '29 days'`,
  '31 days': `now() - interval '31 days'`,
  '40 days': `now() - interval '40 days'`,
} as const;

const TALLINN_DAY_START = `(date_trunc('day', now() AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'Europe/Tallinn')`;

const TALLINN_SQL = {
  // Vahetult ENNE tänast Tallinna päeva algust ehk eile.
  '-1 hour': `${TALLINN_DAY_START} - interval '1 hour'`,
  // Vahetult PÄRAST tänase Tallinna päeva algust ehk täna.
  '+1 minute': `${TALLINN_DAY_START} + interval '1 minute'`,
} as const;

export function ago(key: keyof typeof AGO_SQL): TimeExpression {
  return { sql: AGO_SQL[key] };
}

export function tallinnDayStart(key: keyof typeof TALLINN_SQL): TimeExpression {
  return { sql: TALLINN_SQL[key] };
}

export interface EnrichmentStatusOptions {
  status: 'success' | 'unavailable' | 'error';
  lastAttempt: TimeExpression;
  lastSuccess?: TimeExpression | null;
  consecutiveFailures?: number;
  lastError?: string | null;
}

export async function insertEnrichmentStatus(
  companyId: number,
  options: EnrichmentStatusOptions,
): Promise<void> {
  const lastSuccess = options.lastSuccess ? options.lastSuccess.sql : 'NULL';
  await pool.query(
    `INSERT INTO financial_enrichment_status
       (company_id, status, last_attempt_at, last_success_at, consecutive_failures, last_error)
     VALUES ($1, $2, ${options.lastAttempt.sql}, ${lastSuccess}, $3, $4)`,
    [companyId, options.status, options.consecutiveFailures ?? 0, options.lastError ?? null],
  );
}

export async function readEnrichmentStatus(companyId: number) {
  const { rows } = await pool.query(
    `SELECT status, last_attempt_at, last_success_at, consecutive_failures, last_error
     FROM financial_enrichment_status WHERE company_id = $1`,
    [companyId],
  );
  return rows[0] ?? null;
}

let nextFactKey = 1;

export function resetFactKeys(): void {
  nextFactKey = 1;
}

export interface FinancialFactOptions {
  // Juhib `facts.facts_updated_at` väärtust, mille järgi 7-päevane
  // stale-facts haru otsustab (company-financials.ts:570).
  updatedAt: TimeExpression;
  metric?: string;
  value?: number;
  periodEnd?: string;
}

export async function insertFinancialFact(
  companyId: number,
  options: FinancialFactOptions,
): Promise<void> {
  const key = `test-fact-${nextFactKey++}`;
  await pool.query(
    `INSERT INTO financial_facts
       (company_id, metric, value, unit, period_start, period_end, period_kind,
        fiscal_year, fiscal_period, form_type, filed_at, accession_number,
        taxonomy, tag, is_derived, source_url, fact_key, created_at, updated_at)
     VALUES ($1, $2, $3, 'USD', '2025-01-01', $4, 'annual', 2025, 'FY', '10-K',
             '2026-02-01', $5, 'us-gaap', $2, false, 'https://www.sec.gov/test', $6,
             ${options.updatedAt.sql}, ${options.updatedAt.sql})`,
    [
      companyId,
      options.metric ?? 'revenue',
      options.value ?? 1_000,
      options.periodEnd ?? '2025-12-31',
      `0000000000-26-${String(nextFactKey).padStart(6, '0')}`,
      key,
    ],
  );
}
