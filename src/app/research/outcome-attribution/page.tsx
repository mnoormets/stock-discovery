import AttributionTable from './AttributionTable';
import { getOutcomeAttribution } from '../../../lib/outcome-attribution';

export const dynamic = 'force-dynamic';

export default async function OutcomeAttributionPage() {
  const report = await getOutcomeAttribution();

  return (
    <main className="wrap page outcomeAttributionPage">
      <header className="pageHeader attributionHeader">
        <div>
          <p className="eyebrow">FORWARD OUTCOME RESEARCH</p>
          <h1>Outcome Attribution V1</h1>
          <p>Which stored discovery signals are associated with better measured outcomes?</p>
        </div>
        <div className="attributionSampleCard">
          <span>Measured sample</span>
          <strong>{report.sampleCount}</strong>
          <small>{report.sampleUnit}{report.sampleCount === 1 ? '' : 's'}</small>
        </div>
      </header>

      <section className="card attributionGuardrail">
        <strong>Association, not prediction</strong>
        <p>Returns come only from immutable canonical outcome-analysis snapshots. Each row is one measured candidate-horizon observation, so the same candidate may appear at different horizons.</p>
        <p>Win = return above 10%. Loss = return below 0%. Buckets with fewer than {report.minHighlightSample} observations are marked low sample and excluded from automatic highlights.</p>
      </section>

      <section className="card attributionHighlights">
        <div className="sectionHeading">
          <div><p className="eyebrow">AUTOMATIC HIGHLIGHTS</p><h2>What the measured sample says</h2></div>
        </div>
        {report.highlights.length ? (
          <ul>{report.highlights.map((highlight) => <li key={highlight.kind}>{highlight.text}</li>)}</ul>
        ) : (
          <p className="muted">No automatic highlights yet. No populated bucket has at least {report.minHighlightSample} measured observations.</p>
        )}
      </section>

      <div className="attributionSections">
        {report.sections.map((section) => (
          <section className="card attributionSection" key={section.key}>
            <div className="sectionHeading attributionSectionHeading">
              <div><h2>{section.title}</h2><p>{section.includedSampleCount} included · {section.missingSignalCount} missing signal</p></div>
              {section.key === 'market_cap' && <small>Nano &lt;$50M · Micro $50–300M · Small $300M–2B · Mid $2–10B · Large ≥$10B</small>}
            </div>
            <AttributionTable section={section} minHighlightSample={report.minHighlightSample} />
          </section>
        ))}
      </div>
    </main>
  );
}
