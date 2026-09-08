# Project review — 6 September 2026

Objective confirmed by the user: improve their own investing results. This is a review of the existing product, not a subscription-business plan or an instruction to trade.

Reviewed checkout: `b5f3290` (`main`); `git ls-remote origin refs/heads/main` returned the same full commit. Evidence below comes from repository inspection, read-only Neon queries starting at 11:30 UTC, and the running Docker app. No collector, paper execution, production migration, ranking change, historical backfill, or broker transaction was initiated by this review. Only documentation was edited.

## Judgment

Implementation follow-up: the user approved proceeding after this review. The first slice refreshes open paper holdings without new orders, withholds stale/misaligned paper valuations, and qualifies stale/partial Today setups. The 7 September follow-up implemented bounded research/outcome price tracking; unattended attempts were observed through 8 September without fabricating holiday prices. The 8 September valuation-review slice adds versioned company assumptions, reverse valuation, an observable review trigger and exact price context to Thesis Builder. This review preserves the original findings; current verification, remaining work and publication status are in [HANDOFF.md](HANDOFF.md).

The app has a useful foundation: source-linked facts, immutable decisions, transparent scores, a thesis journal, and a paper benchmark. Its immediate bottleneck is continuous tracking after discovery. Today it can keep recommending research on a stock while no longer collecting the prices needed to assess its current setup or measure the outcome.

Fix that measurement loop first. Then use the existing app to make a small number of explicit, reviewable research decisions. More scanners, providers, aggregate scores, or pages are unlikely to improve the user's investing results as quickly as trustworthy prices, company-specific valuation assumptions, and disciplined follow-up.

There is currently no demonstrated investment edge. This is not a conclusion that the idea cannot work; the available outcome sample is small, repetitive, incomplete, and belongs to the previous discovery model.

## What actually happened during the last three days

| Date | Collection | Canonical run | Evaluated | Included | Included names with current collection lookup |
|---|---:|---:|---:|---:|---:|
| 4 Sep | #30, success | #62 | 119 | 6 | 4 |
| 5 Sep | #31, success | #63 | 124 | 6 | 2 |
| 6 Sep | #32, success | #64 | 129 | 6 | 1 |

The database supports continued unattended operation: the last three core collections succeeded and corresponding canonical runs exist. This review did not separately inspect cron-job.org or GitHub Actions run logs, so it does not certify every workflow step or notification.

Form 4 records for 31 Aug–4 Sep were all in `persisted` status in the registered population: 384, 521, 830, 971, and 458 filings respectively. Collection #32 used 4 Sep source evidence, age two days, `stale=false`, with eight insider issuers selected. This confirms the newer ingestion code is reflected in database behavior; it does not assert completeness beyond the registered index population.

Paper baseline: 18 filled stock buys across eight tickers and 18 matching SPY buys, each book with $1,800 gross purchases and $1.80 recorded fees. Twelve additional buy intents per book came from the weekend canonical runs. Entry-aware has 30 skipped stock signals and zero fills.

## Priority 1 — keep following a stock after finding it

**Confirmed pipeline gap.** `collectCore()` selects market-data lookups from the current social and insider inputs. It does not independently guarantee continuing quotes for prior canonical picks, live theses, open paper positions, or outstanding outcome horizons. `refreshCandidateOutcomes()` reads `price_snapshots` only. Paper execution writes another table, `paper_strategy_marks`.

Actual examples:

| Ticker | Latest `price_snapshots` observation | Latest paper mark | Consequence |
|---|---|---|---|
| BW | 18 Aug, 21:10 UTC | 4 Sep, 13:35 UTC | Today's decision uses an old price despite a newer quote already existing elsewhere. |
| ELF | 26 Aug, 05:11 UTC | 4 Sep, 13:35 UTC | Current setup and horizon measurement do not use the newer paper quote. |
| CRDO | 5 Sep, 05:51 UTC | 2 Sep, 14:55 UTC | Research storage is newer than the price used to value an open paper holding. |
| FIVE | 3 Sep, 05:11 UTC | 3 Sep, 13:35 UTC | Open paper holding missed the 4 Sep valuation update. |

There were 45 canonical outcomes marked `missing`, plus 59 pending outcomes whose targets had already arrived. Pending inside a seven-day measurement window is expected; the concern is missing continued price observations. The pending/missing set already had paper marks inside the target window for 14 BW and 13 ELF outcomes in a read-only diagnostic. Those were not backfilled or remeasured.

Recommended implementation: maintain a bounded tracking set separate from new-discovery selection. Include open holdings, active research ideas, and selected companies through their remaining measurement windows; retain SPY. Reuse Yahoo and the existing persistence layer. Record the observation time, collection time, source, and tracking reason. Keep discovery provenance distinct from follow-up tracking rather than inventing a social/insider lookup link.

