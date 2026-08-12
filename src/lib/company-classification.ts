import { pool } from './db';
import { fetchCompanyClassification } from './company-data';
import { ENRICHMENT_DELAY_MS } from './company-financials';

// Piiratud sector/industry enrichment collectori teel. Praegu tekivad
// companies.sector/industry ainult company detaili avamisel (write-on-read);
// see funktsioon populeerib need automaatselt kogu aktiivsele universumile,
// kasutades sama Yahoo assetProfile allikat (uut võtit ega provider'it ei lisata)
// ja sama universumi-filtrit nagu SEC enrichment. Idempotentne: klassifitseerib
// ainult read, kus sector VÕI industry on NULL; ebaõnnestumine kordub järgmisel
// jooksul. Kirjutab AINULT klassifikatsiooniveerge — ei puuduta teese,
// positsioone, watchlisti ega muid andmeid.

export const DAILY_CLASSIFICATION_ENRICHMENT_LIMIT = 5;

export interface ClassificationEnrichmentResult {
  attempted: number;
  enriched: number;      // sai vähemalt sektori või tööstusharu
  unavailable: number;   // assetProfile ei andnud sektorit ega tööstusharu
  failed: number;        // päring viskas vea
  remaining: number;     // veel klassifitseerimata (pärast jooksu)
  attemptedTickers: string[];
  enrichedTickers: string[];
  unavailableTickers: string[];
  failedTickers: string[];
}

let classificationSchemaPromise: Promise<void> | null = null;

function ensureClassificationColumns(): Promise<void> {
  if (!classificationSchemaPromise) {
    classificationSchemaPromise = pool.query(`
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_source TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;
    `).then(() => undefined).catch((error) => {
      classificationSchemaPromise = null;
      throw error;
    });
  }
  return classificationSchemaPromise;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Sama universumi-filter nagu SEC enrichment: aktiivne (viimase 30 päeva
// hinnasnapshot), välja arvatud SPY ja ETF-id.
const UNIVERSE_FILTER = `
  c.ticker <> 'SPY'
  AND c.quote_type IS DISTINCT FROM 'ETF'
  AND (c.sector IS NULL OR c.industry IS NULL)
  AND prices.latest_price_at >= now() - interval '30 days'`;

async function classificationQueue(limit: number): Promise<Array<{ companyId: number; ticker: string }>> {
  const result = await pool.query(
    `SELECT c.id AS company_id, c.ticker
     FROM companies c
     JOIN LATERAL (
       SELECT max(p.captured_at) AS latest_price_at
       FROM price_snapshots p WHERE p.company_id = c.id
     ) prices ON true
     WHERE ${UNIVERSE_FILTER}
     ORDER BY prices.latest_price_at DESC NULLS LAST, c.ticker
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({ companyId: Number(row.company_id), ticker: String(row.ticker) }));
}

async function remainingUnclassified(): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS n
     FROM companies c
     JOIN LATERAL (
       SELECT max(p.captured_at) AS latest_price_at
       FROM price_snapshots p WHERE p.company_id = c.id
     ) prices ON true
     WHERE ${UNIVERSE_FILTER}`,
  );
  return Number(result.rows[0]?.n || 0);
}

export async function enrichCompanyClassifications(
  limit = DAILY_CLASSIFICATION_ENRICHMENT_LIMIT,
): Promise<ClassificationEnrichmentResult> {
  await ensureClassificationColumns();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit) || DAILY_CLASSIFICATION_ENRICHMENT_LIMIT));
  const queue = await classificationQueue(safeLimit);
  const attemptedTickers: string[] = [];
  const enrichedTickers: string[] = [];
  const unavailableTickers: string[] = [];
  const failedTickers: string[] = [];

  for (const [index, item] of queue.entries()) {
    attemptedTickers.push(item.ticker);
    try {
      const classification = await fetchCompanyClassification(item.ticker);
      if (classification && (classification.sector || classification.industry)) {
        await pool.query(
          `UPDATE companies
           SET sector = COALESCE($2, sector),
               industry = COALESCE($3, industry),
               classification_source = $4,
               classification_updated_at = now(),
               updated_at = now()
           WHERE id = $1`,
          [item.companyId, classification.sector, classification.industry, classification.source],
        );
        enrichedTickers.push(item.ticker);
      } else {
        unavailableTickers.push(item.ticker);
      }
    } catch (error) {
      failedTickers.push(item.ticker);
      console.error(`Ettevõtte ${item.ticker} sector/industry klassifikatsioon ebaõnnestus:`, (error as Error).message);
    }
    if (index < queue.length - 1) await wait(ENRICHMENT_DELAY_MS);
  }

  const remaining = await remainingUnclassified();
  return {
    attempted: attemptedTickers.length,
    enriched: enrichedTickers.length,
    unavailable: unavailableTickers.length,
    failed: failedTickers.length,
    remaining,
    attemptedTickers,
    enrichedTickers,
    unavailableTickers,
    failedTickers,
  };
}
