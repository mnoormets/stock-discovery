import { pool } from './db';

export type MetadataValueKind = 'text' | 'number' | 'boolean' | 'date';

export interface MetadataSchemaColumn {
  tableName: string;
  columnName: string;
  dataType: string;
}

export interface MetadataFieldDefinition {
  key: string;
  label: string;
  source: string;
  kind: MetadataValueKind;
  schemaAvailable: boolean;
  autoDiscovered: boolean;
}

export interface MetadataCoverageSourceItem {
  itemId: number;
  values: Record<string, unknown>;
}

export interface MetadataTopValue {
  value: string;
  count: number;
  percentageOfPopulated: number;
}

export interface MetadataMissingBreakdown {
  nullCount: number;
  emptyCount: number;
  unknownLikeCount: number;
  schemaUnavailableCount: number;
}

export interface MetadataFieldCoverage {
  key: string;
  label: string;
  source: string;
  kind: MetadataValueKind;
  schemaAvailable: boolean;
  autoDiscovered: boolean;
  totalItems: number;
  populatedCount: number;
  missingCount: number;
  coveragePct: number;
  distinctValueCount: number;
  topValues: MetadataTopValue[];
  missingBreakdown: MetadataMissingBreakdown;
}

export interface MetadataCoverageSummary {
  totalItems: number;
  requestedFields: number;
  autoDiscoveredFields: number;
  schemaAvailableFields: number;
  schemaUnavailableFields: number;
  fullyPopulatedFields: number;
  partiallyPopulatedFields: number;
  emptyFields: number;
  averageCoveragePct: number | null;
}

export interface MetadataCoverageAudit {
  generatedAt: string;
  sampleUnit: string;
  summary: MetadataCoverageSummary;
  fields: MetadataFieldCoverage[];
  highlights: string[];
}

type TableName = 'collection_run_items' | 'companies' | 'discovery_decisions' | 'price_snapshots';

interface FieldPlan extends MetadataFieldDefinition {
  expression: string;
}

const UNKNOWN_LIKE_VALUES = new Set(['unknown', 'n/a', 'na', 'null', 'none', 'not available']);
const CORE_FIELD_COUNT = 9;
const TABLE_ALIASES: Record<TableName, string> = {
  collection_run_items: 'i',
  companies: 'c',
  discovery_decisions: 'd',
  price_snapshots: 'price',
};

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentage(part: number, total: number): number {
  return total > 0 ? roundPercentage((part / total) * 100) : 0;
}

