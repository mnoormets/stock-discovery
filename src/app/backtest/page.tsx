import Link from 'next/link';
import { getBacktestDashboard, type BacktestCandidate, type BacktestHorizonStats } from '@/lib/backtest';

export const dynamic = 'force-dynamic';

function percent(value: number | null): string {
  if (value == null) return 'unknown';
  return `${value > 0 ? '+' : ''}${value.toLocaleString('et-EE', { maximumFractionDigits: 2 })}%`;
}

function valueClass(value: number | null): string {
  if (value == null || value === 0) return 'scoreNeutral';
  return value > 0 ? 'positive' : 'negative';
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function HorizonCard({ stats }: { stats: BacktestHorizonStats }) {
  return <article className="card backtestHorizon">
    <div className="validationHorizonTop"><strong>{stats.horizon}</strong><span>{stats.measuredTickerCount}/{stats.distinctTickerCount} tickerit mõõdetud</span></div>
    <dl className="backtestMetrics">
      <div><dt>Otsuseid mõõdetud</dt><dd>{stats.measuredDecisionCount}/{stats.decisionCount}</dd></div>
      <div><dt>Tickerite keskmine</dt><dd className={valueClass(stats.averageReturn)}>{percent(stats.averageReturn)}</dd></div>
      <div><dt>Tickerite mediaan</dt><dd className={valueClass(stats.medianReturn)}>{percent(stats.medianReturn)}</dd></div>
      <div><dt>Ticker hit rate</dt><dd>{percent(stats.hitRatePercent)}</dd></div>
      <div><dt>Tickereid üle benchmark’i</dt><dd>{percent(stats.beatBenchmarkPercent)}</dd></div>
      <div><dt>Tickerite keskmine excess</dt><dd className={valueClass(stats.averageExcessReturn)}>{percent(stats.averageExcessReturn)}</dd></div>
    </dl>
    <div className="validationExtremes">
      <span>Benchmark: {stats.benchmarkMeasuredTickerCount} tickerit / {stats.benchmarkMeasuredDecisionCount} otsust</span>
      <span>Ootel: {stats.pendingCount} · puudu: {stats.missingCount} · unavailable: {stats.unavailableCount}</span>
      <span>Parim: {stats.best ? <><strong>{stats.best.ticker}</strong> {percent(stats.best.returnPercent)}</> : '—'}</span>
      <span>Halvim: {stats.worst ? <><strong>{stats.worst.ticker}</strong> {percent(stats.worst.returnPercent)}</> : '—'}</span>
    </div>
  </article>;
}

function CandidateDetail({ candidate }: { candidate: BacktestCandidate }) {
  return <article className="backtestCandidate">
    <div className="validationDecisionTop">
      <div><span className="reviewLabel new-catalyst">Kaasatud · #{candidate.rank || '—'}</span><Link className="ticker" href={`/company/${encodeURIComponent(candidate.ticker)}`}>{candidate.ticker}</Link></div>
      <div className="decisionScores"><span>Growth <strong>{candidate.growthScore ?? '—'}</strong></span><span>Health <strong>{candidate.healthScore ?? '—'}</strong></span><span>Coverage <strong>{candidate.coverageScore}</strong></span></div>
    </div>
    <div className="tableWrap backtestOutcomeTable"><table>
      <thead><tr><th>Horisont</th><th>Candidate return</th><th>Benchmark</th><th>Excess return</th><th>Mõõdetud</th></tr></thead>
      <tbody>{candidate.outcomes.map((outcome) => <tr key={outcome.horizon}>
        <td><strong>{outcome.horizon}</strong></td>
        <td className={valueClass(outcome.candidateReturnPercent)}>{outcome.status === 'measured' ? percent(outcome.candidateReturnPercent) : 'unknown'}</td>
        <td className={valueClass(outcome.benchmarkReturnPercent)}>{outcome.benchmarkStatus === 'measured' ? `${outcome.benchmarkSymbol} ${percent(outcome.benchmarkReturnPercent)}` : `${outcome.benchmarkSymbol} unknown`}</td>
        <td className={valueClass(outcome.excessReturnPercent)}>{percent(outcome.excessReturnPercent)}</td>
        <td>{outcome.measuredAt ? dateTime(outcome.measuredAt) : '—'}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="backtestEvidence">
      <section><h4>Miks valiti?</h4><ul>{candidate.reasons.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h4>Riskid otsuse hetkel</h4><ul>{candidate.risks.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h4>Teadmata otsuse hetkel</h4><ul>{candidate.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></section>
    </div>
  </article>;
}

export default async function BacktestPage() {
  let dashboard = null;
  let error = '';
  try { dashboard = await getBacktestDashboard(); }
  catch (caught) { error = (caught as Error).message; }
  return <main className="wrap pageStack">
    <p className="notice warning"><strong>Historical measurement limitation.</strong> Earlier results may use download time where the quote time was unknown. Those records remain unchanged and do not establish a verified investment edge. New measurements require a known market timestamp at or after the horizon target for both the stock and SPY.</p>
    <section className="hero compact">
      <p className="eyebrow">POINT-IN-TIME · NO HISTORICAL RESELECTION</p>
      <h1>Backtest V1</h1>
      <p className="lead">Aus mõõtmine kasutab ainult varem salvestatud discovery run’e ja nende outcome’e. Minevikku ei valita tänase skänneriloogikaga ümber ning tulemus ei ole ostu- ega müügisoovitus.</p>
    </section>
    {error && <div className="notice danger">Backtesti ei õnnestunud laadida: {error}</div>}
    {dashboard && <>
      {!dashboard.hasMeasuredOutcomes && <div className="empty card backtestEmpty"><strong>Backtest vajab mõõdetud discovery outcome’e. Käivita scanner ja oota kuni valitud horisondid täituvad.</strong><p>Null kandidaati ja puuduv benchmark on korrektsed tulemused. Puuduvat excess return’i ei muudeta 0%-ks.</p></div>}
      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">BENCHMARK · {dashboard.benchmarkSymbol} · MODEL VERSION × HORIZON</p><h2>Canonical tulemuskohordid</h2></div><span className="muted">{dashboard.canonicalRuns} canonical jooksu ({dashboard.totalRuns} kokku salvestatud)</span></div>
        <p className="muted validationMethod">Sama tickeri korduvad mõõdetud otsused keskmistatakse esmalt mudeliversiooni ja horisondi sees. Return, mediaan, hit rate ja benchmark-võrdlus annavad seejärel igale tickerile ühe võrdse kaalu; otsuseread näitavad eraldi mõõtmiskatvust.</p>
        {dashboard.models.length === 0 ? <div className="empty card"><strong>Canonical tulemuskoorte pole veel.</strong></div> : dashboard.models.map((model) => <div className="outcomeModel" key={model.modelVersion}><div className="sectionHeading"><div><h3>{model.modelVersion}</h3><p>{model.runCount} jooksu · {model.decisionCount} otsust · {model.distinctTickerCount} eri tickerit</p></div></div><div className="backtestGrid">{model.horizons.map((stats) => <HorizonCard stats={stats} key={stats.horizon} />)}</div></div>)}
        <p className="muted provenanceNote"><strong>Tulemused kasutavad ainult canonical (`rklb_daily`) jookse</strong> (docs/DISCOVERY_FREQUENCY_PROVENANCE.md § 4). Käsitsi avatud scanneri jooks (`rklb`) jääb allpool run-level detaili auditiks. Kokku salvestatud: {dashboard.provenance.map((item) => `${item.modelVersion} · ${item.runType} ${item.runs} jooksu / ${item.candidates} otsust`).join('; ') || 'jooksu pole'}.</p>
      </section>
      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">SAVED DECISIONS ONLY</p><h2>Run-level detail</h2></div><Link className="button secondary" href="/validation">Ava Validation</Link></div>
        <div className="backtestRuns">{dashboard.runs.map((run, index) => <details className="card validationRun" key={run.id} open={index === 0}>
          <summary><span><strong>Run #{run.id}</strong><small>{dateTime(run.runAt)} · {run.modelVersion}</small></span><span>{run.includedCount} kaasatud · {run.excludedCount} välistatud</span></summary>
          <div className="validationRunBody">{run.candidates.length ? run.candidates.map((candidate) => <CandidateDetail candidate={candidate} key={candidate.id} />) : <div className="empty"><strong>Selles run’is ei olnud kaasatud kandidaate.</strong><p>Null kandidaati on korrektne point-in-time tulemus.</p></div>}</div>
        </details>)}</div>
      </section>
      <aside className="card antiCheat"><h3>Anti-cheat reeglid</h3><ul><li>Kasutatakse ainult salvestatud discovery run’e.</li><li>Tänase skänneriga minevikku ümber ei valita.</li><li>Mõõdetud outcome’e ega benchmark’i hilisema backfilliga ümber ei kirjutata.</li><li>Puuduv hind või benchmark jääb <code>unknown</code>, mitte 0%.</li><li>Null kandidaati on korrektne tulemus.</li></ul></aside>
    </>}
  </main>;
}
