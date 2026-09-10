import Link from 'next/link';
import CandidateSituationSummary from '@/components/CandidateSituationSummary';
import Form4PurchaseEvidence from '@/components/Form4PurchaseEvidence';
import { getPriceTrackingSummary } from '@/lib/price-tracking';
import {
  getThesisReviewQueue,
  type ThesisAssumptionState,
  type ThesisReviewItem,
  type ThesisReviewState,
} from '@/lib/thesis-review-queue';
import {
  getCatalystStatusLabel,
  getTodayBrief,
  type TodayBrief,
  type TodayBriefStatus,
  type TodayCandidate,
  type TodayCandidateWarning,
} from '@/lib/today-brief';

export const dynamic = 'force-dynamic';

const statusContent: Record<TodayBriefStatus, { badge: string; title: string; detail: string }> = {
  ready: { badge: 'READY', title: 'System ready', detail: "Today's daily snapshot exists, collection succeeded, and no major candidate review flags were found." },
  waiting: { badge: 'WAITING', title: "Waiting for today's canonical run", detail: "The latest shortlist may be useful context, but it is not today's fresh research snapshot." },
  attention: { badge: 'ATTENTION', title: 'Research needs review', detail: 'The system completed, but candidate-level evidence or a material research gap needs a human check.' },
  error: { badge: 'ERROR', title: 'Latest collection failed', detail: 'Treat the shortlist as stale until the collection error has been understood.' },
};

const horizonLabel: Record<string, string> = {
  '1w': '1 week', '2w': '2 weeks', '1m': '1 month', '3m': '3 months', '6m': '6 months',
};

const priorityLabel = {
  review_first: 'Review first',
  promising: 'High research priority',
  watch: 'Watch and verify',
  low_priority: 'Lower priority',
};

const thesisReviewLabel: Record<ThesisReviewState, string> = {
  review_due: 'Review due',
  awaiting_evidence: 'Awaiting evidence',
  reviewed: 'Reviewed',
};

const assumptionStateLabel: Record<ThesisAssumptionState, string> = {
  review_due: 'Check against new evidence',
  awaiting_evidence: 'Awaiting evidence',
  reviewed: 'Reviewed in current version',
  missing: 'Not recorded',
};

function formatPercent(value: number | null): string {
  return value == null ? 'Unknown' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

function formatSignedPercent(value: number | null): string {
  if (value == null) return 'Insufficient price history';
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

function formatPrice(value: number | null, currency: string | null): string {
  if (value == null) return 'Unavailable';
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tallinn', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDate(value: string | null): string {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tallinn', dateStyle: 'medium' }).format(new Date(value));
}

function warningClass(warning: TodayCandidateWarning): string {
  return warning.code === 'not_relevant_mandate' || warning.code === 'negative_fcf' || warning.code === 'dilution_warning'
    ? 'critical' : 'warning';
}

