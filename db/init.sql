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
  time_horizon  TEXT,
  is_current    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_thesis
  ON investment_theses (position_id) WHERE is_current;

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
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind, title, occurred_at)
);

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
