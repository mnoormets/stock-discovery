'use client';

import { useMemo, useState } from 'react';
import type { MetadataFieldCoverage } from '../../../lib/metadata-coverage-audit';

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

type CoverageSortKey = 'label' | 'source' | 'populatedCount' | 'missingCount' | 'coveragePct' | 'distinctValueCount';

export function FieldCoverageTable({ fields }: { fields: MetadataFieldCoverage[] }) {
  const [sortKey, setSortKey] = useState<CoverageSortKey>('coveragePct');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...fields].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number'
      ? left - Number(right)
      : left.localeCompare(String(right));
    return (direction === 'asc' ? comparison : -comparison) || a.label.localeCompare(b.label);
  }), [direction, fields, sortKey]);

  function heading(label: string, key: CoverageSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'label' || key === 'source' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!fields.length) return <div className="attributionEmpty">No metadata fields were discovered.</div>;
  return (
    <div className="tableWrap attributionTable metadataCoverageTable">
      <table>
        <thead><tr>
          <th>{heading('Field', 'label')}</th>
          <th>{heading('Source', 'source')}</th>
          <th>Schema</th>
          <th>{heading('Populated', 'populatedCount')}</th>
          <th>{heading('Missing', 'missingCount')}</th>
          <th>{heading('Coverage', 'coveragePct')}</th>
          <th>{heading('Distinct', 'distinctValueCount')}</th>
        </tr></thead>
        <tbody>{sorted.map((field) => <tr key={field.key}>
          <td><strong>{field.label}</strong>{field.autoDiscovered ? <small>Auto-discovered</small> : <small>Requested field</small>}</td>
          <td><code>{field.source}</code></td>
          <td><span className={`metadataSchemaBadge ${field.schemaAvailable ? 'available' : 'unavailable'}`}>{field.schemaAvailable ? 'Stored' : 'Not stored'}</span></td>
          <td>{field.populatedCount} / {field.totalItems}</td>
          <td>{field.missingCount}</td>
          <td>{formatPercentage(field.coveragePct)}</td>
          <td>{field.distinctValueCount}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

interface TopValueRow {
  field: string;
  source: string;
  value: string;
  count: number;
  percentage: number;
}

type TopValueSortKey = 'field' | 'value' | 'count' | 'percentage';

export function TopValuesTable({ fields }: { fields: MetadataFieldCoverage[] }) {
  const rows = useMemo<TopValueRow[]>(() => fields.flatMap((field) => field.topValues.map((value) => ({
    field: field.label,
    source: field.source,
    value: value.value,
    count: value.count,
    percentage: value.percentageOfPopulated,
  }))), [fields]);
  const [sortKey, setSortKey] = useState<TopValueSortKey>('count');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number' ? left - Number(right) : left.localeCompare(String(right));
    return (direction === 'asc' ? comparison : -comparison) || a.field.localeCompare(b.field);
  }), [direction, rows, sortKey]);

  function heading(label: string, key: TopValueSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'field' || key === 'value' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!rows.length) return <div className="attributionEmpty">No populated metadata values exist yet.</div>;
  return (
    <div className="tableWrap attributionTable metadataTopValuesTable">
      <table>
        <thead><tr>
          <th>{heading('Field', 'field')}</th>
          <th>{heading('Value', 'value')}</th>
          <th>{heading('Count', 'count')}</th>
          <th>{heading('Share of Populated', 'percentage')}</th>
        </tr></thead>
        <tbody>{sorted.map((row) => <tr key={`${row.source}:${row.value}`}>
          <td><strong>{row.field}</strong><small>{row.source}</small></td>
          <td>{row.value}</td>
          <td>{row.count}</td>
          <td>{formatPercentage(row.percentage)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type MissingSortKey = 'label' | 'missingCount' | 'nullCount' | 'emptyCount' | 'unknownLikeCount' | 'schemaUnavailableCount';

export function MissingBreakdownTable({ fields }: { fields: MetadataFieldCoverage[] }) {
  const rows = useMemo(() => fields.filter((field) => field.missingCount > 0).map((field) => ({
    label: field.label,
    source: field.source,
    missingCount: field.missingCount,
    ...field.missingBreakdown,
  })), [fields]);
  const [sortKey, setSortKey] = useState<MissingSortKey>('missingCount');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number' ? left - Number(right) : left.localeCompare(String(right));
    return (direction === 'asc' ? comparison : -comparison) || a.label.localeCompare(b.label);
  }), [direction, rows, sortKey]);

  function heading(label: string, key: MissingSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'label' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!rows.length) return <div className="attributionEmpty">Every discovered metadata field is fully populated.</div>;
  return (
    <div className="tableWrap attributionTable metadataMissingTable">
      <table>
        <thead><tr>
          <th>{heading('Field', 'label')}</th>
          <th>{heading('Total Missing', 'missingCount')}</th>
          <th>{heading('SQL NULL', 'nullCount')}</th>
          <th>{heading('Empty', 'emptyCount')}</th>
          <th>{heading('Unknown-like', 'unknownLikeCount')}</th>
          <th>{heading('Not Stored', 'schemaUnavailableCount')}</th>
        </tr></thead>
        <tbody>{sorted.map((row) => <tr key={`${row.source}:${row.label}`}>
          <td><strong>{row.label}</strong><small>{row.source}</small></td>
          <td>{row.missingCount}</td>
          <td>{row.nullCount}</td>
          <td>{row.emptyCount}</td>
          <td>{row.unknownLikeCount}</td>
          <td>{row.schemaUnavailableCount}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
