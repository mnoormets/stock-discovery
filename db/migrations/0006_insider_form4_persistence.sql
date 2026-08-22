-- Durable, role-aware SEC Form 4 persistence.
-- Runner owns the transaction; this file must not contain BEGIN/COMMIT.

CREATE TABLE IF NOT EXISTS insider_filings (
  id BIGSERIAL PRIMARY KEY,
  accession_number TEXT NOT NULL,
  form_type TEXT NOT NULL,
  is_amendment BOOLEAN GENERATED ALWAYS AS (form_type = '4/A') STORED,

  issuer_cik TEXT NOT NULL,
  issuer_ticker TEXT,
  issuer_name TEXT NOT NULL,
  filed_date DATE NOT NULL,
  accepted_at TIMESTAMPTZ,
  period_of_report DATE,
  date_of_original_submission DATE,

  sec_submission_url TEXT NOT NULL,
  sec_primary_document_url TEXT,
  schema_version TEXT,
  parser_version TEXT,
  ownership_xml_sha256 TEXT,

  amends_filing_id BIGINT REFERENCES insider_filings(id) ON DELETE RESTRICT,
  amendment_link_status TEXT NOT NULL DEFAULT 'not_applicable',
  amendment_link_method TEXT,

  ingestion_status TEXT NOT NULL DEFAULT 'discovered',
  ingestion_attempt_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempted_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT insider_filings_accession_key UNIQUE (accession_number),
  CONSTRAINT insider_filings_accession_format CHECK (
    accession_number ~ '^[0-9]{10}-[0-9]{2}-[0-9]{6}$'
  ),
  CONSTRAINT insider_filings_form_type_check CHECK (form_type IN ('4', '4/A')),
  CONSTRAINT insider_filings_issuer_cik_format CHECK (issuer_cik ~ '^[0-9]+$'),
  CONSTRAINT insider_filings_identity_nonempty CHECK (
    btrim(issuer_name) <> ''
    AND (issuer_ticker IS NULL OR btrim(issuer_ticker) <> '')
  ),
  CONSTRAINT insider_filings_urls_nonempty CHECK (
    btrim(sec_submission_url) <> ''
    AND (sec_primary_document_url IS NULL OR btrim(sec_primary_document_url) <> '')
  ),
  CONSTRAINT insider_filings_hash_format CHECK (
    ownership_xml_sha256 IS NULL OR ownership_xml_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT insider_filings_ingestion_status_check CHECK (
    ingestion_status IN ('discovered', 'fetch_failed', 'parse_failed', 'persist_failed', 'persisted')
  ),
  CONSTRAINT insider_filings_attempts_check CHECK (ingestion_attempt_count >= 0),
  CONSTRAINT insider_filings_persisted_fields_check CHECK (
    ingestion_status <> 'persisted'
    OR (
      parser_version IS NOT NULL
      AND btrim(parser_version) <> ''
      AND ownership_xml_sha256 IS NOT NULL
      AND ingested_at IS NOT NULL
      AND last_error IS NULL
    )
  ),
  CONSTRAINT insider_filings_amendment_link_check CHECK (
    (
      form_type = '4'
      AND amendment_link_status = 'not_applicable'
      AND amends_filing_id IS NULL
      AND amendment_link_method IS NULL
    )
    OR
    (
      form_type = '4/A'
      AND amendment_link_status IN ('unresolved', 'ambiguous', 'resolved')
      AND (
        (
          amendment_link_status = 'resolved'
          AND amends_filing_id IS NOT NULL
          AND amendment_link_method IS NOT NULL
          AND btrim(amendment_link_method) <> ''
        )
        OR
        (amendment_link_status <> 'resolved' AND amends_filing_id IS NULL)
      )
    )
  ),
  CONSTRAINT insider_filings_not_self_amending
    CHECK (amends_filing_id IS NULL OR amends_filing_id <> id),
  CONSTRAINT insider_filings_error_length
    CHECK (last_error IS NULL OR length(last_error) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_insider_filings_filed_date
  ON insider_filings (filed_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_insider_filings_issuer
  ON insider_filings (issuer_cik, filed_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_insider_filings_ticker
  ON insider_filings (issuer_ticker, filed_date DESC, id DESC)
  WHERE issuer_ticker IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insider_filings_retry
  ON insider_filings (retry_after, filed_date, id)
  WHERE ingestion_status IN ('fetch_failed', 'parse_failed', 'persist_failed');
CREATE INDEX IF NOT EXISTS idx_insider_filings_amends
  ON insider_filings (amends_filing_id)
  WHERE amends_filing_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS insider_reporting_owners (
  id BIGSERIAL PRIMARY KEY,
  filing_id BIGINT NOT NULL REFERENCES insider_filings(id) ON DELETE CASCADE,
  owner_row_key TEXT NOT NULL,
  owner_cik TEXT,
  owner_name TEXT,
  is_director BOOLEAN NOT NULL,
  is_officer BOOLEAN NOT NULL,
  is_ten_percent_owner BOOLEAN NOT NULL,
  is_other BOOLEAN NOT NULL,
  has_no_declared_role BOOLEAN GENERATED ALWAYS AS (
    NOT is_director AND NOT is_officer AND NOT is_ten_percent_owner AND NOT is_other
  ) STORED,
  officer_title TEXT,
  other_text TEXT,

  CONSTRAINT insider_reporting_owners_row_key UNIQUE (filing_id, owner_row_key),
  CONSTRAINT insider_reporting_owners_row_key_nonempty CHECK (btrim(owner_row_key) <> ''),
  CONSTRAINT insider_reporting_owners_cik_format CHECK (
    owner_cik IS NULL OR owner_cik ~ '^[0-9]+$'
  ),
  CONSTRAINT insider_reporting_owners_identity_check CHECK (
    owner_cik IS NOT NULL OR (owner_name IS NOT NULL AND btrim(owner_name) <> '')
  ),
  CONSTRAINT insider_reporting_owners_text_check CHECK (
    (officer_title IS NULL OR btrim(officer_title) <> '')
    AND (other_text IS NULL OR btrim(other_text) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_insider_reporting_owners_cik
  ON insider_reporting_owners (owner_cik, filing_id)
  WHERE owner_cik IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insider_reporting_owners_roles
  ON insider_reporting_owners (
    is_director, is_officer, is_ten_percent_owner, is_other, filing_id
  );

CREATE TABLE IF NOT EXISTS insider_transactions (
  id BIGSERIAL PRIMARY KEY,
  filing_id BIGINT NOT NULL REFERENCES insider_filings(id) ON DELETE CASCADE,
  transaction_row_key TEXT NOT NULL,
  security_kind TEXT NOT NULL,
  transaction_date DATE,
  deemed_execution_date DATE,
  security_title TEXT,
  transaction_form_type TEXT,
  transaction_code TEXT,
  acquired_disposed_code TEXT,
  transaction_timeliness TEXT,
  equity_swap_involved BOOLEAN,
  rule_10b5_1 BOOLEAN,
  transaction_shares NUMERIC,
  transaction_price_per_share NUMERIC,
  post_transaction_shares NUMERIC,
  direct_or_indirect_ownership TEXT,
  nature_of_ownership TEXT,
  conversion_or_exercise_price NUMERIC,
  exercise_date DATE,
  expiration_date DATE,
  underlying_security_title TEXT,
  underlying_security_shares NUMERIC,

  derived_notional NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN security_kind = 'non_derivative'
       AND transaction_shares IS NOT NULL
       AND transaction_price_per_share IS NOT NULL
      THEN transaction_shares * transaction_price_per_share
      ELSE NULL
    END
  ) STORED,
  derived_notional_method TEXT GENERATED ALWAYS AS (
    CASE
      WHEN security_kind = 'non_derivative'
       AND transaction_shares IS NOT NULL
       AND transaction_price_per_share IS NOT NULL
      THEN 'transaction_shares_x_transaction_price_per_share'
      ELSE NULL
    END
  ) STORED,

  -- Required on every transaction so 10% owners cannot collapse into a generic label.
  reporting_owner_count INTEGER NOT NULL,
  filing_has_director_owner BOOLEAN NOT NULL,
  filing_has_officer_owner BOOLEAN NOT NULL,
  filing_has_ten_percent_owner BOOLEAN NOT NULL,
  filing_has_other_owner BOOLEAN NOT NULL,
  filing_has_owner_without_declared_role BOOLEAN NOT NULL,

  CONSTRAINT insider_transactions_row_key UNIQUE (filing_id, transaction_row_key),
  CONSTRAINT insider_transactions_row_key_nonempty CHECK (btrim(transaction_row_key) <> ''),
  CONSTRAINT insider_transactions_security_kind_check
    CHECK (security_kind IN ('non_derivative', 'derivative')),
  CONSTRAINT insider_transactions_code_check
    CHECK (transaction_code IS NULL OR btrim(transaction_code) <> ''),
  CONSTRAINT insider_transactions_acquired_disposed_check CHECK (
    acquired_disposed_code IS NULL OR acquired_disposed_code IN ('A', 'D')
  ),
  CONSTRAINT insider_transactions_numeric_check CHECK (
    (transaction_shares IS NULL OR transaction_shares >= 0)
    AND (transaction_price_per_share IS NULL OR transaction_price_per_share >= 0)
    AND (post_transaction_shares IS NULL OR post_transaction_shares >= 0)
    AND (underlying_security_shares IS NULL OR underlying_security_shares >= 0)
  ),
  CONSTRAINT insider_transactions_owner_context_check CHECK (
    reporting_owner_count > 0
    AND (
      filing_has_director_owner
      OR filing_has_officer_owner
      OR filing_has_ten_percent_owner
      OR filing_has_other_owner
      OR filing_has_owner_without_declared_role
    )
  )
);

COMMENT ON COLUMN insider_transactions.derived_notional IS
  'Derived as non-derivative transaction shares multiplied by price per share; not reported directly by the SEC filer.';
COMMENT ON COLUMN insider_transactions.rule_10b5_1 IS
  'SEC transaction-level aff10b5One value. NULL means absent or unknown, not false.';
COMMENT ON COLUMN insider_transactions.filing_has_ten_percent_owner IS
  'True when at least one reporting owner on the filing is explicitly a 10% owner; never a generic insider label.';

CREATE INDEX IF NOT EXISTS idx_insider_transactions_purchase
  ON insider_transactions (transaction_date DESC, filing_id, derived_notional DESC)
  WHERE security_kind = 'non_derivative'
    AND transaction_code = 'P'
    AND acquired_disposed_code = 'A';
CREATE INDEX IF NOT EXISTS idx_insider_transactions_roles
  ON insider_transactions (
    filing_has_director_owner,
    filing_has_officer_owner,
    filing_has_ten_percent_owner,
    transaction_date DESC
  );

-- Cross-table guard: the mandatory transaction summary must exactly match the
-- normalized reporting owners already inserted for the filing.
CREATE OR REPLACE FUNCTION validate_insider_transaction_owner_roles()
RETURNS TRIGGER AS $$
DECLARE
  expected_count BIGINT;
  expected_director BOOLEAN;
  expected_officer BOOLEAN;
  expected_ten_percent BOOLEAN;
  expected_other BOOLEAN;
  expected_no_role BOOLEAN;
BEGIN
  SELECT
    count(*),
    coalesce(bool_or(is_director), false),
    coalesce(bool_or(is_officer), false),
    coalesce(bool_or(is_ten_percent_owner), false),
    coalesce(bool_or(is_other), false),
    coalesce(bool_or(has_no_declared_role), false)
  INTO
    expected_count,
    expected_director,
    expected_officer,
    expected_ten_percent,
    expected_other,
    expected_no_role
  FROM insider_reporting_owners
  WHERE filing_id = NEW.filing_id;

  IF expected_count = 0
     OR NEW.reporting_owner_count IS DISTINCT FROM expected_count
     OR NEW.filing_has_director_owner IS DISTINCT FROM expected_director
     OR NEW.filing_has_officer_owner IS DISTINCT FROM expected_officer
     OR NEW.filing_has_ten_percent_owner IS DISTINCT FROM expected_ten_percent
     OR NEW.filing_has_other_owner IS DISTINCT FROM expected_other
     OR NEW.filing_has_owner_without_declared_role IS DISTINCT FROM expected_no_role
  THEN
    RAISE EXCEPTION 'insider transaction owner-role context does not match normalized filing owners'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insider_transactions_validate_owner_roles
BEFORE INSERT OR UPDATE OF
  filing_id,
  reporting_owner_count,
  filing_has_director_owner,
  filing_has_officer_owner,
  filing_has_ten_percent_owner,
  filing_has_other_owner,
  filing_has_owner_without_declared_role
ON insider_transactions
FOR EACH ROW EXECUTE FUNCTION validate_insider_transaction_owner_roles();

-- Once transactions exist, changing the normalized owner set could make their
-- enforced role context stale. Successful filings are immutable in this phase.
CREATE OR REPLACE FUNCTION guard_insider_owner_role_mutation()
RETURNS TRIGGER AS $$
DECLARE
  target_filing_id BIGINT;
BEGIN
  target_filing_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.filing_id ELSE NEW.filing_id END;
  IF EXISTS (SELECT 1 FROM insider_transactions WHERE filing_id = target_filing_id) THEN
    RAISE EXCEPTION 'reporting owners are immutable after filing transactions exist'
      USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insider_reporting_owners_guard_mutation
BEFORE INSERT OR UPDATE OR DELETE ON insider_reporting_owners
FOR EACH ROW EXECUTE FUNCTION guard_insider_owner_role_mutation();

CREATE TABLE IF NOT EXISTS insider_transaction_footnotes (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES insider_transactions(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  footnote_id TEXT NOT NULL,
  footnote_text TEXT,

  CONSTRAINT insider_transaction_footnotes_key
    UNIQUE (transaction_id, field_name, footnote_id),
  CONSTRAINT insider_transaction_footnotes_nonempty CHECK (
    btrim(field_name) <> ''
    AND btrim(footnote_id) <> ''
    AND (footnote_text IS NULL OR btrim(footnote_text) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_insider_transaction_footnotes_transaction
  ON insider_transaction_footnotes (transaction_id, field_name);

-- Canonical future evidence surface. Its grain is one transaction/reporting-owner pair.
CREATE OR REPLACE VIEW insider_transaction_owner_evidence AS
SELECT
  transaction.id AS transaction_id,
  transaction.transaction_row_key,
  transaction.security_kind,
  transaction.transaction_date,
  transaction.security_title,
  transaction.transaction_code,
  transaction.acquired_disposed_code,
  transaction.transaction_shares,
  transaction.transaction_price_per_share,
  transaction.derived_notional,
  transaction.derived_notional_method,
  transaction.rule_10b5_1,
  filing.id AS filing_id,
  filing.accession_number,
  filing.form_type,
  filing.is_amendment,
  filing.amends_filing_id,
  filing.issuer_cik,
  filing.issuer_ticker,
  filing.issuer_name,
  filing.filed_date,
  filing.period_of_report,
  filing.sec_submission_url,
  filing.sec_primary_document_url,
  filing.parser_version,
  filing.ownership_xml_sha256,
  owner.id AS reporting_owner_id,
  owner.owner_cik,
  owner.owner_name,
  owner.is_director,
  owner.is_officer,
  owner.is_ten_percent_owner,
  owner.is_other,
  owner.has_no_declared_role,
  owner.officer_title,
  owner.other_text
FROM insider_transactions AS transaction
JOIN insider_filings AS filing ON filing.id = transaction.filing_id
JOIN insider_reporting_owners AS owner ON owner.filing_id = filing.id;
