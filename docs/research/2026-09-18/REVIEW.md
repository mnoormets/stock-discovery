# V4 paper experiment: first outcome review
## Decision
Repair quote-time measurement before tuning the strategy or considering live money. This is an audit of a simulated experiment, not a recommendation to buy its stocks.

The 18 September extract has 11 measured one-week decisions across eight tickers. Nine candidate endpoints and all 11 SPY endpoints lack stored market timestamps. Their historic arithmetic is preserved but is not verified evidence of an investment edge. Entry-aware v4 purchases are concentrated: SNDK and WTI account for 53.85% of gross simulated purchases.
## Context and method
Source: `evidence.json`, extracted from the existing Neon database in one read-only transaction. Exact SQL is retained in that file. No external refresh, backfill, or production mutation. Outcomes and paper fills are different populations: outcomes begin at decision prices; paper fills occur later and include modeled fees.

Same-ticker outcomes are averaged first; ticker averages then receive equal weight. This is a descriptive mean, not a portfolio return. Endpoint joins use the recorded receipt timestamp at millisecond precision and price because the current outcome schema has no endpoint snapshot ID. Assert uniqueness before interpreting links. The small, overlapping first-week cohort cannot establish durable skill. Starting-price timing, dividends, taxes, FX and execution slippage are not validated here.


```text
Extracted: 2026-09-18T11:38:48.037Z
One-week decisions: 53 | measured: 11 | pending: 42
Unknown candidate market time: 9
Unknown SPY market time: 11
```

## Historical arithmetic — not validated performance
These values explain the stored records only. Do not rank candidates or tune thresholds from this affected, tiny sample.

```text
ALL   -0.463 percentage points vs SPY (unverified timing)
ARM   +2.359 percentage points vs SPY (unverified timing)
BWFG  -0.948 percentage points vs SPY (unverified timing)
CRDO  +3.586 percentage points vs SPY (unverified timing)
DY    -3.825 percentage points vs SPY (unverified timing)
FOR   -2.100 percentage points vs SPY (unverified timing)
SNDK  -5.678 percentage points vs SPY (unverified timing)
WTI   -7.379 percentage points vs SPY (unverified timing)
Equal-ticker descriptive mean: -1.806 pp
```

## Concentration
Denominator: gross filled v4 entry-aware strategy purchases, excluding SPY comparison legs, pending and skipped orders. This is purchase concentration, not current market-value weights or the user’s money.

```text
SNDK   8 purchases  $800  30.77%
WTI    6 purchases  $600  23.08%
ALL    4 purchases  $400  15.38%
RDDT   4 purchases  $400  15.38%
API    2 purchases  $200  7.69%
CRCL   1 purchases  $100  3.85%
FOR    1 purchases  $100  3.85%
Total simulated purchases: $2,600
Largest two: 53.85%
```

## Action and next experiment
1. Preserve provider quote timestamps through every existing Yahoo price writer. Require known, non-future market time at/after the target for new stock and SPY endpoint measurements. Preserve old measured rows and make their limitation visible.
2. Review a clean forward cohort separately from affected historical rows. Require comparable marks before reporting paper P&L; current API/BWFG stale marks prevent a complete book valuation.
3. Before changing the existing daily $100 policy, specify a separate prospective experiment with finite simulated capital and position limits. Compare it against the unchanged strategy and matched SPY cash flows, including fees, drawdowns, concentration, missed fills and outcome coverage. Do not select limits that maximize this first week’s results.
4. Continue paper-only evaluation. The user has not committed a live budget or loss tolerance. Profit over one short period is insufficient evidence to allocate all savings.

Public methodological reference: [SEC Investor.gov: asset allocation and diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation). Investment horizon and risk tolerance matter; spreading investments reduces concentration risk. This guidance does not validate this app’s performance.
