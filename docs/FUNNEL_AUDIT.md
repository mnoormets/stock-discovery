# Radar funnel audit – 2026-08-11

## Scope and evidence boundary

This is a read-only product audit of the latest persisted radar snapshot and the latest canonical `rklb_daily` run. No collector, Yahoo/SEC refresh, score recalculation, external web source, or application write action was run. `unknown` means that the required evidence was not present in PostgreSQL at audit time.

The previously reported “43 ticker universe” is not reproducible from the current persisted snapshot: `snapshots` contains **42 rows** for `2026-08-11`. The latest canonical run contains 8 decisions, but only 5 of those tickers are in the latest radar snapshot; AAPL, RKLB, and TSM entered the financial universe through earlier/manual company collection. The audit table therefore contains the exact 42 persisted radar rows instead of inventing a 43rd row.

Instrument legend:

- `EQUITY` means `companies.quote_type = 'EQUITY'` is persisted.
- `equity-like*` means a Yahoo-derived price and market cap exist and the ticker passed the collector's known fund/ETF filter, but common-stock status was not persisted.
- `unknown` means the DB cannot prove common stock, ETF, or another instrument type.
- No confirmed ETF remains in the latest radar snapshot.

All 42 radar rows have `sector` and `industry` missing. Market caps and prices below are the newest already stored values, not refreshed values.

## 1. Ticker-by-ticker audit

