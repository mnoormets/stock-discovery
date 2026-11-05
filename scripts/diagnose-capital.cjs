/* Read-only audit of frozen entry evidence and append-only fills. No hindsight strategy replay. */
const path=require('node:path');
const {loadTs,loadEnv,registerRepoModules}=require('./_ts-loader.cjs');
registerRepoModules(path.resolve(__dirname,'..'));loadEnv(path.resolve(__dirname,'..'));
const {pool}=loadTs(path.resolve(__dirname,'../src/lib/db.ts'));
(async()=>{
  const {rows}=await pool.query(`SELECT b.signal_ticker AS ticker,b.executed_at AS entered_at,
    b.evidence->'candidate'->>'state' AS entry_category,
    b.evidence->'candidate'->'priceContext' AS context,
    s.reason AS exit_reason,s.executed_at AS exited_at,
    (s.gross_usd-s.fee_usd)-(b.gross_usd+b.fee_usd) AS net_usd,
    s.evidence->>'change' AS observed_exit_percent
    FROM paper_capital_trades b JOIN paper_capital_trades s
      ON s.policy_version=b.policy_version AND s.book_key=b.book_key AND s.signal_ticker=b.signal_ticker AND s.side='sell'
    WHERE b.side='buy' AND b.book_key='strategy' AND b.policy_version='early-capital-v1'
    ORDER BY b.executed_at,b.id`);
  const trades=rows.map(r=>({ticker:r.ticker,enteredAt:r.entered_at,category:r.entry_category,
    oneMonth:r.context?.oneMonthReturnPercent??null,threeMonth:r.context?.threeMonthReturnPercent??null,
    exitReason:r.exit_reason,exitedAt:r.exited_at,netUsd:Number(r.net_usd),observedExitPercent:r.observed_exit_percent==null?null:Number(r.observed_exit_percent)}));
  const groups={};
  for(const t of trades){const k=t.oneMonth==null||t.threeMonth==null?'unknown':t.oneMonth>0&&t.threeMonth>0?'positive_both':'declining_or_flat';
    const g=groups[k]??={count:0,netUsd:0,wins:0};g.count++;g.netUsd+=t.netUsd;if(t.netUsd>0)g.wins++;}
  console.log(JSON.stringify({version:'capital-entry-diagnosis-v1',asOf:new Date().toISOString(),
    limitation:'Descriptive audit of actual closed trades only. Group differences are not an out-of-sample result or counterfactual profit. No parameter fitting or orders.',
    groups,trades},null,2));
})().catch(e=>{console.error('Capital diagnosis failed.');process.exitCode=1;}).finally(()=>pool.end());