function humanize(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.length <= 3 && ['id', 'cik', 'url'].includes(part.toLowerCase())
      ? part.toUpperCase()
      : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function valueKind(dataType: string): MetadataValueKind {
  if (dataType === 'boolean') return 'boolean';
  if (['smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision'].includes(dataType)) return 'number';
  if (dataType === 'date' || dataType.includes('timestamp')) return 'date';
  return 'text';
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}

function catalog(columns: MetadataSchemaColumn[]): Map<string, Map<string, MetadataSchemaColumn>> {
  const result = new Map<string, Map<string, MetadataSchemaColumn>>();
  for (const column of columns) {
    const table = result.get(column.tableName) || new Map<string, MetadataSchemaColumn>();
    table.set(column.columnName, column);
    result.set(column.tableName, table);
  }
  return result;
}

function hasColumn(
  schema: Map<string, Map<string, MetadataSchemaColumn>>,
  table: TableName,
  column: string,
): boolean {
  return schema.get(table)?.has(column) || false;
}

function columnExpression(table: TableName, column: string): string {
  return `${TABLE_ALIASES[table]}.${quoteIdentifier(column)}::text`;
}

function coalesceExpressions(expressions: string[]): string {
  if (!expressions.length) return 'NULL::text';
  if (expressions.length === 1) return expressions[0];
  return `COALESCE(${expressions.join(', ')})`;
}

function coreFieldPlans(columns: MetadataSchemaColumn[]): FieldPlan[] {
  const schema = catalog(columns);
  const from = (table: TableName, column: string) =>
    hasColumn(schema, table, column) ? columnExpression(table, column) : null;
  const plan = (
    key: string,
    label: string,
    kind: MetadataValueKind,
    sources: Array<[TableName, string]>,
  ): FieldPlan => {
    const availableSources = sources
      .map(([table, column]) => from(table, column) ? `${table}.${column}` : null)
      .filter((value): value is string => value != null);
    const expressions = sources
      .map(([table, column]) => from(table, column))
      .filter((value): value is string => value != null);
    return {
      key,
      label,
      kind,
      source: availableSources.length ? availableSources.join(' → ') : 'Not stored in current schema',
      schemaAvailable: expressions.length > 0,
      autoDiscovered: false,
      expression: coalesceExpressions(expressions),
    };
  };
  return [
    plan('sector', 'Sector', 'text', [['discovery_decisions', 'sector'], ['companies', 'sector']]),
    plan('industry', 'Industry', 'text', [['discovery_decisions', 'industry'], ['companies', 'industry']]),
    plan('market_cap', 'Market Cap', 'number', [['discovery_decisions', 'market_cap'], ['price_snapshots', 'market_cap']]),
    plan('exchange', 'Exchange', 'text', [['companies', 'exchange']]),
    plan('country', 'Country', 'text', [['companies', 'country']]),
    plan('growth_score', 'Growth Score', 'number', [['discovery_decisions', 'growth_score']]),
    plan('health_score', 'Health Score', 'number', [['discovery_decisions', 'health_score']]),
    plan('coverage_score', 'Coverage Score', 'number', [['discovery_decisions', 'coverage_score']]),
    plan('total_score', 'Total Score', 'number', [['discovery_decisions', 'total_score']]),
  ];
}

const COLLECTION_EXTRAS = new Set([
  'item_version', 'lookup_bucket', 'selected_for_market_data', 'market_data_attempted',
  'market_data_found', 'market_data_source', 'mention_count', 'previous_mention_count',
  'mention_growth_percent', 'attention_rank', 'growth_rank', 'recall_rank', 'skip_reason',
]);
const COMPANY_EXTRAS = new Set([
  'name', 'quote_type', 'currency', 'source', 'sec_cik', 'classification_source',
]);
const DECISION_EXCLUDED = new Set([
  'sector', 'industry', 'market_cap', 'growth_score', 'health_score', 'coverage_score',
  'runway_detail', 'catalyst_detail', 'decision_price', 'volume',
]);

function isAdditionalMetadataColumn(column: MetadataSchemaColumn): boolean {
  if (column.tableName === 'collection_run_items') return COLLECTION_EXTRAS.has(column.columnName);
  if (column.tableName === 'companies') return COMPANY_EXTRAS.has(column.columnName);
  if (column.tableName !== 'discovery_decisions' || DECISION_EXCLUDED.has(column.columnName)) return false;
  return /^(included|candidate_rank|currency|scoring_version|runway_status|analysis_scope|sector_|catalyst_)/.test(column.columnName)
    && !/(^id$|_event_id$|_snapshot_id$|collection_run_item_id$)/.test(column.columnName);
}

export function discoverAdditionalMetadataFields(columns: MetadataSchemaColumn[]): MetadataFieldDefinition[] {
  return columns
    .filter(isAdditionalMetadataColumn)
    .map((column) => ({
      key: `${column.tableName}.${column.columnName}`,
      label: `${humanize(column.columnName)} (${column.tableName === 'collection_run_items' ? 'Collection' : column.tableName === 'companies' ? 'Company' : 'Decision'})`,
      source: `${column.tableName}.${column.columnName}`,
      kind: valueKind(column.dataType),
      schemaAvailable: true,
      autoDiscovered: true,
    }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

function classifyValue(value: unknown): { kind: 'populated' | 'null' | 'empty' | 'unknown'; display: string | null } {
  if (value == null) return { kind: 'null', display: null };
  const display = String(value).trim();
  if (!display) return { kind: 'empty', display: null };
  if (UNKNOWN_LIKE_VALUES.has(display.toLowerCase())) return { kind: 'unknown', display: null };
  return { kind: 'populated', display };
}

function fieldCoverage(
  field: MetadataFieldDefinition,
  items: MetadataCoverageSourceItem[],
): MetadataFieldCoverage {
  if (!field.schemaAvailable) {
    return {
      ...field,
      totalItems: items.length,
      populatedCount: 0,
      missingCount: items.length,
      coveragePct: 0,
      distinctValueCount: 0,
      topValues: [],
      missingBreakdown: {
        nullCount: 0,
        emptyCount: 0,
        unknownLikeCount: 0,
        schemaUnavailableCount: items.length,
      },
    };
  }
  let nullCount = 0;
  let emptyCount = 0;
  let unknownLikeCount = 0;
  const counts = new Map<string, { display: string; count: number }>();
  for (const item of items) {
    const classified = classifyValue(item.values[field.key]);
    if (classified.kind === 'null') nullCount += 1;
    else if (classified.kind === 'empty') emptyCount += 1;
    else if (classified.kind === 'unknown') unknownLikeCount += 1;
    else {
      const normalized = classified.display!.toLowerCase();
      const current = counts.get(normalized);
      counts.set(normalized, { display: current?.display || classified.display!, count: (current?.count || 0) + 1 });
    }
  }
  const populatedCount = [...counts.values()].reduce((sum, value) => sum + value.count, 0);
  return {
    ...field,
    totalItems: items.length,
    populatedCount,
    missingCount: items.length - populatedCount,
    coveragePct: percentage(populatedCount, items.length),
    distinctValueCount: counts.size,
    topValues: [...counts.values()]
      .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
      .slice(0, 5)
      .map((value) => ({
        value: value.display,
        count: value.count,
        percentageOfPopulated: percentage(value.count, populatedCount),
      })),
    missingBreakdown: {
      nullCount,
      emptyCount,
      unknownLikeCount,
      schemaUnavailableCount: 0,
    },
  };
}

export function buildMetadataCoverageAudit(
  items: MetadataCoverageSourceItem[],
  definitions: MetadataFieldDefinition[],
  now = new Date(),
): MetadataCoverageAudit {
  const fields = definitions.map((field) => fieldCoverage(field, items));
  const available = fields.filter((field) => field.schemaAvailable);
  const summary: MetadataCoverageSummary = {
    totalItems: items.length,
    requestedFields: Math.min(CORE_FIELD_COUNT, fields.length),
    autoDiscoveredFields: fields.filter((field) => field.autoDiscovered).length,
    schemaAvailableFields: available.length,
    schemaUnavailableFields: fields.length - available.length,
    fullyPopulatedFields: available.filter((field) => items.length > 0 && field.populatedCount === items.length).length,
    partiallyPopulatedFields: available.filter((field) => field.populatedCount > 0 && field.populatedCount < items.length).length,
    emptyFields: available.filter((field) => field.populatedCount === 0).length,
    averageCoveragePct: available.length
      ? roundPercentage(available.reduce((sum, field) => sum + field.coveragePct, 0) / available.length)
      : null,
  };
  const highlights: string[] = [];
  if (items.length) {
    for (const key of ['sector', 'exchange', 'growth_score']) {
      const field = fields.find((candidate) => candidate.key === key);
      if (field) highlights.push(`${field.label} coverage is ${field.coveragePct.toFixed(1)}% (${field.populatedCount}/${field.totalItems}).`);
    }
    const mostComplete = [...available].sort((a, b) =>
      b.coveragePct - a.coveragePct || b.populatedCount - a.populatedCount || a.label.localeCompare(b.label))[0];
    if (mostComplete) highlights.push(`Most complete field: ${mostComplete.label} (${mostComplete.coveragePct.toFixed(1)}%).`);
    const unavailable = fields.filter((field) => !field.schemaAvailable);
    if (unavailable.length) {
      highlights.push(`${unavailable.map((field) => field.label).join(' and ')} ${unavailable.length === 1 ? 'is' : 'are'} not stored in the current schema.`);
    }
  }
  return {
    generatedAt: now.toISOString(),
    sampleUnit: 'collection_run_item row',
    summary,
    fields,
    highlights,
  };
}

function buildQueryPlan(columns: MetadataSchemaColumn[]): { fields: MetadataFieldDefinition[]; query: string } {
  const schema = catalog(columns);
  const core = coreFieldPlans(columns);
  const extras = discoverAdditionalMetadataFields(columns);
  const extraPlans: FieldPlan[] = extras.map((field) => {
    const [tableName, columnName] = field.key.split('.') as [TableName, string];
    return { ...field, expression: columnExpression(tableName, columnName) };
  });
  const fields = [...core, ...extras];
  const select = [...core, ...extraPlans]
    .map((field) => `${field.expression} AS ${quoteIdentifier(field.key)}`)
    .join(',\n       ');
  const companyJoin = hasColumn(schema, 'collection_run_items', 'company_id') && schema.has('companies')
    ? 'LEFT JOIN companies c ON c.id = i.company_id'
    : '';
  const decisionJoin = schema.has('discovery_decisions')
    && hasColumn(schema, 'discovery_decisions', 'collection_run_item_id')
    ? `LEFT JOIN LATERAL (
         SELECT dd.*
         FROM discovery_decisions dd
         WHERE dd.collection_run_item_id = i.id
         ORDER BY dd.id DESC
         LIMIT 1
       ) d ON true`
    : '';
  const priceJoin = schema.has('price_snapshots')
    && hasColumn(schema, 'price_snapshots', 'company_id')
    && hasColumn(schema, 'price_snapshots', 'captured_at')
    && hasColumn(schema, 'price_snapshots', 'market_cap')
    ? `LEFT JOIN LATERAL (
         SELECT p.market_cap
         FROM price_snapshots p
         WHERE p.company_id = i.company_id AND p.captured_at <= i.observed_at
         ORDER BY p.captured_at DESC, p.id DESC
         LIMIT 1
       ) price ON true`
    : '';
  return {
    fields,
    query: `SELECT i.id AS item_id,
       ${select}
     FROM collection_run_items i
     ${companyJoin}
     ${decisionJoin}
     ${priceJoin}
     ORDER BY i.id`,
  };
}

export async function getMetadataCoverageAudit(now = new Date()): Promise<MetadataCoverageAudit> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const schemaResult = await client.query(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [['collection_run_items', 'companies', 'discovery_decisions', 'price_snapshots']],
    );
    const columns: MetadataSchemaColumn[] = schemaResult.rows.map((row) => ({
      tableName: String(row.table_name),
      columnName: String(row.column_name),
      dataType: String(row.data_type),
    }));
    const plan = buildQueryPlan(columns);
    const result = await client.query(plan.query);
    await client.query('COMMIT');
    return buildMetadataCoverageAudit(result.rows.map((row) => ({
      itemId: Number(row.item_id),
      values: Object.fromEntries(plan.fields.map((field) => [field.key, row[field.key]])),
    })), plan.fields, now);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
