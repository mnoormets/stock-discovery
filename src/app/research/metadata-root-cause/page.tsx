import { getMetadataJoinRootCauseAudit } from '../../../lib/metadata-join-root-cause';
import { FailureBreakdownTable, ItemDiagnosticTable, PipelineFunnelTable } from './RootCauseTables';

export const dynamic = 'force-dynamic';

export default async function MetadataRootCausePage() {
  const audit = await getMetadataJoinRootCauseAudit();
  const { summary } = audit;
  const largestFailures = audit.failures
    .filter((failure) => failure.failureClass !== 'COMPLETE')
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 3);

  return (
    <main className="wrap page outcomeAttributionPage metadataRootCausePage">
      <header className="pageHeader attributionHeader">
        <div>
          <p className="eyebrow">PIPELINE DIAGNOSTIC</p>
          <h1>Metadata Join Root Cause Audit</h1>
          <p>Read-only trace from market-data selection through company identity, metadata, market context, and scoring.</p>
        </div>
      </header>

      <section className="rootCauseSummaryGrid" aria-label="Metadata join summary">
        <article className="card coverageSummaryCard"><span>Total Items</span><strong>{summary.totalItems}</strong><small>collection item rows</small></article>
        <article className="card coverageSummaryCard"><span>Selected</span><strong>{summary.selectedCount}</strong><small>chosen for market-data lookup</small></article>
        <article className="card coverageSummaryCard"><span>Lookup Attempted</span><strong>{summary.matchAttemptedCount}</strong><small>market-data request recorded</small></article>
        <article className="card coverageSummaryCard"><span>Market Data Found</span><strong>{summary.marketDataFoundCount}</strong><small>lookup returned data</small></article>
        <article className="card coverageSummaryCard"><span>Company Identity</span><strong>{summary.companyIdentityCount}</strong><small>company row found by ticker or link</small></article>
        <article className="card coverageSummaryCard"><span>Item Linked</span><strong>{summary.companyMatchedCount}</strong><small>valid company_id + ticker</small></article>
        <article className="card coverageSummaryCard"><span>Exact Decisions</span><strong>{summary.exactDecisionCount}</strong><small>linked by collection item</small></article>
        <article className="card coverageSummaryCard"><span>Complete</span><strong>{summary.completeCount}</strong><small>all required stages reached</small></article>
      </section>

      <section className="card attributionGuardrail">
        <strong>Diagnostic only — no repair or enrichment</strong>
        <p>Selection is diagnostic context: an unselected item without any existing company identity is classified as outside the limited market-data lookup, not as a failed provider match. If an unselected ticker already has a company row, it continues through the join funnel. “Item linked” requires collection_run_items.company_id to point to that same ticker.</p>
        <p>The first-failure class follows the displayed pipeline order. Decision scores and score snapshots are still shown on each item even when an earlier stage failed. Company identity and company metadata are current-state reads; market cap and score snapshot fallbacks are bounded to data available at the item observation time.</p>
      </section>

      <section className="card attributionHighlights">
        <div className="sectionHeading"><div><p className="eyebrow">FACTUAL HIGHLIGHTS</p><h2>Current root causes</h2></div></div>
        {audit.highlights.length
          ? <ul>{audit.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
          : <p className="muted">No collection items exist yet, so root-cause findings are unavailable.</p>}
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Pipeline Funnel</h2><p>Cumulative stages: an item can reach a row only after passing every earlier stage.</p></div>
        </div>
        <PipelineFunnelTable stages={audit.funnel} />
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Failure Breakdown</h2><p>Each item appears exactly once under its first failed stage or Complete.</p></div>
        </div>
        <FailureBreakdownTable failures={audit.failures} />
      </section>

      <section className="rootCauseLargestGrid" aria-label="Largest failure classes">
        {largestFailures.length ? largestFailures.map((failure, index) => <article className="card rootCauseLargestCard" key={failure.failureClass}>
          <span>#{index + 1} FAILURE CLASS</span>
          <strong>{failure.count}</strong>
          <h2>{failure.label}</h2>
          <small>{failure.percentage.toFixed(1)}% of all items · {failure.failureClass}</small>
        </article>) : <article className="card attributionEmpty">No failure classes exist.</article>}
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Item-Level Diagnostic</h2><p>Raw stage flags remain visible even after the first failure, including exact decisions and observation-time score snapshots.</p></div>
          <small>{summary.decisionScoresWithoutCompanyLinkCount} items scored despite an invalid or absent item-company link</small>
        </div>
        <ItemDiagnosticTable items={audit.items} />
      </section>
    </main>
  );
}
