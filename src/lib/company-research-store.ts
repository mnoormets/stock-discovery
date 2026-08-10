import type { CompanyResearch } from './investment';
import { normalizeTicker } from './investment';
import { fetchCompanyResearch } from './company-data';
import { pool } from './db';

const DB_REFRESH_MS = 5 * 60_000;
let schemaPromise: Promise<void> | null = null;

export function ensureResearchSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS analyst_targets (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        target_mean_price NUMERIC,
        target_high_price NUMERIC,
        target_low_price NUMERIC,
        recommendation_mean NUMERIC,
        recommendation_key TEXT,
        analyst_count INTEGER,
        source TEXT NOT NULL,
        data_hash TEXT NOT NULL,
        UNIQUE (company_id, data_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_analyst_company_time
        ON analyst_targets (company_id, captured_at DESC);
      CREATE TABLE IF NOT EXISTS research_briefs (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        input_hash TEXT NOT NULL,
        model TEXT NOT NULL,
        content JSONB NOT NULL,
        source_count INTEGER NOT NULL DEFAULT 0,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (company_id, input_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_research_briefs_company_time
        ON research_briefs (company_id, generated_at DESC);
    `).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getStoredCompanyResearch(rawTicker: string): Promise<CompanyResearch | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return null;
  await ensureResearchSchema();

  const companyResult = await pool.query(
    `SELECT id, ticker, name, exchange, quote_type, currency
     FROM companies WHERE ticker = $1`,
    [ticker],
  );
  if (companyResult.rowCount === 0) return null;
  const company = companyResult.rows[0];

  const [priceResult, earningsResult, newsResult, secResult, analystResult] = await Promise.all([
    pool.query(
      `SELECT price, previous_close, market_cap, volume, currency, captured_at
       FROM price_snapshots
       WHERE company_id = $1
       ORDER BY captured_at DESC, id DESC LIMIT 1`,
      [company.id],
    ),
    pool.query(
      `SELECT event_at FROM earnings_events
       WHERE company_id = $1 AND event_at >= now()
       ORDER BY event_at ASC LIMIT 1`,
      [company.id],
    ),
    pool.query(
      `SELECT id, title, publisher, url, published_at
       FROM news_items WHERE company_id = $1
       ORDER BY COALESCE(published_at, discovered_at) DESC
       LIMIT 8`,
      [company.id],
    ),
    pool.query(
      `SELECT id, form_type, to_char(filed_at, 'YYYY-MM-DD') AS filed_at,
              description, url
       FROM sec_events WHERE company_id = $1
       ORDER BY filed_at DESC NULLS LAST, discovered_at DESC
       LIMIT 8`,
      [company.id],
    ),
    pool.query(
      `SELECT target_mean_price, target_high_price, target_low_price,
              recommendation_mean, recommendation_key, analyst_count
       FROM analyst_targets WHERE company_id = $1
       ORDER BY captured_at DESC, id DESC LIMIT 1`,
      [company.id],
    ),
  ]);

  const price = priceResult.rows[0] || null;
  const earnings = earningsResult.rows[0] || null;
  const analyst = analystResult.rows[0] || null;

  return {
    quote: {
      ticker: company.ticker,
      name: company.name || null,
      exchange: company.exchange || null,
      quoteType: company.quote_type || null,
      price: numberOrNull(price?.price),
      previousClose: numberOrNull(price?.previous_close),
      marketCap: numberOrNull(price?.market_cap),
      volume: numberOrNull(price?.volume),
      currency: price?.currency || company.currency || null,
      earningsAt: earnings?.event_at ? new Date(earnings.event_at).toISOString() : null,
    },
    analystView: analyst ? {
      targetMeanPrice: numberOrNull(analyst.target_mean_price),
      targetHighPrice: numberOrNull(analyst.target_high_price),
      targetLowPrice: numberOrNull(analyst.target_low_price),
      recommendationMean: numberOrNull(analyst.recommendation_mean),
      recommendationKey: analyst.recommendation_key || null,
      numberOfAnalystOpinions: numberOrNull(analyst.analyst_count),
    } : null,
    news: newsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      publisher: row.publisher || null,
      url: row.url,
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    })),
    secFilings: secResult.rows.map((row) => ({
      id: row.id,
      form: row.form_type || 'SEC filing',
      filedAt: row.filed_at || '',
      description: row.description || null,
      url: row.url,
    })),
    warnings: [],
    dataOrigin: 'database',
    refreshedAt: price?.captured_at ? new Date(price.captured_at).toISOString() : null,
  };
}

export async function getCompanyResearchDbFirst(rawTicker: string): Promise<CompanyResearch | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return null;

  try {
    const stored = await getStoredCompanyResearch(ticker);
    if (stored) {
      const refreshedAt = stored.refreshedAt ? new Date(stored.refreshedAt).getTime() : 0;
      const needsEnrichment = !stored.analystView || stored.news.length === 0;
      if (needsEnrichment || Date.now() - refreshedAt >= DB_REFRESH_MS) {
        void fetchCompanyResearch(ticker).catch((error) => {
          console.error(`Ettevõtte ${ticker} taustavärskendus ebaõnnestus:`, error);
        });
      }
      return stored;
    }
  } catch (error) {
    console.error(`Ettevõtte ${ticker} DB-cache'i lugemine ebaõnnestus:`, error);
  }

  const live = await fetchCompanyResearch(ticker);
  return live ? { ...live, dataOrigin: 'live', refreshedAt: new Date().toISOString() } : null;
}
