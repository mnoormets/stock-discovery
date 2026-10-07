# AMD missed-move review — 7 October 2026

## Findings

This is an evidence audit, not a backtest or a new simulated trade. The app saw AMD in collection #63 on 1 October at 13:59:40 UTC, price $608.815. Its immutable early-opportunities-v1 row was unknown, with no financial facts/history context and the reason "Need known, recent revenue growth and same-period USD operating cash flow." Collection #70 retained the same rejection at $649.42, market time 6 October 20:00:01 UTC.

The financial data were present. Latest normalized revenue preferentially selects a quarter; latest operating cash flow is YTD. Early V1 rejects those unlike periods without looking for the matching YTD revenue already stored. This is a selection gap, not evidence that Yahoo/SEC supplied no AMD information.

| SEC metric | Period | Value USD |
| --- | --- | ---: |
| Revenue, quarter | 29 March–27 June 2026 | 11,536,000,000 |
| Revenue, YTD | 28 December 2025–27 June 2026 | 21,789,000,000 |
| Operating cash flow, YTD | 28 December 2025–27 June 2026 | 5,321,000,000 |
| Prior revenue, YTD | 29 December 2024–28 June 2025 | 15,123,000,000 |
| Prior operating cash flow, YTD | 29 December 2024–28 June 2025 | 2,950,000,000 |

All above rows were filed 5 August 2026 under accession 0000002488-26-000123; AMD financial refresh was stored before the October scan. Same-period YTD revenue growth is 44.08%, with positive OCF. [SEC filing source](https://www.sec.gov/Archives/edgar/data/2488/000000248826000123/). Quarter revenue growth is 50.11%. Neither comparison predicts future prices.

There is a second independent limitation: V1 explicitly excludes stocks that already gained >=20% in one month, >=35% in three months or >=50% in six months. Read-only re-evaluation using Yahoo history fetched today, bounded strictly before each signal's calendar date, gives 1 October +32.46% / +17.57% / +176.51%, and 6 October +28.41% / +25.51% / +174.43%. Both would fail the frozen run-up rules even after period alignment. These are retrospective diagnostic calculations, not historical app-generated signals; received-time availability and later history revisions are not proven. No same-day final close or later quote was used in these diagnostic references.

## Price claim and accounting

Yahoo AMD daily closes: 30 September $611.7600098; 1 October $615.7299805; 2 October $633.9099731; 5 October $631.75; 6 October $649.4199829. Thus October through 6 October rose $37.66 / 6.16%, rather than hundreds of dollars during those dates. Larger earlier moves and a rolling-month window differ from calendar October. Chart identity AMD / currency USD checked, no returned splits for March–7 October. [Yahoo history](https://finance.yahoo.com/quote/AMD/history/).

The app's $20,000 capital experiment actually started 6 October; earlier discoveries are not purchases. Latest independently reconciled account checkpoint at 7 October ~15:20 UTC: equity $19,813.82, unrealized-inclusive total P/L -$186.18, realized P/L $0, cash $16,000, CDE/AMKR held. AMD was not purchased. No hypothetical missed AMD gain is added to this ledger.

## Continuation and unresolved work

Persistent Goal tool reports usageLimited, tokensUsed 213132 and timeUsedSeconds 1491; no remaining-token figure or exact stop cause/reset time is supplied. Ordinary account work is allowed (latest check: 8% of five-hour allowance and 17% of weekly allowance used). Those account windows are not exhausted. Goal lifecycle tools cannot resume or alter budgets; user/system controls do that. [Official Goal lifecycle documentation](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex). The separate daily 18:00 Tallinn heartbeat is still ACTIVE. Neither this audit nor a paused automatic continuation fulfills the profit goal.

Next implementation: evaluate a separately versioned coherent-period research selector against stored facts across the universe, including missing/future periods and exact same-filing inputs. Keep frozen V1/control decisions and the capital ledger intact. Separately evaluate momentum/catalyst continuation instead of presenting an already-risen name as before-boom discovery; do not tune solely to AMD. Any adopted trading change must preserve initial capital and accumulated losses across versions. No new paid provider, real order, leverage or loss reset.

## Verification boundary

Read-only golden-source SQL confirmed AMD facts and original collection rows; existing Yahoo chart and price-context implementation produced the diagnostic values above. Initial sandbox DB connection was denied; the approved read-only retry succeeded with exit 0. Goal/account quota and saved heartbeat configuration were inspected. No application code/schema/policy changes, DB writes, trades, test fixtures or test/build claims in this audit. This report and HANDOFF are local documentation edits, not a published fix.
