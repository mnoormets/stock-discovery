-- Versioned paper-strategy ledger. This records hypothetical signals,
-- executions and marks only; it never represents a broker order.
-- Runner owns the transaction; this file must not contain BEGIN/COMMIT.

CREATE TABLE IF NOT EXISTS paper_strategy_orders (
  id BIGSERIAL PRIMARY KEY,
  policy_version TEXT NOT NULL,
  signal_snapshot_version TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  book_key TEXT NOT NULL,
  run_id BIGINT NOT NULL REFERENCES discovery_runs(id) ON DELETE RESTRICT,
  decision_id BIGINT NOT NULL REFERENCES discovery_decisions(id) ON DELETE RESTRICT,
  signal_ticker TEXT NOT NULL,
  instrument_ticker TEXT NOT NULL,
  side TEXT NOT NULL,
  status TEXT NOT NULL,
  signal_at TIMESTAMPTZ NOT NULL,
  signal_price NUMERIC,
  signal_price_snapshot_id BIGINT REFERENCES price_snapshots(id) ON DELETE SET NULL,
  eligibility_snapshot JSONB NOT NULL,
  skip_reason TEXT,
  notional_usd NUMERIC,
  requested_quantity NUMERIC,
  execution_price NUMERIC,
  executed_quantity NUMERIC,
  gross_usd NUMERIC,
  fee_usd NUMERIC,
  executed_at TIMESTAMPTZ,
  execution_market_time TIMESTAMPTZ,
  execution_source TEXT,
  execution_quote JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT paper_strategy_orders_identity_key UNIQUE (
    policy_version, strategy_key, book_key, run_id, signal_ticker, side
  ),
  CONSTRAINT paper_strategy_orders_policy_nonempty CHECK (btrim(policy_version) <> ''),
  CONSTRAINT paper_strategy_orders_snapshot_nonempty CHECK (btrim(signal_snapshot_version) <> ''),
  CONSTRAINT paper_strategy_orders_strategy_check
    CHECK (strategy_key IN ('all_picks_baseline', 'entry_aware')),
  CONSTRAINT paper_strategy_orders_book_check
    CHECK (book_key IN ('strategy', 'benchmark')),
  CONSTRAINT paper_strategy_orders_side_check CHECK (side IN ('buy', 'sell')),
  CONSTRAINT paper_strategy_orders_status_check
    CHECK (status IN ('pending', 'filled', 'skipped', 'cancelled')),
  CONSTRAINT paper_strategy_orders_tickers_nonempty CHECK (
    btrim(signal_ticker) <> '' AND btrim(instrument_ticker) <> ''
  ),
  CONSTRAINT paper_strategy_orders_snapshot_object
    CHECK (jsonb_typeof(eligibility_snapshot) = 'object'),
  CONSTRAINT paper_strategy_orders_quote_object
    CHECK (execution_quote IS NULL OR jsonb_typeof(execution_quote) = 'object'),
  CONSTRAINT paper_strategy_orders_positive_values CHECK (
    (signal_price IS NULL OR signal_price > 0)
    AND (notional_usd IS NULL OR notional_usd > 0)
    AND (requested_quantity IS NULL OR requested_quantity > 0)
    AND (execution_price IS NULL OR execution_price > 0)
    AND (executed_quantity IS NULL OR executed_quantity > 0)
    AND (gross_usd IS NULL OR gross_usd > 0)
    AND (fee_usd IS NULL OR fee_usd >= 0)
  ),
  CONSTRAINT paper_strategy_orders_fill_shape CHECK (
    (status = 'filled'
      AND execution_price IS NOT NULL
      AND executed_quantity IS NOT NULL
      AND gross_usd IS NOT NULL
      AND fee_usd IS NOT NULL
      AND executed_at IS NOT NULL
      AND execution_market_time IS NOT NULL
      AND execution_source IS NOT NULL)
    OR (status <> 'filled'
      AND execution_price IS NULL
      AND executed_quantity IS NULL
      AND gross_usd IS NULL
      AND fee_usd IS NULL
      AND executed_at IS NULL
      AND execution_market_time IS NULL
      AND execution_source IS NULL
      AND execution_quote IS NULL)
  ),
  CONSTRAINT paper_strategy_orders_skip_shape CHECK (
    (status = 'skipped' AND skip_reason IS NOT NULL)
    OR (status <> 'skipped' AND skip_reason IS NULL)
  ),
  CONSTRAINT paper_strategy_orders_benchmark_shape CHECK (
    (book_key = 'benchmark' AND instrument_ticker = 'SPY')
    OR (book_key = 'strategy' AND instrument_ticker = signal_ticker)
  )
);

CREATE INDEX IF NOT EXISTS idx_paper_strategy_orders_pending
  ON paper_strategy_orders (status, signal_at, id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_paper_strategy_orders_performance
  ON paper_strategy_orders (policy_version, strategy_key, book_key, executed_at, id)
  WHERE status = 'filled';
CREATE INDEX IF NOT EXISTS idx_paper_strategy_orders_ticker
  ON paper_strategy_orders (instrument_ticker, status, executed_at, id);

CREATE TABLE IF NOT EXISTS paper_strategy_marks (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  market_time TIMESTAMPTZ NOT NULL,
  marked_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  quote_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT paper_strategy_marks_identity_key UNIQUE (ticker, market_time, source),
  CONSTRAINT paper_strategy_marks_ticker_nonempty CHECK (btrim(ticker) <> ''),
  CONSTRAINT paper_strategy_marks_price_positive CHECK (price > 0),
  CONSTRAINT paper_strategy_marks_currency_nonempty CHECK (btrim(currency) <> ''),
  CONSTRAINT paper_strategy_marks_source_nonempty CHECK (btrim(source) <> ''),
  CONSTRAINT paper_strategy_marks_payload_object CHECK (jsonb_typeof(quote_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_paper_strategy_marks_latest
  ON paper_strategy_marks (ticker, market_time DESC, id DESC);

CREATE OR REPLACE FUNCTION reject_paper_strategy_mark_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'paper_strategy_marks rows are immutable';
END;
$$;

CREATE TRIGGER paper_strategy_marks_immutable
BEFORE UPDATE OR DELETE ON paper_strategy_marks
FOR EACH ROW EXECUTE FUNCTION reject_paper_strategy_mark_mutation();
