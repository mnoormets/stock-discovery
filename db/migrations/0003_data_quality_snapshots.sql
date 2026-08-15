-- TOP 10 #4: canonical discovery run'i point-in-time andmekvaliteedi audit.
-- Üks immutable snapshot iga rklb_daily discovery_runs rea kohta.

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  snapshot_version TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  evaluated_count INTEGER NOT NULL,
  included_count INTEGER NOT NULL,
  companies_total INTEGER NOT NULL,
  companies_with_sec_facts INTEGER NOT NULL,
  companies_with_scores INTEGER NOT NULL,
  companies_with_sector INTEGER NOT NULL,
  companies_with_recent_price INTEGER NOT NULL,

  newest_financial_period_end DATE,
  oldest_financial_period_end DATE,
  stale_financials_count INTEGER NOT NULL,
  missing_financials_count INTEGER NOT NULL,
  missing_price_count INTEGER NOT NULL,
  missing_sector_count INTEGER NOT NULL,

  low_coverage_count INTEGER NOT NULL,
  partial_mandate_count INTEGER NOT NULL,
  not_relevant_mandate_count INTEGER NOT NULL,
  negative_fcf_count INTEGER NOT NULL,
  dilution_warning_count INTEGER NOT NULL,

  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,

  CONSTRAINT data_quality_snapshots_run_id_key UNIQUE (run_id),
  CONSTRAINT data_quality_snapshots_version_nonempty
    CHECK (btrim(snapshot_version) <> ''),
  CONSTRAINT data_quality_snapshots_nonnegative_counts CHECK (
    evaluated_count >= 0 AND included_count >= 0 AND companies_total >= 0
    AND companies_with_sec_facts >= 0 AND companies_with_scores >= 0
    AND companies_with_sector >= 0 AND companies_with_recent_price >= 0
    AND stale_financials_count >= 0 AND missing_financials_count >= 0
    AND missing_price_count >= 0 AND missing_sector_count >= 0
    AND low_coverage_count >= 0 AND partial_mandate_count >= 0
    AND not_relevant_mandate_count >= 0 AND negative_fcf_count >= 0
    AND dilution_warning_count >= 0
  ),
  CONSTRAINT data_quality_snapshots_run_count_bounds CHECK (
    included_count <= evaluated_count
    AND low_coverage_count <= evaluated_count
    AND partial_mandate_count <= evaluated_count
    AND not_relevant_mandate_count <= evaluated_count
    AND negative_fcf_count <= evaluated_count
    AND dilution_warning_count <= evaluated_count
  ),
  CONSTRAINT data_quality_snapshots_universe_count_bounds CHECK (
    companies_with_sec_facts <= companies_total
    AND companies_with_scores <= companies_total
    AND companies_with_sector <= companies_total
    AND companies_with_recent_price <= companies_total
    AND stale_financials_count <= companies_total
    AND missing_financials_count <= companies_total
    AND missing_price_count <= companies_total
    AND missing_sector_count <= companies_total
  ),
  CONSTRAINT data_quality_snapshots_metrics_object
    CHECK (jsonb_typeof(metrics) = 'object'),
  CONSTRAINT data_quality_snapshots_warnings_array
    CHECK (jsonb_typeof(warnings) = 'array')
);

