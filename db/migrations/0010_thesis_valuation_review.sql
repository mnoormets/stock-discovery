ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS revenue_assumption TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS margin_assumption TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS cash_flow_assumption TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS dilution_assumption TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS valuation_assumption TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS downside_scenario TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS reverse_valuation_question TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS next_review_trigger TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS valuation_price_snapshot_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'investment_theses_valuation_price_snapshot_id_fkey'
  ) THEN
    ALTER TABLE investment_theses
      ADD CONSTRAINT investment_theses_valuation_price_snapshot_id_fkey
      FOREIGN KEY (valuation_price_snapshot_id)
      REFERENCES price_snapshots(id) ON DELETE RESTRICT;
  END IF;
END $$;
