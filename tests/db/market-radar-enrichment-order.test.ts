import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/lib/db';
import * as financials from '../../src/lib/company-financials';
import { collectMarketRadar } from '../../src/lib/market-radar';
import { resetDb } from '../setup/reset';
const quote = vi.hoisted(() => ({ time: new Date() }));
vi.mock('yahoo-finance2', () => ({ default: class {
  async screener() { return { quotes: [{ symbol:'LATE',longName:'Late Facts',quoteType:'EQUITY',currency:'USD',exchange:'NMS',regularMarketTime:quote.time,regularMarketPrice:10,regularMarketChangePercent:0 }] }; }
  async chart() { return { meta:{symbol:'LATE',currency:'USD'},quotes:[] }; }
} }));
beforeEach(async () => { vi.restoreAllMocks();await resetDb();quote.time=new Date(Date.now()-300000); });
const enrichment = { status:'completed' as const,financialUniverse:1,coveredBefore:0,coveredAfter:1,attempted:1,enriched:1,unavailable:0,failed:0,dailyLimit:20,attemptedTodayBefore:0,dailyRemaining:19,attemptedTickers:['LATE'],unavailableTickers:[],failedTickers:[] };
describe('same-collection financial enrichment order', () => {
  it('persists discovered names, enriches once within the shared cap, then freezes new facts in growth evidence', async () => {
    const enrich=vi.spyOn(financials,'enrichStoredCompanyFinancials').mockImplementation(async () => {
      const id=(await pool.query("SELECT id FROM companies WHERE ticker='LATE'")).rows[0]?.id;expect(id).toBeDefined();
      for (const [metric,value,start,end,key] of [['revenue',150,'2025-01-01','2025-12-31','current'],['revenue',100,'2024-01-01','2024-12-31','previous'],['operating_cash_flow',10,'2025-01-01','2025-12-31','cash']]) await pool.query(`INSERT INTO financial_facts(company_id,metric,value,unit,period_start,period_end,period_kind,form_type,filed_at,accession_number,taxonomy,tag,is_derived,source_url,fact_key) VALUES($1,$2,$3,'USD',$4,$5,'annual','10-K','2026-02-01','same','us-gaap',$2,false,'https://www.sec.gov/test',$6) ON CONFLICT DO NOTHING`,[id,metric,value,start,end,key]);
      return enrichment;
    });
    const first=await collectMarketRadar();expect(enrich).toHaveBeenCalledExactlyOnceWith(20);
    expect(first.growth?.rows[0].facts.map(p=>p.value)).toEqual([150,100,10]);expect(first.financialEnrichment).toEqual(enrichment);
    await collectMarketRadar();expect((await pool.query('SELECT count(*)::int AS n FROM financial_facts')).rows[0].n).toBe(3);
    expect((await pool.query('SELECT count(*)::int AS n FROM price_snapshots')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM paper_capital_trades')).rows[0].n).toBe(0);
  });
  it('keeps raw names/unknown evidence visible and records a sanitized enrichment failure', async () => {
    vi.spyOn(financials,'enrichStoredCompanyFinancials').mockRejectedValue(new Error('private diagnostic'));
    const snapshot=await collectMarketRadar();expect(snapshot.stocks.map(s=>s.ticker)).toEqual(['LATE']);
    expect(snapshot.financialEnrichmentError).toBe('SEC CompanyFacts enrichment unavailable; scan uses existing stored facts.');
    expect(snapshot.growth?.rows[0].state).toBe('unknown');
  });
});
