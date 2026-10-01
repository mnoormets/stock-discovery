# Market radar V1 verification — 1 October 2026

The user authorized broader market information after the missed-winner audit. Six existing Yahoo screens now produce a separate visible research radar, bounded to 25 provider rows each. Source IDs, timestamps, channel failures, missing prices and financial coverage are explicit. Names remain visible without SEC facts, social eligibility or canonical tier slots. This does not claim prediction or profitability.

## Executed evidence

- Typecheck exit 0; lint: `✔ No ESLint warnings or errors`.
- Full isolated Docker suite: `Test Files 68 passed (68)` / `Tests 519 passed (519)`, duration 538.67s. [Actual test output](market-radar-tests.log).
- Build: `✓ Compiled successfully`, `✓ Generating static pages (22/22)`, exit 0. [Actual build output](market-radar-build.log). App restarted before final HTTP checks.
- Updated real daily CLI exited 0: collection #62, 137 distinct stocks, all six channels successful; 15 attempted/enriched and zero failed/unavailable SEC attempts. Earlier five attempts plus these 15 exhausted the shared daily 20 budget. Total companies with SEC facts: 264 → 279. Healthy heartbeat HTTP 200. [Actual CLI output](market-radar-daily.log).
- Canonical #95 reused. No new canonical runs, decisions, candidate outcomes or paper orders. Existing marks/outcomes refreshed through their normal paths. Historical snapshots were not overwritten.
- Read-only Neon check: latest collection #62 success, 137 radar names, six channels ok, 45 names currently with financial facts. [Saved DB check](market-radar-runtime.json).
- Real browser inspected `/today#market-radar`: all sources, deduplicated rows, INTC despite social blacklist, AMD with SEC facts and GETY with unavailable/stale price. Screenshot visually checked table layout.
- Post-restart `/today`, `/performance`, `/company/INTC`: HTTP 200. Today HTML contains radar, 137 names, INTC and missing-facts state. The collect endpoint only supports POST; GET returns 405.

## Limits and follow-up

Radar is a daily sample of six screen lists, not an entire exchange scan or an intraday feed. Gainer lists already reflect movement. Growth-screen criteria are provider heuristics, not verified theses. Most current radar names still lack financial facts; queue progress must be observed. Radar-only names do not enter canonical paper selection automatically: a policy change requires a new version and forward comparison. Paid/new providers are not added. Next unattended run after publication remains unverified.

Company/price persistence replay was checked in the isolated DB test: one price row after two identical writes, no paper buys, and latest collection without radar does not silently show an older successful snapshot. Final checks: unauthenticated `POST /api/collect` returned 401; `SELECT count(*) FROM pg_database WHERE datname LIKE 'discovery_test%'` returned 0. Docker Desktop briefly stopped responding during a follow-up check; after recovery, `/today` and `/performance` again returned 200 and the radar remained present.
