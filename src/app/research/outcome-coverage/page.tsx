import { getOutcomeCoverage } from '../../../lib/outcome-coverage';
import { AgeCoverageTable, RunCoverageTable } from './CoverageTables';

export const dynamic = 'force-dynamic';

function formatCoverage(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

export default async function OutcomeCoveragePage() {
  const report = await getOutcomeCoverage();
  const { summary } = report;

  return (
    <main className="wrap page outcomeAttributionPage outcomeCoveragePage">
      <header className="pageHeader attributionHeader">
        <div>
          <p className="eyebrow">FORWARD OUTCOME RESEARCH</p>
          <h1>Outcome Coverage V1</h1>
          <p>How much collected discovery history has an immutable measured outcome?</p>
        </div>
      </header>

      <section className="coverageSummaryGrid" aria-label="Outcome coverage summary">
        <article className="card coverageSummaryCard"><span>Total Candidates</span><strong>{summary.totalCandidates}</strong><small>collection item rows</small></article>
        <article className="card coverageSummaryCard"><span>Measured Outcomes</span><strong>{summary.measuredCandidates}</strong><small>distinct measured symbols</small></article>
        <article className="card coverageSummaryCard"><span>Missing Outcomes</span><strong>{summary.missingOutcomes}</strong><small>total rows minus measured symbols</small></article>
        <article className="card coverageSummaryCard"><span>Coverage</span><strong>{formatCoverage(summary.coveragePct)}</strong><small>distinct symbols / item rows</small></article>
      </section>

      <section className="card attributionGuardrail">
        <strong>Coverage, not performance</strong>
        <p>The headline follows the V1 definition exactly: distinct symbols with a linked immutable outcome snapshot divided by all collection item rows. Repeated symbols therefore remain repeated in the denominator.</p>
        <p>Run and age tables use item-level measured counts so each row has a comparable numerator and denominator. An item is measured when at least one current-version outcome snapshot links to that exact collection item; multiple horizons do not count it twice.</p>
      </section>

      <section className="card attributionHighlights">
        <div className="sectionHeading"><div><p className="eyebrow">FACTUAL HIGHLIGHTS</p><h2>Current tracking state</h2></div></div>
        {report.highlights.length
          ? <ul>{report.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
          : <p className="muted">No collection candidates exist yet, so coverage highlights are unavailable.</p>}
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Coverage by Run</h2><p>Each collection item is measured once when any linked outcome horizon has produced an immutable snapshot.</p></div>
        </div>
        <RunCoverageTable rows={report.byRun} />
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Coverage by Age Bucket</h2><p>Age is based on the collection item observation time. Exact day 180 belongs to 91–180; 180+ means older than 180 days.</p></div>
        </div>
        <AgeCoverageTable rows={report.byAgeBucket} />
      </section>
    </main>
  );
}
