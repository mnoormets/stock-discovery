# Paper review — 30 September 2026

Read-only Neon audit at 2026-09-30T19:43:25.042Z. Evidence: [evidence.json](evidence.json). No application/database/strategy changes or executor run.

## Money actually simulated

Entry-aware V1: 85 filled buys, 14 open tickers, zero sales and zero pending orders. Invested including fees: $8,508.50; marked holdings: $8,310.52; unrealized P/L: -$197.98 (-2.3269%). Matched-cash-flow SPY: +$7.28; strategy trails by $205.27. Marks are 30 September 13:30:30–13:35:43 UTC (16:30–16:35 Tallinn), not current intraday or closing prices. App valuation is complete; independent SQL reconciles profit to -197.984868054226.

18 September recorded P/L was +$34.58 on $3,303.30 contributed. Since that checkpoint, another $5,205.20 was contributed and cumulative P/L deteriorated $232.57. This is not a fixed-capital two-week percentage return. The policy repeats $100 purchases on each eligible signal; 21 SNDK and 15 WTI buys now account for 42.35% of purchase capital.

| Ticker | First buy | Invested incl. fees | Unrealized P/L | Return |
|---|---|---:|---:|---:|
| SNDK | 2026-09-10 | $2102.10 | $47.63 | 2.27% |
| YOU | 2026-09-24 | $200.20 | $12.00 | 5.99% |
| DKS | 2026-09-18 | $200.20 | $7.79 | 3.89% |
| API | 2026-09-08 | $1001.00 | $2.12 | 0.21% |
| ARM | 2026-09-29 | $200.20 | $0.91 | 0.46% |
| SF | 2026-09-28 | $100.10 | $-0.10 | -0.10% |
| CRCL | 2026-09-16 | $100.10 | $-0.71 | -0.71% |
| OUT | 2026-09-21 | $200.20 | $-1.82 | -0.91% |
| FOR | 2026-09-11 | $400.40 | $-3.73 | -0.93% |
| CRDO | 2026-09-22 | $500.50 | $-4.11 | -0.82% |
| APP | 2026-09-18 | $500.50 | $-34.27 | -6.85% |
| RDDT | 2026-09-14 | $900.90 | $-49.57 | -5.50% |
| ALL | 2026-09-11 | $600.60 | $-62.46 | -10.40% |
| WTI | 2026-09-11 | $1501.50 | $-111.66 | -7.44% |

## Caught and missed moves

Stored known-market-time USD observations from 18 September to 29 September, limited to companies with both endpoints; not a market-wide gainers ranking, not adjusted total returns, and not all of September. Discovery/price observation does not equal an executed entry-aware purchase.

- DKS rose 11.18% between stored endpoints. First entry-aware buy was 18 September at $123.33, before this interval's rise; a later buy at $134.55 reduced the combined return. Current combined P/L +$7.79.
- YOU rose 8.19% between endpoints; first buy on 24 September at $39.155 captured part of the move. Combined P/L +$12.00.
- CRDO rose 9.36% between endpoints, but entry-aware first bought on 22 September at $188.39, then also at $194.0695 and $204.50. Current weighted entry $193.5795 exceeds mark $192.18; combined P/L -$4.11. The all-picks control bought earlier and must not be confused with entry-aware results.
- EU +28.32%: excluded all 12 days because Growth 63 was below 65.
- CAKE +11.23%: excluded all 12 days because the linked collection did not confirm market data, despite other stored price history.
- BE +9.64%: excluded nine days by the two-slot market-cap tier limit, three days by same-collection data eligibility.
- RKLB +7.94%: explicitly excluded as the comparison example all 12 days.

These explain actual rules and timing, not proof that retrospectively removing a filter will improve future returns.

## Operational evidence and remaining gaps

All 12 core collections and canonical daily runs from 19–30 September exist and succeeded (collections #48–59, discovery #82–93). Entry-aware fills exist on all eight intervening trading days, 52 additional buys. This does not prove every GitHub workflow, SEC substep or heartbeat succeeded.

The all-picks control has three pending HRGN buys plus three paired SPY legs from 26–28 September. Its MSC mark is still from 28 September, so its aggregate P/L correctly remains unavailable. Cause of HRGN deferral and MSC stale quote requires execution-log/provider diagnostics; no forced fill or stale-mark substitution was performed. The entry-aware book is unaffected.

Current evidence does not demonstrate profitable entry selection or superior market performance. Next work: diagnose pending/stale control quotes, then review concentration, repeated entries and missed-name rules using versioned prospective experiments. Preserve existing history. No new provider, live-money orders or retrospective policy tuning.

## Verification

Read-only application valuation and independent SQL totals agree within floating-point rounding; dated collection/discovery and fill records inspected. Documentation/evidence only: no code test, build or UI verification was run or claimed. Initial exploratory daily-grouping query had a SQL alias syntax error; corrected query succeeded and is saved under days.
