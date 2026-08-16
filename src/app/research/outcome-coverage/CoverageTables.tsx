'use client';

import { useMemo, useState } from 'react';
import type { OutcomeCoverageAge, OutcomeCoverageRun } from '../../../lib/outcome-coverage';

function formatCoverage(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

type RunSortKey = 'runId' | 'createdAt' | 'candidateCount' | 'measuredCount' | 'missingCount' | 'coveragePct';

export function RunCoverageTable({ rows }: { rows: OutcomeCoverageRun[] }) {
  const [sortKey, setSortKey] = useState<RunSortKey>('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey] ?? -1;
    const right = b[sortKey] ?? -1;
    const comparison = typeof left === 'string'
      ? left.localeCompare(String(right))
      : Number(left) - Number(right);
    return direction === 'asc' ? comparison : -comparison;
  }), [direction, rows, sortKey]);

  function heading(label: string, key: RunSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection('desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!rows.length) return <div className="attributionEmpty">No collection runs recorded yet.</div>;
  return (
    <div className="tableWrap attributionTable coverageTable">
      <table>
        <thead><tr>
          <th>{heading('Run', 'runId')}</th>
          <th>{heading('Created (Tallinn)', 'createdAt')}</th>
          <th>{heading('Candidates', 'candidateCount')}</th>
          <th>{heading('Measured', 'measuredCount')}</th>
          <th>{heading('Missing', 'missingCount')}</th>
          <th>{heading('Coverage', 'coveragePct')}</th>
        </tr></thead>
        <tbody>{sorted.map((row) => <tr key={row.runId}>
          <td>#{row.runId}</td>
          <td>{formatDate(row.createdAt)}</td>
          <td>{row.candidateCount}</td>
          <td>{row.measuredCount}</td>
          <td>{row.missingCount}</td>
          <td>{formatCoverage(row.coveragePct)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type AgeSortKey = 'bucket' | 'count' | 'measured' | 'missing' | 'coveragePct';
const AGE_ORDER = new Map(['0-30 days', '31-90 days', '91-180 days', '180+ days'].map((bucket, index) => [bucket, index]));

export function AgeCoverageTable({ rows }: { rows: OutcomeCoverageAge[] }) {
  const [sortKey, setSortKey] = useState<AgeSortKey>('bucket');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const comparison = sortKey === 'bucket'
      ? AGE_ORDER.get(a.bucket)! - AGE_ORDER.get(b.bucket)!
      : Number(a[sortKey] ?? -1) - Number(b[sortKey] ?? -1);
    return direction === 'asc' ? comparison : -comparison;
  }), [direction, rows, sortKey]);

  function heading(label: string, key: AgeSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'bucket' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  return (
    <div className="tableWrap attributionTable coverageTable">
      <table>
        <thead><tr>
          <th>{heading('Age Bucket', 'bucket')}</th>
          <th>{heading('Candidates', 'count')}</th>
          <th>{heading('Measured', 'measured')}</th>
          <th>{heading('Missing', 'missing')}</th>
          <th>{heading('Coverage', 'coveragePct')}</th>
        </tr></thead>
        <tbody>{sorted.map((row) => <tr key={row.bucket}>
          <td><strong>{row.bucket}</strong></td>
          <td>{row.count}</td>
          <td>{row.measured}</td>
          <td>{row.missing}</td>
          <td>{formatCoverage(row.coveragePct)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