function humanValue(value: string): string {
  if (value === 'fits') return 'Fits mandate';
  if (value === 'partial') return 'Partial mandate fit';
  if (value === 'not_relevant') return 'Off mandate';
  return value === 'unknown' ? 'Unknown' : value.replaceAll('_', ' ');
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function CandidateCard({ candidate }: { candidate: TodayCandidate }) {
  const summary = candidate.researchSummary;
  const risks = unique(summary.riskBullets);
  const strengths = summary.reasonBullets;
  const hasStoredEvidence = candidate.reasons.length > 0 || candidate.risks.length > 0 || candidate.unknowns.length > 0;
  const catalystStatus = getCatalystStatusLabel(
    candidate.catalystEvidenceStatus !== 'unknown' ? candidate.catalystEvidenceStatus : candidate.catalystStatus,
  );

  return (
    <article className={`todayCandidateCard ${summary.priority}`}>
      <div className="todayCandidateTop">
        <div className="todayCandidateIdentity">
          <span className="todayRank">#{candidate.rank ?? '—'}</span>
          <div>
            <Link className="ticker" href={`/company/${encodeURIComponent(candidate.ticker)}`}>{candidate.ticker}</Link>
            <small>{candidate.companyName || 'Company name unavailable'}</small>
            {candidate.ownershipBadges.length > 0 && (
              <div className="todayOwnershipBadges" aria-label={`${candidate.ticker} research ownership`}>
                {candidate.ownershipBadges.map((badge) => (
                  <Link className={`todayOwnershipBadge ${badge.kind}`} href={badge.href} key={badge.kind}>{badge.label}</Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className={`todayPriority ${summary.priority}`}>{priorityLabel[summary.priority]}</span>
      </div>

      <div className="todayWhy">
        <span>Why research this today?</span>
        <strong>{summary.headline}</strong>
      </div>

      <CandidateSituationSummary
        ticker={candidate.ticker}
        growthScore={candidate.growthScore}
        healthScore={candidate.healthScore}
        coverageScore={candidate.coverageScore}
        currentCollectionConfirmed={candidate.currentCollectionConfirmed}
        priceContext={candidate.priceContext}
        priceCapturedAt={candidate.priceCapturedAt}
      />

      {candidate.rankComparisonToNext && (
        <div className={`todayRankComparison ${candidate.rankComparisonToNext.consistentWithComparator ? '' : 'mismatch'}`}>
          <span>Why this rank?</span>
          <strong>{candidate.rankComparisonToNext.summary}</strong>
          <small>Actual comparator order: Supported criteria → Catalyst tier → Fundamental Growth → Coverage → Financial Health.</small>
        </div>
      )}

      {candidate.inlineChanges.length > 0 && (
        <div className="todayInlineChanges">
          <span>Changed since the previous same-model snapshot</span>
          <div>{candidate.inlineChanges.map((change) => (
            <small key={change.field}><strong>{change.label}</strong> {change.previousValue} → {change.currentValue}</small>
          ))}</div>
        </div>
      )}

      <div className="todayCandidateSignals">
        <span>Fundamental Growth <strong>{candidate.growthScore == null ? '—' : `${candidate.growthScore}/100`}</strong></span>
        <span>Health <strong>{candidate.healthScore == null ? '—' : `${candidate.healthScore}/100`}</strong></span>
        <span>Coverage <strong>{candidate.coverageScore}/100</strong></span>
        <span>{humanValue(candidate.mandateRelevance)}</span>
        <span>{catalystStatus}</span>
        <span className={candidate.provenanceKnown ? undefined : 'todayTraceSignal'}>{candidate.sourcePathLabel}</span>
      </div>

      {candidate.warnings.length > 0 && (
        <div className="todayWarningList" aria-label={`${candidate.ticker} warnings`}>
          {candidate.warnings.map((warning) => <span className={`todayWarning ${warningClass(warning)}`} key={warning.code}>{warning.label}</span>)}
        </div>
      )}

      <details className="todayCandidateDetail">
        <summary>Compare price, valuation, evidence and risks</summary>
        <section className="todayPriceContext">
          <div className="todaySubsectionHeading">
            <div><p className="eyebrow">ENTRY CONTEXT</p><h3>Price Context</h3></div>
            <span className={`todayHistoryStatus ${candidate.priceContext.historyStatus}`}>{candidate.priceContext.historyStatus} history</span>
          </div>
          <p className="muted">Fundamental Growth measures reported business growth. It does not measure recent share-price momentum or whether today&apos;s entry price is attractive.</p>
          <div className="todayPriceGrid">
            <span>Decision price<strong>{formatPrice(candidate.decisionPrice, candidate.currency)}</strong></span>
            <span>1 month<strong>{formatSignedPercent(candidate.priceContext.oneMonthReturnPercent)}</strong></span>
            <span>3 months<strong>{formatSignedPercent(candidate.priceContext.threeMonthReturnPercent)}</strong></span>
            <span>6 months<strong>{formatSignedPercent(candidate.priceContext.sixMonthReturnPercent)}</strong></span>
            <span>From stored 52w high<strong>{formatSignedPercent(candidate.priceContext.distanceFrom52WeekHighPercent)}</strong><small>{candidate.priceContext.fiftyTwoWeekHigh == null ? '' : `High ${formatPrice(candidate.priceContext.fiftyTwoWeekHigh, candidate.currency)}`}</small></span>
            <span>From stored 52w low<strong>{formatSignedPercent(candidate.priceContext.distanceFrom52WeekLowPercent)}</strong><small>{candidate.priceContext.fiftyTwoWeekLow == null ? '' : `Low ${formatPrice(candidate.priceContext.fiftyTwoWeekLow, candidate.currency)}`}</small></span>
          </div>
          {candidate.priceContext.historyStatus !== 'sufficient' && <div className="todayHistoryNotice"><strong>Insufficient price history</strong><span>Only stored observations are used; unavailable periods are not estimated.</span></div>}
          {candidate.priceContext.recentRunUp && <div className="todayRunUpNotice"><strong>Recent run-up warning</strong><span>{candidate.priceContext.recentRunUpReasons.join(' · ')}. Review valuation and entry risk before trusting the fundamental rank.</span></div>}
          <small className="todaySubtle">{candidate.priceContext.observationCount} stored price observations through the daily snapshot time.</small>
        </section>

        <section className="todayScenarioValuation">
          <div className="todaySubsectionHeading"><div><p className="eyebrow">MECHANICAL SENSITIVITY</p><h3>Scenario Valuation V1</h3></div></div>
          {candidate.scenarioValuation.status === 'unavailable' ? (
            <div className="todayHistoryNotice"><strong>Scenario valuation unavailable</strong><span>{candidate.scenarioValuation.reason}</span></div>
          ) : (
            <>
              <p className="muted">Uses the decision-time {candidate.scenarioValuation.anchorLabel} anchor ({candidate.scenarioValuation.anchorValue?.toLocaleString('en-US', { maximumFractionDigits: 1 })}{candidate.scenarioValuation.anchorUnit}) and the exact fundamentals linked to the stored score snapshot. These are transparent sensitivities, not price targets.</p>
              <div className="todayScenarioGrid">
                {candidate.scenarioValuation.scenarios.map((scenario) => (
                  <article className={scenario.case} key={scenario.case}>
                    <span>{scenario.case}</span>
                    <strong>{formatPrice(scenario.impliedPrice, candidate.currency)}</strong>
                    <b className={scenario.upsideDownsidePercent >= 0 ? 'positive' : 'negative'}>{formatSignedPercent(scenario.upsideDownsidePercent)}</b>
                    <ul>{scenario.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
                  </article>
                ))}
              </div>
              <small className="todaySubtle">Confidence: {candidate.scenarioValuation.confidence} · Basis: {candidate.scenarioValuation.anchorBasis?.replaceAll('_', ' ') || 'unknown'} · Fundamental period: {candidate.scenarioValuation.lastUpdated || 'unknown'}.</small>
            </>
          )}
        </section>

        <div className="todayCandidateDetailGrid">
          <section><h3>Main strengths</h3><ul>{strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section>
            <h3>Main risks</h3>
            {risks.length > 0 ? <ul>{risks.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No major candidate-level warning is stored. This is not proof that the investment is low risk.</p>}
          </section>
          <section>
            <h3>Evidence summary</h3>
            <p><strong>{catalystStatus}</strong></p>
            <p><strong>{candidate.catalystSummary.headline}</strong></p>
            <p>{candidate.catalystSummary.assessment}</p>
            {candidate.catalystAt && <p>Event date: {formatDate(candidate.catalystAt)}</p>}
            {candidate.catalystUrl ? <a href={candidate.catalystUrl} target="_blank" rel="noreferrer">Open stored catalyst source ↗</a> : <p className="muted">Full source detail may be available in company detail.</p>}
            <details className="todayTechnicalDetails">
              <summary>Technical details</summary>
              <dl>
                <div><dt>Evidence status</dt><dd>{candidate.catalystEvidenceStatus}</dd></div>
                <div><dt>Criterion status</dt><dd>{candidate.catalystStatus}</dd></div>
                <div><dt>Tier</dt><dd>{candidate.catalystTier ?? 'unknown'}</dd></div>
                <div><dt>Event kind</dt><dd>{candidate.catalystEventKind || 'unknown'}</dd></div>
                <div><dt>Source kind</dt><dd>{candidate.catalystSourceKind || 'unknown'}</dd></div>
                <div><dt>Materiality</dt><dd>{candidate.catalystMateriality}</dd></div>
                <div><dt>Direction</dt><dd>{candidate.catalystDirection || 'unknown'}</dd></div>
                <div><dt>Novelty</dt><dd>{candidate.catalystNovelty || 'unknown'}</dd></div>
                <div><dt>Thesis relevance</dt><dd>{candidate.catalystThesisRelevance || 'unknown'}</dd></div>
                <div><dt>Mandate relevance</dt><dd>{candidate.mandateRelevance}</dd></div>
                <div><dt>Evidence freshness</dt><dd>{candidate.catalystEvidenceFreshness || 'unknown'}</dd></div>
                <div><dt>Linked period</dt><dd>{candidate.catalystLinkedPeriodEnd || 'unknown'}</dd></div>
              </dl>
              <p>{candidate.catalystDetail ? `Stored detail: ${candidate.catalystDetail}` : 'Stored event detail is unavailable.'}</p>
            </details>
          </section>
          <section>
            <h3>Data quality notes</h3>
            <p>{candidate.warnings.length > 0 ? candidate.warnings.map((warning) => warning.label).join(' · ') : 'No candidate-level quality flags recorded.'}</p>
            {!candidate.provenanceKnown && <p className="todaySubtle">Source path is not linked to a collection item; this is a traceability note, not a thesis warning.</p>}
          </section>
        </div>
        {candidate.insiderEvidence && <Form4PurchaseEvidence evidence={candidate.insiderEvidence} />}
        {hasStoredEvidence && (
          <details className="todayStoredEvidence">
            <summary>Stored decision evidence (verbatim)</summary>
            {candidate.reasons.length > 0 && <div><strong>Reasons</strong><ul>{candidate.reasons.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            {candidate.risks.length > 0 && <div><strong>Risks</strong><ul>{candidate.risks.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            {candidate.unknowns.length > 0 && <div><strong>Unknowns</strong><ul>{candidate.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          </details>
        )}
        <Link className="button secondary todayDetailLink" href={`/company/${encodeURIComponent(candidate.ticker)}`}>Open full company evidence →</Link>
      </details>
    </article>
  );
}

function ThesisReviewCard({ item }: { item: ThesisReviewItem }) {
  const priceCurrenciesMatch = item.decisionCurrency != null
    && item.latestCurrency != null
    && item.decisionCurrency === item.latestCurrency;
  return (
    <article className={`thesisReviewCard ${item.state}`}>
      <div className="thesisReviewTop">
        <div>
          <Link className="ticker" href={`/thesis/${item.positionId}`}>{item.ticker}</Link>
          <small>{item.companyName || 'Company name unavailable'} · thesis v{item.thesisVersion} · {item.thesisStatus}</small>
        </div>
        <span className={`thesisReviewState ${item.state}`}>{thesisReviewLabel[item.state]}</span>
      </div>

      <div className="thesisReviewPrices">
        <span>Decision price<strong>{formatPrice(item.decisionPrice, item.decisionCurrency)}</strong><small>{formatDate(item.decisionPriceAt)}</small></span>
        <span>Latest stored price<strong>{formatPrice(item.latestPrice, item.latestCurrency)}</strong><small>{formatDate(item.latestPriceAt)}</small></span>
        <span>Since decision<strong>{priceCurrenciesMatch ? formatSignedPercent(item.priceChangePercent) : 'Unavailable'}</strong><small>{priceCurrenciesMatch ? 'Price context only' : 'Currency comparison unavailable'}</small></span>
      </div>

      <div className="thesisReviewTrigger">
        <span>Next review trigger</span>
        <p>{item.nextReviewTrigger || 'No explicit trigger was recorded.'}</p>
      </div>

      {item.state === 'review_due' && (
        <div className="thesisDueEvidence">
          <strong>New evidence needs a human review</strong>
          <ul>{item.dueEvidence.map((evidence, index) => (
            <li key={`${evidence.kind}-${evidence.occurredAt}-${index}`}>
              {evidence.sourceUrl
                ? <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">{evidence.label} ↗</a>
                : evidence.label}
              <small>{formatDate(evidence.occurredAt)}</small>
            </li>
          ))}</ul>
        </div>
      )}
      {item.state === 'awaiting_evidence' && (
        <p className="thesisAwaiting">Next scheduled results: <strong>{formatDateTime(item.nextEarningsAt)}</strong></p>
      )}
      {item.state === 'reviewed' && (
        <p className="thesisAwaiting">No newer qualifying evidence or future results date is stored.</p>
      )}

      <details className="thesisAssumptionReview">
        <summary>Review all recorded assumptions</summary>
        <div>{item.assumptions.map((assumption) => (
          <article key={assumption.key}>
            <div><strong>{assumption.label}</strong><span className={assumption.state}>{assumptionStateLabel[assumption.state]}</span></div>
            <p>{assumption.text || 'No hypothesis is recorded in the current thesis version.'}</p>
          </article>
        ))}</div>
      </details>
      <Link className="button secondary thesisReviewLink" href={`/thesis/${item.positionId}`}>Open Thesis Builder →</Link>
    </article>
  );
}

function EmptyBrief({ error }: { error: string }) {
  return <main className="wrap pageStack"><section className="hero compact"><p className="eyebrow">READ-ONLY RESEARCH COCKPIT</p><h1>Today&apos;s Research Brief</h1><p className="lead">A research starting point, not a trading recommendation.</p></section><div className="notice danger">Could not load the brief: {error}</div></main>;
}

export default async function TodayPage() {
  let brief: TodayBrief;
  try { brief = await getTodayBrief(); } catch (error) { return <EmptyBrief error={(error as Error).message} />; }
  const tracking = await getPriceTrackingSummary().catch(() => ({ available: false, waiting: 0, rows: [] }));
  const thesisReviews = await getThesisReviewQueue().catch(() => null);

  const collection = brief.latestCollectionRun;
  const quality = brief.dataQuality;
  const canonical = brief.latestCanonicalRun;
  const status = statusContent[brief.status];
  const nextOutcome = brief.outcomes.nextMeasurable[0] || null;
  const topMissedMoves = brief.missedMovesSummary.recent.slice(0, 3);
  const remainingMissedMoves = brief.missedMovesSummary.recent.slice(3);

  return (
    <main className="wrap pageStack todayBrief">
      <section className="todayHero">
        <div><p className="eyebrow">DAILY RESEARCH SNAPSHOT · {brief.todayTallinnDate}</p><h1>Today&apos;s Research Brief</h1><p className="lead">Choose what deserves a closer look in under 30 seconds.</p></div>
        <div className="todaySystemStatus"><span className={`todayStatus ${brief.status}`}>{status.badge}</span><div><strong>{status.title}</strong><small>{status.detail}</small></div></div>
      </section>

      <div className="todayGuardrail">High scores mean “research further”. “Eligible for paper entry” is the app&apos;s clearest positive state: the entry-aware rules would create a hypothetical buy intent, but this page remains read-only and places no real order.</div>
      <section className="card">
        <h2>Continued price tracking</h2>
        <p>Open holdings, active/watchlist research and outstanding outcome horizons are checked separately from discovery. Up to 50 symbols per New York day, including SPY. These follow-up prices do not rewrite the daily snapshot above.</p>
        {tracking.available && <p>{tracking.waiting} eligible symbols still awaiting a check today. A quote gap is retried on the next day; it never becomes a zero price.</p>}
        {!tracking.available ? <p>Tracking unavailable; migration 0009 is required or the database could not be read.</p>
          : tracking.rows.length === 0 ? <p>No tracking attempts recorded yet.</p>
            : <details><summary>Latest batch: {tracking.rows.length} symbols · {tracking.rows.filter((row) => !['saved', 'unchanged'].includes(row.status)).length} quote gaps · {formatDateTime(tracking.rows[0].attempted_at.toISOString())}</summary>
              <ul>{tracking.rows.map((row) => <li key={row.ticker}><strong>{row.ticker}</strong>: {row.status} · {row.reasons.join(', ')} · market time {row.market_at ? formatDateTime(row.market_at.toISOString()) : 'unknown'}</li>)}</ul>
            </details>}
      </section>

      <section className="todayQuickFacts" aria-label="Research brief summary">
        <span><strong>{canonical?.includedCount ?? 0}</strong> research candidates</span>
        <span><strong>{formatPercent(quality?.secCoveragePercent ?? null)}</strong> SEC coverage</span>
        <span><strong>{brief.watchItems.filter((item) => item.ticker).length}</strong> candidate checks</span>
        <span><strong>{thesisReviews?.dueCount ?? '—'}</strong> thesis reviews due</span>
        <span><strong>{nextOutcome ? formatDate(nextOutcome.firstTargetAt) : 'Unknown'}</strong> next measurable</span>
      </section>

      <section className="section thesisReviewSection">
        <div className="sectionHeading">
          <div><p className="eyebrow">THESIS REVIEW QUEUE</p><h2>What needs a decision?</h2></div>
          <small>Current theses · stored evidence only</small>
        </div>
        <p className="muted">A new thesis version records that you reviewed the evidence. The queue becomes due when a newer financial filing, a qualifying assessed SEC event, or a passed results date appears. Free-text assumptions are never converted into automatic pass/fail claims.</p>
        {!thesisReviews
          ? <div className="empty card">Thesis review queue unavailable. The daily research snapshot remains unchanged.</div>
          : thesisReviews.items.length === 0
            ? <div className="empty card">No current active/watchlist thesis is available for review.</div>
            : <div className="thesisReviewGrid">{thesisReviews.items.map((item) => <ThesisReviewCard item={item} key={item.thesisId} />)}</div>}
      </section>

      <section className="section todayCandidateSection">
        <div className="sectionHeading"><div><p className="eyebrow">START HERE</p><h2>Why research these today?</h2></div><small>{canonical ? `Stored daily snapshot #${canonical.id} · ${canonical.decisionDate}` : 'No daily snapshot available'}</small></div>
        {brief.topCandidates.length === 0 ? <div className="empty card">The latest daily snapshot contains no candidates. Zero candidates is a valid research result.</div> : <div className="todayCandidateList">{brief.topCandidates.map((candidate) => <CandidateCard candidate={candidate} key={candidate.decisionId} />)}</div>}
      </section>

      <section className="todayTwoColumn">
        <article className="card todayPanel">
          <div><p className="eyebrow">HUMAN CHECK</p><h2>Needs review</h2></div>
          {brief.watchItems.length === 0 ? <p className="muted">No high-value review item was derived. Verify primary evidence before making any investment decision.</p> : <div className="todayReviewList">{brief.watchItems.map((item, index) => <article key={`${item.code}-${item.ticker || index}`} className={item.severity}><div><strong>{item.title}</strong><p>{item.detail}</p></div>{item.href && <Link href={item.href}>Review →</Link>}</article>)}</div>}
        </article>

        <article className="card todayPanel">
          <div><p className="eyebrow">DAY-OVER-DAY</p><h2>What changed?</h2></div>
          {!brief.changes.available ? <p className="muted">No previous daily snapshot is available for comparison.</p> : <>
            <p className="muted">Compared with {brief.changes.previousDecisionDate}.</p>
            {brief.changes.modelVersionChanged && <div className="notice">Model version changed; interpret deltas cautiously.</div>}
            <div className="changeGroup"><strong>New</strong><div>{brief.changes.newIncludedTickers.length ? brief.changes.newIncludedTickers.map((ticker) => <span className="todayTag positiveTag" key={ticker}>{ticker}</span>) : <small>None</small>}</div></div>
            <div className="changeGroup"><strong>Removed</strong><div>{brief.changes.removedTickers.length ? brief.changes.removedTickers.map((ticker) => <span className="todayTag negativeTag" key={ticker}>{ticker}</span>) : <small>None</small>}</div></div>
            <div className="todayChangeList">{brief.changes.repeated.filter((change) => change.changedFields.length > 0).map((change) => <div key={change.ticker}><strong>{change.ticker}</strong>{change.changedFields.map((field) => <small key={field.field}>{field.label} {field.previousValue} → {field.currentValue}</small>)}</div>)}</div>
            {brief.changes.repeated.length > 0 && brief.changes.repeated.every((change) => change.changedFields.length === 0) && <small className="muted">Repeated candidates have no stored rank or evidence-field changes.</small>}
          </>}
        </article>
      </section>

      <section className="todayTwoColumn">
        <article className="card todayPanel">
          <div><p className="eyebrow">UNIVERSE HEALTH</p><h2>Input coverage</h2></div>
          {!quality ? <p className="muted">The latest daily snapshot has no quality snapshot.</p> : <><div className="todayQualityGrid"><span>SEC facts<strong>{formatPercent(quality.secCoveragePercent)}</strong></span><span>Scores<strong>{formatPercent(quality.scoreCoveragePercent)}</strong></span><span>Sector<strong>{formatPercent(quality.sectorCoveragePercent)}</strong></span><span>Recent price<strong>{formatPercent(quality.recentPriceCoveragePercent)}</strong></span></div><p className="muted">{quality.missingFinancialsCount} missing financials · {quality.missingSectorCount} missing sector · {quality.staleFinancialsCount} stale financials.</p>{quality.warnings.length > 0 && <details className="todayCompactDetails"><summary>Show universe warnings</summary><ul className="todayPlainList">{quality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}</>}
        </article>

        <article className="card todayPanel todayCompactPanel">
          <div><p className="eyebrow">FORWARD TRACKING</p><h2>Next measured outcomes</h2></div>
          {nextOutcome ? <><p className="todayCompactLead"><strong>Next measurable: {formatDate(nextOutcome.firstTargetAt)}, {nextOutcome.count} outcomes</strong></p><details className="todayCompactDetails"><summary>Show all pending horizons</summary><div className="todayOutcomeList">{brief.outcomes.nextMeasurable.map((item) => <div key={item.horizon}><strong>{horizonLabel[item.horizon] || item.horizon}</strong><span>{item.count} pending</span><small>First measurable {formatDate(item.firstTargetAt)}</small></div>)}</div></details></> : <p className="muted">No pending target dates are stored.</p>}
          <Link href="/validation">Open validation →</Link>
        </article>
      </section>

      <section className="card todayPanel todayCompactPanel">
        <div className="sectionHeading"><div><p className="eyebrow">POINT-IN-TIME FOLLOW-UP</p><h2>Missed moves</h2></div><Link href="/missed-moves">Open full audit →</Link></div>
        {!brief.missedMovesSummary.available ? <p className="muted">No missed-move summary is available.</p> : <><p className="todayCompactLead"><strong>{brief.missedMovesSummary.total} moves audited</strong> · {brief.missedMovesSummary.byReason.universe_gap} universe gaps · {brief.missedMovesSummary.byReason.radar_data_gap} radar data gaps</p>{topMissedMoves.length === 0 ? <p className="muted">No stored price move of at least 8% was found in the last 60 days.</p> : <div className="todayMoveList">{topMissedMoves.map((move) => <div key={`${move.ticker}-${move.observedDate}`}><Link className="ticker" href={`/company/${encodeURIComponent(move.ticker)}`}>{move.ticker}</Link><strong className={move.changePercent >= 0 ? 'positive' : 'negative'}>{move.changePercent >= 0 ? '+' : ''}{move.changePercent.toLocaleString('en-US', { maximumFractionDigits: 1 })}%</strong><span>{move.priorCoverage.replaceAll('_', ' ')}</span><small>{move.previousDate} → {move.observedDate}</small></div>)}</div>}{remainingMissedMoves.length > 0 && <details className="todayCompactDetails"><summary>Show more audited moves</summary><div className="todayMoveList">{remainingMissedMoves.map((move) => <div key={`${move.ticker}-${move.observedDate}`}><Link className="ticker" href={`/company/${encodeURIComponent(move.ticker)}`}>{move.ticker}</Link><strong>{move.changePercent.toFixed(1)}%</strong><span>{move.priorCoverage.replaceAll('_', ' ')}</span><small>{move.previousDate} → {move.observedDate}</small></div>)}</div></details>}</>}
      </section>

      <details className="card todaySystemDetails">
        <summary>System details</summary>
        <div className="todayRunStrip"><div><span>Daily research snapshot</span><strong>{canonical ? `${canonical.decisionDate} · #${canonical.id}` : 'Not available'}</strong><small>{canonical ? `${canonical.modelVersion} · captured ${formatDateTime(canonical.runAt)}` : 'Waiting for first snapshot'}</small></div><div><span>Latest collection</span><strong>{collection ? `${collection.status.toUpperCase()} · #${collection.id}` : 'Not available'}</strong><small>{collection ? `${formatDateTime(collection.startedAt)} · ${collection.durationMs ?? '—'} ms · trigger ${collection.trigger}` : 'No ledger rows'}</small></div><div><span>Collection scope</span><strong>{collection?.metrics.scanned ?? '—'} scanned · {collection?.metrics.candidates ?? '—'} candidates</strong><small>{collection?.metrics.marketDataTotal == null ? 'Source-path counts unknown' : `${collection.metrics.marketDataGrowth ?? 0} Growth screen + ${collection.metrics.marketDataRecall ?? 0} Attention recall + ${collection.metrics.marketDataInsider ?? 0} insider lookups`}</small></div></div>
        {brief.warnings.length > 0 && <ul className="todayPlainList">{brief.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul>}
        <p className="muted">Historical “inputs changed after snapshot” state is not stored and remains unknown.</p>
      </details>
    </main>
  );
}
