import type { UnderRecognitionEvidence } from '@/lib/under-recognition';

function dimensionLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function UnderRecognitionEvidenceBlock({
  evidence,
  title = 'Under-recognition evidence',
}: {
  evidence: UnderRecognitionEvidence;
  title?: string;
}) {
  const dimensions: { label: string; value: string; basis: string }[] = [
    { label: 'Analyst attention', value: evidence.analystAttention.value, basis: evidence.analystAttention.basis },
    { label: 'Market cap context', value: evidence.marketCapContext.value, basis: evidence.marketCapContext.basis },
    { label: 'Catalyst novelty', value: evidence.catalystNovelty.value, basis: evidence.catalystNovelty.basis },
    { label: 'Improving financials', value: evidence.improvingFinancials.value, basis: evidence.improvingFinancials.basis },
    { label: 'Discovery frequency', value: evidence.discoveryFrequency.value, basis: evidence.discoveryFrequency.basis },
    { label: 'Price reaction', value: evidence.priceReaction.value, basis: evidence.priceReaction.basis },
  ];
  return (
    <section className="card underRecognition">
      <div className="underRecognitionTop">
        <div><p className="eyebrow">{evidence.version}</p><h3>{title}</h3></div>
        <span className={`urBadge ${evidence.state}`}>{evidence.stateLabel}</span>
      </div>
      <p className="muted urQuestion">Kas turg ei pruugi seda veel täielikult hinnastada? See ei ole skoor ega osta/müü soovitus.</p>
      <p className="urStateDetail">{evidence.stateDetail}</p>
      <div className="urDimensions">
        {dimensions.map((dimension) => (
          <span key={dimension.label} title={dimension.basis}>
            <small>{dimension.label}</small>
            <strong className={`urValue ${dimension.value}`}>{dimensionLabel(dimension.value)}</strong>
          </span>
        ))}
      </div>
      {evidence.reasons.length > 0 && (
        <ul className="urReasons">{evidence.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      )}
      {evidence.unknowns.length > 0 && (
        <details className="urUnknowns"><summary>Teadmata sisendid ({evidence.unknowns.length})</summary>
          <ul>{evidence.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul>
        </details>
      )}
      <p className="muted urNote">Under-recognition on kompositsioonikiht olemasolevate signaalide peal (analyst kate, sector-relative market cap, Catalyst novelty, Growth/Health, Data Freshness + Period Alignment) — see ei arvuta neid uuesti, ei anna skoori ega muuda järjestust. `meaningful` nõuab korraga tähelepanu-lõhet, paranevat tõendit, usaldusväärset andmet ja ellujäämisriski puudumist.</p>
    </section>
  );
}
