-- Iga rida = üks ticker ühel päeval (päevane snapshot).
-- Nii saab võrrelda "eile vs täna" ja näha trende ajas.
CREATE TABLE IF NOT EXISTS snapshots (
  id               BIGSERIAL PRIMARY KEY,
  capture_date     DATE        NOT NULL,          -- mis päeva kohta (grupeerimiseks)
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticker           TEXT        NOT NULL,
  name             TEXT,
  mentions         INTEGER     NOT NULL DEFAULT 0,
  mentions_prev    INTEGER,                        -- mainimised 24h tagasi (ApeWisdom)
  mention_growth   NUMERIC,                        -- kasv protsentides (nt 1.8 = +180%)
  upvotes          INTEGER,
  rank             INTEGER,
  rank_prev        INTEGER,
  sentiment        TEXT,                           -- Bullish / Bearish / Neutral
  sentiment_source TEXT,                           -- 'tradestie' (usaldusväärsem) või 'apewisdom' (proxy)
  sentiment_value  NUMERIC,                        -- normaliseeritud -1..1
  market_cap       BIGINT,
  price            NUMERIC,
  currency         TEXT,
  discovery_score  NUMERIC,                        -- 0..100, meie avastamise skoor (pärast trahve)
  is_new           BOOLEAN     NOT NULL DEFAULT false,  -- ilmus täna, eile puudus
  volume           BIGINT,                           -- kauplemismaht (likviidsuse hindamiseks)
  fundamentals_source TEXT,                          -- 'yahoo' või 'fmp'
  rising_days      INTEGER     DEFAULT 0,             -- mitu päeva järjest mainimised tõusnud
  sec_suspended    BOOLEAN     DEFAULT false,         -- SEC on kauplemise peatanud
  warnings         TEXT,                              -- JSON massiiv manipulatsiooni-hoiatustest
  UNIQUE (capture_date, ticker)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date  ON snapshots (capture_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_score ON snapshots (capture_date, discovery_score DESC);

-- V1 investeerimisjälgimise vundament.
CREATE TABLE IF NOT EXISTS companies (
  id            BIGSERIAL PRIMARY KEY,
  ticker        TEXT NOT NULL UNIQUE,
  name          TEXT,
  exchange      TEXT,
  quote_type    TEXT,
  currency      TEXT,
  source        TEXT,
  sec_cik       TEXT,
  sector        TEXT,
  industry      TEXT,
  classification_source TEXT,
  classification_updated_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  price         NUMERIC,
  previous_close NUMERIC,
  market_cap    BIGINT,
  volume        BIGINT,
  currency      TEXT,
  source        TEXT NOT NULL,
  UNIQUE (company_id, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_price_company_time ON price_snapshots (company_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS news_items (
  id            TEXT PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  publisher     TEXT,
  summary       TEXT,
  url           TEXT NOT NULL,
  published_at  TIMESTAMPTZ,
  source        TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, url)
);
CREATE INDEX IF NOT EXISTS idx_news_company_time ON news_items (company_id, published_at DESC);

CREATE TABLE IF NOT EXISTS sec_events (
  id            TEXT PRIMARY KEY,
  company_id    BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  form_type     TEXT,
  filed_at      DATE,
  description   TEXT,
  url           TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'sec',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_company_time ON sec_events (company_id, filed_at DESC);

CREATE TABLE IF NOT EXISTS earnings_events (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_at      TIMESTAMPTZ NOT NULL,
  timing        TEXT,
  source        TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, event_at, source)
);

CREATE TABLE IF NOT EXISTS portfolio_positions (
  id                BIGSERIAL PRIMARY KEY,
  company_id        BIGINT REFERENCES companies(id) ON DELETE RESTRICT,
  ticker            TEXT NOT NULL,
  quantity          NUMERIC NOT NULL CHECK (quantity >= 0),
  average_buy_price NUMERIC NOT NULL CHECK (average_buy_price >= 0),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'watch', 'closed')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_positions_status ON portfolio_positions (status, ticker);

CREATE TABLE IF NOT EXISTS investment_theses (
  id            BIGSERIAL PRIMARY KEY,
  position_id   BIGINT NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
  thesis        TEXT NOT NULL,
  business      TEXT,
  why_now       TEXT,
  moat          TEXT,
  mispricing    TEXT,
  catalyst      TEXT,
  invalidation  TEXT,
  twelve_month_checkpoint TEXT,
  checkpoint_is_measurable BOOLEAN NOT NULL DEFAULT false,
  time_horizon  TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'researching', 'ready', 'rejected')),
  version       INTEGER NOT NULL DEFAULT 1,
  content_hash  TEXT,
  score_snapshot_id BIGINT,
  is_current    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_source TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS why_now TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS moat TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS mispricing TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS catalyst TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS invalidation TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS twelve_month_checkpoint TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS checkpoint_is_measurable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS score_snapshot_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_thesis
  ON investment_theses (position_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_thesis_position_history
  ON investment_theses (position_id, version DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS thesis_change_events (
  id            BIGSERIAL PRIMARY KEY,
  position_id   BIGINT NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
  previous_thesis TEXT,
  new_thesis    TEXT,
  change_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  position_id   BIGINT REFERENCES portfolio_positions(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'info',
  title         TEXT NOT NULL,
  detail        TEXT,
  source_url    TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL,
  dedupe_key    TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind, title, occurred_at)
);

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_alerts_position_occurred
  ON alerts (position_id, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS financial_facts (
  id               BIGSERIAL PRIMARY KEY,
  company_id       BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric           TEXT NOT NULL,
  value            NUMERIC NOT NULL,
  unit             TEXT NOT NULL,
  period_start     DATE,
  period_end       DATE NOT NULL,
  period_kind      TEXT NOT NULL,
  fiscal_year      INTEGER,
  fiscal_period    TEXT,
  form_type        TEXT NOT NULL,
  filed_at         DATE NOT NULL,
  accession_number TEXT NOT NULL,
  taxonomy         TEXT NOT NULL,
  tag              TEXT NOT NULL,
  is_derived       BOOLEAN NOT NULL DEFAULT false,
  source_url       TEXT NOT NULL,
  fact_key         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, fact_key)
);
CREATE INDEX IF NOT EXISTS idx_financial_facts_company_metric_period
  ON financial_facts (company_id, metric, period_end DESC, filed_at DESC);

CREATE TABLE IF NOT EXISTS company_score_snapshots (
  id               BIGSERIAL PRIMARY KEY,
  company_id       BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scoring_version  TEXT NOT NULL,
  input_hash       TEXT NOT NULL,
  growth_score     INTEGER,
  health_score     INTEGER,
  coverage_score   INTEGER NOT NULL,
  payload          JSONB NOT NULL,
  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, scoring_version, input_hash)
);
CREATE INDEX IF NOT EXISTS idx_company_scores_company_time
  ON company_score_snapshots (company_id, calculated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS discovery_runs (
  id               BIGSERIAL PRIMARY KEY,
  run_type         TEXT NOT NULL DEFAULT 'rklb',
  decision_date    DATE NOT NULL,
  run_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_version    TEXT NOT NULL,
  input_hash       TEXT NOT NULL,
  run_key          TEXT NOT NULL UNIQUE,
  rules            JSONB NOT NULL,
  universe         JSONB NOT NULL,
  evaluated_count  INTEGER NOT NULL,
  included_count   INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_time
  ON discovery_runs (run_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS discovery_decisions (
  id                  BIGSERIAL PRIMARY KEY,
  run_id              BIGINT NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  company_id          BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  ticker              TEXT NOT NULL,
  included            BOOLEAN NOT NULL,
  candidate_rank      INTEGER,
  exclusion_reasons   JSONB NOT NULL DEFAULT '[]'::jsonb,
  growth_score        INTEGER,
  health_score        INTEGER,
  coverage_score      INTEGER NOT NULL,
  decision_price      NUMERIC,
  currency            TEXT,
  market_cap          BIGINT,
  volume              BIGINT,
  price_snapshot_id   BIGINT,
  score_snapshot_id   BIGINT,
  scoring_version     TEXT,
  runway_status       TEXT NOT NULL,
  runway_detail       TEXT NOT NULL,
  catalyst_status     TEXT NOT NULL,
  catalyst_type       TEXT,
  catalyst_source_id  TEXT,
  catalyst_url        TEXT,
  catalyst_at         TIMESTAMPTZ,
  catalyst_detail     TEXT NOT NULL,
  risks               JSONB NOT NULL DEFAULT '[]'::jsonb,
  unknowns            JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons             JSONB NOT NULL DEFAULT '[]'::jsonb,
  criteria            JSONB NOT NULL DEFAULT '[]'::jsonb,
  proof_questions     JSONB NOT NULL DEFAULT '[]'::jsonb,
  sector              TEXT,
  industry            TEXT,
  sector_group_type   TEXT,
  sector_growth_percentile NUMERIC,
  sector_health_percentile NUMERIC,
  sector_coverage_percentile NUMERIC,
  sector_market_cap_percentile NUMERIC,
  sector_comparable_count INTEGER,
  sector_median_growth NUMERIC,
  sector_median_health NUMERIC,
  sector_median_coverage NUMERIC,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, ticker)
);
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_group_type TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_growth_percentile NUMERIC;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_health_percentile NUMERIC;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_coverage_percentile NUMERIC;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_market_cap_percentile NUMERIC;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_comparable_count INTEGER;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_growth NUMERIC;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_health NUMERIC;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_coverage NUMERIC;
CREATE INDEX IF NOT EXISTS idx_discovery_decisions_ticker_time
  ON discovery_decisions (ticker, run_id DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_decisions_included
  ON discovery_decisions (included, run_id DESC);

CREATE TABLE IF NOT EXISTS candidate_outcomes (
  id               BIGSERIAL PRIMARY KEY,
  decision_id      BIGINT NOT NULL REFERENCES discovery_decisions(id) ON DELETE CASCADE,
  horizon          TEXT NOT NULL,
  target_at        TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  observed_at      TIMESTAMPTZ,
  observed_price   NUMERIC,
  return_percent   NUMERIC,
  measured_at      TIMESTAMPTZ,
  benchmark_symbol TEXT NOT NULL DEFAULT 'SPY',
  benchmark_status TEXT NOT NULL DEFAULT 'pending',
  benchmark_start_at TIMESTAMPTZ,
  benchmark_end_at TIMESTAMPTZ,
  benchmark_price_start NUMERIC,
  benchmark_price_end NUMERIC,
  benchmark_return_percent NUMERIC,
  excess_return_percent NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (decision_id, horizon)
);
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_symbol TEXT NOT NULL DEFAULT 'SPY';
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_start_at TIMESTAMPTZ;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_end_at TIMESTAMPTZ;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_price_start NUMERIC;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_price_end NUMERIC;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_return_percent NUMERIC;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS excess_return_percent NUMERIC;
CREATE INDEX IF NOT EXISTS idx_candidate_outcomes_status_target
  ON candidate_outcomes (status, target_at);

CREATE TABLE IF NOT EXISTS analyst_targets (
  id                    BIGSERIAL PRIMARY KEY,
  company_id            BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_mean_price     NUMERIC,
  target_high_price     NUMERIC,
  target_low_price      NUMERIC,
  recommendation_mean   NUMERIC,
  recommendation_key    TEXT,
  analyst_count          INTEGER,
  source                 TEXT NOT NULL,
  data_hash              TEXT NOT NULL,
  UNIQUE (company_id, data_hash)
);
CREATE INDEX IF NOT EXISTS idx_analyst_company_time ON analyst_targets (company_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS research_briefs (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  input_hash    TEXT NOT NULL,
  model         TEXT NOT NULL,
  content       JSONB NOT NULL,
  source_count  INTEGER NOT NULL DEFAULT 0,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, input_hash)
);
CREATE INDEX IF NOT EXISTS idx_research_briefs_company_time ON research_briefs (company_id, generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedupe_key
  ON alerts (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- SEC kauplemispeatamised (akumuleerub ajas; feed näitab ainult hiljutisi).
-- Sobitamine käib firma NIME järgi, sest SEC feedis pole tickereid.
CREATE TABLE IF NOT EXISTS sec_suspensions (
  normalized  TEXT PRIMARY KEY,
  company     TEXT NOT NULL,
  link        TEXT,
  pub_date    TEXT,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);
