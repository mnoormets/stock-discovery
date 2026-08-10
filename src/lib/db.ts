import { Pool } from 'pg';
import type { Candidate } from './types';
import type { SecSuspension } from './sec';

// Üks jagatud ühenduste bassein kogu rakenduse peale.
const globalForPg = globalThis as unknown as { _pgPool?: Pool };
export const pool =
  globalForPg._pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://discovery:discovery@db:5432/discovery',
  });
if (!globalForPg._pgPool) globalForPg._pgPool = pool;

// Idempotentne skeemi-migratsioon. Käivitatakse iga kogumise alguses, et
// olemasolev (varem loodud) andmebaas saaks uued veerud/tabelid ilma reset'ita.
export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id BIGSERIAL PRIMARY KEY,
      capture_date DATE NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ticker TEXT NOT NULL,
      name TEXT,
      mentions INTEGER NOT NULL DEFAULT 0,
      mentions_prev INTEGER,
      mention_growth NUMERIC,
      upvotes INTEGER,
      rank INTEGER,
      rank_prev INTEGER,
      sentiment TEXT,
      sentiment_source TEXT,
      sentiment_value NUMERIC,
      market_cap BIGINT,
      price NUMERIC,
      currency TEXT,
      discovery_score NUMERIC,
      is_new BOOLEAN NOT NULL DEFAULT false,
      UNIQUE (capture_date, ticker)
    );
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS volume BIGINT;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS fundamentals_source TEXT;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS rising_days INTEGER DEFAULT 0;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sec_suspended BOOLEAN DEFAULT false;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS warnings TEXT;

    CREATE TABLE IF NOT EXISTS sec_suspensions (
      normalized  TEXT PRIMARY KEY,   -- normaliseeritud firmanimi (sobitamiseks)
      company     TEXT NOT NULL,      -- originaalnimi feedist
      link        TEXT,
      pub_date    TEXT,
      first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS companies (
      id BIGSERIAL PRIMARY KEY,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT,
      exchange TEXT,
      quote_type TEXT,
      currency TEXT,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      price NUMERIC,
      previous_close NUMERIC,
      market_cap BIGINT,
      volume BIGINT,
      currency TEXT,
      source TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      publisher TEXT,
      summary TEXT,
      url TEXT NOT NULL,
      published_at TIMESTAMPTZ,
      source TEXT NOT NULL,
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, url)
    );
    CREATE TABLE IF NOT EXISTS sec_events (
      id TEXT PRIMARY KEY,
      company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
      form_type TEXT,
      filed_at DATE,
      description TEXT,
      url TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'sec',
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS earnings_events (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      event_at TIMESTAMPTZ NOT NULL,
      timing TEXT,
      source TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, event_at, source)
    );
    CREATE TABLE IF NOT EXISTS portfolio_positions (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT,
      ticker TEXT NOT NULL,
      quantity NUMERIC NOT NULL CHECK (quantity >= 0),
      average_buy_price NUMERIC NOT NULL CHECK (average_buy_price >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'watch', 'closed')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS investment_theses (
      id BIGSERIAL PRIMARY KEY,
      position_id BIGINT NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
      thesis TEXT NOT NULL,
      time_horizon TEXT,
      is_current BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_thesis
      ON investment_theses (position_id) WHERE is_current;
    CREATE TABLE IF NOT EXISTS thesis_change_events (
      id BIGSERIAL PRIMARY KEY,
      position_id BIGINT NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
      previous_thesis TEXT,
      new_thesis TEXT,
      change_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
      position_id BIGINT REFERENCES portfolio_positions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      detail TEXT,
      source_url TEXT,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, kind, title, occurred_at)
    );
  `);
}

// Salvesta/uuenda SEC peatamised (akumuleerub ajas, sest feed näitab ainult hiljutisi).
export async function upsertSecSuspensions(items: SecSuspension[]): Promise<void> {
  if (items.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      await client.query(
        `INSERT INTO sec_suspensions (normalized, company, link, pub_date)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (normalized) DO UPDATE SET last_seen = now()`,
        [it.normalized, it.company, it.link, it.pubDate],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Kõik seni nähtud SEC-peatatud normaliseeritud nimed (kiireks sobitamiseks).
export async function getSecSuspendedSet(): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT normalized FROM sec_suspensions`);
  return new Set(rows.map((r) => r.normalized));
}

