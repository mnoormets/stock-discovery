import { describe, expect, it } from 'vitest';
import {
  buildMetadataCoverageAudit,
  discoverAdditionalMetadataFields,
  type MetadataCoverageSourceItem,
  type MetadataFieldDefinition,
} from '../../src/lib/metadata-coverage-audit';

const NOW = new Date('2026-08-17T08:00:00.000Z');

function field(overrides: Partial<MetadataFieldDefinition> = {}): MetadataFieldDefinition {
  return {
    key: 'sector',
    label: 'Sector',
    source: 'companies.sector',
    kind: 'text',
    schemaAvailable: true,
    autoDiscovered: false,
    ...overrides,
  };
}

function item(itemId: number, values: Record<string, unknown>): MetadataCoverageSourceItem {
  return { itemId, values };
}

describe('Metadata Coverage Audit V1 calculations', () => {
  it('treats null, empty and unknown-like labels as separate missing categories', () => {
    const report = buildMetadataCoverageAudit([
      item(1, { sector: null }),
      item(2, { sector: '  ' }),
      item(3, { sector: 'Unknown' }),
      item(4, { sector: 'N/A' }),
      item(5, { sector: 'Technology' }),
    ], [field()], NOW);
    expect(report.fields[0]).toMatchObject({
      totalItems: 5,
      populatedCount: 1,
      missingCount: 4,
      coveragePct: 20,
      distinctValueCount: 1,
      missingBreakdown: {
        nullCount: 1,
        emptyCount: 1,
        unknownLikeCount: 2,
        schemaUnavailableCount: 0,
      },
    });
  });

  it('counts numeric zero and boolean false as populated values', () => {
    const report = buildMetadataCoverageAudit([
      item(1, { growth_score: 0, 'collection_run_items.market_data_found': false }),
      item(2, { growth_score: 100, 'collection_run_items.market_data_found': true }),
    ], [
      field({ key: 'growth_score', label: 'Growth Score', kind: 'number' }),
      field({
        key: 'collection_run_items.market_data_found',
        label: 'Market Data Found (Collection)',
        source: 'collection_run_items.market_data_found',
        kind: 'boolean',
        autoDiscovered: true,
      }),
    ], NOW);
    expect(report.fields[0]).toMatchObject({ populatedCount: 2, coveragePct: 100, distinctValueCount: 2 });
    expect(report.fields[1].topValues).toEqual([
      { value: 'false', count: 1, percentageOfPopulated: 50 },
      { value: 'true', count: 1, percentageOfPopulated: 50 },
    ]);
  });

  it('calculates deterministic distinct and top-value statistics', () => {
    const report = buildMetadataCoverageAudit([
      item(1, { exchange: 'NYSE' }),
      item(2, { exchange: 'nyse' }),
      item(3, { exchange: 'NasdaqGS' }),
      item(4, { exchange: null }),
    ], [field({ key: 'exchange', label: 'Exchange' })], NOW);
    expect(report.fields[0]).toMatchObject({
      populatedCount: 3,
      missingCount: 1,
      coveragePct: 75,
      distinctValueCount: 2,
    });
    expect(report.fields[0].topValues).toEqual([
      { value: 'NYSE', count: 2, percentageOfPopulated: 66.67 },
      { value: 'NasdaqGS', count: 1, percentageOfPopulated: 33.33 },
    ]);
  });

  it('reports a requested field that is absent from the schema without querying or inventing values', () => {
    const report = buildMetadataCoverageAudit(
      [item(1, {}), item(2, {})],
      [field({
        key: 'country',
        label: 'Country',
        source: 'Not stored in current schema',
        schemaAvailable: false,
      })],
      NOW,
    );
    expect(report.fields[0]).toMatchObject({
      populatedCount: 0,
      missingCount: 2,
      coveragePct: 0,
      schemaAvailable: false,
      missingBreakdown: { schemaUnavailableCount: 2 },
    });
  });

  it('auto-discovers only real, supported schema metadata columns', () => {
    const fields = discoverAdditionalMetadataFields([
      { tableName: 'companies', columnName: 'quote_type', dataType: 'text' },
      { tableName: 'companies', columnName: 'created_at', dataType: 'timestamp with time zone' },
      { tableName: 'collection_run_items', columnName: 'lookup_bucket', dataType: 'text' },
      { tableName: 'collection_run_items', columnName: 'raw_signal', dataType: 'jsonb' },
      { tableName: 'discovery_decisions', columnName: 'catalyst_evidence_status', dataType: 'text' },
      { tableName: 'discovery_decisions', columnName: 'runway_detail', dataType: 'text' },
      { tableName: 'not_a_source', columnName: 'country', dataType: 'text' },
    ]);
    expect(fields.map((entry) => entry.key)).toEqual([
      'collection_run_items.lookup_bucket',
      'companies.quote_type',
      'discovery_decisions.catalyst_evidence_status',
    ]);
    expect(fields.every((entry) => entry.schemaAvailable && entry.autoDiscovered)).toBe(true);
  });

  it('generates factual highlights and a safe empty state', () => {
    const definitions = [
      field(),
      field({ key: 'exchange', label: 'Exchange' }),
      field({ key: 'growth_score', label: 'Growth Score', kind: 'number' }),
      field({ key: 'coverage_score', label: 'Coverage Score', kind: 'number' }),
    ];
    const report = buildMetadataCoverageAudit([
      item(1, { sector: 'Technology', exchange: null, growth_score: 90, coverage_score: 100 }),
      item(2, { sector: null, exchange: 'NYSE', growth_score: null, coverage_score: 80 }),
    ], definitions, NOW);
    expect(report.highlights).toContain('Sector coverage is 50.0% (1/2).');
    expect(report.highlights).toContain('Exchange coverage is 50.0% (1/2).');
    expect(report.highlights).toContain('Growth Score coverage is 50.0% (1/2).');
    expect(report.highlights).toContain('Most complete field: Coverage Score (100.0%).');
    const empty = buildMetadataCoverageAudit([], definitions, NOW);
    expect(empty.summary.totalItems).toBe(0);
    expect(empty.highlights).toEqual([]);
  });
});
