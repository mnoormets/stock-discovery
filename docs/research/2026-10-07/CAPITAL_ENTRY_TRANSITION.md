# Same-ledger growth entry transition — 7 October 2026

The research scan is now connected to an explicitly activated, separately versioned `growth-capital-entry-v2` paper entry rule. Account identity remains `early-capital-v1`: original $20,000 capital, activation date, holdings, past costs/losses and $10,000 target are retained. No second funded experiment is created.

The rule admits coherent-period growth-opportunities-v2 early/momentum candidates, ordered by revenue growth then ticker. Latest successful collection evaluation must occur after the immutable activation time. Existing fresh paired USD regular-session quote checks, post-collection execution timing, 5% chase rejection, $2,000 entries, eight-position cap, $4,000 reserve, one lifetime entry per ticker, -8%/+20%/30-day exits, $18,000 risk stop and target liquidation are retained. Assumptions remain unvalidated; inclusion is not a profit prediction.

Migration 0012 adds the entry-policy activation table, protected against UPDATE/DELETE. CLI `paper:strategy -- activate-growth` locks the existing account, refuses a new transition for risk-stopped/completed accounts and is idempotent. Executor/trade evidence records the active entry version; Performance shows version/time. Database time is used by the normal executor.

## Verification before activation

Focused disposable-DB tests: two files / 11 tests, 32.42s, exit 0. They verify preservation of old trade rows and losing positions, same-account cash use, pre-activation rejection, momentum entries, no duplicate buys, immutable activation and risk-stop protection.

```text
✔ No ESLint warnings or errors
✓ Compiled successfully
✓ Generating static pages (22/22)
```

Final full regression passed, exit 0: 76 files / 550 tests, duration 481.49s. Disposable discovery_test count 0 after teardown.

Neon preflight GO: 0 duplicate prices / invalid thesis states, exactly one pending migration. Private PostgreSQL 18 backup validated with pg_restore --list: 14,295,236 bytes, 357 entries, SHA-256 4b66d57ad74a6cfb3a2789a229692892c274f6cc7200d1ad9b19d523cc747b96. No backup is published. Migration applied in 117ms; post-conformance VASTAB, no missing/extra objects.

Before migration/activation: one capital account, initial_usd 20000, target_profit_usd 10000, created_at 2026-10-06T18:12:06.959Z; four trades, ordered whole-row MD5 03559f4d667e7e71eb14b328de53fa3b. This checksum is an integrity comparison, not a financial performance calculation.

Initial full regression exited 1: 75 files passed / one failed; 549 tests passed / one failed, duration 559.16s. The sole failure was infra-smoke expected table inventory missing the deliberately added entry-policy table. Updated that inventory/name; clean full rerun is in progress. No failed run is counted as a pass.

## Activation and integrity

Actual activation at 2026-10-07T16:58:20.389Z (DB clock), account early-capital-v1, entry growth-capital-entry-v2. Repeating the CLI returned the identical row/time and created no second activation. After activation the account metadata, four-trade count and ordered whole-row MD5 remained identical: 03559f4d667e7e71eb14b328de53fa3b. Original initial cash/date and history were not reset. A fresh collection and paper fills were subsequently verified under the same advisory lock as scheduled collection; see the actual forward-fill section.

## Actual forward fills

Shared-lock core collection #74: 137 radar stocks / 11 growth candidates, evaluated 17:00:00.596 UTC, completed 17:00:00.813 UTC. The existing Tradestie fallback and absent optional FMP key were visible; no new provider/enrichment pipeline was introduced. Executor 17:00:23.466 UTC inserted six fresh stock buys MU/PLTR/IREN/CORZ/DELL/AVGO and six matched SPY fills; current source true, capital issues/splitIssues []. AMD remained in the research list but below six available growth-ranked entry slots. No ticker preference was changed to force its purchase.

Repeat 17:00:47.032 UTC inserted zero trades and verified all holdings with issues/splitIssues []. One account, eight stock positions, 16 paired-ledger trade rows, $4,000 cash, realized $0. Old four whole-row hash remains 03559f4d667e7e71eb14b328de53fa3b. Independent SQL cash + quantity-times-latest-mark valuation reconciles to equity $19,809.730785 / loss $190.269215; matched SPY loss $36.089400. These are actual simulated fills, not credited pre-entry returns; profitability remains unproven. Combined CLI exited 1 solely for six original V1 HRGN deferred orders.

App restarted after build. Final warm HTTP Performance/Today returned 200 with the new entry-version and -190,27 content. Actual browser Performance displayed active growth-capital-entry-v2 at 19:58:20 Tallinn, all eight positions, $4,000 cash, -$190.27, realized $0 and current source yes. Publication remains pending at this checkpoint.
