import type { FinancialMetric } from '@/lib/company-financials';
import type { DataQualitySummary } from '@/lib/data-quality';

const labels: Record<FinancialMetric, string> = {
  revenue: 'Revenue',
  net_income: 'Net income',
  operating_cash_flow: 'Operating cash flow',
  capital_expenditure: 'Capital expenditure',
  free_cash_flow: 'Free cash flow',
  cash: 'Cash',
  debt: 'Debt',
  shares_outstanding: 'Shares outstanding',
};

function value(value: number, unit: string): string {
  if (unit === 'shares') return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat('et-EE', { style: 'currency', currency: unit || 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

function statusLabel(status: string): string {
  return status === 'fresh' ? 'Fresh' : status === 'mixed' ? 'Mixed' : status === 'stale' ? 'Stale'
    : status === 'good' ? 'Good' : status === 'warning' ? 'Warning' : status === 'poor' ? 'Poor' : 'Unknown';
}

export default function DataQualityEvidence({
  summary,
  title = 'Data Freshness + Period Alignment',
  compact = false,
}: {
  summary: DataQualitySummary;
  title?: string;
  compact?: boolean;
}) {
  return (
    <section className={`card dataQuality ${compact ? 'compactDataQuality' : ''}`}>
      <div className="dataQualityTop">
        <div><p className="eyebrow">{summary.version}</p><h3>{title}</h3></div>
        <div className="dataQualityBadges">
          <span className={`qualityBadge ${summary.freshnessStatus}`}>Freshness: {statusLabel(summary.freshnessStatus)}</span>
          <span className={`qualityBadge ${summary.alignmentStatus}`}>Alignment: {statusLabel(summary.alignmentStatus)}</span>
        </div>
      </div>
      {summary.metrics.length === 0 ? <p className="muted">Kvaliteedi hindamiseks pole skoorisisendeid. Period status: unknown.</p> : (
        <>
          <div className="dataQualitySummary">
            <span>Uusim periood <strong>{summary.newestPeriodEnd || 'unknown'}</strong></span>
            <span>Vanim periood <strong>{summary.oldestPeriodEnd || 'unknown'}</strong></span>
            <span>Vanim mõõdik <strong>{summary.oldestMetric ? labels[summary.oldestMetric] : 'unknown'}</strong></span>
            <span>Mediaanvanus <strong>{summary.medianFactAgeDays == null ? 'unknown' : `${summary.medianFactAgeDays} päeva`}</strong></span>
            <span>Perioodivahe <strong>{summary.periodSpanDays == null ? 'unknown' : `${summary.periodSpanDays} päeva`}</strong></span>
            <span>Stale / unknown <strong>{summary.staleMetricCount} / {summary.unknownPeriodCount}</strong></span>
          </div>
          {summary.warnings.length > 0 && <ul className="dataQualityWarnings">{summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          {!compact && <div className="tableWrap dataQualityTable"><table>
            <thead><tr><th>Mõõdik</th><th>Väärtus</th><th>Periood</th><th>Vanus</th><th>SEC fact</th></tr></thead>
            <tbody>{summary.metrics.map((metric) => <tr key={metric.metric}>
              <td><strong>{labels[metric.metric]}</strong><small>{metric.periodKind || 'period unknown'}</small></td>
              <td>{value(metric.value, metric.unit)}</td>
              <td>{metric.periodEnd || <span className="muted">unknown</span>}</td>
              <td className={metric.stale ? 'negative' : ''}>{metric.factAgeDays == null ? 'unknown' : `${metric.factAgeDays} päeva`}</td>
              <td>{metric.sourceUrl ? <a href={metric.sourceUrl} target="_blank" rel="noreferrer">Fact #{metric.factId || '—'}</a> : `Fact #${metric.factId || '—'}`}<small>{metric.accessionNumber || 'accession unknown'}</small></td>
            </tr>)}</tbody>
          </table></div>}
          <p className="muted dataQualityNote">Coverage näitab sisendite olemasolu. Freshness näitab nende vanust; Alignment, kas perioodid on omavahel võrreldavad. Need ei muuda Growth ega Financial Health skoori.</p>
        </>
      )}
    </section>
  );
}

