import Link from 'next/link';
import { notFound } from 'next/navigation';
import { saveThesisAction } from './actions';
import { getCompanyFinancialsDbFirst } from '@/lib/company-financials';
import { calculateCompanyScores, getTopScoreReasons, type CompanyScore } from '@/lib/company-scores';
import { getTrackedCompanyScores } from '@/lib/score-tracking';
import { getThesisWorkspace, type ThesisStatus, type ThesisVersion } from '@/lib/thesis';

export const dynamic = 'force-dynamic';

const emptyThesis = {
  summary: '', business: '', whyNow: '', moat: '', mispricing: '', catalyst: '',
  invalidation: '', twelveMonthCheckpoint: '', checkpointIsMeasurable: false,
  timeHorizon: '', status: 'draft' as ThesisStatus,
};

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function EvidenceCard({ title, score }: { title: string; score: CompanyScore | null }) {
  const reasons = getTopScoreReasons(score);
  return (
    <article className="card thesisEvidenceCard">
      <div className="thesisEvidenceTop">
        <div><span className="evidenceType">AUTOMAATNE EVIDENCE</span><h3>{title}</h3></div>
        <strong>{score?.score ?? '—'}<small>{score ? '/100' : ''}</small></strong>
      </div>
      {!score ? <p className="muted">Võrreldavaid SEC perioode pole piisavalt.</p> : (
        <>
          <p className="muted">Andmekate {score.coveragePercent}%. Kolm suurima kaalutud mõjuga põhjust:</p>
          <ol className="reasonList">{reasons.map((reason) => (
            <li className={reason.direction} key={reason.componentId}>
              <strong>{reason.label}</strong>
              <span>{reason.detail}</span>
              <small>Komponent {reason.componentScore}/100 · kaal {reason.weight}% · mõju {reason.weightedInfluence > 0 ? '+' : ''}{reason.weightedInfluence}</small>
            </li>
          ))}</ol>
          {reasons.length < 3 && <p className="muted">Saadaval oli ainult {reasons.length} arvutatavat põhjust.</p>}
        </>
      )}
    </article>
  );
}

function Defense({ thesis }: { thesis: ThesisVersion }) {
  const items = [
    ['Mida ettevõte teeb?', thesis.business],
    ['Miks praegu?', thesis.whyNow],
    ['Moat / konkurentsieelis', thesis.moat],
    ['Mida turg võib valesti hinnata?', thesis.mispricing],
    ['Katalüsaator', thesis.catalyst],
    ['Mis muudab teesi valeks?', thesis.invalidation],
    ['12 kuu kontrollpunkt', thesis.twelveMonthCheckpoint],
  ];
  return (
    <section className="card defenseCard">
      <div className="sectionHeading"><div><p className="eyebrow">5-MINUTE DEFENSE</p><h2>{thesis.summary || 'Teesi lühikokkuvõte puudub'}</h2></div><span className={`thesisStatus ${thesis.status}`}>{thesis.status}</span></div>
      <div className="defenseGrid">{items.map(([label, value]) => (
        <div key={label}><span>{label}</span><p>{value || 'Vastus puudub — kasutaja oletus vajab sõnastamist.'}</p></div>
      ))}</div>
      <p className="muted">Ajahorisont: {thesis.timeHorizon || 'määramata'} · versioon {thesis.version} · {dateTime(thesis.createdAt)}</p>
    </section>
  );
}

