CREATE TABLE IF NOT EXISTS paper_capital_accounts (
  policy_version TEXT PRIMARY KEY,
  initial_usd NUMERIC NOT NULL CHECK (initial_usd > 0),
  target_profit_usd NUMERIC NOT NULL CHECK (target_profit_usd > 0),
  rules JSONB NOT NULL CHECK (jsonb_typeof(rules) = 'object'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','risk_stopped','target_reached')),
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS paper_capital_trades (
  id BIGSERIAL PRIMARY KEY,
  policy_version TEXT NOT NULL REFERENCES paper_capital_accounts(policy_version) ON DELETE RESTRICT,
  book_key TEXT NOT NULL CHECK (book_key IN ('strategy','benchmark')),
  signal_ticker TEXT NOT NULL,
  instrument_ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  price NUMERIC NOT NULL CHECK (price > 0),
  gross_usd NUMERIC NOT NULL CHECK (gross_usd > 0),
  fee_usd NUMERIC NOT NULL CHECK (fee_usd >= 0),
  market_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  collection_run_id BIGINT REFERENCES collection_runs(id) ON DELETE RESTRICT,
  evidence JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  reason TEXT NOT NULL,
  UNIQUE (policy_version, book_key, signal_ticker, side),
  CHECK ((book_key='strategy' AND instrument_ticker=signal_ticker) OR (book_key='benchmark' AND instrument_ticker='SPY')),
  CHECK (market_at <= executed_at + interval '1 minute')
);
CREATE INDEX IF NOT EXISTS idx_paper_capital_trades_account ON paper_capital_trades(policy_version,id);
CREATE OR REPLACE FUNCTION reject_paper_capital_trade_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'paper_capital_trades rows are immutable'; END;
$$;
CREATE TRIGGER paper_capital_trades_immutable BEFORE UPDATE OR DELETE ON paper_capital_trades
FOR EACH ROW EXECUTE FUNCTION reject_paper_capital_trade_mutation();
CREATE TABLE IF NOT EXISTS paper_capital_runs (
  id BIGSERIAL PRIMARY KEY,
  policy_version TEXT NOT NULL REFERENCES paper_capital_accounts(policy_version) ON DELETE RESTRICT,
  evaluated_at TIMESTAMPTZ NOT NULL,
  collection_run_id BIGINT REFERENCES collection_runs(id) ON DELETE RESTRICT,
  result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object')
);
