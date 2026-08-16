'use client';

import { useMemo, useState } from 'react';
import type { OutcomeAttributionBucket, OutcomeAttributionSection } from '../../../lib/outcome-attribution';

type SortKey = keyof Pick<OutcomeAttributionBucket,
  'bucket' | 'sampleCount' | 'avgReturnPct' | 'medianReturnPct' | 'winRatePct' | 'loserRatePct'>;

function formatPercent(value: number | null, signed = true): string {
  if (value == null) return '—';
  return `${signed && value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function valueClass(value: number | null): string {
  if (value == null || value === 0) return '';
  return value > 0 ? 'positive' : 'negative';
}

function numericSortValue(value: number | null): number {
  return value == null ? Number.NEGATIVE_INFINITY : value;
}

export default function AttributionTable({
  section,
  minHighlightSample,
}: {
  section: OutcomeAttributionSection;
  minHighlightSample: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('bucket');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const rows = useMemo(() => {
    const populated = section.buckets.filter((bucket) => bucket.sampleCount > 0);
    const naturalBucketOrder = new Map(section.buckets.map((bucket, index) => [bucket.bucket, index]));
    return [...populated].sort((a, b) => {
      const comparison = sortKey === 'bucket'
        ? naturalBucketOrder.get(a.bucket)! - naturalBucketOrder.get(b.bucket)!
        : numericSortValue(a[sortKey]) - numericSortValue(b[sortKey]);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [section.buckets, sortDirection, sortKey]);

  function chooseSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'bucket' ? 'asc' : 'desc');
  }

  function heading(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <button type="button" onClick={() => chooseSort(key)} aria-label={`Sort by ${label}`}>
        {label}<span aria-hidden="true">{active ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
      </button>
    );
  }

  if (!section.available) {
    return <div className="attributionUnavailable"><strong>Unavailable</strong><p>{section.unavailableReason}</p></div>;
  }
  if (!rows.length) {
    return <div className="attributionEmpty">No measured outcomes with a known {section.title.replace(' Attribution', '').toLowerCase()} signal yet.</div>;
  }

  return (
    <div className="tableWrap attributionTable">
      <table>
        <thead>
          <tr>
            <th>{heading('Bucket', 'bucket')}</th>
            <th>{heading('Sample Count', 'sampleCount')}</th>
            <th>{heading('Average Return', 'avgReturnPct')}</th>
            <th>{heading('Median Return', 'medianReturnPct')}</th>
            <th>{heading('Win Rate', 'winRatePct')}</th>
            <th>{heading('Loss Rate', 'loserRatePct')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((bucket) => (
            <tr key={bucket.bucket}>
              <td><strong>{bucket.bucket}</strong>{bucket.sampleCount < minHighlightSample && <span className="lowSampleBadge">Low sample</span>}</td>
              <td>{bucket.sampleCount}</td>
              <td className={valueClass(bucket.avgReturnPct)}>{formatPercent(bucket.avgReturnPct)}</td>
              <td className={valueClass(bucket.medianReturnPct)}>{formatPercent(bucket.medianReturnPct)}</td>
              <td>{formatPercent(bucket.winRatePct, false)}</td>
              <td>{formatPercent(bucket.loserRatePct, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
