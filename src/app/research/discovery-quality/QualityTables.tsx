'use client';

import { useMemo, useState } from 'react';
import type {
  DiscoveryDuplicateAudit,
  DiscoveryQualityDistribution,
  DiscoveryScoreDistribution,
} from '../../../lib/discovery-quality-audit';

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

type DistributionSortKey = 'bucket' | 'count' | 'percentage';

export function DistributionTable({
  distribution,
  preferredOrder,
}: {
  distribution: DiscoveryQualityDistribution;
  preferredOrder?: readonly string[];
}) {
  const [sortKey, setSortKey] = useState<DistributionSortKey>(preferredOrder ? 'bucket' : 'count');
  const [direction, setDirection] = useState<'asc' | 'desc'>(preferredOrder ? 'asc' : 'desc');
  const order = useMemo(
    () => new Map((preferredOrder || []).map((bucket, index) => [bucket, index])),
    [preferredOrder],
  );
  const sorted = useMemo(() => [...distribution.buckets].sort((a, b) => {
    const comparison = sortKey === 'bucket'
      ? (preferredOrder
        ? (order.get(a.bucket) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.bucket) ?? Number.MAX_SAFE_INTEGER)
        : a.bucket.localeCompare(b.bucket))
      : a[sortKey] - b[sortKey];
    return direction === 'asc' ? comparison : -comparison;
  }), [direction, distribution.buckets, order, preferredOrder, sortKey]);

  function heading(label: string, key: DistributionSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'bucket' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!distribution.available) {
    return <div className="attributionUnavailable"><strong>Unavailable</strong><p>{distribution.unavailableReason}</p></div>;
  }
  if (!distribution.buckets.length) {
    return <div className="attributionEmpty">No collection items are available for this distribution.</div>;
  }
  return (
    <div className="tableWrap attributionTable qualityDistributionTable">
      <table>
        <thead><tr>
          <th>{heading('Bucket', 'bucket')}</th>
          <th>{heading('Items', 'count')}</th>
          <th>{heading('Share', 'percentage')}</th>
        </tr></thead>
        <tbody>{sorted.map((row) => <tr key={row.bucket}>
          <td><strong>{row.bucket}</strong></td>
          <td>{row.count}</td>
          <td>{formatPercentage(row.percentage)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type DuplicateSortKey = 'symbol' | 'appearanceCount' | 'firstSeen' | 'lastSeen';

export function DuplicateAuditTable({ rows }: { rows: DiscoveryDuplicateAudit[] }) {
  const [sortKey, setSortKey] = useState<DuplicateSortKey>('appearanceCount');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number'
      ? left - Number(right)
      : left.localeCompare(String(right));
    return (direction === 'asc' ? comparison : -comparison) || a.symbol.localeCompare(b.symbol);
  }), [direction, rows, sortKey]);

  function heading(label: string, key: DuplicateSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'symbol' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!rows.length) return <div className="attributionEmpty">No discovered symbols are available for duplicate analysis.</div>;
  return (
    <div className="tableWrap attributionTable qualityDuplicateTable">
      <table>
        <thead><tr>
          <th>{heading('Symbol', 'symbol')}</th>
          <th>{heading('Appearances', 'appearanceCount')}</th>
          <th>{heading('First Seen', 'firstSeen')}</th>
          <th>{heading('Last Seen', 'lastSeen')}</th>
          <th>Pattern</th>
        </tr></thead>
        <tbody>{sorted.map((row) => <tr key={row.symbol}>
          <td><strong>{row.symbol}</strong></td>
          <td>{row.appearanceCount}</td>
          <td>{formatDate(row.firstSeen)}</td>
          <td>{formatDate(row.lastSeen)}</td>
          <td><span className={`qualityPattern ${row.appearanceCount > 1 ? 'repeated' : 'one-time'}`}>{row.appearanceCount > 1 ? 'Repeated' : 'One-time'}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type ScoreSortKey = 'bucket' | 'count' | 'percentage';
const SCORE_ORDER = new Map(['0-20', '20-40', '40-60', '60-80', '80-100'].map((bucket, index) => [bucket, index]));

export function ScoreDistributionTable({ score }: { score: DiscoveryScoreDistribution }) {
  const [sortKey, setSortKey] = useState<ScoreSortKey>('bucket');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const sorted = useMemo(() => [...score.buckets].sort((a, b) => {
    const comparison = sortKey === 'bucket'
      ? SCORE_ORDER.get(a.bucket)! - SCORE_ORDER.get(b.bucket)!
      : a[sortKey] - b[sortKey];
    return direction === 'asc' ? comparison : -comparison;
  }), [direction, score.buckets, sortKey]);

  function heading(label: string, key: ScoreSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'bucket' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!score.available) {
    return <div className="attributionUnavailable"><strong>{score.title} unavailable</strong><p>{score.unavailableReason}</p></div>;
  }
  if (!score.availableCount) {
    return <div className="attributionEmpty">No linked immutable {score.title.toLowerCase()} values are available.</div>;
  }
  return (
    <div className="tableWrap attributionTable qualityScoreTable">
      <table>
        <thead><tr>
          <th>{heading('Score Bucket', 'bucket')}</th>
          <th>{heading('Candidates', 'count')}</th>
          <th>{heading('Share of Scored', 'percentage')}</th>
        </tr></thead>
        <tbody>{sorted.map((row) => <tr key={row.bucket}>
          <td><strong>{row.bucket}</strong></td>
          <td>{row.count}</td>
          <td>{formatPercentage(row.percentage)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
