import Link from 'next/link';
import {
  getTodayBrief,
  type TodayBrief,
  type TodayBriefStatus,
  type TodayCandidateWarning,
} from '@/lib/today-brief';

export const dynamic = 'force-dynamic';

const statusLabel: Record<TodayBriefStatus, string> = {
  ok: 'OK',
  waiting: 'WAITING',
  warning: 'WARNING',
};

const horizonLabel: Record<string, string> = {
  '1w': '1 nädal',
  '2w': '2 nädalat',
  '1m': '1 kuu',
  '3m': '3 kuud',
  '6m': '6 kuud',
};

function formatPercent(value: number | null): string {
  return value == null ? 'unknown' : `${value.toLocaleString('et-EE', { maximumFractionDigits: 1 })}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'unknown';
  return new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value: string | null): string {
  if (!value) return 'unknown';
  return new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    dateStyle: 'medium',
  }).format(new Date(value));
}

function score(value: number | null): string {
  return value == null ? '—' : String(value);
}

function warningClass(warning: TodayCandidateWarning): string {
  return warning.code === 'not_relevant_mandate'
    || warning.code === 'negative_fcf'
    || warning.code === 'dilution_warning'
    ? 'critical'
    : 'warning';
}

function EmptyBrief({ error }: { error: string }) {
  return (
    <main className="wrap pageStack">
      <section className="hero compact">
        <p className="eyebrow">READ-ONLY RESEARCH COCKPIT</p>
        <h1>Today&apos;s Research Brief</h1>
        <p className="lead">Hommikune uurimistöö sissepääs, mitte trading recommendation.</p>
      </section>
      <div className="notice danger">Brief&apos;i laadimine ebaõnnestus: {error}</div>
    </main>
  );
}

export default async function TodayPage() {
  let brief: TodayBrief;
  try {
    brief = await getTodayBrief();
  } catch (error) {
    return <EmptyBrief error={(error as Error).message} />;
  }

  const collection = brief.latestCollectionRun;
  const quality = brief.dataQuality;
  const canonical = brief.latestCanonicalRun;

  return (
    <main className="wrap pageStack todayBrief">
      <section className="todayHero">
        <div>
          <p className="eyebrow">READ-ONLY RESEARCH COCKPIT</p>
          <h1>Today&apos;s Research Brief</h1>
          <p className="lead">Tallinn · {brief.todayTallinnDate}. Vaata 30 sekundiga üle, mis vajab täna inimese research&apos;i.</p>
        </div>
        <span className={`todayStatus ${brief.status}`}>{statusLabel[brief.status]}</span>
      </section>

      <div className="notice">
        Kõrge skoor tähendab “uuri lähemalt”, mitte “osta”. See leht ei värskenda andmeid, ei arvuta rankingut uuesti ega esita orderit.
      </div>

      {brief.warnings.filter((warning) => warning.severity !== 'info').map((warning) => (
        <div className={`notice ${warning.severity === 'critical' ? 'danger' : ''}`} key={warning.code}>
          {warning.message}
        </div>
      ))}

      <section className="todayMetrics" aria-label="Today summary">
        <article className="metric">
          <span>Canonical history</span>
          <strong>{brief.canonicalRunCount}</strong>
          <small>{canonical ? `latest ${canonical.decisionDate} · #${canonical.id}` : 'no canonical runs'}</small>
        </article>
        <article className="metric">
          <span>Included today/latest</span>
          <strong>{canonical?.includedCount ?? 0}</strong>
          <small>{canonical ? `${canonical.evaluatedCount} evaluated` : 'no decision snapshot'}</small>
        </article>
        <article className="metric">
          <span>SEC coverage</span>
          <strong>{formatPercent(quality?.secCoveragePercent ?? null)}</strong>
          <small>{quality ? `${quality.companiesWithSecFacts}/${quality.companiesTotal} companies` : 'quality snapshot missing'}</small>
        </article>
        <article className="metric">
          <span>Data quality</span>
          <strong className={quality?.status === 'ok' ? 'positive' : 'negative'}>{quality?.status.toUpperCase() ?? 'UNKNOWN'}</strong>
          <small>{quality ? `${quality.staleFinancialsCount} stale · ${quality.missingSectorCount} sector missing` : 'not auditable'}</small>
        </article>
        <article className="metric">
          <span>Outcomes</span>
          <strong>{brief.outcomes.pendingCount} / {brief.outcomes.measuredCount}</strong>
          <small>pending / measured</small>
        </article>
      </section>

      <section className="todayRunStrip card">
        <div>
          <span>Latest canonical</span>
          <strong>{canonical ? `${canonical.decisionDate} · ${canonical.modelVersion}` : 'Not available'}</strong>
          <small>{canonical ? `captured ${formatDateTime(canonical.runAt)} · input changed after snapshot: unknown` : 'Waiting for first canonical run'}</small>
        </div>
        <div>
          <span>Latest collect</span>
          <strong className={collection?.status === 'failure' ? 'negative' : collection?.status === 'success' ? 'positive' : ''}>
            {collection ? `${collection.status.toUpperCase()} · #${collection.id}` : 'Not available'}
          </strong>
          <small>{collection ? `${formatDateTime(collection.startedAt)} · ${collection.durationMs ?? '—'} ms · ${collection.trigger}` : 'No ledger rows'}</small>
        </div>
        <div>
          <span>Collection scope</span>
          <strong>{collection?.metrics.scanned ?? '—'} scanned · {collection?.metrics.candidates ?? '—'} candidates</strong>
          <small>{collection?.metrics.marketDataTotal == null ? 'lookup metrics unknown' : `${collection.metrics.marketDataGrowth ?? 0} growth + ${collection.metrics.marketDataRecall ?? 0} recall lookups`}</small>
        </div>
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">START HERE</p>
            <h2>Top candidates</h2>
          </div>
          <small>{canonical ? `Immutable run #${canonical.id} decisions` : 'No run available'}</small>
        </div>
        {brief.topCandidates.length === 0 ? (
          <div className="empty card">Latest canonical run ei sisaldanud ühtegi kandidaati. Null kandidaati on korrektne research-tulemus.</div>
        ) : (
          <div className="tableWrap card todayTable">
            <table>
              <thead>
                <tr><th>Rank</th><th>Company</th><th>Scores</th><th>Coverage</th><th>Mandate</th><th>Catalyst</th><th>Bucket</th><th>Warnings</th></tr>
              </thead>
              <tbody>
                {brief.topCandidates.map((candidate) => (
                  <tr key={candidate.decisionId}>
                    <td><strong>#{candidate.rank ?? '—'}</strong></td>
                    <td>
                      <Link className="ticker" href={`/company/${encodeURIComponent(candidate.ticker)}`}>{candidate.ticker}</Link>
                      <small>{candidate.companyName || 'Name unavailable'}</small>
                      <small>{candidate.decisionPrice == null ? 'Decision price unknown' : `${candidate.decisionPrice.toLocaleString('et-EE', { maximumFractionDigits: 2 })} ${candidate.currency || ''}`}</small>
                    </td>
                    <td><strong>G {score(candidate.growthScore)} · H {score(candidate.healthScore)}</strong></td>
                    <td><span className={candidate.coverageScore >= 70 ? 'positive' : 'negative'}>{candidate.coverageScore}</span></td>
                    <td><span className="todayTag">{candidate.mandateRelevance}</span></td>
                    <td>
                      <strong>{candidate.catalystStatus}</strong>
                      <small>tier {candidate.catalystTier ?? 'unknown'} · {candidate.catalystMateriality}</small>
                    </td>
                    <td><span className={`todayTag ${candidate.lookupBucket}`}>{candidate.lookupBucket}</span></td>
                    <td>
                      <div className="todayWarningList">
                        {candidate.warnings.length === 0 && <small>None recorded</small>}
                        {candidate.warnings.map((warning) => (
                          <span className={`todayWarning ${warningClass(warning)}`} key={warning.code}>{warning.label}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="todayTwoColumn">
        <article className="card todayPanel">
          <div>
            <p className="eyebrow">HUMAN CHECK</p>
            <h2>Needs review</h2>
          </div>
          {brief.watchItems.length === 0 ? (
            <p className="muted">Ühtegi eraldi review-itemit ei tuletatud. Kontrolli siiski kandidaatide algallikaid.</p>
          ) : (
            <div className="todayReviewList">
              {brief.watchItems.map((item, index) => (
                <article key={`${item.code}-${item.ticker || index}`} className={item.severity}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  {item.href && <Link href={item.href}>Review →</Link>}
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card todayPanel">
          <div>
            <p className="eyebrow">DAY-OVER-DAY</p>
            <h2>What changed?</h2>
          </div>
          {!brief.changes.available ? (
            <p className="muted">Võrdluseks pole veel eelmist canonical päeva.</p>
          ) : (
            <>
              <p className="muted">Võrdlus run #{brief.changes.previousRunId} kuupäevaga {brief.changes.previousDecisionDate}.</p>
              {brief.changes.modelVersionChanged && <div className="notice">Mudeli versioon muutus; muutus ei pruugi olla ainult uue evidence&apos;i tulemus.</div>}
              <div className="changeGroup"><strong>New included</strong><div>{brief.changes.newIncludedTickers.length ? brief.changes.newIncludedTickers.map((ticker) => <span className="todayTag positiveTag" key={ticker}>{ticker}</span>) : <small>None</small>}</div></div>
              <div className="changeGroup"><strong>Removed</strong><div>{brief.changes.removedTickers.length ? brief.changes.removedTickers.map((ticker) => <span className="todayTag negativeTag" key={ticker}>{ticker}</span>) : <small>None</small>}</div></div>
              <div className="changeGroup"><strong>Repeated</strong><div>{brief.changes.repeatedTickers.length ? brief.changes.repeatedTickers.map((ticker) => <span className="todayTag" key={ticker}>{ticker}</span>) : <small>None</small>}</div></div>
            </>
          )}
        </article>
      </section>

      <section className="todayTwoColumn">
        <article className="card todayPanel">
          <div>
            <p className="eyebrow">INPUT INTEGRITY</p>
            <h2>Data quality</h2>
          </div>
          {!quality ? <p className="muted">Latest run&apos;i quality snapshot puudub.</p> : (
            <>
              <div className="todayQualityGrid">
                <span>SEC<strong>{formatPercent(quality.secCoveragePercent)}</strong></span>
                <span>Scores<strong>{formatPercent(quality.scoreCoveragePercent)}</strong></span>
                <span>Sector<strong>{formatPercent(quality.sectorCoveragePercent)}</strong></span>
                <span>Recent price<strong>{formatPercent(quality.recentPriceCoveragePercent)}</strong></span>
              </div>
              <p className="muted">Missing financials {quality.missingFinancialsCount} · missing sector {quality.missingSectorCount} · stale financials {quality.staleFinancialsCount}.</p>
              {quality.warnings.length > 0 && <ul className="todayPlainList">{quality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            </>
          )}
        </article>

        <article className="card todayPanel">
          <div>
            <p className="eyebrow">FORWARD TRACKING</p>
            <h2>Next measured outcomes</h2>
          </div>
          {brief.outcomes.nextMeasurable.length === 0 ? <p className="muted">Pending target dates puuduvad.</p> : (
            <div className="todayOutcomeList">
              {brief.outcomes.nextMeasurable.map((item) => (
                <div key={item.horizon}>
                  <strong>{horizonLabel[item.horizon] || item.horizon}</strong>
                  <span>{item.count} pending</span>
                  <small>first measurable {formatDate(item.firstTargetAt)}</small>
                </div>
              ))}
            </div>
          )}
          <Link href="/validation">Open validation →</Link>
        </article>
      </section>

      <section className="card todayPanel">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">POINT-IN-TIME FOLLOW-UP</p>
            <h2>Missed moves</h2>
          </div>
          <Link href="/missed-moves">Open full audit →</Link>
        </div>
        {!brief.missedMovesSummary.available ? <p className="muted">No missed move summary available in this slice.</p> : (
          <>
            <div className="todayMissedCounts">
              <span>Total<strong>{brief.missedMovesSummary.total}</strong></span>
              <span>Included<strong>{brief.missedMovesSummary.byReason.included}</strong></span>
              <span>Excluded<strong>{brief.missedMovesSummary.byReason.excluded}</strong></span>
              <span>Radar gap<strong>{brief.missedMovesSummary.byReason.radar_data_gap}</strong></span>
              <span>Universe gap<strong>{brief.missedMovesSummary.byReason.universe_gap}</strong></span>
            </div>
            {brief.missedMovesSummary.recent.length === 0 ? <p className="muted">Viimase 60 päeva salvestatud hindades pole vähemalt 8% missed-move juhtumeid.</p> : (
              <div className="todayMoveList">
                {brief.missedMovesSummary.recent.map((move) => (
                  <div key={`${move.ticker}-${move.observedDate}`}>
                    <Link className="ticker" href={`/company/${encodeURIComponent(move.ticker)}`}>{move.ticker}</Link>
                    <strong className={move.changePercent >= 0 ? 'positive' : 'negative'}>{move.changePercent >= 0 ? '+' : ''}{move.changePercent.toLocaleString('et-EE', { maximumFractionDigits: 1 })}%</strong>
                    <span>{move.priorCoverage}</span>
                    <small>{move.previousDate} → {move.observedDate}</small>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
