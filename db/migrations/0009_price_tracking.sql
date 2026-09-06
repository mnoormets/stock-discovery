-- Receipt time remains captured_at; market_at is the provider's quote time.
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS market_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_tracking_quote
  ON price_snapshots (company_id, market_at) WHERE source = 'yahoo-tracking-v1';

CREATE TABLE IF NOT EXISTS price_tracking_attempts (
  id BIGSERIAL PRIMARY KEY,
  tracking_date DATE NOT NULL,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  ticker TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL,
  reasons TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('saved', 'unchanged', 'missing', 'stale', 'invalid', 'failed')),
  market_at TIMESTAMPTZ,
  price_snapshot_id BIGINT REFERENCES price_snapshots(id),
  UNIQUE (tracking_date, company_id)
);
