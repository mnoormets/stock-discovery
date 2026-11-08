/** Manually reviewed filing evidence, not a live feed or an accounting conversion. */
const REVIEWED_TRADING_CESSATIONS = [{
  ticker:'KVUE', cik:'0001944048', issuer:'Kenvue Inc.', successorTicker:'KMB',
  effectiveAt:'2026-11-02T14:30:00.000Z', verifiedAt:'2026-11-08T18:24:09.000Z',
  sourceUrl:'https://www.investor.kimberly-clark.com/static-files/058a2a9c-1884-41e3-9023-aff86582cace',
  sourceDetail:'Kimberly-Clark 2 November 2026 Form 8-K, Exhibit 99.1, Transaction Details (page 92).',
}] as const;
export function getReviewedTradingCessations(now=new Date()) {
  return REVIEWED_TRADING_CESSATIONS.filter(event=>Date.parse(event.verifiedAt)<=now.getTime()&&Date.parse(event.effectiveAt)<=now.getTime());
}
export function hasReviewedTradingCessation(ticker:string,cik:string|null,now:Date) {
  if(!cik)return false;
  const identity=cik.replace(/^0+/,'');
  return getReviewedTradingCessations(now).some(event=>event.ticker===ticker&&event.cik.replace(/^0+/,'')===identity);
}
