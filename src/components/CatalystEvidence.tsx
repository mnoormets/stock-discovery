import type { CatalystEvidence as CatalystEvidenceSummary } from '@/lib/catalyst-evidence';

function day(value: string | null): string {
  return value ? value.slice(0, 10) : 'kuupäev teadmata';
}

export default function CatalystEvidence({
  evidence,
  title = 'Catalyst evidence',
}: {
  evidence: CatalystEvidenceSummary;
  title?: string;
}) {
  const strongest = evidence.strongest;
  const assessment = strongest?.assessment || null;
  return (
    <section className="card catalystEvidence">
      <div className="catalystTop">
        <div><p className="eyebrow">{evidence.version}</p><h3>{title}</h3></div>
        <span className={`catalystBadge ${evidence.status}`}>{evidence.label}</span>
      </div>
      {assessment ? (
        <>
          <div className="catalystDimensions">
            <span>Materiality <strong>{assessment.materiality}</strong></span>
            <span>Suund <strong>{assessment.direction}</strong></span>
            <span>Allikas <strong>{assessment.sourceQuality}</strong></span>
            <span>Uudsus <strong>{assessment.novelty}</strong></span>
            <span>Thesis-relevance <strong>{assessment.thesisRelevance}</strong></span>
            <span>Mandaat <strong>{assessment.mandateRelevance}</strong></span>
          </div>
          <p className="catalystEvent">
            <strong>{strongest?.summary}</strong>
            {strongest?.event.linkedPeriodEnd && <> · periood {strongest.event.linkedPeriodEnd}</>}
            {strongest?.event.linkedFactIds.length ? <> · {strongest.event.linkedFactIds.length} seotud SEC fakti</> : <> · seotud fakte ei ole</>}
            {strongest?.event.url && <> · <a href={strongest.event.url} target="_blank" rel="noreferrer">algallikas</a></>}
          </p>
          <ul className="catalystReasons">{evidence.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </>
      ) : <p className="muted">{evidence.reasons[0] || 'Salvestatud sündmusi ei ole.'}</p>}
      {evidence.counterEvidence.length > 0 && (
        <ul className="catalystCounter">{evidence.counterEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
      )}
      {evidence.unknowns.length > 0 && (
        <details className="catalystUnknowns"><summary>Mis on catalyst’i juures teadmata? ({evidence.unknowns.length})</summary>
          <ul>{evidence.unknowns.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      )}
      <p className="muted catalystNote">
        {evidence.nextScheduledAt
          ? `Järgmine planeeritud earnings ${day(evidence.nextScheduledAt)} ütleb ainult, millal järgmist tõendit vaadata.`
          : 'Planeeritud earnings kuupäev ei ole teada.'}
        {' '}Catalyst ei ole kaasamisfilter ega ostusoovitus; see mõjutab ainult järjestust ja nähtavat tõendit.
      </p>
    </section>
  );
}
