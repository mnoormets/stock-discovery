# BW and API: debt, liquidity and share reconciliation

Reviewed 7 September 2026. All balances below are at **30 June 2026**, in USD millions. These are dated manual SEC reconciliations, now visible on the company pages. They are not automatically refreshed CompanyFacts inputs or changes to saved investment convictions.

## BW

The [10-Q filed 10 August](https://www.sec.gov/Archives/edgar/data/1630805/000163080526000068/bw-20260630.htm), balance sheet and Notes 11/13, supports:

| Borrowing component | Carrying value |
|---|---:|
| Current senior notes | 61.369 |
| Current borrowings | 0.151 |
| Noncurrent borrowings | 67.416 |
| 2030 senior notes | 147.907 |
| **Total** | **276.843** |

This rounds to management's $276.8m. The 2030 notes include $23.668m unamortized premium; carrying amounts also reflect financing-cost deductions. They are not face values or quoted market values.

Cash/equivalents: $308.634m. Restricted cash: $74.196m, excluded. Separate claims: approximately $191.7m gross preferred stock, $27.822m finance leases and $17.623m operating leases. Total liabilities of $942.234m already include borrowings and must not be added to them.

Cash less borrowings is $31.791m. Including preferred stock and finance leases instead gives approximately **$187.731m of claims above cash**, before operating leases and other obligations. This is an illustrative carrying-value bridge, not enterprise value: pensions, customer warrants, working capital and claim valuation still require their own treatment.

**Resolution:** the stale 2021 normalized debt metric is not the only evidence available. The complete June borrowing bridge and separate claims are now available together, with their source. Automatic EV/Sales remains withheld because it has not acquired a complete, defined valuation treatment for these claims.

## API / Agora

The [Q2 results furnished 14 August](https://www.sec.gov/Archives/edgar/data/1802883/000119312526350691/api-ex99_1.htm) provide:

| Liquidity component | Amount |
|---|---:|
| Cash/equivalents | 72.667 |
| Short-term bank deposits | 215.988 |
| Short-term bank products | 52.000 |
| Long-term bank deposits | 21.000 |
| **Broad liquidity** | **361.655** |

This rounds to $361.7m. It excludes $0.200m restricted cash and $3.181m short-term investments. Same-date borrowings are $1.330m short-term plus $98.986m headquarters-project debt = **$100.316m**.

Broad liquidity less borrowings is **$261.339m**; cash/equivalents alone less borrowings is **−$27.649m**. Operating leases ($1.085m), construction payables ($17.340m) and the headquarters advance ($21.292m) are separate obligations. The broad balance is not a freely distributable cash estimate.

One ADS represents four Class A ordinary shares. Period-end ordinary shares were approximately 335.1m (83.8m ADS equivalents). Q2 weighted-average diluted ADSs were 92,384,656; do not use that earnings denominator as period-end shares.

The [2025 20-F](https://www.sec.gov/Archives/edgar/data/1802883/000119312526155920/api-20251231.htm) further distinguishes maturity-based deposits and investment products from cash equivalents. It also describes restrictions on distributions from PRC subsidiaries. June consolidated balance totals do not establish how much can immediately reach the parent or shareholders. The filing-size browser limitation was overcome by fetching the complete official SEC document for targeted text inspection.

**Resolution:** the liquidity definition, same-date borrowing offset and ADS conversion are established. A company-specific cash haircut, operating cash reserve or distributable-cash estimate would be an additional investment assumption, not a missing reported number.

## Implementation boundary

`balance-review-2026-09-07` is a reviewed application record with source URL, filing date and reporting date. Its totals are calculated from components and tested. It displays on BW/API company pages only, explicitly labeled manual and dated. It neither overwrites normalized facts nor retroactively changes scores, decisions, outcomes or theses. New filings require a new review version; retain this record as evidence of what was reviewed on this date.

Verification results are recorded in [HANDOFF](HANDOFF.md).
