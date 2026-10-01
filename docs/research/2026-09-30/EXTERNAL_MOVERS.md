# External winners versus application coverage — 30 September 2026

Research only; no external provider integrated, no strategy or database changes. Read-only historical collection/decision/order evidence: external-movers-evidence.json. No paper orders exist for the 15 checked tickers. This is a selected external-winner audit, not an exhaustive ranking or an unbiased trading experiment.

## Market evidence

Use completed sessions through 29 September; 30 September was still trading. Stock Analysis split-adjusted closing histories give GLND $1.20 (18 Sep) to $4.75 (29 Sep), +295.83%; KOD $32.71 to $91.12, +178.57%. Sources: https://stockanalysis.com/stocks/glnd/history/ and https://stockanalysis.com/stocks/kod/history/ .

StockTitan's news-associated session ranking reports GRML +230.53% on 21 September, KOD +177.96% on 28 September, MGLD about +93% on 25 September, LFCR +55.24% on 28 September and SSTI +50.09% on 29 September. These are SINGLE-SESSION changes, not two-week returns. GRML closes $2.85 on 18 September and $10.38 on 29 September imply +264.21%; the page's rounded +264.04% differs slightly, so do not overstate precision. Source: https://www.stocktitan.net/rankings/top-news/gainers/ .

Money365's 18–24 September screen reports MRNA +26.47%, INOD +25.78%, INTC +17.30% and META +16.80%. Treat as source-reported weekly figures, not our exact full-window calculation. Its headings inconsistently describe the weekday/window; no market-wide inference rests on it. Source: https://www.money365.market/news/weekly-movers/2026-w39 .

Kodiak's official event calendar confirms a 28 September 08:30 EDT DAYBREAK results webcast: https://ir.kodiak.com/events/event-details/daybreak-topline-results-webcast . Greenland Mines announced its Sarfartoq licence application on 21 September at 09:30 EDT: https://www.globenewswire.com/news-release/2026/09/21/3365568/0/en/greenland-mines-more-than-doubles-control-position-in-the-sarfartoq-rare-earth-magnet-district-in-west-greenland.html . Public event knowledge does not establish advance knowledge of a favorable result.

## Actual application failures to cover these names

- GRML, MGLD, AIFF, LFCR, SSTI, GRAL, SVRN and TJGC: no matching current company or 18–30 September collection/decision record under these tickers. Alias histories not exhaustively checked; absence means no recorded coverage under the checked symbol.
- KOD: first company and successful radar lookup 29 September, after the 28 September jump. Zero financial facts and zero canonical decisions.
- GLND: radar observed 19 September with two mentions; filtered out. First successful lookup/company on 22 September, after its first large jump but before 24 September's further rise. Zero financial facts and no canonical decision.
- INOD and VKTX: first successful lookups/company on 23 September, zero financial facts and no canonical decisions.
- MRNA: known since August. Across 18–30 September, excluded eight times by two-per-market-cap-tier capacity and five times by same-collection market-data requirement.
- META/INTC: observed repeatedly but filtered out; both explicitly appear in BLACKLIST in src/lib/config.ts.

Code corroboration: src/lib/collect.ts takes two ApeWisdom pages, prefilters, then allocates 80 mention-growth +20 attention recall slots plus the insider path. This is not an all-listed-stocks/news scanner. src/lib/company-financials.ts getAllStoredCompanyFinancials uses INNER JOIN financial_facts; src/lib/rklb-discovery.ts iterates those financial summaries. Therefore a company can have a successful price lookup yet never receive a candidate decision when facts are absent.

## Discussion and proposed next work

Prioritize visible coverage: record why every observed company did not reach evaluation, and investigate existing SEC enrichment for found-but-unscored names. Review named mega-cap exclusions against current user goals. Assess a separate event-watch path using existing sources and separate prospective paper results; do not simply buy retrospective winners or remove data-quality gates. Large overnight gaps mean the previous close was not an available post-news fill. Existing book remains unchanged. No runtime tests/build/UI verification claimed for this documentation-only audit.
