import { pool } from './db';
import { getAllStoredCompanyFinancials } from './company-financials';
import { calculateCompanyScores } from './company-scores';
import { saveCompanyScoreSnapshots } from './score-tracking';

export interface ScannerMover {
  ticker: string;
  name: string | null;
  price: number;
  previousPrice: number;
  changePercent: number;
  currency: string | null;
  capturedAt: string;
}

export interface ScannerEarnings {
  id: number;
  ticker: string;
  name: string | null;
  eventAt: string;
}

export interface ScannerSecEvent {
  id: string;
  ticker: string;
  name: string | null;
  form: string;
  filedAt: string | null;
  description: string | null;
  url: string;
}

export interface ScannerNewsItem {
  id: string;
  ticker: string;
  name: string | null;
  title: string;
  publisher: string | null;
  url: string;
  publishedAt: string | null;
}

export type ScannerScoreSort = 'growth' | 'health' | 'coverage';

export interface ScannerScoreRow {
  ticker: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  growthScore: number | null;
  growthCoverage: number;
  healthScore: number | null;
  healthCoverage: number;
  coverageScore: number;
}

export interface ScannerData {
  gainers: ScannerMover[];
  losers: ScannerMover[];
  earnings: ScannerEarnings[];
  secEvents: ScannerSecEvent[];
  news: ScannerNewsItem[];
  scoreRows: ScannerScoreRow[];
  scoreSort: ScannerScoreSort;
}

export async function getScannerData(scoreSort: ScannerScoreSort = 'growth'): Promise<ScannerData> {
  const [moversResult, earningsResult, secResult, newsResult, financials, pricesResult] = await Promise.all([
    pool.query(`
      WITH ranked AS (
        SELECT
          c.id AS company_id,
          c.ticker,
          c.name,
          p.price,
          p.currency,
          p.captured_at,
          row_number() OVER (
            PARTITION BY c.id ORDER BY p.captured_at DESC, p.id DESC
          ) AS snapshot_rank
        FROM companies c
        JOIN price_snapshots p ON p.company_id = c.id
        WHERE p.price IS NOT NULL
      )
      SELECT
        latest.ticker,
        latest.name,
        latest.price,
        previous.price AS previous_price,
        ((latest.price - previous.price) / previous.price) * 100 AS change_percent,
        latest.currency,
        latest.captured_at
      FROM ranked latest
      JOIN ranked previous
        ON previous.company_id = latest.company_id AND previous.snapshot_rank = 2
      WHERE latest.snapshot_rank = 1
        AND previous.price <> 0
        AND (latest.captured_at AT TIME ZONE 'Europe/Tallinn')::date =
            (now() AT TIME ZONE 'Europe/Tallinn')::date
      ORDER BY change_percent DESC
    `),
    pool.query(`
      SELECT e.id, c.ticker, c.name, e.event_at
      FROM earnings_events e
      JOIN companies c ON c.id = e.company_id
      WHERE e.event_at >= now() AND e.event_at <= now() + interval '14 days'
      ORDER BY e.event_at ASC
      LIMIT 20
    `),
    pool.query(`
      SELECT s.id, c.ticker, c.name, s.form_type,
             to_char(s.filed_at, 'YYYY-MM-DD') AS filed_at,
             s.description, s.url
      FROM sec_events s
      JOIN companies c ON c.id = s.company_id
      ORDER BY s.discovered_at DESC, s.filed_at DESC NULLS LAST
      LIMIT 15
    `),
    pool.query(`
      SELECT n.id, c.ticker, c.name, n.title, n.publisher, n.url,
             n.published_at
      FROM news_items n
      JOIN companies c ON c.id = n.company_id
      ORDER BY COALESCE(n.published_at, n.discovered_at) DESC, n.discovered_at DESC
      LIMIT 15
    `),
    getAllStoredCompanyFinancials(),
    pool.query(`
      SELECT DISTINCT ON (c.id) c.ticker, p.price, p.currency
      FROM companies c
      JOIN price_snapshots p ON p.company_id = c.id
      WHERE p.price IS NOT NULL
      ORDER BY c.id, p.captured_at DESC, p.id DESC
    `),
  ]);

  const movers: ScannerMover[] = moversResult.rows.map((row) => ({
    ticker: row.ticker,
    name: row.name || null,
    price: Number(row.price),
    previousPrice: Number(row.previous_price),
    changePercent: Number(row.change_percent),
    currency: row.currency || null,
    capturedAt: new Date(row.captured_at).toISOString(),
  }));

  const latestPrices = new Map(pricesResult.rows.map((row) => [row.ticker, row]));
  void saveCompanyScoreSnapshots(financials).catch((error) => {
    console.error('Scanneri skoorisnapshotide salvestamine ebaõnnestus:', error);
  });
  const scoreRows: ScannerScoreRow[] = financials.map((financial) => {
    const scores = calculateCompanyScores(financial);
    const latestPrice = latestPrices.get(financial.ticker);
    return {
      ticker: financial.ticker,
      name: financial.companyName,
      price: latestPrice?.price == null ? null : Number(latestPrice.price),
      currency: latestPrice?.currency || null,
      growthScore: scores.growth?.score ?? null,
      growthCoverage: scores.growth?.coveragePercent ?? 0,
      healthScore: scores.financialHealth?.score ?? null,
      healthCoverage: scores.financialHealth?.coveragePercent ?? 0,
      coverageScore: scores.coverage.score,
    };
  }).filter((row) => row.growthScore != null || row.healthScore != null);
  scoreRows.sort((a, b) => {
    if (scoreSort !== 'coverage') {
      const reliableA = a.coverageScore >= 70 ? 1 : 0;
      const reliableB = b.coverageScore >= 70 ? 1 : 0;
      if (reliableA !== reliableB) return reliableB - reliableA;
    }
    const primaryA = scoreSort === 'health' ? a.healthScore : scoreSort === 'coverage' ? a.coverageScore : a.growthScore;
    const primaryB = scoreSort === 'health' ? b.healthScore : scoreSort === 'coverage' ? b.coverageScore : b.growthScore;
    if (primaryA == null && primaryB == null) return a.ticker.localeCompare(b.ticker);
    if (primaryA == null) return 1;
    if (primaryB == null) return -1;
    if (primaryB !== primaryA) return primaryB - primaryA;
    const secondaryA = scoreSort === 'health' ? a.growthScore : a.healthScore;
    const secondaryB = scoreSort === 'health' ? b.growthScore : b.healthScore;
    return (secondaryB ?? -1) - (secondaryA ?? -1) || a.ticker.localeCompare(b.ticker);
  });

  return {
    gainers: movers.filter((row) => row.changePercent > 0).slice(0, 10),
    losers: movers.filter((row) => row.changePercent < 0).slice(-10).reverse(),
    earnings: earningsResult.rows.map((row) => ({
      id: Number(row.id),
      ticker: row.ticker,
      name: row.name || null,
      eventAt: new Date(row.event_at).toISOString(),
    })),
    secEvents: secResult.rows.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      name: row.name || null,
      form: row.form_type || 'SEC filing',
      filedAt: row.filed_at || null,
      description: row.description || null,
      url: row.url,
    })),
    news: newsResult.rows.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      name: row.name || null,
      title: row.title,
      publisher: row.publisher || null,
      url: row.url,
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    })),
    scoreRows,
    scoreSort,
  };
}
