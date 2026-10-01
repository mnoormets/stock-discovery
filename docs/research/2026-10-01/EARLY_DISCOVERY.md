# Early opportunities V1 — 1 October 2026

The user requested finding stocks before their rise. The implemented hypothesis is observable business growth without already elevated measured price appreciation. It does not assert that a future boom will occur.

## Selection and known-at-the-time evidence

Current US/USD equity radar names need revenue growth >=25% YoY derived from stored current/comparable SEC amounts, positive same-period operating cash flow, valid non-future filing/period dates and latest financial periods within 365 days. Session price and change must be fresh/known, with session gain below 5%. Up to 20 eligible names per collection receive a Yahoo daily chart for 200 days, ordered by documented revenue growth then ticker. All 1/3/6-month reference prices must exist, and observed returns must be below +20%/+35%/+50%. Splits and failed/missing/mismatched history produce unknown. Thresholds are unvalidated research assumptions and can miss pre-revenue biotech, event-driven winners or already-moving opportunities.

Rows retain actual financial fact IDs/values/filing links, consumed historical closes and derived price context in `collection_runs.metrics.marketRadar.early`, version `early-opportunities-v1`. No historical rows are backfilled. First qualifying observation for each ticker/version stays fixed even after repeated qualification or exclusion. Latest usable follow-up price must have a known market time, USD denomination, receipt after first discovery and no future timestamps. Price change since observation is not actual paper investment P/L.

Qualifying names enter the existing 50-symbol/day tracking queue for 30 days after their last qualifying collection, even after leaving a screen. Existing SPY/holdings/research/outcome reasons and fairness remain. Capacity can defer monitoring; stale/missing quotes do not become zero returns. No automatic paper orders or canonical eligibility changes.

## Real run

Collection #63: 138 names; 2 watch, 43 excluded, 93 unknown; 2 history requests, 0 deferred. AMKR and CDE qualified. Full exact SEC and historical-return evidence is saved in [runtime data](early-runtime.json). AMKR's latest stored revenue period is 31 March; CDE's is 30 June. Growth may reflect acquisitions, cyclicality or other factors; organic growth/valuation are not verified by this screen.

[CLI output](early-daily.log): exit 0, canonical #95 reused; zero new paper orders, decisions or outcomes. Two early names received new tracked prices, with zero missing/stale/invalid/failed/deferred observations. Healthy heartbeat HTTP 200. Browser rendered both cards, SEC source links, exclusion details and frozen-first-price follow-up rows after app restart.

## Verification

Typecheck exit 0; lint no warnings/errors. [Production build](early-build.log) compiled and generated 22/22 static pages; app restarted. Final full isolated suite: **70 files / 523 tests passed**, 296.39s, exit 0. [Actual final test output](early-tests-final.log). Earlier pre-trace complete run also passed 523 tests in 333.33s. `/today` and `/performance` returned 200; unauthenticated collection POST returned 401; isolated test database count returned 0.

Next: verify the published code's unattended execution and evaluate early discoveries forward, including losses, missing coverage and misses. No profitability claim or strategy tuning from two names.

Repeat verification: collection #64 found 2 watch / 47 excluded / 87 unknown from 136 names; each watch row stores 139 validated historical closes. [Final runtime JSON](early-runtime-final.json) and [collector output](early-collect-final.log) show identical first-discovery timestamps/prices before and after the run. Original #63 rows are untouched and have derived context/fact evidence but no raw historical-price array; later scans contain that added trace, not a hindsight backfill.
