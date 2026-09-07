# Three thesis reviews — 7 September 2026

**Implementation follow-up, later on 7 September:** the dated observations below are preserved. HIMS's same-filing asset/software deductions now produce stored derived H1 FCF of -$15.161m (fact #21375). API's SEC ordinary-share history was refreshed, with 349,264,771 shares at 2025-12-31 (#21616), explicitly not an ADS/diluted count. BW's stale cash/debt combination now makes EV/Sales unavailable; current total debt is absent from CompanyFacts and remains a filing-reconciliation gap. Broader API liquidity remains unresolved. See HANDOFF for verification and publication status.

These are dated research drafts against the saved 11 August theses, not new investment instructions. Neon was queried in a read-only transaction; saved thesis versions/statuses, scores and decisions were not changed. CAKE and ACHR remain outside this review because their latest theses were rejected. Baseline: [August research sprint](RESEARCH_SPRINT_2026-08-11.md).

## Evidence boundary

Prices below are persisted Yahoo observations from **4 September**, received on 6 September UTC / 7 September Tallinn. They are not live 7 September prices. Financial figures are USD millions unless stated otherwise. A missing stored metric does not mean the company has none. SEC filing checks supplement the draft only; they have not been imported into the application's financial facts.

| Company | Saved thesis | Price / market cap | Price snapshot | Actual market time (UTC) |
|---|---|---|---|---|
| API | #6 v2, ready | $4.24 / $358.491m | #2008 | 2026-09-04 20:00:01 |
| BW | #7 v2, researching | $7.10 / $1,057.652m | #2010 | 2026-09-04 20:00:03 |
| HIMS | #9 v2, researching | $27.71 / $6,465.114m | #2020 | 2026-09-04 20:00:02 |

No price movement since the previous thesis is calculated without a matched baseline. This review does not establish that no newer filing exists.

## API — reconcile the liquidity thesis first

**Draft conclusion:** the profitability-turnaround hypothesis remains testable, but the stored annual facts cannot establish current-quarter progress or the valuation discount claimed in the older thesis.

| Stored evidence | Period | Fact IDs |
|---|---|---|
| Revenue 141.057; net income 9.528 | FY 2025 | #1405, #1413 |
| Operating cash flow 27.233; capex 1.701; derived FCF 25.532 | FY 2025 | #1421, #1429, #1448 |
| Cash 75.446; debt metric 80.420 (`LongTermDebt`) | 2025-12-31 | #1437, #1444 |

These facts cite the [2025 SEC filing](https://www.sec.gov/Archives/edgar/data/1802883/000119312526155920/api-20251231.htm), filed 15 April 2026. Its SEC directory was reachable; the full filing exceeded the browser fetch-size limit, so the numbers above are explicitly database evidence, not a fresh line-by-line filing reconciliation.

**What changed in this review:** the new quote is available, but the financial table still ends in 2025. The older thesis's broader cash/deposits/financial-products figure is a different definition and date from the stored cash fact. Subtracting it from today's market cap while adding old debt would create an unreliable enterprise value. The stored debt tag also does not, by itself, prove total debt coverage. ADS versus ordinary-share units remain unresolved.

**Assumptions that need evidence:** recurring cash generation, accessible surplus liquidity after operating needs and obligations, and a share count expressed in the same units as the quote. Paid AI adoption and retention are hypotheses until supported by comparable reports.

**Review trigger:** the next available quarterly results, or an earlier financing/liquidity disclosure. Carry forward the saved checkpoint of two comparable quarters with at least 10% revenue growth, DBNRR at least 100, positive OCF and ADS-count growth no greater than 5%; these are thesis assumptions, not established outcomes. Preserve the existing invalidation involving sustained sub-5% growth or DBNRR below 95 together with unexplained negative OCF. Do not upgrade conviction until the liquidity and share-unit bridges are complete.

## BW — cash conversion and financing outrank backlog headlines

**Draft conclusion:** retain a research question about per-share turnaround; the stored balance-sheet inputs do not support a current net-cash or enterprise-value conclusion.

| Stored evidence | Period | Fact IDs |
|---|---|---|
| Revenue 319.716; net income 14.255 | Q2 2026 | #812, #842 |
| OCF 0.374; capex 13.747; derived FCF -13.373 | H1 2026 | #871, #901, #996 |
| Cash 308.634 | 2026-06-30 | #931 |
| Debt metric 181.150 | **2021-09-30** | #991 |
| Common shares 148,965,066 | 2026-08-04 | #961 |

**Additional source check:** the [June 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1630805/000163080526000068/bw-20260630.htm), liquidity discussion and Note 11, reports total debt of $276.8m including $23.7m unamortized premium, plus $191.7m gross preferred stock. Its cash reconciliation separates $308.634m cash/equivalents from $74.196m restricted cash. These figures expose the stored debt coverage gap; they are not automatic replacements for a defined valuation debt measure.

**What changed in this review:** the missing current debt evidence is available in the existing SEC source, but has not reached the normalized metric. Positive accounting income coexists with negative H1 derived FCF. A point-in-time common-share count is not a fully diluted denominator.

**Assumptions that need evidence:** backlog converts into collected cash at sustainable margins, financing claims are fully included, and execution creates value per diluted share. Do not annualize the H1 cash-flow figure or equate adjusted EBITDA with cash available to shareholders.

**Review trigger:** the next quarterly filing, material project change, or financing announcement. Compare backlog conversion, project margins, OCF and capex on matched periods; reconcile debt/preferred claims and diluted shares. Delays/cancellations, worsening cash conversion or material dilution without a defensible per-share benefit challenge the saved thesis. The existing two-quarter execution checkpoint remains unproven.

## HIMS — positive operating cash flow is not positive free cash flow

**Draft conclusion:** growth needs a cash-flow and organic-growth bridge before a defensible valuation assumption can be made.

| Stored evidence | Period | Fact IDs |
|---|---|---|
| Revenue 753.214; net income -86.290 | Q2 2026 | #1457, #1487 |
| OCF 53.417 | H1 2026 | #1516 |
| Cash 609.811 | 2026-06-30 | #1546 |
| Capex, FCF, debt and share count | No stored metric found | — |

**Additional source check:** the [June 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1773751/000177375126000163/hims-20260630.htm), FCF reconciliation, reports H1 purchases of property/equipment/intangibles of $55.770m and website/internal-software investment of $12.808m. Its defined FCF is therefore $53.417m − $55.770m − $12.808m = **−$15.161m**; Q2 FCF is **−$68.193m**. This company-defined measure includes more than a simple property/equipment deduction and must keep that definition visible.

**What changed in this review:** a missing application FCF field can be investigated in an already supported source. It cannot be interpreted as positive FCF merely because H1 OCF is positive.

**Assumptions that need evidence:** separate organic from acquired growth, explain margin changes, reconcile working-capital effects and investment needs, and establish diluted-share/debt coverage. The August thesis's retention, acquisition and GLP-1 questions remain open; this review has not independently settled them.

**Review trigger:** the next quarterly report, acquisition financing update or material disclosure relevant to the saved thesis. Recheck US organic growth, margin progression toward the saved approximately 70% checkpoint, and a consistently defined TTM FCF bridge. Sustained organic decline, margin below the saved 65% threshold, or cash generation dependent on temporary working-capital benefits challenge the thesis. H1 FCF alone does not determine TTM FCF.

## Product decision from the reviews

The next implementation should first make valuation input coverage dependable: reproduce BW's stale debt selection and HIMS's missing investment deductions in tests against existing SEC taxonomy data. Inspect available tags and definitions before changing extraction. Preserve historical score/decision snapshots; any refreshed facts must retain source, period, unit and provenance. Never silently replace generic FCF with company-defined FCF.

Then add company-specific versioned assumptions to the thesis workflow: source-backed inputs separate from user estimates, an explicit downside case and a falsifiable review trigger. Disable unsupported valuation anchors when debt/cash periods or share units are unresolved. These three drafts provide acceptance examples; no fair-value target or new scoring formula is justified yet.

## Verification and remaining limits

- Read-only Neon queries checked latest facts by ticker/metric, period end, filing date and ID; SQL dates were formatted explicitly to avoid timezone shifts. Price snapshots and saved thesis versions were inspected separately.
- SEC accession directories were reachable for all three; BW and HIMS filing text was inspected for the specific reconciliations above. API full-text fetch was size-limited.
- This is a documentation/research step. No application code, schema or database content changed; the previous code verification remains recorded in HANDOFF. No new automated tracking run was observed during this step.
- These drafts do not demonstrate improved returns. Saved thesis adoption, subsequent disclosures and forward tracking remain necessary evidence.
