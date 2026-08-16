import { getMetadataCoverageAudit } from '../../../lib/metadata-coverage-audit';
import { FieldCoverageTable, MissingBreakdownTable, TopValuesTable } from './MetadataCoverageTables';

export const dynamic = 'force-dynamic';

function formatPercentage(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

export default async function MetadataCoveragePage() {
  const audit = await getMetadataCoverageAudit();
  const { summary } = audit;

  return (
    <main className="wrap page outcomeAttributionPage metadataCoveragePage">
      <header className="pageHeader attributionHeader">
        <div>
          <p className="eyebrow">COLLECTION DATA READINESS</p>
          <h1>Metadata Coverage Audit</h1>
          <p>Read-only inventory of which discovery metadata fields are populated, missing, or not stored.</p>
        </div>
      </header>

      <section className="metadataSummaryGrid" aria-label="Metadata coverage summary">
        <article className="card coverageSummaryCard"><span>Total Items</span><strong>{summary.totalItems}</strong><small>collection item rows</small></article>
        <article className="card coverageSummaryCard"><span>Fields Audited</span><strong>{summary.schemaAvailableFields + summary.schemaUnavailableFields}</strong><small>{summary.requestedFields} requested + {summary.autoDiscoveredFields} discovered</small></article>
        <article className="card coverageSummaryCard"><span>Fully Covered</span><strong>{summary.fullyPopulatedFields}</strong><small>stored fields at 100%</small></article>
        <article className="card coverageSummaryCard"><span>Partially Covered</span><strong>{summary.partiallyPopulatedFields}</strong><small>some values present</small></article>
        <article className="card coverageSummaryCard"><span>Schema Gaps</span><strong>{summary.schemaUnavailableFields}</strong><small>requested fields not stored</small></article>
        <article className="card coverageSummaryCard"><span>Average Coverage</span><strong>{formatPercentage(summary.averageCoveragePct)}</strong><small>stored fields only</small></article>
      </section>

      <section className="card attributionGuardrail">
        <strong>Storage coverage, not data correctness</strong>
        <p>Every denominator is a collection item row. A value is missing when it is SQL NULL, empty, or an explicit unknown-like label such as Unknown or N/A. Numeric zero and boolean false remain real populated values.</p>
        <p>Requested fields are schema-checked before SQL is built. Additional fields appear only when they are discovered in the current collection, company, or linked decision schema. This page does not enrich or repair any value.</p>
      </section>

      <section className="card attributionHighlights">
        <div className="sectionHeading"><div><p className="eyebrow">FACTUAL HIGHLIGHTS</p><h2>Coverage Summary</h2></div></div>
        {audit.highlights.length
          ? <ul>{audit.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
          : <p className="muted">No collection items exist yet, so metadata coverage highlights are unavailable.</p>}
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Field Coverage</h2><p>Core requested fields and schema-discovered metadata in one sortable inventory.</p></div>
          <small>{summary.schemaAvailableFields} stored · {summary.schemaUnavailableFields} not stored · {summary.emptyFields} stored but empty</small>
        </div>
        <FieldCoverageTable fields={audit.fields} />
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Top Values</h2><p>Up to five most frequent populated values per field; percentages use that field&apos;s populated rows.</p></div>
        </div>
        <TopValuesTable fields={audit.fields} />
      </section>

      <section className="card attributionSection">
        <div className="sectionHeading attributionSectionHeading">
          <div><h2>Unknown / Missing Breakdown</h2><p>Separates absent data from empty labels, explicit unknowns, and fields that do not exist in the schema.</p></div>
        </div>
        <MissingBreakdownTable fields={audit.fields} />
      </section>
    </main>
  );
}
