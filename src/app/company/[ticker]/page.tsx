import Link from 'next/link';
import TickerSearch from '../../TickerSearch';
import ResearchBrief from './ResearchBrief';
import { getCompanyResearchDbFirst } from '@/lib/company-research-store';
import { getCompanyFinancialsDbFirst, type FinancialMetric, type FinancialMetricSummary } from '@/lib/company-financials';
import { calculateCompanyScores, getTopScoreReasons, type CompanyScore } from '@/lib/company-scores';
import { getTrackedCompanyScores, type ScoreSnapshot } from '@/lib/score-tracking';
import { getResearchBriefState } from '@/lib/research-brief';
import { normalizeTicker } from '@/lib/investment';
import { getSectorRelativeStats } from '@/lib/sector-relative';
import SectorRelativeEvidence from '@/components/SectorRelativeEvidence';
import DataQualityEvidence from '@/components/DataQualityEvidence';
import { calculateDataQuality } from '@/lib/data-quality';

export const dynamic = 'force-dynamic';

function money(value: number | null, currency: string | null): string {
  if (value == null) return 'No data available yet';
  return new Intl.NumberFormat('et-EE', { style: 'currency', currency: currency || 'USD' }).format(value);
}

function compact(value: number | null): string {
  if (value == null) return 'No data available yet';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

function dateTime(value: string | null): string {
  if (!value) return 'No data available yet';
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function decimal(value: number | null): string {
  if (value == null) return 'No data available yet';
  return value.toLocaleString('et-EE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function recommendation(value: string | null): string {
  if (!value) return 'No data available yet';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const financialLabels: Record<FinancialMetric, string> = {
  revenue: 'Revenue',
  net_income: 'Net income',
  operating_cash_flow: 'Operating cash flow',
  capital_expenditure: 'Capital expenditure',
  free_cash_flow: 'Free cash flow',
  cash: 'Cash',
  debt: 'Debt',
  shares_outstanding: 'Shares outstanding',
};

function financialValue(summary: FinancialMetricSummary): string {
  const { latest } = summary;
  if (latest.unit === 'shares') {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(latest.value);
  }
  return new Intl.NumberFormat('et-EE', {
    style: 'currency', currency: latest.unit || 'USD', notation: 'compact', maximumFractionDigits: 2,
  }).format(latest.value);
}

function periodLabel(summary: FinancialMetricSummary): string {
  const labels = { quarter: 'kvartal', ytd: 'aasta algusest', annual: 'majandusaasta', instant: 'bilansipäev' };
  return `${summary.latest.periodEnd} · ${labels[summary.latest.periodKind]} · ${summary.latest.form}`;
}

function scoreTone(value: number): string {
  if (value >= 65) return 'good';
  if (value < 40) return 'weak';
  return 'neutral';
}

function ScoreCard({ title, score }: { title: string; score: CompanyScore | null }) {
  const topReasons = getTopScoreReasons(score);
  if (!score) return <article className="card scoreCard emptyScore"><h3>{title}</h3><p className="muted">Skoori jaoks pole veel piisavalt võrreldavaid SEC perioode.</p></article>;
  return (
    <article className={`card scoreCard ${scoreTone(score.score)}`}>
      <div className="scoreCardTop">
        <div><h3>{title}</h3><small>{score.label}{score.kind === 'coverage' ? '' : ` · ${score.coveragePercent}% andmekate`}</small></div>
        <strong>{score.score}<span>/100</span></strong>
      </div>
      <div className="scoreComponents">
        {score.components.map((component) => (
          <div className="scoreComponent" key={component.id}>
            <div><span>{component.label}</span><strong>{component.score}</strong></div>
            <div className="scoreBar" aria-label={`${component.label}: ${component.score} punkti`}><i style={{ width: `${component.score}%` }} /></div>
            <small>{component.detail} · kaal {component.weight}%</small>
          </div>
        ))}
      </div>
      {score.kind !== 'coverage' && (
        <div className="scoreReasons">
          <h4>Kolm peamist põhjust</h4>
          <ol>{topReasons.map((reason) => (
            <li className={reason.direction} key={reason.componentId}>
              <strong>{reason.label}</strong><span>{reason.detail}</span>
              <small>Kaalutud mõju {reason.weightedInfluence > 0 ? '+' : ''}{reason.weightedInfluence}</small>
            </li>
          ))}</ol>
          {topReasons.length < 3 && <small className="muted">Arvutatavaid komponente oli ainult {topReasons.length}.</small>}
        </div>
      )}
    </article>
  );
}

function scoreDelta(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return '—';
  const change = current - previous;
  return `${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)} p`;
}

function ScoreHistory({ current, history }: { current: ScoreSnapshot; history: ScoreSnapshot[] }) {
  return (
    <details className="card scoreAudit">
      <summary>
        <span><strong>Skoori jälgitavus</strong><small>Versioon {current.version} · arvutatud {dateTime(current.calculatedAt)}</small></span>
        <span className="muted">{current.sources.length} SEC mõõdikut · {history.length} snapshot{history.length === 1 ? '' : 'ti'}</span>
      </summary>
      <div className="scoreAuditBody">
        <div><h3>Kasutatud perioodid</h3><div className="scoreSourceList">{current.sources.map((source) => (
          <div key={source.metric}><strong>{financialLabels[source.metric as FinancialMetric] || source.metric}</strong><span>{source.latestPeriodEnd}{source.previousPeriodEnd ? ` vs ${source.previousPeriodEnd}` : ' · võrdlus puudub'}</span><small>Fact ID {source.latestFactId || '—'}{source.previousFactId ? ` / ${source.previousFactId}` : ''}</small></div>
        ))}</div></div>
        <div><h3>Skooriajalugu</h3><div className="tableWrap"><table><thead><tr><th>Aeg</th><th>Growth</th><th>Health</th><th>Coverage</th></tr></thead><tbody>{history.map((snapshot, index) => {
          const previous = history[index + 1];
          return <tr key={snapshot.id}><td>{dateTime(snapshot.calculatedAt)}</td><td>{snapshot.growthScore ?? '—'} <small>{scoreDelta(snapshot.growthScore, previous?.growthScore ?? null)}</small></td><td>{snapshot.healthScore ?? '—'} <small>{scoreDelta(snapshot.healthScore, previous?.healthScore ?? null)}</small></td><td>{snapshot.coverageScore} <small>{scoreDelta(snapshot.coverageScore, previous?.coverageScore ?? null)}</small></td></tr>;
        })}</tbody></table></div></div>
      </div>
    </details>
  );
}

export default async function CompanyPage({ params }: { params: { ticker: string } }) {
  const ticker = normalizeTicker(decodeURIComponent(params.ticker));
  const research = ticker ? await getCompanyResearchDbFirst(ticker) : null;

  if (!ticker || !research) {
    return (
      <main className="wrap pageStack">
        <TickerSearch initialValue={ticker || ''} />
        <section className="empty card"><h1>Ettevõtet ei leitud</h1><p>Kontrolli tickerit või proovi teist sümbolit. No data available yet.</p></section>
      </main>
    );
  }

  const { quote, analystView, news, secFilings } = research;
  const financials = await getCompanyFinancialsDbFirst(ticker).catch((error) => {
    console.error(`Ettevõtte ${ticker} SEC finantsnäitajaid ei õnnestunud laadida:`, error);
    return null;
  });
  const scores = calculateCompanyScores(financials);
  const dataQuality = calculateDataQuality(financials);
  const trackedScores = await getTrackedCompanyScores(ticker, financials).catch((error) => {
    console.error(`Ettevõtte ${ticker} skooriajalugu ei õnnestunud laadida:`, error);
    return { current: null, previous: null, history: [] };
  });
  const sectorRelative = await getSectorRelativeStats(ticker).catch((error) => {
    console.error(`Ettevõtte ${ticker} sector-relative võrdlust ei õnnestunud laadida:`, error);
    return null;
  });
  const move = quote.price != null && quote.previousClose
    ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
    : null;
  const riskItems = secFilings.filter((filing) => ['8-K', '10-Q', '10-K', 'S-1'].includes(filing.form));
  const analystUpside = quote.price != null && quote.price !== 0 && analystView?.targetMeanPrice != null
    ? ((analystView.targetMeanPrice - quote.price) / quote.price) * 100
    : null;
  const briefState = await getResearchBriefState(ticker).catch((error) => {
    console.error(`Ettevõtte ${ticker} Research Briefi oleku lugemine ebaõnnestus:`, error);
    return {
      ticker,
      configured: true,
      sufficient: false,
      reason: 'AI kokkuvõtte olekut ei õnnestunud laadida.',
      inputHash: null,
      brief: null,
      stale: false,
    };
  });

  return (
    <main className="wrap pageStack">
      <TickerSearch initialValue={ticker} />
      <section className="companyHeader">
        <div><p className="eyebrow">{quote.exchange || 'EXCHANGE UNKNOWN'} · {quote.quoteType || 'TYPE UNKNOWN'}</p><h1>{quote.ticker}</h1><p className="lead">{quote.name || 'No data available yet'}</p>{research.dataOrigin === 'database' && <small>DB cache · live-andmeid värskendatakse taustal{research.refreshedAt ? ` · ${dateTime(research.refreshedAt)}` : ''}</small>}</div>
        <Link className="button secondary" href={`/portfolio?newTicker=${quote.ticker}`}>Lisa portfelli</Link>
      </section>

      <div className="metricGrid">
        <div className="metric"><span>Viimane hind</span><strong>{money(quote.price, quote.currency)}</strong>{move != null && <small className={move >= 0 ? 'positive' : 'negative'}>{move >= 0 ? '+' : ''}{move.toFixed(2)}% vs eelmine sulgemine</small>}</div>
        <div className="metric"><span>Turukapitalisatsioon</span><strong>{compact(quote.marketCap)}</strong></div>
        <div className="metric"><span>Maht</span><strong>{compact(quote.volume)}</strong></div>
        <div className="metric"><span>Järgmine tulemuste aeg</span><strong>{dateTime(quote.earningsAt)}</strong></div>
      </div>

      {research.warnings.map((warning) => <div className="notice" key={warning}>{warning}</div>)}

      <section className="section companyScores">
        <div className="sectionHeading">
          <div><p className="eyebrow">TRANSPARENT FUNDAMENTAL SCORING</p><h2>Ettevõtte skoorid</h2></div>
          <Link href="/scanner?sort=growth">Vaata fundamentaalset edetabelit</Link>
        </div>
        <div className="scoreCards">
          <ScoreCard title="Growth Score" score={scores.growth} />
          <ScoreCard title="Financial Health Score" score={scores.financialHealth} />
          <ScoreCard title="Coverage Score" score={scores.coverage} />
        </div>
        <DataQualityEvidence summary={dataQuality} />
        <SectorRelativeEvidence stats={sectorRelative} />
        {trackedScores.current && <ScoreHistory current={trackedScores.current} history={trackedScores.history} />}
        <p className="muted scoreIntro">Growth kaalub revenue, net income’i, operating cash flow ja free cash flow YoY muutusi. Financial Health kaalub rahavoogude märki ja trendi, cash/debt suhet, kasumlikkust ning aktsiate arvu muutust. Coverage näitab nende kahe mudeli kaalutud sisendikatet. Skoor ei ole ostu- ega müügisoovitus.</p>
      </section>

      <ResearchBrief initialState={briefState} />

      <section className="section">
        <div className="sectionHeading">
          <div><p className="eyebrow">SEC COMPANYFACTS · TASUTA AMETLIK ALLIKAS</p><h2>Finantsnäitajad</h2></div>
          {financials?.cik && <span className="muted">CIK {Number(financials.cik)}</span>}
        </div>
        {!financials || Object.keys(financials.metrics).length === 0 ? (
          <div className="empty card">SEC CompanyFactsi finantsandmed puuduvad.</div>
        ) : (
          <>
            <div className="metricGrid financialGrid">
              {(['revenue', 'net_income', 'free_cash_flow', 'operating_cash_flow', 'cash', 'debt', 'shares_outstanding'] as FinancialMetric[]).map((metric) => {
                const summary = financials.metrics[metric];
                if (!summary) return null;
                const change = summary.yearOverYearPercent;
                return (
                  <div className="metric financialMetric" key={metric}>
                    <span>{financialLabels[metric]}</span>
                    <strong>{financialValue(summary)}</strong>
                    {change != null && <small className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? '+' : '−'}{Math.abs(change).toLocaleString('et-EE', { maximumFractionDigits: 1 })}% YoY</small>}
                    <small>{periodLabel(summary)}</small>
                    <a href={summary.latest.sourceUrl} target="_blank" rel="noreferrer">SEC algallikas{summary.latest.derived ? ' · tuletatud' : ''}</a>
                  </div>
                );
              })}
            </div>
            <p className="muted financialNote">YoY võrdleb sama tüüpi ja sarnase pikkusega perioodi aasta varasemaga. Free cash flow = operating cash flow − capital expenditure; debt võib olla SEC-i komponentidest tuletatud.</p>
          </>
        )}
      </section>

      <section className="section">
        <div className="sectionHeading">
          <div><p className="eyebrow">YAHOO FINANCE CONSENSUS</p><h2>Analüütikute vaade</h2></div>
          {analystView?.numberOfAnalystOpinions != null && <span className="muted">{analystView.numberOfAnalystOpinions} analüütiku arvamust</span>}
        </div>
        {!analystView ? <div className="empty card">Analüütikute andmed puuduvad.</div> : (
          <div className="metricGrid">
            <div className="metric"><span>Keskmine hinnasiht</span><strong>{money(analystView.targetMeanPrice, quote.currency)}</strong>{analystUpside != null && <small className={analystUpside >= 0 ? 'positive' : 'negative'}>{analystUpside >= 0 ? '+' : '−'}{Math.abs(analystUpside).toLocaleString('et-EE', { maximumFractionDigits: 1 })}% keskmise hinnasihini</small>}</div>
            <div className="metric"><span>Kõrge hinnasiht</span><strong>{money(analystView.targetHighPrice, quote.currency)}</strong></div>
            <div className="metric"><span>Madal hinnasiht</span><strong>{money(analystView.targetLowPrice, quote.currency)}</strong></div>
            <div className="metric"><span>Konsensusreiting</span><strong>{recommendation(analystView.recommendationKey)}</strong><small>{analystView.recommendationMean == null ? 'Reitingu skoor puudub' : `${decimal(analystView.recommendationMean)} / 5`}</small></div>
          </div>
        )}
      </section>

      <div className="contentGrid">
        <section className="card section"><h2>Viimased uudised</h2>{news.length === 0 ? <p className="muted">No data available yet</p> : <div className="itemList">{news.map((item) => <article key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small>{item.publisher || 'Allikas teadmata'} · {dateTime(item.publishedAt)}</small></article>)}</div>}</section>
        <section className="card section"><h2>SEC dokumendid</h2>{secFilings.length === 0 ? <p className="muted">No data available yet</p> : <div className="itemList">{secFilings.map((filing) => <article key={filing.id}><a href={filing.url} target="_blank" rel="noreferrer">{filing.form} · {filing.description || 'SEC filing'}</a><small>{filing.filedAt}</small></article>)}</div>}</section>
      </div>

      <section className="card section"><h2>Riskid ja katalüsaatorid</h2>{quote.earningsAt || riskItems.length ? <ul>{quote.earningsAt && <li>Tulemuste sündmus: {dateTime(quote.earningsAt)}. Sündmuse mõju pole ette ennustatud.</li>}{riskItems.slice(0, 3).map((filing) => <li key={filing.id}>{filing.form} avaldus kuupäevaga {filing.filedAt} vajab sisulist ülevaatust.</li>)}</ul> : <p className="muted">No data available yet</p>}</section>
    </main>
  );
}