Acceptance: a stock absent from tomorrow's social radar still receives a price, retains its outcome coverage, and has an auditable tracking reason. Repeated runs must not duplicate identical observations. Never rewrite already measured outcomes or historical decisions. Any migration of existing paper marks into the outcome price history needs an explicit, provenance-preserving design; do not silently treat a present-day recovery as an original observation.

Code: `src/lib/collect.ts:101`, `src/lib/paper-strategy-store.ts:294`, `src/lib/discovery-validation.ts:390`.

## Priority 2 — prevent old or partial prices from producing a green setup

**Confirmed UI/runtime defect.** On canonical run #64, both BW and ELF display green **Not overheated**. BW's decision price is $9.14 from 18 Aug; ELF's is $105.77 from 26 Aug. ELF's expanded panel shows only four stored observations, a one-month return of +14.9%, and unknown three-/six-month history. Its summary says no major candidate-level quality warning is recorded.

`buildPriceContext()` receives the canonical run time as `asOf` and the decision's latest stored price as `currentPrice`, without checking that price's observation age. `derivePaperMarketSetupState()` treats any history other than `insufficient` as eligible for `not_overheated` when no known threshold is breached. Consequently, time passing can bring an old reference into the one-month tolerance window and change the label even without a new quote.

Recommended change: expose the price timestamp next to the price and headline setup; distinguish `current price missing/stale`, `partial history`, and `no elevated run-up in observed windows`. Require explicit recent-price evidence before assigning a reassuring current-setup label. Use session-aware age so a normal weekend is not confused with an 18-day gap. Preserve frozen signal evidence; version any changed paper eligibility contract.

Acceptance: the exact BW/ELF snapshot cases cannot display an unqualified green current setup. A genuinely current quote with partial history must say which windows were assessed. Missing data stays unknown. Do not weaken entry-aware gates simply to force the first trade.

Code: `src/lib/today-brief.ts:919`, `src/lib/price-context.ts:66`, `src/lib/paper-strategy.ts:73`, `src/components/CandidateSituationSummary.tsx`.

## Priority 3 — value every open paper holding on a consistent basis

**Confirmed accounting defect.** `executePendingPaperOrders()` builds its quote universe exclusively from pending orders. A held ticker with no new order does not get a daily mark. `getPaperPerformanceDashboard()` checks only whether a mark exists, not whether it belongs to the comparable valuation session.

The live Performance page showed the baseline as **VALUED**, +$6.17 / +0.34%, while SPY showed +$6.92 / +0.38%. The stock book mixed marks from 2–4 Sep; SPY used 4 Sep marks. These are the displayed numbers, not verified current or synchronized performance.

Recommended change: fetch the union of pending-order tickers and all net-open holdings, including SPY. Update marks even on a day with zero new orders. Show a stale/incomplete valuation state when the marks do not meet the agreed valuation-session rule, and display benchmark-relative performance only on a comparable basis.

Acceptance: fill a stock on day one, provide no new orders on day two, and prove its value changes with day two's quote while the order count stays unchanged. Also test a failed held-stock quote, closed positions, holidays, repeated execution, and unmatched SPY/stock fills. Deferred sell intents spanning several canonical runs deserve a separate regression check before relying on automated exits; no live oversell was observed in this review.

Code: `src/lib/paper-strategy-store.ts:300`, `src/lib/paper-performance.ts:171`.

## What the performance evidence does and does not say

Canonical v3 began on 31 Aug. Its seven days contain 42 selected decisions across eight tickers, with no measured horizons yet.

| Previous-model canonical results | Measured observations | Distinct tickers within horizon | Mean stock return | Mean excess versus SPY |
|---|---:|---:|---:|---:|
| v2, one week | 18 | 3 | −1.391% | −0.614 percentage points |
| v2, two weeks | 8 | 2 | −8.551% | −7.795 percentage points |

Across both rows there are only three distinct stocks and five positive observations out of 26. Pooling them gives −2.824 percentage points mean excess, but that is **not a portfolio return** or 26 independent bets. There are no measured one-, three-, or six-month canonical outcomes.

Current Backtest/Validation aggregate queries filter canonical runs but pool model versions. Before interpreting future results, add model-version and horizon separation plus distinct ticker/decision counts, missing-outcome coverage, and an explicit first-discovery cohort. Daily repetition should not look like independent confirmation. Keep the daily repeated-purchase baseline as its own documented experiment.

The entry-aware skip breakdown is operationally revealing: 14 signals lacked history only; 12 lacked both history and current collection confirmation; four lacked current collection confirmation only. Zero fills is not yet evidence of a good or bad investment strategy—it is primarily a data-readiness result.

## The next useful product improvement

Build a compact **decision review** using the existing Thesis Builder, rather than another general dashboard. Each researched company should answer:

