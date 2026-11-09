CREATE TABLE unified_opportunity_paper (
  id BIGSERIAL PRIMARY KEY,
  policy_version TEXT NOT NULL,
  ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  scope TEXT NOT NULL DEFAULT 'unfunded_quote_scenario' CHECK (scope='unfunded_quote_scenario'),
  collection_run_id BIGINT NOT NULL REFERENCES collection_runs(id) ON DELETE RESTRICT,
  quote_snapshot_id BIGINT NOT NULL REFERENCES price_snapshots(id) ON DELETE RESTRICT,
  buy_event_id BIGINT REFERENCES unified_opportunity_paper(id) ON DELETE RESTRICT,
  market_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity>0),
  fill_price NUMERIC NOT NULL CHECK (fill_price>0),
  gross_usd NUMERIC NOT NULL CHECK (gross_usd>0),
  fee_usd NUMERIC NOT NULL CHECK (fee_usd>=0),
  evidence JSONB NOT NULL CHECK (jsonb_typeof(evidence)='object'),
  UNIQUE(policy_version,ticker,side),
  CHECK (market_at<=recorded_at),
  CHECK ((side='buy' AND buy_event_id IS NULL) OR (side='sell' AND buy_event_id IS NOT NULL))
);
CREATE FUNCTION reject_unified_opportunity_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'unified_opportunity_paper is append-only'; END;
$$;
CREATE TRIGGER unified_opportunity_paper_immutable BEFORE UPDATE OR DELETE ON unified_opportunity_paper
FOR EACH ROW EXECUTE FUNCTION reject_unified_opportunity_mutation();
