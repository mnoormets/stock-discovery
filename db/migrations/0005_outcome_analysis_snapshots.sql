-- Immutable learning record created from measured candidate outcomes.
-- Inputs are limited to discovery_decisions, candidate_outcomes,
-- data_quality_snapshots and collection_run_items.

ALTER TABLE discovery_decisions
  ADD COLUMN IF NOT EXISTS collection_run_item_id BIGINT
  REFERENCES collection_run_items(id) ON DELETE SET NULL;

ALTER TABLE discovery_decisions
  ADD COLUMN IF NOT EXISTS analysis_scope TEXT NOT NULL DEFAULT 'unknown'
  CHECK (analysis_scope IN ('canonical', 'manual', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_discovery_decisions_collection_item
  ON discovery_decisions (collection_run_item_id)
  WHERE collection_run_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS outcome_analysis_snapshots (
  id BIGSERIAL PRIMARY KEY,
  outcome_id BIGINT NOT NULL REFERENCES candidate_outcomes(id) ON DELETE RESTRICT,
  decision_id BIGINT NOT NULL REFERENCES discovery_decisions(id) ON DELETE RESTRICT,
  collection_run_item_id BIGINT REFERENCES collection_run_items(id) ON DELETE SET NULL,
  data_quality_snapshot_id BIGINT REFERENCES data_quality_snapshots(id) ON DELETE SET NULL,
  snapshot_version TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  ticker TEXT NOT NULL,
  horizon TEXT NOT NULL,
  decision_scope TEXT NOT NULL,
  candidate_return_percent NUMERIC,
  winner_status TEXT NOT NULL,
  benchmark_return_percent NUMERIC,
  excess_return_percent NUMERIC,
  benchmark_beat_status TEXT NOT NULL,

  growth_score NUMERIC,
  coverage_score NUMERIC,
  lookup_bucket TEXT NOT NULL,
  market_data_attempted BOOLEAN,
  market_data_found BOOLEAN,
  market_data_source TEXT,
  catalyst_evidence_tier INTEGER,
  catalyst_mandate_relevance TEXT NOT NULL,

  data_quality_status TEXT NOT NULL,
  sec_facts_coverage_percent NUMERIC,
  score_coverage_percent NUMERIC,
  recent_price_coverage_percent NUMERIC,
  stale_financials_percent NUMERIC,
  missing_financials_percent NUMERIC,
  low_coverage_percent NUMERIC,
  data_quality_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,

  CONSTRAINT outcome_analysis_snapshots_outcome_key UNIQUE (outcome_id),
  CONSTRAINT outcome_analysis_snapshots_version_nonempty CHECK (btrim(snapshot_version) <> ''),
  CONSTRAINT outcome_analysis_snapshots_ticker_nonempty CHECK (btrim(ticker) <> ''),
  CONSTRAINT outcome_analysis_snapshots_horizon_nonempty CHECK (btrim(horizon) <> ''),
  CONSTRAINT outcome_analysis_snapshots_scope_check
    CHECK (decision_scope IN ('canonical', 'manual', 'unknown')),
  CONSTRAINT outcome_analysis_snapshots_winner_status_check
    CHECK (winner_status IN ('winner', 'not_winner', 'unknown')),
  CONSTRAINT outcome_analysis_snapshots_winner_value_check CHECK (
    (winner_status = 'winner' AND candidate_return_percent > 0)
    OR (winner_status = 'not_winner' AND candidate_return_percent <= 0)
    OR (winner_status = 'unknown' AND candidate_return_percent IS NULL)
  ),
  CONSTRAINT outcome_analysis_snapshots_benchmark_status_check
    CHECK (benchmark_beat_status IN ('beat', 'not_beat', 'unknown')),
  CONSTRAINT outcome_analysis_snapshots_benchmark_value_check CHECK (
    (benchmark_beat_status = 'beat' AND excess_return_percent > 0)
    OR (benchmark_beat_status = 'not_beat' AND excess_return_percent <= 0)
    OR (benchmark_beat_status = 'unknown' AND excess_return_percent IS NULL)
  ),
  CONSTRAINT outcome_analysis_snapshots_bucket_check
    CHECK (lookup_bucket IN ('growth', 'recall', 'not_selected', 'unknown')),
  CONSTRAINT outcome_analysis_snapshots_quality_status_check
    CHECK (data_quality_status IN ('available', 'unknown')),
  CONSTRAINT outcome_analysis_snapshots_catalyst_tier_check
    CHECK (catalyst_evidence_tier IS NULL OR catalyst_evidence_tier > 0),
  CONSTRAINT outcome_analysis_snapshots_percentage_bounds CHECK (
    (sec_facts_coverage_percent IS NULL OR sec_facts_coverage_percent BETWEEN 0 AND 100)
    AND (score_coverage_percent IS NULL OR score_coverage_percent BETWEEN 0 AND 100)
    AND (recent_price_coverage_percent IS NULL OR recent_price_coverage_percent BETWEEN 0 AND 100)
    AND (stale_financials_percent IS NULL OR stale_financials_percent BETWEEN 0 AND 100)
    AND (missing_financials_percent IS NULL OR missing_financials_percent BETWEEN 0 AND 100)
    AND (low_coverage_percent IS NULL OR low_coverage_percent BETWEEN 0 AND 100)
  ),
  CONSTRAINT outcome_analysis_snapshots_metrics_object
    CHECK (jsonb_typeof(data_quality_metrics) = 'object'),
  CONSTRAINT outcome_analysis_snapshots_warnings_array
    CHECK (jsonb_typeof(warnings) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_outcome_analysis_ticker_horizon
  ON outcome_analysis_snapshots (ticker, horizon, captured_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_outcome_analysis_winner_horizon
  ON outcome_analysis_snapshots (winner_status, horizon, id);

CREATE OR REPLACE FUNCTION reject_outcome_analysis_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'outcome_analysis_snapshots rows are immutable';
END;
$$;

CREATE TRIGGER outcome_analysis_snapshots_immutable
BEFORE UPDATE OR DELETE ON outcome_analysis_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_outcome_analysis_snapshot_mutation();
