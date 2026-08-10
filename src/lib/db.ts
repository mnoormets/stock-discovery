import { Pool, type PoolClient } from 'pg';
import type { Candidate } from './types';
import type { SecSuspension } from './sec';
import type { CompanyResearch } from './investment';

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

async function upsertCompany(
  client: Pick<PoolClient, 'query'>,
  company: {
    ticker: string;
    name: string | null;
    exchange: string | null;
    quoteType: string | null;
    currency: string | null;
    source: string;
  },
): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO companies (ticker, name, exchange, quote_type, currency, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (ticker) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, companies.name),
       exchange = COALESCE(EXCLUDED.exchange, companies.exchange),
       quote_type = COALESCE(EXCLUDED.quote_type, companies.quote_type),
       currency = COALESCE(EXCLUDED.currency, companies.currency),
       source = EXCLUDED.source,
       updated_at = now()
     RETURNING id`,
    [
      company.ticker,
      company.name,
      company.exchange,
      company.quoteType,
      company.currency,
      company.source,
    ],
  );
  return Number(rows[0].id);
}

async function insertPriceSnapshot(
  client: Pick<PoolClient, 'query'>,
  companyId: number,
  values: {
    price: number | null;
    previousClose: number | null;
    marketCap: number | null;
    volume: number | null;
    currency: string | null;
    source: string;
  },
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock($1)', [companyId]);
  await client.query(
    `INSERT INTO price_snapshots
       (company_id, price, previous_close, market_cap, volume, currency, source)
     SELECT $1, $2, $3, $4, $5, $6, $7
     WHERE NOT EXISTS (
       SELECT 1 FROM price_snapshots
       WHERE company_id = $1
         AND captured_at >= now() - interval '5 minutes'
         AND price IS NOT DISTINCT FROM $2::numeric
         AND previous_close IS NOT DISTINCT FROM $3::numeric
         AND market_cap IS NOT DISTINCT FROM $4::bigint
         AND volume IS NOT DISTINCT FROM $5::bigint
         AND currency IS NOT DISTINCT FROM $6::text
         AND source = $7
     )`,
    [
      companyId,
      values.price,
      values.previousClose,
      values.marketCap,
      values.volume,
      values.currency,
      values.source,
    ],
  );
}

// Salvesta ettevõtte detailvaate live-andmed ühe transaktsioonina.
// Uudised, SEC sündmused ja earnings on idempotentsed; hinnast ei tehta sama
// väärtusega uut rida iga lehe refresh'i kohta viie minuti jooksul.
export async function saveCompanyResearch(research: CompanyResearch): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quote } = research;
    const companyId = await upsertCompany(client, {
      ticker: quote.ticker,
      name: quote.name,
      exchange: quote.exchange,
      quoteType: quote.quoteType,
      currency: quote.currency,
      source: 'yahoo',
    });

    await insertPriceSnapshot(client, companyId, {
      price: quote.price,
      previousClose: quote.previousClose,
      marketCap: quote.marketCap,
      volume: quote.volume,
      currency: quote.currency,
      source: 'yahoo',
    });

    for (const item of research.news) {
      await client.query(
        `INSERT INTO news_items
           (id, company_id, title, publisher, url, published_at, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'yahoo')
         ON CONFLICT DO NOTHING`,
        [item.id, companyId, item.title, item.publisher, item.url, item.publishedAt],
      );
    }

    for (const filing of research.secFilings) {
      await client.query(
        `INSERT INTO sec_events
           (id, company_id, form_type, filed_at, description, url, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'sec')
         ON CONFLICT (id) DO UPDATE SET
           company_id = EXCLUDED.company_id,
           form_type = EXCLUDED.form_type,
           filed_at = EXCLUDED.filed_at,
           description = EXCLUDED.description,
           url = EXCLUDED.url`,
        [filing.id, companyId, filing.form, filing.filedAt || null, filing.description, filing.url],
      );
    }

    if (quote.earningsAt) {
      await client.query(
        `DELETE FROM earnings_events
         WHERE company_id = $1 AND source = 'yahoo'
           AND event_at >= now() AND event_at <> $2::timestamptz`,
        [companyId, quote.earningsAt],
      );
      await client.query(
        `INSERT INTO earnings_events (company_id, event_at, source)
         VALUES ($1, $2, 'yahoo')
         ON CONFLICT (company_id, event_at, source)
         DO UPDATE SET updated_at = now()`,
        [companyId, quote.earningsAt],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// /api/collect saab fundamentaalidest ettevõtte ja hinnainfo. Teised live-tabelid
// täituvad siis, kui detailne research-päring annab vastavad andmed.
export async function saveCollectedCompanies(candidates: Candidate[]): Promise<void> {
  const withMarketData = candidates.filter((candidate) =>
    candidate.price != null || candidate.marketCap != null || candidate.volume != null,
  );
  if (withMarketData.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const candidate of withMarketData) {
      const source = candidate.fundamentalsSource || 'collection';
      const companyId = await upsertCompany(client, {
        ticker: candidate.ticker,
        name: candidate.name || null,
        exchange: null,
        quoteType: null,
        currency: candidate.currency,
        source,
      });
      await insertPriceSnapshot(client, companyId, {
        price: candidate.price,
        previousClose: null,
        marketCap: candidate.marketCap,
        volume: candidate.volume,
        currency: candidate.currency,
        source,
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

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
      dedupe_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, kind, title, occurred_at)
    );
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedupe_key
      ON alerts (dedupe_key) WHERE dedupe_key IS NOT NULL;
  `);
}

