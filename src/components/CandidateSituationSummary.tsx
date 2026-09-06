import {
  derivePaperBusinessState,
  derivePaperMarketSetupState,
} from '@/lib/paper-strategy';
import type { CandidatePriceContext } from '@/lib/price-context';
import { priceObservationRecency } from '@/lib/price-observation';

interface CandidateSituationSummaryProps {
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  priceContext: CandidatePriceContext;
  priceCapturedAt: string | null;
}

function score(value: number | null): string {
  return value == null ? 'unknown' : `${value}/100`;
}

export default function CandidateSituationSummary({
  growthScore,
  healthScore,
  coverageScore,
  priceContext,
  priceCapturedAt,
}: CandidateSituationSummaryProps) {
  const business = derivePaperBusinessState({ growthScore, healthScore, coverageScore });
  const recency = priceObservationRecency(priceCapturedAt, priceContext.asOf);
  const market = recency === 'recent' && priceContext.currentPrice != null
    ? derivePaperMarketSetupState(priceContext) : 'unknown';
  const partial = market === 'not_overheated' && priceContext.historyStatus === 'partial';
  const windows = [
    priceContext.oneMonthReturnPercent == null ? null : '1 month',
    priceContext.threeMonthReturnPercent == null ? null : '3 months',
    priceContext.sixMonthReturnPercent == null ? null : '6 months',
  ].filter(Boolean).join(', ');
  const marketDetail = recency === 'stale'
    ? 'Stored price is stale; current run-up cannot be assessed.'
    : recency === 'unknown' || priceContext.currentPrice == null
      ? 'A valid price and observation time are required; the setup is not inferred.'
      : market === 'overheated'
    ? priceContext.recentRunUpReasons.join(' · ')
    : market === 'unknown'
      ? 'Stored price history is insufficient; the setup is not inferred.'
      : `No elevated run-up in observed windows. Assessed windows: ${windows || 'none'}.${partial ? ' Other windows remain unknown.' : ''}`;
  const observedLabel = priceCapturedAt && Number.isFinite(new Date(priceCapturedAt).getTime())
    ? new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Tallinn', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(priceCapturedAt)) : 'Unknown';

  return <section className="todaySituationSummary" aria-label="Business and market situation">
    <div className="todaySituationAxis">
      <span>Business</span>
      <strong className={business === 'strong' ? 'positive' : 'negative'}>
        {business === 'strong' ? 'Strong' : 'Mixed'}
      </strong>
      <small>Growth {score(growthScore)} · Health {score(healthScore)} · Coverage {score(coverageScore)}</small>
    </div>
    <div className="todaySituationAxis">
      <span>Market setup</span>
      <strong className={market === 'not_overheated' && !partial ? 'positive' : market === 'overheated' ? 'negative' : 'scoreNeutral'}>
        {recency !== 'recent' ? 'Current setup unknown' : partial ? 'Partial history' : market === 'not_overheated' ? 'Not overheated' : market === 'overheated' ? 'Run-up elevated' : 'Unknown'}
      </strong>
      <small>{marketDetail}</small>
      <small>Price observed: {observedLabel} (Tallinn). Recency allows one New York weekday; holidays are not inferred. This is observation time, not a live execution quote.</small>
    </div>
    <p>Independent research checks, not a buy signal. Open the evidence below before acting.</p>
  </section>;
}
