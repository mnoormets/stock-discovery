# Growth discovery and clock repair — 7 October 2026

The new `growth-opportunities-v2` research scan uses existing SEC/Yahoo data. It compares revenue and operating cash flow from identical periods and filings, requires at least 25% revenue growth and positive cash flow, and separates early setups from already rising momentum candidates. It never substitutes an older favorable cash-flow period. Source facts must have been known by the quote time. Same-day daily closes, future history, incompatible currency/identity and splits cannot supply a valid reference.

Today → Growth opportunities shows price/time, source links, financial periods, 1/3/6-month moves, reasons/exclusions and immutable first-discovery history. This scan does not activate a new trading policy. History is observation return, not purchase profit. The bounded existing radar is not the whole stock market; at most 20 chart requests per collection and 50 shared tracking symbols per day remain explicit limits.

## Real runtime evidence

Collections #71/#72 retained first observations on repeat; canonical #103 was reused with zero new orders/outcomes. AMD was first recorded at $644.37, quote 16:00:23 UTC, with 44.08% same-filing YTD revenue growth and $5.321bn OCF. Nothing was backdated to the October 1 scan or bought retrospectively. First evaluation timestamps from these collections were affected by client clock skew and remain unchanged.

Windows client time was approximately 76 seconds ahead of Neon, so a finished collection could still appear to contain future evaluation evidence. Receipt and evaluation now use the database clock. Final collection #73 saved 137 radar stocks, 18 chart histories, zero chart deferrals, five early and five momentum candidates. Both scans evaluated at 16:18:20.799 UTC, before DB completion at 16:18:21.058 UTC.

Momentum: HPE, MU, PLTR, AMD, DELL. Early: IREN, AVGO, CORZ, LRCX, CDE. The actual Today browser displayed AMD $642.50 and -0.29% since its new first discovery, with SEC period/source evidence. These categories do not establish future returns.

The final existing paper executor at 16:24:52.987 UTC read source #73 as current, reported capital issues/splitIssues [], and inserted zero capital trades. Independent accounting: cash $16,000, equity $19,823.559180, total loss $176.440820, realized profit $0; matched SPY loss $21.590366. Four capital/benchmark trades and two stock positions remain. Performance visibly showed these numbers and current source yes.

The whole paper CLI still exited 1 for six unrelated original V1 HRGN orders with unusable quotes. Daily collection CLI also exited 1 because four follow-up symbols (IREN/LRCX/MU/PLTR) were deferred at the tracking cap. Neither failure was concealed or resolved with stale fills. The new core collection #73 itself completed successfully.

## Executed verification

Final code commands in the Docker app container, all exit 0:

```text
> npm run typecheck
> node node_modules/typescript/bin/tsc --noEmit
> npm run lint
> node node_modules/next/dist/bin/next lint
✔ No ESLint warnings or errors
> npm run build
✓ Compiled successfully
✓ Generating static pages (22/22)

Test Files 75 passed (75)
Tests 547 passed (547)
Duration 518.23s
```

Tests cover coherent periods and accession, latest negative OCF, future/stale evidence, same-day bars, split/currency/identity failures, bounds/deferrals, frozen category/version history, no research orders/accounts, and a real disposable-DB collection with deliberately skewed client time. Disposable `discovery_test` database count was 0 afterward.

App restarted after production build. Warm HTTP and rendered-content checks:

```text
today 200 true
performance 200 true
```

Actual browser Today and Performance checks confirmed the new research section and real money figures. Initial cold smoke timed out before development compilation finished; later warm checks passed. An earlier interrupted Docker test client left orphan Vitest processes, causing a subsequent setup failure; those test-only processes were terminated before the clean final full suite. Interrupted/failed attempts are not counted as passes.

No broker trades, new provider, capital top-up, policy reset, migration or rewritten financial/trading history. Profitability, earlier detection across a broad future cohort and the next unattended run remain unproven. Any capital strategy transition needs its own version and must retain existing cash, positions and full profit/loss history.
