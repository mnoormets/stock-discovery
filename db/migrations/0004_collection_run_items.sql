-- Collection -> canonical ticker provenance bridge.
-- Runner owns the transaction; this file must not contain BEGIN/COMMIT.

CREATE TABLE IF NOT EXISTS collection_run_items (
  id BIGSERIAL PRIMARY KEY,
  collection_run_id BIGINT NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  item_version TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  lookup_bucket TEXT NOT NULL,
  selected_for_market_data BOOLEAN NOT NULL DEFAULT false,
  market_data_attempted BOOLEAN NOT NULL DEFAULT false,
  market_data_found BOOLEAN NOT NULL DEFAULT false,
  market_data_source TEXT,

  mention_count INTEGER,
  previous_mention_count INTEGER,
  mention_growth_percent NUMERIC,
  attention_rank INTEGER,
  growth_rank INTEGER,
  recall_rank INTEGER,

  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  skip_reason TEXT,
  raw_signal JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,

  CONSTRAINT collection_run_items_run_ticker_key UNIQUE (collection_run_id, ticker),
  CONSTRAINT collection_run_items_ticker_nonempty CHECK (btrim(ticker) <> ''),
  CONSTRAINT collection_run_items_version_nonempty CHECK (btrim(item_version) <> ''),
  CONSTRAINT collection_run_items_bucket_check
    CHECK (lookup_bucket IN ('growth', 'recall', 'not_selected', 'unknown')),
  CONSTRAINT collection_run_items_counts_check CHECK (
    (mention_count IS NULL OR mention_count >= 0)
    AND (previous_mention_count IS NULL OR previous_mention_count >= 0)
  ),
  CONSTRAINT collection_run_items_ranks_check CHECK (
    (attention_rank IS NULL OR attention_rank > 0)
    AND (growth_rank IS NULL OR growth_rank > 0)
    AND (recall_rank IS NULL OR recall_rank > 0)
  ),
  CONSTRAINT collection_run_items_selection_check CHECK (
    (NOT market_data_found OR market_data_attempted)
    AND (NOT market_data_attempted OR selected_for_market_data)
    AND (lookup_bucket <> 'not_selected' OR NOT selected_for_market_data)
  ),
  CONSTRAINT collection_run_items_source_nonempty
    CHECK (market_data_source IS NULL OR btrim(market_data_source) <> ''),
  CONSTRAINT collection_run_items_raw_signal_object
    CHECK (jsonb_typeof(raw_signal) = 'object'),
  CONSTRAINT collection_run_items_warnings_array
    CHECK (jsonb_typeof(warnings) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_collection_run_items_ticker_observed
  ON collection_run_items (ticker, observed_at DESC, id DESC);

ALTER TABLE discovery_runs
  ADD COLUMN IF NOT EXISTS collection_run_id BIGINT
  REFERENCES collection_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_discovery_runs_collection_run
  ON discovery_runs (collection_run_id)
  WHERE collection_run_id IS NOT NULL;
