import type {
  ValuationAnchor,
  ValuationConfidence,
  ValuationEvidenceSummary,
} from '@/lib/valuation-evidence';

function statusLabel(status: ValuationAnchor['status']): string {
  if (status === 'computable') return 'arvutatud';
  if (status === 'not_meaningful') return 'ei ole tähenduslik';
  if (status === 'insufficient_data') return 'andmeid napib';
  return 'unknown';
}

function confidenceLabel(confidence: ValuationConfidence): string {
  if (confidence === 'high') return 'Kõrge';
  if (confidence === 'medium') return 'Keskmine';
  if (confidence === 'low') return 'Madal';
  return 'Unknown';
}

function basisLabel(basis: ValuationAnchor['basis']): string | null {
  if (basis === 'annual') return 'aastane';
  if (basis === 'annualized_from_quarter') return 'kvartalist ×4';
  return null;
}

function formatValue(anchor: ValuationAnchor): string {
  if (anchor.status !== 'computable' || anchor.value == null) return statusLabel(anchor.status);
  if (anchor.unit === '%') {
    return `${anchor.value > 0 ? '+' : ''}${anchor.value.toLocaleString('et-EE', { maximumFractionDigits: 1 })}%`;
  }
  return `${anchor.value.toLocaleString('et-EE', { maximumFractionDigits: 1 })}x`;
}

function valueClass(anchor: ValuationAnchor): string {
  if (anchor.status !== 'computable' || anchor.value == null) return 'muted';
  // Ainult yield saab olla positiivne/negatiivne; multiple ise ei ole hea/halb.
  if (anchor.unit === '%') return anchor.value >= 0 ? 'positive' : 'negative';
  return '';
}

export default function ValuationEvidence({
  evidence,
  title = 'Valuation evidence',
  compact = false,
}: {
  evidence: ValuationEvidenceSummary;
  title?: string;
  compact?: boolean;
}) {
  return (
    <section className={`card valuationEvidence ${compact ? 'compactValuation' : ''}`}>
      <div className="valuationTop">
        <div><p className="eyebrow">{evidence.version}</p><h3>{title}</h3></div>
        {!evidence.marketCapKnown && <span className="valuationBadge insufficient_data">Market cap: unknown</span>}
      </div>
      <p className="muted valuationQuestion">Mille vastu ma seda ettevõtet hinnastan? See ei ole skoor ega osta/müü soovitus.</p>
      {compact ? (
        <div className="valuationDimensions">
          {evidence.anchors.map((anchor) => (
            <span key={anchor.kind}>
              <small>{anchor.label}</small>
              <strong className={valueClass(anchor)}>{formatValue(anchor)}</strong>
              <em className={`valuationConfidence ${anchor.confidence}`}>{confidenceLabel(anchor.confidence)}</em>
            </span>
          ))}
        </div>
      ) : (
        <div className="tableWrap valuationTable">
          <table>
            <thead><tr><th>Ankur</th><th>Väärtus</th><th>Confidence</th><th>Viimane sisend</th><th>Allikas</th></tr></thead>
            <tbody>{evidence.anchors.map((anchor) => (
              <tr key={anchor.kind}>
                <td>
                  <strong>{anchor.label}</strong>
                  <small className={`valuationBadge ${anchor.status}`}>{statusLabel(anchor.status)}</small>
                </td>
                <td>
                  <strong className={valueClass(anchor)}>{formatValue(anchor)}</strong>
                  {anchor.note && <small className="muted">{anchor.note}</small>}
                </td>
                <td><span className={`valuationConfidence ${anchor.confidence}`}>{confidenceLabel(anchor.confidence)}</span></td>
                <td>{anchor.lastUpdated || <span className="muted">unknown</span>}{basisLabel(anchor.basis) && <small>{basisLabel(anchor.basis)}</small>}</td>
                <td>{anchor.sources.length === 0 ? <span className="muted">—</span> : anchor.sources.map((source, index) => (
                  <span className="valuationSource" key={`${source.label}-${index}`}>
                    {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}
                    <small>{source.periodEnd || 'periood unknown'}</small>
                  </span>
                ))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="muted valuationNote">Iga ankur on eraldi läbipaistev suhtarv (fakt / fakt) või unknown — mitte koondskoor. Peer comparison ja sum-of-parts jäävad käsitsi täidetavaks. EV / Sales requires cash and debt from the same, non-stale reporting date; other anchors retain their displayed freshness confidence. Ei muuda Growth, Health, Coverage ega Catalyst skoori.</p>
    </section>
  );
}
