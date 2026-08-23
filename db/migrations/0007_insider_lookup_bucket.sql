-- Add the role-aware Form 4 discovery path to collection provenance.
-- Runner owns the transaction; this file must not contain BEGIN/COMMIT.

ALTER TABLE collection_run_items
  ADD COLUMN IF NOT EXISTS insider_rank INTEGER;

ALTER TABLE collection_run_items
  DROP CONSTRAINT IF EXISTS collection_run_items_bucket_check;
ALTER TABLE collection_run_items
  ADD CONSTRAINT collection_run_items_bucket_check
  CHECK (lookup_bucket IN ('growth', 'recall', 'insider', 'not_selected', 'unknown'));

ALTER TABLE collection_run_items
  DROP CONSTRAINT IF EXISTS collection_run_items_ranks_check;
ALTER TABLE collection_run_items
  ADD CONSTRAINT collection_run_items_ranks_check CHECK (
    (attention_rank IS NULL OR attention_rank > 0)
    AND (growth_rank IS NULL OR growth_rank > 0)
    AND (recall_rank IS NULL OR recall_rank > 0)
    AND (insider_rank IS NULL OR insider_rank > 0)
  );

ALTER TABLE outcome_analysis_snapshots
  DROP CONSTRAINT IF EXISTS outcome_analysis_snapshots_bucket_check;
ALTER TABLE outcome_analysis_snapshots
  ADD CONSTRAINT outcome_analysis_snapshots_bucket_check
  CHECK (lookup_bucket IN ('growth', 'recall', 'insider', 'not_selected', 'unknown'));