| Ticker | Company | Instrument | Market cap / price | Sector / industry | SEC facts | G / H / C | Latest canonical decision | Gate judgment | 30 min? | Short reason |
|---|---|---|---|---|---:|---|---|---|---|---|
| EDBL | Edible Garden AG Incorporated | equity-like* | $1.1m / $1.77 | unknown | no | — / — / — | not evaluated | data gap; extreme scale risk | no | Extremely small market cap and no SEC/score evidence; manipulation/liquidity risk dominates. |
| IQ | iQIYI, Inc. | equity-like* | $1.32b / $1.365 | unknown | yes | 23 / 51 / 78 | not evaluated; facts arrived after canonical run | a current run would reasonably fail Growth | no | Revenue −2.5%, net income −128.2%, OCF −94.8%, and FCF −99.5% YoY in stored annual facts. |
| RCAT | Red Cat Holdings, Inc. | equity-like* | $1.61b / $10.51 | unknown | no | — / — / — | not evaluated | cannot judge; data bottleneck | maybe | Small enough scale, liquid stored quote, and mentions 3→7, but no fundamental evidence. |
| BW | Babcock & Wilcox Enterprises, Inc. | equity-like* | $1.43b / $9.62 | unknown | yes | 100 / 67 / 100 | excluded: catalyst only | **potentially too harsh** | **yes** | Revenue +130.3%, OCF turned positive, but FCF is negative, shares +47.3%, and the debt input is stale (2021). |
| TTD | The Trade Desk, Inc. | equity-like* | $6.43b / $13.675 | unknown | no | — / — / — | not evaluated | cannot judge; data bottleneck | maybe | Price/cap and social acceleration exist, but the DB has no SEC evidence or business-quality context. |
| TBN | Tamboran Resources Corporation | equity-like* | $1.26b / $36.22 | unknown | no | — / — / — | not evaluated | cannot judge; data bottleneck | maybe | Early-size market cap, but lowish volume and no stored fundamentals, sector, or catalyst. |
| USAR | USA Rare Earth, Inc. | equity-like* | $4.66b / $19.05 | unknown | no | — / — / — | not evaluated | cannot judge; data bottleneck | maybe | Mentions 4→14 and known cap/price warrant triage, but the DB cannot test growth, funding, or dilution. |
| HTZ | Hertz Global Holdings, Inc. | equity-like* | $784m / $2.20 | unknown | no | — / — / — | not evaluated | cannot judge; data bottleneck | no | 467 mentions dominate the radar signal, while fundamental and instrument-quality evidence is absent. |
| UP | Wheels Up Experience Inc. | equity-like* | $188m / $5.17 | unknown | no | — / — / — | not evaluated | cannot judge; data bottleneck | no | Very small scale and no SEC/score evidence; social attention alone is insufficient. |
| RUM | RUM Group Inc. | equity-like* | $1.86b / $6.74 | unknown | no | — / — / — | not evaluated | cannot judge; identity/business needs verification | maybe | Mentions 3→10, but even the stored name/business identity needs primary-source confirmation. |
| FRMI | Fermi Inc. | equity-like* | $4.63b / $7.255 | unknown | yes | 0 / 19 / 68 | excluded: Growth, Coverage, catalyst | sensible | no | No stored revenue, very negative FCF/OCF/net income, cash/debt 0.49×; current evidence is strongly adverse. |
| KEEL | Keel Infrastructure | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | instrument/data failure | no | No tradable quote, market cap, SEC facts, or verified instrument type in the DB. |
| ON | ON Semiconductor | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Recognizable company name, but this dataset supplies no price, scale, sector, or SEC evidence. |
| HR | Healthcare Realty Trust Incorporated | equity-like* | $6.75b / $19.25 | unknown | yes | 76 / 42 / 80 | not evaluated; facts arrived after canonical run | a fresh score run may pass Growth/Coverage, but fit is weak | no | REIT-like name/structure, cash/debt component 1/100, negative net income, and not an RKLB-like early-growth profile. |
| SION | Sionna Therapeutics, Inc. | equity-like* | $239m / $5.295 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Small-cap therapeutic company may be binary; no stored cash runway, trial, dilution, or SEC evidence. |
| COHR | Coherent | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Some sustained mentions, but no stored quote or fundamentals to support a research priority. |
| WEN | The Wendy's Company | equity-like* | $1.37b / $7.2123 | unknown | no | — / — / — | not evaluated | data bottleneck | no | The DB provides only social attention and quote data; no evidence of exceptional growth or asymmetric catalyst. |
| DTE | DTE Energy | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | no | No stored evidence supporting an early-stage/high-growth fit. |
| ARR | ARMOUR Residential REIT, Inc. | EQUITY | $2.36b / $16.705 | unknown | yes | 41 / 67 / 65 | excluded: Growth and Coverage | sensible, but score inputs are unreliable | no | Revenue input is from 2011 while other facts are from 2026; shares +54.5%. The score should not be trusted as a coherent current picture. |
| SNDK | Sandisk | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | High absolute mentions but no stored quote, market cap, SEC facts, or instrument confirmation. |
| VC | Visteon Corporation | equity-like* | $2.82b / $105.735 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Mentions 1→19 and reasonable scale, but no fundamental evidence; the abrupt attention change needs explanation. |
| DJT | Trump Media & Technology Group Corp. | equity-like* | $2.55b / $9.19 | unknown | yes | 50 / 21 / 100 | excluded: Growth and catalyst | sensible | no | Revenue grew from a tiny base, while net loss, negative OCF/FCF, cash/debt 0.22×, and social spike risk dominate. |
| RDDT | Reddit | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | High attention but declining mentions and no stored valuation/fundamental evidence. |
| LUNR | Intuitive Machines | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Potentially relevant thematic name, but the DB supplies no price, scale, growth, runway, or catalyst evidence. |
| OPEN | Opendoor Technologies Inc. | equity-like* | $3.31b / $3.4297 | unknown | no | — / — / — | not evaluated | data bottleneck | no | Mentions declined and no stored financial evidence supports prioritizing it. |
| NBIS | Nebius Group | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | High absolute attention may warrant identity/business triage, but the investability case is entirely unproved in DB. |
| SLS | SELLAS Life Sciences Group, Inc. | equity-like* | $2.20b / $11.1698 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Likely binary research profile from the company name; no stored trial, runway, dilution, or fundamental evidence. |
| WULF | TeraWulf Inc. | equity-like* | $8.50b / $17.04 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Near the original radar cap ceiling and mentions 1→5, but no stored financial or cycle-risk evidence. |
| ONDS | Ondas Inc. | equity-like* | $5.23b / $9.175 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Known quote and mid-small cap, but falling social attention and no SEC/score evidence. |
| SPCX | SpaceX | unknown / no quote | unknown / unknown | unknown | no | — / — / — | not evaluated | obvious instrument mismatch | no | The radar contains a name without a verified tradable quote or instrument; it should not be treated as an investable ticker. |
| PLUG | Plug Power Inc. | equity-like* | $3.06b / $2.19 | unknown | yes | 71 / 50 / 100 | not evaluated; facts arrived after canonical run | would pass G/C; hard catalyst is the only missing gate | maybe | Revenue only +2.5%; OCF and FCF remain deeply negative, while shares rose 21%. Useful false-positive stress test. |
| CAKE | The Cheesecake Factory Incorporated | equity-like* | $5.60b / $112.46 | unknown | yes | 81 / 81 / 100 | excluded: catalyst only | **potentially too harsh** | **yes** | Cleanest aligned score evidence: revenue +7.7%, OCF +39.2%, FCF +99.7%, but cash/debt is only 0.31×. |
| WDC | Western Digital | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | No stored quote or fundamentals; social signal is flat and weak. |
| AM | Antero Midstream | unknown | unknown / unknown | unknown | no | — / — / — | not evaluated | data bottleneck | no | Declining attention and no stored evidence of an exceptional growth setup. |
| ACHR | Archer Aviation Inc. | EQUITY | $4.74b / $6.21 | unknown | no | — / — / — | not evaluated | SEC coverage blocks an otherwise reviewable event setup | **yes** | Stored 8-K and Boeing/air-taxi news create a real research question, but financial runway, dilution, milestones, and valuation are unknown. |
| LINK | Interlink Electronics, Inc. | equity-like* | $78m / $4.97 | unknown | no | — / — / — | not evaluated | data bottleneck plus microcap risk | no | Sub-$100m scale, flat low mentions, and no financial evidence. |
| CC | The Chemours Company | equity-like* | $2.22b / $14.745 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Quote and scale exist, but falling attention and no stored fundamentals make the priority unclear. |
| RXT | Rackspace Technology, Inc. | equity-like* | $1.17b / $4.6079 | unknown | no | — / — / — | not evaluated | data bottleneck | no | A large one-day mention multiple is the only positive evidence; no SEC/score support is present. |
| API | Agora, Inc. | equity-like* | $391m / $4.6288 | unknown | yes | 81 / 92 / 93 | not evaluated; facts arrived after canonical run | would pass G/C, but spike warning and score composition need human review | **yes** | OCF, FCF, and net income turned positive; revenue grew only 5.9%, and mentions 1→26 triggered the pump warning. |
| YOU | Clear Secure, Inc. | equity-like* | $6.76b / $49.79 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Price/cap exist, but the social spike triggered a pump warning and no financial evidence is stored. |
| HIMS | Hims & Hers Health, Inc. | equity-like* | $7.23b / $31.2201 | unknown | yes | 59 / 35 / 58 | not evaluated; facts arrived after canonical run | strict G/C would reject, but incomplete coverage hides material context | **yes** | Revenue +38.2% is notable; net income turned negative, OCF fell 40.6%, cash fell, and debt/FCF/dilution are missing. |
| RIOT | Riot Platforms, Inc. | equity-like* | $7.65b / $20.22 | unknown | no | — / — / — | not evaluated | data bottleneck | maybe | Mentions 1→27 triggered the pump warning; no stored financial or cycle-sensitivity evidence. |

