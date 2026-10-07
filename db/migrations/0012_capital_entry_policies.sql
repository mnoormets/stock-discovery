CREATE TABLE paper_capital_entry_policies (
  account_version TEXT NOT NULL REFERENCES paper_capital_accounts(policy_version) ON DELETE RESTRICT,
  entry_version TEXT NOT NULL CHECK (entry_version = 'growth-capital-entry-v2'),
  activated_at TIMESTAMPTZ NOT NULL,
  rules JSONB NOT NULL CHECK (jsonb_typeof(rules) = 'object'),
  PRIMARY KEY (account_version, entry_version)
);
CREATE TRIGGER paper_capital_entry_policies_immutable BEFORE UPDATE OR DELETE ON paper_capital_entry_policies
FOR EACH ROW EXECUTE FUNCTION reject_paper_capital_trade_mutation();
