import { getDiscoveryQualityAudit } from '../../../lib/discovery-quality-audit';
import { DistributionTable, DuplicateAuditTable, ScoreDistributionTable } from './QualityTables';

export const dynamic = 'force-dynamic';

const MARKET_CAP_ORDER = ['nano', 'micro', 'small', 'mid', 'large', 'Unknown'] as const;

function formatCoverage(known: number, total: number): string {
  return total ? `${((known / total) * 100).toFixed(1)}%` : '—';
}

export default async function DiscoveryQualityPage() {
  const audit = await getDiscoveryQualityAudit();
  const { overview } = audit;
  const sector = audit.distributions.find((row) => row.key === 'sector')!;
  const marketCap = audit.distributions.find((row) => row.key === 'market_cap')!;
  const country = audit.distributions.find((row) => row.key === 'country')!;
  const exchange = audit.distributions.find((row) => row.key === 'exchange')!;
  const scoredItems = Math.max(0, ...audit.scores.filter((score) => score.available).map((score) => score.availableCount));

  return (
    <main className="wrap page outcomeAttributionPage discoveryQualityPage">
      <header className="pageHeader attributionHeader">
        <div>
          <p className="eyebrow">COLLECTION RESEARCH</p>
          <h1>Discovery Quality Audit</h1>
          <p>Read-only audit of what the collection pipeline is actually discovering.</p>
        </div>
      </header>

      <section className="qualityOverviewGrid" aria-label="Discovery quality overview">
        <article className="card coverageSummaryCard"><span>Total Items</span><strong>{overview.totalItems}</strong><small>collection item rows</small></article>
        <article className="card coverageSummaryCard"><span>Distinct Symbols</span><strong>{overview.distinctSymbols}</strong><small>unique normalized tickers</small></article>
        <article className="card coverageSummaryCard"><span>Collection Runs</span><strong>{overview.collectionRuns}</strong><small>represented in this audit</small></article>
        <article className="card coverageSummaryCard"><span>Repeated Symbols</span><strong>{overview.repeatedSymbols}</strong><small>{overview.oneTimeSymbols} appeared once</small></article>
        <article className="card coverageSummaryCard"><span>Sector Coverage</span><strong>{formatCoverage(overview.knownSectorItems, overview.totalItems)}</strong><small>{overview.knownSectorItems} classified items</small></article>
        <article className="card coverageSummaryCard"><span>Scored Items</span><strong>{scoredItems}</strong><small>linked immutable decisions</small></article>
      </section>

      <section className="card attributionGuardrail">
        <strong>Composition, not investment quality</strong>
        <p>Every percentage uses a collection item row as the observation unit, so repeated symbols remain repeated. Scores come only from immutable decisions linked to that exact collection item; no current score is substituted.</p>
        <p>Sector uses the linked decision value when present, otherwise the company&apos;s currently stored classification. Market cap uses the linked decision value, otherwise the latest local price snapshot available at observation time. Exchange is current stored company metadata.</p>
      </section>

      <section className="card attributionHighlights">
        <div className="sectionHeading"><div><p className="eyebrow">FACTUAL HIGHLIGHTS</p><h2>Current collection composition</h2></div></div>
        {audit.highlights.length
          ? <ul>{audit.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
          : <p className="muted">No collection items exist yet, so composition highlights are unavailable.</p>}
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Sector Mix</h2><p>Unknown rows stay visible and remain in the percentage denominator.</p></div>
          <small>{sector.knownCount} known · {sector.missingCount} unknown · top-three share {audit.concentration.topThreeSectorSharePct?.toFixed(1) ?? '—'}%</small>
        </div>
        <DistributionTable distribution={sector} />
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Market Cap Mix</h2><p>Nano &lt;$50M, micro &lt;$300M, small &lt;$2B, mid &lt;$10B, large $10B+.</p></div>
          <small>{marketCap.knownCount} known · {marketCap.missingCount} unknown</small>
        </div>
        <DistributionTable distribution={marketCap} preferredOrder={MARKET_CAP_ORDER} />
      </section>

      <section className="qualityMetadataGrid">
        <article className="card attributionSection">
          <div className="sectionHeading attributionSectionHeading"><div><h2>Country Mix</h2><p>Shown only when a real local country field exists.</p></div></div>
          <DistributionTable distribution={country} />
        </article>
        <article className="card attributionSection">
          <div className="sectionHeading attributionSectionHeading"><div><h2>Exchange Mix</h2><p>Based on existing company metadata; unknown values remain explicit.</p></div></div>
          <DistributionTable distribution={exchange} />
        </article>
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Duplicate Discovery Audit</h2><p>Frequent rediscovery can reveal stable pipeline focus or collection concentration; it does not imply better performance.</p></div>
          <small>Repeat appearance share {audit.concentration.repeatAppearanceSharePct.toFixed(1)}%</small>
        </div>
        <DuplicateAuditTable rows={audit.duplicates} />
      </section>

      <section className="attributionSections" aria-labelledby="score-distribution-heading">
        <div className="sectionHeading"><div><p className="eyebrow">IMMUTABLE DECISION DATA</p><h2 id="score-distribution-heading">Score Distribution</h2><p>Bucket shares use only linked, available values for that score.</p></div></div>
        {audit.scores.map((score) => <article className="card attributionSection" key={score.key}>
          <div className="sectionHeading attributionSectionHeading">
            <div><h2>{score.title}</h2><p>{score.availableCount} scored · {score.missingCount} missing</p></div>
            {score.available && score.above80Percentage != null ? <small>{score.above80Count} candidates above 80 ({score.above80Percentage.toFixed(1)}%)</small> : null}
          </div>
          <ScoreDistributionTable score={score} />
        </article>)}
      </section>
    </main>
  );
}
