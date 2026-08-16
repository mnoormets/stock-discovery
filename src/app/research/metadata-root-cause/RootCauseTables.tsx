'use client';

import { useMemo, useState } from 'react';
import type {
  MetadataJoinDiagnosticItem,
  MetadataJoinFailureSummary,
  MetadataJoinFunnelStage,
} from '../../../lib/metadata-join-root-cause';

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function BooleanBadge({ value, label }: { value: boolean; label?: string }) {
  return <span className={`rootCauseBoolean ${value ? 'yes' : 'no'}`}>{label || (value ? 'Yes' : 'No')}</span>;
}

export function PipelineFunnelTable({ stages }: { stages: MetadataJoinFunnelStage[] }) {
  if (!stages.length) return <div className="attributionEmpty">No collection items exist for funnel analysis.</div>;
  return (
    <div className="tableWrap attributionTable rootCauseFunnelTable">
      <table>
        <thead><tr><th>Stage</th><th>Reached</th><th>Share of Items</th><th>Dropped at Transition</th></tr></thead>
        <tbody>{stages.map((stage, index) => <tr key={stage.key}>
          <td><strong>{index + 1}. {stage.label}</strong></td>
          <td>{stage.count}</td>
          <td>{formatPercentage(stage.percentageOfItems)}</td>
          <td>{stage.droppedFromPrevious}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type FailureSortKey = 'label' | 'count' | 'percentage';

export function FailureBreakdownTable({ failures }: { failures: MetadataJoinFailureSummary[] }) {
  const [sortKey, setSortKey] = useState<FailureSortKey>('count');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sorted = useMemo(() => [...failures].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number' ? left - Number(right) : left.localeCompare(String(right));
    return (direction === 'asc' ? comparison : -comparison) || a.label.localeCompare(b.label);
  }), [direction, failures, sortKey]);

  function heading(label: string, key: FailureSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(key === 'label' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!failures.length) return <div className="attributionEmpty">No root-cause classes are available.</div>;
  return (
    <div className="tableWrap attributionTable rootCauseFailureTable">
      <table>
        <thead><tr>
          <th>{heading('First Failure Class', 'label')}</th>
          <th>Code</th>
          <th>{heading('Items', 'count')}</th>
          <th>{heading('Share', 'percentage')}</th>
        </tr></thead>
        <tbody>{sorted.map((failure) => <tr key={failure.failureClass}>
          <td><strong>{failure.label}</strong></td>
          <td><code>{failure.failureClass}</code></td>
          <td>{failure.count}</td>
          <td>{formatPercentage(failure.percentage)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

type ItemSortKey = 'ticker' | 'runId' | 'lookupBucket' | 'selectedForMarketData' | 'marketDataAttempted'
  | 'marketDataFound' | 'companyIdentityExists' | 'companyMatched'
  | 'companyMetadataExists' | 'sectorExists' | 'marketCapExists' | 'exchangeExists'
  | 'scoringDataExists' | 'firstFailure';

export function ItemDiagnosticTable({ items }: { items: MetadataJoinDiagnosticItem[] }) {
  const [sortKey, setSortKey] = useState<ItemSortKey>('firstFailure');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const sorted = useMemo(() => [...items].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'boolean'
      ? Number(left) - Number(right)
      : typeof left === 'number'
        ? left - Number(right)
        : left.localeCompare(String(right));
    return (direction === 'asc' ? comparison : -comparison) || a.ticker.localeCompare(b.ticker);
  }), [direction, items, sortKey]);

  function heading(label: string, key: ItemSortKey) {
    const active = sortKey === key;
    return <button type="button" onClick={() => {
      if (active) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortKey(key);
        setDirection(typeof items[0]?.[key] === 'string' ? 'asc' : 'desc');
      }
    }}>{label}<span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button>;
  }

  if (!items.length) return <div className="attributionEmpty">No collection items exist for item-level diagnosis.</div>;
  return (
    <div className="tableWrap attributionTable rootCauseItemTable">
      <table>
        <thead><tr>
          <th>{heading('Ticker', 'ticker')}</th>
          <th>{heading('Run', 'runId')}</th>
          <th>{heading('Source Path', 'lookupBucket')}</th>
          <th>{heading('Selected', 'selectedForMarketData')}</th>
          <th>{heading('Attempted', 'marketDataAttempted')}</th>
          <th>{heading('Data Found', 'marketDataFound')}</th>
          <th>{heading('Identity', 'companyIdentityExists')}</th>
          <th>{heading('Item Link', 'companyMatched')}</th>
          <th>{heading('Company Metadata', 'companyMetadataExists')}</th>
          <th>{heading('Sector', 'sectorExists')}</th>
          <th>{heading('Market Cap', 'marketCapExists')}</th>
          <th>{heading('Exchange', 'exchangeExists')}</th>
          <th>{heading('Scores', 'scoringDataExists')}</th>
          <th>{heading('First Failure', 'firstFailure')}</th>
        </tr></thead>
        <tbody>{sorted.map((item) => <tr key={item.itemId}>
          <td><strong>{item.ticker}</strong><small>Item #{item.itemId}</small></td>
          <td>#{item.runId}</td>
          <td>{item.lookupBucket}<small>{item.skipReason ? `Skip: ${item.skipReason}` : 'No skip reason'}</small></td>
          <td><BooleanBadge value={item.selectedForMarketData} /></td>
          <td><BooleanBadge value={item.marketDataAttempted} /></td>
          <td><BooleanBadge value={item.marketDataFound} /></td>
          <td><BooleanBadge value={item.companyIdentityExists} /><small>Ticker company #{item.tickerCompanyId ?? '—'}</small></td>
          <td><BooleanBadge value={item.companyMatched} /><small>Item company #{item.itemCompanyId ?? '—'}</small></td>
          <td><BooleanBadge value={item.companyMetadataExists} /></td>
          <td><BooleanBadge value={item.sectorExists} /></td>
          <td><BooleanBadge value={item.marketCapExists} /></td>
          <td><BooleanBadge value={item.exchangeExists} /></td>
          <td><BooleanBadge value={item.scoringDataExists} /><small>Decision {item.decisionExists ? 'yes' : 'no'} · snapshot {item.companyScoreSnapshotExists ? 'yes' : 'no'} · G/H/C {item.growthScoreExists ? 'Y' : 'N'}/{item.healthScoreExists ? 'Y' : 'N'}/{item.coverageScoreExists ? 'Y' : 'N'}</small></td>
          <td><span className={`rootCauseClass ${item.firstFailure === 'COMPLETE' ? 'complete' : ''}`}>{item.firstFailure}</span><small>{item.explanation}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
