import { pool } from './db';
import { checkCapitalSplits } from './paper-capital-splits';
import { EARLY_OPPORTUNITY_VERSION, type EarlyOpportunity } from './early-opportunities';
import { assessPaperExecutionQuote, paperCommissionUsd } from './paper-strategy';
import { priceObservationRecency, newYorkPriceDate } from './price-observation';
import { fetchExecutionQuotes, type YahooExecutionQuote } from './yahoo';

export const CAPITAL_VERSION = 'early-capital-v1';
export const CAPITAL_RULES = {
  initialUsd: 20000, targetProfitUsd: 10000, positionBudgetUsd: 2000, maxPositions: 8,
  cashReserveUsd: 4000, stopLossPercent: -8, takeProfitPercent: 20,
  maxHoldDays: 30, riskFloorUsd: 18000, slippageBps: 5,
  entry: 'Latest successful early-opportunities-v1 watch rows; one entry per ticker; no averaging or re-entry.',
};
type Trade = {
  id: string; book_key: 'strategy' | 'benchmark'; signal_ticker: string; instrument_ticker: string;
  side: 'buy' | 'sell'; reason: string; quantity: string; price: string; gross_usd: string; fee_usd: string; executed_at: Date;
};
export function capitalBook(trades: Trade[], book: 'strategy' | 'benchmark') {
  const rows = trades.filter(t => t.book_key === book);
  const buys = rows.filter(t => t.side === 'buy'); const sells = rows.filter(t => t.side === 'sell');
  const spent = buys.reduce((sum,t) => sum + Number(t.gross_usd) + Number(t.fee_usd),0);
  const received = sells.reduce((sum,t) => sum + Number(t.gross_usd) - Number(t.fee_usd),0);
  const open = buys.filter(t => !sells.some(s => s.signal_ticker === t.signal_ticker));
  const closedCost = buys.filter(t => !open.includes(t)).reduce((sum,t) => sum + Number(t.gross_usd) + Number(t.fee_usd),0);
  return { cashUsd: CAPITAL_RULES.initialUsd - spent + received, realizedProfitUsd: received - closedCost, open };
}
export function isCapitalCandidate(row: EarlyOpportunity, now: Date): boolean {
  if (!row || row.state !== 'watch' || typeof row.ticker !== 'string' || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.ticker)
    || row.price == null || !Number.isFinite(row.price) || row.price <= 0 || !Array.isArray(row.facts) || row.facts.length !== 3
    || !row.priceContext || row.priceContext.recentRunUp
    || ![row.priceContext.oneMonthReturnPercent,row.priceContext.threeMonthReturnPercent,row.priceContext.sixMonthReturnPercent]
      .every(v=>v!=null && Number.isFinite(v)) || priceObservationRecency(row.marketAt,now.toISOString())!=='recent') return false;
  const [revenue,previous,cash]=row.facts;
  if (row.facts.some(f=>!f || f.unit!=='USD' || !Number.isFinite(f.value) || !Number.isFinite(Date.parse(f.filedAt))
    || Date.parse(f.filedAt)>now.getTime() || !Number.isFinite(Date.parse(f.periodEnd)) || Date.parse(f.periodEnd)>now.getTime())) return false;
  return revenue.value>0 && previous.value>0 && (revenue.value/previous.value-1)*100>=25 && cash.value>0
    && revenue.periodKind===previous.periodKind && cash.periodKind===revenue.periodKind && cash.periodEnd===revenue.periodEnd
    && Date.parse(previous.periodEnd)<Date.parse(revenue.periodEnd) && now.getTime()-Date.parse(revenue.periodEnd)<=365*86400000;
}
function usable(quote: YahooExecutionQuote | undefined, reference: YahooExecutionQuote | undefined, now: Date) {
  return !!quote && !!reference && assessPaperExecutionQuote(quote,now).executable
    && assessPaperExecutionQuote(reference,now).executable
    && Math.abs(Date.parse(quote.marketTime!) - Date.parse(reference.marketTime!)) <= 20*60000;
}
export async function executeCapitalPaper(options: { now?: Date; quoteFetcher?: typeof fetchExecutionQuotes; splitChecker?: typeof checkCapitalSplits } = {}) {
  const now = options.now ?? new Date();
  const available = await pool.query("SELECT to_regclass('public.paper_capital_accounts') IS NOT NULL AS ok");
  if (!available.rows[0].ok) throw new Error('Capital paper schema missing: apply migration 0011.');
  await pool.query(`INSERT INTO paper_capital_accounts(policy_version,initial_usd,target_profit_usd,rules,created_at)
    VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT DO NOTHING`,
    [CAPITAL_VERSION,CAPITAL_RULES.initialUsd,CAPITAL_RULES.targetProfitUsd,JSON.stringify(CAPITAL_RULES),now.toISOString()]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = (await client.query('SELECT * FROM paper_capital_accounts WHERE policy_version=$1 FOR UPDATE',[CAPITAL_VERSION])).rows[0];
    if (Object.entries(CAPITAL_RULES).some(([k,v]) => account.rules[k] !== v)
      || Number(account.initial_usd)!==CAPITAL_RULES.initialUsd || Number(account.target_profit_usd)!==CAPITAL_RULES.targetProfitUsd)
      throw new Error('Capital policy differs from frozen account rules.');
    if (now.getTime()<new Date(account.created_at).getTime()) throw new Error('Capital execution cannot precede activation.');
    let trades = (await client.query<Trade>('SELECT * FROM paper_capital_trades WHERE policy_version=$1 ORDER BY id',[CAPITAL_VERSION])).rows;
    const collection = (await client.query(`SELECT id,finished_at,metrics->'marketRadar'->'early' AS early
      FROM collection_runs WHERE status='success' AND finished_at <= $1 ORDER BY finished_at DESC,id DESC LIMIT 1`,[now.toISOString()])).rows[0];
    const early = collection?.early;
    const current = collection && now.getTime()-new Date(collection.finished_at).getTime() <= 36*3600000
      && early?.version===EARLY_OPPORTUNITY_VERSION && Number.isFinite(Date.parse(early.evaluatedAt))
      && Date.parse(early.evaluatedAt)<=new Date(collection.finished_at).getTime() && Array.isArray(early.rows);
    const candidates: EarlyOpportunity[] = current ? early.rows.filter((r: EarlyOpportunity) => isCapitalCandidate(r,new Date(early.evaluatedAt))) : [];
    candidates.sort((a,b) => (b.revenueGrowth??0)-(a.revenueGrowth??0) || a.ticker.localeCompare(b.ticker));
    const book = capitalBook(trades,'strategy');
    const tickers = [...new Set(['SPY',...book.open.map(t=>t.signal_ticker),...candidates.slice(0,20).map(r=>r.ticker)])];
    const quotes = await (options.quoteFetcher ?? fetchExecutionQuotes)(tickers);
    const holdings = [...book.open, ...capitalBook(trades,'benchmark').open].map(t=>({ticker:t.instrument_ticker,boughtAt:new Date(t.executed_at)}));
    const splitChecks = await (options.splitChecker ?? checkCapitalSplits)(holdings,now);
    const splitIssues = [...new Set(holdings.map(h=>h.ticker))].flatMap(ticker=>{
      const check=splitChecks.find(c=>c.ticker===ticker);
      return !check || check.issue ? [ticker+': '+(check?.issue??'Split check missing.')] : [];
    });
    for (const issue of splitIssues) quotes.delete(issue.split(':')[0]);
    const spy = quotes.get('SPY'); const issues: string[] = [...splitIssues];
    let filledTrades = 0;
    for (const ticker of tickers) {
      const q = quotes.get(ticker);
      if (!usable(q,spy,now)) { issues.push(`${ticker}: fresh paired USD regular-session quote unavailable.`); continue; }
      await client.query(`INSERT INTO paper_strategy_marks(ticker,price,currency,market_time,marked_at,source,quote_payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT DO NOTHING`,
        [ticker,q!.price,q!.currency,q!.marketTime,now.toISOString(),q!.source,JSON.stringify(q!.raw)]);
    }
    const complete = book.open.every(t=>usable(quotes.get(t.signal_ticker),spy,now));
    const equity = complete ? book.cashUsd + book.open.reduce((sum,t)=>sum+Number(t.quantity)*quotes.get(t.signal_ticker)!.price!,0) : null;
    const riskStop = account.status==='risk_stopped' || (equity != null && equity <= CAPITAL_RULES.riskFloorUsd);
    const targetExit = equity != null && equity >= CAPITAL_RULES.initialUsd + CAPITAL_RULES.targetProfitUsd;
    const writeTrade = async (signal: string, bookKey: 'strategy'|'benchmark', side: 'buy'|'sell', quantity: number, gross: number, reason: string, evidence: object) => {
      const q=quotes.get(bookKey==='strategy'?signal:'SPY')!;
      const price=q.price!*(1+(side==='buy'?1:-1)*CAPITAL_RULES.slippageBps/10000);
      const grossUsd=side==='buy'?gross:quantity*price;
      const qty=side==='buy'?grossUsd/price:quantity;
      await client.query(`INSERT INTO paper_capital_trades(policy_version,book_key,signal_ticker,instrument_ticker,side,
        quantity,price,gross_usd,fee_usd,market_at,executed_at,collection_run_id,evidence,reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)`,
        [CAPITAL_VERSION,bookKey,signal,bookKey==='strategy'?signal:'SPY',side,qty,price,grossUsd,paperCommissionUsd(grossUsd),
          q.marketTime,now.toISOString(),collection?.id??null,JSON.stringify({...evidence,quote:q.raw,slippageBps:CAPITAL_RULES.slippageBps}),reason]);
      filledTrades++;
    };
    for (const position of book.open) {
      const q=quotes.get(position.signal_ticker);
      if (!usable(q,spy,now)) continue;
      const change=(q!.price!/Number(position.price)-1)*100;
      const age=(now.getTime()-new Date(position.executed_at).getTime())/86400000;
      const reason = riskStop?'Portfolio risk floor':targetExit?'Profit target liquidation':change<=CAPITAL_RULES.stopLossPercent?'Stop-loss observation'
        :change>=CAPITAL_RULES.takeProfitPercent?'Take-profit observation':age>=CAPITAL_RULES.maxHoldDays?'Holding period elapsed':null;
      if (!reason) continue;
      const benchmark = capitalBook(trades,'benchmark').open.find(t=>t.signal_ticker===position.signal_ticker);
      if (!benchmark) throw new Error('Capital benchmark position missing.');
      await writeTrade(position.signal_ticker,'strategy','sell',Number(position.quantity),0,reason,{buyTradeId:position.id,change,age});
      await writeTrade(position.signal_ticker,'benchmark','sell',Number(benchmark.quantity),0,reason,{buyTradeId:benchmark.id});
    }
    trades=(await client.query<Trade>('SELECT * FROM paper_capital_trades WHERE policy_version=$1 ORDER BY id',[CAPITAL_VERSION])).rows;
    let balances=capitalBook(trades,'strategy');
    const targetReached=balances.open.length===0 && balances.cashUsd>=CAPITAL_RULES.initialUsd+CAPITAL_RULES.targetProfitUsd;
    const status=targetReached?'target_reached':riskStop?'risk_stopped':account.status;
    await client.query('UPDATE paper_capital_accounts SET status=$2,completed_at=CASE WHEN $2=\'target_reached\' THEN COALESCE(completed_at,$3) ELSE completed_at END WHERE policy_version=$1',
      [CAPITAL_VERSION,status,now.toISOString()]);
    if (status==='active' && complete && !targetExit) {
      for (const candidate of candidates.slice(0,20)) {
        // Reject stale evidence and another rise between the morning scan and execution.
        if (trades.some(t=>t.signal_ticker===candidate.ticker) || !usable(quotes.get(candidate.ticker),spy,now)
          || candidate.price==null || candidate.price<=0 || candidate.marketAt==null
          || priceObservationRecency(candidate.marketAt,now.toISOString())!=='recent'
          || Date.parse(quotes.get(candidate.ticker)!.marketTime!) < new Date(collection.finished_at).getTime()
          || quotes.get(candidate.ticker)!.price! / candidate.price >= 1.05) continue;
        balances=capitalBook(trades,'strategy');
        const benchmarkCash=capitalBook(trades,'benchmark').cashUsd;
        if (balances.open.length>=CAPITAL_RULES.maxPositions || balances.cashUsd-CAPITAL_RULES.positionBudgetUsd<CAPITAL_RULES.cashReserveUsd
          || benchmarkCash<CAPITAL_RULES.positionBudgetUsd) break;
        const gross=CAPITAL_RULES.positionBudgetUsd-paperCommissionUsd(CAPITAL_RULES.positionBudgetUsd);
        await writeTrade(candidate.ticker,'strategy','buy',0,gross,'Early source-backed entry',{candidate,earlyEvaluatedAt:early.evaluatedAt});
        await writeTrade(candidate.ticker,'benchmark','buy',0,gross,'Matched cash-flow benchmark',{signalTicker:candidate.ticker});
        trades=(await client.query<Trade>('SELECT * FROM paper_capital_trades WHERE policy_version=$1 ORDER BY id',[CAPITAL_VERSION])).rows;
      }
    }
    const result={policyVersion:CAPITAL_VERSION,status,filledTrades,issues,splitIssues,splitCheckedAt:now.toISOString(),collectionRunId:collection?.id??null,
      candidateCount:candidates.length,sourceCurrent:!!current,cashUsd:capitalBook(trades,'strategy').cashUsd};
    if (!current) result.issues.push('Current early scan unavailable; no new entries.');
    await client.query('INSERT INTO paper_capital_runs(policy_version,evaluated_at,collection_run_id,result) VALUES ($1,$2,$3,$4::jsonb)',
      [CAPITAL_VERSION,now.toISOString(),collection?.id??null,JSON.stringify(result)]);
    await client.query('COMMIT'); return result;
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function getCapitalDashboard(now=new Date()) {
  const available=(await pool.query("SELECT to_regclass('public.paper_capital_accounts') IS NOT NULL AS ok")).rows[0].ok;
  if (!available) return null;
  const account=(await pool.query('SELECT * FROM paper_capital_accounts WHERE policy_version=$1 AND created_at <= $2',[CAPITAL_VERSION,now.toISOString()])).rows[0];
  if (!account) return null;
  const trades=(await pool.query<Trade>('SELECT * FROM paper_capital_trades WHERE policy_version=$1 AND executed_at <= $2 ORDER BY id',[CAPITAL_VERSION,now.toISOString()])).rows;
  const marks=(await pool.query('SELECT DISTINCT ON(ticker) ticker,price,market_time FROM paper_strategy_marks WHERE currency=\'USD\' AND marked_at<=$1 AND market_time<=$1 ORDER BY ticker,market_time DESC,id DESC',[now.toISOString()])).rows;
  const map=new Map(marks.map(m=>[m.ticker,m]));const spy=map.get('SPY');
  const latestRun=(await pool.query('SELECT evaluated_at,result FROM paper_capital_runs WHERE policy_version=$1 AND evaluated_at <= $2 ORDER BY id DESC LIMIT 1',[CAPITAL_VERSION,now.toISOString()])).rows[0];
  const splitCheckedAt=Date.parse(latestRun?.result.splitCheckedAt??'');
  const splitIssues: string[]=latestRun?.result.splitIssues??[];
  const books=(['strategy','benchmark'] as const).map(bookKey=>{
    const book=capitalBook(trades,bookKey);const issues: string[]=[];
    const positions=book.open.map(t=>{
      const mark=map.get(t.instrument_ticker);
      const splitSafe=Number.isFinite(splitCheckedAt) && mark && spy && mark.market_time.getTime()<=splitCheckedAt+20*60000
        && spy.market_time.getTime()<=splitCheckedAt+20*60000
        && !splitIssues.some(i=>i.startsWith(t.instrument_ticker+':') || i.startsWith('SPY:'));
      if (!splitSafe) issues.push(t.instrument_ticker+': split integrity awaiting verification.');
      const valid=splitSafe && mark && spy && priceObservationRecency(mark.market_time.toISOString(),now.toISOString())==='recent'
        && priceObservationRecency(spy.market_time.toISOString(),now.toISOString())==='recent'
        && newYorkPriceDate(mark.market_time.toISOString())===newYorkPriceDate(spy.market_time.toISOString())
        && Math.abs(mark.market_time.getTime()-spy.market_time.getTime())<=20*60000;
      if (!valid) issues.push(`${t.instrument_ticker}: usable aligned mark unavailable.`);
      const value=valid?Number(t.quantity)*Number(mark.price):null;
      return {ticker:t.signal_ticker,instrument:t.instrument_ticker,boughtAt:t.executed_at.toISOString(),buyPrice:Number(t.price),quantity:Number(t.quantity),
        latestPrice:valid?Number(mark.price):null,markAt:mark?.market_time.toISOString()??null,valueUsd:value,
        profitUsd:value==null?null:value-Number(t.gross_usd)-Number(t.fee_usd)};
    });
    const equity=issues.length?null:book.cashUsd+positions.reduce((sum,p)=>sum+p.valueUsd!,0);
    return {book:bookKey,cashUsd:book.cashUsd,realizedProfitUsd:book.realizedProfitUsd,equityUsd:equity,
      profitUsd:equity==null?null:equity-CAPITAL_RULES.initialUsd,positions,issues};
  });
  return {version:CAPITAL_VERSION,status:account.status as string,startedAt:account.created_at.toISOString(),completedAt:account.completed_at?.toISOString()??null,
    rules:account.rules as typeof CAPITAL_RULES,books,trades:trades.map(t=>({...t,executed_at:t.executed_at.toISOString()})),
    latestRun:latestRun?{at:latestRun.evaluated_at.toISOString(),...latestRun.result}:null};
}
