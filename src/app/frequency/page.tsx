import Link from 'next/link';
import {
  getDiscoveryFrequencyDashboard,
  type PersistenceKind,
  type TickerFrequency,
} from '@/lib/discovery-frequency';

export const dynamic = 'force-dynamic';

function shortDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`));
}

function rankChangeLabel(change: number | null): string {
  if (change == null) return '—';
  if (change === 0) return 'muutumatu';
  return change > 0 ? `+${change} (parem)` : `${change} (madalam)`;
}

function persistenceLabel(kind: PersistenceKind): { text: string; className: string } {
  if (kind === 'stale_evidence') return { text: 'sama evidence', className: 'needs-review' };
  if (kind === 'evolving_evidence') return { text: 'uus/muutunud evidence', className: 'new-catalyst' };
  return { text: 'üks kaasamine', className: 'scoreNeutral' };
}

function statusSymbol(status: 'included' | 'excluded' | 'absent'): string {
  if (status === 'included') return '●';
  if (status === 'excluded') return '○';
  return '·';
}

function FrequencyRow({ ticker }: { ticker: TickerFrequency }) {
  const persistence = persistenceLabel(ticker.persistence);
  return <article className="card validationDecision included">
    <div className="validationDecisionTop">
      <div>
        <span className={`reviewLabel ${persistence.className}`}>{persistence.text}</span>
        <Link className="ticker" href={`/company/${encodeURIComponent(ticker.ticker)}`}>{ticker.ticker}</Link>
      </div>
      <div className="decisionScores">
        <span>Streak <strong>{ticker.currentStreak}</strong></span>
        <span>Kaasatud <strong>{ticker.includedCount}</strong>/{ticker.evaluatedCount} hinnatud</span>
      </div>
    </div>
    <div className="candidateMarketMeta">
      {ticker.includedByWindow.map((window) => (
        <span key={window.window}>Viimased {window.window}: <strong>{window.included}</strong>/{window.canonicalDays}</span>
      ))}
      <span>Esimene: {shortDate(ticker.firstIncludedDate)} (#{ticker.firstRank ?? '—'})</span>
      <span>Viimane: {shortDate(ticker.lastIncludedDate)} (#{ticker.lastRank ?? '—'})</span>
      <span>Rank’i muutus: {rankChangeLabel(ticker.rankChange)}</span>
    </div>
    <div className="frequencyTimeline" title="● kaasatud · ○ hinnatud, aga välja jäetud · · universumis puudus">
      {ticker.timeline.map((entry) => (
        <span
          key={entry.decisionDate}
          className={`frequencyCell ${entry.status}`}
          title={`${entry.decisionDate}: ${entry.status}${entry.rank != null ? ` (#${entry.rank})` : ''}`}
        >{statusSymbol(entry.status)}</span>
      ))}
    </div>
  </article>;
}

export default async function FrequencyPage() {
  let dashboard = null;
  let error = '';
  try { dashboard = await getDiscoveryFrequencyDashboard(); }
  catch (caught) { error = (caught as Error).message; }

  return <main className="wrap pageStack">
    <section className="hero compact">
      <p className="eyebrow">PERSISTENCE SIGNAL · CANONICAL ONLY</p>
      <h1>Discovery Frequency V1</h1>
      <p className="lead">Kui järjekindlalt tõstab canonical päevane discovery sama tickeri esile. See on püsivussignaal, mitte kvaliteedi-, ostu- ega müügiskoor: viis päeva sama muutumatu evidence’iga on eristatud viiest päevast, mille jooksul lisandus uut infot.</p>
    </section>

    {error && <div className="notice danger">Frequency andmeid ei õnnestunud laadida: {error}</div>}

    {dashboard && <>
      <section className="section">
        <div className="sectionHeading">
          <div><p className="eyebrow">CANONICAL DECISION DAYS</p><h2>Ülevaade</h2></div>
          <span className="muted">{dashboard.canonicalDayCount} canonical otsusepäeva · {dashboard.modelVersion}</span>
        </div>
        {!dashboard.readyForInterpretation && (
          <div className="notice">
            <strong>Veel liiga vähe canonical ajalugu tõlgenduseks.</strong> Praegu {dashboard.canonicalDayCount} canonical otsusepäeva; persistence’i tõlgendus on mõttekas alles vähemalt {dashboard.minCanonicalDays} päevast. Loendurid kuvatakse ausalt, aga ära tee neist strateegiajäreldusi.
          </div>
        )}
        <p className="muted provenanceNote">
          <strong>Frequency kasutab ainult canonical (`rklb_daily`) otsuseid</strong> jooksva mudeliversiooni ({dashboard.modelVersion}) piires (docs/DISCOVERY_FREQUENCY_PROVENANCE.md § 3). Käsitsi scanneri (`rklb`) leheavamised ei osale kunagi. Vaatlusühik on üks canonical otsus Tallinna otsusekuupäeva kohta, mitte toored read. Ajalugu: {shortDate(dashboard.earliestDecisionDate)} – {shortDate(dashboard.latestDecisionDate)}.
        </p>
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div><p className="eyebrow">EVALUATED vs EXCLUDED vs ABSENT</p><h2>Kandidaatide püsivus</h2></div>
          <Link className="button secondary" href="/validation">Ava Validation</Link>
        </div>
        <p className="muted">Timeline (viimased kuni {dashboard.windows[dashboard.windows.length - 1]} canonical päeva): <strong>●</strong> kaasatud · <strong>○</strong> hinnatud, aga välja jäetud · <strong>·</strong> universumis puudus. Järjestus: kaasamiste arv, siis streak, siis ticker — koondskoori pole.</p>
        {dashboard.tickers.length === 0
          ? <div className="empty card"><strong>Ükski kandidaat pole veel üheski canonical jooksus kaasatud.</strong><p>Frequency täitub, kui päevane canonical discovery hakkab tickereid kaasama.</p></div>
          : <div className="validationDecisions">{dashboard.tickers.map((ticker) => <FrequencyRow ticker={ticker} key={ticker.ticker} />)}</div>}
      </section>
    </>}
  </main>;
}