## 2. Funnel weak points

### Exact counts

- Latest persisted radar snapshot: **42** tickers, not 43.
- Price and market cap known: **31/42**; unknown: **11/42**.
- Sector and industry known: **0/42**.
- Confirmed instrument `quote_type`: **2/42** (`ARR`, `ACHR`); common-stock status is otherwise not persisted.
- SEC facts and current score snapshot: **10/42**; absent: **32/42**.
- Latest canonical run evaluated **5/42 current radar tickers**. It evaluated 8 companies in total because AAPL, RKLB, and TSM were outside the latest radar snapshot.
- Five currently scored radar companies (`API`, `HIMS`, `HR`, `IQ`, `PLUG`) were enriched after the immutable canonical snapshot and therefore were not evaluated in it.
- Included from the current radar snapshot: **0**.
- Among the five evaluated radar tickers, catalyst caused **4** exclusions, Growth caused **3**, Coverage caused **2**, and market cap caused **0**.
- `BW` and `CAKE` were excluded **only** because no catalyst existed in the configured time window.
- Only `ACHR` and `ARR` currently have any stored event inside the catalyst windows. `ACHR` lacks SEC facts; `ARR` had the catalyst but failed Growth/Coverage.

### Missing facts versus unsuitable companies

The dominant mechanical loss is SEC coverage: **32/42** cannot currently receive Growth/Health/Coverage scores. This does not mean 32 good companies were rejected; it means the funnel cannot express a reasoned judgment about them.

A conservative count of clearly incompatible or structurally poor radar rows is at least **4**:

