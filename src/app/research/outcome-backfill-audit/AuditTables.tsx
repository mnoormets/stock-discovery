'use client';

import { useMemo, useState } from 'react';
import type { OutcomeBackfillRunAudit, OutcomeBackfillSymbolAudit } from '../../../lib/outcome-backfill-audit';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function horizonStatus(symbol: OutcomeBackfillSymbolAudit, horizon: '30d' | '90d' | '180d'): string {
  if (symbol[`measured${horizon}`]) return 'Measured';
  if (!symbol[`eligible${horizon}`]) return 'Too recent';
  return symbol[`hasRequiredPriceData${horizon}`] ? 'Ready' : 'Missing price';
}

function priceStatus(symbol: OutcomeBackfillSymbolAudit): string {
  const due = (['30d', '90d', '180d'] as const).filter((horizon) => symbol[`eligible${horizon}`]);
  if (!due.length) return 'Not due';
  return due.every((horizon) => symbol[`measured${horizon}`] || symbol[`hasRequiredPriceData${horizon}`])
    ? 'Available' : 'Missing';
}

type SymbolSortKey = 'symbol' | 'firstObservedAt' | 'latestObservedAt' | 'collectionItemCount' | 'missingReason';

export function SymbolAuditTable({ rows }: { rows: OutcomeBackfillSymbolAudit[] }) {
  const [sortKey, setSortKey] = useState<SymbolSortKey>('symbol');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number'
      ? left - Number(right)
      : String(left).localeCompare(String(right));
    return direction === 'asc' ? comparison : -comparison;
  }), [direction, rows, sortKey]);

  function heading(label: string, key: SymbolSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'symbol' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!rows.length) return <div className="attributionEmpty">No collection symbols exist yet.</div>;
  return (
    <div className="tableWrap attributionTable backfillAuditTable symbolAuditTable">
      <table>
        <thead><tr>
          <th>{heading('Symbol', 'symbol')}</th>
          <th>{heading('First Observed', 'firstObservedAt')}</th>
          <th>{heading('Latest Observed', 'latestObservedAt')}</th>
          <th>{heading('Items', 'collectionItemCount')}</th>
          <th>30D</th><th>90D</th><th>180D</th><th>Price Data</th>
          <th>{heading('Status', 'missingReason')}</th>
        </tr></thead>
        <tbody>{sorted.map((symbol) => <tr key={symbol.symbol}>
          <td><strong>{symbol.symbol}</strong></td>
          <td>{formatDate(symbol.firstObservedAt)}</td>
          <td>{formatDate(symbol.latestObservedAt)}</td>
          <td>{symbol.collectionItemCount}</td>
          <td>{horizonStatus(symbol, '30d')}</td>
          <td>{horizonStatus(symbol, '90d')}</td>
          <td>{horizonStatus(symbol, '180d')}</td>
          <td>{priceStatus(symbol)}</td>
          <td><span className={`backfillStatus ${symbol.missingReason.toLowerCase().replaceAll(' ', '-')}`}>{symbol.missingReason}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type RunSortKey = keyof Pick<OutcomeBackfillRunAudit,
  'runId' | 'createdAt' | 'totalItems' | 'eligible30d' | 'eligible90d' | 'eligible180d' | 'missingSnapshots' | 'missingPriceData'>;

export function RunAuditTable({ rows }: { rows: OutcomeBackfillRunAudit[] }) {
  const [sortKey, setSortKey] = useState<RunSortKey>('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number'
      ? left - Number(right)
      : String(left).localeCompare(String(right));
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

  if (!rows.length) return <div className="attributionEmpty">No collection runs with items exist yet.</div>;
  return (
    <div className="tableWrap attributionTable backfillAuditTable runAuditTable">
      <table>
        <thead><tr>
          <th>{heading('Run', 'runId')}</th>
          <th>{heading('Created', 'createdAt')}</th>
          <th>{heading('Items', 'totalItems')}</th>
          <th>{heading('Eligible 30D', 'eligible30d')}</th>
          <th>{heading('Eligible 90D', 'eligible90d')}</th>
          <th>{heading('Eligible 180D', 'eligible180d')}</th>
          <th>{heading('Missing Snapshots', 'missingSnapshots')}</th>
          <th>{heading('Missing Price Data', 'missingPriceData')}</th>
        </tr></thead>
        <tbody>{sorted.map((run) => <tr key={run.runId}>
          <td>#{run.runId}</td><td>{formatDate(run.createdAt)}</td><td>{run.totalItems}</td>
          <td>{run.eligible30d}</td><td>{run.eligible90d}</td><td>{run.eligible180d}</td>
          <td>{run.missingSnapshots}</td><td>{run.missingPriceData}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