// Mainimiste ajalugu: iga tickeri kohta viimased `days` VAREM salvestatud päeva
// (kõige värskem ees). Kasutatakse mitmepäevase järjekindluse tuvastamiseks.
export async function getMentionHistory(
  captureDate: string,
  tickers: string[],
  days = 3,
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (tickers.length === 0) return map;
  const { rows } = await pool.query(
    `SELECT ticker, mentions FROM snapshots
      WHERE capture_date < $1 AND ticker = ANY($2)
      ORDER BY ticker, capture_date DESC`,
    [captureDate, tickers],
  );
  for (const r of rows) {
    const arr = map.get(r.ticker) ?? [];
    if (arr.length < days) {
      arr.push(Number(r.mentions));
      map.set(r.ticker, arr);
    }
  }
  return map;
}

// Salvesta ühe päeva kandidaadid. UPSERT: sama päeva sama ticker kirjutatakse üle,
// nii et päeva sees mitu korda nupule vajutades ei teki duplikaate.
export async function saveSnapshot(captureDate: string, candidates: Candidate[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Kustuta selle päeva vanad read, et kordusjooks annaks puhta pildi
    // (nt kui ticker langes mustandi/filtri tõttu kandidaatidest välja).
    await client.query('DELETE FROM snapshots WHERE capture_date = $1', [captureDate]);
    for (const c of candidates) {
      await client.query(
        `INSERT INTO snapshots
          (capture_date, ticker, name, mentions, mentions_prev, mention_growth,
           upvotes, rank, rank_prev, sentiment, sentiment_source, sentiment_value,
           market_cap, price, currency, discovery_score, is_new,
           volume, fundamentals_source, rising_days, sec_suspended, warnings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                 $18,$19,$20,$21,$22)`,
        [
          captureDate, c.ticker, c.name, c.mentions, c.mentionsPrev, c.mentionGrowth,
          c.upvotes, c.rank, c.rankPrev, c.sentiment, c.sentimentSource, c.sentimentValue,
          c.marketCap, c.price, c.currency, c.discoveryScore, c.isNew,
          c.volume, c.fundamentalsSource, c.risingDays, c.secSuspended,
          JSON.stringify(c.warnings ?? []),
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Loe ühe päeva top leiud (dashboardile / aruandesse).
export async function getTop(captureDate: string, limit: number) {
  const { rows } = await pool.query(
    `SELECT * FROM snapshots
      WHERE capture_date = $1
      ORDER BY discovery_score DESC
      LIMIT $2`,
    [captureDate, limit],
  );
  return rows;
}

// Kõige värskem päev, mille kohta on andmeid (dashboardi vaikevaade).
// NB: to_char SQL-is, et vältida ajavööndi-nihet (toISOString teisendaks UTC-sse
// ja Tallinn UTC+3 juures nihkuks kuupäev päev tagasi).
export async function getLatestDate(): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT to_char(capture_date, 'YYYY-MM-DD') AS d
       FROM snapshots ORDER BY capture_date DESC LIMIT 1`,
  );
  return rows[0]?.d ?? null;
}

// Eilse päeva mainimised ühe tickeri kohta (trendi "eile vs täna" jaoks).
export async function getPrevMentions(
  captureDate: string,
  tickers: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (tickers.length === 0) return map;
  const { rows } = await pool.query(
    `SELECT ticker, mentions FROM snapshots
      WHERE capture_date < $1 AND ticker = ANY($2)
      ORDER BY capture_date DESC`,
    [captureDate, tickers],
  );
  // Esimene (kõige värskem enne täna) võidab.
  for (const r of rows) {
    if (!map.has(r.ticker)) map.set(r.ticker, Number(r.mentions));
  }
  return map;
}