1. What changed since my last review, and is it new evidence or the same filing repeated?
2. What revenue, margin, cash-flow, dilution, and valuation assumptions would justify the current price?
3. What is the downside under a plausible company-specific failure scenario?
4. Which observable event invalidates the thesis, and when will I check it?
5. What portfolio exposure would this create, including overlap with holdings that depend on the same industry or business driver?

The present Scenario Valuation is explicitly mechanical: for a P/E anchor, the bear case multiplies earnings and the multiple by 0.8, producing −36%; the bull case multiplies both by 1.2, producing +44%; base is the starting price. These are useful arithmetic demonstrations, but they do not establish mispricing. Replace or supplement them with versioned, user-entered company-specific assumptions and a reverse-valuation question: **what must this business deliver to justify today's price?** Do not fabricate forecasts or assume that a positive scenario is likely.

All six current picks have Growth 100. This is partly expected from a scoring function that saturates at 30% component growth. Display the raw growth rates, comparison periods, and whether improvement reflects a loss narrowing or a small base. Do not retune the score just to break today's ties; the first task is to understand the economic differences the score compresses.

The five stored current theses were last revised on 11 Aug: API ready; BW and HIMS researching; CAKE and ACHR rejected. That only establishes in-app editing activity, not what the user researched elsewhere. It nevertheless suggests the quickest useful experiment is three fresh, written decisions using the existing tools, followed by dated reviews, rather than another month of feature accumulation.

The paper baseline is an unlimited stream of $100 purchases per included name per calendar day. Weekend repeats are currently intentional and queue for a future regular session. Preserve this baseline, but do not confuse it with a capital-constrained personal portfolio. A later, separately versioned paper experiment should specify available cash, position/concentration limits, treatment of repeated signals, order expiry, and exits before measuring results. Values for those limits need the user's actual risk constraints; this review does not invent them.

## Recommended order of work

| Order | Deliverable | Proof required |
|---|---|---|
| Now | Fix held-position marking and stale/partial setup labels | Reproduce CRDO/FIVE and BW/ELF cases in tests; runtime and database checks; preserve immutable history. |
| Next | Continuous tracked-universe quotes using existing Yahoo data | Selected stocks remain observable after leaving the radar; due outcome gaps no longer grow merely from attention loss. |
| Next | Three current thesis reviews; company-specific valuation assumptions | Dated evidence, explicit unknowns, invalidation, and a next-review trigger for each. |
| Then | Version-separated performance and a capital-constrained paper variant | Comparable price dates, coverage, independent cohort counts, explicit cash and risk policy. |
| Later | Broader discovery and calibrated enrichment changes | Existing observation artifacts demonstrate the bottleneck and expected benefit; no new source without user approval. |

A few weeks can establish whether the workflow is usable and the data is dependable. They cannot guarantee profitability or establish a robust long-term edge. Continue accumulating honest forward results, including failures; published investor guidance also cautions that past performance does not predict future performance ([Investor.gov](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/updated-investor-bulletin-how-read-mutual-fund-or-etf-shareholder-report)).

## Secondary maintenance findings

- Local host startup still has a reproducible configuration trap: `.env` targets Neon but `.env.local` targets the frozen local `discovery` database. An unqualified host `npm run dev` initially rendered run #34 from 19 Aug. That host server was stopped; the Docker app explicitly supplies the Neon URL and rendered run #64. No environment file was edited and the frozen database was not migrated or collected into. Prefer the verified Docker entrypoint until a safe host launcher/configuration check is added.
- The master plan contained completed work under Now and old statements that contradicted the running system (including Form 4 hotfix awaiting push, discovery v2 as current, and absent automated tests). Current focus and roadmap were reconciled in this session; older detailed evidence remains historical.
- Next.js 14 is unsupported according to the [official support policy](https://nextjs.org/support-policy). Plan a separate tested upgrade to a supported, patched release. The [August security release](https://nextjs.org/blog/august-2026-security-release) includes condition-specific issues; this audit did not establish that those exploit paths apply to this app. Authentication and authorization remain necessary before any public deployment, but public deployment is not the user's current objective.
- The repository's blanket claim that GitHub Free private repositories cannot use scheduled workflows is not supported by current [Actions availability documentation](https://docs.github.com/en/actions/concepts/billing-and-usage) or the [schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Preserve the working external scheduler; describe the earlier failure as an observed repository incident rather than a general plan restriction. No scheduler was changed.

## Verification

Baseline verification results and real terminal excerpts are recorded in the master document's 6 September test-evidence entry. The isolated test suite uses `TEST_DATABASE_URL=postgres://discovery:discovery@localhost:5433/discovery_test`, never Neon. The production build ran inside the mounted Docker app, followed by the required app restart. Only read-only app surfaces were used for Neon runtime checks.

The confirmed findings above remain **unfixed** in application code. Passing existing checks would show that the current regression suite accepts the current implementation; it would not disprove these observed data and UI defects.