1. `SPCX`: no verified tradable quote/instrument in DB.
2. `EDBL`: $1.1m extreme microcap without financial evidence.
3. `ARR`: REIT structure plus incoherent/stale revenue input; poor fit for the preset.
4. `HR`: REIT-like structure, weak balance-sheet component, poor fit for the preset.

There are another **5 heightened hype/risk cases**, but the DB does not justify automatically discarding all of them: `API`, `YOU`, `HIMS`, and `RIOT` carry the collector's spike/pump warning; `DJT` combines rapid social attention with weak stored cash-flow and balance-sheet evidence.

No confirmed ETF survives the latest snapshot, so the existing known-fund filter appears to be doing useful work. Instrument-type persistence is nevertheless too sparse to prove the rest are common stocks.

### Coverage is currently a presence score, not a quality score

The audit found a more serious issue than the raw 10/42 coverage count: a present fact can be stale or mismatched.

- `ARR` Growth uses a revenue comparison from **2011/2010** while its other inputs are from 2026/2025.
- `BW` Health compares 2026 cash with a debt value from **2021**.
- `PLUG` Health compares 2026 cash with debt from **2024**.

Therefore `Coverage 100` currently means all configured components were found, not that they describe the same recent economic period. `BW 100/67/100` is research-worthy but not sufficiently reliable to accept at face value. `CAKE` has the cleanest period alignment among the strongest scored rows.

### Catalyst false negatives and false positives

The hard catalyst gate creates obvious false-negative risk: `BW` and `CAKE` meet the current Growth/Coverage gates but disappear only because the DB lacks a recent event.

The same gate is semantically too permissive once an event exists. Any recent news headline or filing can satisfy it without proving materiality or direction. `PLUG` illustrates the risk: with Growth 71 and Coverage 100 it would pass after any qualifying headline even though stored evidence shows negative OCF, negative FCF, only +2.5% revenue growth, and +21% shares outstanding. That does not prove PLUG is a bad investment; it proves the gate can turn weak evidence into eligibility.

## 3. Five human research candidates

These are research priorities, not buy candidates, rankings, or price targets.

### 1. API — Agora, Inc. — `researching`

- Why research: $391m scale and an apparent operating inflection make it the strongest small-company anomaly in the current stored facts.
- Supporting evidence: Growth 81, Health 92, Coverage 93; revenue +5.9%, net income and OCF/FCF moved from negative to positive; cash $75.4m versus debt $80.4m.
- Biggest risk: the score is driven mostly by turnaround percentages rather than strong revenue growth; mentions 1→26 triggered the pump warning.
- Missing: business model, customer retention/concentration, gross margin, shares/dilution, valuation, material catalyst, and competitive advantage.
- Thesis Builder checks: whether positive cash flow is repeatable; why revenue growth is modest; whether the social spike reflects material news; moat and mispricing evidence.

### 2. BW — Babcock & Wilcox Enterprises — `researching`

- Why research: the stored comparison shows a large operational turnaround at a $1.43b market cap; the scanner discarded it only for catalyst absence.
- Supporting evidence: Growth 100, Coverage 100; revenue +130.3%, net income turned positive, OCF turned positive, and negative FCF improved.
- Biggest risk: shares outstanding +47.3%; FCF remains negative. Health 67 is not reliable because the debt fact is from 2021 while cash is from 2026.
- Missing: current debt and liquidity, source of revenue jump, backlog/order durability, organic versus acquisition growth, business segments, valuation, and a material next milestone.
- Thesis Builder checks: whether turnaround growth is repeatable; whether dilution financed durable value; current capital structure; invalidation if cash conversion fails.

### 3. CAKE — The Cheesecake Factory — `draft`

- Why research: it is the cleanest complete and period-aligned fundamental record in the current radar, even though it may not match the “next RKLB” archetype.
- Supporting evidence: Growth 81, Health 81, Coverage 100; revenue +7.7%, net income +24.8%, OCF +39.2%, FCF +99.7%, and shares roughly flat.
- Biggest risk: cash/debt is only 0.31×; strong cash-flow growth may reflect a favorable comparison rather than a long runway of exceptional growth.
- Missing: unit economics, same-store/footprint drivers, debt maturity, capital-return policy, valuation, and a credible “why now”.
- Thesis Builder checks: durability of cash-flow improvement; whether this is a quality compounder/value case rather than an asymmetric early-growth case; what the market may be missing.

