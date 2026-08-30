# Market-cap tier counterfactual — Phase 1

Date performed: 2026-08-29
Status: historical read-only calibration, superseded by the approved
`market-cap-tier-policy-v1` implementation in commit `23122c9` on 2026-08-30

This document preserves the two-tier/top-three experiment that preceded the
final decision. It is not the current production policy: the implemented
policy uses three P25/P75-derived tiers and up to two selections per tier.

## Question

Would replacing the canonical single top-five capacity with up to three
companies below $10B and up to three companies from $10B through $75B give
both size groups useful representation without frequently producing empty
slots?

This phase does not change `buildCandidates()`, canonical eligibility,
ranking, scores, model version, schema, or stored history.

## Method

`npm run calibrate:market-cap-tiers` reads the frozen historical `rklb_daily`
scope through 2026-08-29 for model versions `rklb-discovery-v1` and
`rklb-discovery-v2`,
its immutable `discovery_decisions`, and existing `candidate_outcomes` inside
one `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` transaction,
then rolls the transaction back.

Historical base eligibility is not recomputed with current code. A decision is
eligible for the capacity counterfactual only when it was actually included or
its sole stored exclusion is exactly:

> Läbis baasfiltrid, kuid jäi viie kõrgeima järjestusega kandidaadi piirist välja.

Eligible decisions are ordered with the repository's shared canonical
comparator: supported criteria count, catalyst tier, Growth, Coverage, Health,
then ticker as a deterministic non-research tie-breaker. Market cap comes from
the immutable decision row.

The tested counterfactual is:

- below $10B: up to three;
- $10B through $75B inclusive: up to three;
- unknown market cap and above $75B: outside both quota groups;
- no cross-tier borrowing.

The report does not reconstruct outcomes for counterfactual-only selections
from later price data. Such rows have no historical `candidate_outcomes`, so
they remain explicitly untracked.

## Coverage

- 16 canonical runs, 2026-08-11 through 2026-08-29;
- one `rklb-discovery-v1` run on August 11, with zero candidates under its
  then-active catalyst gate;
- 15 `rklb-discovery-v2` runs, with 75 actual selection observations;
- 73 counterfactual selection observations;
- 49 observations overlap, 24 are counterfactual additions, and 26 actual
  top-five observations would be removed.

## Capacity result

Across the complete history:

| Tier | Runs below three | Share | Dates |
|---|---:|---:|---|
| Below $10B | 1/16 | 6.3% | August 11: 0 |
| $10B–$75B | 7/16 | 43.8% | August 11–16: 0; August 17: 1 |

The shortage is concentrated in the initial data-ramp period. August 19 is the
first run with at least three eligible companies in both tiers, and every one
of the following nine stored runs through August 29 also has full capacity.
Therefore top-three-per-tier is currently operationally feasible, but only nine
runs support that conclusion. The all-history 43.8% larger-tier shortage must
not be hidden by looking only at the mature end of the series.

## Selection composition and overlap

Actual top five across all runs:

- 71 below-$10B observations;
- 4 $10B–$75B observations: DKS three times and ESTC once.

Counterfactual:

- 45 below-$10B observations;
- 28 $10B–$75B observations.

In the sustained full-capacity period, nine runs would produce 54 tiered
selections versus 45 actual selections. Of those, 31 overlap, 23 are newly
surfaced by the counterfactual, and 14 current selections are displaced. No
run in this period has an identical selection under the two policies.

## Turnover and repeated occupancy

Across all 16 runs:

| Policy/tier | Selection observations | Avg retained | Avg entered | Avg exited | Avg Jaccard |
|---|---:|---:|---:|---:|---:|
| Current / below $10B | 71 | 4.27 | 0.47 | 0.27 | 85.9% |
| Current / $10B–$75B | 4 | 0.13 | 0.13 | 0.00 | 90.0% |
| Tiered / below $10B | 45 | 2.73 | 0.27 | 0.07 | 90.0% |
| Tiered / $10B–$75B | 28 | 1.33 | 0.53 | 0.33 | 73.6% |

The early empty larger tier inflates its all-history similarity statistics, so
the sustained full-capacity period is more informative:

- Counterfactual below-$10B: the exact same BW, CAVA, and ELF trio occupies all
  three slots in all nine runs. Average retained is 3.0 and Jaccard is 100%.
- Counterfactual $10B–$75B: average retained is 2.38, with 0.63 entry and 0.63
  exit per transition; Jaccard is 71.3%.
- Larger-tier occupancy leaders are ALL 6/9, CRCL 6/9, BJ 4/9, DKS 3/9, ET
  3/9, AAOI 2/9, BE 2/9, and ESTC 1/9.

The tier policy materially improves size representation and produces useful
turnover in the larger tier. It does not improve diversity in the smaller tier;
with a quota of three, it makes that tier completely persistent in the current
nine-run sample. Whether this persistence is desirable conviction or an
over-concentrated research queue remains an open product question for Phase 2.

## Outcomes

Only actual historical inclusions received `candidate_outcomes`. Therefore:

- all 75 actual selection observations have tracked outcome rows;
- only 49 of 73 counterfactual observations overlap an actual inclusion and
  have outcome rows;
- 24 counterfactual-only observations are untracked.

At one week, actual selections currently have 13 measured, 10 missing, and 52
pending outcomes. The 13 measured observations average +0.33% with a -4.71%
median. All measured observations are below $10B; the four actual larger-tier
observations are still pending.

The counterfactual-overlap subset has only five measured one-week outcomes,
averaging +14.31% with a +14.35% median. This is a selected overlap subset, not
the full counterfactual policy, and must not be compared causally with the 13
actual observations. There are zero measured 2-week, 1-month, 3-month, or
6-month observations. The outcome sample is therefore too small and too
selectively observed to support any choice of tier boundary or quota.

## Disposition after the production policy decision

This experiment showed that a size quota could change representation, but its
$10B/$75B boundaries and quota of three were not adopted. The approved
2026-08-30 policy instead uses the measured lookup P25/P75 boundaries
($1,791,164,000 and $48,338,040,832), three tiers, and up to two selections per
tier without borrowing. The following were open questions at the time of this
historical calibration and are retained as context, not as current blockers:

1. Is three persistent below-$10B names acceptable, or should `/today` separate
   stable incumbents from new entrants instead of adding a rotation rule to the
   ranking?
2. Should an empty tier remain empty, as tested, or may its unused capacity be
   borrowed? The counterfactual deliberately does not borrow.
3. Is nine full-capacity runs enough to implement, or should calibration wait
   for additional canonical dates and measured outcomes?
4. Schema-free derivation remains possible from frozen `market_cap` plus
   versioned run rules. Persisted tier/rank columns remain an audit/queryability
   alternative; this phase does not choose between them.

## Reproduction

```powershell
npm run calibrate:market-cap-tiers
npm run calibrate:market-cap-tiers -- --output path/to/report.json
```

The optional JSON artifact uses schema
`market-cap-tier-counterfactual-v1`. The script has no mutation flag and rejects
unknown arguments. Its database query is deliberately frozen to the original
v1/v2 history through 2026-08-29 so later `rklb-discovery-v3` runs cannot
silently change this historical report.