export default async function ThesisPage({
  params,
  searchParams,
}: {
  params: { positionId: string };
  searchParams?: { message?: string; error?: string };
}) {
  const positionId = Number(params.positionId);
  const workspace = await getThesisWorkspace(positionId);
  if (!workspace) notFound();

  const financials = await getCompanyFinancialsDbFirst(workspace.ticker).catch(() => null);
  const scores = calculateCompanyScores(financials);
  const tracked = await getTrackedCompanyScores(workspace.ticker, financials).catch(() => ({ current: null, previous: null, history: [] }));
  const thesis = workspace.current || emptyThesis;

  return (
    <main className="wrap pageStack">
      <section className="companyHeader">
        <div><p className="eyebrow">THESIS BUILDER · USER HYPOTHESES + VERIFIED DATA</p><h1>{workspace.ticker}</h1><p className="lead">{workspace.companyName || 'Ettevõtte nimi puudub'} · {workspace.positionStatus}</p></div>
        <div className="headerActions"><Link className="button secondary" href="/watchlist">Tagasi Watchlisti</Link><Link className="button secondary" href={`/company/${workspace.ticker}`}>Ettevõtte faktivaade</Link></div>
      </section>

      {searchParams?.message && <div className="notice success">{searchParams.message}</div>}
      {searchParams?.error && <div className="notice danger">{searchParams.error}</div>}

      {workspace.current && <Defense thesis={workspace.current} />}

      <section className="section">
        <div className="sectionHeading"><div><p className="eyebrow">SCORE EVIDENCE</p><h2>Mida olemasolevad andmed praegu näitavad?</h2></div>{tracked.current && <span className="muted">{tracked.current.version} · snapshot #{tracked.current.id} · {dateTime(tracked.current.calculatedAt)}</span>}</div>
        <p className="notice">Need on SEC andmetest arvutatud faktid ja reeglipõhised järeldused. Moat, mispricing ja “miks praegu?” jäävad kasutaja tõendatavateks oletusteks.</p>
        <div className="thesisEvidenceGrid">
          <EvidenceCard title="Growth Score" score={scores.growth} />
          <EvidenceCard title="Financial Health Score" score={scores.financialHealth} />
          <article className="card thesisEvidenceCard"><div className="thesisEvidenceTop"><div><span className="evidenceType">ANDMEKATE</span><h3>Coverage Score</h3></div><strong>{scores.coverage.score}<small>/100</small></strong></div><p>{scores.coverage.label}. Madal coverage tähendab, et tugevat üksikkomponenti ei tohi käsitleda täieliku pildina.</p></article>
        </div>
      </section>

      <section className="card thesisBuilder">
        <div><p className="eyebrow">USER HYPOTHESES</p><h2>{workspace.current ? `Muuda teesi · versioon ${workspace.current.version}` : 'Alusta struktureeritud teesi'}</h2><p className="muted">Iga sisuline muudatus loob uue versiooni. Identse sisu kordussalvestus uut versiooni ei loo.</p></div>
        <form action={saveThesisAction} className="thesisForm">
          <input type="hidden" name="positionId" value={workspace.positionId} />
          <input type="hidden" name="scoreSnapshotId" value={tracked.current?.id || ''} />
          <label><span>Teesi lühikokkuvõte <em>kasutaja oletus</em></span><textarea name="summary" defaultValue={thesis.summary} rows={3} maxLength={5000} placeholder="Ühe lõiguga: miks võiks seda ettevõtet sellel ajahorisondil omada?" /></label>
          <label><span>The business <em>kasutaja kirjeldus</em></span><textarea name="business" defaultValue={thesis.business} rows={3} maxLength={5000} placeholder="Mida ettevõte müüb, kellele ja miks klient seda vajab?" /></label>
          <div className="thesisFormGrid">
            <label><span>Why now? <em>kasutaja oletus</em></span><textarea name="whyNow" defaultValue={thesis.whyNow} rows={4} maxLength={5000} placeholder="Miks on ajastus praegu oluline?" /></label>
            <label><span>Moat <em>kasutaja peab tõendama</em></span><textarea name="moat" defaultValue={thesis.moat} rows={4} maxLength={5000} placeholder="Mis kaitseb ettevõtet konkurentsi eest?" /></label>
            <label><span>Mispricing <em>kasutaja peab tõendama</em></span><textarea name="mispricing" defaultValue={thesis.mispricing} rows={4} maxLength={5000} placeholder="Mida turg sinu arvates alahindab või valesti mõistab?" /></label>
            <label><span>Katalüsaator <em>kontrolli sündmust/allikat</em></span><textarea name="catalyst" defaultValue={thesis.catalyst} rows={4} maxLength={5000} placeholder="Milline konkreetne sündmus võiks uut infot tuua?" /></label>
          </div>
          <label className="criticalField"><span>Mis muudab teesi valeks? <em>kohustuslik enne ready staatust</em></span><textarea name="invalidation" defaultValue={thesis.invalidation} rows={4} maxLength={5000} placeholder="Kirjelda mõõdetav tulemus või sündmus, mille korral teesi enam ei kaitse." /></label>
          <label className="checkpointField"><span>Mis peab järgmise 12 kuu jooksul juhtuma? <em>eraldi pikaajalisest teesist</em></span><textarea name="twelveMonthCheckpoint" defaultValue={thesis.twelveMonthCheckpoint} rows={4} maxLength={5000} placeholder="Näiteks: revenue kasv püsib üle 20%, FCF paraneb või konkreetne verstapost saavutatakse." /></label>
          <label className="checkLabel"><input type="checkbox" name="checkpointIsMeasurable" defaultChecked={thesis.checkpointIsMeasurable} /><span>Kinnitan, et 12 kuu kontrollpunkti saab objektiivselt hinnata numbriga või jah/ei tulemusega.</span></label>
          <div className="thesisMetaGrid">
            <label><span>Ajahorisont</span><input name="timeHorizon" defaultValue={thesis.timeHorizon} maxLength={200} placeholder="Näiteks 3–5 aastat" /></label>
            <label><span>Staatus</span><select name="status" defaultValue={thesis.status}><option value="draft">Draft</option><option value="researching">Researching</option><option value="ready">Ready</option><option value="rejected">Rejected</option></select></label>
          </div>
          <button className="primary" type="submit">Salvesta teesi versioon</button>
        </form>
      </section>

      <section className="section"><div className="sectionHeading"><div><p className="eyebrow">AS KNOWN AT THE TIME</p><h2>Versiooniajalugu</h2></div><span className="muted">{workspace.history.length} versiooni</span></div>
        {workspace.history.length === 0 ? <div className="empty card">Ühtegi teesi versiooni pole veel salvestatud.</div> : <div className="thesisHistory">{workspace.history.map((version) => (
          <details className="card" key={version.id}><summary><span><strong>Versioon {version.version}</strong> · {version.status}{version.isCurrent ? ' · praegune' : ''}</span><span className="muted">{dateTime(version.createdAt)}</span></summary><div className="historyBody"><p>{version.summary || 'Kokkuvõte puudub.'}</p><div><span>12 kuu kontrollpunkt</span><p>{version.twelveMonthCheckpoint || 'Puudub'}</p></div><div><span>Score snapshot</span><p>{version.scoreVersion ? `${version.scoreVersion}: Growth ${version.growthScore ?? '—'}, Health ${version.healthScore ?? '—'}, Coverage ${version.coverageScore ?? '—'}` : 'Snapshot puudub'}</p></div></div></details>
        ))}</div>}
      </section>
    </main>
  );
}
