import type { RelativeMetric, SectorRelativeStats } from '@/lib/sector-relative';

function metricText(label: string, metric: RelativeMetric): string {
  const value = metric.value == null ? 'unknown' : metric.value.toLocaleString('et-EE', { maximumFractionDigits: 1 });
  const median = metric.median == null ? 'unknown' : metric.median.toLocaleString('et-EE', { maximumFractionDigits: 1 });
  const percentile = metric.percentile == null ? 'unknown' : `${metric.percentile}. percentile`;
  return `${label}: ${value}, group median ${median}, ${percentile}`;
}

function interpretation(label: string, metric: RelativeMetric): string | null {
  if (metric.percentile == null) return null;
  const level = metric.percentile >= 75 ? 'high' : metric.percentile <= 25 ? 'low' : 'middle range';
  return `${label} is ${level} in the selected peer group (${metric.percentile}. percentile).`;
}

export default function SectorRelativeEvidence({
  stats,
  title = 'Compared with similar companies',
  showInterpretation = false,
}: {
  stats: SectorRelativeStats | null;
  title?: string;
  showInterpretation?: boolean;
}) {
  if (!stats || stats.status === 'unknown') {
    return (
      <section className="sectorRelative card">
        <div><p className="eyebrow">PEER-GROUP FACTS</p><h3>{title}</h3></div>
        <p className="muted">Sector / industry unknown. No data available yet.</p>
      </section>
    );
  }

  if (stats.status === 'insufficient') {
    return (
      <section className="sectorRelative card">
        <div><p className="eyebrow">PEER-GROUP FACTS</p><h3>{title}</h3></div>
        <p><strong>{stats.groupType === 'industry' ? 'Industry' : 'Sector'}:</strong> {stats.groupName}</p>
        <p className="notice">Not enough comparable companies</p>
        <p className="muted">Comparable count: {stats.comparableCount}. Percentiles require at least {stats.minimumComparableCount} companies with the same score version and complete Growth, Health and Coverage values.</p>
      </section>
    );
  }

  const interpretations = showInterpretation
    ? [interpretation('Growth', stats.growth), interpretation('Health', stats.health), interpretation('Coverage', stats.coverage)].filter((item): item is string => Boolean(item))
    : [];

  return (
    <section className="sectorRelative card">
      <div className="sectorRelativeTop">
        <div><p className="eyebrow">PEER-GROUP FACTS</p><h3>{title}</h3></div>
        <span>{stats.comparableCount} comparables</span>
      </div>
      <p className="sectorIdentity"><strong>{stats.groupType === 'industry' ? 'Industry' : 'Sector'}:</strong> {stats.groupName}{stats.industry && stats.groupType !== 'industry' ? ` · Industry: ${stats.industry}` : ''}</p>
      <div className="sectorMetricGrid">
        <div><strong>Growth</strong><span>{metricText('Growth', stats.growth)}</span></div>
        <div><strong>Health</strong><span>{metricText('Health', stats.health)}</span></div>
        <div><strong>Coverage</strong><span>{metricText('Coverage', stats.coverage)}</span></div>
        <div><strong>Market cap</strong><span>{stats.marketCap.percentile == null ? 'Market-cap percentile unknown' : `${stats.marketCap.percentile}. percentile in group`}</span></div>
      </div>
      {interpretations.length > 0 && <ul className="sectorInterpretation">{interpretations.map((item) => <li key={item}>{item}</li>)}</ul>}
      <p className="muted sectorSource">Classification source: {stats.classificationSource || 'unknown'}. This comparison is factual evidence, not a buy/sell recommendation.</p>
    </section>
  );
}
