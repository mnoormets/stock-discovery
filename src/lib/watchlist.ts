import { getAllStoredCompanyFinancials } from './company-financials';
import { calculateCompanyScores } from './company-scores';
import { getLatestPortfolioPrices, listPositions } from './portfolio';
import { saveCompanyScoreSnapshots } from './score-tracking';
import { evaluateScoreChanges, type ScoreReview } from './score-alerts';

export type WatchlistSort = 'growth' | 'health' | 'coverage';

export interface WatchlistRow {
  positionId: number | null;
  ticker: string;
  name: string | null;
  price: number | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  signal: string;
  warning: string | null;
  scoreReview: ScoreReview | null;
}

export interface WatchlistData {
  watched: WatchlistRow[];
  ideas: WatchlistRow[];
  sort: WatchlistSort;
}

function describe(growth: number | null, health: number | null, coverage: number): { signal: string; warning: string | null } {
  let signal = 'Vajab lähemat uurimist';
  if (growth != null && growth >= 70 && health != null && health >= 65) signal = 'Kasv ja finantstervis mõlemad tugevad';
  else if (growth != null && growth >= 70) signal = 'Tugev kasvusignaal';
  else if (health != null && health >= 70) signal = 'Tugev finantstervise signaal';
  const warnings: string[] = [];
  if (coverage < 70) warnings.push('andmekate on osaline');
  if (health != null && health < 40) warnings.push('finantstervis on nõrk');
  return { signal, warning: warnings.length ? warnings.join(' · ') : null };
}

export async function getWatchlistData(sort: WatchlistSort = 'growth'): Promise<WatchlistData> {
  const [financials, positions] = await Promise.all([getAllStoredCompanyFinancials(), listPositions()]);
  await saveCompanyScoreSnapshots(financials).catch((error) => console.error('Watchlisti skoorisnapshotide salvestamine ebaõnnestus:', error));
  const watchedPositions = positions.filter((position) => position.status === 'watch');
  const scoreReviews = await evaluateScoreChanges(watchedPositions.map((position) => position.id))
    .catch((error) => {
      console.error('Watchlisti score-muutuste hindamine ebaõnnestus:', error);
      return new Map<number, ScoreReview>();
    });
  const prices = await getLatestPortfolioPrices([...new Set([
    ...financials.map((financial) => financial.ticker),
    ...positions.map((position) => position.ticker),
  ])]);
  const financialByTicker = new Map(financials.map((financial) => [financial.ticker, financial]));
  const openTickers = new Set(positions.filter((position) => position.status !== 'closed').map((position) => position.ticker));

  const toRow = (ticker: string, positionId: number | null): WatchlistRow => {
    const financial = financialByTicker.get(ticker) || null;
    const scores = calculateCompanyScores(financial);
    const description = describe(scores.growth?.score ?? null, scores.financialHealth?.score ?? null, scores.coverage.score);
    return {
      positionId,
      ticker,
      name: financial?.companyName || null,
      price: prices.get(ticker)?.price ?? null,
      growthScore: scores.growth?.score ?? null,
      healthScore: scores.financialHealth?.score ?? null,
      coverageScore: scores.coverage.score,
      scoreReview: positionId == null ? null : scoreReviews.get(positionId) || null,
      ...description,
    };
  };

  const watched = watchedPositions.map((position) => toRow(position.ticker, position.id));
  const ideas = financials
    .filter((financial) => !openTickers.has(financial.ticker))
    .map((financial) => toRow(financial.ticker, null))
    .filter((row) => row.growthScore != null || row.healthScore != null);
  const scoreValue = (row: WatchlistRow) => sort === 'health' ? row.healthScore : sort === 'coverage' ? row.coverageScore : row.growthScore;
  ideas.sort((a, b) => {
    if (sort !== 'coverage') {
      const reliableA = a.coverageScore >= 70 ? 1 : 0;
      const reliableB = b.coverageScore >= 70 ? 1 : 0;
      if (reliableA !== reliableB) return reliableB - reliableA;
    }
    return (scoreValue(b) ?? -1) - (scoreValue(a) ?? -1) || b.coverageScore - a.coverageScore || a.ticker.localeCompare(b.ticker);
  });
  return { watched, ideas: ideas.slice(0, 50), sort };
}
