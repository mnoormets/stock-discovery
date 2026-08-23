import { pool } from './db';
import { toDateOnly } from './date-only';

export const INSIDER_SELECTION_POLICY_VERSION = 'form4-insider-selection-v1';
export const INSIDER_LOOKUP_LIMIT = 20;
export const INSIDER_NOTIONAL_THRESHOLD = 50_000;
export const INSIDER_SOURCE_MAX_AGE_DAYS = 5;

export interface NotableInsiderTransaction {
  transactionId: string;
  accessionNumber: string;
  transactionDate: string | null;
  securityTitle: string | null;
  derivedNotional: number;
  rule10b51: boolean | null;
}

export interface NotableInsiderIssuer {
  ticker: string;
  issuerCik: string;
  issuerName: string;
  insiderRank: number;
  maxDerivedNotional: number;
  totalDerivedNotional: number;
  hasDirector: boolean;
  hasOfficer: boolean;
  hasTenPercentOwner: boolean;
  latestAcceptedAt: string | null;
  transactions: NotableInsiderTransaction[];
}

export interface NotableInsiderSelection {
  policyVersion: typeof INSIDER_SELECTION_POLICY_VERSION;
  sourceFiledDate: string | null;
  sourceAgeDays: number | null;
  stale: boolean;
  eligibleIssuerCount: number;
  selectedIssuers: NotableInsiderIssuer[];
}

function calendarAgeDays(captureDate: string, sourceDate: string): number {
  const capture = Date.parse(`${captureDate}T00:00:00.000Z`);
  const source = Date.parse(`${sourceDate}T00:00:00.000Z`);
  return Math.floor((capture - source) / 86_400_000);
}

export async function selectNotableInsiderIssuers(captureDateInput: string): Promise<NotableInsiderSelection> {
  const captureDate = toDateOnly(captureDateInput);
  const sourceResult = await pool.query(
    `SELECT max(filed_date) AS source_filed_date
     FROM insider_filings
     WHERE form_type = '4' AND ingestion_status = 'persisted' AND filed_date <= $1::date`,
    [captureDate],
  );
  const sourceFiledDate = sourceResult.rows[0]?.source_filed_date
    ? toDateOnly(sourceResult.rows[0].source_filed_date)
    : null;
  if (!sourceFiledDate) {
    return {
      policyVersion: INSIDER_SELECTION_POLICY_VERSION,
      sourceFiledDate: null,
      sourceAgeDays: null,
      stale: true,
      eligibleIssuerCount: 0,
      selectedIssuers: [],
    };
  }

  const sourceAgeDays = calendarAgeDays(captureDate, sourceFiledDate);
  const stale = sourceAgeDays > INSIDER_SOURCE_MAX_AGE_DAYS;
  if (stale) {
    return {
      policyVersion: INSIDER_SELECTION_POLICY_VERSION,
      sourceFiledDate,
      sourceAgeDays,
      stale,
      eligibleIssuerCount: 0,
      selectedIssuers: [],
    };
  }

  const { rows } = await pool.query(
    `WITH qualifying AS (
       SELECT f.issuer_cik, upper(f.issuer_ticker) AS ticker, f.issuer_name,
              f.accession_number, f.accepted_at,
              t.id AS transaction_id, t.transaction_date, t.security_title,
              t.derived_notional, t.rule_10b5_1,
              t.filing_has_director_owner, t.filing_has_officer_owner,
              t.filing_has_ten_percent_owner
       FROM insider_filings f
       JOIN insider_transactions t ON t.filing_id = f.id
       WHERE f.filed_date = $1::date
         AND f.form_type = '4'
         AND f.ingestion_status = 'persisted'
         AND f.issuer_ticker IS NOT NULL
         AND btrim(f.issuer_ticker) <> ''
         AND t.security_kind = 'non_derivative'
         AND t.transaction_code = 'P'
         AND t.acquired_disposed_code = 'A'
         AND t.derived_notional > $2
         AND (t.filing_has_director_owner OR t.filing_has_officer_owner)
     ), issuers AS (
       SELECT issuer_cik, ticker, max(issuer_name) AS issuer_name,
              max(derived_notional) AS max_derived_notional,
              sum(derived_notional) AS total_derived_notional,
              bool_or(filing_has_director_owner) AS has_director,
              bool_or(filing_has_officer_owner) AS has_officer,
              bool_or(filing_has_ten_percent_owner) AS has_ten_percent_owner,
              max(accepted_at) AS latest_accepted_at,
              jsonb_agg(jsonb_build_object(
                'transactionId', transaction_id::text,
                'accessionNumber', accession_number,
                'transactionDate', transaction_date,
                'securityTitle', security_title,
                'derivedNotional', derived_notional,
                'rule10b51', rule_10b5_1
              ) ORDER BY derived_notional DESC, transaction_id) AS transactions
       FROM qualifying
       GROUP BY issuer_cik, ticker
     )
     SELECT *, count(*) OVER ()::int AS eligible_issuer_count
     FROM issuers
     ORDER BY max_derived_notional DESC, total_derived_notional DESC,
              latest_accepted_at DESC NULLS LAST, ticker
     LIMIT $3`,
    [sourceFiledDate, INSIDER_NOTIONAL_THRESHOLD, INSIDER_LOOKUP_LIMIT],
  );

  return {
    policyVersion: INSIDER_SELECTION_POLICY_VERSION,
    sourceFiledDate,
    sourceAgeDays,
    stale,
    eligibleIssuerCount: rows[0]?.eligible_issuer_count == null ? 0 : Number(rows[0].eligible_issuer_count),
    selectedIssuers: rows.map((row, index) => ({
      ticker: String(row.ticker),
      issuerCik: String(row.issuer_cik),
      issuerName: String(row.issuer_name),
      insiderRank: index + 1,
      maxDerivedNotional: Number(row.max_derived_notional),
      totalDerivedNotional: Number(row.total_derived_notional),
      hasDirector: Boolean(row.has_director),
      hasOfficer: Boolean(row.has_officer),
      hasTenPercentOwner: Boolean(row.has_ten_percent_owner),
      latestAcceptedAt: row.latest_accepted_at ? new Date(row.latest_accepted_at).toISOString() : null,
      transactions: Array.isArray(row.transactions)
        ? row.transactions.map((transaction: Record<string, unknown>) => ({
          transactionId: String(transaction.transactionId),
          accessionNumber: String(transaction.accessionNumber),
          transactionDate: transaction.transactionDate == null ? null : String(transaction.transactionDate),
          securityTitle: transaction.securityTitle == null ? null : String(transaction.securityTitle),
          derivedNotional: Number(transaction.derivedNotional),
          rule10b51: transaction.rule10b51 == null ? null : Boolean(transaction.rule10b51),
        }))
        : [],
    })),
  };
}
