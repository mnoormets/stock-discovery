import Link from 'next/link';
import { getValidationDashboard, type HorizonValidationStats, type ValidationDecision } from '@/lib/discovery-validation';

export const dynamic = 'force-dynamic';

function percent(value: number | null): string {
  if (value == null) return '—';
  return `${value > 0 ? '+' : ''}${value.toLocaleString('et-EE', { maximumFractionDigits: 2 })}%`;
}

function money(value: number | null, currency = 'USD'): string {
  if (value == null) return 'Andmed puuduvad';
  return new Intl.NumberFormat('et-EE', { style: 'currency', currency, notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 2 }).format(value);
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function returnClass(value: number | null): string {
  if (value == null || value === 0) return 'scoreNeutral';
  return value > 0 ? 'positive' : 'negative';
}

function HorizonCard({ stats }: { stats: HorizonValidationStats }) {
  return <article className="card validationHorizon">
    <div className="validationHorizonTop"><strong>{stats.horizon}</strong><span>{stats.observedCount}/{stats.candidateCount} mõõdetud</span></div>
    <dl className="validationMetrics">
      <div><dt>Keskmine</dt><dd className={returnClass(stats.averageReturn)}>{percent(stats.averageReturn)}</dd></div>
      <div><dt>Mediaan</dt><dd className={returnClass(stats.medianReturn)}>{percent(stats.medianReturn)}</dd></div>
      <div><dt>Võitjaid</dt><dd>{stats.winnerCount}{stats.winnerPercent == null ? '' : ` · ${percent(stats.winnerPercent)}`}</dd></div>
      <div><dt>Kaotajaid</dt><dd>{stats.loserCount}{stats.loserPercent == null ? '' : ` · ${percent(stats.loserPercent)}`}</dd></div>
    </dl>
    <div className="validationExtremes">
      <span>Parim: {stats.best ? <><strong>{stats.best.ticker}</strong> {percent(stats.best.returnPercent)}</> : '—'}</span>
      <span>Halvim: {stats.worst ? <><strong>{stats.worst.ticker}</strong> {percent(stats.worst.returnPercent)}</> : '—'}</span>
      {stats.pendingCount > 0 && <span>Ootel / puudu: {stats.pendingCount}</span>}
    </div>
  </article>;
}

function DecisionCard({ decision }: { decision: ValidationDecision }) {
  return <article className={`validationDecision ${decision.included ? 'included' : 'excluded'}`}>
    <div className="validationDecisionTop">
      <div><span className={`reviewLabel ${decision.included ? 'new-catalyst' : 'needs-review'}`}>{decision.included ? `Kaasatud · #${decision.candidateRank}` : 'Välja jäetud'}</span><Link className="ticker" href={`/company/${encodeURIComponent(decision.ticker)}`}>{decision.ticker}</Link></div>
      <div className="decisionScores"><span>Growth <strong>{decision.growthScore ?? '—'}</strong></span><span>Health <strong>{decision.healthScore ?? '—'}</strong></span><span>Coverage <strong>{decision.coverageScore}</strong></span>{decision.catalystEvidenceStatus && <span className={`catalystBadge ${decision.catalystEvidenceStatus}`}>{decision.catalystEvidenceStatus}</span>}</div>
    </div>
    <div className="candidateMarketMeta"><span>Otsuse hind: {money(decision.decisionPrice, decision.currency || 'USD')}</span><span>Market cap: {money(decision.marketCap, decision.currency || 'USD')}</span><span>Hinna snapshot: #{decision.priceSnapshotId || '—'}</span><span>Skoori snapshot: #{decision.scoreSnapshotId || '—'} · {decision.scoringVersion || 'versioon puudub'}</span></div>
    {decision.included ? <section className="decisionExplanation"><h4>Miks süsteem ta leidis?</h4><ul>{decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section> : <section className="decisionExplanation excludedReasons"><h4>Miks välja jäeti?</h4><ul>{decision.exclusionReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>}
    <div className="decisionEvidence"><p><strong>Runway:</strong> {decision.runwayDetail}</p><p><strong>Katalüsaator:</strong> {decision.catalystDetail}</p>{decision.risks.length > 0 && <p><strong>Riskid:</strong> {decision.risks.join(' ')}</p>}{decision.unknowns.length > 0 && <p><strong>Teadmata:</strong> {decision.unknowns.join(' ')}</p>}</div>
    {decision.included && <div className="outcomeRow">{decision.outcomes.map((outcome) => <span className={`outcomeBadge ${outcome.status}`} key={outcome.horizon} title={`Sihtaeg ${dateTime(outcome.targetAt)}`}><small>{outcome.horizon}</small><strong className={returnClass(outcome.returnPercent)}>{outcome.status === 'measured' ? percent(outcome.returnPercent) : outcome.status}</strong></span>)}</div>}
  </article>;
}

export default async function ValidationPage() {
  let dashboard = null;
  let error = '';
  try { dashboard = await getValidationDashboard(); }
  catch (caught) { error = (caught as Error).message; }
  return <main className="wrap pageStack">
    <section className="hero compact"><p className="eyebrow">POINT-IN-TIME · ACTUAL OUTCOMES</p><h1>Discovery valideerimine</h1><p className="lead">Siin mõõdetakse, mida „Leia järgmine RKLB” päriselt otsuse hetkel leidis ja kuidas kaasatud kandidaadi hind hiljem muutus. See pole ostu- ega müügisoovitus.</p></section>
    {error && <div className="notice danger">Valideerimise andmeid ei õnnestunud laadida: {error}</div>}
    {dashboard && <>
      <section className="section"><div className="sectionHeading"><div><p className="eyebrow">MEASURED SEPARATELY BY HORIZON</p><h2>Tulemuste kokkuvõte</h2></div><span className="muted">{dashboard.totalRuns} jooksu · {dashboard.totalCandidates} kandidaati</span></div><p className="muted validationMethod">Baasiks on otsusehetke hinnasnapshot. Horisondi hinnaks võetakse esimene snapshot sihtajal või järgneva seitsme päeva jooksul. Juba mõõdetud tulemust hiljem ümber ei kirjutata.</p><div className="validationGrid">{dashboard.horizons.map((stats) => <HorizonCard stats={stats} key={stats.horizon} />)}</div></section>
      <section className="section"><div className="sectionHeading"><div><p className="eyebrow">IMMUTABLE DECISION LOG</p><h2>Jooksude ajalugu</h2></div><Link className="button secondary" href="/scanner?preset=rklb">Käivita uus discovery</Link></div>
        {dashboard.runs.length === 0 ? <div className="empty card"><strong>Ühtegi discovery jooksu pole veel salvestatud.</strong><p>Käivita „Leia järgmine RKLB”; ka null kandidaadiga jooks salvestatakse.</p></div> : <div className="validationRuns">{dashboard.runs.map((run, index) => <details className="card validationRun" key={run.id} open={index === 0}><summary><span><strong>Run #{run.id}</strong><small>{dateTime(run.runAt)} · {run.modelVersion}</small></span><span>{run.includedCount} kaasatud · {run.evaluatedCount} vaadeldud</span></summary><div className="validationRunBody"><details className="runRules"><summary>Otsusereeglid</summary><ul>{run.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></details><div className="validationDecisions">{run.decisions.map((decision) => <DecisionCard decision={decision} key={decision.id} />)}</div></div></details>)}</div>}
      </section>
    </>}
  </main>;
}