### 4. HIMS — Hims & Hers Health — `researching`

- Why research: stored revenue grew 38.2%, a characteristic the aggregate Growth 59 obscures because profitability and cash-flow components deteriorated.
- Supporting evidence: revenue $753.2m versus $544.8m; OCF remains positive; stored cash is $609.8m; market cap $7.23b.
- Biggest risk: net income turned negative, OCF fell 40.6%, cash declined materially, and the social spike triggered the pump warning.
- Missing: debt, FCF, dilution, customer economics, gross margin, regulatory/business risk, valuation, and the cause of the earnings deterioration.
- Thesis Builder checks: growth quality and customer retention; whether deterioration is intentional investment or weakening economics; cash runway and dilution; explicit 12-month operating checkpoint.

### 5. ACHR — Archer Aviation — `draft`

- Why research: it is a confirmed equity with a $4.74b stored market cap and an actual current event trail, but SEC facts are missing, making it a direct test of the funnel's coverage blind spot.
- Supporting evidence: stored 8-K and a stored news headline about Boeing transferring air-taxi subsidiaries in exchange for a stake; latest stored price $6.21.
- Biggest risk: the DB contains no revenue, burn, cash, debt, dilution, or milestone evidence; the event can be hype rather than fundamental progress.
- Missing: nearly the entire financial and execution case, regulatory milestones, production path, cash runway, dilution, competitive position, and valuation.
- Thesis Builder checks: what exactly the Boeing-related transaction changes; measurable 12-month certification/production milestones; funding need; moat evidence; clear failure condition.

## 4. Three thesis seeds

These are intentionally incomplete drafts. Claims not supported by stored evidence are labeled hypotheses.

### API — Agora, Inc.

- **Business:** Unknown from the stored DB. First task is to verify products, customers, revenue model, geography, and reporting entity from a primary filing.
- **Why now:** Stored annual facts show net income, OCF, and FCF inflecting from negative to positive, while the company remains a $391m market-cap name. However revenue grew only 5.9%, and the current social spike is explicitly flagged as possible pump behavior.
- **Moat hypothesis:** Unknown. Test whether the company has durable technology, developer/customer switching costs, network effects, or differentiated distribution; no such evidence is currently stored.
- **Mispricing hypothesis:** The market may be focusing on slow top-line growth while underestimating a sustainable cash-flow inflection. This is only a hypothesis because valuation multiples and cash-flow durability are absent.
- **Catalyst:** Unknown. No qualifying news, filing, or earnings event is stored in the current catalyst window.
- **Main risks:** Turnaround percentages may be small-base effects; revenue growth is modest; cash is slightly below debt; shares/dilution are missing; social attention spiked 1→26.
- **Invalidation condition:** OCF or FCF returns negative without a clearly evidenced temporary investment reason, or subsequent comparable revenue growth remains weak while the turnaround thesis depends only on cost cuts.
- **12-month checkpoint:** Verify at least two new comparable reporting periods and determine whether positive OCF/FCF persists alongside non-deteriorating revenue growth.
- **Missing evidence:** Business model, retention/concentration, gross margin, dilution, valuation, catalyst, moat, and primary filing review.

### BW — Babcock & Wilcox Enterprises

- **Business:** Unknown in the stored DB beyond the company identity. Verify segments, customers, order/backlog exposure, contract economics, and cyclicality from the latest filings.
- **Why now:** Stored 2026/2025 comparisons show revenue +130.3%, net income moving positive, OCF moving positive, and improving negative FCF at a $1.43b market cap. The radar has no stored material catalyst.
- **Moat hypothesis:** The company may possess specialized installed-base, engineering, regulatory, or customer-relationship advantages. None are proven by the current DB.
- **Mispricing hypothesis:** The market may not fully credit an operational turnaround if the improvement is durable. This remains unproved because the revenue source, valuation, and current capital structure are unknown.
- **Catalyst:** Unknown; catalyst absence is exactly why the scanner excluded it.
- **Main risks:** +47.3% shares outstanding, still-negative FCF, potentially non-recurring revenue jump, and a misleading cash/debt score built with stale 2021 debt.
- **Invalidation condition:** Revenue/OCF improvement reverses, current debt/liquidity proves materially worse than the score suggests, or continued dilution is required without durable per-share operating improvement.
- **12-month checkpoint:** Confirm current debt and liquidity, identify the source of the revenue jump, and require the next comparable periods to preserve positive OCF with improving FCF per share.
- **Missing evidence:** Current balance sheet, backlog, organic growth, segment margins, dilution purpose, valuation, moat, and catalyst.

