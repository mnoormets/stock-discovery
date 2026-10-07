import { pool } from './db';
import { GROWTH_OPPORTUNITY_VERSION, selectGrowthEvidence, type GrowthOpportunity } from './growth-opportunities';
import { priceObservationRecency } from './price-observation';

export const GROWTH_CAPITAL_ENTRY_VERSION = 'growth-capital-entry-v2';
export const GROWTH_CAPITAL_ENTRY_RULES = {
  sourceVersion: GROWTH_OPPORTUNITY_VERSION,
  categories: ['early', 'momentum'],
  selection: 'Revenue growth descending, then ticker; coherent same-filing USD periods; fresh post-activation collection only.',
  capital: 'Same early-capital-v1 account, original cash, positions, costs and loss history; all existing sizing, exit and risk rules retained.',
};
export function isGrowthCapitalCandidate(row: GrowthOpportunity, now: Date): boolean {
  if (!row || !['early','momentum'].includes(row.state) || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.ticker)
    || row.price == null || !Number.isFinite(row.price) || row.price <= 0
    || priceObservationRecency(row.marketAt,now.toISOString()) !== 'recent'
    || !Array.isArray(row.facts) || row.facts.length !== 3 || !row.priceContext) return false;
  const facts=selectGrowthEvidence(row.facts,new Date(row.marketAt!));
  if (facts.length!==3) return false;
  const [revenue,previous,cash]=facts;
  if (revenue.value<=0 || previous.value<=0 || cash.value<=0 || (revenue.value/previous.value-1)*100<25) return false;
  const c=row.priceContext;
  if (![c.oneMonthReturnPercent,c.threeMonthReturnPercent,c.sixMonthReturnPercent].every(v=>v!=null && Number.isFinite(v))) return false;
  return row.state==='early' ? !c.recentRunUp : c.recentRunUp && c.oneMonthReturnPercent!>0 && c.threeMonthReturnPercent!>0;
}
export async function getCapitalEntryPolicy(accountVersion: string, now: Date) {
  const available=(await pool.query("SELECT to_regclass('public.paper_capital_entry_policies') IS NOT NULL AS ok")).rows[0].ok;
  if (!available) return null;
  return (await pool.query('SELECT entry_version,activated_at,rules FROM paper_capital_entry_policies WHERE account_version=$1 AND activated_at<=$2',
    [accountVersion,now.toISOString()])).rows[0] ?? null;
}
/** An explicit, idempotent forward transition; never creates or resets a capital account. */
export async function activateGrowthCapitalEntry(accountVersion: string) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const account=(await client.query('SELECT status FROM paper_capital_accounts WHERE policy_version=$1 FOR UPDATE',[accountVersion])).rows[0];
    if (!account) throw new Error('Existing capital account required.');
    const existing=(await client.query('SELECT * FROM paper_capital_entry_policies WHERE account_version=$1',[accountVersion])).rows[0];
    if (existing) { await client.query('COMMIT'); return existing; }
    if (account.status!=='active') throw new Error('Only an active capital account can change entry policy; risk stop is preserved.');
    const result=(await client.query(`INSERT INTO paper_capital_entry_policies(account_version,entry_version,activated_at,rules)
      VALUES ($1,$2,clock_timestamp(),$3::jsonb) RETURNING *`,
      [accountVersion,GROWTH_CAPITAL_ENTRY_VERSION,JSON.stringify(GROWTH_CAPITAL_ENTRY_RULES)])).rows[0];
    await client.query('COMMIT'); return result;
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
