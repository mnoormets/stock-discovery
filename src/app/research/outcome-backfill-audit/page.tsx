import { getOutcomeBackfillAudit } from '../../../lib/outcome-backfill-audit';
import { RunAuditTable, SymbolAuditTable } from './AuditTables';

export const dynamic = 'force-dynamic';

export default async function OutcomeBackfillAuditPage() {
  const audit = await getOutcomeBackfillAudit();
  const { summary } = audit;
  const cards = [
    ['Total Items', summary.totalItems],
    ['Distinct Symbols', summary.distinctSymbols],
    ['Eligible 30D', summary.eligible30dCount],
    ['Eligible 90D', summary.eligible90dCount],
    ['Eligible 180D', summary.eligible180dCount],
    ['Missing Price Data', summary.missingPriceDataCount],
  ];

  return (
    <main className="wrap page outcomeAttributionPage outcomeBackfillAuditPage">
      <header className="pageHeader attributionHeader">
        <div>
          <p className="eyebrow">FORWARD OUTCOME RESEARCH</p>
          <h1>Outcome Backfill Audit</h1>
          <p>Read-only audit of which discovered candidates are eligible for outcome snapshot backfill.</p>
        </div>
      </header>

      <section className="backfillSummaryGrid" aria-label="Outcome backfill audit summary">
        {cards.map(([label, value]) => <article className="card coverageSummaryCard" key={label}>
          <span>{label}</span><strong>{value}</strong>
        </article>)}
      </section>

      <section className="card attributionGuardrail">
        <strong>Audit only — no snapshots are written</strong>
        <p>Age eligibility uses exact 30, 90 and 180 day intervals from each collection item’s observed time. Price readiness uses only stored local `price_snapshots`: {audit.pricePolicy}</p>
        <p>{audit.priceTableAvailable ? 'The local price table exists.' : 'The local price table is unavailable, so every due unmeasured opportunity is reported as missing price data.'} Multiple snapshot horizons are checked independently; existing 1m/3m/6m snapshots map to the 30D/90D/180D audit columns.</p>
      </section>

      <section className="card attributionHighlights">
        <div className="sectionHeading"><div><p className="eyebrow">FACTUAL HIGHLIGHTS</p><h2>Current backfill readiness</h2></div></div>
        {audit.highlights.length
          ? <ul>{audit.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
          : <p className="muted">No collection items exist, so backfill readiness cannot be audited yet.</p>}
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading"><div><h2>Horizon Readiness</h2><p>Counts are item-horizon opportunities; missing price data excludes already measured items.</p></div></div>
        <div className="tableWrap attributionTable backfillAuditTable">
          <table><thead><tr><th>Horizon</th><th>Eligible Items</th><th>Already Measured</th><th>Missing Snapshots</th><th>Too Recent</th><th>Missing Price Data</th></tr></thead>
            <tbody>{audit.horizons.map((horizon) => <tr key={horizon.horizonKey}>
              <td><strong>{horizon.horizonLabel}</strong></td><td>{horizon.eligibleItemCount}</td>
              <td>{horizon.alreadyMeasuredCount}</td><td>{horizon.missingSnapshotCount}</td>
              <td>{horizon.tooRecentCount}</td><td>{horizon.missingPriceDataCount}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading"><div><h2>Symbol Audit</h2><p>One row per distinct ticker; Ready means every due unmeasured item for that symbol has both required local prices for the horizon.</p></div></div>
        <SymbolAuditTable rows={audit.symbols} />
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading"><div><h2>Run Audit</h2><p>Missing snapshot and price counts are summed across due 30D, 90D and 180D opportunities.</p></div></div>
        <RunAuditTable rows={audit.runs} />
      </section>
    </main>
  );
}