export type DailyAlertKind = 'needs review' | 'no major changes' | 'new catalyst' | 'new risk';

export interface DailyPricePoint {
  id: number;
  price: number | null;
  capturedAt: string;
}

export interface DailyNewsEvent {
  id: string;
  title: string;
  url: string;
  discoveredAt: string;
}

export interface DailySecEvent {
  id: string;
  form: string;
  description: string | null;
  url: string;
  filedAt: string | null;
  discoveredAt: string;
}

export interface DailyEarningsEvent {
  id: number;
  eventAt: string;
}

export interface DailyHistory {
  companyId: number;
  currentPrice: DailyPricePoint | null;
  previousPrice: DailyPricePoint | null;
  currentAlreadyCompared: boolean;
  newNews: DailyNewsEvent[];
  newSecEvents: DailySecEvent[];
  upcomingEarnings: DailyEarningsEvent | null;
}

export interface DailyAlertInput {
  companyId: number;
  positionId: number;
  kind: DailyAlertKind;
  title: string;
  detail: string;
  sourceUrl: string | null;
  occurredAt: string;
  dedupeKey: string;
}

// Võrdlusaken algab viimase Daily alert'i loomise hetkest. Esimesel korral
// kasutatakse eelmist hinnasnapshot'i või viimast 24 tundi.
export async function getDailyHistory(ticker: string): Promise<DailyHistory | null> {
  const companyResult = await pool.query('SELECT id FROM companies WHERE ticker = $1', [ticker]);
  if (!companyResult.rowCount) return null;
  const companyId = Number(companyResult.rows[0].id);

  const priceResult = await pool.query(
    `SELECT id, price, captured_at
     FROM price_snapshots
     WHERE company_id = $1
     ORDER BY captured_at DESC, id DESC
     LIMIT 2`,
    [companyId],
  );
  const prices: DailyPricePoint[] = priceResult.rows.map((row) => ({
    id: Number(row.id),
    price: row.price == null ? null : Number(row.price),
    capturedAt: new Date(row.captured_at).toISOString(),
  }));

  const lastAlertResult = await pool.query(
    `SELECT max(created_at) AS compared_at
     FROM alerts
     WHERE company_id = $1 AND dedupe_key LIKE 'daily:%'`,
    [companyId],
  );
  const fallback = prices[1]?.capturedAt || new Date(Date.now() - 86_400_000).toISOString();
  const comparedAt = lastAlertResult.rows[0]?.compared_at
    ? new Date(lastAlertResult.rows[0].compared_at).toISOString()
    : fallback;
  const currentAlreadyCompared = Boolean(
    lastAlertResult.rows[0]?.compared_at
      && prices[0]
      && new Date(lastAlertResult.rows[0].compared_at).getTime() >= new Date(prices[0].capturedAt).getTime(),
  );

  const [newsResult, secResult, earningsResult] = await Promise.all([
    pool.query(
      `SELECT id, title, url, discovered_at
       FROM news_items
       WHERE company_id = $1 AND discovered_at > $2
       ORDER BY discovered_at ASC`,
      [companyId, comparedAt],
    ),
    pool.query(
      `SELECT id, form_type, description, url, filed_at, discovered_at
       FROM sec_events
       WHERE company_id = $1 AND discovered_at > $2
       ORDER BY discovered_at ASC`,
      [companyId, comparedAt],
    ),
    pool.query(
      `SELECT id, event_at
       FROM earnings_events
       WHERE company_id = $1 AND event_at >= now() AND event_at <= now() + interval '14 days'
         AND NOT EXISTS (
           SELECT 1 FROM alerts a
           WHERE a.dedupe_key = 'daily:earnings:' || $1::text || ':' || earnings_events.id::text
         )
       ORDER BY event_at ASC LIMIT 1`,
      [companyId],
    ),
  ]);

  return {
    companyId,
    currentPrice: prices[0] || null,
    previousPrice: prices[1] || null,
    currentAlreadyCompared,
    newNews: newsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      discoveredAt: new Date(row.discovered_at).toISOString(),
    })),
    newSecEvents: secResult.rows.map((row) => ({
      id: row.id,
      form: row.form_type || 'SEC filing',
      description: row.description || null,
      url: row.url,
      filedAt: row.filed_at ? new Date(row.filed_at).toISOString().slice(0, 10) : null,
      discoveredAt: new Date(row.discovered_at).toISOString(),
    })),
    upcomingEarnings: earningsResult.rowCount
      ? {
          id: Number(earningsResult.rows[0].id),
          eventAt: new Date(earningsResult.rows[0].event_at).toISOString(),
        }
      : null,
  };
}

export async function saveDailyAlerts(alerts: DailyAlertInput[]): Promise<number> {
  if (alerts.length === 0) return 0;
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (const alert of alerts) {
      const result = await client.query(
        `INSERT INTO alerts
           (company_id, position_id, kind, title, detail, source_url, occurred_at, dedupe_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          alert.companyId,
          alert.positionId,
          alert.kind,
          alert.title,
          alert.detail,
          alert.sourceUrl,
          alert.occurredAt,
          alert.dedupeKey,
        ],
      );
      inserted += result.rowCount || 0;
    }
    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
