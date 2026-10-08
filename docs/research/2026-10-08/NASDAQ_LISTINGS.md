# Nasdaq listing research V1 — 8 October 2026

Existing official Nasdaq Trader files now feed the shared daily core collector, CLI/API health gates, Today research UI and existing capped price tracking. No new external provider, migration, paper-entry policy or historical rewrite.

The first full directory is a baseline. Later complete-directory differences and dated Nasdaq-primary Add announcements create observations retained for 30 days. Add is not proof of an IPO. ETF/test/warrant/unit/right/preferred/debt/fund entries are excluded; SPAC common shares stay observation-only. Missing prices/financials remain unknown. Qualifying research requires >=25% same-filing USD revenue growth and positive same-period operating cash flow; long price history is not a visibility gate. This unvalidated filter does not create paper orders or prove profit.

Exact files, SHA256, file dates, first observation and first usable USD quote/market/receipt time are retained in collection metrics. Initial quotes are bounded to 20 attempts/run. Financial enrichment shares the existing 20/day queue and retry windows. Follow-up prices share the existing 50/day queue. This is daily bounded discovery, not intraday coverage; the separate 09:35 observation workflow remains DB-free calibration.

## Verification

- npm run typecheck: exit 0.
- npm run lint: No ESLint warnings or errors, exit 0.
- npm test with host TEST_DATABASE_URL pointing only to discovery_test: 78 files / 557 tests passed, 577.00s.
- Final focused regressions: 3 files / 11 tests passed, 43.11s, including Nasdaq failure -> HTTP 503 and advisory-lock release.
- docker compose exec -T app npm run build: exit 0; Compiled successfully; 22/22 static pages. Initial host build correctly rejected a conflicting .env.local target; the actual Docker/golden environment passed.
- App container restarted after final build. /today, /performance and /guide returned HTTP 200; Today HTML includes nasdaq-listings, all three observations, baseline and unknown labels; Guide includes its link.
- Real collection #76: both source dates 2026-10-08, status ok, first baseline. SCAT radar-only; SCATR/SCATW excluded. No eligible research picks/initial quote attempts. No invented shortlist.
- Real replay: status ok, baseline false, three observations, identical first-observation/price evidence, unchanged paper-trade ledger. No integration fixtures written to production.
- Isolated test database removed after tests (pg_database count=0).
- Browser automation could not initialize due to Windows sandbox setup failure; no visual browser verification claimed. Actual server-rendered HTML checked.

Next: observe the first unattended collection with this version and the first real eligible directory addition. Initial baseline cannot recover unobserved historical additions. New listing profitability and an IPO-specific capital policy remain unproven.
