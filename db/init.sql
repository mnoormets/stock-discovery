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
