-- TOP 10 #7: iga põhikogumise katse saab eraldi auditeeritava lifecycle-kirje.
-- Runner omab transaktsiooni; selles failis ei tohi olla BEGIN/COMMIT-i.

CREATE TABLE IF NOT EXISTS collection_runs (
  id            BIGSERIAL PRIMARY KEY,
  trigger       TEXT NOT NULL DEFAULT 'direct',
  status        TEXT NOT NULL DEFAULT 'running',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  duration_ms   BIGINT,
  metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_name    TEXT,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT collection_runs_trigger_check CHECK (char_length(trigger) BETWEEN 1 AND 64),
  CONSTRAINT collection_runs_status_check CHECK (status IN ('running', 'success', 'failure')),
  CONSTRAINT collection_runs_metrics_object_check CHECK (jsonb_typeof(metrics) = 'object'),
  CONSTRAINT collection_runs_lifecycle_check CHECK (
    (status = 'running' AND finished_at IS NULL AND duration_ms IS NULL
      AND error_name IS NULL AND error_message IS NULL)
    OR
    (status = 'success' AND finished_at IS NOT NULL AND duration_ms >= 0
      AND error_name IS NULL AND error_message IS NULL)
    OR
    (status = 'failure' AND finished_at IS NOT NULL AND duration_ms >= 0
      AND error_message IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_collection_runs_started
  ON collection_runs (started_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_collection_runs_status_started
  ON collection_runs (status, started_at DESC, id DESC);