### ACHR — Archer Aviation

- **Business:** Stored news implies an air-taxi/eVTOL-related business; this must be verified and defined precisely from primary filings.
- **Why now:** A stored 8-K and Boeing-related air-taxi transaction headline create a concrete event to investigate. The DB has a $4.74b market cap and $6.21 price but no financial facts.
- **Moat hypothesis:** Certification progress, aircraft technology, manufacturing partnerships, and strategic relationships may form an advantage. Current stored evidence proves none of them.
- **Mispricing hypothesis:** The market may under- or overestimate how much the Boeing-related transaction changes certification, production, capital needs, or competitive position. Direction is unknown.
- **Catalyst:** Clarify the economic and execution impact of the stored Boeing-related transaction and identify the next measurable certification/production milestone.
- **Main risks:** Pre-commercial execution risk, regulatory delays, capital intensity, dilution, manufacturing scale-up, and event-driven hype; financial runway is completely unknown in DB.
- **Invalidation condition:** The next stated certification/production milestone slips materially, required funding implies unacceptable dilution, or the Boeing-related event does not improve a measurable operating milestone.
- **12-month checkpoint:** Record and verify one explicit certification or production milestone, current cash runway, financing need, and whether the strategic transaction changed the schedule or economics.
- **Missing evidence:** SEC CompanyFacts, latest filings, cash burn, debt, shares, dilution, regulatory schedule, order quality, unit economics, competitors, and valuation.

## 5. Assessment of the current RKLB scanner

- **Most likely too strict:** requiring a catalyst as a hard gate. It removed `BW` and `CAKE` despite complete Growth/Coverage evidence.
- **Most likely too lenient:** `known market cap <= $75b`; unknown cap passes, and $75b is too large for a preset seeking an early asymmetric company. Separately, the catalyst definition is semantically lenient because any recent headline/filing counts.
- **Most painful missing investor field:** evidence-backed **mispricing/valuation relative to durable business growth**. Current scores describe accounting direction but cannot answer why the stock, at today's price, is interesting.
- **Catalyst treatment:** catalyst should be an evidence/scoring field, not a hard gate. Materiality, direction, novelty, and thesis relevance must be explicit; “a filing exists” is not enough.
- **Market-cap ceiling:** yes, the RKLB preset should probably use a lower research band than $75b. A provisional 10–25b upper band is more consistent with “early enough for asymmetry”, but no code threshold should change until the manual cohort shows the trade-off.
- **Social attention:** yes, it should be one input channel, not the primary universe gate. It is useful for novelty/timing and dangerous as the sole recall mechanism.

## 6. Product risks and recommendation

Largest product risks:

1. **Selection bias:** the product can only discover what appears in the current WallStreetBets/ApeWisdom funnel.
2. **False confidence from Coverage:** component presence is treated as coverage even when periods are stale or incoherent.
3. **Thin identity/classification:** 0/42 sector/industry coverage and only 2/42 persisted instrument types make peer comparison and instrument safety weak.
4. **Catalyst semantics:** a hard yes/no based on event existence creates both false negatives and false positives.
5. **No mispricing evidence:** Growth/Health can prioritize business changes but not expected return or asymmetry at the current price.
6. **Small-base/sign effects:** turnaround percentages can dominate scores without proving durable top-line strength.
7. **Timing opacity:** enrichment after the immutable daily run means current coverage and the canonical evaluated count differ unless timestamps are read carefully.

### Recommended next step

Do a **manual research sprint** first, using `API`, `BW`, `CAKE`, `HIMS`, and `ACHR` as the initial cohort. Write three real thesis versions from the seeds above and deliberately allow `rejected` outcomes.

- If most names fail because their businesses are poor or attention was noise, redesign the universe before infrastructure.
- If good names survive but were blocked mainly by catalyst/coverage mechanics, change the funnel after documenting those cases.
- Only after the cohort and decision baselines exist should centralized collection infrastructure become the next priority, because then it preserves an evidence-generating process rather than an untested signal.

No buy/sell recommendation or price target is made in this audit.
