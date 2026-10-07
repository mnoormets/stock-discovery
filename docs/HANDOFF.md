# Stock Discovery – master plan ja töö jätkamise memo

Uuendatud: 2026-10-07

See on projekti elav master-dokument ning toote ja tehnilise seisu peamine tõeallikas. Iga sisulise arendussessiooni järel tuleb siin uuendada tehtut, praegust fookust, järgmist plaani, otsuseid ja testitõendeid. Repo juurkausta `AGENTS.md` teeb selle tulevastele Codexi sessioonidele kohustuslikuks.

## North Star

Kasutaja peab suutma leida huvitava ettevõtte, eristada lugu tõenditest ning koostada viie minutiga kaitstava investeerimisteesi:

- miks see ettevõte;
- miks praegu;
- mida turg võib valesti hinnata;
- mis peab järgmise 12 kuu jooksul juhtuma;
- milline mõõdetav sündmus muudab teesi valeks.

Edu ei mõõdeta tagantjärele ideaalse tipu tabamisega. Eesmärk on parandada otsustusprotsessi kvaliteeti ja säilitada see, mida otsuse hetkel tegelikult teati.

## Püsivad tootepõhimõtted

- Kõrge skoor tähendab „uuri lähemalt”, mitte „osta”.
- Faktid, automaatsed järeldused ja kasutaja oletused peavad olema eristatavad.
- Iga skoor peab näitama komponente, katvust, mudeliversiooni ja algallikaid.
- Ajalooline seis peab olema „as known at the time”, et vähendada hindsight bias'i.
- Puuduvad andmed ei muutu automaatselt nullpunktideks ega tohi lehte katki teha.
- Päeval, mil tugevaid kandidaate pole, näitab avastusvaade null kandidaati; süsteem ei leiuta kohustuslikku esikolmikut.
- Rakendus ei anna ostu- ega müügisoovitusi.

## Praegune töötav seis

- **7 October growth capital entry activated:** growth-capital-entry-v2 now uses new early/momentum collections on the same early-capital-v1 ledger, activated 16:58:20.389 UTC. #74 finished after activation; executor filled six fresh stock buys (MU, PLTR, IREN, CORZ, DELL, AVGO) plus six matched SPY trades. Eight total positions, $4,000 cash, realized $0, equity $19,809.730785 / total -$190.269215; original four trades retain the identical whole-row hash. Repeat executor inserted zero trades, current source true, issues/splitIssues []. AMD is visible but below the six available growth-ranked entry slots. 550 tests / 76 files and typecheck/lint/build passed. Restarted Performance/Today HTTP 200 and actual browser Performance verify the entry version/time, eight positions and -$190.27 / realized $0. Publication is the remaining delivery step at this checkpoint. [Evidence](research/2026-10-07/CAPITAL_ENTRY_TRANSITION.md).

- **7 October growth discovery delivered:** `growth-opportunities-v2` now compares coherent SEC periods and exposes early/momentum research independently of frozen capital rules. Real #73: 137 stocks, 5 early / 5 momentum, AMD visible, 18 history requests and no history deferrals. Database receipt/evaluation clock fixes client/Neon skew; capital source #73 is current. Final verification: 75 files / 547 tests, typecheck/lint/build, restarted Today/Performance HTTP 200 and actual browser checks. Capital remains $16,000 cash, two holdings, four immutable trades, realized $0 and marked total -$176.440820. Tracking capacity and six old HRGN deferred orders remain unresolved. [Verification](research/2026-10-07/GROWTH_DISCOVERY.md).

- **7 October AMD/continuation audit:** AMD was seen in immutable collection #63 at $608.815 on 1 October, but quarter revenue vs YTD OCF caused an unknown result although matching YTD revenue/OCF already exist. Retrospective bounded history independently fails the frozen run-up gates; period alignment alone would not admit AMD. October through 6 October close rose $37.66 / 6.16%. Persistent Goal currently reports usageLimited, while ordinary account work remains allowed; the separate daily heartbeat is ACTIVE and profit remains unachieved. No policy/ledger rewrite or code fix in this audit. [Evidence and next implementation](research/2026-10-07/AMD_REVIEW.md).

- **7 October 18:21 Tallinn capital checkpoint:** refreshed with existing executor during the regular session. Cash $16,000, holdings $3,813.816856, equity $19,813.816856, total -$186.183144 (-0.930916% of starting capital), realized $0; paired SPY -$31.910196. CDE -$109.046278 / AMKR -$77.136867. Four immutable trades remain, zero new fills, source #70 current and splitIssues []. Independent SQL reconciles cash/equity/P&L. Original V1 separately failed: 10 deferred orders and stale held API/BWFG quotes, plus HRGN; no stale fill or altered threshold. Goal remains unachieved.

- **7 October continuation:** 05:25–05:28 UTC collection #70 succeeded: 136 radar rows (56 excluded / 79 unknown / 1 watch: CDE). Latest capital audit remains 6 October 18:19 UTC; $16,000 cash / two positions / realized $0, marked total -$13.497 versus SPY -$4.920. These are dated prices, not current live returns. Remote manual workflow #40 on exact published 9956866 proved capital execution with issues [] / zero repeat trades, while original V1 still failed on six HRGN orders. A split-integrity guard passed focused tests and real Yahoo checks; full regression passed: 72 files / 535 tests in 582.45s. Goal is active and unachieved.

- **6 October finite-capital activation:** separate `early-capital-v1` account activated 6 October 21:12:06 Tallinn with $20,000 fixed initial cash and a $10,000 realized-profit target. Two fresh buys (CDE $17.36868 / AMKR $54.00699 after 5 bps modeled slippage) and two paired SPY trades; $16,000 cash, initial marked equity $19,996.002 and realized P/L $0. Costs create the initial -$3.998 open P/L. Repeat execution inserted zero trades (4 before/after), no backdated fills or V1 rewrites. `/performance` now leads with capital/cash/realized target progress; V1 control remains in collapsed details. 30 focused tests, typecheck/lint/build and real UI/DB checks passed; full regression passed: 71 files / 531 tests in 425.58s; Today/Performance HTTP 200 and zero leftover test databases. [Activation data](research/2026-10-06/capital-live.json). Goal remains active and unachieved.


- **2026-10-06 recovery published:** user explicitly approved publishing to `mnoormets/stock-discovery` main without diagnostic logs. Verified code/evidence commits `f68bbba` and `64cd931` pushed; remote main confirmed `64cd931b8cb5193cb45472af5aef4ac679c20a79`. FOR recovery restored entry-aware valuation (-$128.54 at ~17:24 UTC); held-price health fix passed 70 files / 524 tests and real runtime checks. Raw diagnostic logs remain local and ignored; links to those logs in the verification entry are local evidence only. Next unattended execution, finite $20,000 policy and profitability remain unresolved.


- **2026-10-06 read-only checkpoint:** morning collections #67/#68/#69 (4–6 October) succeeded; latest six radar channels all ok. First early-discovery cohort still only AMKR/CDE: latest stored 5 October close AMKR $54.63 (+4.3625% from $52.3464), CDE $17.05 (-3.0975% from $17.595). These are observation returns, not actual paper profits. Entry-aware paper has 107 filled buys, 14 open positions, $10,710.70 invested, zero pending orders and zero sale proceeds. Current P/L is unavailable because FOR's mark date differs from SPY; matched SPY book is +$157.46 (+1.4701%), but app/benchmark outperformance cannot be computed from incomplete valuation. No code, strategy, schema or production-data changes; no tests/build claimed. [Saved database evidence](research/2026-10-06/checkpoint.json).

- **2026-10-03 early-discovery checkpoint:** read-only Neon check found successful morning collections #65 (2 October) and #66 (3 October), each with all six Yahoo channels ok and early-opportunities-v1 evidence. AMKR first observed 1 October 17:01 Tallinn at $52.3464, latest stored 2 October 23:00:01 Tallinn $56.02 (+7.0179%); CDE first $17.595, latest 2 October 23:00:02 $17.66 (+0.3694%). AMKR now excluded from fresh early list because session gain reached >=5%, but its original discovery remains in history. Only two names and one subsequent trading-day close: not proof of profitability or general predictive effectiveness. These are discovery price changes, not filled paper returns. Trigger field is generic direct, so DB alone confirms successive morning pipeline execution, not external cron service provenance. No production data/code changes or test/build claims. [Saved DB evidence](research/2026-10-03/early-checkpoint.json).

- **2026-10-01 Early Opportunities V1 verified:** separate Yahoo/SEC research scan requires revenue growth >=25%, positive same-period USD OCF, known recent prices and all 1/3/6-month returns below +20%/+35%/+50%, session gain below 5%. Up to 20 chart requests per collection; exclusions and missing data remain visible. First real collection #63 found AMKR/CDE and saved two follow-up prices; repeat #64 preserved both first-discovery timestamps/prices and saved 139 consumed historical closes per latest candidate. The first #63 record preserves fact evidence and derived context; raw chart inputs were added subsequently, without backfilling it. Candidates stay in existing capped price tracking for 30 days; displayed return since observation is not actual paper P/L. Final full isolated suite: 70 files / 523 tests, 296.39s. Typecheck/lint/build passed; restarted app and real UI/DB checks passed. [Evidence](research/2026-10-01/EARLY_DISCOVERY.md). Next unattended execution and effectiveness remain unverified.

- **2026-10-01 market radar completed:** six existing Yahoo screens now collect up to 25 rows each beyond social mentions. Latest real collection #62 persisted 137 distinct US-listed equities; all six channels succeeded, 45 radar names currently have SEC facts. Missing financials, social blacklists and canonical tier slots do not hide radar names. CLI/API share a 20-attempt Tallinn-day CompanyFacts budget; today's updated CLI enriched 15 companies after five earlier attempts, raising total SEC-covered companies 264 to 279. Canonical #95 was reused with zero new decisions, outcomes or orders; existing historical decisions and paper policies were preserved. Full isolated suite passed 68 files / 519 tests; typecheck, lint, production build, app restart, real browser and database checks passed. See [implementation verification](research/2026-09-30/MARKET_RADAR_VERIFICATION.md). Published to local and remote `main` at feature commit `fb627d8` (remote SHA checked). The next unattended run remains to be observed.

- **2026-09-30 paper checkpoint completed:** read-only Neon audit found entry-aware invested $8,508.50, marked value $8,310.52, unrealized loss $197.98 (-2.33%) versus matched SPY +$7.28. 85 buys / 14 open tickers / zero sales or pending entry-aware orders. Marks are today 16:30–16:35 Tallinn, not live. All 12 intervening core collections/canonical runs and fills on all eight trading days are present. DKS/YOU captured gains, CRDO entry timing lagged; EU/CAKE/BE were excluded by documented rules. All-picks still has three HRGN pending pairs and stale MSC valuation; causes remain unresolved. Independent SQL reconciles P/L. See [dated evidence and review](research/2026-09-30/REVIEW.md). No runtime code, strategy, database data or history changed; no tests/build/UI checks claimed.

- **2026-09-18 SEC catch-up optimization:** registration now reads already-persisted accessions once per indexed date and skips their per-filing upsert/read round trips. New/failed filings still use the existing registration path in the same atomic transaction before fetching any filing. Real seven-day replay checked 2,876 persisted filings in 14.718 seconds, seven SEC requests, zero writes of parsed filings and zero filing errors; the complete in-range filing-row checksum was unchanged. This removes repeat-work overhead, not the cost of processing newly filed documents; next scheduled duration remains to be checked. All four API orders deferred from 17 September are now confirmed filled in Neon.

- **2026-09-18 money-first Performance:** user clarified that the desired primary answer is money won/lost after the app actually bought. `/performance` now leads with entry-aware filled purchases, costs, holdings plus sale proceeds, net P/L and per-stock results; comparison policies/rules/order audit are collapsed. Repeated buys use quantity-weighted entry prices and all fees; closed positions include net sale proceeds; unknown/stale marks still cannot imply zero P/L. No selection, execution, schema or valuation-validity rule changed.

- **2026-09-18 forward measurement repair:** first v4 audit found 11 measured one-week decisions across eight tickers, with unknown endpoint market time on nine stock rows and all 11 SPY rows. Existing Yahoo writers now preserve quote time; new stock/SPY outcome measurements require known market time at/after the target and no later than receipt, with receipt no later than the evaluation clock. All 11 historical measured records remain unchanged. Validation/backtest display the historical limitation. See [reproducible review](research/2026-09-18/REVIEW.md), saved SQL/data and executed notebook. Full suite: 66 files / 512 tests; typecheck, lint and build passed; restarted app returned HTTP 200 on both pages. No strategy, broker, schema or external provider change.

- **2026-09-18 failure audit:** Dispatch is working. On 17 September, collect #32 exceeded the SEC Form 4 40-minute limit, but core collection #46 succeeded. Today's collect #33 succeeded on unchanged `4d1c1ee` in 44m03s (Form 4: 35m18s), producing collection #47 and canonical v4 #81 (6/187 included). All registered 10–17 September filings are persisted. Paper #20 filled 14 orders and correctly failed for four deferred API orders after quote timestamp validation failed. BWFG also appeared in quote diagnostics but has no pending order. Paper recovery remains unverified before today's scheduled 16:35 Tallinn run. No code, scheduler or production data was changed.

- **2026-09-10 canonical current-collection gate:** `rklb-discovery-v4` lets only tickers with `market_data_found=true` in the linked same-run `collection_run_items` compete for canonical market-cap tier slots. Manual RKLB scans still use the broader stored universe. The fix prevents cached names absent from today's collection from consuming all-picks and entry-aware measurement slots; base Growth/Coverage filters, ranking comparator, tier boundaries, tier capacity, paper-entry gates, providers and schema are unchanged. A canonical call without a positive collection-run ID now fails explicitly instead of silently creating an unlinked daily shortlist.

- **2026-09-13 paper-execution dead-man path active:** `paper-strategy-execute` has a bounded post-success Healthchecks step using its own optional `PAPER_STRATEGY_HEALTHCHECKS_PING_URL` repository secret. The step follows the hypothetical executor, so a failed executor cannot send a healthy ping; an unset secret skips honestly and a Healthchecks network failure does not reinterpret a completed execution as failed. The dedicated GitHub secret is configured. Healthchecks check `stock-discovery paper-strategy execution` uses `35 9 * * *` in `America/New_York`, two-hour grace and the existing email integration. Manual workflow run #13 on exact commit `e765990` succeeded in 40 seconds; its heartbeat step completed in one second and Healthchecks changed from never pinged to up.

- **2026-09-13 market-session paper-execution guard:** The executor CLI now exits non-zero when one or more hypothetical orders remain deferred during an expected 09:30–16:00 New York regular session. The workflow's default success gate therefore withholds its healthy heartbeat when an app-eligible buy cannot be filled. Weekend, full-day holiday and outside-session runs can still succeed with pending orders waiting for the next market session. Manual workflow run #15 on exact guard commit `ba69303` succeeded in 36 seconds on Sunday: it reported 34 pending/deferred orders, zero fills and only the explicit market-closed reason, then sent the healthy heartbeat. A read-only Neon check confirmed 34 pending, zero executions since the run and latest execution still 11 September. Signal, order identity, commissions, fills, exits, schema and broker isolation are unchanged.

- **2026-09-13 paired paper execution integrity:** A follow-up Astra review found that the executor could commit the app leg while its same-cash-flow SPY quote was unavailable, leaving the comparison legs filled at different times. Production had no existing damage: all 154 signal groups were complete and status-matched, including 73 filled pairs with matching execution times. Execution now admits a signal group only when exactly one strategy and one benchmark order are pending and both quotes pass the existing execution checks; both updates remain in one transaction. Marks may still refresh independently. GitHub Actions run #16 used exact fix commit `8a9320a`, succeeded in 39 seconds, preserved all 34 Sunday-pending orders and sent its post-success heartbeat. No schema, signal, ranking, commission, exit or broker behavior changed.

- **2026-09-10 first live v4 cohort:** Manually dispatched `collect-daily #25` completed successfully in 20m05s on exact deployed commit `cd56cae`. Collection #39 produced canonical run #71 with 148 evaluated and six included: SNDK, CRDO, WTI, DY, ARM and BWFG. A read-only Neon audit found zero missing item links, zero cross-run links and zero unconfirmed market-data links; the run has one quality snapshot, 30 outcome horizons and 24 paper orders. The separate same-day executor #10 succeeded in 43s and filled the only entry-aware eligible order, SNDK, at $1,699.00; the other five entry-aware orders remain skipped with explicit insufficient-history reasons.

- **2026-09-10 explicit paper-entry state:** Every `/today` candidate now shows Business, Market setup and a separate `Eligible for paper entry` or `Wait` result using the existing entry-aware V1 gates. Today additionally refuses the positive label when its displayed decision price is stale, invalid or unavailable. Eligible is named as the app's clearest positive state and means that the hypothetical strategy would create a $100 buy intent; Wait includes the exact failed gate. `/performance` uses the same signal language and states that every new eligible day creates another intent even for a repeated ticker. This exposes the policy instead of turning a research priority badge into an implied purchase. No score, ranking, discovery selection, stored paper order behavior, schema or broker integration changed.

- **2026-09-09 model- and ticker-separated outcome results:** `/validation` and `/backtest` now build a separate cohort for every canonical model version and holding horizon. Repeated daily decisions for one ticker are averaged inside that ticker before the cohort mean, median, hit rate, best/worst and benchmark comparison are calculated, so each ticker has one equal statistical weight. The pages show both decision and distinct-ticker coverage plus measured, pending, missing and unavailable counts. Manual runs remain excluded and a model with zero selected decisions remains visible. This is a read-side interpretation change: no schema, provider, score, ranking, discovery or paper-policy behavior changed.

- **2026-09-09 database target contract:** every normal app and CLI database startup now requires `DATABASE_URL` and an explicit `DATABASE_TARGET`. `golden` accepts only a `neon.tech` host, `local` only an intentional local host, and `test` only a database ending `_test` or `_tmp`; validation happens before a PostgreSQL client connects and errors contain no credentials. This closes the observed host trap where Next loaded the frozen local `discovery` URL from `.env.local` ahead of the Neon URL in `.env`. Docker and database-connected GitHub workflow steps explicitly use `golden`; the test harness uses `test`. The migration runner retains its independent stricter write guard and explicit `--database-url` escape hatch.

- **2026-09-09 Thesis Review Queue V1:** `/today` now reads every current, non-rejected thesis for active/watchlist positions in a batched `REPEATABLE READ, READ ONLY` transaction. Each card shows the version/status, exact thesis-linked decision price, latest stored price and same-currency change, explicit review trigger, future earnings date and all eight recorded assumptions. `review_due` requires a newer stored financial filing, a decisive/supporting assessed SEC event, or a passed earnings date without a newer filing; unverified news headlines do not trigger it. Free text is never parsed into a pass/fail claim and no thesis/status is changed automatically. A new thesis version is the human review record. Current Neon state is 0 due: API/BW/HIMS v3 are awaiting evidence for their November dates, at latest stored prices $4.0474/$7.59/$27.315 versus reviewed $4.11/$7.74/$28.17.

- **2026-09-09 approved API/BW/HIMS thesis versions:** The user accepted the [9 September decision packet](THESIS_REVIEW_2026-09-07.md) as written. API v3 is current and `ready`; BW v3 and HIMS v3 are current and `researching`. Each version stores the eight company-specific assumptions, its current score evidence and the exact reviewed 8 September close: API #2327 at $4.11, BW #2329 at $7.74 and HIMS #2339 at $28.17. Newer price rows were already present at save time and were deliberately not substituted. Database verification found one current thesis per position and unchanged v2 narrative/checkpoint fields; the three runtime pages returned HTTP 200 and rendered v3, the approved assumption and approved price. These are monitoring hypotheses, not buy/sell signals.

- **2026-09-09 GitHub Actions runtime maintenance:** Today's successful run carried GitHub's Node 20 deprecation warning for actions/checkout@v4, actions/setup-node@v4 and actions/upload-artifact@v4. All three workflows now use current Node 24 runtime majors: checkout/setup-node v7 and upload-artifact v6. Node installed for the application remains pinned to 22. The workflow contract and triggers are unchanged. The workflow assertion was updated and the final full isolated suite passed 61 files / 480 tests. Post-push nasdaq-listing-observation #9 ran exact SHA 8c03536, succeeded in 39s, produced its retained artifact, displayed checkout/setup-node v7 steps and had no deprecation annotation.
- **2026-09-08 holiday-aware price recency:** GitHub `collect-daily #21` completed collection #35, canonical v3 run #67, SEC enrichment, paper execution, outcomes and price persistence, but its final tracking gate exited 1 because all 18 valid Friday quotes were classified stale before Tuesday's market open after Labor Day. Read-side recency now excludes the NYSE's explicitly published 2026–2028 full-day holidays as well as weekends, with a conservative weekday fallback outside that schedule. Historical `price_tracking_attempts` remain unchanged. Paper execution quote freshness is unchanged. The new-SHA replay `collect-daily #22` succeeded in 19m47s, reused run #67 without adding decisions, outcomes or paper orders, reported zero tracking errors and sent the Healthchecks heartbeat with HTTP 200.

- **2026-09-08 versioned valuation decision review:** Thesis Builder stores company-specific revenue, margin, cash-flow, dilution, valuation and downside assumptions, a reverse-valuation question and an observable next-review trigger in every new thesis version. The version also references an exact company `price_snapshots` row, while older thesis history remains nullable and receives no hindsight backfill. Migration `0010_thesis_valuation_review` is applied to Neon. The first accepted versions using these fields are the 9 September API/BW/HIMS v3 records above.

- **2026-09-08 account handover:** [CODEX_ACCOUNT_HANDOVER_2026-09-08.md](CODEX_ACCOUNT_HANDOVER_2026-09-08.md) records the remote baseline, current product state, safety boundaries, recent source-backed work, exact verification commands, operational credentials required, and prioritized next steps for an account transition. After Docker Desktop was restored, the Neon-backed app passed `/today`, BW, and API HTTP smoke checks; the document distinguishes this runtime evidence from the last full 7 September verification.

- **2026-09-07 balance reconciliation:** [BW_API_RECONCILIATION_2026-09-07.md](BW_API_RECONCILIATION_2026-09-07.md) documents and displays a dated SEC bridge: BW $276.843m borrowings, $308.634m cash and separate preferred/lease claims; API $361.655m broad liquidity, $100.316m borrowings and the 1 ADS = 4 ordinary-share conversion. `scores-v2` and `signals-v3` now require identical cash/debt balance dates, so BW's stale 2021 debt no longer produces a current cash/debt score or brief claim. Earlier score snapshots and brief records remain versioned historical evidence.

- **2026-09-07 financial-input corrections:** HIMS investment deductions now combine disclosed productive-asset purchases and software from the same filing/period when the standard PPE metric is absent. Derived H1 FCF is -$15.161m (Neon fact #21375). API ordinary shares refreshed to 349,264,771 at 2025-12-31 (#21616), explicitly not an ADS or fully diluted count. Valuation Evidence v2 withholds EV/Sales for mismatched, stale, future or unknown cash/debt dates. BW current total debt remains unavailable in CompanyFacts; partial secured debt is not substituted. Verification: 58 files / 468 tests passed; typecheck, lint, 12 valuation QA cases, build and post-restart UI/database checks passed. Published on `main` at `717b2a9`.

- **2026-09-07 implementation checkpoint:** canonical discovery is v3; Form 4 hotfix is on local/remote main. Published fixes request marks for all open paper holdings, withhold incomplete/misaligned valuations and qualify stale/partial Today setups. Continued research/outcome price tracking is implemented; migration 0009 is applied to Neon and the first 18-symbol Yahoo batch is persisted. Code is published on origin/main at aaf537c. Subsequent 7/8 September unattended attempts are verified; the 8 September batch preserved Friday quotes without fabricating observations, but the weekday-only recency rule caused the later cron false alarm corrected above. The API/BW/HIMS review drafts were accepted as v3 on 9 September; their 11 August v2 baselines remain immutable.

- Next.js 14.2.35, PostgreSQL ja Docker Compose; rakendus pordil `3005`.
- Yahoo Finance hinnad, uudised, earnings ja analüütikute konsensus.
- SEC filingud ja tasuta SEC CompanyFacts: revenue, net income, operating cash flow, tuletatud free cash flow, cash, debt ja shares outstanding.
- CompanyFactsi perioodid ja YoY võrdlused tabelis `financial_facts`.
- Tasuta reeglipõhine Research Brief koos faktide, järelduste ja algallikatega.
- Growth Score, Financial Health Score ja Coverage Score.
- Data Freshness + Period Alignment V1 kuvab score'is kasutatud SEC põhimõõdikute perioodid, vanuse, fact-viited ja eraldi kvalitatiivsed staatused; skoorivalemeid ega filtreid see ei muuda.
- Catalyst Evidence V2: catalyst ei ole enam hard gate, vaid struktureeritud tõendikiht (`catalyst_events` + versioonitud `catalyst_assessments`), mis mõjutab ainult järjestust ja nähtavat tõendit.
- Catalyst evidence ei ole enam ainult scanneris — seda kuvatakse nüüd ka **company detailis** ja **Thesis Builderis** (jagatud `getCatalystEvidenceForTicker`, mis kasutab sama `getCatalystEvidenceMap` pipeline'i; uut DB-skeemi ei lisatud). Company detail ja Thesis Builder võivad nüüd catalyst evidence'i idempotentselt arvutada write-on-read teel. Under-recognition `catalystNovelty` ei ole neil surface'idel enam alati `unknown`.
- Versioonitud `company_score_snapshots`, mis säilitavad input-hashi, SEC fact ID-d, perioodid ja komponendid.
- `/scanner` fundamentaalne edetabel ja sortimine Growthi, Healthi või Coverage'i järgi.
- `/watchlist` kasutab `portfolio_positions.status = 'watch'` kirjeid ja pakub olemasolevate skooride põhjal uurimisideid.
- `/portfolio` positsioonid, P/L ja turuväärtus; noteeringu valuuta tuleb hinnasnapshotist, EUR/USD summasid ei liideta ega konverteerita ilma FX-allikata ning ostuhind sisestatakse aktsia noteerimisvaluutas. Olemasoleva positsiooni tees suunatakse Thesis Builderisse.
- `/daily` snapshot-võrdlused ja alert'id.
- `/thesis/[positionId]` struktureeritud, versioonitud Thesis Builder koos 12 kuu kontrollpunkti ja skooritõenditega.
- Watchlisti score-change alert võrdleb järjestikuseid sama mudeliversiooni snapshot'e, säilitab idempotentse alert'i ning näitab muutunud komponente nii Watchlistis kui Daily Changes vaates.
- `/scanner?preset=rklb` kuvab olemasolevast universumist 0-6 läbipaistvalt põhjendatud uurimiskandidaati: kuni kaks igast `market-cap-tier-policy-v1` lower/middle/upper tier'ist, ilma tier'idevahelise kohtade laenamiseta, koos kriteeriumide, riskide, teadmata info ning Watchlisti/Thesis tegevustega.
- Iga RKLB discovery käivitus salvestab `discovery_runs` ja `discovery_decisions` tabelitesse muutumatu point-in-time otsuse koos kogu vaadeldud universumi ning kaasamise/välistamise põhjustega.
- Päevane `/api/collect` töötleb Tallinna kalendripäeva kohta kuni viis puuduva või aegunud SEC CompanyFactsi katvusega ettevõtet, säilitab `financial_enrichment_status` retry/auditi ning loob ühe `rklb_daily` canonical discovery run'i.
- `collection_runs` ledger (`0002_collection_runs_ledger`) annab igale `runCollection()` katsele oma rea: trigger, `running → success|failure` lifecycle, algus/lõpp, kestus, `schemaVersion: 1` JSON-metricud ning kuni 2000 märgini piiratud veainfo. API trigger on `api`, schedulerit/CLI-d muutmata kutsed on `direct`; protsessi jõuga katkemine jääb auditeeritava `running` reana nähtavaks.
- `data_quality_snapshots` (`0003_data_quality_snapshots`, `data-quality-snapshot-v1`) külmutab iga uue canonical `rklb_daily` run'i juurde ühe otsusehetke kvaliteedipildi: hinnatud/kaasatud arv, tuntud mitte-ETF universumi SEC/score/sektori/30 päeva hinna kate, finantsperioodide vahemik ja 550 päeva stale-loendur ning immutable decision/score snapshot'ist coverage-, mandate-, FCF- ja dilution-flagid. Manual `rklb` run on keelatud; sama run'i kirjet ei kirjutata üle.
- `collection_run_items` (`0004_collection_run_items` + `0007_insider_lookup_bucket`, `collection-run-item-v1`) külmutab iga collect'i radaritickeri growth/recall/insider/not-selected bucketi, lookup-katse ja tabamuse, provider'i, source-spetsiifilised rank/signaalid, skip-põhjuse ning võimaliku company-seose. Precedence on lukustatud `growth > recall > insider > not_selected`; olemasolevat terminalinfot ei kirjutata korduskutsel üle. `0007` rakendus Neonile 2026-08-23.
- `outcome_analysis_snapshots` (`0005_outcome_analysis_snapshots`, `outcome-analysis-snapshot-v1`) loob iga measured outcome'i kohta immutable õppimiskirje ainult `discovery_decisions`, `candidate_outcomes`, `data_quality_snapshots` ja `collection_run_items` sisenditest. Winner (`return > 0`) ja benchmark beat (`excess return > 0`) on eraldi; puuduv provenance/quality/catalyst/mandate/benchmark jääb `unknown`. DB-trigger keelab UPDATE/DELETE ning summary võrdleb canonical kohordis bucketit, skoori, kvaliteeti, catalyst tier'i ja mandate relevance'i; legacy manual/unknown scope ei saasta vaikimisi koondit. Detailne leping: [`docs/OUTCOME_ANALYSIS_SNAPSHOT_V1.md`](OUTCOME_ANALYSIS_SNAPSHOT_V1.md).
- `/research/outcome-attribution` Outcome Attribution V1 on read-only õppimisvaade, mis koondab ainult `outcome-analysis-snapshot-v1` canonical measured candidate-horizon tootlused. Growth ja Coverage tulevad immutable snapshotist; Health, Sector ja Market Cap sama immutable decision'i reast. Iga bucket näitab n-i, keskmist, mediaani, `return > 10%` win rate'i ja `return < 0%` loss rate'i; alla viie vaatlust ei lähe deterministlikesse highlight'idesse. Total Score sektsioon jääb ausalt unavailable, sest RKLB-l pole koondskoori ega seda leiutata tagantjärele.
- `/research/outcome-coverage` Outcome Coverage V1 on read-only tracking completeness vaade. Headline järgib kokkulepitud V1 definitsiooni: kõik `collection_run_items` read vs distinct tickerid, mille täpselt seotud item'il on current-version immutable outcome snapshot. Run- ja age-tabel kasutab võrreldavat item-level lugejat/nimetajat ning `EXISTS` semantika välistab sama item'i mitme horisondi topeltlugemise. Vanus tuleb `collection_run_items.observed_at` ajast; täpselt 180 päeva kuulub 91–180 bucketisse ja `180+` tähendab vanemat kui 180 päeva. Vaade ei mõõda strateegia headust ega kirjuta DB-sse.
- `/research/outcome-backfill-audit` Outcome Snapshot Backfill Audit V1 on enne võimalikku write-job'i paiknev read-only readiness-kiht. Iga `collection_run_items` rida saab täpse 30D/90D/180D due-state'i; hinnavalmidus nõuab olemasolevast `price_snapshots` tabelist positiivset algushinda item'i `observed_at` hetkel või kuni 7 päeva varem ning esimest positiivset lõpphinda täpsest target'ist järgneva 7 päeva jooksul. Snapshot'i olemasolu kontrollitakse eraldi horizon'i kaupa; olemasoleva skeemi `1m`/`3m`/`6m` väärtused kaardistatakse auditi 30D/90D/180D veergudesse ning võimalikud tulevased exact-day labelid tuvastatakse samuti. Vaade ei loo ega muuda hindu, outcome'e, snapshot'e, scheduleri tööd ega rankingut; puuduva hinnatabeli või hinna korral jääb tulemus ausalt unavailable/missing.
- `/research/discovery-quality` Discovery Quality Audit V1 on `REPEATABLE READ, READ ONLY` composition-vaade kõigile `collection_run_items` ridadele. See näitab sector-, market-cap-, country- ja exchange-jaotust, duplicate discovery't ning ainult sama item'iga seotud immutable decision'i Growth/Health/Coverage bucket'eid. Sector eelistab decision-time väärtust ja langeb vajadusel praegu salvestatud company classification'ile; market cap langeb viimasele kohalikule hinnasnapshot'ile, mis oli item'i vaatlushetkeks olemas; exchange on current company metadata. `Unknown` jääb all-item nimetajasse, country on praeguses skeemis ausalt unavailable ja Total Score'i ei leiutata, sest ranking on leksikograafiline.
- `/research/metadata-coverage` Metadata Coverage Audit V1 ehitab väljaloendi `information_schema` põhjal ning loeb kõik väärtused ühes `REPEATABLE READ, READ ONLY` päringus. Nõutud sector/industry/market-cap/exchange/country/score väljad skeemikontrollitakse enne dünaamilise SQL-i koostamist; lisaks kaasatakse ainult päriselt leitud collection/company/decision metadata. SQL NULL, tühi string, explicit Unknown/N/A ja schema-unavailable on eraldi puudumise liigid; `false` ja score 0 jäävad päris väärtusteks. Vaade ei kirjuta, enrich'i ega paranda ridu.
- `/research/metadata-root-cause` Metadata Join Root Cause Audit V1 jälgib ühe batched `REPEATABLE READ, READ ONLY` päringuga iga collection item'i valiku/lookup'i konteksti, tickeri company identity't, persisted `company_id` linki, company metadata't, observation-time market cap/score snapshot'i ja item-linked immutable decision score'e. First-failure klassid on mutually exclusive; unselected ticker võib olemasoleva company identity korral funnelis jätkata. Vaade diagnoosib, kuid ei paranda linke, metadata't ega score'e.
- `/today` Daily Research Brief UX V2 on rakenduse read-only hommikune entrypoint. Primaarstaatus eristab `READY`, `WAITING`, `ATTENTION` ja `ERROR`; universumi kvaliteet ning kandidaadi warningud ei ole enam üks punane üldstaatus. Iga immutable included otsus saab deterministliku “Why research this today?” kokkuvõtte, inimkeelse catalyst/source-path kuva ja inline evidence/riski detaili. Päevavõrdlus näitab repeated tickeri rank'i ning olemasolul Growth/Coverage/mandate/catalyst muutust; outcomes ja missed moves on kompaktsed. Kõik päringud jooksevad ühes `REPEATABLE READ, READ ONLY` transaktsioonis; collectorit, outcome refresh'i, rankingut ega write-on-read route'e ei kutsuta. Vaade on research cockpit, mitte trading recommendation ega AI-selgitus.
- `/today` Price Context + Scenario Valuation V1 eristab nüüd `Fundamental Growth x/100` hinnaliikumisest. Kandidaadi detail näitab ainult salvestatud hinnasnapshotidest 1/3/6 kuu tootlust, kaugust 52 nädala high/low'st ja läbipaistvat recent-run-up hoiatust; ebapiisava ajaloo puhul kuvatakse `Insufficient price history`. Bear/Base/Bull on fikseeritud ±20% business/valuation sensitivity otsuse hetke market cap'i, hinna ja sama `score_snapshot_id` täpsete SEC fact-viidete peal, mitte prognoos ega price target. Puuduva positiivse P/E, EV/Sales või FCF Yield ankru korral kuvatakse `Scenario valuation unavailable`. Ranking, score'id, skeem, collector ja allikad jäid muutmata.
- `/today` UX V3 esimene alam-slice selgitab iga adjacent rank-paari (1→2, 2→3 jne) sama jagatud comparatori kaudu, mida discovery ise kasutab: supported criteria count → catalyst tier → Fundamental Growth → Coverage → Financial Health; ticker on ainult deterministlik viimane tie-breaker. Kõigi viie research-välja viik kuvatakse viigina ning vastuoluline stored order märgitakse ausalt, mitte ei leiutata põhjust.
- `/today` UX V3 ownership-badge'id näitavad kandidaadil ainult päriselt olemasolevat Watchlisti, aktiivset Portfolio kirjet ja current Thesis staatust koos linkidega. Kõik tänased tickerid loetakse ühe batched SQL päringuga; kandidaadipõhist N+1 päringut ei ole ja closed-positsiooni ei esitata aktiivse omandina.
- `/today` UX V3 inline change kuvab kandidaadikaardil ainult päriselt muutunud rank/score/coverage/mandate/catalyst väljad. Võrdluspartner on viimane varasem canonical päev sama `model_version` väärtusega; vahepealne teise mudeliversiooni jooks jäetakse vahele ning muutumata välju ei korrata ei kaardil ega päevavõrdluses.
- `/today` UX V3 catalyst-kuva tõlgib salvestatud event/source/novelty/materiality/relevance enumid lühikeseks deterministlikuks inimlauseks. Sündmuse kuupäev ja allikalink jäävad nähtavaks; raw enumid, seotud periood ja stored detail on `Technical details` all. Puuduvat sündmust ei oletata ning PostgreSQL `date` loetakse tekstina, et kuupäev ei nihkuks Node'i ajavööndis.
- `/today` kandidaadikaart kuvab nüüd kompaktselt ja kõrvuti kaks sõltumatut kontrolli: Paper Strategy V1-ga sama lävendiloogikat kasutav Business (`Strong`/`Mixed`) ning salvestatud price-context'il põhinev Market setup (`Not overheated`/`Run-up elevated`/`Unknown`). Puuduv skoor jääb tekstina `unknown`, ebapiisavat hinnaajalugu ei järeldata ning plokk ütleb otse, et see pole ostusignaal. Rankingut, canonical valikut, paper-policy't ega skeemi ei muudetud.
- `/validation` värskendab `candidate_outcomes` tulemusi 1n, 2n, 1k, 3k ja 6k horisondil ning kuvab iga horisondi statistika ja jooksude auditivaate. Koondstatistika kasutab alates 2026-08-12 ainult canonical (`rklb_daily`) jooksu; jooksude ajalugu kuvab endiselt kõiki run'e (audit).
- `/backtest` kasutab ainult salvestatud discovery run'e ja outcome'e, võrdleb kandidaadi tootlust fikseeritud SPY benchmark'iga ning näitab puuduva benchmark'i korral excess return'i `unknown` olekuna. Koondnäitajad kasutavad alates 2026-08-12 ainult canonical jooksu; run-level detail kuvab kõiki run'e.
- Paper Strategy V1 on lokaalselt ehitatud eraldi mõõtmiskihina, mitte discovery skoori ega brokeri integratsioonina. `paper-strategy-v1` külmutab iga canonical valiku kohta `$100` all-picks baseline'i ja paralleelse entry-aware otsuse; mõlema rahavoo kohta tekib sama `$100` SPY benchmark-order. Entry-aware nõuab Growth ≥65, Health ≥65, Coverage ≥70, sama collection run'i current market-data kinnitust, piisavat/partial price history't ning recent-run-up puudumist. Hypothetical täitmine nõuab Yahoo `REGULAR` market state'i, explicit USD-d ja kuni 20 minuti vanust quote'i. EXIT tekib ainult pärast kolme järjestikust current-collection-confirmed canonical fundamentaalset failure'it; top-listist kadumine üksi ei müü.
- `/performance` kuvab Paper Strategy V1 app-vs-SPY rahavood, filled/pending/skipped loendurid, open positions, markide ajatemplid ja P/L-i ainult täieliku mark-katte korral. Iga hiljutine order kuvab nüüd immutable V1 signal snapshot'ist kõrvuti Business ja Market setup oleku, collection-freshness'i ning tegelikud otsusepõhjused; legacy, exit või malformed snapshot jääb ausalt `unknown`. Puuduv mark jääb `unknown`. V1 ei arvesta makse, dividende, FX-i ega slippage'it ning ei saada ühtki päris orderit. Migratsioon `0008_paper_strategy` rakendus Neoni golden source'ile 2026-09-01.
- `/frequency` (Discovery Frequency V1) kuvab canonical `rklb_daily` jooksude põhjal, kui järjekindlalt sama ticker jooksva mudeliversiooni piires kaasati: kaasamiste arv, 5/10/20 päeva aknad, jooksev streak, esimene/viimane kaasamine + rank'i muutus, `included/excluded/absent` timeline ning persistence (`stale_evidence` vs `evolving_evidence`). Käsitsi `rklb` jooksud ei osale kunagi; alla viie canonical päeva kuvab loendurid, aga märgib, et tõlgendada ei tohi.
- `/missed-moves` on read-only point-in-time järelkontroll: vähemalt 8% liikumised eri Tallinna kauplemispäevade viimaste salvestatud hinnasnapshotide vahel seotakse liikumisele eelnenud canonical otsuse, varasema sotsiaalradari nähtavuse ning samasse intervalli salvestatud Yahoo/SEC/earnings sündmustega. Vaade eristab `included`, `excluded`, `radar_data_gap` ja `universe_gap`; see ei nimeta tagantjärele liikumist ennustatavaks.
- Päevane collection säilitab nüüd `companies` tabelis ka sotsiaalradaris nähtud tickeri, millele Yahoo/FMP turuandmeid ei tagastanud; hinnasnapshot tekib endiselt ainult päris turuandmest. `MIN_MENTIONS = 3`; kasvu järgi top-80 kõrval küsitakse olemasolevast Yahoo/FMP kihist kuni 20 absoluutse tähelepanu põhist recall-tickerit, et langevate mainimistega RDDT-laadne nimi ei kaoks enne fundamentaalpäringut.
- Sector-relative Ranking V1 kasutab olemasoleva Yahoo `assetProfile` sector/industry välju, võrdleb sama score-versiooni ettevõtteid eelistatult industry ja vajadusel sector grupis ning kuvab percentile'id ainult vähemalt viie täieliku võrreldava ettevõtte korral.
- Under-recognition Evidence V0 (`under-recognition-v0`) kuvab company detailis ja Thesis Builderis kompositsioonikihina, kas ettevõte võib olla varajane research-kandidaat (tõend paraneb, aga turg ei pruugi veel hinnastada). See LOEB olemasolevaid signaale (analyst kate, sector-relative market cap percentiil, Catalyst novelty, Growth/Health, Data Freshness + Period Alignment) ega arvuta neid uuesti — ei dubleeri Catalyst ega Valuation kihti. Signaalivektor (analystAttention, marketCapContext, discoveryFrequency, priceReaction, catalystNovelty, improvingFinancials) → üks viiest tekstiolekust: `meaningful` / `attention_only` / `no_attention_gap` / `low_confidence` / `unknown`. **Mitte skoor, mitte number, mitte ranking, mitte buy/sell.** `unknown`-first: puuduvat infot ei asendata oletusega; frequency ja price reaction on V0-s alati `unknown`. Cohort QA vastab § 4.1-le: API meaningful, BW low_confidence, HIMS/CAKE/ACHR no_attention_gap.
- Valuation Evidence V1 (`valuation-evidence-v1`) kuvab company detailis, Thesis Builderis ja `/scanner?preset=rklb` kandidaadikaardil valuation-ankrud (EV/Sales, P/E, FCF Yield arvutatuna olemasolevatest SEC faktidest + market cap'ist; Peer comparison ja Sum-of-parts alati `unknown`). Iga ankur on üks läbipaistev suhtarv (fakt/fakt) allika, confidence'i (tuletatud Data Freshness + Period Alignment kihist), viimase sisendi ja staatusega — **mitte koondskoor, mitte osta/müü soovitus**. `unknown` on lubatud kõikjal; negatiivse kasumi P/E on `not_meaningful`, negatiivne FCF yield märgitakse raha põletamiseks. Growth, Health, Coverage, Catalyst ja Frequency jäid muutmata.
- `/guide` ja `docs/USER_GUIDE.md` selgitavad uuele kasutajale kogu rakenduse soovitatud töövoogu.
- Automaattestide infrastruktuur (Vitest, ainult devDependency) on olemas ja tootmisandmebaasist isoleeritud:
  - eraldi `discovery_test` andmebaas, mille test-harness ise loob (`globalSetup`) ja jooksu lõpus kustutab; hooldusühendus (CREATE/DROP DATABASE) käib `postgres` baasi kaudu, seega tootmisbaasi `discovery` vastu ei avata testides ühtki ühendust;
  - skeem luuakse **versioonitud migratsioonidest** (`db/migrations/*.sql` läbi `scripts/migrate.cjs`), mitte `ensureSchema()`-st ega `db/init.sql`-ist; nii valideerib kogu testikomplekt ühtlasi runnerit, baseline'i ja `schema_migrations` raamatupidamist;
  - neljakihiline kaitse: `DATABASE_URL` seatakse enne igat lib-importi (`src/lib/db.ts` loob Pool'i impordi hetkel ja cache'ib selle `globalThis` peale), runtime `SELECT current_database()` kontroll enne igat testifaili, sihtbaasi nimekontroll (peab lõppema `_test`-iga ja ei tohi olla `discovery`) ning `.env` faili testides ei loeta;
  - kaitse on ka negatiivselt tõestatud: vale baasinimega jooks katkeb enne ühtki `CREATE`/`DROP` käsku;
  - käivitamine konteineris `docker compose run --rm -T app npm test` **või** hostil `npm test`. Hostil tuleb `TEST_DATABASE_URL` eksplitsiitselt seada, sest fixture'i vaikeväärtus (`db:5432`) on Dockeri-sisene ja hostist ei resolvu: `$env:TEST_DATABASE_URL='postgres://discovery:discovery@localhost:5433/discovery_test'`;
  - kokku 354 testi 39 failis, 100% roheline; `npm test` **ei ole veel** `npm run check` ahelas.
- **Golden-source DB on alates 2026-08-19 Neon PostgreSQL** (tasuta tier, projekt `stock-discovery`, eu-central-1) ja see on **ainus autoriteetne** andmebaas: `DATABASE_URL` failis `.env` osutab Neonile ning kõik päris `collect:daily` jooksud kirjutavad sinna. Skeem tuli üle migreeritud kujul: `schema_migrations` sisaldab 5 kirjet (`0001_baseline` 2026-08-13 ning `0002_collection_runs_ledger`, `0003_data_quality_snapshots`, `0004_collection_run_items`, `0005_outcome_analysis_snapshots` 2026-08-15), 0005-järgne `--conformance` verdikt oli `VASTAB` (0 puuduvat, 0 üle). `ensureSchema()` jääb koodis alles ja on testidega tõestatud migreeritud skeemil no-op. Vt sessioonilogi „2026-08-19 - Golden-source cutover lokaalsest Dockerist Neoni".
- **Lokaalne Docker Postgres (`stock-discovery-db-1`, `localhost:5433`) jääb alles AINULT testi-isolatsiooniks** — `discovery_test` baasi jaoks, mille `tests/setup/global-setup.ts` ise loob ja jooksu lõpus kustutab. Selle `discovery` baas on **külmutatud ajalooline snapshot ja backup: sinna ei kirjutata ega rakendata migratsioone**. Mõõdetud külmutamise seis 2026-08-19: `collection_runs` 8 (max id 8), `collection_run_items` 789, canonical `rklb_daily` jooksud 8 (viimane `discovery_runs` #34, `decision_date` 2026-08-19, 5 kaasatut), max `discovery_runs` id 34, `investment_theses` 11, `schema_migrations` 5. Migratsioonide-eelsed backup-dumbid (`pre-0002…` … `pre-0005-outcome-analysis.dump`, 611 159 baiti, 225 TOC kirjet, SHA-256 `F234A9E592449393A4AF48A1A9C242FCF0A6E932C050C73DE034E0C7F81FEE02`) kehtivad selle snapshoti kohta.
- **GitHub Actions workflow `collect-daily` on olemas ja päris jooksudega tõestatud** (`.github/workflows/collect-daily.yml`, commit `7b185f7`). Ta käivitab `npm run collect:daily` Neoni vastu `ubuntu-latest` runneril, Node 22, `timeout-minutes: 10`, concurrency group `collect-daily` (`cancel-in-progress: false`) advisory locki peale teise kaitsekihina. Trigger on **ainult `workflow_dispatch`** — vt otsust allpool. Vajalikud secret'id on repo Actions secret'ites seadistatud: **`NEON_DATABASE_URL`**, **`SEC_USER_AGENT`** ja valikuline **`HEALTHCHECKS_PING_URL`**; viimane hakkab automated workflow teed kaitsma pärast heartbeat-koodi sisaldava commit'i push'i.
- **Lokaalne Docker app loeb alates 2026-08-20 Neoni, mitte külmutatud lokaalset baasi.** `docker-compose.yml` `app` teenuse `DATABASE_URL` oli kõvakodeeritud `db:5432/discovery` peale ja compose'i `environment` võidab konteineri sees `.env`-i, seega cutover'i järel näitas `localhost:3005` vaikselt külmutatud cutover-eelseid andmeid. Nüüd on seal `${DATABASE_URL:?...}`, mis interpoleerub `.env`-ist ja **katkeb valjult**, kui väärtus puudub. Dockeri `scheduler` teenus on `profiles: ["scheduler"]` taga ega käivitu vaikimisi.
- **Päevane kadents taastati 2026-08-25 pärast päris 2026-08-19...2026-08-25 automation gap'i.** Algne `cron-job.org` test tõestas küll ahela ühekordselt, kuid scheduled job ise puudus hiljem kontolt / ei olnud püsivalt salvestunud; GitHub Actionsis ei olnud pärast kolme 2026-08-20 Tallinna aja setup-jooksu ühtki automaatset dispatch'i. Job on nüüd uuesti loodud 08:10 Europe/Tallinn ajale sama repo-only Actions read/write fine-grained PAT-iga ning `NEON_DATABASE_URL` secret parandatud. Päris GitHub Actions workflow run `32883230677` lõppes success'iga ja lõi Neoni eduka collection run #18. Koduarvuti Windows Task Scheduler (08:05 Tallinna aeg) jääb sekundaarseks varutriggeriks, kuid incident tõestas, et see ei ole sõltumatu always-on garantii.
- Koduarvutil on **Node 24.19.0 + npm 11.17.0** paigaldatud kasutaja-õigustes (`winget install OpenJS.NodeJS.LTS --scope user`; UAC-i ei vajanud, zip-variant `%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_*` all) ja `npm ci` tehtud. Seega `lint`, `typecheck`, `test`, `collect:*`, `migrate` ja `schema:diff` töötavad ka otse hostist; DB jääb Dockerisse.
- **Windows Task Scheduler ülesanne `StockDiscoveryDailyCollect` on koduarvutil registreeritud ja käsitsi testitud** (iga päev 08:05, `LastTaskResult = 0`, logi `C:\sd-logs\collect.log`). Vt „Lokaalne päevane collect (CLI)".

Viimati kontrollitud päris skoorid:

| Ticker | Growth | Health | Coverage |
|---|---:|---:|---:|
| AAPL | 89 | 86 | 100 |
| RKLB | 69 | 36 | 100 |
| TSM | puudulik | 100 | 8 |

Growth/Health nimekirjades kuvatakse vähemalt 70 Coverage tulemused enne madala kattega tulemusi, et üksiku komponendi kõrge skoor poleks eksitav.

## Tehtud verstapostid

- Early Opportunities V1: source-backed growth/cash-flow scan, known 1/3/6-month run-up checks, frozen first-discovery price and 30-day continued tracking; verified 1 October with real AMKR/CDE observations.

- Market radar V1: six independently sourced Yahoo screen lists, unscored-name visibility, idempotent company/price persistence and 20-attempt daily SEC enrichment; verified 1 October 2026.

- **2026-09-07 financial corrections:** verified HIMS same-filing investment/FCF extraction, refreshed API ordinary shares, and introduced the v2 EV/Sales date guard. Repeated live refreshes were idempotent and saved theses/decisions/outcomes/orders stayed unchanged. The later dated BW/API reconciliation closes the BW total-debt and API liquidity/ADS-definition research gaps; normalized CompanyFacts remain unchanged by design.

- **2026-09-07 publication and review:** price-tracking/integrity code pushed and remote SHA verified at `aaf537c4dd6bb862a9f52f438e3df0ccb5e6c8f4`. Three source-backed thesis-review drafts completed; no thesis statuses or database records changed.

- **2026-09-06:** completed a repository, read-only Neon and live Today/Performance review focused on personal investing. Reconciled the current roadmap with delivered features and recorded concrete, still-unfixed measurement defects.
- **2026-09-06 follow-up:** implemented the first price-integrity slice locally: held-position quote requests, honest valuation availability and stale/partial Today labels. Discovery selection and frozen signal eligibility remain unchanged; no missed historical price is fabricated. Published on main at aaf537c on 7 September; see the verification entry for evidence.

- Collection Runs Ledger (`0002_collection_runs_ledger`):
  - iga põhikogumise katse saab enne väliseid providerikutsed oma `running` rea;
  - edu salvestab `success`, lõpuaja, kestuse ja versioonitud metricud (capture date, scanned, candidates, flagged, lookup ja providerite loendurid/fallbackid);
  - püütud viga salvestab `failure`, vea tüübi ja kuni 2000 märki; algne viga rethrowitakse;
  - sama terminalseisu kordus on idempotentne, vastupidine terminalüleminek keelatud ning PostgreSQL CHECK-id välistavad vastuolulise rea;
  - force-kill/crash jätab rea `running` olekusse, et kadunud töö ei muutuks näiliseks success'iks;
  - scheduler, migration runner ja Neon jäid muutmata.
- RDDT järelkontrollist lähtunud collection reliability slice:
  - radariticker säilib ettevõtete universumis ka turuandmeteta, kuid nullhinda ei leiutata;
  - growth top-80 kõrval on kuni 20 tickeri attention-recall ring olemasoleva Yahoo/FMP provideriga;
  - `/missed-moves` eristab tagantjärele universumi-, andme- ja reegliauku point-in-time snapshotidest;
  - Frequency PostgreSQL `DATE` normaliseeritakse andmekihi piiril ning vigane väärtus ei kukuta UI-d;
  - portfell kuvab USD noteeringud USD-na ja hoiab eri valuutade koondid lahus.
- Idempotentne price/news/SEC/earnings ajalugu.
- Daily Changes võrdleb päris snapshot-ajalugu ja loob idempotentseid alert'e.
- Portfelli turuväärtus, unrealized P/L ning võitja/kaotaja.
- Analüütikute konsensus ja hinnasihid.
- Turu scanner kogutud movers/earnings/SEC/news andmetega.
- Tasuta reeglipõhine Research Brief ja modulaarne signal engine.
- SEC CompanyFacts finantsajalugu ja võrreldavate perioodide YoY.
- Growth, Financial Health ja Coverage Score koos versioonitud ajalooga.
- Data Freshness + Period Alignment V1:
  - ettevõtte tasemel eraldi `data-quality-v1` arvutus olemasolevate score'i põhimõõdikute põhjal;
  - iga mõõdik näitab väärtust, economic period end'i, period kind'i, vanust, fact ID-d, accession number'it ja SEC algallikat;
  - kokkuvõte näitab uusimat/vanimat perioodi, vanimat mõõdikut, mediaanvanust, stale/unknown arvu ja perioodivahet;
  - Freshness olekud on `fresh`, `mixed`, `stale`, `unknown`; Alignment olekud `good`, `warning`, `poor`, `unknown`;
  - company detail ja Thesis Builder kuvavad täielikku evidence-tabelit, RKLB kandidaadikaart kompaktset hoiatust;
  - Thesis Builderi `ready` valik saab mitteblokeeriva soft warning'u;
  - Coverage, Growth, Financial Health, catalyst gate, RKLB filtrid, universum ja välised provider'id jäid muutmata.
- Catalyst Evidence V2 ([`docs/CATALYST_EVIDENCE_V2.md`](CATALYST_EVIDENCE_V2.md)):
  - catalyst hard gate on eemaldatud; kaasamise otsustavad ainult Growth, Coverage, market cap ja RKLB-välistus;
  - `catalyst_events` säilitab vaatluse (event kind, allika liik, source_ref, seotud fact ID-d, seotud periood) ja `catalyst_assessments` versioonitud hinnangu; identne kordushinnang ei loo duplikaati;
  - avaldatud tõend tuletatakse `financial_facts` accession-grupist, seega filing loeb tõendiks alles siis, kui sellega saabus uus majandusperiood;
  - viis mõõdet on materiality, direction, source quality, novelty ja thesis-relevance; mandate-relevance on neist eraldi;
  - `earnings_scheduled` ei saa kunagi olla `supported`; möödunud earnings ilma uue perioodita on `collection_gap`, mitte sündmusetus;
  - evidence tier (`material_new_evidence` > `weak_or_unconfirmed` > `scheduled_only` / `collection_gap` > `none_recorded`) on üks aste leksikograafilises järjestuses, mitte koondskoor;
  - `discovery_decisions` säilitab otsusehetke catalyst-väljad; ajaloolisi ridu ei backfillitud;
  - Growth, Financial Health, Coverage ja `data-quality-v1` loogika jäid muutmata.
- Watchlist ja olemasolevatel skooridel põhinev idee-avastus.
- Thesis Builder V1:
  - väljad `business`, `why now`, `moat`, `mispricing`, `catalyst`, `invalidation`, ajahorisont ja 12 kuu kontrollpunkt;
  - staatused `draft`, `researching`, `ready`, `rejected`;
  - Growthi ja Financial Healthi kolm suurima kaalutud mõjuga põhjust;
  - „5-minute defense” ja versiooniajalugu;
  - teesi versiooniga seotud point-in-time score snapshot;
  - identne kordussalvestus ei loo duplikaatversiooni;
  - `ready` nõuab invalidation-tingimust, 12 kuu kontrollpunkti ja kinnitust, et kontrollpunkt on mõõdetav.
- Watchlisti score-change alert:
  - võrdleb ainult kahte järjestikust sama mudeliversiooni snapshot'i;
  - oluline muutus on vähemalt 10 punkti Growthis/Healthis või oluline komponendi seisundimuutus;
  - kuvab vana ja uue skoori, mudeliversiooni, snapshot'i ID-d ja muutunud komponendid;
  - salvestab ühe dedupe-võtmega alert'i snapshotipaari kohta;
  - mudeliversiooni vahetus kuvatakse `needs review` seisuna ega tekita eksitavat score-alert'i;
  - positiivne, negatiivne, segatud ja ebaoluline muutus kasutavad sõnastust `new catalyst`, `new risk`, `needs review` või `no major changes`.
- „Leia järgmine RKLB” V1:
  - kasutab ainult olemasolevaid SEC, score, hinna/market cap'i, earnings'i, SEC sündmuse ja uudise andmeid;
  - baasfiltrid on Growth vähemalt 65, Coverage vähemalt 70, teadaolev market cap kuni 75 miljardit ja vähemalt üks ajaliselt piiratud katalüsaator;
  - RKLB ise jäetakse võrdlusnäidisena välja;
  - iga kriteerium kuvatakse eraldi `supported`, `uncertain` või `missing` olekuna;
  - järjestus on leksikograafiline: toetatud kriteeriumide arv, Growth, Coverage, Health ja ticker; koondskoori ei ole;
  - null kandidaati on korrektne tulemus;
  - kandidaadi saab lisada Watchlisti või suunata kohe Thesis Builderisse.
- Uue kasutaja juhend rakenduses ja Markdown-dokumendina.
- Discovery Decision Snapshot + Validation Framework:
  - `discovery_runs` säilitab Tallinna otsusekuupäeva, jooksuaja, mudeliversiooni, sisendräsi, reeglid ja kogu vaadeldud universumi;
  - `discovery_decisions` säilitab iga tickeri kaasamise või välistamise, täpsed põhjused, skoorid, hinna/market cap'i/volume'i, snapshot ID-d, runway, katalüsaatori, riskid ja teadmata info;
  - sama mudeli, Tallinna kuupäeva ja identse sisendi kordus taaskasutab varasemat run'i; muutunud sisend loob samal päeval uue run'i;
  - iga kaasatud kandidaat saab viis `candidate_outcomes` rida horisontidele 1n, 2n, 1k, 3k ja 6k;
  - tulemus kasutab esimest hinda sihtajal või järgneva seitsme päeva jooksul ning mõõdetud rida ei kirjutata hiljem ümber;
  - outcome'id värskendatakse nii kaitstud päevase `/api/collect` töö lõpus kui `/validation` avamisel;
  - `/validation` näitab horisondipõhist statistikat ja täielikku otsuselogi;
  - runway kuude arvu ei oletata; säilitatakse Financial Healthi ning cash/debt komponendi tegelik kirjeldus.
- Point-in-time Backtest V1:
  - `candidate_outcomes` säilitab benchmark'i sümboli, staatuse, algus- ja lõpphinna, benchmark return'i ning excess return'i;
  - vaikimisi benchmark on fikseeritud `SPY`, mille hind kogutakse olemasoleva Yahoo/FMP hinnakihi kaudu ilma uue API või võtmeta;
  - benchmark'i algushind peab olema salvestatud run'i ajal või eelneva seitsme päeva jooksul; lõpphind tuleb outcome'i fikseeritud sihtaja seitsmepäevasest aknast;
  - puuduva algus- või lõpphinna korral jäävad benchmark return ja excess return `NULL`/`unknown`, mitte 0;
  - candidate return, benchmark return ja excess return lukustuvad pärast edukat mõõtmist;
  - `/backtest` kuvab iga horisondi jooksud, kandidaadid, mõõdetud tulemused, keskmise, mediaani, hit rate'i, benchmark'i võitmise määra, keskmise excess return'i ning parima/halvima kandidaadi;
  - run-level detail näitab ainult salvestatud included kandidaate, excluded arvu, otsusehetke skoore, põhjuseid, riske ja teadmata infot;
  - Backtest V1 ei käivita ajalooliste kuupäevade jaoks tänast scannerit ega tee prediction'it.
- Sector-relative Ranking V1:
  - `companies` säilitab `sector`, `industry`, klassifikatsiooni allika ja uuendamise aja; uus väline API ega võti ei lisandunud;
  - grupp valitakse sama score-versiooni seest: vähemalt viie liikmega industry, muidu vähemalt viie liikmega sector, ebapiisava valimi korral suurem olemasolev grupp;
  - Growth, Health, Coverage ja market cap saavad tie-adjusted percentile'i ning kolm skoori grupimediaani;
  - alla viie täieliku võrreldava ettevõtte korral kuvatakse `Not enough comparable companies` ja percentile/mediaan jääb `NULL`;
  - scanneri kandidaat, company detail ja Thesis Builder kuvavad sama faktiploki; Thesis Builder ei kirjuta selle põhjal teesi;
  - uued `discovery_decisions` read säilitavad otsusehetke sector-relative väärtused, kuid ajaloolisi otsuseid ei backfillita ega kirjutata ümber.
- Daily SEC enrichment + canonical discovery:
  - aktiivne universum on viimase 30 päeva hinnasnapshotiga ettevõtted, välja arvatud teadaolevad ETF-id ja SPY;
  - puuduva või üle seitsme päeva aegunud CompanyFactsi ajalooga ettevõtteid töödeldakse järjestikku kuni viis Tallinna päeva kohta;
  - ühe tickeri `error` või `unavailable` ei nurja collection'it; transient error proovib järgmisel päeval ja unavailable kõige varem 30 päeva pärast;
  - `financial_enrichment_status` säilitab viimase katse/õnnestumise, staatuse, vealoenduri ja piiratud veakirjelduse;
  - suurem kui 2 MB SEC CompanyFactsi vastus ei lähe Next fetch-cache'i; püsiv cache on PostgreSQL;
  - `rklb_daily` run-key on mudeliversioon + run type + Tallinna kuupäev, seega korduscollect ei loo teist canonical snapshot'i;
  - kui hilisem sama päeva collect muudab sisendit, säilib esimene canonical snapshot ja API märgib `inputChangedAfterCanonicalSnapshot`;
  - käsitsi scanneri `rklb` run'id jäävad eraldi auditiks ega kuulu tulevase frequency arvestusse.
- SEC Form 4 Phase 1 calibration on valmis eraldiseisva read-only skriptina `scripts/calibrate-form4.cjs`; see ei impordi ega käivita `collect.ts`, discovery't, score'e ega ühtki production write-path'i. 2026-08-19 kuni 2026-08-21 täispopulatsiooni jooks luges 3636/3636 filingut null veaga, kasutas SEC-is järjestikuseid kuni 5 req/s päringuid ja tegi Neoni `companies` overlap'i ainult `BEGIN TRANSACTION READ ONLY` + `SELECT` kaudu. Päris raport: [`docs/FORM4_CALIBRATION_2026-08-23.md`](FORM4_CALIBRATION_2026-08-23.md).
- SEC Form 4 Phase 2 ingestion/persistence on ehitatud ainult on-demand skriptina: migratsioon `0006_insider_form4_persistence`, jagatud `scripts/_form4.cjs`, atomaarne `persistForm4Filing()` ja eksplitsiitset kuni 31-päevast vahemikku nõudev `scripts/ingest-form4.cjs`. Filing, struktureeritud owner, transaction ja field-scoped footnote säilivad eraldi; transaction kannab kohustuslikku role-context'i ning DB trigger tõestab selle täpset vastavust owner-ridadele, sh eraldi 10% owner flag. 4/A jääb eraldi filinguks ja link on `resolved|unresolved|ambiguous`, mitte overwrite. `0006` rakendus Neonile 2026-08-23 ning bounded 2026-08-19...21 ingestion salvestas 1742 filingut, 1894 ownerit, 4488 transaction'it ja 6691 footnote'i null fetch/parse/persist veaga; collect/discovery/scoring/ranking/UI jäid muutmata.
- SEC Form 4 Phase 3 lisab `form4-insider-selection-v1` source path'i olemasolevasse collecti ning esimene production run #16 tõestas 16 insider-only lookup'i. V1 nõuab original Form 4, persisted filingut, non-derivative `P+A` transaction'it, director- või officer-rolli ja **derived notional > $50,000**; 10%-owner-only, kõik 4/A read ning SEC issuer-name'i järgi tuvastatavad fondid/ETF-id on selectionist väljas. Fund guard rakendub enne 20 issueri cap'i, et välistatud instrument ei võtaks operating-company lookup-kohta. Insider-only ticker lisatakse Yahoo/FMP lookup-unionisse, aga `buildCandidates()` saab endiselt ainult ApeWisdomi ridu; social scoring ja ranking jäävad eraldi, kuid vana `$10B` social hard ceiling on eemaldatud. Insider path'il ega canonical discovery'l eraldi hard market-cap lage enam ei ole; canonical kohad jaotatakse versioned market-cap tier'ide vahel.

## Praegune fookus

**7 October AMD diagnosis:** Coherent-period growth/momentum discovery and the DB-clock repair are implemented and verified. Next observe forward discoveries and unattended execution; The same-ledger growth-capital-entry-v2 transition is activated with six new paired entries, preserving the original $20,000 and every gain/loss. Monitor fresh marks, exits, losses and next unattended use of the new entry policy. Broader coverage is not proof of profitability. Persistent Goal usageLimited is separate from ordinary account quota and is not completion.

**6 October user target and recovery:** user now requests a $20,000 starting paper budget and $10,000 monthly net gain (currency flexible; USD chosen to match existing accounting). This is a 50% monthly target, not a promised return. Loss tolerance remains unspecified; no live-money budget or broker authorization. The existing daily-$100 V1 is not a finite-capital experiment and remains a separate control. The new early-capital-v1 account is now activated; see the dated current-state entry. A fresh existing Yahoo execution pass saved 34 marks, filled zero orders, and recovered entry-aware valuation: $10,710.70 invested, $10,582.16 holdings, -$128.54 (-1.2001%) versus matched SPY +$172.51 (+1.6106%), at 6 October ~17:24 UTC. MSC still lacks a usable mark; six HRGN baseline/benchmark orders remained deferred and the CLI correctly failed. No stale quote was forced into a fill. Profitability remains unresolved.


**1 October early-discovery request:** user explicitly asked to find stocks before their rise. Delivered a separate versioned scan for documented growth and positive same-period cash flow before elevated 1/3/6-month returns; first qualification is frozen and tracked forward. Real collection #63 found AMKR/CDE and captured two follow-up prices. Verification completed: final 70-file/523-test suite and live repeated-run/UI checks passed. These are research hypotheses, not proven future winners or paper orders.

**1 October current direction:** the user explicitly authorized broader market discovery, superseding the September feature freeze for this coverage work. Radar delivery is verified; next assess new-source coverage, SEC queue progress and whether discoveries precede subsequent price jumps. This is daily bounded discovery, not whole-market or intraday monitoring, and is not yet connected to a separately versioned paper selection policy. Preserve the current strategy control while measuring missed names and entry timing.

**18 September accepted evaluation boundary:** user accepted a first review after the next 10 trading days, with no new features and only necessary execution/measurement fixes, subject to checking original-scope completeness. [Completion audit](COMPLETION_AUDIT_2026-09-18.md) distinguishes the delivered paper experiment from unfinished broader designs. Do not claim all requested features are complete or that profitability is proven. The user has now supplied the original Estonian idea; the missing-text blocker is resolved. The completion audit maps it to implementation and identifies substantive gaps in holding/exit decision support, public early-information reliability/probabilities and production new-listing screening. Challenger comparison, two under-recognition signals, production new-listing discovery and finite-capital/drawdown work remain partial/deferred. This was the evaluation boundary until the user authorized the subsequent market-coverage expansion.

**18 September reliability follow-up:** completed the bounded SEC catch-up optimization after the user asked to resume remaining work. Immediate verification is the next unattended ingestion/collection run, including quote timestamps. Core discovery, simulated execution and money-first results already exist. Company thesis updates wait for new evidence; another strategy experiment remains Later.

**18 September evening clarification:** prioritize the user's question: did the paper purchases gain or lose money, and how much? Show money in, current holdings plus sale proceeds, and net dollar P/L first, using actual fills rather than pre-entry price moves. Keep methodology available under details. Do not replace this request with a new strategy/capital experiment.

**18 September update:** the user confirmed paper-first evaluation before allocating their own money; no live budget or loss tolerance is committed. Repair measurement before tuning to early returns. The first review is complete, but quote-time gaps make the historical arithmetic unverified; starting-price timing remains a separate limitation. Entry-aware v4 gross purchases total $2,600, with SNDK/WTI at 53.85%. The user subsequently prioritized a simple money-made/lost view of existing paper purchases; that presentation now comes before another strategy experiment. Do not optimize limits on this tiny affected sample.

**2026-09-06 review: the user confirmed that the objective is better personal investing results.** The implementation remains a research tool; a score is not an instruction to buy. The evidence-backed review and proposed fixes are in [ASTRA_REVIEW_2026-09-06.md](ASTRA_REVIEW_2026-09-06.md).

The first production v4 cohort now proves the current-collection fix in the real pipeline. Collection #39 and canonical run #71 selected SNDK, CRDO, WTI, DY, ARM and BWFG; all six link to a same-run item whose market-data lookup succeeded. This replaces v3 run #70's cached-slot mismatch without rewriting it. The v4 run has one immutable quality snapshot, five forward horizons per decision and four paper-policy observations per decision.

The immediate constraint remains decision quality and dependable forward measurement. The authenticated GitHub Actions page shows the 11 September unattended jobs green: `collect-daily #26` succeeded from the 08:10 Tallinn dispatch in 24m45s and `paper-strategy-execute #11` succeeded from the 09:35 New York dispatch in 42s. Entry-aware V1 continues to act only on its explicit positive state. Update 18 September: fresh alerts refer to the real Form 4 timeout and deferred paper orders described above, not merely historical holiday failures. Preserve failed attempts and compare v4 only within its own model-version cohorts.

Paper execution's independent dead-man path is active. The dedicated GitHub secret is stored, manual workflow run #13 succeeded on exact commit `e765990`, the separate heartbeat step ran successfully and Healthchecks recorded the first ping as up. The normal 09:35 `America/New_York` cron-job.org dispatch remains the execution cadence; Healthchecks now detects a missing successful execution independently. The executor also fails visibly if an expected regular-session run leaves any eligible order deferred.

A 13 September read-only Neon audit found four canonical v4 runs (#71, #74, #75 and #76), 23 included decisions across 14 distinct tickers and 115 pending outcome rows. The first v4 1-week target is 17 September at 19:06 UTC, so zero measured v4 outcomes is currently correct. Today's continued-tracking batch attempted 29 symbols: 3 saved, 26 unchanged from Friday's market timestamps, zero missing/stale/invalid/failed and zero waiting. Entry-aware recorded one filled signal on 10 September, four on 11 September and six weekend-eligible intents still pending for the next regular session. Before that session, paired-execution protection was added so an app order cannot fill without its same-time SPY comparison leg.

The user accepted the API, BW and HIMS decision packet on 9 September. Their current v3 Thesis Builder records contain the dated assumptions and review triggers, while their 11 August v2 records remain immutable history. API remains `ready`; BW and HIMS remain `researching`. Today now turns these records into a deterministic review queue; all three are awaiting November evidence and none is due. [BW/API reconciliation](BW_API_RECONCILIATION_2026-09-07.md) makes the filing-level debt, liquidity and ADS definitions visible without replacing normalized facts. The fixed bear/base/bull sensitivity is not evidence of mispricing.

The database startup ambiguity is resolved. Host Next startup now rejects the existing `.env.local` local URL when `.env` declares `DATABASE_TARGET=golden`; the Docker app is explicitly pinned to the validated Neon target. Normal CLI jobs load the same contract, while isolated tests declare `test`. Keep `.env.local` as the intentional negative case unless a future local-app workflow is explicitly chosen.

## Roadmap

### NOW - järgmine töö

- Observe published growth-opportunities-v2 prospectively: first discovery, subsequent gains/losses, missing facts and shared tracking capacity. Verify the next unattended collection uses the DB clock and retains both versions. Code/full regression/restarted UI verification are completed; see [evidence](research/2026-10-07/GROWTH_DISCOVERY.md).

- Operate and audit the activated early-capital-v1 forward paper policy; preserve V1 as the control. Verify unattended execution, source coverage, fill timing, losses and realized costs. The $10,000 monthly target is a success criterion to evaluate, not a reason to invent returns or retrospectively optimize the record.

- Observe unattended early-opportunities-v1 execution and its 30-day follow-up marks. Compare first discovery with subsequent returns, include losers/misses and coverage gaps, and preserve the existing paper control. Daily sample, unvalidated thresholds and shared 50-symbol tracking capacity remain explicit limits.

- Observe the next unattended collection after publication: all six radar channel states, source/quote timestamps and the shared 20-company SEC budget. Track radar-first observation versus later returns prospectively; do not backfill pre-boom discoveries or reinterpret radar rows as paper buys.

- The waiting-period checkpoint is completed in the 30 September review: current entry-aware paper P/L is negative and trails SPY. Current focus is diagnosing the all-picks HRGN pending orders / stale MSC quote, then reviewing repeated-entry concentration and missed-name reasons. Preserve the existing control and history; any strategy change needs a separately versioned forward experiment. Original-idea mapping remains in the completion audit; broader product and profitability are not complete.

- Verify the next scheduled Form 4 duration with the persisted-filing batch lookup. A completed-window live replay now takes 14.718s, but new-day processing may still dominate. Four deferred API orders are confirmed filled; no order-recovery work remains for those rows. Direct cron-job.org history still requires sign-in.

- Track a clean forward cohort after the quote-time repair separately from affected history. Verify scheduled collection preserves market timestamps and outcome coverage advances only after actual quote time reaches each target; do not fabricate or rewrite old measurements. The initial v4 review is completed, not pending.
- Use the Thesis Review Queue through the next stored evidence cycle. When an item becomes due, review its primary source and record the conclusion as a new thesis version; do not automate pass/fail or status changes from free text.
- Observe the accepted API/BW/HIMS v3 gates, published HIMS investment extraction, BW/API dated reconciliation and `scores-v2` / `signals-v3` date guard in subsequent refreshes. Do not substitute partial debt or ordinary shares for a current complete definition.

### NEXT

- Evaluate forward growth-capital-entry-v2 results separately by entry evidence/version while retaining whole-account P/L. The transition is built and activated; no second funded account, retrospective purchases or loss reset. Review effectiveness and capacity exclusions, rather than changing priorities merely to buy AMD.

- **2026-09-30 external-winner audit:** internet-selected winners compared with historical DB evidence. KOD arrived after its jump; GLND/INOD/VKTX were fetched but have zero financial facts and no canonical decisions, explained by the financial-facts inner join. META/INTC are explicitly blacklisted; MRNA lost tier slots or same-collection eligibility. GRML and several event winners have no recorded coverage under checked tickers. See [external review](research/2026-09-30/EXTERNAL_MOVERS.md). Next: investigate existing-source enrichment coverage and evaluate exclusions against user scope before any separately versioned policy change. No new provider, database writes or strategy changes; read-only evidence and source inspection only.


- Review the first v4 names when their stored history and outcome horizons mature, prioritizing falsifiable thesis work for eligible names over changes to the ranking policy based on one cohort.
- Continue CompanyFacts before/after queue observations and Nasdaq daily artifacts; inspect valid samples before changing queue order or adding production listing discovery. The daily budget is now 20; the standalone helper default remains five.

### LATER

- Broaden discovery only when tracked results and research rejection reasons demonstrate a specific gap. The user explicitly authorized broader market-information channels on 30 September; paid subscriptions still require a separate decision.
- Supported Next.js upgrade as a separate tested change; authentication/authorization before public exposure. Public deployment and subscriptions are not the present objective.
- Thesis outcome analysis, portfolio drawdown and business-driver concentration views when the underlying observations and portfolio policy are dependable.
- Runtime schema-creation cleanup and other maintenance as independent slices, preserving the migrated-schema contract and golden-source safeguards.

### Teadlikult mitte praegu

- No opaque combined score, automatic buy/sell recommendation, hindsight exit optimization, new paid data source, options module or mass AI analysis.
- Do not rebuild already completed Catalyst Evidence V2, Discovery Frequency, outcome audit views, Neon cutover, collection locking, Form 4 ingestion or Paper Strategy V1. Their completion evidence remains below.
- A short paper period can validate operations and usability; it cannot establish reliable profits. Preserve failures, unknowns, version boundaries and as-known-at-the-time history.

## Olulised tehnilised ja tooteotsused

- **2026-10-01 early-discovery boundary:** use stored SEC facts and bounded Yahoo chart history; no new provider, schema migration, canonical selection or automatic paper order. Thresholds are explicit unvalidated hypotheses; known missing/split/history failures stay unknown. First discovery is read from versioned successful collection metrics, never retroactively dated. Valid USD follow-up prices require non-future quote/receipt times and receipt after discovery. Shared price tracking remains 50 symbols/day; pending coverage is visible. Pre-revenue/event-driven ideas may be missed by the cash-flow rule and require a distinct future investigation, not a fabricated growth candidate.

- **2026-10-01 coverage boundary:** use six free Yahoo discovery screens with per-channel limits, US exchange/equity/USD validation and explicit stale/missing prices. Persist the versioned radar in collection-run metrics without a schema change. Names with usable prices enter existing company/SEC queues, but radar observations do not bypass canonical collection-item eligibility or paper gates. Paid providers, whole-market coverage, intraday cadence and radar-to-strategy policy changes remain unresolved/deferred. The installed Yahoo screener schema rejects current `canonicalName`; use its supported `validateResult: false` option with our own consumed-field validation and a 15-second per-request timeout.

- **2026-09-10 canonical currentness:** Daily canonical discovery requires a positive `collectionRunId` and filters base-eligible candidates by the linked collection run's immutable `market_data_found` truth before market-cap tier selection. Missing confirmation creates an explicit decision exclusion reason. Manual scanner runs retain their broader stored-universe behavior. Because this changes who may be selected, the discovery version advances from v3 to `rklb-discovery-v4`; old decisions, outcomes and paper orders remain unchanged and analytics must keep versions separate.

- **2026-09-11 paper-execution heartbeat separation:** Paper execution must use a different Healthchecks check and secret from core collection. The workflow pings only after `npm run paper:strategy -- execute` succeeds; default step gating prevents a false healthy ping after execution failure. The heartbeat request is bounded to ten seconds and non-critical because the remote dead-man check itself detects missing pings. Missing configuration is explicit. This changes workflow observability only, not signal, fill, exit, ranking or broker behavior.

- **2026-09-13 deferred execution is a market-session failure:** An app-eligible hypothetical order may remain pending while the market is closed. During an expected New York regular session, any deferred order makes the CLI fail after printing the structured result. This preserves the pending rows for retry, makes the GitHub run red and prevents a healthy dead-man ping. The calendar uses the existing explicit 2026–2028 full-day NYSE holidays and a weekday fallback outside that range; the scheduled 09:35 run is before early closes.

- **2026-09-13 paired execution:** Every paper signal is a two-order cash-flow comparison: one app instrument and one SPY benchmark. The executor fills neither unless both pending rows are present and both current quotes satisfy the existing USD, REGULAR-session and 20-minute rules. Both fills use the same execution timestamp and commit in the same database transaction. An incomplete pair remains pending and visible as an integrity error. Independent marks may still be saved because they value already-open holdings and do not create cash flows.

- **2026-09-10 paper-entry meaning:** `entry_aware` eligible is the app's executable hypothetical buy state. It requires the existing V1 Business thresholds, current collection confirmation and accepted price-history/run-up state; Today labels it explicitly and adds a read-side displayed-price recency guard before showing the positive state. Every failure is `Wait` with reasons. Each eligible canonical day creates a new $100 intent, including a repeated ticker. Repetition is deliberate evidence about the app policy: if it is economically wrong, create a new policy version rather than silently deduplicating execution. The state does not place a broker order and does not replace human thesis, valuation, risk or position-size review.

- **2026-09-09 outcome cohort weighting:** Results are grouped by canonical `model_version` and horizon. Within one cohort, every measured decision return is first averaged by ticker; cohort return, median, hit rate, best/worst and benchmark-excess statistics then weight those ticker averages equally. Decision counts remain visible as operational observation coverage, and distinct ticker counts are the statistical sample coverage. Pending, missing and unavailable decisions remain separate. Manual runs and excluded decisions do not enter cohort results; zero-candidate canonical model versions remain visible instead of disappearing.

- **2026-09-09 thesis review queue:** V1 adds no schema and no scheduled writer. The queue is a separate batched repeatable-read transaction, limited to current non-rejected theses attached to active/watch positions. Due evidence is intentionally narrow: a financial filing stored/filed after the version, a latest decisive/supporting assessment for a new SEC filing, or a passed stored earnings date when no newer financial filing exists. Secondary news cannot create due state. Price change requires matching explicit currencies. Assumption text remains visible but non-computable; saving a new immutable thesis version is the explicit reviewed action.

- **2026-09-09 accepted thesis assumptions:** API v3 remains `ready` with cash-only liquidity until access and reserves justify a broader definition. BW v3 remains `researching` pending positive TTM OCF/company-defined FCF and demonstrable backlog cash conversion. HIMS v3 remains `researching` against 15% long-term growth, roughly 70% gross margin and a roughly 10% normalized FCF-margin hurdle within three years. Each record is linked to the exact price reviewed by the user rather than a newer snapshot that arrived before persistence.

- **2026-09-08 thesis valuation review:** `0010_thesis_valuation_review` adds nullable text fields for revenue, margin, cash-flow, dilution, valuation, downside, reverse valuation and the next review trigger, plus a nullable FK to `price_snapshots`. Existing rows remain valid and are not backfilled. New saves hash the assumptions and price ID as part of the thesis version; the price ID is retained only when it belongs to the position's company. The FK uses `ON DELETE RESTRICT` so referenced market context cannot disappear. These fields are user hypotheses and stay separate from automatic Valuation Evidence. They do not become new `ready` requirements yet, which avoids retroactively invalidating current theses.
- **2026-09-09 Actions runtime versions:** GitHub-hosted workflow steps use actions/checkout@v7, actions/setup-node@v7 and actions/upload-artifact@v6, whose JavaScript actions run on Node 24. This is separate from the application runtime, which remains Node 22. The external workflow_dispatch triggers, permissions, concurrency, timeouts, secrets and application commands are unchanged.

- **2026-09-07 financial inputs:** fallback investment deductions require both `PaymentsToAcquireOtherProductiveAssets` and `PaymentsForSoftware` with matching period and accession. The rounded `PaymentsToAcquireProductiveAssets` total is not added or substituted. FCF joins OCF and deductions only within the same filing and period; the stored expression retains parentheses and provenance. The UI names the deductions and distinguishes application-derived from company-defined FCF. `valuation-evidence-v2` requires cash/debt dates to match and be known, non-future and within the existing 550-day freshness boundary. This is a conservative availability guard, not a claim that debt includes preferred equity or all financing claims. No migration or historical snapshot rewrite.

- **2026-09-07 BW/API balance review:** `balance-review-2026-09-07` is a filing-level application record, not a CompanyFacts alias. It keeps the report and filing dates, component sums, source URLs and exclusions visible for BW/API. It never overwrites automated facts, saved theses, decisions, outcomes or older score snapshots. `scores-v2` withholds the cash/debt component unless the two latest values have the exact same `periodEnd`; `signals-v3` applies the same rule before stating a cash-versus-debt inference. Both versions deliberately produce new current records while preserving the older calculation under its original version.

- **2026-09-09 database target contract:** `DATABASE_URL` is never silently defaulted by the app. `DATABASE_TARGET=golden` requires a Neon hostname, `local` requires `localhost`, `127.0.0.1`, `::1` or Docker host `db`, and `test` requires a `_test` or `_tmp` database name. The check runs before a Pool/Client opens for normal app and CLI paths and reports only host/database metadata. Docker Compose requires the target explicitly; DB-connected GitHub steps pin it to `golden`; both Vitest setup layers pin it to `test`. `_ts-loader` still creates an intentional local pair only when neither URL nor target was supplied. Migration apply retains its separate fail-closed database-name guard and requires `--allow-golden-source` for every non-scratch write.

- **2026-09-08 account transition:** the handover captures configuration names and access requirements but deliberately excludes secrets. New environments must set both `DATABASE_URL` and `DATABASE_TARGET`; the runtime contract now rejects the earlier `.env.local`/`.env` mismatch before connecting. The frozen local `discovery` database remains backup/test infrastructure, never a production target.

- **2026-09-08 NYSE holiday recency:** read-side observation recency allows one elapsed New York trading day. Weekends and the NYSE's explicitly published 2026–2028 full-day holidays add no days; later years and unscheduled closures fall back to the earlier conservative weekday behavior until their dates are deliberately reviewed. The schedule is source-visible and local, so daily collection gains no new network dependency. Early closes do not change the date-level previous-close rule. Existing tracking attempt outcomes and price rows are not rewritten; paper execution's live quote rules are unchanged.

- **2026-09-07 continued tracking:** `0009_price_tracking` adds nullable quote `market_at`, a quote-deduplication index and a separate daily attempt ledger. `captured_at` stays the receipt timestamp; no historical rows are rewritten. Existing Yahoo quotes only, positive finite USD price and the documented one-weekday recency heuristic; closed-market observations are allowed for research. Queue membership is active/watch portfolio status, positive net paper holdings, or canonical unmeasured horizons before target + seven days; SPY is included as benchmark. Fifty symbols per New York day across retries, SPY first then oldest attempt, chunks of eight. A failure consumes that symbol's daily attempt and remains visible until a later attempt. Quotes are collected after the canonical snapshot, before outcome refresh, and never create discovery collection items. Tracked endpoint quotes must reach the outcome's target in both receipt and market time. Frozen decisions, paper eligibility and measured outcomes remain unchanged. Historical note: on 18 September, new measurement eligibility was tightened to require known market time for every source; already-measured legacy outcomes remain immutable.

- **2026-09-06 implementation:** paper quote requests union pending orders with positive net holdings per policy/strategy/book. Read-side valuation requires valid USD marks, the same New York date as SPY and at most 20 minutes of timestamp separation. The original observation recency rule permitted one elapsed New York weekday and excluded only weekends; the 2026-09-08 decision above supersedes that calendar detail. Original execution freshness, discovery v3 and frozen paper-strategy-v1 eligibility remain unchanged. Today timestamps come from each decision's referenced price snapshot, never from a subsequently fetched quote. No migration or historical rewrite.

- **2026-09-06 review clarification:** the initial review changed documentation only; the subsequent implementation is described above. Discovery v3 and paper-strategy-v1 remain unchanged; data-integrity fixes must preserve immutable history or explicitly version changed contracts. The external scheduler remains in place because it is working. The historical blanket claim that GitHub Free/private repositories cannot schedule Actions is not supported by current GitHub documentation; retain the observed earlier failure as an incident, not a platform rule (sources in the review).

- Company detail on DB-first; aeglased live-värskendused toimuvad võimalusel taustal.
- **Write-on-read on teadlik, kuid dokumenteeritud risk.** Mitu GET-vaadet kirjutavad andmebaasi: `/company/[ticker]` ja `/thesis/[positionId]` käivitavad üle kuue tunni vanuse andmestiku korral taustal SEC CompanyFactsi värskenduse (kirjutab `companies` ja `financial_facts`) ning salvestavad score-snapshot'i; `/scanner`, `/watchlist` ja `/daily` salvestavad score-snapshot'e; `/scanner?preset=rklb` salvestab terve `rklb` discovery run'i, `discovery_decisions` read, `catalyst_events` ja `catalyst_assessments`, kuid **alates 2026-08-12 (Provenance samm 1) ei loo enam `candidate_outcomes` ridu** — need tekivad ainult canonical run'idest; `/validation` ja `/backtest` käivitavad `refreshCandidateOutcomes()` (ainult mõõdab olemasolevaid). Lehe avamine ei tohi kunagi olla ainus põhjus, miks andmestik või valim muutub.
- Käsitsi sirvimine võib muuta sisendit, mille järgmine canonical `rklb_daily` run salvestab, kuid ei saa juba salvestatud canonical snapshot'i ümber kirjutada; hilisem sisendimuutus märgitakse `inputChangedAfterCanonicalSnapshot` väljaga.
- Käsitsi `rklb` jooksud **ei loo enam `candidate_outcomes` ridu** (Provenance samm 1, 2026-08-12): `recordDiscoveryRun` loob outcome-read ainult `runType === CANONICAL_RUN_TYPE` korral. Manual jooks säilitab `discovery_runs` + `discovery_decisions` auditi, aga ei tekita forward-mõõtmise ridu ega kasvata valimit. Varasemad manual outcome-read jäävad alles üksiku run'i auditisse ja on koondnäitajatest niikuinii välja filtreeritud (samm 2). UI kuvab endiselt mudeliversiooni ja run type'i jaotust.
- FCF on tuletatud kui OCF miinus capex ning peab olema sellisena märgitud.
- `shares_outstanding` toetab concept alias mappingut: primary `dei:EntityCommonStockSharesOutstanding`, fallback `us-gaap:CommonStockSharesOutstanding`. Fallback käivitub ainult siis, kui primary annab 0 punkti, seega duplikaatridu ei teki ja AAPL/RKLB käitumine jäi muutumatuks. See parandab foreign filer / 20-F juhtumeid (nt API, kelle CompanyFactsis puudub `dei` sektsioon). Absoluutseid per-share valuation arvutusi teadlikult ei lisatud ADR/ADS suhte riski tõttu — dilution YoY % on suhtega-invariantne ja ohutu.
- Score-versioon muutub alati, kui valem või kaalud sisuliselt muutuvad.
- `data-quality-v1` on eraldi kvalitatiivne integrity-kiht: see ei muuda `scores-v1` punkte, Coverage tähendust, järjestust ega kaasamisfiltreid.
- Freshness V1 stale-piir on 550 päeva. Alignment on `good`, kui vähemalt kaks teadaolevat sisendit mahuvad 120 päeva sisse ja flow-period-kind'id pole läbisegi; üle 730 päeva span on `poor`; puuduva võrdlusbaasi korral on olek `unknown`.
- Puuduv metric mõjutab Coverage'it, mitte Alignment'i unknown-period loendurit. Unknown period tähendab olemasolevat sisendit, mille majandusperioodi ei saa tuvastada.
- Perioodivahet näidatakse ainult vähemalt kahe teadaoleva perioodi korral. Ühe sisendi puhul on span `unknown`, mitte 0 päeva, sest üksik fakt ei tõenda joondust.
- Annual, quarter ja YTD flow-sisendite segamine tekitab Alignment `warning` oleku ka sama period-end korral, sest nende väärtused ei kirjelda sama perioodipikkust.
- Growth/Health sortimisel tulevad vähemalt 70 Coverage read enne madala kattega ridu.
- Watchlist kasutab `portfolio_positions.status = 'watch'`, kogust 0 ja ostuhinda 0.
- `collection_runs.status` on append-lifecycle: algseis `running`, terminalseis ainult `success` või `failure`. Sama terminalseisu finalize on idempotentne; success↔failure ümberkirjutus on keelatud. `success` kirjeldab olemasoleva `runCollection()` põhifaasi; teadlikult non-fatal Tradestie/SEC/live-data fallbackid kajastuvad metricutes ega muuda põhifaasi automaatselt failure'iks.
- `data_quality_snapshots` on canonical-only immutable audit: üks rida `discovery_runs.id` kohta, ainult `run_type='rklb_daily'`. Kõik ajaliselt versioonitud allikad piiratakse `run_at`-iga; outcome-tabeleid ei loeta. Otsuseflagid tulevad `discovery_decisions` ja seotud `company_score_snapshots.payload` ridadest. `recordDataQualitySnapshot` tagastab sama versiooni kordusel olemasoleva rea ja keeldub teise versiooniga ajalugu üle kirjutamast.
- Point-in-time piirangud on nähtavad `metrics.limitations` väljal: sektoril pole versiooniajalugu ning `financial_facts` võib sama fact_key rida hiljem restate'ida. Kohene collect-integratsioon külmutab hetkeväärtuse; ajaloolise run'i hilist rebuild/backfilli ei käsitleta sama tugeva tõendina. Seetõttu tänast run #29 ei backfillitud ja outcome/backtest tõlgendus hakkab kvaliteedisnapshot'i osas esimesest järgmisest canonical run'ist.
- Collection metricud on paindlik JSONB, kuid alati objekt ja versiooniga `schemaVersion: 1`; praegune komplekt säilitab capture date'i, scanned/candidates/flagged loendurid, market-data growth/recall/total ja providerite saadud ridade/fallbackide loendurid. Suuri payload'e ega tickeriloendeid ledgerisse ei kopeerita.
- **`scanned` tähendab TOOREID provideri ridu, mitte unikaalseid tickereid.** `fetchApeWisdom` dedupib oma tagastuse (vt allpool), kuid `scanned` ja `providers.apewisdomRows` säilitavad teadlikult toore arvu (`rawRowCount`), et olemasoleva metrika ja UI (`CollectButton`, `/today` „Collection scope", `collect:status`) tähendus ei muutuks tagasiulatuvalt. Unikaalsete ridade arv on eraldi väljal `providers.apewisdomUniqueRows`. Kahe arvu vahe näitab, kui palju provider samas jooksus duplikaate tagastas; `collection_run_items` ridade arv vastab unikaalsete arvule, mitte `scanned`-ile.
- Portfelli `average_buy_price` tähendab ühe aktsia ostuhinda sama väärtpaberi noteerimisvaluutas. Quote currency tuleb `price_snapshots.currency` / `companies.currency` väljast; eri valuutas summasid ei liideta ja FX-kurssi ei oletata.
- Radaris nähtud ticker ja turuandmetega ticker on eri seisundid: `companies` säilitab esimese ka ilma hinnata, `price_snapshots` ainult tegeliku Yahoo/FMP vastuse korral. Recall-ring muudab providerikatte ulatust, mitte discovery-skoori valemit.
- **Form 4 selection policy on versioned ja role-aware.** `form4-insider-selection-v1` ei võrdsusta 10%-owner-only ostu director/officer ostuga: initial insider bucket nõuab director/officer rolli ning 10%-owner flag jääb raw evidence'is eraldi nähtavaks ka multi-role filingul. SEC issuer-name'i eraldiseisev sõna `Fund` ja olemasolevad ETF/ETN/ETP mustrid välistavad mitte-ettevõtted enne 20 issueri cap'i; `Funding` ei ole false positive. Notional on shares × price tuletis, mitte SEC poolt eraldi raporteeritud väärtus. V1 ei loo uut score'i, ei muuda `buildCandidates()` social skoori ega asenda ApeWisdomi.
- **Teadlik launch limitation / Phase 3.5 kandidaat:** insider path'i kaudu esimest korda leitud ettevõtted konkureerivad sama olemasoleva viie katse päevalimiidiga CompanyFactsi enrichment queue's. Run #16 audit korrigeeris varasema umbkaudse 10 päeva hinnangu: 16 insider item'ist 2 (KEEL, GO) olid juba eligible, 14 uncovered rida paiknesid queue positsioonidel 1–12, 15, 16 ning frozen-queue/all-success lower bound oli 4 collection päeva. See ei ole SLA: queue on 120 rida, newest-price-first lubab uutel tulijatel ette hüpata ning unavailable/error ei anna scorable facts'i. Kasutaja eelistus kaldub source-neutral budget increase'i poole, kuid viie katse limiiti ei muudeta enne 7–14 päeva paired read-only observation'it. Audit: [`docs/COMPANYFACTS_QUEUE_AUDIT_2026-08-23.md`](COMPANYFACTS_QUEUE_AUDIT_2026-08-23.md). No-migration mõõtmisplaan: [`docs/COMPANYFACTS_QUEUE_OBSERVATION_PLAN.md`](COMPANYFACTS_QUEUE_OBSERVATION_PLAN.md).
- Insider selectionil ei ole `$10B` market-cap lage. See on teadlik, et näiteks MRNA-suurune `$58–70B` issuer saaks Form 4 path'i kaudu company/price lookupini; canonical known-market-cap `$75B` hard boundary ja 20 insider lookup'i run-cap on ainsad cap-piirid. Social path'i `$10B` filter ei muutu.
- **Social attention threshold on alates 2026-08-22 tõendipõhine esimene eksperiment, mitte lõplik valem.** Nelja eri capture-date'i latest-run valimis andis `MIN_MENTIONS 5 → 3` keskmiselt +24 mitte-blacklistitud eligible tickerit päevas; kolm uuemat päeva jõudsid vana 40+20 lookup-laeni, 2026-08-16 oli 16 eligible tickeriga selge madala tähelepanu erind. Seetõttu on `MIN_MENTIONS = 3`, growth lookup 80 ja recall 20 ehk kogulagi 100. FMP täis-failover'i konservatiivne eelarve on kahe täisjooksu ja SPY korral umbes 202 päringut, alla tasuta 250/päev limiidi. Lävi tuleb 1-2 nädala pärast suurema valimiga uuesti üle mõõta; rankingut, skoorimist ega canonical discovery loogikat ei muudetud.
- `/missed-moves` on tuletatud audit olemasolevatest muutumatutest snapshotidest, mitte uus prediction- ega soovitusmootor. Katvus vaadatakse liikumisele eelnenud kuupäevalt, et sama päeva tagantjärele otsus ei muutuks näiliselt varasemaks teadmiseks.
- ClawLabsAI `free-ai-models` repo kirjeldab tasuta mudelite saadavust; see ei ole uus finantsandmete algallikas. Seda ei ühendata päevasesse collecti ilma eraldi provider/provenance otsuseta.
- Thesis Builder ei esita moat'i, mispricing'ut ega „miks praegu?” välja automaatse faktina; need on kasutaja tõendatavad hüpoteesid.
- Teesi muutmine loob uue versiooni ainult siis, kui sisu või seotud score snapshot muutus.
- Teesi score snapshot'i viide valideeritakse sama ettevõtte vastu; skeemis pole teadlikult hilise tabeliloomise tõttu init-taseme FK-d.
- Score-alert võrdleb ainult järjestikuseid sama mudeliversiooni snapshot'e. Praegune lävi on 10 punkti või komponendi oluline seisundimuutus; see vajab päris ajaloo kasvades kalibreerimist.
- Score-alerti payload säilitab võrreldud snapshot'id, skoorid ja komponendid; dedupe-võti on seotud ettevõtte, positsiooni ja snapshotipaariga.
- „Leia järgmine RKLB” ei kasuta koondskoori. Kaasamine toimub nähtavate baasfiltritega ja järjestus eraldi tõendite tugevuse järgi.
- Catalyst ei ole alates `rklb-discovery-v2`-st kaasamisfilter. Kaasamine sõltub ainult Growthist, Coverage'ist, market cap'ist ja RKLB-välistusest; catalyst evidence tier on järjestuse aste.
- Catalyst evidence kogumisaknad on 90 päeva SEC filing'utele, 30 päeva uudistele ja 3 viimast accession-gruppi avaldatud faktidele. Earnings-kuupäev on ainult `scheduled_window` ja kogumislünga kontroll, mitte tõend.
- `material_new_evidence` nõuab korraga primaarallikat, kvantifitseeritud materiality't, teadaolevat suunda, `new_information` uudsust ja mitte-aegunud seotud perioodi. Pealkiri, administratiivne vorm (nt 4, 144, SCHEDULE 13G) ega planeeritud kuupäev ei kvalifitseeru.
- Materiality drivereid loetakse ainult värsketest ja joondatud sisenditest; rahavoo või kasumi protsentuaalne paranemine loeb ainult siis, kui tase on positiivne. See hoiab PLUG tüüpi false positive'i eemal ja jätab BW materiaalseks.
- Sama evidence tier'i sees eelistatakse tõendi liiki, mitte kuupäeva: värske uudise pealkiri ei tohi varjata sama ettevõtte avaldatud aruande nõrka sisu.
- `rklb-discovery-v1` ja `rklb-discovery-v2` canonical jooksud ei ole üks frequency-seeria. Persistence-arvestus algab v2 esimesest canonical run'ist (#17, 2026-08-12).
- Aus backtest algab alles pärast idempotentse discovery run'i ja tickeritaseme otsusesnapshot'i salvestamist.
- Discovery run'i idempotentsusvõti on `mudeliversioon + Tallinna otsusekuupäev + kogu otsusesisendi räsi`; see hoiab kordusjooksu stabiilsena, kuid lubab uue faktiseisu samal päeval eraldi salvestada.
- Automaatne canonical jooks peab kasutama eristatavat `run_type = 'rklb_daily'` väärtust; käsitsi scanneri avamised jäävad auditi jaoks `rklb` jooksudeks, kuid frequency arvestusse lähevad ainult canonical päevajooksud.
- Discovery frequency ei loe tooreid leheavamisi. Ühe Tallinna kuupäeva ja mudeliversiooni kohta peab olema üks canonical päevane vaatlus, et korduv käsitsi refresh ei kasvataks streak'i.
- Frequency on persistence-signaal, mitte kvaliteedi- ega ostuskoor. Viis päeva sama muutumatu evidence'iga peab olema eristatav viiest päevast, mille jooksul lisandus teesi toetavat uut infot.
- Canonical-only aggregation layer on Tase 0 read-side filter (`CANONICAL_RUN_TYPE = 'rklb_daily'` failis `src/lib/discovery-validation.ts`): `/validation`, `/backtest` ja `/frequency` koondnäitajad liituvad `discovery_runs`-ile ja piirduvad canonical run'idega. Skeemi ei muudetud, `counts_for_stats` veergu ei lisatud, ajaloolisi outcome'e ei backfillitud ega kustutatud; klassifikatsioon on puhas tuletus olemasolevast `run_type`-st. Üksiku run'i detail ja provenance-jaotus kuvavad endiselt kõiki run'e (audit).
- Discovery Frequency V1 pure tuum `computeDiscoveryFrequency` (`src/lib/discovery-frequency.ts`) on DB-vaba ja deterministlikult testitud; DB-lugeja `getDiscoveryFrequencyDashboard` piirdub `run_type = 'rklb_daily'` ja jooksva `DISCOVERY_MODEL_VERSION`-iga ning võtab decision_date kohta ühe run'i (suurim runId). Persistence stale/evolving tuletatakse kaasamiste evidence-sõrmejäljest (growth/health/coverage + catalyst evidence tier/status + linked period end); rank ei kuulu sõrmejälge, seega rank'i muutus ei tee püsivat evidence'i „uueks”.
- Under-recognition Evidence V0 on kompositsiooni-evidence-kiht, **mitte skoor ega ranking**. `src/lib/under-recognition.ts` `calculateUnderRecognitionEvidence` on puhas ja DB-vaba (ainult `import type`), adapter `buildUnderRecognitionEvidence` loeb olemasolevate kihtide väljundit. Olek on üks viiest tekstist, mitte protsent. `meaningful` nõuab KORRAGA: tähelepanu-lõhet (madal analyst kate või väike sector-relative cap) JA paranevat tõendit (material catalyst või Growth ≥ 65) JA usaldusväärset andmet (alignment ei ole `poor`, freshness ei ole `stale`) JA Health ≥ 40 (ellujäämisrisk puudub). `no_attention_gap` on terminaalne (kõrge tähelepanu → edge't pole, tuleb enne `low_confidence't`). Läved (analyst ≤3, cap percentiil ≤40, Growth ≥65, Health ≥40) on läbipaistvad heuristikad, mitte tõestatud valem. Ei muuda Growth, Health, Coverage, Catalyst, Valuation ega Frequency loogikat.
- Valuation Evidence V1 on evidence-kiht, **mitte Valuation Score**. `src/lib/valuation-evidence.ts` `calculateValuationEvidence` on puhas ja DB-vaba; adapter `buildValuationEvidence` kujundab olemasoleva `CompanyFinancialSummary` + market cap ümber. Iga ankur on üks suhtarv (unit `x` või `%`) või `unknown` — koondskoori, kaalutud summat ega buy/sell soovitust ei arvutata. Flow annualiseeritakse ausalt märgistatud alusega (aastane või kvartalist ×4; YTD/instant ei annualiseeru → `insufficient_data`); kvartalist annualiseerimine langetab confidence'i vähemalt medium'ini. Confidence tuletatakse sama läve-loogikaga nagu Data Freshness + Period Alignment (`STALE_FACT_DAYS`, `GOOD/POOR_ALIGNMENT_SPAN_DAYS`), seega aegunud/joondamata sisend annab madala usalduse (nt BW stale debt). Valuation Evidence ei muuda Growth, Health, Coverage, Catalyst ega Frequency loogikat.
- Outcome baseline on otsusehetke hind. Horisondi vaatlusaken on sihtaeg kuni sihtaeg + 7 päeva; juba `measured` tulemust ei muudeta ka siis, kui ajalukku lisatakse hiljem varasem hinnasnapshot.
- Validationi keskmised, mediaanid ja hit rate arvutatakse iga horisondi jaoks eraldi.
- Backtest V1 fikseeritud benchmark on `SPY`. Benchmark'i hind kogutakse sama olemasoleva Yahoo/FMP hinnakihiga; uut välist allikat ega võtit ei lisatud.
- Benchmark'i alguspunkt on viimane salvestatud SPY hind run'i ajal või kuni seitse päeva enne run'i. Lõpp-punkt on esimene SPY hind outcome'i sihtajal või järgneva seitsme päeva jooksul.
- Excess return arvutatakse ainult siis, kui candidate ja benchmark return on mõlemad teada. `NULL` ei teisendata 0%-ks.
- Backtesti päringud loevad ainult salvestatud otsuseid; `getRklbDiscoveryCandidates` ega tänane kaasamisloogika ei osale ajaloolise statistika arvutamises.
- Sector/industry pärineb ainult olemasoleva Yahoo provider'i `assetProfile` moodulist ja salvestub koos allikaga; puuduv klassifikatsioon jääb `unknown` olekusse.
- Sector-relative grupp sisaldab ainult sama `scoring_version` täieliku Growth, Health ja Coverage snapshotiga ettevõtteid. Percentile on tie-adjusted rank ning minimaalne grupi suurus on 5.
- Industry gruppi eelistatakse, kui sellel on vähemalt viis võrreldavat ettevõtet; vastasel juhul kasutatakse piisavat sector gruppi. Kui kumbki pole piisav, kuvatakse ainult grupi nimi ja count, mitte percentile.
- Sector-relative väärtused fikseeritakse ainult uue discovery decision'i INSERT-i ajal; varasemate run'ide read jäävad muutmata.
- Git on koodi tõeallikas; `.env` ja PostgreSQL volume on masinapõhised.
- Kodu- ja tööarvuti PostgreSQL volume'id ei sünkroniseeru Gitiga. Päris forward-validation vajab üht keskset DB-d; tööarvutit ei kasutata vaikimisi isikliku scheduleri ega canonical DB hostina.
- Uusi API-võtmeid ei otsita jagatud võtmete saitidelt ega lisata ainult andmehulga pärast. Kõigepealt dokumenteeritakse konkreetne andmelünk, olemasoleva provider'i katvus ja uus allikas; võti luuakse ainult provider'i ametlikul lehel ning hoitakse `.env`/GitHub Secretsis.
- Collector peab olema käivitatav UI-st sõltumatu job'ina. Avalik `/api/collect` endpoint ei ole canonical scheduler'i eeltingimus.
- `ensureSchema()` (`src/lib/db.ts`) loob 20 tabelit; `financial_enrichment_status` luuakse ainult eraldi `company-financials.ts` kihis ning `financial_facts` on **kahe skeemiomanikuga** (mõlemas failis oma `CREATE TABLE IF NOT EXISTS`). See seis on nüüd karakteriseeriva testiga lukustatud (`tests/db/infra-smoke.test.ts`), seega TOP 9 versioonitud migratsioonidele üleminek on mõõdetav, mitte oletatav: kui tabelikomplekt muutub, peab test muutuma teadlikult.
- **Arhitektuurireegel: `SCORE_VERSION`-i tõstmine on kohustuslik, kui skoorivalem või kaalud muutuvad.** `SCORE_VERSION` on osa snapshot'i `input_hash` loogikast (`src/lib/score-tracking.ts`), seega valemi muutmine ilma versiooni tõstmata annab sama hash'i ja `ON CONFLICT` tabab olemasolevat rida: `payload` uueneb, aga `growth_score` / `health_score` / `coverage_score` veerud jäävad vanaks, sest need ei ole `SET` nimekirjas. Tulemus on sisemiselt vastuoluline snapshot, kus veerud ja payload räägivad eri skoorist. Karakteriseeriv test `tests/db/score-snapshot.test.ts` dokumenteerib selle tagajärje; päris faktimuutus seda seisu ei tekita, sest `yearOverYearPercent` on tuletatud `input_hash`-i kuuluvatest väärtustest.
- **Enrichment retry-aknad on asümmeetrilised ja see on teadlik.** `financialEnrichmentQueue` (`src/lib/company-financials.ts:560-573`) koosneb kahest OR-harust. Kui ettevõttel **ei ole fakte üldse**, kehtib staatusepõhine retry: `error` proovitakse uuesti pärast 1 päeva, `unavailable` alles pärast 30 päeva. Kui faktid **on olemas, aga stale ehk üle 7 päeva vanad**, siis teine OR-haru `status`-t üldse ei kontrolli ja nõuab ainult 1-päevast cooldown'i — seetõttu võib faktidega `unavailable` ettevõte uuesti proovida juba 1 päeva järel. 30-päevane `unavailable` aken kaitseb ainult neid ettevõtteid, kelle kohta SEC ei ole kunagi skooritavaid fakte andnud. Mõlemad harud on nüüd testiga lukustatud (`tests/db/enrichment-budget.test.ts`).
- **Enrichment-eelarve on Tallinna kalendripäeva põhine, mitte 24-tunnine liuguraken.** Aken arvutatakse andmebaasis: `date_trunc('day', now() AT TIME ZONE 'Europe/Tallinn')` (`src/lib/company-financials.ts:585-594`). Eelmise Tallinna päeva katsed ei kuluta tänast eelarvet ka siis, kui neist on möödunud vähem kui 24 tundi. See on lukustatud testidega E2.5/E2.6 (`tests/db/enrichment-budget.test.ts`).

- **`toDateOnly()` loeb Date objektilt kalendripäeva LOKAALSETE akcessoritega ja seda ei tohi „parandada" UTC-le.** pg-types parsib PostgreSQL `DATE` (typeId 1082) **lokaalseks kesköökes**, mitte UTC kesköökes. Seetõttu annab `toISOString()` või `getUTC*` päeva võrra vale tulemuse igas positiivse UTC-nihkega ajavööndis. Mõõdetud kuues tsoonis golden-source andmetega: lokaalsed akcessorid 3/3 õiged kõigis (UTC, Europe/Tallinn, America/New_York, Asia/Tokyo, Pacific/Kiritimati, America/Sao_Paulo), `toISOString()` ja `getUTC*` mõlemad 0/3 Tallinnas, Tokyos ja Kiritimatis. Lokaalne lugemine on ajavööndist sõltumatu, sest pg konstrueerib väärtuse ja me loeme selle samast lokaalsest raamist. Lukustatud testidega `tests/unit/data-boundaries.test.ts`.

- **„Tallinna kalendripäeva" loogika on kõikjal EKSPLITSIITNE, mitte süsteemi lokaadist sõltuv.** Mõõdetud 2026-08-19 kogu `src/`, `scripts/` ja `tests/` ulatuses. Kolm kategooriat:
  - **JS `Intl.DateTimeFormat` koos `timeZone: 'Europe/Tallinn'`** — süsteemi TZ ei loe: `collect.ts:31-38` `today()` (annab `captureDate`), `discovery-validation.ts:157-164` `tallinnDate()` (annab canonical `decision_date` ja `run_key`), `today-brief.ts:269`, `outcome-coverage.ts:78` ning UI-s `today/page.tsx:50,55`, `QualityTables.tsx:16`, `AuditTables.tsx:8`, `CoverageTables.tsx:12`.
  - **SQL `AT TIME ZONE 'Europe/Tallinn'`** — arvutus toimub serveris, Node'i TZ ei loe: `company-financials.ts:590` (enrichmenti päevaeelarve), `missed-moves.ts:48,53,60,100`, `scanner.ts:98-99`, `scripts/collect-daily.cjs:41,43`, `scripts/collect-status.cjs:44,46`, `tests/fixtures/enrichment.ts:27`.
  - **Lokaalsed akcessorid, mis on tõestatult TZ-sõltumatud** — `date-only.ts:20-23` `localDateOnly()`. See loeb pg `DATE` objekti, mille pg-types konstrueerib lokaalseks kesköökes; konstrueerimine ja lugemine kasutavad sama raami ja taanduvad. Vt F1 otsust ülalpool.
- **`TZ` keskkonnamuutuja pinnimine ei ole korrektsuse eeltingimus, kuid on nüüd igal pool järjekindel.** `docker-compose.yml:32` (app) ja `:61` (scheduler) seadsid selle juba varem; 2026-08-19 lisandus `ENV TZ=Europe/Tallinn` ka `Dockerfile:8` ja `scheduler/Dockerfile:3`, et image oleks iseseisvalt korrektne ka compose'ist mööda ehitades. Kontrollitud `docker run`-iga ilma compose'i: mõlemas image'is `resolved TZ: Europe/Tallinn`, ja päevapiiri juhtum (21:00Z) annab õigesti `2026-08-18`. `db` teenust TZ-iga **ei pinnita teadlikult** — Postgres jookseb UTC-s ja `DATE` väljund ei sõltu `TimeZone` GUC-ist (mõõdetud viies sessiooni-tsoonis).
- **Windowsi hosti CLI (`scripts/collect-daily.cjs` Task Scheduleri kaudu) ei ole TZ-pinnitud ja seda ei ole vaja pinnida.** Docker ENV mehhanism siin ei kehti, aga ükski selle tee kalendripäeva-arvutus ei sõltu süsteemi TZ-ist: `today()` ja `tallinnDate()` on eksplitsiitne `Intl`, CLI enda päringud kasutavad SQL `AT TIME ZONE`. Empiiriline tõend: kogu testikomplekt läbib **301/301 ka `TZ=America/New_York`** all (negatiivne nihe on ainus koht, kus lokaalse aja eeldus katki läheks). Windows Task Scheduleri jaoks eraldi TZ-mehhanismi **ei loodud** — see oleks spekulatiivne kaitse olukorra vastu, mida ei ole tuvastatud.
- **Üks teadlikult muutmata implitsiitne sõltuvus:** `src/app/daily/page.tsx:122` kasutab `eventAt.toLocaleDateString('et-EE')` ilma eksplitsiitse `timeZone`'ita. See on server component, seega jookseb app-konteineris, kus TZ on pinnitud. Tagajärg on piiratud: tulemus läheb `alerts.detail` **kuvatekstiks**, mitte otsusevõtmeks ega join-võtmeks. Vale TZ annaks kosmeetiliselt nihkes kuupäeva alert'i tekstis, mitte andmete terviklikkuse vea. Ei muudetud, sest see oleks spekulatiivne muudatus.
- **Golden source on Neon, mitte enam lokaalne Docker Postgres — see on cutover, mitte paralleelne seadistus.** Otsustatud ja tehtud 2026-08-19. Üks autoriteetne DB kaotab kahe arvuti ajaloo lahknemise ja lubab arvutitest sõltumatut schedulerit; see oli varem „avatud sõltuvus" ja on nüüd suletud. Reeglid, mida tulevane sessioon EI tohi tagasi pöörata:
  - **Päris `collect:daily` sihib ainult Neoni.** `DATABASE_URL` failis `.env` osutab Neonile; `scripts/collect-daily.cjs` teeb `loadEnv()` ja `ensureLocalDatabaseUrl()` ei kirjuta olemasolevat väärtust üle, seega ka Windows Task Scheduler sihib Neoni **ilma ülesande enda muutmiseta**.
  - **Lokaalne `discovery` baas on külmutatud.** Ei collect'i, ei backfilli, ei migratsiooni. Ta on ajalooline snapshot ja taastepunkt seisuga `collection_runs` #8 / `discovery_runs` #34.
  - **Lokaalne Docker DB jääb siiski püsti** — `tests/setup/global-setup.ts` vajab `discovery_test` baasi loomiseks/kustutamiseks töötavat lokaalset Postgresit. Testid ei sihi ega tohi sihtida Neoni.
  - **Migratsioonid kuuluvad Neoni.** `db/migrations/README.md:76` hoiatus parandatud samas commit'is: varem nõudis see apply'd „AINULT koduarvuti golden source DB vastu", mis suunaks nüüd külmutatud baasi.
  - **Runneri sihtbaasi kaitse on nüüd FAIL-CLOSED (parandatud 2026-08-20).** Cutover pööras vana nimekirja-põhise guardi tagurpidi; parandus ja põhjendus on eraldi otsusena kirjas allpool.


- **Migration runneri sihtbaasi kaitse on FAIL-CLOSED, mitte kaitstud nimede nimekiri.** Otsustatud ja tehtud 2026-08-20. Apply on ilma eksplitsiitse kinnituseta lubatud AINULT baasi, mille nimi lõpeb `_test` või `_tmp`-ga (`SCRATCH_DATABASE_PATTERN` failis `scripts/migrate.cjs`); kõik muu nõuab `--allow-golden-source`.
  - **Miks polaarsus pöörati.** Vana guard oli `dbName === 'discovery'` ehk default-allow: iga baas, mida nimekirjas ei olnud, oli vaikimisi migreeritav. Nimi oli proxy tähenduse „siin on päris andmed" jaoks ja see proxy purunes, kui golden source liikus Neoni ja sai nime `neondb` — kaitstud jäi ainult külmutatud koopia, päris baas jäi lahti. Fail-closed ei saa ümbernimetamisest (Neoni branch, uus projekt, uus host) vaikselt katki minna.
  - **Miks mitte `.env`-i „see ON golden source" marker.** Marker oleks nimekirjast parem, aga tal on uus vaikne rikkeviis: seadmata või vananenud marker langetab guardi tagasi default-allow'sse, täpselt nagu enne. Fail-closed ei sõltu ühestki konfiguratsioonist, mille unustamine kaitse maha võtab. Lisaks on `.env` `DATABASE_URL` juba golden source'i deklaratsioon — eraldi marker dubleeriks tõe kahte kohta.
  - **Hosti nime guardis EI kasutata.** Neoni endpoint oleks jälle konkreetne identifikaator, mis järgmisel branch'i- või projektivahetusel aegub. Fail-closed katab iga hosti ilma seda teadmata.
  - **Külmutatud lokaalne `discovery` jääb kaitstuks.** Teadlik otsus: see on ainus cutover-eelse ajaloo koopia ja taastepunkt, seega kaotus on pöördumatu. Fail-closed juures ei vaja see erireeglit — ta lihtsalt ei ole `_test`/`_tmp`.
  - **Kutsekoht ei muutunud:** kaitse rakendub endiselt alles apply-teel, seega `--status` / `--preflight` / `--conformance` töötavad edasi ka kaitstud baasi vastu. `runConformance` ei läbi guardi, sest ta rakendab SQL-i otse oma ajutisse `schema_conformance_diff_tmp` baasi.
  - Lipp `--allow-discovery` on ümber nimetatud `--allow-golden-source`-iks. Vana lipu kirjutamine on ohutu: seda ignoreeritakse, guard keeldub ja veateade nimetab õige lipu. Enne 2026-08-20 tehtud sessioonilogi kirjed nimetavad vana lippu — need on ausad ajaloolised kirjed sellest, mis tookord jooksis.
- **GitHub Actions workflow'l `collect-daily` EI OLE `schedule:` trigerit ja see on teadlik otsus.** See repo on privaatne GitHubi tasuta astmes, kus GitHubi enda cron ei käivitu, seega `schedule:` plokk ei tooks kadentsi juurde, küll aga jätaks eksliku mulje, et workflow ajastab end ise. Ajastus tuleb **väljastpoolt** ja on alates 2026-08-20 seadistatud: `cron-job.org` (tasuta tier) kutsub iga päev **08:10 Europe/Tallinn** `workflow_dispatch` endpointi, autentides fine-grained PAT-iga, mille skoop on ainult selle repo Actions (read/write). Kogu Next.js rakendust selleks **ei avalikustata** — collector CLI jookseb runneril otse DB vastu.
  - Workflow mapib neli secret'i, millest kolm on praegu seadistatud. `FMP_API_KEY` on **valikuline varutee** (`collect.ts:104`, `backtest.ts:97-98`) ja seda ei ole ka `.env`-is; puuduv secret laheneb tühjaks stringiks ning kood läheb Yahoo teed, täpselt nagu lokaalselt.
  - Valikuline `HEALTHCHECKS_PING_URL` on seatud nii lokaalses `.env`-is kui GitHub Actionsi repository secret'is. Lokaalne päris CLI jooks tõestas success-pingi; automated workflow kasutab sama väärtust pärast heartbeat-koodi push'i.
  - `dry_run` boolean input laseb workflow'd kontrollida ilma ridu kirjutamata (`collect:daily -- --dry-run`). API kaudu ilma input'ita käivitades on vaikeväärtus `false` ehk päris jooks, seega väline cron ei pea midagi saatma.
  - Healthchecks heartbeat elab teadlikult ainult `scripts/collect-daily.cjs` lõpus, mitte HTTP route'is ega cron-job.org dispatch'i poolel. GET saadetakse ainult null-veaga jooksul, kui canonical funktsioon andis run'i ja järelpäring kinnitab tänase Tallinna päeva `rklb_daily` run'i olemasolu; nii uus kui idempotentselt taaskasutatud run kvalifitseerub. Dry-run, advisory-locki varajane väljumine, sammuviga või puuduv canonical run ei pingi. Pingi enda võrgutõrge logib hoiatuse ja jätab collection exit-koodi edukaks.
  - Runneril `.env` faili ei ole, seega `loadEnv()` (`scripts/_ts-loader.cjs:34`) väljub kohe ja workflow env on ainus allikas. Eraldi fail-fast samm katkestab valjult, kui `NEON_DATABASE_URL` on tühi — muidu langeks `ensureLocalDatabaseUrl()` vaikselt tagasi `localhost:5433`-le, mida runneril ei ole, ja puuduv secret näeks välja nagu arusaamatu ühendusviga.

## Avatud sõltuvused ja otsused

Current as of 2026-09-13; earlier calibration observations and superseded plans are preserved in dated session entries and supporting design documents.

- Outcome sample coverage and maturity remain insufficient for a strategy conclusion. Canonical v3 has 16 measured one-week decisions across six distinct tickers; repeated decisions are correlated observations, and prior versions and later horizons remain separate.
- Historical prices must not be invented or silently backfilled. Reusing existing paper marks for outcome measurement requires a provenance and immutability design before implementation.
- Capital, risk tolerance, concentration limits and intended holding period remain necessary only for a future finite-cash portfolio-policy experiment. They are not inputs to the current equal-$100 signal-quality comparison.
- CompanyFacts daily budget remains five, and MIN_MENTIONS remains three. Inspect accumulated observations before retuning either.
- Nasdaq listing observation is implemented but is not production discovery. Its latest artifact series was not reviewed in this session.
- Authentication/authorization and supported Next.js remain prerequisites for any public deployment. Automated tests, versioned migrations and API/CLI advisory locking already exist; they are not unbuilt blockers.
- Neon remains the sole canonical database. Host `.env.local` still targets the frozen local discovery database as an intentional mismatch case; normal startup now rejects it when the declared target is `golden`. Docker pins the app to the validated Neon target, and tests use only the isolated local `discovery_test` database.
- Core collection and paper execution each have their own active Healthchecks heartbeat. The paper check is tied to the post-success executor step through its dedicated GitHub secret; manual run #13 provided the first live-ping proof. Manual run #15 proved the guard commit's closed-market success path and follow-on heartbeat with 34 retryable deferrals. Its first 09:35 market-session run is still required to prove live fills or, if any remain deferred, the red-run/withheld-heartbeat path. Registered filing persistence does not prove historical EDGAR completeness. Fine-grained scheduler PAT expiry remains recorded as 2027-08-20.
- Benchmark for current experiments is SPY. Sector benchmarks, business-driver concentration and a finite-cash paper policy are separate possible improvements, not changes made here.
- financial_facts write-flow provenance and non-versioned sector/restatement limitations remain open. Existing immutable snapshots must not be reinterpreted as stronger historical evidence than they contain.

## Käivitamine uues arvutis

```bash
git clone https://github.com/mnoormets/stock-discovery.git
cd stock-discovery
git pull origin main
```

`.env` ei tule GitHubist ega liigu setup-skriptiga teisest arvutist. Turvalisem on kummaski arvutis luua eraldi lokaalne fail:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-local-env.ps1
```

Skript küsib SEC User-Agenti, genereerib uue juhusliku `CRON_SECRET` väärtuse ega kirjuta olemasolevat `.env` faili üle. Vajalikud on vähemalt:

- `CRON_SECRET`;
- korrektne kontaktiga `SEC_USER_AGENT`.

`CRON_SECRET` ei pea kodu- ja tööarvutis sama olema. `SEC_USER_AGENT` ei ole salajane võti ja võib mõlemas masinas sama olla. `FMP_API_KEY` on valikuline.

GitHub ei sisalda kohalikku Dockeri `db_data` volume'it. Sama portfelli, Watchlisti, teese ja score-ajalugu vajavad DB dump'i, mida ei tohi reposse commit'ida:

```bash
docker compose exec -T db pg_dump -U discovery -d discovery -Fc -f /tmp/stock-discovery.dump
docker compose cp db:/tmp/stock-discovery.dump ./stock-discovery.dump
```

Taastamine teises arvutis:

```bash
docker compose cp ./stock-discovery.dump db:/tmp/stock-discovery.dump
docker compose exec -T db pg_restore -U discovery -d discovery --clean --if-exists /tmp/stock-discovery.dump
```

`*.dump` ja `*.backup` on `.gitignore` failis, sest varukoopia võib sisaldada isiklikke portfelliandmeid ja investeerimisteese.

Kahe arvuti tööreegel:

- enne arvuti vahetamist lõpeta koodimuudatused, uuenda master-dokumenti, commit'i ja pushi;
- teises arvutis tee `git pull` enne töö alustamist;
- kummalgi arvutil on oma `.env`;
- sama andmebaasiseisu vajadusel ekspordi aktiivsest arvutist värske dump ja taasta see teises;
- ära muuda samaaegselt mõlemas lokaalses DB-s portfelli või teese.

Käivita:

```bash
docker compose up --build -d
```

See toob üles ainult `db` ja `app`. **Dockeri `scheduler` teenus ei käivitu
vaikimisi** — ta on `profiles: ["scheduler"]` taga, sest päevast kadentsi tagab
cron-job.org → GitHub Actions ahel. Kui teda on mingil põhjusel siiski vaja:

```bash
docker compose --profile scheduler up -d
```

Ava <http://localhost:3005>.

Kvaliteedikontroll:

```bash
npm run lint
npm run typecheck
npm run qa:data-quality
npm run build
```

`npm run check` käivitab sama järjekorra ühe käsuga.

### Skeem värskes andmebaasis

Värske Dockeri volume'i korral jookseb `db/init.sql` (19 tabelit) ja `ensureSchema()` lisab ülejäänu app'i esimesel kasutusel — rakendus töötab, aga `schema_migrations` raamatupidamine ja `investment_theses` status CHECK jäävad puudu. Korrektne järjekord on seetõttu:

```bash
docker compose up -d db
```

```bash
npm run migrate -- --preflight
```

```bash
npm run migrate
```

Sihtbaasi kaitse on fail-closed: iga baas, mille nimi ei lõpe `_test` / `_tmp`-ga (sh Neoni golden source `neondb`), nõuab `--allow-golden-source` — vt [`db/migrations/README.md`](../db/migrations/README.md) täielikku runbook'i koos backup-nõudega. Mõõdetud 2026-08-13: init.sql-ist ehitatud baas + `0001_baseline` annab `--conformance VASTAB`, seega need kaks teed koonduvad.

## Lokaalne päevane collect (CLI)

Lokaalne alternatiiv Dockeri `scheduler` teenusele, mis töötab ainult siis, kui kogu stack on 08:00 Tallinna aja seisuga püsti. CLI kutsub **täpselt sama ahelat nagu `/api/collect`** (`runCollection` → SPY benchmark → SEC enrichment → classification enrichment → canonical discovery → `refreshCandidateOutcomes`) ega dubleeri ärilogikat. Vajab ainult töötavat DB-d (`docker compose up -d db`).

```bash
npm run collect:status
```

```bash
npm run collect:daily -- --dry-run
```

```bash
npm run collect:daily
```

- `collect:status` on **ainult lugev** eligibility-raport (canonical run'id, included otsused ilma outcome'ita, pending/measurable/measured/missing, SPY kate, SEC kate).
- `--dry-run` on **konservatiivne**: teeb preflight'i ja näitab plaani, kuid **ei kutsu ühtegi kirjutavat funktsiooni** — ridu ei lisata.
- Kogu job on kaitstud Postgres **advisory lock**'iga (`pg_try_advisory_lock`): teine samaaegne collect lõpetab puhtalt, ilma teist jooksu alustamata.
- **Idempotentne:** sama Tallinna päeva teine jooks taaskasutab canonical run'i (`runReused`), ei loo teist canonical `discovery_run`'i ega dubleeri `candidate_outcomes` ridu.

Windows Task Scheduler — **registreeritud koduarvutil 2026-08-13**, ülesande nimi `StockDiscoveryDailyCollect`, iga päev 08:05, logi `C:\sd-logs\collect.log`.

Kasuta `Register-ScheduledTask`, **mitte** `schtasks /TR` inline-käsku: viimane rikub jutumärkide käsitluse ja logimise ära. Töötav retsept (kohanda `$nodeBin` enda paigalduse järgi):

```powershell
New-Item -ItemType Directory -Force C:\sd-logs | Out-Null
$repo = 'D:\stock-discovery'
$log = 'C:\sd-logs\collect.log'
$nodeBin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64"

$arg = @"
-NoProfile -ExecutionPolicy Bypass -Command "`$ErrorActionPreference='Continue'; Start-Transcript -Path '$log' -Append; Set-Location '$repo'; `$env:PATH='$nodeBin;' + `$env:PATH; docker compose up -d db; npm run collect:daily; `$c=`$LASTEXITCODE; Stop-Transcript; exit `$c"
"@

$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $repo

# KAKS trigerit. Ainult päevane 08:05 nõuaks, et masin oleks just siis sisse
# logitud; sisselogimise trigger tähendab, et piisab arvuti kasutamisest
# ükskõik mis kellaajal sel päeval.
$daily = New-ScheduledTaskTrigger -Daily -At 08:05
$logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$logon.Delay = 'PT5M'   # anna Docker Desktopile aega käivituda
$trg = @($daily, $logon)
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew -RestartInterval (New-TimeSpan -Minutes 10) -RestartCount 3
$prn = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'StockDiscoveryDailyCollect' -Action $act -Trigger $trg -Settings $set -Principal $prn -Description 'Daily stock-discovery canonical collect on golden-source DB' -Force
```

Miks just nii:

- **`$env:PATH` prepend käsu sees** — ülesanne ei sõltu sellest, kas winget'i PATH-muudatus on protsessi pärandunud.
- **`docker compose up -d db` enne collecti** — kui DB konteiner on maas, tõstab ülesanne selle ise üles. `restart: unless-stopped` katab Docker Desktopi taaskäivituse, aga mitte olukorda, kus konteiner on käsitsi peatatud.
- **`Start-Transcript`** — kogu väljund läheb faili; ilma selleta ei ole ajastatud jooksul mingit jälge.
- **`-LogonType Interactive`** — Docker Desktop **vajab** sisselogitud sessiooni. „Run whether user is logged on or not" annaks garanteeritud ebaõnnestumise.
- **`-StartWhenAvailable`** — vahelejäänud jooks tehakse ärkamisel järele. See on ainuke põhjus, miks see lahendus on parem kui compose `scheduler` (node-cron ei tee järele).
- **`-AllowStartIfOnBatteries` + `-DontStopIfGoingOnBatteries`** — Windows ei käivita vaikimisi ülesannet akutoitel; sülearvutil oleks see vaikne päevatapja.
- **`-RestartInterval 10 min` + `-RestartCount 3`** — katab konkreetse augu, mida `-StartWhenAvailable` EI kata: kui masin buutis 08:04 ja ülesanne käivitub ajal, mil Docker Desktop veel initsialiseerub, kukub `docker compose up -d db` ja päev kaoks vaikselt. `-StartWhenAvailable` teeb järele ainult **vahelejäänud trigeri**, mitte ebaõnnestunud jooksu. Kolm katset 10-minutise vahega annab Dockerile ~30 minutit. Kordused on ohutud: canonical run on Tallinna päeva kohta idempotentne ja advisory lock väldib kattuvaid jookse.
- **Sisselogimise trigger (`-AtLogOn`, 5 min viivitus)** — see on kõige olulisem kaitse väljalülitatud masina vastu. Ainult päevane 08:05 nõuaks, et arvuti oleks just sel hetkel sisse logitud; sisselogimise trigeriga piisab, et sa mingil hetkel sel päeval arvutit üldse kasutad.
- **`-WakeToRun` on teadlikult VÄLJAS** — magav masin ei ärka 08:05 ajaks. Jooks tehakse ärkamisel/sisselogimisel järele. Kui tahad garanteeritud hommikust kadentsi, lisa `-WakeToRun`, aga arvesta, et Windowsi toitesätted võivad wake-timerid akutoitel niikuinii keelata.

**Mis juhtub, kui arvuti on 08:05 ajal väljas.** `-StartWhenAvailable` + sisselogimise trigger taastavad **ülesande**, mitte **päevad**. Kui masin on kolm päeva väljas, saad naastes **ühe** jooksu — selle päeva canonical run'i. Kolm vahelejäänud päeva on **jäädavalt kadunud**, sest `run_key` on Tallinna kuupäev ja retrospektiivne konstrueerimine on teadlikult keelatud (vt „Backtesti kuupäeval `t`…" reeglit). Ainus lahendus, mis kadentsi arvutist sõltumatuks teeb, on keskne DB + pilve-scheduler.

**Mitu jooksu samal päeval on tõestatult kahjutud** (mõõdetud 2026-08-13, kolm jooksu):

| Kiht | Teine jooks samal Tallinna päeval |
|---|---|
| canonical `discovery_runs` | `runReused JAH`, loend muutumatu (3 → 3) |
| `discovery_decisions` | muutumatu (209 → 209) |
| `candidate_outcomes` | muutumatu (255 → 255) |
| SEC enrichment | `attempted 0`, `dailyRemaining 0` — Tallinna päevaeelarve on juba kulutatud |
| **klassifikatsiooni enrichment** | **kuni 5 ettevõtet juurde** — sellel kihil EI ole päevaeelarvet (`DAILY_CLASSIFICATION_ENRICHMENT_LIMIT` on per-call, mitte per-päev) |
| `price_snapshots` | mõni rida juurde (5-min dedupe piirab) |

Seega lisajooksud ei riku idempotentsust ja on **aktiivselt kasulikud**, kuni sektor/industry katvus on puudulik.
- **`-RunOnlyIfNetworkAvailable` on teadlikult VÄLJAS** — kogumine vajab internetti, aga see säte reageerib ka VPN-i ja virtuaalsete adapterite peale ebaühtlaselt. Võrgu puudumine annab praegu ausa ebaõnnestumise + retry, mitte vaikse mittekäivitumise.

Kontroll ja käsitsi käivitus:

```powershell
Start-ScheduledTask -TaskName 'StockDiscoveryDailyCollect'
Get-ScheduledTaskInfo -TaskName 'StockDiscoveryDailyCollect' | Select-Object LastRunTime, LastTaskResult, NextRunTime
Get-Content C:\sd-logs\collect.log -Tail 60
```

`LastTaskResult = 0` tähendab, et ülesanne lõppes korrektselt. **NB:** exit 0 ei tõesta, et collect tegelikult jooksis — kui logis on `TEINE COLLECT JOOKSEB JUBA` ja puudub `Kokkuvote` plokk, siis advisory lock katkestas jooksu puhtalt (`collect-daily.cjs` tagastab sel juhul samuti 0). Loe alati logi sisu, mitte ainult koodi.

Piirangud, mida tuleb teadvustada:

- **See Task Scheduler ise ei garanteeri igapäevast kadentsi** — kui masin on välja lülitatud, jääb tema jooks vahele. **Alates 2026-08-20 ei ole see enam probleem:** kadentsi tagab `cron-job.org` → GitHub Actions ahel (08:10 Tallinna aeg), mis ei sõltu ühestki lokaalsest masinast. Task Scheduler (08:05) on nüüd **sekundaarne varutrigger**. NB: ta käivitab `npm run collect:daily`, mis loeb `.env`-i, seega **ta sihib juba praegu Neoni** — ise ta muutmist ei vaja. Kaks triggerit viie minuti vahega on ohutu, sest canonical run on Tallinna päeva kohta idempotentne (`run_key`) ja kogu job on advisory locki taga: hilisem jooks taaskasutab sama päeva canonical run'i, ei loo teist.
- Canonical run on **Tallinna kuupäeva** põhine (`run_key = mudeliversioon:rklb_daily:Tallinna kuupäev`).
- 08:00 Tallinna aja jooks kasutab tõenäoliselt **eelmise USA kauplemispäeva sulgemishinda** — otsusehind on seega eelmine close, mitte jooksva päeva oma.
- Nädalavahetuse või püha jooks ankurdub **viimasele turupäevale**; kalendripäev loeb frequency-seerias, kuigi turg ei liikunud.

## Testimise põhimõtted

- Ära raporteeri funktsiooni valmis enne päris runtime'i ja DB kontrolli.
- Kordusjooks ei tohi tekitada duplikaate.
- Puuduv tickeri hind või SEC andmestik ei tohi lehte katki teha.
- Ajutised integratsioonitesti read tuleb pärast kontrolli kustutada.
- Production build kirjutab dev-serveri `.next` kataloogi üle; pärast buildi taaskäivita `app` konteiner.
- Price Context V1 kasutab ainult canonical run'i ajani salvestatud `price_snapshots` ridu; hilisemaid hindu ei loeta. Tabel ei säilita eraldi backfill'i sisestusaega, seega ajaloolise `captured_at` väärtusega käsitsi backfill võib vana price context'i muuta — collector tavavoo korral on `captured_at` päris kogumisaeg. Scenario Valuation väldib seda sisendiriski, sest kasutab decision'i külmutatud hinda/market cap'i ja `company_score_snapshots.payload.sources` väärtusi ning fact-ID metadata't.

## Automated Test Coverage (2026-08-17)

**Latest implementation recheck, 2026-09-11:** the paper heartbeat workflow regression passed 3/3 after retaining the existing no-collector-command guard. Typecheck passed and lint reported zero warnings/errors. The final isolated suite applied all ten migrations and passed 65 files / 498 tests in 270.81s; a direct PostgreSQL follow-up found zero remaining `discovery_test*` databases. The mounted Docker production build compiled and generated all 22 routes, followed by the required app restart. Docker app and DB were healthy, and live `/today` plus `/performance` returned HTTP 200. The 11 September pre-change production jobs were also verified in authenticated GitHub Actions: collect #26 succeeded in 24m45s and paper executor #11 in 42s. The new heartbeat step still requires its repository secret and a post-push workflow smoke. The detailed inventory below is historical and is not a complete list of the current suite.

Vitest, **354 testi, 39 faili** (mõõdetud 2026-08-25). Käivitamine konteineris `docker compose run --rm -T app npm test` või hostil `npm test` (hostil on `TEST_DATABASE_URL` kohustuslik, vt „Praegune töötav seis"). Testid jooksevad eraldi `discovery_test` andmebaasi vastu, mille harness ise loob ja jooksu lõpus kustutab; Neoni golden source'i ei puudutata. **Testibaasi skeem ehitatakse versioonitud migratsioonidest** (`scripts/migrate.cjs`), seega iga jooks valideerib ühtlasi runnerit ja migratsioone `0001–0007` koos `schema_migrations` raamatupidamisega. Failid jooksevad järjestikku (`fileParallelism: false`), sest testibaas on jagatud ja iga test alustab `resetDb()`-ga.

Peamised kaetud funktsioonid ja töövood:

- `recordDiscoveryRun` (`src/lib/discovery-validation.ts`) — 20 testi: canonical run-key ignoreerib input-hash'i (üks canonical run Tallinna päeva kohta, hilisem sisendimuutus märgitakse `inputChangedAfterCanonicalSnapshot` lipuga, kordusjooks ei lisa otsuseid ega outcome'e); manual `rklb` run-key sisaldab hash'i, seega muutunud sisend loob samal päeval teise run'i, aga otsuste ümberjärjestus mitte; ainult canonical loob `candidate_outcomes`; välistatud otsus ei saa outcome'e; nullkandidaadi päev salvestub ikka; Tallinna päevapiir neljal DST-juhul (suvi UTC+3, talv UTC+2) — see tõestab, et nihe tuleb tsooniandmetest, mitte koodist.
- `calculateCompanyScores` (`src/lib/company-scores.ts`) — 24 testi, **DB-vaba** (~40 ms): determinism, mõõdikute järjekorra sõltumatus, `growthRateScore` ja cash/debt piirväärtused, puuduv mõõdik langetab katvust mitte skoori, `null` sisendi dokumenteeritud kuju. `detail` väljadele assertitakse ainult olemasolu, sest `toLocaleString('et-EE')` väljund sõltub keskkonna ICU-st; Coverage detailid on lokaadist sõltumatud ja seega täpselt lukustatud.
- `refreshCandidateOutcomes` (`src/lib/discovery-validation.ts`) — 13 testi: `measured` on ainus lõplik olek (hilisem soodsam hind ei kirjuta üle, ka benchmark'i mitte); enne sihtaega ei puututa; esimene hind sihtajast alates võidab, mitte parim; 7-päevane aken ja akna järel `missing`; `missing` **ei ole** lukustatud olek (hilinenud aknasisene hind mõõdab ära); puuduv baashind → `unavailable`; excess = kandidaat − benchmark ning puuduv benchmark jääb NULL, mitte 0; horisondi sihtkuupäevad koos kuu-lõpu clamp'iga (31. jaanuar → 28. veebruar, 30. aprill).
- `saveCompanyScoreSnapshot` (`src/lib/score-tracking.ts`) — 7 testi: sama hash annab ühe rea ja `calculated_at` ei muutu; muutunud `latest.value` või `previousComparable.value` loob uue rea; mõõdikute järjekord ei loo uut snapshot'i; tundmatu ticker viskab erindi, orvu rida ei teki; `ON CONFLICT` uuendab ainult `payload`-i.
- `enrichStoredCompanyFinancials` (`src/lib/company-financials.ts`) — 36 testi: `SEC_USER_AGENT` värav (`status: 'disabled'`, `attempted 0`, null võrgupäringut); päevane enrichment-eelarve **Tallinna kalendripäeva** kaupa ja eelmise Tallinna päeva katsed ei kuluta tänast eelarvet; vaikimisi päevalimiit 5; `safeLimit` clamp 0 → 5, −3 → 1, 100 → 20, 2.9 → 2; universumi filtrid (SPY, ETF, üle 30 päeva vanune hind, hinnasnapshotita ettevõte); `error` retry 1 päeva järel koos `consecutive_failures` kasvuga; `unavailable` retry 30 päeva järel (2 ja 29 päeva ei kvalifitseeru, 31 kvalifitseerub); stale-facts 7-päeva haru koos 1-päevase cooldown'iga; stale-facts + `unavailable` asümmeetria; queue järjekord (faktideta enne stale-faktidega, kunagi proovimata enne varem proovitut, vanim katse esimesena); ühe tickeri viga ei katkesta kogu jooksu; mixed batch tulemuse kuju (`failed` ja `unavailable` eraldi loendurid). Kokku kahes failis: `tests/db/enrichment-budget.test.ts` (36, eelarve/retry/aknad) ja `tests/db/enrichment-success.test.ts` (22, success-tee — `enriched` loendur, SEC väljade kaardistus `financial_facts` ridadesse, `sec_cik`, katvuse kasv, idempotentsus ja üheksa mitte-ekstraheeritava vastuse alamjuhtumit).
- SEC Form 4 jagatud parser/CLI — 9 DB-vaba testi: `tests/unit/form4-calibration.test.ts` impordib otse `scripts/_form4.cjs` ja katab daily indexi/accession'i, complete-submission provenance/hash'i, Version 5.5 issueri, multi-owner rollid, non-derivative + derivative tehingud, scoped footnote'id, nullable 10b5-1, kuupäevalistingu, sampling'u ja notional percentile'id; `tests/unit/form4-ingestion-script.test.ts` lukustab kohustusliku kuni 31-päevase vahemiku ning tundmatu lipu fail-closed käitumise.
- `collect:daily` Healthchecks heartbeat — 9 DB-vaba testi: uus ja idempotentselt taaskasutatud kinnitatud canonical run saadavad täpselt ühe GET-i; dry-run, sammuviga, puuduv canonical tulemus ja puuduva tänase canonical rea seis ei tee ühtki võrgukutset; seadistamata URL on no-op; edukas GET tagastab HTTP staatuse; võrgutõrge logib hoiatuse ja resolve'ib `failed` tulemuseks ilma collection'i failure'iks muutmata.
- SEC Form 4 persistence — 7 DB-testi failis `tests/db/form4-persistence.test.ts`: accession-idempotentsus ilma timestamp/child rewrite'ita; 4/A link original-first ja amendment-first järjekorras; 10% owner ning director+officer multi-label säilimine transaction role-context'is ja evidence-view's; päris rollback pärast owner inserti, kui transaction CHECK ebaõnnestub; cross-table role trigger; ning null kirjutust companies/collection/discovery/score/candidate tabelitesse. Infra-smoke tõestab lisaks `0006` rakendumise eraldatud testibaasi ja 30-tabelilise migrated skeemi.
- Form 4 insider discovery — 3 DB-testi `tests/db/insider-discovery.test.ts`: exact v1 filter (sh strict >$50k, 4/A/derivative/10%-only exclusions), deterministic top-20 + korduslugemise idempotentsus ning source date/age viiepäevane freshness boundary ja stale fail-closed. Data-boundary test tõestab lookup-unioni ning et insider-only fundamentals ei sisene `buildCandidates()` social scoringusse; collection item, outcome snapshot ja `/today` testid lukustavad bucket precedence/idempotency/downstream contracti. Infra-smoke tõestab `0007`, nullable `insider_rank` ja mõlemad uuendatud bucket CHECK-id testibaasis; Neoni järel-`--status` kinnitas sama migratsiooni applied oleku.
- `saveCollectedCompanies` — 8 DB-testi; `data-boundaries` — 13 unit-testi. Need katavad turuandmeteta identiteedi, hilisema Yahoo hinna idempotentsuse, DATE piirid, missed-move katvuse, recall'i, 80+20 social lookup-lae, insider unioni ning selle, et insider-only fundamentals ei lähe social scoringusse.
- `collection_runs` (`src/lib/collection-runs.ts`) — 10 testi: iga katse saab eraldi `running` rea; success salvestab kestuse ja ühendatud metricud; failure salvestab veatüübi/teate ja rethrowib algse vea; veateade kärbitakse 2000 märgile; sama terminalseisu kordus on idempotentne; vastupidine terminalüleminek on keelatud; DB lifecycle- ja JSON-objekti CHECK-id jõustuvad; audit-list on uusim ees ja limiiditud; kõrgema taseme orkestreerija katab nii success- kui failure-tee. Infra-smoke tõestab eraldi, et `0002_collection_runs_ledger` rakendub, tabelikomplekt on 23 ja runtime `ensureSchema()` ei tekita drift'i.
- `data_quality_snapshots` (`src/lib/data-quality-snapshots.ts`) — 7 DB-testi: canonical run saab ühe rea; kordus on idempotentne ja immutable; manual run keelatud; kolme ettevõtte coverage/freshness/flag loendurid deterministlikud; hilisem measured outcome ei muuda build'i ega salvestatud snapshot'i; päris `UNIQUE(run_id)` jõustub. Infra-smoke lisab 1 testi: `0003` on rakendatud, tabelikomplekt on 24 ja runtime `ensure*` funktsioonid jäävad no-op'iks.
- `collection_run_items` (`src/lib/collection-run-items.ts`) — 14 DB-testi: growth, recall, insider ja not-selected bucketid; market-data tabamus/puudumine ja company-FK; identne kordus on idempotentne, vastuoluline terminalinfo keelatud; `growth > recall > insider` precedence; canonical run saab sama collection ID ning manual run ei vaja seda. Infra-smoke lisab `0004`/`0007` rakendumise kontrolli ja lukustab 30-tabelilise komplekti.
- `outcome_analysis_snapshots` (`src/lib/outcome-analysis-snapshots.ts`) — 12 DB-testi: recall/growth/insider provenance, winner vs benchmark beat eristus, skoorid, data-quality suhtarvud, catalyst tier ja mandate; missing → unknown; measured-eelne keeld; idempotentsus ja hilisemate source-muudatuste ignoreerimine; DB UPDATE/DELETE trigger; canonical-only summary; automaatne loomine outcome refresh'is; tickeritaseme decision link ja batch retry.
- `/today` read model (`src/lib/today-brief.ts`) — 18 DB-testi: puuduva tänase snapshot'i `WAITING`, puhas `READY`, candidate-warningu `ATTENTION`, latest collection failure'i `ERROR`, latest included otsus, quality snapshot'i seos ilma primaarstaatuse punaseks muutmiseta, recall/insider provenance ja insider lookup count, off-mandate review-item, kõigi public tabelite muutumatu reaarv, repeated tickeri rank 2→1, deterministic summary, salvestatud 1/3/6 kuu price context + run-up warning, scenario valuation'i range decision-time score-source boundary, adjacent rank explanation, päris kirjetele toetuvad ownership-badge'id, same-model-only muutuse valik ning catalyst-kuupäeva/allika/enum-sisendite täpne säilimine. Lisaks 8 pure comparatori, 6 price/scenario ja 3 catalyst-wording testi lukustavad rankingufaktorite täpse järjekorra, null-semantika, viigi, inconsistent-order guard'i, price-history unknown-state'i, Bear/Base/Bull sensitivity ning inimkeelse catalyst-kuva unknown-first käitumise. Helper kasutab PostgreSQL `READ ONLY` transaktsiooni ega kutsu `ensureSchema()`-t.
- Outcome Attribution V1 (`src/lib/outcome-attribution.ts`) — 6 pure + 2 DB-testi: score- ja market-cap bucketite piirid, average/mediaan, range `>10%` winner ja `<0%` loser, `n < 5` highlight-keeld, Total Score'i teadlik unavailable olek, tühi andmestik, canonical immutable snapshot + decision join ning read-only reaarvude muutumatus.
- Outcome Coverage V1 (`src/lib/outcome-coverage.ts`) — 5 pure + 3 DB-testi: all-item denominator, distinct-symbol headline numerator, item-level run/age coverage, 30/31/90/91/180/181 päeva piirid, factual highlight'id, tühi andmestik, mitu snapshot-horisonti sama item'i kohta ilma topeltlugemiseta ning osalevate tabelite read-only reaarvude muutumatus.
- Outcome Snapshot Backfill Audit V1 (`src/lib/outcome-backfill-audit.ts`) — 6 pure + 2 DB-testi: too-recent state, täpsed 30/90/180 päeva inclusive piirid, puuduva kohaliku hinna aus loendus, existing snapshot'i dedupe, baseline/target 7-päeva aknad, ready-state, tühi andmestik ning source-tabelite muutumatus `READ ONLY` transaktsioonis.
- Discovery Quality Audit V1 (`src/lib/discovery-quality-audit.ts`) — 6 pure + 2 DB-testi: score- ja market-cap bucketite piirid, unknown-aware sector/cap/exchange jaotus, puuduva country välja unavailable olek, duplicate first/last/count, ainult linked immutable decision'i score'id, `>80` statistika, factual highlight'id, tühi andmestik ning source-tabelite muutumatus `READ ONLY` transaktsioonis.
- Metadata Coverage Audit V1 (`src/lib/metadata-coverage-audit.ts`) — 6 pure + 2 DB-testi: NULL/empty/unknown-like eristus, score 0 ja boolean false säilimine, case-insensitive distinct/top values, schema-unavailable väli, päris skeemi lisaväljade auto-discovery, factual highlight'id, tühi andmestik, linked decision/company/collection väärtused ning osalevate tabelite muutumatus `READ ONLY` transaktsioonis.
- Metadata Join Root Cause Audit V1 (`src/lib/metadata-join-root-cause.ts`) — 7 pure + 2 DB-testi: selection/attempt/found kontekst, company identity vs persisted item-link, link mismatch, deterministlik metadata→sector→market-cap→exchange→score first-failure järjekord, cumulative funnel, mutually exclusive protsendid, factual highlight'id, tühi andmestik ning source-tabelite muutumatus `READ ONLY` transaktsioonis.
- migration runneri sihtbaasi guard (`scripts/migrate.cjs`) — 16 testi, **DB-vaba**: fail-closed kaitse, Neoni golden source `neondb` on kaitstud, testharnessi `discovery_test` ja ajutised `_tmp` baasid lasevad apply ilma lipuga läbi, `_test`/`_tmp` peab olema sufiks ning ümbernimetamiskindlus (mitte-ajutine nimi jääb kaitstuks olenemata sellest, kas ta on mingis nimekirjas).

Enrichment-testide seam on **`globalThis.fetch`**, mitte mooduli mock: `getSecIdentity` ja `fetchCompanyFacts` on `company-financials.ts`-i mooduli-privaatsed funktsioonid ja neid kutsutakse lokaalse sidumise kaudu, mida mooduli-mock ESM-is kinni ei püüa. Seetõttu ei muudetud testitavuse nimel ühtki `src/` faili ja ükski test ei tee päris võrgupäringut — tundmatu URL viskab valjult erindi. `unavailable` indutseeritakse SEC ticker-map'ist puuduva tickeriga, `error` non-ok companyfacts vastusega.

Ei testita (teadlikult, selle faasi skoobist väljas):

- **Completed: `last_error` 500-character truncation.** The SEC fixture can now throw an explicit provider error, allowing the real status writer to be tested without exporting private production functions. Truncation counts Unicode code points and cannot split a surrogate pair.
- **advisory lock'i samaaegsus** — testid jooksevad järjestikku ühe ühenduse peal, seega `pg_try_advisory_lock` (session-level, `collect-daily.cjs`) ja `pg_advisory_xact_lock` (`src/lib/db.ts`) tegelikku vastastikust välistamist ei pingutata;
- **välised provider'id päriselt** — Yahoo Finance, SEC CompanyFacts, ApeWisdom ja FMP; SEC-i kiht on `globalThis.fetch` stub'i taga ja ükski test ei võta päris võrguühendust;
- **UI ja HTTP route'id** — sh `/api/collect` autoriseerimine ja vastuse kuju, server action'id;
- `scripts/collect-daily.cjs` orkestreerimine (kuue sammu järjekord, veataluvus, `--dry-run` konservatiivsus);
- catalyst evidence V2, Data Freshness V1 detailarvutus, sector-relative, frequency, valuation, under-recognition, teesi versioonimine, portfell, watchlist ja alert'id.

## Viimane testitud seis

### 2026-10-01 — Early Opportunities V1

- Final `npm run typecheck` exit 0; `npm run lint` zero warnings/errors. Final isolated Docker `npm test`: **70 files / 523 tests passed**, 296.39s. Earlier complete pre-input-trace run also passed 523 tests; final run includes immutable chart inputs. `npm run build` compiled and generated 22/22 static pages; app restarted before final smoke. Temporary test DB count 0.
- `/today` and `/performance` HTTP 200; unauthenticated collect POST 401. Real browser confirms two candidates, 139 frozen chart inputs each, SEC links, exclusions and original first-discovery prices. Collection #63 daily CLI exit 0/healthy heartbeat; #64 repeat preserved first timestamps/prices. No extra canonical decisions or paper orders. [Verification report](research/2026-10-01/EARLY_DISCOVERY.md).

### 2026-10-01 — Market radar V1

- `npm run typecheck`: exit 0. `npm run lint`: no warnings or errors. Full Docker `npm test`: **68 files / 519 tests passed**, 538.67s, isolated test database. Build compiled successfully and generated 22/22 static pages; app restarted before runtime checks.
- Real CLI collection #62: 137 radar stocks, six successful channels, 15 successful SEC enrichments, canonical #95 reused, zero inserted paper orders, healthy heartbeat HTTP 200. DB read confirmed 45/137 radar names with financial facts. Browser renders rows, source provenance, missing-financial and stale-price states. See linked verification report and actual terminal logs. Next external scheduled run remains pending.

### 2026-09-13 - paired paper execution integrity

- Astra follow-up review identified a forward integrity gap: individually valid quotes could fill only the app or SPY side of one same-cash-flow comparison. A read-only Neon transaction found zero existing mismatches across 154 pairs: 73 filled, 17 pending and 64 skipped pair groups; all filled execution times matched.
- `executePendingPaperOrders()` now groups pending rows by policy, strategy, run, signal ticker and side. It fills only a complete strategy/benchmark pair when both quotes are executable; an incomplete pair or one invalid quote leaves both pending. The updates remain inside one transaction and repeated execution remains idempotent.
- Verification: focused Docker coverage 18/18; typecheck exit 0; lint zero warnings/errors; full isolated Docker suite 65 files / 507 tests in 246.95s after all ten migrations; teardown left zero `discovery_test*` databases; production build compiled and generated 22/22 routes; app restarted; `/today` and `/performance` returned HTTP 200. No production write, schema migration or broker path was used.
- Post-push GitHub Actions run #16 used exact commit `8a9320a` and succeeded in 39 seconds. Its executor logged 34 pending, zero filled and 34 deferred orders with only closed-market reasons; the heartbeat step ran after success. This proves the pair-aware build loads and preserves 17 complete pending pairs outside market hours. The scheduled market-session proof remains pending.

### 2026-09-13 - market-session deferred execution guard

- A read-only Neon audit found canonical v4 runs #71/#74/#75/#76 with 23 included decisions across 14 tickers and 115 pending outcomes; none is due. The first 1-week target is 17 September 19:06 UTC. The 13 September tracking batch was complete: 29 attempts, 3 saved, 26 unchanged Friday quotes and zero waiting/errors.
- Added an explicit New York regular-session helper and made the executor CLI fail when `deferredOrders > 0` during that window. Weekend, known full-day holiday and outside-session deferrals remain retryable success states. Focused Docker coverage passed 30/30; CLI syntax, typecheck and lint passed.
- Full isolated Docker suite passed 65 files / 506 tests in 278.67s after all ten migrations; teardown left zero `discovery_test*` databases. Production build compiled and generated 22/22 routes, the app container restarted, and `/today` plus `/performance` returned HTTP 200. No schema or production DB mutation was required for the guard. First new-SHA market-window workflow proof remains pending.
- After push, manual GitHub Actions run #15 used exact commit `ba69303` and succeeded in 36 seconds. The executor logged 34 pending, zero filled and 34 deferred orders, all because the US market was outside its regular session; the following Healthchecks step succeeded and the check remained up. A read-only Neon transaction found 146 filled, 34 pending and 128 skipped orders, nine distinct pending instruments, zero executions since the run and latest execution at 11 September 13:35 UTC. This is live proof of the closed-market branch; the first scheduled 09:35 New York run remains the market-session proof.

### 2026-09-13 - paper-execution heartbeat live activation

- Stored the dedicated private ping URL as the GitHub Actions repository secret `PAPER_STRATEGY_HEALTHCHECKS_PING_URL`; the value was not printed or committed.
- Manually dispatched `paper-strategy-execute #13` on `main`. GitHub showed exact commit `e765990`, overall success in 40 seconds and the `execute` job successful in 36 seconds. Its `Send paper execution Healthchecks heartbeat` step completed successfully in one second.
- The separate Healthchecks detail page changed from never pinged to `This check is up` with the first ping about 35 seconds old. This live workflow run validates the already fully tested workflow commit; the activation-only documentation update did not change runtime code and did not require another local test/build cycle.

### 2026-09-11 - separate paper-execution heartbeat path

- Added a post-success step to `.github/workflows/paper-strategy-execute.yml` using the dedicated optional `PAPER_STRATEGY_HEALTHCHECKS_PING_URL` secret. The step is after execution, bounded to ten seconds/one minute and non-critical; missing configuration is logged and skipped. No paper policy, database, quote or broker path changed.
- Added a workflow regression and documented the separate secret in `.env.example` and README. Focused Docker coverage passed 3/3. Typecheck and lint passed; the final isolated suite passed 65 files / 498 tests in 270.81s and teardown left zero test databases. The mounted production build generated 22/22 routes, the app container was restarted, Docker was healthy, and Today plus Performance returned HTTP 200.
- Verified the existing external cadence rather than assuming it: GitHub collect #26 succeeded at 08:10 Tallinn in 24m45s and paper executor #11 succeeded at 09:35 New York in 42s. Created the separate Healthchecks cron check with two-hour grace and email integration. It was subsequently activated and proved live on 13 September as recorded above.

### 2026-09-10 - first live v4 production run

- GitHub `collect-daily #25` ran exact deployed commit `cd56cae` and succeeded in 20m05s. It completed collection #39, canonical `rklb-discovery-v4` run #71 and all after-report/artifact/failure-gate steps.
- A validated `READ ONLY` Neon transaction found 6/6 included decisions linked to collection #39 items with `market_data_found=true`, with zero missing or cross-run links. The run has one data-quality snapshot, 30 candidate outcomes and 24 paper orders.
- Entry-aware V1 produced one eligible order. The separately dispatched `paper-strategy-execute #10` succeeded in 43s and filled SNDK at $1,699.00; CRDO, WTI, DY, ARM and BWFG remain skipped for insufficient stored price history. Docker services were healthy, four live routes returned HTTP 200, and rendered Today showed v4 plus all six tickers. This production observation changed no code, so the preceding 497-test/typecheck/lint/build evidence remains the applicable implementation gate.

### 2026-09-10 - explicit paper-entry state

- Added `currentCollectionConfirmed` to the Today read model and reused `evaluatePaperStrategies()` in the candidate summary. Business, Market setup and Paper entry test now appear together. `Eligible for paper entry` means entry-aware V1 would create its hypothetical $100 buy intent; `Wait` shows the actual failed policy reasons. Today also fails closed when the displayed decision price is stale, invalid or unavailable.
- Focused Today component/read-model coverage passed 28/28 after correcting one HTML-escaped apostrophe assertion. Final typecheck and lint passed. The full isolated suite applied all ten migrations and passed **65 files / 496 tests** in 422.40s; teardown left zero test databases. The Docker production build compiled and generated 22/22 routes, followed by the required app restart.
- `/today` and `/performance` returned HTTP 200 with the new labels. Browser inspection confirmed the full live candidate surface: all six 9 September candidates currently show `Wait`, with insufficient price history, missing current-collection confirmation or a stale displayed price named where applicable. No score, discovery decision, stored paper order or other production record was changed.
### 2026-09-09 — model- and ticker-separated outcome results

- Added a shared pure cohort summarizer and changed `/validation` and `/backtest` to aggregate canonical included decisions separately by `model_version` and horizon. Repeated decisions are averaged per ticker before ticker-level statistics, while both decision and distinct-ticker coverage remain explicit. Pending, missing and unavailable decisions and benchmark coverage are reported separately. No migration, new provider, score/ranking change, discovery policy or paper policy was introduced.
- Focused unit/database coverage passed 3/3 in two files. Final `npm run typecheck` and `npm run lint` passed. The full isolated suite applied all ten migrations and passed **65 files / 495 tests** in 425.04s; teardown left zero test databases. The mounted Docker production build compiled and generated 22/22 routes, followed by the required app restart.
- Live Neon smoke returned HTTP 200 for `/validation` and `/backtest`. Browser inspection confirmed separate v3/v2/v1 sections, ticker-weighted metrics, decision/ticker denominators and all outcome states. The existing read-triggered refresh measured newly due outcomes during the checks: v3 one-week coverage is now 16 decisions across six tickers; v2 one-week is 46 across nine and v2 two-week is 38 across six. Historical decisions and already measured outcomes remained immutable.

### 2026-09-09 — database target contract

- Added a shared pre-connection validator used by the app and normal CLI entrypoints. It rejects a missing URL/target, a local URL labelled `golden`, a remote URL labelled `local`, and a non-scratch database labelled `test`; mismatch messages expose only the host and database name. The app no longer falls back silently to Docker `db:5432/discovery`.
- `.env` now declares `DATABASE_TARGET=golden` without changing or exposing its connection string. `.env.local` remains local and provided the negative precedence proof: a separate Next environment load stopped with `DATABASE_TARGET=golden requires a neon.tech host ... Check .env.local precedence.` Docker Compose resolved and then ran with target `golden`, the Neon host and database `neondb`. Database-connected collect and paper workflows carry the same target; the DB-free Nasdaq workflow remains unchanged.
- Focused workflow/validator coverage passed 18/18. Final `npm run typecheck` and `npm run lint` passed; after the last loader correction the full isolated suite applied all ten migrations and passed **63 files / 492 tests** in 420.85s, after which `discovery_test` count was zero. The Docker production build compiled and generated 22/22 routes, followed by the required app restart. `npm run collect:status` read Neon and reported canonical run #69 for 9 September; `/today` and `/thesis/12` returned HTTP 200, unauthenticated `/api/collect` returned 401, and the live container revalidated `golden` + Neon `neondb`. No migration, collection or production database write was performed for this change.

### 2026-09-08 — versioned valuation decision review

- Migration `0010_thesis_valuation_review` applied to Neon `neondb` after read-only `schema:diff`, status and preflight reported zero duplicate prices, zero invalid thesis statuses and GO. The PostgreSQL 16 dump client first failed safely on Neon's PostgreSQL 18 version; no DDL had run. A PostgreSQL 18 custom-format backup then passed `pg_restore --list`: 4,582,313 bytes, 336 TOC entries, SHA-256 `D1F2DE9651F8124F23C777EB6D07FC6CACCFE53D6CD334DD444ADCD9ABF21E3D`. Apply took 98 ms; status shows 10 applied / 0 pending and post-apply conformance is `VASTAB` with zero missing or extra objects.
- Focused tests passed 25/25 in two files. The full isolated suite passed **61 files / 477 tests** in 296.05s with all ten migrations applied to `discovery_test`. Lint reported no warnings or errors. The optimized production build compiled and generated 22/22 pages. An initial container typecheck encountered stale missing `.next/types` files after the service stop; the post-build rerun passed cleanly. The app container was restarted after the build.
- Runtime `/thesis/12` returned HTTP 200 and was visually inspected in the browser. API's current edit form rendered all eight company-specific assumption/review inputs and latest context `4.07 USD · 8 September 2026, 16:59`; both existing versions still render with unavailable historical price context. No save action ran. Neon remained at 11 theses, 2,308 decisions, 875 outcomes, 168 paper orders and 139 `scores-v2` snapshots.

### 2026-09-08 — account handover

- Repository state was read from local/remote Git: `main` and `origin/main` both resolved to `fdcdddbbb285747755c642c052fdf76d647623f5` before this documentation commit. Docker Desktop was initially unavailable; after the user started it, local `db` was healthy and `app` started successfully. `/today`, `/company/BW`, and `/company/API` all returned HTTP 200; BW showed `scores-v2` plus its debt table and API showed broad liquidity plus ADS conversion. A read-only app-container query confirmed the production target is Neon `neondb`, with 11 theses, 2,308 decisions, 875 outcomes, 168 paper orders, 139 `scores-v2` snapshots, and two `signals-v3` briefs. No full test/build rerun occurred because this session changed documentation only; the latest such evidence remains the 7 September balance-reconciliation entry below.

### 2026-09-07 — BW/API balance reconciliation and mixed-date guard

- Dated BW/API SEC reconciliation is rendered on the two company pages. The new date guard creates `scores-v2`: the cash/debt component requires exactly matching `periodEnd` values. `signals-v3` requires the same condition before a Research Brief can infer that cash covers debt. The old score and brief remain stored under their original versions.
- Docker focused tests passed 30/30 in three files. Full isolated suite passed **60 files / 474 tests** in 261.43s; typecheck and lint exited 0; production build compiled and generated 22/22 routes. The app container was restarted after that build.
- Runtime: BW returned HTTP 200 with `scores-v2` and the complete $276.843m borrowing table; API returned HTTP 200 with broad liquidity and ADS conversion. Regenerated BW `signals-v3` brief has three catalysts and no mixed-date cash/debt claim. Current Neon counts remain 11 investment theses, 2,169 discovery decisions, 845 candidate outcomes and 144 paper orders. Expected new current records: two `scores-v2` snapshots and two `signals-v3` briefs.

### 2026-09-07 — continued price tracking

Migration 0009 and the first live Yahoo batch are applied; code is not committed/pushed. Isolated tracking/HTTP-lock tests passed 8/8. The initial full run passed 460 tests and failed only the schema inventory, which still expected 32 tables; updated that explicit list to include `price_tracking_attempts` (33 tables) and reran the full suite. The final run passed 461/461 in 57 files. Teardown left zero `discovery_test` or conformance scratch databases.

Actual verification output (all final checks exit 0):

```text
> stock-discovery@0.1.0 typecheck
> node node_modules/typescript/bin/tsc --noEmit
> stock-discovery@0.1.0 lint
> node node_modules/next/dist/bin/next lint
✔ No ESLint warnings or errors
 ✓ Compiled successfully
 ✓ Generating static pages (22/22)
 Container stock-discovery-app-1 Started
 APPLY    0009_price_tracking ... OK (111 ms)
 VERDIKT: VASTAB
FIRST {"attempted":18,"saved":18,"unchanged":0,"missing":0,"stale":0,"invalid":0,"failed":0,"deferred":0}
REPEAT {"attempted":0,"saved":0,"unchanged":0,"missing":0,"stale":0,"invalid":0,"failed":0,"deferred":0}
/today HTTP 200 tracking section true
/performance HTTP 200 tracking section false
 Test Files  57 passed (57)
      Tests  461 passed (461)
   Start at  00:05:10
   Duration  352.26s (transform 6.82s, setup 4.56s, import 10.93s, tests 309.47s, environment 8ms)
```

The Performance route intentionally has no tracking section. Browser smoke expanded Today's tracking panel: 18 saved / zero gaps / zero waiting, actual 4 September market times, while the 6 September canonical decision cards retained their original evidence and the new Tallinn day correctly showed Waiting. Read-only fingerprints before and after the live tracking check matched for all decisions, orders and outcomes (see session log). No temporary integration rows were inserted into Neon. The real 18 quote observations and attempt rows are intentional application data.

### 2026-09-06 — price integrity implementation

Local implementation only; not committed or pushed. No schema migration, production collector or paper execution was run. The app was rebuilt in Docker and restarted before browser/HTTP smoke. Initial reproductions failed for all three intended defects. A later full run had 456 passes and one failure in the new test fixture because it attempted to mutate an immutable mark; the fixture was corrected to append later observations with all required timestamps. The subsequent full run passed all 457 tests, including all eight paper DB tests. All commands below ran in the Docker app; the suite used isolated local `discovery_test` with eight migrations.

Actual successful terminal excerpts (all exit 0):

```text
> stock-discovery@0.1.0 typecheck
> node node_modules/typescript/bin/tsc --noEmit

> stock-discovery@0.1.0 lint
> node node_modules/next/dist/bin/next lint
✔ No ESLint warnings or errors

 Test Files  56 passed (56)
      Tests  457 passed (457)
   Start at  19:01:56
   Duration  253.16s (transform 5.85s, setup 4.37s, import 10.33s, tests 221.56s, environment 6ms)

> stock-discovery@0.1.0 build
> node node_modules/next/dist/bin/next build
 ✓ Compiled successfully
 ✓ Generating static pages (22/22)
 Container stock-discovery-app-1 Started
 remaining_test_databases
--------------------------
                        0
(1 row)
```

Runtime evidence: Today snapshot #64 retains ELF's `2026-08-26T05:11:26.150Z` and BW's `2026-08-18T21:10:11.863Z` decision-linked observations, displays `Current setup unknown` and a stale-price review warning, and preserves the underlying partial price history. Performance displays `VALUATION INCOMPLETE` with stock value/P&L/return unknown, `FIVE: mark date differs from SPY.` and `CRDO: mark is stale or its timestamp is invalid.` SPY's own marked P/L remains $6.92, explicitly as of its mark. Frozen signal-time labels remain the original historical assessments. Both pages were inspected in the browser, including the expanded ELF evidence and the portfolio card layout.

Actual post-restart HTTP/database output (read-only Neon; identical fingerprints before and after reads):

```text
/today HTTP 200 bytes 159685
/performance HTTP 200 bytes 145894
discovery_decisions {"rows":2035,"fingerprint":"9b8a0d1c5db118d355cdce7da9318098"} UNCHANGED
paper_strategy_orders {"rows":120,"fingerprint":"c9dfb3b2b34518081dd30409271d96cd"} UNCHANGED
paper_strategy_marks {"rows":21,"fingerprint":"35d53da6f67039c75fee1ef4782bbb0b"} UNCHANGED
candidate_outcomes {"rows":815,"fingerprint":"76c1bbb5a697f4fc0d23dfecb53b25fb"} UNCHANGED
```

The isolated DB test proves a later-day holding mark updates with no new order, repeated execution inserts zero duplicate marks, and every original fill remains byte-for-byte unchanged. It also checks a missing stock quote, mismatched dates, more than 20 minutes of separation, non-USD marks and an unavailable recent SPY reference. Unit tests cover partial/stale setup presentation, weekends, New York date boundaries, DST, invalid/missing/future timestamps. This does not prove a new live Yahoo execution: it is Sunday, old missing observations remain missing, and remote scheduling has not received these local changes.

### 2026-09-06 — repository and investing-workflow review

Documentation-only review on local/remote `main` at `b5f3290`; no application code changed. Typecheck and lint ran on the Windows host; the full suite used the explicit isolated local `TEST_DATABASE_URL`; production build ran in the mounted Docker app. App restarted after the build, before the final HTTP smoke. Real terminal excerpts:

```text
> stock-discovery@0.1.0 typecheck
> node node_modules/typescript/bin/tsc --noEmit

> stock-discovery@0.1.0 lint
> node node_modules/next/dist/bin/next lint

✔ No ESLint warnings or errors

 Test Files  55 passed (55)
      Tests  443 passed (443)
   Start at  14:35:32
   Duration  435.05s (transform 2.74s, setup 6.25s, import 13.32s, tests 391.14s, environment 6ms)

 ✓ Compiled successfully
 ✓ Generating static pages (22/22)

 Container stock-discovery-app-1 Restarting
 Container stock-discovery-app-1 Started

GET /today: HTTP 200; 155486 bytes
GET /performance: HTTP 200; 145031 bytes
GET /guide: HTTP 200; 14310 bytes
Unauthenticated POST /api/collect: HTTP 401

 remaining_test_databases
--------------------------
                        0
(1 row)
```

Typecheck/lint command sequence, full suite, Docker build, restart and smoke commands returned exit 0. `git diff --check` found no whitespace errors (only Git's LF/CRLF conversion notice). Existing tests passed while the review reproduced stale/partial green market labels and mixed-age paper marks in the real UI; these findings need new regressions and remain unfixed. No new production research data or test fixtures were created on Neon. Core collection, canonical decisions, Form 4 persistence, paper ledger and thesis timestamps were inspected with `BEGIN TRANSACTION READ ONLY` queries. The initial host dev server used the frozen local DB because of `.env.local`; it was stopped and the final Docker app's explicit Neon target was verified. Remote workflow logs, latest Nasdaq artifacts and notification delivery were not rechecked.

Social attention threshold + lookup capacity, kontrollitud tööarvutil **2026-08-22**:

- Neonist loetud `collection_run_items.mention_count` näitas nelja eri capture-date'i latest-run valimis, et `MIN_MENTIONS 5 → 3` lisaks keskmiselt 24 mitte-blacklistitud eligible tickerit päevas. Päevad 2026-08-17/19/20 jõudsid simulatsioonis vana 60 lookup'i laeni; 2026-08-16 oli 16 eligible tickeriga selge madala tähelepanu erind;
- `MIN_MENTIONS` langetati 3-ni ja growth lookup 40-lt 80-le; recall jäi 20 ning selector-loogikat, `buildCandidates()`-it, skoorimist, rankingut ja canonical discovery't ei muudetud. Uus regressioonitest lukustab 80+20=100 unikaalse lookup'i;
- kontrollid: typecheck exit 0; lint exit 0; Vitest **318/318** (34 faili, eraldi `discovery_test`, 264,63 s); production build kompileeris 21/21 lehte. App käivitati ja restartiti pärast build'i;
- post-restart smoke: `/today`, `/research/metadata-root-cause`, `/frequency` ja `/portfolio` HTTP 200; autentimata `POST /api/collect` HTTP 401. Koodimuudatuse verifitseerimise ajal päris collect'i ei käivitatud;
- lävi 3 on esimene evidence-based eksperiment, mitte steady-state otsus. Nelja kuupäeva valim on väike ja sisaldab üht selget erindit; 1-2 nädala pärast tuleb uute päevadega kontrollida threshold 2/3/5 jaotust, lookup saturation'it, Yahoo tabamusi ja kandidaatide kvaliteeti.
- Esimene päris muutusejärgne Neoni collect 2026-08-22 (collection run #14, canonical run #44) skännis 200 rida, tegi 27/27 edukat Yahoo lookup'i ja andis 11 kandidaati. Mainimiste 5+ rühm andis 11 lookup'i / 3 kandidaati; uus 3-4 rühm andis 16 lookup'i / 8 kandidaati. Seega oleks vana lävi 5 selle päeva põhjal jätnud kõrvale enamiku lookup'e ja kandidaate; 80+20 lagi ei olnud siduv ning recall-ringi ei kasutatud.

Price Context + Scenario Valuation V1, kontrollitud koduarvutil **2026-08-16**:

- `/today` eristab `Fundamental Growth x/100` hinnaliikumisest. Kandidaadi inline detail näitab decision price'i, 1/3/6 kuu return'i, 52n high/low kaugust ja recent-run-up warningut ainult salvestatud hinnasnapshotidest; puuduv väärtus on `Insufficient price history`, mitte hinnang;
- Scenario Valuation V1 valib esimese positiivse arvutatava ankru järjekorras P/E → EV/Sales → FCF Yield ning näitab fikseeritud Bear/Base/Bull sensitivity't (fundamentaal ja valuation vastavalt −20% / 0% / +20%). See ei ole forecast ega price target. Sisendid tulevad otsuse market cap'ist/hinnast ja selle `score_snapshot_id` exact fact-viidetest; hilisem financial fact ei muuda testi järgi tulemust;
- päris ELF run #31 detail: decision price `$91.44`, price history ainult 2 vaatlust → aus insufficient-state; decision-time P/E 20,3x, medium confidence, quarterly annualized. Mechanical sensitivity: Bear `$58.52` (−36%), Base `$91.44`, Bull `$131.67` (+44%);
- recent-run-up läved on 1k ≥20%, 3k ≥35% või 6k ≥50%; warning muudab review-prioriteeti, aga rankingut ega skoori mitte. Uut tabelit, migratsiooni, DDL-i, provider'it, collectorit, schedulerit ega AI-d ei lisatud;
- Vitest **202/202** ✔ (16 faili), lint ✔, typecheck ✔, production build ✔ (15/15 lehte). App taaskäivitati; `/today`, `/`, `/frequency`, `/backtest` ja `/portfolio` vastasid HTTP 200;
- in-app browser QA desktop + 390×844: ELF detail, kolm sensitivity-kaarti ja unknown-state renderduvad; console error/warning puudub. Mobile audit leidis olemasoleva nowrap-nav overflow' (748 px), mis parandati wrap'iga; lõplik `scrollWidth = viewport width` nii desktopis kui mobile'is.

Daily Research Dashboard / Morning Brief UX V2, kontrollitud koduarvutil **2026-08-16**:

- `/today` on candidate-first cockpit: esimeses avavaates on primaarstaatus, kompaktne guardrail/summary ning esimese kandidaadi “Why research this today?”. Viis kandidaati on võrreldavad ilma detail-route'ita; `<details>` avab strengths, risks, catalyst evidence, candidate quality ja eraldi verbatim decision evidence'i;
- staatused on `READY` / `WAITING` / `ATTENTION` / `ERROR`. Universe health on eraldi ega muuda üksi lehte punaseks; unknown provenance on subtle traceability note. High-value review hõlmab off/partial mandate'i, negative FCF-d, dilution'it, low coverage'it, missing sector'it, attention recall'i ja missed-move universe gap'i;
- catalyst/evidence ja source path on inimkeelsed; full stored event URL/detail kuvatakse olemasolul, kuid puuduva info asemele ei leiutata sündmust. Päevavõrdlus näitab rank'i ning toetatud score/coverage/mandate/catalyst muutusi; outcomes ja missed moves on kompaktsed collapsible plokid;
- `getTodayBrief()` on endiselt ainult lugev `REPEATABLE READ, READ ONLY` read model. Uut tabelit, migratsiooni, allikat, AI-d, rankingut, skoorimist, collectorit ega schedulerimuudatust ei lisatud;
- Vitest **194/194** ✔, lint ✔, typecheck ✔, production build ✔ (15/15 lehte). App taaskäivitati; `/today`, `/`, `/frequency`, `/backtest` ja `/portfolio` vastasid pordil 3005 HTTP 200;
- päris browser QA 1280×720: tänane run #31, `ATTENTION`, viis kandidaati; ELF why-today kaart on avavaates, inline detail töötab, horisontaalset overflow'd ega console warning/error'it pole.

Outcome Analysis Snapshot V1, kontrollitud koduarvutil **2026-08-15**:

- `0005_outcome_analysis_snapshots` lisas immutable snapshot-tabeli, `discovery_decisions.collection_run_item_id` tickeritaseme FK ja `analysis_scope` (`canonical|manual|unknown`); runtime DDL-i, rankingut, skoorimist, schedulerit ega allikaid ei muudetud;
- build-päring loeb ainult nelja lubatud tabelit. `refreshCandidateOutcomes()` proovib esmalt kandidaadi ja benchmark'i mõõtmist ning loob siis kõik puuduvad measured snapshotid; hilisem backfill ei kirjuta olemasolevat rida üle ja DB-trigger keelab UPDATE/DELETE;
- preflight **GO**; backup `pre-0005-outcome-analysis.dump` on kontrollitud: 611 159 baiti, 225 TOC kirjet, SHA-256 `F234A9E592449393A4AF48A1A9C242FCF0A6E932C050C73DE034E0C7F81FEE02`. `0005` rakendus golden-source DB-le 64 ms-ga ning järel-conformance on **VASTAB**;
- lint ✔, typecheck ✔, production build ✔ (14/14 lehte), Vitest **183/183** ✔; app taaskäivitati ning `/`, `/validation` ja `/backtest` vastasid pordil 3005 HTTP 200;
- golden-source DB-s on 305 pending, 0 measured ja 0 outcome-analysis snapshot'i. Backfilli ega kunstlikku mõõtmist ei tehtud; esimene päris measured outcome käivitab snapshoti automaatselt.

Collection → Canonical Ticker Provenance Bridge, kontrollitud koduarvutil **2026-08-15**:

- `0004_collection_run_items` lisas ühe immutable tickerirea collect-run'i kohta ning nullable `discovery_runs.collection_run_id` FK; runtime DDL-i, migration runnerit, schedulerikonfiguratsiooni ega uusi allikaid ei muudetud;
- preflight **GO**; enne apply'd oli ainus oodatud erinevus pending `0004` (1 tabel ja nullable canonical link). Backup `pre-0004-collection-provenance.dump` on kontrollitud: 603 858 baiti, 212 TOC kirjet, SHA-256 `B19724A484396FBDCD7E2B6B4FC0B39207E8E4A23AA7D224D0F4D3275E70CE4F`;
- `0004` rakendus golden-source DB-le 59 ms-ga; järel-conformance **VASTAB** (0 puuduvat, 0 üle). `collect:status` jäi mõistlikuks: 5 canonical run'i, latest #29, 305 pending outcome'i ja 0 mõõdetavat;
- lint ✔, typecheck ✔, production build ✔ (14/14 lehte), Vitest **171/171** ✔; app taaskäivitati ning `/` ja `/frequency` vastasid pordil 3005 HTTP 200;
- `collect:daily --dry-run` läbis ega kirjutanud ridu. Päris collect'i ei käivitatud: tänane canonical #29 eelnes sillale ning selle seose hiline ümberkirjutamine rikuks point-in-time tähendust. Seetõttu on golden DB-s praegu 0 `collection_run_items` rida; esimese rea ja canonical seose peab looma järgmine uus daily collect.

TOP 10 #4 point-in-time data-quality snapshot, kontrollitud koduarvutil **2026-08-15**:

- preflight **GO**; enne apply'd oli ainsa oodatud erinevusena pending `0003_data_quality_snapshots` (1 tabel, 24 veergu, 2 indeksit, 9 piirangut);
- kontrollitud backup `pre-0003-data-quality.dump`: 597 612 baiti, 203 TOC kirjet, SHA-256 `C6D6656AC16DE3BAC2B8E3289C9FEF5AC5160F285B4D4460FB4DFEED7B853867`;
- `0003` rakendus golden-source DB-le 23 ms-ga; järel-conformance **VASTAB** (0 tabeli-, veeru-, indeksi- või piirangudrifti);
- lint ✔, typecheck ✔, production build ✔ (14/14 lehte), Vitest **160/160** ✔; app taaskäivitati ning `/` ja `/frequency` vastasid HTTP 200;
- schedulerit, migration runnerit, `db/init.sql`-i, runtime `ensureSchema()` DDL-i ega Next.js versiooni ei muudetud;
- golden-source kontroll: 5 canonical run'i, latest #29, 0 kvaliteedisnapshot'i. See on oodatud, sest #29 eelnes integratsioonile; uut canonical run'i ega hilist backfilli ei loodud.

Golden-source migratsioon ja scheduler, kontrollitud koduarvutil **2026-08-13**:

- `npm run migrate -- --preflight`: **GO** — 0 `price_snapshots` duplikaati, 0 vigast thesis-staatust, `0001_baseline` PENDING, kaitstud baas JAH.
- backup `pre-migration.dump` **459 923 baiti**, sha256 klapib konteineri omaga, `.gitignore` katab (`*.dump`).
- `npm run migrate -- --allow-discovery`: `APPLY 0001_baseline ... OK (27 ms)`, rakendatud 1, vahele jäetud 0.
- `npm run migrate -- --conformance`: **VASTAB** (0 puuduvat, 0 üle). Sama verdikt ka **pärast** päris `collect:daily` jooksu, mis `ensureSchema()` kutsub — empiiriline tõend, et runtime DDL on migreeritud skeemil no-op.
- `npm run migrate -- --status`: `0001_baseline applied 2026-08-13T16:21:41Z · 27 ms`, 0 rakendamata.
- `npm run schema:diff`: 22 tabelit; `price_snapshots UNIQUE` **OLEMAS** ja `investment_theses status CHECK` **OLEMAS** (viimane oli enne migratsiooni PUUDUB).
- `npm test` hostil: **136/136 roheline**. `npm run typecheck` ja `npm run lint` läbivad samuti hostil.
- Andmed puutumata: theses 11, positions 5, canonical run'e 3, decisions 209, outcomes 255 — kõik identsed migratsiooni-eelse seisuga.
- `db/init.sql` koondumine **tõestatud, mitte järeldatud**: init.sql-ist ehitatud ajutine baas (19 tabelit) + `0001_baseline` → `--conformance VASTAB`; „sihtbaasis ÜLE" = 0. Ajutine baas kustutati.
- Task Scheduler `StockDiscoveryDailyCollect`: registreeritud ja käsitsi käivitatud, **`LastTaskResult = 0`**. Logi (`C:\sd-logs\collect.log`) näitas `runReused JAH`, canonical 3 → 3, outcomes 255 → 255, `price_snapshots` +19, SPY +1, klassifikatsioon 5 rikastatud. Lock-skip'i ei esinenud. Kõrvalmärkus: `Tradestie ebaõnnestus, kasutan ApeWisdomi proxy-sentimenti` — väline provider kukkus ja fallback töötas, jooks ei katkenud.

Täielik `npm run check` ahel läbis hostil **2026-08-13** täies mahus: lint ✔, typecheck ✔, data-quality 7/7, catalyst 11/11, frequency 12/12, valuation 12/12, under-recognition 18/18, build ✓ (13/13 lehte). `pre-migration.dump` taastatavus kontrollitud: `pg_restore --list` exit 0, 191 TOC kirjet, 21 tabelit. **NB:** see dump on migratsiooni-EELNE, seega `schema_migrations` selles puudub — taastamise järel tuleb `npm run migrate` uuesti jooksutada.

### Forward-valimi seis (mõõdetud 2026-08-14)

| Näitaja | Seis | Lävi | Puudu |
|---|---|---|---|
| canonical päevi kokku | 4 (08-11 … 08-14) | — | — |
| **canonical päevi `rklb-discovery-v2` seerias** | **3** (08-12, 08-13, 08-14) | ≥5, eelistatult 10 | **2 (eelistatult 7)** |
| ettevõtteid SEC faktidega | **29** | ≥20 | **täidetud** |
| `candidate_outcomes` | 280 | — | esimesed mõõdetavad 08-18 |

Canonical jooksud ja kaasatud kandidaadid:

| Otsusepäev | Run | Hinnatud | Kaasatud |
|---|---:|---:|---|
| 2026-08-11 (v1) | #3 | 8 | — |
| 2026-08-12 | #17 | 19 | BW, CAVA, CAKE, API, HR |
| 2026-08-13 | #25 | 24 | BW, CAVA, CAKE, API, FCF |
| 2026-08-14 | #28 | 29 | ELF, BW, CAVA, CAKE, API |

**Püsiv tuum on nüüd kolme päeva peal sama: BW, CAVA, CAKE, API.** Viies koht vahetub iga päev (HR → FCF → ELF). Hinnatud universum kasvab järjekindlalt (19 → 24 → 29), sest SEC enrichment lisab 5 ettevõtet päevas.

**Siduv piirang on nihkunud.** Varem oli see SEC katvus; nüüd on „≥20 ettevõtet" lävi täidetud ja ainus takistus on **canonical päevade arv v2 seerias**. Run #3 (08-11) on `rklb-discovery-v1` ega kuulu frequency-seeriasse.

- **Enrichment-järjekord on puhas:** kõik 25 katset on `success`, ühtki `error` ega `unavailable` ei ole. Katmata ettevõtted on „kunagi proovimata" ehk lihtsalt järjekorras — 5/päev tempoga.
- **Esimesed mõõdetavad outcome'id: 2026-08-18** (1n horisont, 5 päeva pärast). Seejärel 2n 08-25, 1k 09-11, 3k 11-11, 6k 2027-02-11. Enne 08-18 on `/backtest` koondnäitajad paratamatult tühjad.
- **Forward-valim on püsiv:** 08-12 kaasati BW, CAVA, CAKE, API, HR; 08-13 BW, CAVA, CAKE, API, FCF. Neli viiest kordub — täpselt see, mida `/frequency` persistence mõõdab.
- **Kõigil viiel tänasel kandidaadil on `catalyst_evidence_status = material_new_evidence`** (tugevaim tier). Võrdluseks: 08-11 v1 jooksus välistas catalyst hard gate kõik.
- Üks andmekvaliteedi tähelepanek: **API uusim salvestatud periood on `2025-12-31`**, ülejäänud neljal Q2/Q3 2026 (BW 08-04, FCF 08-07, CAKE 07-27, CAVA 05-12). API on foreign filer ilma `dei` sektsioonita ja püsib aastaaruande peal — selle tõend on materiaalselt vanem kui ülejäänud valimil.

Varasem seis:

- `npm run lint`: läbib ilma hoiatusteta.
- `npm run typecheck`: läbib.
- `npm run qa:catalyst`: 11/11 deterministlikku juhtu läbib: BW-tüüpi major/mixed, CAKE-tüüpi minor + mandaat not_relevant, PLUG false-positive, pealkirja mittekvalifitseerumine, uudis ei varja nõrka aruannet, Form 144, ainult planeeritud kuupäev, kogumislünk, sündmuse puudumine, aegunud seotud periood ja sama perioodi kordusavaldus.
- `npm run qa:data-quality`: 7/7 deterministlikku juhtu läbib: sama periood, mitme aasta vanune fakt, cash 2026 + debt 2021, unknown period, high Coverage + poor alignment, puuduv metric ja ühe teadaoleva perioodi `unknown` span.
- `npm run qa:frequency`: 12/12 deterministlikku juhtu läbib (Discovery Frequency V1 pure tuum): canonical päevaloend + readiness, never-included välja jäetud, kaasamiste/hinnatud loend, streak katkeb nii välistamisel kui universumist puudumisel, 5/10/20 aknad, persistence stale/evolving/single, rank ei ole evidence, timeline included/excluded/absent, leksikograafiline järjestus, decision_date dedup (suurim runId võidab), vähene ajalugu pole tõlgendatav ja tühi sisend on korrektne tulemus.
- `npm run qa:valuation`: 12/12 deterministlikku juhtu läbib (Valuation Evidence V1 pure tuum): EV/Sales annualiseeritud kvartalist + confidence medium, negatiivse kasumi P/E `not_meaningful`, negatiivne FCF yield märgitud, peer/sum-of-parts alati `unknown`, viis ankrut alati, positiivne aastane P/E high confidence, stale debt → low confidence, puuduv cash → `insufficient_data`, teadmata market cap → kõik hindamise ankrud napivad, YTD ei annualiseeru, tühi sisend korrektne ning ükski ankur ei tagasta koondskoori (unit ainult x/%/null).
- `npm run check` käivitab lint, typecheck, data-quality QA, catalyst QA, frequency QA, valuation QA, under-recognition QA ja build'i ühe käsuga; 2026-08-12 läbis täies mahus.
- Discovery Frequency V1 + canonical-only aggregation layer kontrolliti päris Postgresi (port 5433) vastu: `getDiscoveryFrequencyDashboard`, `getValidationDashboard` ja `getBacktestDashboard` käivitusid `ensureSchema` järel veatult; canonical-only filter jättis olemasolevad 2 manual `rklb` v1 jooksu koondnäitajatest välja (`canonicalRuns 0`, kõik horisondi kandidaadiloendid 0), kinnitades, et manual read ei mõjuta enam statistikat.
- Provenance samm 1 (manual runs ei loo outcome'e) kontrolliti päris Postgresi vastu integratsioonitestiga, mis salvestas ja seejärel kustutas ainult oma testread: baseline'ist manual included-jooks lõi 1 `discovery_decisions` rea ja 0 `candidate_outcomes` rida; canonical jooks lõi 1 decision ja 5 outcome rida; pärast testread'e kustutamist taastus DB täpselt baseline'i (`discovery_runs`/`discovery_decisions`/`candidate_outcomes` loendurid muutumatud), kinnitades et ükski olemasolev ega ajalooline rida ei muutunud. validation/frequency/backtest dashboardid käivitusid pärast veatult.
- Valuation Evidence V1 kontrolliti päris Postgresi vastu (AAPL, RKLB): AAPL EV/Sales 10,4x + P/E 37,8x (medium, annualiseeritud kvartalist); RKLB EV/Sales 51,2x + P/E `not_meaningful` (kahjumis ettevõte). FCF Yield jäi `insufficient_data`, kuna uusim FCF periood oli YTD (ei annualiseeru puhtalt).
- `npm run qa:under-recognition`: 18/18 deterministlikku juhtu läbib (Under-recognition Evidence V0 pure tuum): kogu § 4.1 cohort (API meaningful, BW low_confidence, HIMS/CAKE/ACHR no_attention_gap), viis olekut eraldi, guardrails (BW jääb low_confidence, ACHR/CAKE ei muutu meaningful), health-survival guard, unknown-first (puuduv analyst/percentile/catalyst/growth → unknown; frequency ja price reaction alati unknown; percentiil <5 võrreldava korral unknown) ja et olek on tekst, mitte number.
- Under-recognition Evidence V0 kontrolliti päris Postgresi vastu (AAPL, RKLB): AAPL → `no_attention_gap` (41 analüütikut = kõrge tähelepanu, sector percentiil insufficient); RKLB → `low_confidence` (Growth 69 improving, aga Health 36 < 40 ellujäämisriski lävi). Mõlemad ausad: kõrge kate blokeerib edge'i, health-risk blokeerib meaningful'i.
- `npm run build`: läbib; dünaamilised `/company/[ticker]`, `/scanner` ja `/thesis/[positionId]` route'id on buildis.
- `docker compose up --build -d`: app, db ja scheduler töötavad; db on healthy.
- Pärast tööarvuti commit'i `1454157` koduarvutisse fast-forward pullimist vastasid `/scanner?preset=rklb`, `/validation`, `/backtest`, `/guide` ja `/company/AAPL` HTTP 200; app, db ja scheduler töötasid ning db oli healthy.
- Manual research sprint kontrolliti päris in-app brauseris: `/portfolio`, viis `/thesis/[positionId]` vaadet ja `/watchlist` renderdusid töötavas rakenduses.
- Watchlisti lisati päris research-kirjetena API, BW, CAKE, HIMS ja ACHR koguse/avg cost'iga 0; need ei kuulu portfelli koguväärtusse ega ole ajutised integration-test read.
- PostgreSQL-is säilis iga viie tickeri esialgne draft ja sisuline lõppversioon. Current staatused: API `ready`, BW/HIMS `researching`, CAKE/ACHR `rejected`; API, BW, CAKE, HIMS ja lõplik ACHR teesiotsus on seotud point-in-time score snapshot'iga.
- ACHR Thesis Builderi avamine rikastas olemasoleva SEC CompanyFactsi allika kaudu 173 fakti ning lõi snapshot'i #111 skooridega Growth 1, Health 30, Coverage 75; rejected-tees salvestati uuesti selle snapshot'i seosega.
- BW primary-source kontroll kinnitas, et Coverage 100 ei tähenda freshness'it: äpi Health kasutas 2026 cash'i koos 2021 debt'iga. Q2 release näitas samal ajal päris backlog/Base Electron catalyst'it, mida collector ei tuvastanud.
- Data-quality päris DB/UI kontroll: API `fresh/good`; BW `mixed/poor`; CAKE, HIMS, ACHR, RKLB ja AAPL `fresh/warning`; TSM `fresh/unknown`. Kõik kaheksa company detaili kuvasid eraldi quality-plokki.
- BW company detail kuvas Coverage 100 kõrval 1769-päevase span'i, stale debt perioodi `2021-09-30` ja algallika; ACHR jäi `fresh`, kuid quarter + YTD segamise tõttu `alignment warning` olekusse.
- `/scanner?preset=rklb` kuvas ühe päris BW research-kandidaadi kaardil kompaktse andmekvaliteedi hoiatuse. `/thesis/13` kuvas `Data quality warnings` ploki ja mitteblokeeriva Ready soft warning'u.
- Pärast production build'i taaskäivitati app. `/scanner?preset=rklb`, `/company/AAPL`, `/company/BW`, `/company/ACHR`, `/validation` ja `/backtest` vastasid 200.
- Data-quality lõppkontroll kaeti kõigi 14 SEC faktidega ettevõtte peale: API/FRMI/IQ `fresh/good`; AAPL, ACHR, CAKE, DJT, HIMS, HR ja RKLB `fresh/warning`; ARR ja BW `mixed/poor`; PLUG `mixed/warning`; TSM `fresh/unknown`. ARR span oli 5500 päeva (2011 revenue), BW 1769 päeva ja PLUG 675 päeva.
- TSM ühe teadaoleva sisendiga kuvab nüüd Alignment `unknown` kõrval ka span `unknown`, mitte eksitavat 0 päeva.
- `/scanner?preset=rklb` kuvas 14 hinnatud ettevõttest 5 kandidaati ja igal kaardil kompaktse andmekvaliteedi ploki; BW kaart näitas stale debt'i, 1769-päevast span'i ja quarter+YTD segamist.
- Thesis Builderi soft warning eristab kahte olukorda: aegunud/joondamata sisendid ja olukorra, kus score-sisendeid pole üldse.
- Puuduva SEC-andmestikuga ajutine `0700.HK` watch-positsioon renderdas `/thesis` lehe HTTP 200-ga, kuvas `Kvaliteedi hindamiseks pole skoorisisendeid` ja vastava soft warning'u; positsioon kustutati ning järelkontroll andis 0 rida.
- Lõplik smoke test pärast build'i ja app'i restarti: `/`, `/scanner`, `/scanner?preset=rklb`, `/watchlist`, `/daily`, `/portfolio`, `/validation`, `/backtest`, `/guide`, `/company/AAPL`, `/company/BW`, `/company/TSM`, `/thesis/12` ja `/thesis/13` vastasid 200; saladuseta `/api/collect` 401.
- Idempotentsus: identse sisendiga kordus-`/scanner?preset=rklb` taaskasutas sama `rklb` run'i; data-quality kiht ei lisandunud discovery input-hashi ega `discovery_decisions` ridadesse. TEST/QA tickerite arv `companies`, `portfolio_positions` ja `discovery_decisions` tabelis oli 0.
- Catalyst Evidence V2 päris DB kontroll 2026-08-12: viimane `rklb-discovery-v1` canonical run (#3, 2026-08-11) andis 8 hinnatud ettevõttest 0 kandidaati ning BW ja CAKE olid välistatud **ainult** catalyst gate'i tõttu. Esimene `rklb-discovery-v2` canonical run (#17, 2026-08-12) andis 19 hinnatud ettevõttest 5 kandidaati: BW #1, CAVA #2, CAKE #3, API #4, HR #5.
- Sama päeva sama andmestiku käsitsi jooks: v1 run #13 andis 5 kandidaati 14 hinnatust (kõigil 14-l oli `catalyst_status = supported`, sh CAKE-l ainult Form 144 ja PLUG-il pealkirja tõttu). v2 run #15 andis samast andmestikust samad 5 kandidaati, kuid eristas tõendi: 10 ettevõttel `material_new_evidence`, 4-l `weak_or_unconfirmed`.
- Cohort'i kuus kontrolljuhtumit reprodutseeriti päris DB peal: API major/improving/decisive/partial; BW major (OCF pööre)/mixed/decisive/fits; CAKE minor/improving/supporting/not_relevant; HIMS major/mixed/decisive/fits; ACHR unquantified/deteriorating/adjacent; PLUG unquantified/mixed/adjacent/not_relevant.
- PLUG langes canonical run'is #17 kandidaatidest välja põhjusega „Läbis baasfiltrid, kuid jäi viie kõrgeima järjestusega kandidaadi piirist välja”, mitte catalyst gate'i tõttu. See on soovitud käitumine: nõrk tõend langetab järjestust, ei välista.
- Enne parandust valis süsteem PLUG-i ja ACHR-i tugevaimaks tõendiks 2026-08-11 uudise pealkirja; pärast tier-sisese prioriteedi lisamist on tugevaim tõend nende enda 10-Q ja nõrkuse põhjus on avalduse kvantifitseerimata muutus.
- Kaks järjestikust kaitstud `/api/collect` jooksu: esimene lõi canonical run'i #17 (19 hinnatud, 5 kandidaati, SEC katvus 14 → 19, 5/5 enrichment), teine taaskasutas run'i #17, tegi 0 SEC katset ega loonud teist canonical snapshot'i.
- `catalyst_events` 160 rida 19 ettevõtte kohta, `catalyst_assessments` 200 rida; kaks täiendavat scanner-jooksu ei lisanud ühtegi hinnangut ega tekitanud ühtegi duplikaatset `(company_id, event_kind, source_ref)` võtit.
- `/validation` kuvab salvestatud otsuste catalyst evidence staatuse badge'ina (65 `material_new_evidence`, 20 `weak_or_unconfirmed` viimaste run'ide lõikes).
- Pärast production build'i taaskäivitati app. `/`, `/scanner`, `/scanner?preset=rklb`, `/watchlist`, `/daily`, `/portfolio`, `/validation`, `/backtest`, `/guide`, `/company/BW`, `/company/PLUG` ja `/thesis/13` vastasid 200; saladuseta `/api/collect` 401; app, db (healthy) ja scheduler töötasid.
- Hardening audit 2026-08-12 leidis päris tõendi write-on-read riskist: eelmise sessiooni smoke test ise kirjutas BW ja PLUG SEC faktid uuesti (`financial_facts.updated_at` 21:53 vs collectori `last_success_at` 15:28-15:30), sest company detaili kuuetunnine cache oli aegunud.
- Auditi hetkel oli 205 `candidate_outcomes` reast 180 pärit käsitsi avatud `rklb` jooksudest ja ainult 25 canonical `rklb_daily` jooksust; jaotus mudeliversioonide kaupa oli v1 `rklb` 6 jooksu / 16 kandidaati, v1 `rklb_daily` 1 / 0, v2 `rklb` 4 / 20 ja v2 `rklb_daily` 1 / 5. `/validation` ja `/backtest` kuvavad selle jaotuse nüüd koondnäitajate juures.
- Migration sanity kontrolliti päris andmebaasidel: puhtale `schema_audit` DB-le rakendatud `db/init.sql` andis 19 tabelit, runtime `ensureSchema()` lisas `catalyst_events` ja `catalyst_assessments` (21 tabelit) ning kõik 15 uut catalyst-veergu `discovery_decisions`-is (kokku 21 catalyst-prefiksiga veergu). Olemasolev töötav DB andis sama tulemuse. Ajutine `schema_audit` andmebaas kustutati.
- CAKE 81/81/100 lükati konkreetse „järgmise RKLB” mandaadi jaoks tagasi; see on päris tõend, et high score tähendab „uuri”, mitte „osta”.
- Koduarvuti päris DB audit pärast pulli: 27 ettevõtet ja 68 hinnasnapshot'i, kuid ainult 3 ettevõtet SEC finantsfaktide/skooridega ning 1 sector/industry klassifikatsiooniga; 1 discovery run (3 hinnatud, 0 kaasatud), 0 candidate outcome'i, 0 Watchlisti positsiooni ja 0 teesi. See kinnitab, et järgmine faas on katvuse kasvatamine, päris kasutus ja forward-ajaloo kogumine, mitte uute analüüsimoodulite lisamine.
- Daily pipeline'i päris kordustest: esimene puhas collect skännis 200 rida, salvestas 43 radarikandidaati, SPY hinna ja 5/5 SEC enrichment'i; katvus kasvas 3 → 8 ning `rklb_daily` run #3 salvestas 8 decision-rida.
- Sama päeva teine collect rikastas veel testimise käigus viis päris ettevõtet (katvus 8 → 13), kuid taaskasutas run #3 ja märkis muutunud hilisema sisendi. Pärast päevase eelarve karmistamist tegi järgmine kordus 0 SEC katset, jättis katvuse 13/41 ja canonical run'ide arvu üheks.
- Enrichment staatused: 10 päris success-rida, 0 unavailable, 0 failed; testitud tickerid ARR, BW, CAKE, DJT, FRMI, API, HIMS, HR, IQ ja PLUG. Need on kasulikud pärisandmed, mitte sünteetilised QA read.
- Lõplik runtime pärast restarti: `/`, `/scanner`, `/validation`, `/backtest` ja `/guide` HTTP 200; saladuseta `/api/collect` 401. Viimases collect-logis puudusid runtime- ja SEC 2 MB cache-vead.
- `/watchlist`, `/company/AAPL`, `/thesis/[positionId]`: HTTP 200.
- AAPL company detail näitab Growthi ja Financial Healthi kolme peamist põhjust.
- Thesis Builderi server action: draft lõi versiooni 1; identne kordussalvestus jättis versioonide arvuks 1.
- Vigane `ready` blokeeriti mõõdetava invalidation-tingimuse veaga.
- Täielik `ready` lõi versiooni 2; ainult üks versioon jäi current ning mõlemad versioonid säilitasid point-in-time score snapshot'i.
- Puuduva SEC-andmestikuga ajutine ticker renderdas viisakalt „SEC perioode pole piisavalt”.
- Kõik kaks ajutist QA-positsiooni, nende teesiversioonid ja ajutine ettevõte eemaldati; järelkontroll andis 0 rida.
- In-app automaatbrauser ei saanud testvaadet selle sessiooni aknas attach'ida; sama kasutajavoog kontrolliti päris HTML form POST-i, server action'i, HTTP-vastuste ja PostgreSQL-i kaudu.
- Score-alerti sünteetiline sama versiooni test: Growth 75 → 55, Health 70 → 72 ja Revenue komponent 80 → 30 andsid `new risk` alert'i snapshot'ide #16 → #17 vahel.
- Watchlisti ja Daily kordusjooks jätsid score-alertide arvuks 1.
- Uuem `qa-score-v2` snapshot kuvati `needs review` mudeliversiooni-vahetusena ning ei loonud teist alert'i.
- Score-alerti Watchlisti detail kontrolliti päris brauseris; Daily Changes kuvas sama score-põhjuse.
- Production build läbis app-konteineris; pärast buildi taaskäivitati app ning `/watchlist` ja `/daily` vastasid 200.
- Ajutine SCOREQA positsioon, ettevõte, alert ja snapshotid eemaldati; nelja järelkontrolli tulemus oli 0.
- „Leia järgmine RKLB” pärisandmetega empty state näitas null kandidaati ega täitnud nimekirja kunstlikult.
- Sünteetiline CANDQA läbis baasfiltrid tulemusega Growth 100, Health 90 ja Coverage 100; kaart näitas market cap'i, katalüsaatoruudist, dilution-riski, teadmata infot ja score snapshot'i #37.
- `Lisa Watchlisti` lõi täpselt ühe positsiooni; eraldi `Alusta teesi` kontroll lõi positsiooni ja avas `/thesis/7`.
- `/guide` renderdas viis soovitatud töövoosammu ning navigeerimislingi.
- CANDQA positsioon, ettevõte, 12 finantsfakti, hind, uudis ja score snapshot eemaldati; kuus järelkontrolli andsid 0.
- Discovery pärisjooks salvestas ühe run'i, 2 vaadeldud tickerit ja 0 kandidaati; identne kordus jättis run'ide arvuks 1.
- Ajutine VALQA kandidaat salvestus rank #1-na koos viie pending outcome'iga. Testhinnad andsid 1n +10%, 2n -10%, 1k +20%, 3k -20% ja 6k +50%.
- Hiljem lisatud varasemad VALQA backfill-hinnad ei kirjutanud ühtegi viiest mõõdetud tulemusest ümber.
- `/validation` ja `/scanner?preset=rklb` kontrolliti päris brauseris; navigeerimine, tühi statistika, run-meta ning AAPL/RKLB välistamise põhjused renderdusid korrektselt.
- VALQA ettevõte, 240 kloonitud finantsfakti, hinnad, earnings, score snapshot, discovery run ja outcomes eemaldati; järelkontroll andis ettevõtte ja decision'i arvuks 0.
- Lõplik `npm run lint`, `npm run typecheck` ja app-konteineri `npm run build` läbisid; build sisaldas dünaamilist `/validation` route'i.
- Pärast production build'i taaskäivitati app-konteiner. `/scanner?preset=rklb` ja `/validation` vastasid 200 ning discovery run'ide arv püsis idempotentselt 1.

## Sessioonilogi

### 2026-09-18 - supplied original idea reconciled

- User supplied the original Estonian problem text and emphasized later requirements still apply. Replaced the missing-text blocker with a requirement-by-requirement map in `COMPLETION_AUDIT_2026-09-18.md`.
- Core gaps are comprehensive holdings/earnings/exit decision support, portfolio rebalancing, public early-information verification and calibrated probability forecasts, and production new-listing analysis. Existing search, evidence, consensus, research, paper execution and P/L provide partial coverage but do not complete the original product. No current listing-status claim is made about the user's SpaceX example.
- Preserve later constraints: no added providers, no fabricated probabilities or forced shortlist, no real-money execution. No new feature implementation or testing in this documentation-only audit; the accepted trial cannot certify unbuilt capabilities.

### 2026-09-18 - honest completion boundary and trial freeze

- Audited saved requirements/designs against code and existing verification; wrote `COMPLETION_AUDIT_2026-09-18.md`. Core paper experiment is delivered; broader planned features and original-text uncertainty are explicit. Corrected earlier overly broad completion wording.
- Recorded the user's accepted 10-trading-day first checkpoint and feature freeze, subject to original-scope clarification. No code, policy, database, scheduler or real-money action changed. Documentation-only session; no new test results claimed.

### 2026-09-18 - reduce repeated SEC catch-up work

- Added one persisted-accession lookup inside each date's registration transaction. Previously each already-completed accession issued an INSERT/ON CONFLICT plus SELECT; completed rows now need only the batch read. Pending and failed accessions still register/retry through `recordFilingAttempt`; atomic day registration, newest-first ordering, SEC pacing, advisory locking and the 40-minute workflow limit are unchanged. No discovery/selection/paper or schema change.
- Added regression coverage for persisted-row immutability, retry attempt counts, fresh registration, repeated completed inputs and rollback of the entire incomplete registration batch. Focused suite passed 2 files / 14 tests in 10.23s.
- Real `node scripts/ingest-form4.cjs --from 2026-09-17 --to 2026-09-17 --fail-on-filing-error` exited 0: 1,481 index rows, 707 distinct accession numbers, 707 skipped, zero persisted/fetch/parse/persist failures, two SEC requests, about four seconds.
- Real `--recent-days 7 --fail-on-filing-error` replay exited 0 in 14,718ms: five indexed dates (11,14,15,16,17 September), 6,056 index rows, 2,876 distinct accessions, 2,876 skipped, zero persisted/failures, seven SEC requests. Before/after complete filing-row checksum `9d49f66dabbfdc574898eee72aa0a6f2` matched for all 2,876 in-range records. No synthetic production data. This is a completed-history replay, not a full new-day timing claim.
- Read-only API order check: all four 17 September signals now have `status=filled`. The previously pending-order task is closed at the database level; this does not assert a GitHub workflow's status.
- Final verification, all exit 0: `npm run typecheck`; `npm run lint` (`No ESLint warnings or errors`); `npm run build` (`Compiled successfully`, 22/22 pages); `docker compose run --rm -T app npm test` (`Test Files 66 passed (66)`, `Tests 514 passed (514)`, duration 288.76s). Restarted app after build; fresh browser request to `/performance` returned HTTP 200 in 3127ms and displayed the existing money summary. Isolated test database removed by teardown. Next scheduled new-day duration and collection timestamp propagation remain unverified.

### 2026-09-18 - money made or lost presentation

- Implemented the user's requested primary view using the existing entry-aware filled paper ledger. Net P/L = remaining holdings value + net sale proceeds - purchases including fees. Open holdings are explicitly unrealized paper results. Baseline/SPY and signal evidence remain available under a collapsed details section. Average entry uses total bought quantity, not the arithmetic mean of execution prices; multiple buys are grouped per ticker. A pre-entry rise is never counted as our profit. Closed positions keep their result even without fresh marks; missing prices on open positions stay unavailable.
- Ran the existing simulated executor to refresh held prices: `pendingOrders: 0`, `filledOrders: 0`, `deferredOrders: 0`, `markedTickers: 27`, `reasons: {}`. No new trade was made. API and FOR had usable fresh marks in this refresh. This does not independently prove a GitHub workflow's status.
- At quotes 18 September 17:55:09–18:02:13 UTC, entry-aware purchases across the current policy totaled $3,303.30 including fees, value $3,337.884344367391, net paper gain $34.584344367391104 (+1.04696347%), nine open stocks and no sales. SNDK +$89.29, CRCL +$8.94; ALL -$10.90, API -$2.73, APP -$3.08, DKS -$0.55, FOR -$4.28, RDDT -$20.04, WTI -$22.07. Independent SQL aggregation and the sum of unrounded stock P/L reconciled to the headline. These are dated marks, not a promise of later prices or cashed-out profits.
- Focused regression run: 10/10 tests passed in 13.59s, covering gains, stale prices, empty books, repeated purchases and sold losses including fees. Final required checks all exited 0: `npm run typecheck`, `npm run lint` (`No ESLint warnings or errors`), `npm run build` (`Compiled successfully`, 22/22 pages), and `docker compose run --rm -T app npm test` (`Test Files 66 passed (66)`, `Tests 513 passed (513)`, duration 307.08s). App restarted after the final build; `/performance` returned HTTP 200 in 2999ms. Browser verified the $34.58 headline, $3,303.30 invested, $3,337.88 value, nine stock rows, and working collapsed/expanded details. No synthetic production data; test database removed by teardown.

### 2026-09-18 - first v4 review and quote-time integrity

- Saved `research/2026-09-18/evidence.json` from a read-only repeatable-read transaction, with exact SQL and endpoint-link uniqueness checks. The notebook's three standard-library code cells were executed sequentially with captured outputs (not a Jupyter kernel); `REVIEW.md` exposes the same arithmetic and limitations. 53 one-week decisions: 11 measured / 42 pending. Nine candidate endpoints and all 11 benchmark endpoints have unknown market time. Equal-ticker excess arithmetic is -1.806 pp, not validated portfolio performance. Entry-aware v4 gross filled buys: $2,600; largest two tickers 53.85%.
- Preserved Yahoo `regularMarketTime` through fundamentals, discovery candidates, fallback merge, research quote and all four shared DB writer paths. Known identical quotes deduplicate across receipt times; unknown timestamps remain null. No schema migration or historical backfill.
- New candidate and SPY endpoint selection rejects unknown, pre-target and future timestamps. Existing measured rows are untouched. Both results pages visibly explain their historical limitation. Starting-price timing and full economic-return validity remain unvalidated; this repair does not establish an edge.
- Verification commands, all exit 0: `docker compose exec -T app npm run typecheck`; `docker compose exec -T app npm run lint` (`No ESLint warnings or errors`); `docker compose exec -T app npm run build` (`Compiled successfully`, 22/22 pages); `docker compose run --rm -T app npm test` (`Test Files 66 passed (66)`, `Tests 512 passed (512)`, duration 304.82s). Focused regression run also passed 30 tests. The first full run was interrupted by the required app restart and was not counted; the replacement ran to completion in a separate disposable container.
- App restarted after build. Browser screenshots/DOM confirmed readable warnings and missing-data states on `/validation` and `/backtest`; runtime logged HTTP 200 (29173ms and 12535ms). Actual Yahoo SPY observation persisted `market_at=2026-09-17T20:00:00Z`, price 762.6, row 3323; writing twice left one row. No synthetic production records. Subsequent audit: `{"historicalMeasuredRows":11,"unchanged":true,"nowMeasured":11}`. Test harness removes its isolated test database on teardown.
- No real capital committed, no broker orders, no policy tuning, and no new data source. Local runtime is verified. Fix published to private main at `526365a3416532891430ab3b7a75b4f75ebd6761`; `git ls-remote origin refs/heads/main` returned that exact SHA. The next scheduled execution of this change remains unverified.

### 2026-09-18 - scheduled failure investigation

- Authenticated Actions: [collect #32](https://github.com/mnoormets/stock-discovery/actions/runs/35184710903) hit the Form 4 40-minute limit after persisting 623 new 16 September accessions, while revisiting older dates. Core collection succeeded in 10m20s. [Collect #33](https://github.com/mnoormets/stock-discovery/actions/runs/35309781440) succeeded unchanged, including 707 new 17 September filings. [Paper #20](https://github.com/mnoormets/stock-discovery/actions/runs/35227986639) reported 18 pending, 14 filled, four deferred orders and 24 marked tickers; API/BWFG timestamps failed validation. Nasdaq #17 succeeded.
- Actual `npm run collect:status` exited 0 against Neon: latest canonical #81, 2026-09-18, rklb-discovery-v4, 6/187 included, today canonical exists JAH. All 21 included decisions without outcomes belong to manual runs, excluded by design.
- Separate `BEGIN READ ONLY` audit: collections #44–47 all success; registered SEC filings all persisted, with counts 511/435/600/511/623/707 for 10/11/14/15/16/17 September respectively. This verifies registered records, not historical EDGAR completeness. Four older API orders remain pending (baseline and entry-aware, each paired with SPY), plus today's 20 new orders. Fourteen fills on 17 September. No database writes or synthetic records.
- Collection recovered automatically. No speculative code fix or out-of-session replay was made; paper recovery remains pending fresh regular-session quotes. Lower-level timeout latency was not proven; sequential processing of persisted accessions is a possible optimization, not an established root cause.
- Limits: cron-job.org browser is signed out; local Docker daemon is unavailable. No application code changed and no build/test/UI-success claim is made. Initial sandboxed DB connectivity failed; network-enabled read-only checks succeeded. No commit or push.

### 2026-09-13 - Astra paper-pair integrity review

- Reviewed the end-to-end money-measurement path before the first v4 outcomes mature. Found one actionable execution flaw: the app instrument and its same-cash-flow SPY benchmark were independently eligible to fill, so a one-sided quote outage could bias the comparison.
- A read-only production audit proved no historical repair was needed: 154 pair groups, split into 73 filled, 17 pending and 64 skipped, had zero missing legs, status mismatches or differing filled timestamps. Changed the executor prospectively to require both pending legs and both executable quotes before filling either. Added a regression that first supplies a stale SPY quote and proves zero fills, then supplies both fresh quotes and proves all four test orders fill.
- Verification passed: focused 18/18; typecheck; lint; full suite 65 files / 507 tests in 246.95s; zero leftover test databases; 22/22-route production build; app restart; Today and Performance HTTP 200. Production data and schema were not changed. Post-push workflow #16 then ran exact SHA `8a9320a`, kept all 34 Sunday orders pending with zero fills, succeeded in 39 seconds and sent the heartbeat.

### 2026-09-13 - v4 tracking checkpoint and deferred-order guard

- Audited the golden-source database in a read-only transaction. V4 has four canonical days, 23 included decisions, 14 distinct tickers and 115 pending outcome rows; the first honest measurement is not due until 17 September. Continued tracking used 29/50 daily slots with no waiting or error state.
- Found that `paper:strategy -- execute` returned exit 0 even when fresh regular-session quotes were unavailable, which allowed the following Healthchecks step to report healthy while app-eligible orders remained unfilled. Added the minimum time/calendar guard: any deferred order during expected New York regular hours now exits non-zero after preserving and printing the retryable result; market-closed runs remain successful.
- Verification: focused Docker tests 30/30; CLI syntax exit 0; typecheck exit 0; lint zero warnings/errors; full Docker suite 65 files / 506 tests in 278.67s; zero remaining test databases; production build 22/22 routes; app restart complete; Today and Performance HTTP 200. Production data and schema were not changed.
- Pushed guard commit `ba69303` and manually dispatched `paper-strategy-execute #15` on that exact SHA. It succeeded in 36 seconds on Sunday with 34 pending/deferred orders, zero fills and explicit market-closed reasons, after which the heartbeat step ran successfully. Healthchecks remained up. A read-only Neon transaction confirmed 34 pending orders across nine instruments, no execution after the workflow and latest execution still 11 September 13:35 UTC. This validates the outside-session path without changing production rows; the first market-session new-SHA run remains pending.

### 2026-09-13 - paper execution dead-man activation

- After explicit user confirmation, copied the private URL from the dedicated Healthchecks check into the GitHub Actions repository secret `PAPER_STRATEGY_HEALTHCHECKS_PING_URL` without exposing its value in Git or terminal output.
- Dispatched GitHub Actions `paper-strategy-execute #13` on `main`. The run used exact commit `e765990`, completed successfully in 40 seconds, and its execute job completed in 36 seconds. The post-success Healthchecks step was present, ran rather than skipped, and succeeded in one second.
- Healthchecks reported `This check is up` and a first ping roughly 35 seconds earlier. The activation closes the independent absence-monitoring gap for paper execution; no app code, policy, database row or broker path changed in this session step.

### 2026-09-11 - paper execution dead-man implementation

- Confirmed in authenticated GitHub Actions that today's external jobs are healthy before changing observability: collect #26 succeeded in 24m45s and paper executor #11 in 42s. Docker Desktop was initially stopped, then started from its installed user-local path; DB became healthy and the app service was restored.
- Added a dedicated optional paper-execution Healthchecks step after the executor, plus regression coverage and configuration documentation. The initial host focused attempt failed before discovery because the host inherited Docker-only test host `db`; the first Docker focused run then correctly caught the forbidden `collect:daily` literal in a new comment. The comment was corrected without weakening the guard, and the rerun passed 3/3.
- Final evidence: typecheck exit 0; lint zero warnings/errors; 65 files / 498 tests passed in 270.81s after all ten migrations; zero test databases remained; production build generated 22/22 routes; app restart completed; `/today` and `/performance` returned 200. A separate Healthchecks check exists at 09:35 America/New_York with two-hour grace and email integration; its later activation is recorded in the 13 September entry above.

### 2026-09-10 - first live v4 production run

- Manually dispatched GitHub `collect-daily #25` after deployment because the normal morning run predated v4. It ran commit `cd56cae`, succeeded in 20m05s and wrote collection #39 plus canonical run #71.
- Audited Neon through a validated read-only transaction: all six included decisions are same-run and current-data confirmed; the quality snapshot, 30 outcomes and 24 policy orders are complete. The included tickers are SNDK, CRDO, WTI, DY, ARM and BWFG.
- Dispatched paper executor #10 because its scheduled run had occurred before the new canonical signal. It succeeded in 43s, filling SNDK at $1,699.00 while leaving the other five entry-aware orders skipped with explicit insufficient-history reasons. Docker `/today`, `/performance`, `/validation` and `/backtest` returned 200, and Today rendered the v4 model plus all six names. Temporary audit files were removed; existing local artifacts were untouched.

### 2026-09-10 - canonical current-collection selection

- Traced the latest immutable canonical and paper rows in a validated read-only Neon transaction. Run #70 selected four cached tickers with no collection #38 item; those names consumed tier capacity while current confirmed base-eligible alternatives were excluded. SNDK was independently confirmed as a valid entry-aware fill, and WTI's price-history wait was correct.
- Added a pre-tier eligibility predicate to the existing market-cap selector and used it only for canonical discovery. Canonical calls now require a positive collection-run ID, read the linked immutable items and exclude any ticker without same-run `market_data_found=true`; manual scanner behavior is unchanged. Advanced the discovery model to `rklb-discovery-v4` without changing scores, comparator order, tier policy, paper policy, providers or schema.
- Added a regression proving that a higher-ranked ineligible cached name cannot consume a tier slot. Focused checks passed 8/8 after correcting one hard-coded v3 fixture label; the final isolated suite passed 65 files / 497 tests in 477.45s. Typecheck and lint passed, the mounted Docker production build generated 22/22 pages, the app container was restarted, and Today, Scanner and Performance returned HTTP 200. No production v4 run or paper order was created during verification.
- Confirmed through the authenticated GitHub Actions UI that the latest runs are healthy: collect-daily #24, paper-strategy-execute #9 and nasdaq-listing-observation #10 all completed successfully on 10 September. The email failures are historical rather than an active scheduler outage.

### 2026-09-10 - explicit paper-entry state

- Made entry-aware V1 the explicit hypothetical buy state on Today and Performance. A research candidate remains distinct from a paper-entry candidate, and the exact reason for `Wait` is visible without opening technical details.
- Preserved the user's repeated-signal decision: every newly eligible canonical day remains a new $100 intent even for the same ticker. If that exposes weak behavior, the policy must be fixed under a new version rather than hidden in execution deduplication.
- Verification passed with 28 focused tests, 496 full-suite tests, typecheck, lint, the 22-route production build, app restart, HTTP smoke and browser inspection. Existing untracked dump, transfer and local-tool artifacts were left untouched.
### 2026-09-09 — model- and ticker-separated outcome results

- Replaced the pooled validation/backtest headline with explicit canonical model-version and horizon cohorts. Added a shared ticker-level aggregation helper so repeated daily selections of the same company do not receive independent statistical weight, while operational decision coverage remains visible.
- Updated both pages to show run, decision, ticker, measured, pending, missing, unavailable and benchmark coverage. README and the user guide explain the interpretation. Added focused unit and database regression tests covering model isolation, repeated-ticker weighting, benchmark coverage and outcome states.
- Typecheck, lint, focused tests, the 495-test isolated suite and the 22-route Docker production build passed. The app was restarted; both live pages returned HTTP 200 and were inspected in the browser. Runtime verification used the pages' existing due-outcome refresh behavior and therefore advanced due production coverage without changing the outcome contract.

### 2026-09-09 — fail-closed database target selection

- Replaced the app's silent local database fallback with `src/lib/database-target.cjs`, shared by `src/lib/db.ts` and CLI setup. Updated the custom TypeScript loader to pass explicit `.cjs` imports through Node, and routed the previously direct Form 4 calibration connection through the same validator.
- Added explicit target intent to Docker Compose, the local-env setup helper, both database test bootstraps, temporary schema-diff databases and all database-connected GitHub workflow steps. Updated `.env.example`, README, the migration runbook and workflow contract tests. No new provider, schema, migration or product behavior was introduced.
- Verified the exact host trap, isolated test target, live Neon CLI, Docker-resolved target, full build/restart and protected HTTP endpoint. The full suite passed 492/492 and removed its temporary database. Existing untracked dump/transfer artifacts were left untouched.

### 2026-09-09 — Thesis Review Queue V1

- Added `src/lib/thesis-review-queue.ts`, a read-only batched model for current active/watchlist theses, decision/latest price context, review triggers, future/passed earnings and narrowly qualifying new filing evidence. No free-text threshold parser, thesis write, status change, ranking change, provider or migration was added.
- Added the queue near the top of `/today`, with review-due/awaiting/reviewed states, full assumption details and direct Thesis Builder links. README and user guide now document the daily review flow and exact state semantics.
- Focused database coverage exercises empty/read-only behavior, same-currency price context, future earnings, new financial filings, assessed relevant versus routine SEC events, missing assumptions, passed-results gaps and the reviewed state. The first focused run exposed only an exact floating-point test assertion (19.999999999999996 vs 20); it was changed to a numeric tolerance and the final focused suite passed 6/6. Final typecheck and lint passed, and the full isolated suite applied all 10 migrations and passed 62 files / 486 tests in 407.98s. The mounted Docker production build generated 22/22 routes, followed by the required app restart. Live Neon inspection showed API/BW/HIMS v3 awaiting evidence with 0 due; final `/today` HTTP smoke matched all 10 queue markers and the visual/accessibility check rendered all three cards, reviewed prices and triggers.

### 2026-09-09 — current thesis packet and Actions runtime maintenance

- Verified GitHub collect-daily #23 on e423af7: the externally triggered 08:10 Tallinn run completed successfully in 44m43s. Its only annotation was GitHub's Node 20 action-runtime deprecation warning.
- Queried Neon in a read-only transaction. Canonical run #69 exists for 9 September with 6/143 included. Current API/BW/HIMS price snapshots are #2327 $4.11, #2329 $7.74 and #2339 $28.17, all from the 8 September regular close. Saved thesis IDs/versions/statuses remained API #6 v2 ready, BW #7 v2 researching, HIMS #9 v2 researching.
- Added copy-ready revenue, margin, cash-flow, dilution, valuation, downside, reverse-valuation and next-review assumptions to the dated thesis review. API starts from cash-only valuation until liquidity access is proven; BW includes borrowings/preferred/leases before a multiple; HIMS reverse-solves the annual FCF required by its current equity value. No thesis or production data was changed.
- Updated all GitHub workflows from checkout/setup-node v4 to v7 and both artifact uploads from v4 to v6. The first full suite correctly caught one hard-coded v4 test expectation; after updating it, the focused workflow test passed 2/2 and the final isolated suite passed 61 files / 480 tests in 272.25s. Post-push nasdaq-listing-observation #9 then ran exact SHA 8c03536 successfully in 39s, produced one artifact and showed the v7 steps without a deprecation annotation. Typecheck, lint and the 22-route production build passed. Docker Desktop was started; the final build was followed by an app-container restart. /today, /thesis/12, /thesis/13 and /thesis/15 returned HTTP 200, with the three thesis pages rendering the current 4.11 / 7.74 / 28.17 USD contexts.
- After explicit user acceptance, saved API/BW/HIMS v3 separately through `saveThesisCard`. API is `ready`; BW and HIMS are `researching`. The records use exact reviewed price snapshots #2327/#2329/#2339 and score snapshots #4604/#4598/#4608. A preflight first stopped safely because newer price rows #2343/#2344/#2345 existed; the accepted older context was then validated by company and preserved deliberately. A second read verified exact assumption text, unchanged v2 narrative/checkpoint fields and one current row per position. Docker runtime checks for `/thesis/12`, `/thesis/13` and `/thesis/15` returned 200 and rendered v3, the accepted revenue assumption and 4.11/7.74/28.17 USD price context. The temporary save script was removed.
### 2026-09-08 — daily collection holiday false alarm

- Inspected the actual GitHub Actions runs. `paper-strategy-execute #7` and `nasdaq-listing-observation #7` succeeded. `collect-daily #21` failed only at its final price-tracking completeness gate after successfully persisting collection #35, canonical run #67, SEC enrichment, paper orders, outcome refresh and price snapshots. The 18 tracker rows all referenced the valid Friday 4 September close before the Tuesday 8 September market open after Labor Day.
- Changed the read-side freshness helper to exclude the NYSE's explicit published 2026–2028 full-day closures while retaining a conservative weekday fallback outside that schedule. Added unit and database regressions for Labor Day, the next trading day, Thanksgiving, and the fallback year. Updated Today/Performance wording and operator docs. Existing attempt rows, price rows, execution freshness and paper policy remain unchanged.
- Local Task Scheduler `StockDiscoveryDailyCollect` remains enabled and ready for 9 September at 08:05. Its 8 September result 1 came from the task being explicitly stopped during the guarded database migration session, not from the GitHub workflow defect.
- Verification: focused 18/18 tests passed; full suite 61 files / 480 tests passed in 270.02s; typecheck and lint passed with zero warnings or errors. The optimized build generated 22/22 routes, the `app` container was restarted, and `/today` plus `/performance` returned HTTP 200 with the published-holiday wording present.
- Published the fix on `main` as `6c643d2 Handle NYSE holidays in price recency`. GitHub `collect-daily #22` ran that exact SHA and succeeded in 19m47s. It reused canonical run #67, left `discovery_runs` at 40, `discovery_decisions` at 2,308 and `candidate_outcomes` at 875, reused 24 paper orders, consumed no second tracking attempt, and sent the Healthchecks heartbeat with HTTP 200. Normal live collection added 61 deduplicated company price snapshots plus one SPY snapshot. The final read-only status showed 2,220 price snapshots, 97 measured outcomes, 109 missing and 669 pending.

### 2026-09-08 — versioned company valuation review

- Added migration `0010_thesis_valuation_review` and matching init/runtime schema definitions. Every new thesis version can store revenue, margin, cash-flow, dilution, valuation and downside assumptions, the reverse-valuation question, next observable review trigger and exact company price snapshot. Existing rows remain nullable with no backfill; the FK prevents referenced price evidence from deletion.
- Extended Thesis Builder's defense, edit form and version history. Automatic SEC/valuation evidence remains visually separate from the user's hypotheses. Saving an unchanged form against the same price remains idempotent; a changed assumption or new price context creates a new immutable version. A snapshot from another company is discarded.
- Added focused persistence and schema coverage, applied the migration through the guarded Neon runbook with a verified PostgreSQL 18 backup, and completed full lint/typecheck/test/build/restart/runtime checks. The browser smoke read API's existing ready thesis and current 4.07 USD form context without submitting the form; user thesis count and other historical counters remained unchanged.
- Read-only unattended tracking inspection closed the earlier operational question: 7 September ran 18 `unchanged` attempts and 8 September ran 18 `stale` attempts against Friday 4 September market timestamps. No false holiday prices were saved. The remaining observation is the first post-holiday regular-session timestamp advance.

### 2026-09-08 — account handover

- Created `docs/CODEX_ACCOUNT_HANDOVER_2026-09-08.md` for migration to a different Codex account. It covers user intent, repository baseline, recent files and commits, financial-data decisions, database/scheduler safety, exact commands, verified status, credentials-to-transfer names, unresolved work, and safe first steps. Existing local dump artifacts remain untracked and excluded. No application code, schema, live data, or secret was changed or exposed. After Docker Desktop was restored, started the stopped local app service and recorded its Neon-backed HTTP/runtime smoke results; no collect, migration, or direct data-write command ran.

### 2026-09-07 — BW/API balance reconciliation and mixed-date guard

- Added `balance-review-2026-09-07`: BW's June 10-Q bridge totals $276.843m borrowings from four carrying-value lines and keeps $191.7m preferred stock, $27.822m finance leases and $17.623m operating leases separate. API's furnished Q2 result gives $361.655m broad liquidity, $100.316m borrowings and the 1 ADS = 4 ordinary-share conversion; $261.339m is a borrowing-only difference, not distributable cash.
- Added the same-date cash/debt guard to both Financial Health scoring and the rule-based brief, with targeted regressions. This removes the incorrect BW conclusion created by cash at 2026-06-30 versus a partial debt fact at 2021-09-30. It is a versioned current calculation, not a historic rewrite.
- Verification evidence: Docker focused 30/30; full Docker suite 60 files / 474 tests in 261.43s; typecheck, lint and optimized build all passed. After restart, BW/API pages returned 200 and rendered expected reconciliation content; BW `scores-v2` shows Financial Health 55/100 at 70% coverage without the cash/debt component. Forced `signals-v3` regeneration returned `contains_mixed_claim=False`. No user thesis/decision/outcome/paper-order count changed. Published on `main` as `6760c47`.

### 2026-09-07 — financial-input corrections

- Published the verified implementation on `main` as `717b2a9 Correct financial inputs and valuation guards`.
- Inspected current SEC CompanyFacts for BW/HIMS/API and BW filing XBRL. BW CompanyFacts has current secured debt only, not total debt; automatically importing it as total would understate obligations. Kept that gap explicit and blocked the mixed-period EV/Sales anchor.
- Added HIMS component extraction, same-accession FCF derivation, five EV/Sales date regression cases, and DB checks for exact -$15.161m FCF, no rounded-total double counting, mismatched-filing rejection and duplicate refresh idempotency.
- Live Neon refresh: HIMS financial facts 120 -> 175 -> 175; API 51 -> 58 -> 58. No historical facts removed. HIMS latest shares fallback is a stale 2019 zero, visibly flagged; it is not a current share-count resolution. API latest ordinary shares is #21616; broader liquidity and ADS/diluted-share reconciliation remain open.
- Original focused verification caught a syntax error, corrected before succeeding typecheck/lint/valuation QA. The session resumed with Docker stopped; test/build attempts failed on unavailable Docker/Postgres, then Docker was restarted and verification rerun. Full suite passed: 58 files, 468 tests, 480.69s (start 09:29:44 Tallinn). Typecheck and lint exited 0; valuation QA 12/12 passed; production build compiled and generated 22/22 pages. Post-build app restart completed; API/BW/HIMS returned HTTP 200 and browser checks showed the ADS warning, withheld EV/Sales with both dates, and readable negative-FCF formula. Live fingerprints stayed identical: 11 investment_theses, 2169 discovery_decisions, 845 candidate_outcomes and 144 paper_strategy_orders. Existing company-page write-on-read behavior may append current score/catalyst records; the four historical/user tables were unchanged.


Actual verification output (2026-09-07 financial corrections):

```text
> stock-discovery@0.1.0 typecheck
> node node_modules/typescript/bin/tsc --noEmit

> stock-discovery@0.1.0 lint
> node node_modules/next/dist/bin/next lint
✔ No ESLint warnings or errors

Valuation evidence deterministic QA: 12/12 passed

Test Files  58 passed (58)
Tests       468 passed (468)
Start at    09:29:44
Duration    480.69s

✓ Compiled successfully
✓ Generating static pages (22/22)
Container stock-discovery-app-1 Started

BW: HTTP 200; expected evidence true
HIMS: HTTP 200; expected evidence true
API: HTTP 200; expected evidence true
```

### 2026-09-07 — publication and three thesis-review drafts

- Committed 24 verified files as `aaf537c Track research prices continuously and qualify stale valuations`; pushed main (`b5f3290..aaf537c`) and confirmed `git ls-remote origin refs/heads/main` matches the full local SHA. Post-commit `git diff --stat` was empty. Personal dumps and other untracked files were excluded.
- Read-only Neon review of API/BW/HIMS saved theses, latest financial facts and new Yahoo price snapshots produced [THESIS_REVIEW_2026-09-07.md](THESIS_REVIEW_2026-09-07.md). Explicit SQL date formatting confirmed periods without timezone conversion.
- SEC source checks found BW current debt/preferred claims and HIMS negative company-defined H1 FCF; normalized database coverage remains incomplete. API SEC directory was accessible but full filing fetch exceeded the browser size limit. No new external provider, write-on-read route or database mutation was used.
- Draft reviews are complete; user conviction/status remains unchanged. Next implementation focus is existing-source financial input coverage and definitions, followed by versioned valuation assumptions. Unattended tracking remains unverified.
- Documentation-only follow-up: `git diff --check` used for validation; no code changed after the previously recorded 57 files / 461 tests, typecheck, lint, build and runtime/database checks. Earlier no-push entries below describe their historical session checkpoints, superseded by this publication.

### 2026-09-07 — continued research-price tracking

- Implemented separate tracking eligibility/provenance, a shared 50-symbol daily budget with oldest-attempt fairness, quote deduplication, failure status and a read-only Today panel. Both collect entrypoints call tracking after canonical selection and before outcomes; incomplete tracking is visible as HTTP 503 / CLI failure.
- Applied migration `0009_price_tracking` to Neon after preflight GO, zero duplicate prices/invalid thesis statuses and a fresh backup. Apply: 111 ms; subsequent conformance: `VASTAB`, zero missing/extra objects. Backup `pre-0009-price-tracking-20260906.dump`: 4,277,219 bytes, 320 TOC entries, SHA-256 `2984454645939bb52ab6bb77720a8bc5cc46a733b4241d6eaacb7663731886b1`; pg_restore list succeeded. No backup was committed.
- Live Yahoo batch at `2026-09-06T21:04:54.811Z`–`21:04:59.873Z` saved all 18 eligible symbols, no missing/stale/invalid/failed/deferred items. Market timestamps are `2026-09-04T20:00:00Z`–`20:00:03Z`. Immediate repeat attempted/saved zero; no repeated quote inflated history.
- Fingerprints remained unchanged for 2,035 discovery decisions (`9b8a0d1c5db118d355cdce7da9318098`), 120 paper orders (`c9dfb3b2b34518081dd30409271d96cd`) and 815 outcomes (`76c1bbb5a697f4fc0d23dfecb53b25fb`). This live check collected research quotes only; no historical reconstruction, outcome refresh or paper/broker execution was run.
- Build passed and app restarted before browser smoke. Today visibly shows 18 symbols / 0 quote gaps / 0 waiting and the expandable market dates; snapshot #64 stays unchanged. Standard test details below. No commit or push; unattended remote tracking is not yet verified.

### 2026-09-06 — first price-integrity fixes

- User requested continuing the review's next steps for personal investing. Implemented a bounded first slice: include positive net paper holdings in Yahoo quote requests, expose valuation problems before showing returns, and prevent stale/partial Today setup reassurance.
- Kept paper-strategy-v1 gates, original fills, discovery decisions and outcomes intact. Added a documented read-side weekday recency heuristic and timestamp alignment with SPY; no new provider or schema.
- Reproduced the three original defects in tests. Corrected a fixture-only immutability violation during the standard suite. Verified the later-day/no-new-order case and duplicate-mark idempotency in the isolated database.
- Rebuilt and restarted Docker; inspected Today and Performance visually and through HTTP. Read-only Neon fingerprints confirmed unchanged 2,035 decisions, 120 orders, 21 marks and 815 outcomes.
- Updated README, current state, technical decisions and roadmap. Broader research/outcome tracking and publication to the remote scheduler remain explicitly outstanding. No commit/push or production execution was performed.

### 2026-09-06 — Astra project and personal-investing review

- User clarified that making money means improving their own investing results. Reviewed product direction, current source, remote HEAD, read-only Neon evidence and live Today/Performance UI; wrote [ASTRA_REVIEW_2026-09-06.md](ASTRA_REVIEW_2026-09-06.md).
- Confirmed the last three core collections and canonical runs; recent registered Form 4 dates are persisted and fresh insider evidence is being selected. The completion-safe hotfix is already on local/remote main, superseding the older awaiting-push note.
- Verified disconnected price histories, green Not overheated labels based on stale/partial input, and missing paper-mark updates for held stocks without pending orders. Documented exact examples and acceptance criteria; no runtime fix or policy change is claimed.
- Quantified the empty entry-aware strategy, missing outcomes and narrow prior-model measured sample. Recommended correctness repairs, continuous tracking and three current thesis reviews before further discovery expansion or score tuning.
- Reconciled current focus, Now/Next/Later and open dependencies with delivered features. Preserved existing constraints: no new provider, immutable history, explicit future policy versions, no broker orders.
- Verification: host typecheck/lint; full isolated suite 443/443 in 55 files; Docker production build 22/22; app restart; Today/Performance/Guide 200 and unauthenticated collect 401; test DB removed. Only the review and master document changed; no commit/push was performed.

### 2026-09-03 - Form 4 daily rolling-ingestion automation and first live run

- `ingest-form4.cjs` toetab nüüd exact on-demand range'i kõrval `--recent-days 7` režiimi, mis lõpeb eelmise `America/New_York` kalendripäevaga, ning automation'i `--fail-on-filing-error` väravat. PostgreSQL poolil on 10 sekundi connection timeout ja 30 sekundi statement timeout; olemasolev accession-idempotentsus, advisory lock ja ühe-accession'i atomaarne transaction jäid samaks.
- `collect-daily.yml` proovib live-jooksul Form 4 catch-up'i enne CompanyFacts before-snapshot'i ja põhicollecti. SEC tõrke korral saab core collect lõpuni joosta ja oma heartbeat'i saata, kuid workflow lõpuvärav teeb run'i punaseks; dry-run ingestion'it ei käivita.
- Esimene kasutaja kinnitatud live workflow run #16 (`33799380866`, commit `8a8468f`) näitas, et algne 15 minuti ingestion-step oli ühe suure päeva jaoks liiga lühike: 2026-08-27 indexis oli 904 Form 4/4A rida ning timeout'i eel jõuti `550/904` juurde (`372 persisted`, `178 skipped`, `0 failures`). `continue-on-error` töötas: core collect lõi collection run #29 (200 scanned, 64 candidates, live data saved), taaskasutas canonical run #60 (114 evaluated, 6 included), värskendas 89 outcome-rida ja saatis Healthchecks heartbeat'i `SENT (HTTP 200)`. Workflow lõpuvärav lõpetas run'i nähtavalt punasena ainult Form 4 timeout'i tõttu.
- Live-tõend paljastas ka partial-date freshness-riski: accession-atomaarne write ei tõesta, et kogu daily index on läbi töödeldud. Hotfix pre-registerib enne XML fetch'e ühe DB transaction'iga kõik kuupäeva distinct accession'id `discovered` olekus; selector arvestab source date'ina ainult kuupäeva, mille kõik registreeritud filingud on `persisted` ja millel on vähemalt üks original Form 4. Rolling režiim töötleb kuupäevi newest-first. Nii ei saa timeout ega crash osaliselt töödeldud uuemat päeva värskena esitada. Step/job piirid tõsteti vastavalt 40/55 minutile; core collecti isolation ja lõpu failure-gate jäid samaks.
- Uut migration'it, tabelit, data source'i, selection-policy kriteeriumi, score'i, rankingut ega UI-d ei lisatud. Live-jooksu Neon write oli eraldi kinnitatud; hotfixi verifikatsioon ei kutsunud SEC-i, ei käivitanud collecti ega teinud Neon-write'i.
- Esialgse automation-patch'i verifikatsioon: focused workflow/CLI suite **13/13**; `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; full Vitest **441/441** (55 faili, 421.29 s); production build compile'is edukalt ja genereeris 22/22 lehte. Hotfixi järel: focused **13/13**, full Vitest **443/443** (55 faili, 384.49 s), typecheck/lint/build rohelised ja 22/22 lehte. Buildi järel app-konteiner restartis; readiness-järgsed `GET /` ja `GET /today` vastasid 200 (24 573 / 154 440 baiti).

### 2026-09-03 - `/today` Business + Market situation

- Kandidaadikaardile lisati kõrvuti Business ja Market setup, mis taaskasutavad täpselt Paper Strategy V1 olemasolevaid pure state-funktsioone. Business on `Strong` ainult Growth ≥65, Health ≥65 ja Coverage ≥70 korral; Market setup eristab `Not overheated`, `Run-up elevated` ja ebapiisava salvestatud hinnaajaloo `Unknown` olekut. Mõlemad jäävad uurimiskontrolliks, mitte ostusignaaliks.
- Muudatus ei kirjuta DB-sse, ei loe paper-orderite tabelit ega muuda paper-policy't, canonical valikut, rankingut, score'e või skeemi. `/today` kasutab olemasoleva immutable canonical kandidaadi skoore ja selle snapshot-ajani salvestatud price-context'i.
- Verifikatsioon: `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; full Vitest **436/436** (54 faili, 366.05 s); production build compile'is edukalt ja genereeris 22/22 lehte. Buildi järel app-konteiner restartis ning `GET /today` vastas 200 (154 446 baiti). Visuaalne smoke kinnitas kahe võrdse ploki paigutuse ja et tänaste kandidaatide ebapiisav price history kuvatakse ausalt `Unknown`, mitte rohelise signaalina.
- Sama päeva unattended kontroll: cron-job.org sai nii Paper Strategy kui Nasdaq observeri dispatch'ilt kell 16:35 `204 No Content`. GitHub Actions paper run #2 täitis 12/12 orderit, jättis 0 pending/deferred orderit ja uuendas 7 tickeri marki; Nasdaq run #2 lõpetas 41 sekundiga, säilitas artifact'i ning raporteeris `Database: not connected; no writes`, 7 sündmust ja ühe lookup-ready Add'i (`JONE`).

### 2026-09-03 - Paper Strategy signal evidence `/performance` vaates

- Laiendati olemasolevat `/performance` tabelit immutable `eligibility_snapshot` põhise, kõrvuti Business + Market setup kuvaga. Täidetud baseline-order näitab nüüd samuti, miks signal loodi; entry-aware skip-põhjused ei ole enam ainus nähtav evidence.
- Parser aktsepteerib ainult `paper-strategy-signal-v1` contract'i koos lubatud enumite ja string-põhjustega. Legacy, exit ja malformed payload failivad suletult `unknown` olekusse; reegleid ei arvutata tänaste andmete pealt uuesti.
- Runtime-kontrollis leitud kõrvalviga parandati: skipped-only book ilma ühegi filled või pending orderita näitab `NO POSITIONS`, mitte eksitavat `VALUED`; pending-only, valued ja mark-missing seisud jäävad eraldi.
- DB skeemi, Paper Strategy lävesid, orderi täitmist, collecti, discovery't, scoringut ja rankingut ei muudetud. Neonile ei tehtud selle töö käigus ühtki write'i.

### 2026-09-03 - Nasdaq listing observation scheduler live

- Commitid `912a446` (Paper Strategy live-fill/scheduler dokumentatsioon) ja `ddb17b5` (Nasdaq parser, calibration CLI, artifact workflow ja testid) pushiti `origin/main`-i kahe eraldi review-batch'ina. Untracked dump'e ega `task-fixed.xml` faili ei lisatud.
- Cron-job.org job `stock-discovery nasdaq-listing-observation` klooniti olemasoleva repo-scoped Actions triggeri konfiguratsioonist, suunati `nasdaq-listing-observation.yml/dispatches` endpointi ja salvestati enabled olekus iga päev 09:35 `America/New_York`. Failure notification on enabled pärast üht failure'it; request jäi POST + `{"ref":"main"}`.
- TEST RUN sai GitHubilt `204 No Content` 1,65 sekundiga. GitHub Actions run #1 (`33683049513`) commitil `ddb17b5` lõpetas success'iga 33 sekundiga; `observe` job kestis 27 sekundit ning lõi ühe 73,3 KB artifact'i `nasdaq-listing-observation-33683049513-1`. Cronjobs list näitas jobi päriselt salvestatuna ja järgmist käivitust 2026-09-03 kell 16:35 Tallinn.
- Workflow ei saanud DB secret'it ega käivitanud collect'i, migratsiooni, discovery't, scoringut või rankingut; Neonile ei tehtud ühtki päringut ega write'i. Järgmine otsus tuleb alles 5–10 päris scheduled observation päeva järel.

### 2026-09-02 - Nasdaq new-listing Phase 1 read-only calibration collector

- Lisati puhas parser/classifier `scripts/_nasdaq-listings.cjs` ja DB-vaba CLI `scripts/calibrate-nasdaq-listings.cjs` / `npm run calibrate:nasdaq-listings`. Exact source-header või field-count muutus katkestab valjult; HTTP-l on 10 sekundi timeout ja kuni kolm katset. Source timestamp säilib koos `timeZone: null` tähisega ning täpne payload saab SHA-256 hash'i.
- `nasdaq-new-listing-observation-v1` eristab trading-system Add'i, Nasdaq-primary Q/G/S listingut, directory-confirmation'it ja lookup eligibility't. Test/ETF/NextShares/non-normal status ning warrant/unit/right/preferred/debt/fund jäävad excluded; SPAC/blank-check common jääb radar-only; ADS ei välistata pelgalt vormi tõttu. Esimene directory on baseline, diff tekib ainult eksplitsiitse varasema täieliku faili vastu.
- Päris 2026-09-02 source-jooks: directory 5,594 rida (Q 1,448 / G 2,474 / S 1,672), basic eligible 3,972, lookup-ready 2,928, radar-only 183 ja excluded 2,483. Adds/Deletes failis oli 10 sündmust (7 Add / 3 Delete): lookup-ready 0, radar-only 1 (`NSAI`), excluded 6, not-add 3; `NSAIR` klassifitseerus right'iks ja `NSAIW` warrant'iks. Ühtki DB ühendust, migratsiooni, Neon write'i, collect'i ega production pipeline'i muudatust ei tehtud.
- Verifikatsioon: focused Nasdaq suite **7/7**; `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; full Vitest ehitas 8 migratsioonist ainult lokaalse ephemeral `discovery_test` baasi ja läbis **419/419 testi, 51 faili, 409.18 s**; `npm run build` compile'is edukalt ja genereeris 22/22 lehte. `src/`, UI ja runtime diff on tühi, mistõttu standalone CLI muudatuse järel production app'i ei restartitud ega write-on-read smoke-route'e avatud.

### 2026-09-02 - Nasdaq new-listing daily observation workflow

- Calibration CLI `--artifact-dir` kirjutab workflow filesystemi täpsed `nasdaqlisted.txt` ja `TradingSystemAddsDeletes.txt` payloadid ning versioneeritud `observation.json` raporti. Hashid raportis lubavad hiljem kontrollida, et analüüs vastab säilitatud raw source'ile; ühtki DB ühendust ega kirjutust ei ole.
- Lisati eraldi `.github/workflows/nasdaq-listing-observation.yml`: ainult `workflow_dispatch`, Node 22, observer-step `timeout-minutes: 1`, job `timeout-minutes: 3`, artifact retention 30 päeva. Workflow ei saa `DATABASE_URL`/`NEON_DATABASE_URL` secret'it, ei käivita `collect:daily` ega migratsiooni ning ei saa mõjutada olemasoleva collection/Healthchecks/paper-strategy ahela ajastust.
- Fokusseeritud testid läbisid **10/10**: exact raw payloadide säilimine, versioneeritud raport/hashid, CLI argumendid ning workflow DB/collect-isolatsioon, timeout'id ja retention. Päris 2026-09-02 runtime artifact-smoke salvestas 347177-baidise directory, 701-baidise Adds/Deletes faili ja 6521-baidise raporti; schema/policy olid `nasdaq-listing-calibration-v1` / `nasdaq-new-listing-observation-v1` ning source hashid klappisid parseri raportiga. Täisverifikatsioon: typecheck exit 0; lint `No ESLint warnings or errors`; Vitest **422/422** (52 faili, 402.46 s) lokaalse ephemeral `discovery_test` vastu; production build compile'is edukalt ja genereeris 22/22 lehte. `src/`/UI diff on tühi, seega app'i ei restartitud ega Neoni vastu smoke-route'e avatud. Välist cron-job.org triggerit ei loodud veel; see tuleb teha alles pärast review'd, commit'i ja push'i.

### 2026-09-02 - Paper Strategy V1 first live hypothetical fill

- Kasutaja kinnitatud `npm run paper:strategy -- execute` jooksis Neoni golden source'i vastu 2026-09-02 kell 17:57 Tallinn / 10:57 New York, s.t USA regular session'i ajal. Tulemus: `pendingOrders: 12`, `filledOrders: 12`, `deferredOrders: 0`, `markedTickers: 7`, `reasons: {}`.
- Canonical run #59 kuus tickerit olid `SNDK`, `CIEN`, `ELF`, `BW`, `CRDO` ja `WTI`. Iga all-picks signal sai ühe `$100` strategy buy-fill'i ja ühe `$100` SPY benchmark buy-fill'i; mõlema book'i gross oli 600 $, tasu 0,60 $. Kõik quote'id olid Yahoo `USD` / `REGULAR`; seitse marki katsid kuut signaaltickerit ja SPY-d.
- Vahetu kordusjooks tõestas execution idempotentsust: `pendingOrders: 0`, `filledOrders: 0`, `deferredOrders: 0`, `markedTickers: 0`. Järgnenud `BEGIN READ ONLY` audit leidis run #59 jaoks endiselt 12 filled ja 12 skipped buy-rida, täitmisminutis 7 marki ning 0 duplikaatset order-identity gruppi.
- Õige Neoni `DATABASE_URL`-iga production `/performance` vastas HTTP 200, näitas kõiki kuut tickerit ja baseline'i 6/0/0 olekut. Esimene local smoke kasutas Nexti `.env.local` prioriteedi tõttu ekslikult külmutatud lokaalset `discovery` baasi ja näitas schema-missing state'i; server taaskäivitati protsessi tasemel Neoni URL-iga ning õige smoke läbis. Ühtki collect'i, migratsiooni, brokeri orderit ega muud production pipeline'i write'i selles kontrollis ei tehtud.
- Cron-job.org job `stock-discovery paper-strategy-execute` klooniti olemasolevast collect-job'ist, suunati `paper-strategy-execute.yml/dispatches` endpointi ning salvestati enabled olekus iga päev 09:35 `America/New_York`. Request jäi POST + `{"ref":"main"}`; cron-job failure-teavitus on sisse lülitatud pärast üht failure'it. TEST RUN sai GitHubilt `204 No Content` 1,68 sekundiga ja lõi GitHub Actions run #1 (`33676273191`), mis lõpetas `Success` 32 sekundiga; execution output oli idempotentselt 0 pending / 0 filled / 0 deferred / 0 marki. Cronjobs list näitas järgmist jooksu 2026-09-03 kell 16:35 Tallinn. Esimene päris unattended scheduled run ning paper-execution'i sõltumatu dead-man alerting jäävad eraldi kontrollpunktideks.

### 2026-09-01 - Paper Strategy V1 schema live on Neon

- Enne production apply'd näitas Neoni read-only `npm run migrate -- --status` täpselt üht pending migratsiooni (`0008_paper_strategy`) ning `--preflight` verdict'i `GO`: 7 olemasolevat migratsiooni, 0 andme-eelduse viga, 96 oodatud puuduvat objekti ja 0 baseline'i-välist lisaobjekti.
- Kasutaja eksplitsiitse kinnituse järel rakendas `npm run migrate -- --allow-golden-source` ainult `0008_paper_strategy` migratsiooni 244 ms-ga; `0001–0007` jäid checksum-klapiga `SKIP` olekusse.
- Järel-`--status` näitas `schema_migrations` tabelis 8 kirjet ja 0 pending migratsiooni. Read-only `--conformance` leidis 0 puuduvat tabelit, veergu, indeksit ja piirangut ning 0 baseline'i-välist objekti: verdict `VASTAB`.
- Apply järel ei käivitatud collect'i, `paper-strategy signal`/`execute` CLI-d ega workflow'd. Seega see samm aktiveeris ainult skeemi; esimese päris canonical signal capture'i, hypothetical fill'i ja `/performance` live-smoke'i tõendid on endiselt eraldi järgmised sammud. Brokeri integratsiooni ega päris ordereid ei ole.

### 2026-08-31 - Paper Strategy V1 local vertical slice (production activation pending)

- Lisati pending migratsioon `0008_paper_strategy`: `paper_strategy_orders` säilitab versioned all-picks/entry-aware strategy- ja same-cash-flow SPY book'i signalid/täitmised; `paper_strategy_marks` säilitab immutable Yahoo marke. Migratsioon rakendus ainult automaatselt loodud `discovery_test` baasi. Neonile migratsiooni, collecti ega paper-write'i ei tehtud.
- `recordPaperStrategySignals()` on canonical run'i kohta idempotentne. Iga kaasatud ticker loob mõlemas poliitikas strategy+benchmark buy-intent'i; korduv ticker uues canonical run'is loob uue `$100` intent'i. Baseline säilitab kõik valikud, entry-aware failib kinni mixed business state'i, puuduva current collection'i, ebapiisava price history või juba kõrge recent run-up'i puhul.
- `executePendingPaperOrders()` täidab ainult Yahoo explicit USD, `REGULAR` ja kuni 20 minuti vanuse quote'iga. Sama atomic transaction salvestab marki ja täidab pending orderid; kordus on idempotentne. USA aktsia komisjon on V1-s 0,1%, min $0.10, max $1. Ükski broker API ega päris order ei ole kooditeel.
- EXIT-policy nõuab kolme järjestikust current-collection-confirmed canonical evaluatsiooni, milles Growth on puudu/<65 või Coverage <70. Pelk rank'i muutus, tier-cap või top-listist kadumine ei tekita müüki. Strategy ja temaga seotud SPY võrdluspositsioon suletakse sama värske quote'i reegliga.
- `/performance` kuvab appi book'i ja SPY book'i eraldi, rahavood/P&L/return'i ainult teadaolevate markidega ning viimased signal/execution/skip faktid. Põhinavigatsioon koondati kuuele kasutajateele (Today, Discover, Research, Portfell, Performance, Kasutusjuhend); tehnilised auditid jäid ligipääsetavaks Diagnostika menüü alla, ühtki route'i ei eemaldatud.
- `paper-strategy-execute.yml` on tahtlikult ainult manual `workflow_dispatch`. Enne unattended mõõtmist peab kasutaja pärast `0008` eraldi production apply'd looma välise 09:30-järgse America/New_York triggeri; workflow puudumine ei tohi näida valmis schedule'ina.
- Verifikatsioon: fokusseeritud paper/migration suite 37/37; lõplik `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; full host `npm test` eraldi `discovery_test` baasi vastu rakendas 8 migratsiooni ja läbis **412/412 testi, 50 faili, 442.72 s**; lõplik `npm run build` compile'is edukalt ja genereeris 22/22 lehte, sh dynamic `/performance`. Buildijärgne mounted app-konteiner käivitus eraldi `performance_smoke_test` baasi vastu (`Ready in 7.4s`); `GET /`, `GET /today` ja `GET /performance` vastasid 200. In-app visuaalne kontroll leidis ning parandas empty-state'i: tehinguteta book kuvab nüüd `NO POSITIONS` ja väärtus/P/L on `unknown`, mitte roheline mõõdetud null. Seejärel app peatati ja täpselt nimetatud ajutine baas kustutati; järelkontroll leidis 0 vastavat andmebaasi.

### 2026-08-30 - Market-cap tier policy and pure canonical selection core

- Lisati versioned `market-cap-tier-policy-v1` päris successful-lookup P25/P75 piiridega: lower `< 1,791,164,000`, middle `1,791,164,000...48,338,040,831`, upper `>= 48,338,040,832`. Puhas selector võtab igast tier'ist kuni kaks oma canonical comparatori järgi, ei laena vabu kohti, ei sunni hõredat cohort'i täis ning jätab puuduva/vigase turukapitaliga ettevõtte ilma tier-kohata.
- Social `buildCandidates()` `$10B` ja canonical `$75B` hard ceiling eemaldati. `$10B` väärtus jäi ainult social discovery väiksema market-cap skoorikomponendi log-skaala ankruks; fund/ETF guard, blacklist, Growth/Coverage baasfiltrid, catalyst evidence ja muud score-valemid ei muutunud. Canonical mudeliversioon tõusis `rklb-discovery-v3`-ks; skeemi, migratsiooni, persisted tier-välja ega UI tier-gruppe ei lisatud.
- Eraldi ranking-bias paranduses jääb `scaleCriterion` endiselt nähtavaks evidence'iks, kuid seda ei loeta enam supported-criteria ranking-totalisse. Sama jagatud loendurit kasutab `/today` adjacent-rank read model, et tulevase v3 stored order'i seletus ei näitaks valet vastuolu. Dedicated test fikseerib nii vana scale-only rankingueelise kui uue scale-neutral järjestuse.
- Verifikatsioon: focused policy/ranking/boundary suite **24/24**; `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; full Vitest **395/395** (47 faili, 355,80 s) ephemeral `discovery_test` vastu; `npm run build` compile'is edukalt ja genereeris 21/21 lehte. Neon migration'it, collect'i ega DB write'i ei tehtud.
- Commiti-eelne 2026-08-30 read-only outcome baseline: **34 measured outcome'i / 6 tickerit**, keskmine excess return SPY vastu **−1,99 pp**, insider-only measured outcome'e **0**. See ei ole otsustamiseks piisav valim; järgmine policy review toimub 2–4 nädala pärast, kui rohkem 1m outcome'e on küpsenud. Seni uut feature-tööd ega rankingumuudatust ei tehta.

### 2026-08-29 - Historical market-cap counterfactual (superseded 2026-08-30)

- See kirje kirjeldab päriselt 2026-08-29 tehtud eelkatset, mitte 2026-08-30 current Phase 1 implementation'it. Standalone read-only calibration `scripts/calibrate-market-cap-tiers.cjs` / `npm run calibrate:market-cap-tiers` on nüüd külmutatud ainult `rklb-discovery-v1/v2` canonical ajaloole kuni 2026-08-29, et tulevased v3 run'id ei muudaks ajaloolist raportit. See loeb immutable decision'id ja olemasolevad outcome'id ühe `REPEATABLE READ READ ONLY` transaktsiooniga ning lõpetab `ROLLBACK`-iga.
- 16 run'i / 2026-08-11...29 päris Neoni kalibratsioon: actual 75 selection-observation'it, counterfactual 73, overlap 49, lisanduks 24 ja langeks välja 26. Alla-$10B tier jäi alla kolme ainult null-candidate v1 jooksus; `$10B–$75B` tier jäi alla kolme seitsmes varases jooksus. Alates 2026-08-19 on mõlemas tieris üheksa järjestikust täis-capacity run'i; seal lisanduks 23 ja langeks 14 observation'it.
- Counterfactual smaller tier lukustub 2026-08-19...29 kõigis üheksas jooksus täpselt BW/CAVA/ELF kolmikule; larger tier vahetub rohkem (keskmiselt 0,63 sisenemist/väljumist, Jaccard 71,3%). Outcome'id ei luba policy-võrdlust: 24 counterfactual-only observation'il pole ajaloolist outcome-rida, overlap-subsetis oli mõõdetud ainult viis 1-week tulemust ning pikematel horisontidel null. Katse `$10B/$75B` piirid ja quota 3 jäid ajalooliseks alternatiiviks; commit `23122c9` valis 2026-08-30 selle asemel päris lookup P25/P75 piirid, kolm tier'i ja quota 2.
- Verifikatsioon: focused pure + DB boundary suite **8/8**; `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; full Vitest **385/385** (45 faili, 351,66 s) ephemeral `discovery_test` vastu; `npm run build` compile'is edukalt ja genereeris 21/21 lehte. Päris report loeti Neonist ainult read-only transaktsiooniga; migratsiooni, collecti, write-on-read vaadet ega muud DB write'i ei käivitatud. App-konteiner ei olnud käivitatud ning `src/`/UI/runtime diff on tühi, seega kohalikku production restart/smoke'i selles standalone report-slice'is ei tehtud.

### 2026-08-27 - Form 4 Phase 4 immutable evidence on `/today`

- Phase 4 V1 on valmis kõigis neljas slice'is. Tulevane `form4-card-evidence-v1` snapshot säilitab lossless stringidena shares, reported price/share ja derived notional'i, explicit derivation method'i, SEC filing URL-i ning iga reporting owner'i kõik eraldiseisvad role flagid ja role text'i. `form4-insider-selection-v1` policy, threshold, cap, freshness, fund guard ja bucket precedence ei muutunud.
- Uus range parser tagastab ainult `complete`, `legacy`, `malformed` või puuduva evidence'i. Täielik payload nõuab original Form 4, korrektseid kuupäevi, teada derivation method'it, HTTPS SEC URL-i, vähemalt üht owner'it ja kõiki role booleane; ükski decimal ei läbi JavaScript `Number` teisendust. `today-brief.ts` loeb `raw_signal`-i olemasolevas `REPEATABLE READ READ ONLY` transaktsioonis. Growth-precedence DB-test tõestab, et Form 4 evidence jääb nähtavaks, samal ajal kui included/rank/Growth/Health/Coverage/catalyst otsuseväljad jäävad muutmata.
- `/today` expanded candidate detail kuvab eraldi `SEC Form 4 purchase evidence` raw-fact ploki: transaction date, security, shares, reported price/share, derived notional, `Reporting owner(s)` ning kõik sama owner'i Director/Officer/10% owner/Other/no-role labelid korraga, filing date/link ja aus on-demand source-date note. Currency sümbolit ei lisata; puuduv arv on `unknown`. Legacy/malformed item kuvab täpselt `Detailed owner/share/price evidence was not captured for this historical collection item.` Run #16 ega ühtki muud ajaloolist item'it ei backfillitud ning live operational Form 4 tabeli fallback'i ei ole.
- Muudatusega ei lisatud migratsiooni, score'i, rank'i, filtrit, canonical eligibility reeglit, uut allikat ega Form 4 schedulerit. `buildCandidates()` ja `src/lib/discovery.ts` diff on tühi. Focused Slice 2 kontroll läbis 26/26 ja focused Slice 3 kontroll 32/32 testi. 2026-08-29 exact Phase 4-only re-verification: typecheck exit 0; lint exit 0; isolated `discovery_test` Vitest **370/370** (41 faili, 363.57 s); production build compile'is edukalt ja genereeris 21/21 lehte. Isolated production server jõudis `Ready in 2.3s`; read-only `GET /` vastas 200 (23,827 baiti) ja `GET /today` 200 (125,448 baiti). Ajutine preview route kontrollis complete, missing-data, multi-role ja legacy variante desktop/mobile kujul ning eemaldati seejärel täielikult; production collecti ei jooksutatud.

### 2026-08-29 - CompanyFacts queue observer + Form 4 Phase 4 Slice 1

- Lisati standalone `scripts/report-companyfacts-queue.cjs` / `npm run observe:companyfacts`. Iga snapshot kasutab üht `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` transaktsiooni, ainult `SELECT`/`WITH` päringuid ja lõplikku `ROLLBACK`-i; providerivõrku, collectorit ega write-on-read app-koodi ei impordita. JSON sisaldab versionit, DB nime, observation time'i/Tallinna päeva, missing/stale/never-attempted queue jaotust, ordered queue'd, latest status't, error category't ilma error text'ita, oldest `companies.created_at` proxy't ning paired-window attempts/entrants/deltas. Lifetime attempt count'i skeem ei säilita, seega `attemptCount` on ausalt null + `not_stored`, mitte tuletatud oletus.
- GitHub Actions teeb before snapshoti vahetult enne `collect:daily` sammu ning after snapshoti `if: always()` järel. Mõlemad observer-sammud ja 30-päevane private artifact upload on `continue-on-error`, seega telemetry tõrge ei blokeeri collection'it ega muuda selle exit status't. Reliability review lisas mõlemale observer-sammule `timeout-minutes: 1`, PostgreSQL poolile 10 sekundi connection timeout'i ja 30 sekundi statement timeout'i; hung observer ei saa enam kogu 10-minutilist job'i eelarvet enne collectorit ära kulutada. Failed/dry-run/missing-half/duplicate-day observation märgitakse partial'iks ja jäetakse tulevastest normaalsetest throughput-percentile'itest välja. `DAILY_FINANCIAL_ENRICHMENT_LIMIT=5`, retry-aknad, queue ordering, collect/discovery/scoring/ranking ja skeem jäid muutmata.
- Phase 4 Slice 1 lisas tulevastele `raw_signal.insider` payload'idele `evidenceVersion = form4-card-evidence-v1`. Selector külmutab transaction/accession/form/filed/date/security, shares, reported price, derived notional + method, SEC filing URL-i ja kõik reporting-owner read koos director/officer/10%-owner/other/no-role flagide, officer title'i ja other text'iga. PostgreSQL `NUMERIC` castitakse JSON-i eel tekstiks, et üle `Number.MAX_SAFE_INTEGER` ja murdosaga arvud säiliksid lossless kujul.
- `form4-insider-selection-v1` policy, threshold, source freshness, original Form 4, P+A/non-derivative, director/officer nõue, fund guard, 20 issueri cap ja järjestus ei muutunud. `buildCandidates()`, canonical discovery, score'id, ranking ja market-cap reeglid jäid puutumata. Currency välja ega sümbolit ei lisatud. Legacy payloadi test tõestab, et evidenceVersion'i või uusi välju ei lisata ajaloolisele reale; backfilli ei tehtud. Slices 2–4 ja `/today` UI jäävad eraldi järgmisteks sammudeks.
- Focused observer suite läbis pärast timeout-hardeningut 7/7. 2026-08-29 exact CompanyFacts-only detached-checkout kontroll: typecheck exit 0; lint `No ESLint warnings or errors`; Vitest **377/377** (43 faili, 429.91 s) ephemeral `discovery_test` baasi vastu; production build compile'is edukalt ja genereeris 21/21 lehte. Neonile ei rakendatud migratsiooni, observerit ega collecti; `DAILY_FINANCIAL_ENRICHMENT_LIMIT` ja queue ordering jäid muutmata.

### 2026-08-26 - Healthchecks.io dead-man switch, live end-to-end proof

- Lisati ainult CLI-põhine dead-man-switch heartbeat: `scripts/collect-daily.cjs` kutsub jagatud `_healthchecks.cjs` helperit kõige lõpus pärast summary't. GET on lubatud ainult juhul, kui jooks ei ole dry-run, ükski orkestreeritud samm ei lisanud viga, canonical funktsioon tagastas run'i ning järelpäring kinnitas tänase Tallinna päeva canonical rea. Nii uus kui idempotentselt taaskasutatud run kvalifitseerub; advisory-locki varajane väljumine ja partial/failure teed ei pingi.
- Healthchecksi enda võrgu- või HTTP-tõrge on teadlikult best-effort: logitakse URL-i avaldamata selge warning ja collection'i edukat exit-koodi ei muudeta. `collect-route-handler.ts`, skeem, migratsioonid, DB, collect/discovery/scoring/ranking ning välisallikad jäid muutmata.
- `.env.example` ja GitHub Actions workflow sisaldavad valikulist tühja `HEALTHCHECKS_PING_URL` konfiguratsiooni; README kirjeldab mõlema keskkonna seadistust. Päris väärtus on kasutaja poolt seatud nii lokaalses `.env`-is kui GitHub Actionsi repository secret'is ega ole logidesse või dokumentatsiooni kopeeritud.
- Healthchecks.io check `stock-discovery collect-daily` on cron-režiimis `0 8 * * *`, timezone `Europe/Tallinn`, grace 2 tundi: signaali puudumisel alert kell 10:00 Tallinn. Email integration oli `Ready to deliver` ja seotud 1/1 check'iga.
- Verifikatsioon enne live-jooksu: fokusseeritud suite läbis 9/9 testi; `npm run typecheck` ja `npm run lint` lõpetasid exit 0-ga; hostilt dokumenteeritud `TEST_DATABASE_URL=postgres://discovery:discovery@localhost:5433/discovery_test` vastu jooksnud `npm test` ehitas skeemi 7 migratsioonist ja läbis **354/354 testi, 39 faili, 453.58 s**; `npm run build` compile'is edukalt ning genereeris 21/21 lehte. Buildijärgne app-konteiner restartis; readiness-järgsed read-only `GET /` ja `GET /today` vastasid mõlemad 200.
- **Päris end-to-end tõend:** lokaalne `npm run collect:daily` kirjutas Neoni collection run #19 (`captureDate=2026-08-26`, scanned 200, candidates 32, liveDataSaved true), enrichis SEC 5/5 ja classification 5/5, lõi uue canonical run #49 (74 evaluated, 5 included, 25 uut outcome'i) ning lõpetas alles seejärel `Healthchecks heartbeat: SENT (HTTP 200)`. Värskelt laetud Healthchecks dashboard muutis `Last Ping` väärtuse `Never` → `19 seconds ago`. See tõendab kogu teed collect success → tänase canonical rea järelkontroll → external heartbeat, mitte käsitsi ping URL-i avamist.

### 2026-08-25 - Silent automation gap, root cause and recovery

- **Incident window:** päris automaatne cadence ei käivitunud pärast 2026-08-20 Tallinna aja kolme initial setup/test workflow'd kuni 2026-08-25 parandatud GitHub Actions jooksuni — umbes kuue päeva automation gap. Neon sisaldab vahepeal käsitsi/lokaalselt käivitatud collection'e, kuid planeeritud arvutitest sõltumatu ahel ei töötanud iga päev. See oli varem dokumenteeritud failure-without-alerting risk ning avastati alles `collect:status`, Neoni ledgeri ja triggerilogide käsitsi võrdlemisel.
- **Root cause 1 — primary trigger puudus:** signed-in `cron-job.org` dashboard näitas 0 enabled, 0 disabled ja `No jobs found`; seega scheduled job ise oli puudu / ei olnud püsivalt salvestunud. Täpne kadumise põhjus jäi teadmata. GitHub Actions API kinnitas, et enne parandust oli `collect-daily` workflow'l kokku ainult kolm `workflow_dispatch` setup-jooksu (`32309329544`, `32309873365`, `32311991085`), kõik 2026-08-19 UTC / 2026-08-20 Tallinn, ning mitte ühtki hilisemat automaatset dispatch'i.
- PAT ei olnud põhjus: `cron-job-org-collect-daily` fine-grained token eksisteeris, oli aktiivne, aegub 2027-08-20, oli kasutatud viimase nädala jooksul ning omas ainult `mnoormets/stock-discovery` repo scope'i, `Actions: Read and write` ja `Metadata: Read` permission'eid.
- **Root cause 2 — backup trigger tõrkus sõltumatult:** Windows `StockDiscoveryDailyCollect` transcript 2026-08-21 19:25:56...19:33:07 näitas korduvaid puuduva Docker API vigu ja lõppes `Docker ei kaivitunud 240s jooksul, katkestan.` 2026-08-24 transcript puudus; Windows System log kinnitas shutdown'i 00:33 ja järgmise boot'i alles 2026-08-25 18:59. Task on interactive-only ja `WakeToRun = false`, seega 08:05 trigger ei saanud 24. augustil käivituda. Task Scheduleri Operational log oli disabled, mistõttu eraldi historical event-id ajalugu puudus.
- **Root cause 3 — pärast primary triggeri taastamist ilmnenud eraldi secretiviga:** recreated cron job jõudis taas GitHubi dispatch'ini, kuid repo Actions secret `NEON_DATABASE_URL` sisaldas poolikut ühendusstringi, mis lõppes keset query-stringi `?sslm`. See põhjustas GitHub workflow'des eraldi `EAI_AGAIN` / insecure connection tõrked. Tõenäoline allikas on varasema secret update'i mittetäielik copy/paste; GitHub ei säilita vana secret value't nähtaval kujul, seega põhjust ei saa tugevamalt tõestada.
- **Recovery:** `cron-job.org` job loodi uuesti olemasoleva kehtiva PAT-iga ja `NEON_DATABASE_URL` asendati `.env` täieliku Neoni connection string'iga. Kaks esimest 2026-08-25 workflow dispatch'i (`32881846980`, `32882524890`) lõppesid failure'iga; parandusejärgne `32883230677` käivitus 18:21:01Z ja lõppes 18:24:28Z success'iga.
- **Golden-source proof:** GitHubi success workflow lõi Neoni collection run #18 (`2026-08-25T18:21:36.423914Z...18:22:53.877935Z`, `status=success`, `error_message=NULL`): scanned 200, candidates 27, Yahoo fundamentals 77, lookup total 78 (growth 64 + insider 14), live data saved true. See tõendab päris `workflow_dispatch → collect:daily → Neon` taastumist, mitte ainult preflight'i.
- **Open / kõrgem prioriteet:** kontrollida eraldi, et GitHub Actions repo-owner failure notification/email on päriselt enabled, ning et recreated `cron-job.org` job'i `execution fails` notification on enabled. Mõlemad olid incident'i dokumenteerimise hetkel kinnitamata; uut alerting implementation'it selles sessioonis ei tehtud.

### 2026-08-23 - Phase 4 approval and CompanyFacts observation plan

- Kasutaja kiitis Phase 4 Option B disaini heaks eraldi tulevase implementation task'i jaoks: tulevane täielik evidence külmutatakse `raw_signal`-is, label on `Reporting owner(s)`, currency sümbolit ei lisata ilma filing'u explicit currency'ta ning V1 surface on ainult `/today`.
- Run #16 ega teisi legacy collection item'e ei backfillita. Kui täielikku immutable payload'i ei püütud, peab UI tulevikus ausalt ütlema, et detailset owner/share/price evidence'it selle historical item'i jaoks ei salvestatud. Selles sessioonis UI- ega production code'i ei rakendatud.
- CompanyFacts queue puhul kaldub eelistus source-neutral budget increase'i poole, kuid `DAILY_FINANCIAL_ENRICHMENT_LIMIT` jäi muutmata. Enne uut numbrit kogutakse kavandatult 7–14 valid daily observation'it: entrants, attempts/success/unavailable/error, depth before/after ja oldest never-attempted age.
- Lisati proposal [`docs/COMPANYFACTS_QUEUE_OBSERVATION_PLAN.md`](COMPANYFACTS_QUEUE_OBSERVATION_PLAN.md): standalone `BEGIN READ ONLY` before/after snapshotid scheduled collect'i ümber ning JSON/NDJSON workflow artifact, ilma migration'i või DB write'ita. Observerit ega schedule'it selles sessioonis ei rakendatud.

### 2026-08-23 - Task 3: CompanyFacts enrichment queue read-only audit

- Neoni audit jooksis `BEGIN READ ONLY` transactionis ja lõppes `ROLLBACK`-iga; collecti, enrichment'i, migration'it ega muud production write'i ei kutsutud. Täisraport: [`docs/COMPANYFACTS_QUEUE_AUDIT_2026-08-23.md`](COMPANYFACTS_QUEUE_AUDIT_2026-08-23.md).
- Run #16 sisaldas 16 insider item'it, kuid ainult 14 uut company identity't. KEEL-il oli 44 fact'i / 15 canonical decision'it ning GO-l 239 fact'i / 11 decision'it; mõlemad olid juba scoring-eligible. Ülejäänud 14-l oli 0 facts, 0 score snapshot'i, 0 decision'it ja puuduv enrichment status.
- Current queue oli 120 rida: 81 missing-facts, 39 stale-facts, 85 never-attempted. Uncovered run-#16 read olid positsioonidel 1–12, 15, 16; frozen queue + 5 all-success attempti/päev annaks viimase katse 4. collection päeval. PCF on historical fund edge ning jääb generic queue'sse, sest Task 1 ei kirjuta immutable run'i ümber ja `quote_type` on NULL.
- Täna olid viis slot'i enne run #16 juba kulunud tickeritele CBRS, IBKR, IT, SNDK, SNOW; kõik viis olid success. Queue `latest_price_at DESC` tie-breaker tähendab, et uuemad lookupid võivad tänastest ridadest ette hüpata, mistõttu 4 päeva on lower bound, mitte garantii; unavailable/error võib eligibility't veel edasi lükata.
- Review-valikud on unchanged, absolute insider priority, reserved insider quota, source-neutral budget 5→10 või duplicate immediate path (viimane pole soovitatud). Reserved split ja budget increase on päris toote/koormuse tradeoff; kumbagi ei valitud ega rakendatud vaikides.
- Dokumentatsioon-only täisverifikatsioon: `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; isolated Docker `npm test` läbis **345/345 testi, 38 faili, 254.87 s**; `npm run build` compile'is edukalt ja genereeris 21/21 lehte. Buildijärgne app restart jõudis `Ready` olekusse ning read-only `GET /` ja `GET /today` vastasid 200.

### 2026-08-23 - Task 2: Phase 4 Form 4 evidence-display design

- Lisati review-only disain [`docs/FORM4_EVIDENCE_DISPLAY_PHASE4.md`](FORM4_EVIDENCE_DISPLAY_PHASE4.md); UI-d, selectorit, persistence'i, score'i, rankingut ega canonical discovery't ei muudetud.
- Soovitus on külmutada tulevastesse `collection_run_items.raw_signal.insider` payload'idesse versioned raw-fact snapshot ning lugeda `/today` kaartidel seda, mitte teha historical decision'i renderdamisel live join'i operational Form 4 tabelitesse. Run #16 jääb ausalt partial-legacy evidence'iks; backfill'i ei pakuta vaikimisi.
- Iga reporting owner säilitab alati director/officer/10%-owner/other/no-role väljad ja officer title'i. Evidence ei loo conviction-, materiality-, direction-, score- ega rank-hinnangut.
- Kasutaja kinnitas hiljem kõik kolm allikapiiri: joint filing kasutab label'it `Reporting owner(s)`; currency sümbolit ei lisata ilma filing'u explicit currency'ta; V1 surface on ainult `/today`.
- Dokumentatsioon-only täisverifikatsioon: `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; isolated Docker `npm test` läbis **345/345 testi, 38 faili, 234.67 s**; `npm run build` compile'is edukalt ja genereeris 21/21 lehte. Buildijärgne app restart jõudis `Ready` olekusse ning read-only `GET /` ja `GET /today` vastasid 200.

### 2026-08-23 - Task 1: PCF closed-end-fund selection guard

- Read-only Neoni evidence kinnitas põhjuse: PCF filing `0001398344-26-015264` oli original Form 4, issuer `HIGH INCOME SECURITIES FUND`, director-role true ning suurim qualifying derived notional `$54,000`, seega läbis range `$50,000` v1 transaction/policy piirid. `companies.quote_type` oli NULL ning senine fallback tundis `Index Fund`, kuid mitte eraldiseisvat sõna `Fund`.
- Jagatud `looksLikeFundOrEtf()` fallback tunneb nüüd sõna `Fund`; `selectNotableInsiderIssuers()` filtreerib SEC issuer-name'i järgi fondid/ETF-id enne eligible loendurit ja 20 issueri cap'i. `buildCandidates()` funktsiooni, scoringut, rankingut ega canonical discovery loogikat ei muudetud.
- Regression katab päris PCF nime ja `$54,000` ostu, `Funding` mitte-false-positive'i ning 23 filinguga cap-juhtumi: kõrge notionaliga PCF ei võta 20 eligible operating-company slot'i. Focused suite läbis 17/17 testi.
- Täisverifikatsioon: `npm run typecheck` exit 0; `npm run lint` — `No ESLint warnings or errors`; Docker `npm test` ehitas `discovery_test` skeemi seitsmest migratsioonist ja läbis **345/345 testi, 38 faili, 440.43 s**; `npm run build` compile'is edukalt ja genereeris 21/21 lehte. Pärast build'i restarti näitas app `Ready`; esimene liiga varane probe katkes, readiness-järgne read-only `GET /` ja `GET /today` vastasid 200.
- Neonile ei rakendatud migratsiooni, collecti ega muud write-operatsiooni; Task 1 Neoni kasutus oli ainult eeltoodud PCF SELECT.

### 2026-08-23 - SEC Form 4 Phase 3 insider lookup bucket (committed; schema live)

- Lisati forward-migratsioon `0007_insider_lookup_bucket`: mõlema bucket CHECK-i lubatud väärtustesse `insider` ning `collection_run_items.insider_rank`. Pärast testharnessi ephemeral `discovery_test` kontrolli rakendas kasutaja kinnitatud `npm run migrate -- --allow-golden-source` selle Neonile 113 ms-ga; `0001–0006` jäid checksum-matching SKIP olekusse.
- `selectNotableInsiderIssuers()` rakendab `form4-insider-selection-v1`: latest persisted original Form 4 source date, non-derivative `P+A`, director/officer, derived notional rangelt üle $50k, deterministic rank ja max 20. 4/A ning 10%-owner-only on selectionist väljas. Üle viie kalendripäeva vana source märgitakse stale'iks ja selector failib kinni null valikuga; source date/age/stale jäävad collection metricsisse.
- Collector unionib kuni 20 insider tickerit social growth/recall lookupidega ja säilitab precedence'i `growth > recall > insider > not_selected`. Insider-only item'i mention/rank jääb NULL; role-aware Form 4 evidence läheb `raw_signal.insider` alla. `buildCandidates()` saab jätkuvalt ainult ApeWisdomi prefiltered read ning social scoring/ranking/`$10B` filter jäi muutmata. Insider path'i lookupil ei ole eraldi market-cap lage; canonical `$75B` piir jääb jõusse.
- Downstream contract tunneb insider bucketit outcome snapshotis ja `/today` source-path/count kuvades. See ei ole transaction evidence UI ega uus score. Form 4 ingestion jääb on-demand; automatic schedule'i ei lisatud.
- Teadlik launch limitation: uued insider companies lähevad olemasolevasse 5/day CompanyFactsi queue'sse. Phase 3 ajal kasutatud umbes 10 päeva oli kalibreerimata hinnang; hilisem run #16 read-only audit mõõtis nende konkreetsete ridade frozen-queue lower bound'iks 4 collection päeva, kuid ei anna arrival/failure tõttu SLA-d. Phase 3 ei muuda queue prioriteeti ega eelarvet; võimalik Phase 3.5 otsustab selle päris forward-andmete põhjal.
- Verifikatsioon enne review'd: `npm run typecheck` exit 0; `npm run lint` andis `No ESLint warnings or errors`; full Docker `npm test` ehitas `discovery_test` skeemi 7 migratsioonist ja läbis **344/344 testi, 38 faili, 213.43 s**. `npm run build` compile'is edukalt ja genereeris 21/21 lehte. Pärast build'i käivitati `app` uuesti; logis `Ready` ning read-only `GET /` ja `GET /today` vastasid mõlemad 200. Collecti ega migration apply'd smoke ei kutsunud.
- Lõplik read-only Neoni `npm run migrate -- --status` näitas `neondb`, 7 `schema_migrations` rida, `0001–0007 applied` ja 0 rakendamata migratsiooni. `0007` applied-at on `2026-08-23T12:23:37Z`, kestus 113 ms.
- Kasutaja kinnitatud esimene production `npm run collect:daily` lõi eduka collection run #16 (`2026-08-23T12:56:07.589Z...12:56:28.397Z`): scanned 200, social candidates 8, Yahoo fundamentals 36, Tradestie fallback, FMP requested 0. `insiderSignal` oli `form4-insider-selection-v1`, source filed date 2026-08-21, age 2, stale false, eligible 16, selected 16, social overlap 0. Lookupid: growth 20 + recall 0 + insider 16 = 36.
- Run #16 tickeriaudit: 16/16 insider item'it olid `lookup_bucket=insider`, selected, Yahoo market-data found, null skip reason, company-FK-ga ning said run'i ajal hinnasnapshoti. 14 company identity't loodi esimest korda; KEEL ja GO kasutasid olemasolevat identity't. Kogu run lisas 37 price snapshoti: 36 lookup-tickerit + SPY.
- ELAN jõudis insider-only path'il lookup/persistence'i market cap'iga $11,975,934,976, mis tõendab, et social `$10B` filter ei piira insider path'i. Canonical run #45 reuse'is sama Tallinna päeva immutable snapshoti (`inputChangedAfterSnapshot=JAH`), seega uusi outcome'e ei loodud; see ei ole rankingumuudatus.
- Avatud kvaliteediäär: insider rank #16 PCF resolve'us Yahoo järgi nimeks `High Income Securities Fund`, kuid `companies.quote_type` jäi NULL. V1 policy ei sisalda fund-exclusion'it ning see run ei õigusta vaikset policy muutust; enne võimalikku Phase 3.5/selector v2 otsust tuleb mõõta, kui sage see edge case on ja kas canonical olemasolevad ETF/CompanyFacts piirid välistavad selle piisavalt.

### 2026-08-23 - SEC Form 4 Phase 2 Neon apply + bounded live ingestion

- Read-only `--status` ja `--preflight` kinnitasid sihtbaasiks Neoni `neondb`, viis rakendatud migratsiooni, täpselt ühe pending `0006_insider_form4_persistence` migratsiooni, 0 precondition-viga ja `GO` verdict'i. Eksplitsiitselt kinnitatud `npm run migrate -- --allow-golden-source` rakendas ainult `0006` 224 ms-ga; järel-`--status` näitas 6/6 applied ja `--conformance` `VASTAB` (0 missing/extra objekti).
- Eksplitsiitselt kinnitatud bounded ingestion `2026-08-19...2026-08-21` töötles SEC indexist 3636 Form 4/4A rida: 1742 distinct accession'it persisted, 1894 accession-duplikaati idempotently skipped, `fetchFailed=0`, `parseFailed=0`, `persistFailed=0`, SEC päringuid 1746. Päevade persisted accession'id olid 692 / 474 / 576 ning distinct issuerid 354 / 297 / 281.
- Neonisse salvestus 1742 filingut, 1894 struktureeritud reporting-owner rida, 4488 transaction'it ja 6691 field-scoped footnote'i. Kõik filingud on `persisted`. 35 Form 4/A filingust linkis 3 täpselt originaliga, 32 jäi ausalt `unresolved` ja 0 oli `ambiguous`; ühtki amendment'i ei kirjutatud originali peale.
- Owner-role päring kinnitas multi-label säilimise: director 846, officer 1117, 10% owner 309, other 36, no-declared-role 0. Need loendurid kattuvad rollide lõikes teadlikult, sest üks owner võib kanda mitut rolli.
- Ingestion-window `2026-08-23T10:23:52.175Z...10:44:05.294Z` read-only audit andis 0 uut rida tabelites `companies`, `collection_runs`, `collection_run_items`, `discovery_runs`, `discovery_decisions`, `candidate_outcomes`, `company_score_snapshots`, `data_quality_snapshots` ja `outcome_analysis_snapshots`. See on päris Neoni tõend, et on-demand ingestion jäi production discovery/scoring/ranking pipeline'ist eraldatuks.
- Selles sessioonis ei loodud uut värsket pre-`0006` dump'i; apply tehti kasutaja eksplitsiitse kahe-etapilise kinnituse järel olemasoleva Neoni golden source'i vastu. Pärast skeemi apply'd production build'i ei tehtud ja app oli juba peatatud; seetõttu app-restarti ega UI smoke'i ei olnud vaja. Phase 3, notable-policy ja UI jäävad endiselt eraldi otsuseks.

### 2026-08-23 - SEC Form 4 Phase 2 on-demand ingestion and persistence

- Lisati pending forward-migratsioon `0006_insider_form4_persistence`: `insider_filings`, struktureeritud `insider_reporting_owners`, `insider_transactions`, field-scoped `insider_transaction_footnotes` ja canonical `insider_transaction_owner_evidence` view. Migration on rakendunud ainult iga testijooksu ephemeral `discovery_test` baasi; Neon `schema_migrations` jäi viie rea peale ja `0006` ei rakendatud.
- Reporting-owner rollid on neli eraldi non-null boolean'i (`director`, `officer`, `10% owner`, `other`) ning explicit no-declared-role. Iga transaction sisaldab mandatory filing-level role context'i; cross-table trigger keelab owner-ridadest erineva kokkuvõtte ning teine trigger keelab owner-set'i muutmise pärast transaction'ite teket. 10% owner ei collapse'u generic insider ega management conviction sildiks.
- Phase 1 SEC pacing/index/parser kood tõsteti jagatud `scripts/_form4.cjs` moodulisse ja calibration script kasutab seda otse. Parser lisab accession/provenance/hash'i, EDGAR acceptance timestamp'i korrektse `America/New_York` tõlgenduse, original-submission date'i, derivative/non-derivative väljad, nullable transaction-level 10b5-1 ning field-scoped footnote'id. Uut XML dependency't ei lisatud.
- `persistForm4Filing()` kasutab üht checked-out client'i, `BEGIN` + `pg_advisory_xact_lock(accession)` + üht `COMMIT`-i. Testis sisestati ownerid ja sunniti järgmine transaction CHECK vea `23514` peale: rollback järel säilis ainult enne fetch'i loodud retry stub, owner/transaction/footnote ridu oli 0 ning parser/hash väljad olid NULL. See tõendab all-or-nothing parsed content'i ühe accession'i kohta.
- Idempotentne persisted accession on immutable no-op. 4/A säilib eraldi filinguna; transparent v1 matcher seob issuer CIK + original submission date + period + owner-set abil täpselt ühe originali, muidu jääb `unresolved` või `ambiguous`. Mõlemad ingestion-järjekorrad (original enne/pärast amendment'i) on DB-testiga kaetud.
- Lisati ainult explicit on-demand `scripts/ingest-form4.cjs` / `npm run ingest:form4 -- --from ... --to ...`, range max 31 kalendripäeva ja eraldi run advisory lock. Skripti ei schedule'itud ega imporditud collect/discovery/scoring/ranking teele. Päris SEC ingestionit ei käivitatud ning Neonile ei kirjutatud.
- Verifikatsioon: focused Form 4 + infra **36/36**; `npm run typecheck` exit 0; `npm run lint` exit 0 ja `No ESLint warnings or errors`; lõplik full Vitest **335/335**, 37 faili, 207,51 s, isolated `discovery_test`; `npm run build` exit 0, compile success ja 21/21 lehte. Pärast build'i restartiti `app`; esimene startup-aegne curl oli 000, lõplik valmisolekujärgne `GET /` ja `GET /today` mõlemad 200.

### 2026-08-23 - SEC Form 4 Phase 1 read-only calibration

- Lisati ainult eraldiseisev `scripts/calibrate-form4.cjs` ja npm käsk `calibrate:form4`; `collect.ts`, `discovery.ts`, ranking, scoring, skeem ja production pipeline jäid muutmata. Skript kasutab `SEC_USER_AGENT`-i, 10 sekundi timeout'i, järjestikust vähemalt 200 ms pacingut (kuni 5 req/s), `Retry-After`/bounded retry'd ning kirjutab ainult konsooli või eksplitsiitselt nimetatud lokaalset raportifaili.
- Enne parserit kontrolliti päris 2026-08-21 form-indexit ja complete submission XML-i. Parser loeb embedded `ownershipDocument` väljad: X0609 schema, issuer CIK/ticker, reporting-owner multi-label rollid, non-derivative transaction code, A/D, shares, price ja price footnote'id. Purchase tähendab rangelt `code=P` + `acquired/disposed=A`; derivatiive, award'e ega muid acquisition-koode ei loeta.
- Täispopulatsiooni päris jooks `2026-08-21,20,19 --max-filings-per-day all` tegi 3639 SEC päringut ja parsis 3636/3636 filingut null veaga. Päevased index-loendurid 1200/995/1441; P+A filingud 139/158/142; distinct issuerid 56/71/55; kasutatava tickeriga issuerid 54/70/54.
- Neon overlap kasutas ainult `BEGIN TRANSACTION READ ONLY` + `SELECT ticker, sec_cik FROM companies` ja luges 143 company rida. Olemasoleva universumiga kattus 5/182 issuer-day vaatlust (2,7%); potentsiaalselt uusi kasutatavaid tickereid oli päevade peale 173 issuer-day ehk keskmiselt 57,7 päevas. Midagi DB-sse ei kirjutatud.
- 701 P+A transaction'i kõigil oli numbriline price; 265/701 ehk 37,8% oli footnoted ja 436/701 clean. Transaction notional mediaan oli $25 120, p90 $978 658 ja max $324 032 894; jaotus on tugevalt paremale kaldu. Reporting-owner rollid on multi-label: 588 owner-recordist director 340, officer 176, 10% owner 288, other 34. See tõendab, et Phase 2 poliitika ei tohi tugineda ainult dollarilävele ega nimetada kõiki suuri 10% owner'i oste juhtkonna conviction'iks.
- Raport on [`docs/FORM4_CALIBRATION_2026-08-23.md`](FORM4_CALIBRATION_2026-08-23.md). Phase 2-4 ei ehitatud ega ole automaatselt heaks kiidetud; amendment reconciliation, notable-policy, persistence, discovery bucket, evidence UI ja score/ranking mõju jäävad eraldi otsuseks.
- Verifikatsioon: `npm run typecheck` exit 0; `npm run lint` exit 0 ja `No ESLint warnings or errors`; full Vitest **323/323**, 35 faili, 177,82 s, isolated `discovery_test`; `npm run build` exit 0 ja 21/21 lehte. Pärast build'i restartiti `app`; smoke `GET /` ja `GET /today` mõlemad 200.

### 2026-08-22 - Esimene MIN_MENTIONS 3 päris golden-source collect

- `npm run collect:daily` jooksis commit'i `7417bec` pealt Neoni `neondb` vastu ja lõpetas exit 0-ga. Docker Desktop töötas; lokaalne db oli healthy, kuid päris collect ei kirjutanud külmutatud lokaalsesse `discovery` baasi.
- Collection run #14: `scanned 200`, raw mention-jaotus 5+ = 26, 3-4 = 20, 0-2 = 154; market-data lookup 27 growth + 0 recall = 27, Yahoo found 27/27, `candidates 11`. Tradestie ebaõnnestus ning ApeWisdom fallback töötas; FMP võti puudus.
- Läve mõju samas immutable item-valimis: 5+ rühm andis 11 lookup'i ja 3 kandidaati, läve 3 poolt lisatud 3-4 rühm 16 lookup'i ja 8 kandidaati. Võrreldes varasema 16-23 lookup'i vahemikuga on 27 suurem, kuid 80 growth / 100 total cap ei olnud sellel madala tähelepanuga laupäeval lähedalgi täitumisele.
- Canonical run #44 oli uus: 59 hinnatud, 5 kaasatud, 54 välistatud; SEC enrichment 5/5 ja classification enrichment 5/5 õnnestusid, candidate outcome'e loodi 25. Korduscollect'i ei tehtud.

### 2026-08-22 - Social attention threshold 3 + 100 lookup capacity

- Read-only Neoni audit kasutas kõiki üheksa edukat item-bearing collection run'i ja eraldas kordusjooksudest neli eri capture-date'i. Raw `mentions >= 5` / `< 5` latest-run jaotus oli 2026-08-20 81/118, 08-19 82/116, 08-17 81/119 ja 08-16 30/170; ajalooline 16/200 eligible leid pärines viimasest madala tähelepanu päevast, mitte selector-cap'ist.
- Current blacklistiga simulatsioon andis lävel 5 keskmiselt 41,5 eligible tickerit, lävel 3 65,5 ehk +24 päevas. Lävi 3 oleks andnud tegelikke lookup'e keskmiselt +10 päevas; lävi 2 lisaks eligible hulka veel palju müra, kuid vana cap'i tõttu vähe lookup'e.
- Muudeti ainult `MIN_MENTIONS 5 → 3`, `FUND_LOOKUP_LIMIT 40 → 80`, nende kommentaare ja selector'i sihtteste. `FUND_RECALL_LOOKUP_LIMIT` jäi 20; kogulagi on 100. `buildCandidates()`, score'id, ranking ja canonical discovery loogika jäid puutumata.
- Verifikatsioon: `npm run typecheck` exit 0; `npm run lint` exit 0; direct full Vitest **318/318**, 34 faili, 264,63 s; `npm run build` exit 0, 21/21 lehte. Pärast build'i app käivitati ja restartiti. Read-only smoke-route'id `/today`, `/research/metadata-root-cause`, `/frequency`, `/portfolio` vastasid 200 ning autentimata `POST /api/collect` 401.
- Järelotsus: käsitle läve 3 esimese eksperimendina. Kalibratsioonivalim on ainult neli kuupäeva ja 2026-08-16 oli selge madala tähelepanu erind; mõõda tulemus 1-2 nädala pärast uuesti enne steady-state kinnitamist.

### 2026-08-20 - Docker app näitas cutover'i järel vaikselt külmutatud andmeid

- **Sümptom.** `localhost:3005/today` näitas snapshot'i **#34 (2026-08-19)** ehk külmutatud lokaalse baasi seisu, samal ajal kui `npm run collect:status` (mis loeb `.env`-i otse, Dockerist väljaspool) näitas õigesti canonical run **#39 (2026-08-20)** Neonis. Kaks tõde korraga, ilma ühegi veateateta.
- **Põhjus.** `docker-compose.yml` `app` teenuse `environment` sisaldas kõvakodeeritud `DATABASE_URL: postgres://discovery:discovery@db:5432/discovery`. Compose'i `environment` võidab konteineri sees `.env`-i, seega Neoni cutover ei jõudnud kunagi Dockeris jooksva app'ini. Viga oli **vaikne**, sest külmutatud baasis on kehtiv skeem ja usutavad andmed — lihtsalt päev vanad ja edasi külmuvad.
- **Parandus.** Üks rida: `DATABASE_URL: ${DATABASE_URL:?DATABASE_URL peab olema .env failis määratud (Neoni golden source)}`. See järgib faili olemasolevat mustrit, kus `FMP_API_KEY`, `CRON_SECRET` ja `SEC_USER_AGENT` juba interpoleeruvad `.env`-ist.
- **Miks `:?` ja mitte `:-`.** `src/lib/db.ts:12-14` langeb tühja `DATABASE_URL`-i korral tagasi täpselt samale `db:5432/discovery` URL-ile. Tühja lubav `:-` taastaks seega vaikselt just selle vea, mida parandame. Fail-closed on siin sama põhimõte nagu migrate-guardi juures: parem valjult katkeda kui vaikselt vale andmeallikat näidata.
- **`scheduler` teenusel ei olnud `DATABASE_URL`-i üldse** — ta kutsub `http://app:3000/api/collect` ja ühendub DB-ga ainult app'i kaudu. Kinnitatud lahendatud configist: `DATABASE_URL` esines seal täpselt üks kord. Teist sama parandust vaja ei olnud.
- **`scheduler` viidi `profiles: ["scheduler"]` taha ega käivitu enam vaikimisi.** Otsene tagajärg sellest samast parandusest: seni kirjutas ta läbi app'i **külmutatud** baasi ja oli kahjutu, nüüd kirjutaks Neoni ja tekiks kolmas päevane trigger (08:00 siin, 08:05 Windows Task Scheduler, 08:10 cron-job.org). Idempotentsus teeb selle ohutuks, aga vaikimisi ei ole seda vaja, kui kadentsi tagab juba GitHub Actions. Kontrollitud: `docker compose config --services` annab nüüd `db` + `app`, `docker compose --profile scheduler config --services` annab kõik kolm.
- **Lokaalne `db` teenus jäeti alles ja seda ei muudetud.** Mõlemad testiteed vajavad seda: konteineris on `tests/setup/test-db-url.ts:7` vaikeväärtus `postgres://discovery:discovery@db:5432/discovery_test` ehk Dockeri-sisene `db` hostinimi, ja hostilt käib `TEST_DATABASE_URL` sama teenuse avaldatud pordi `5433` kaudu. Lisaks hoiab `db_data` volume cutover-eelset külmutatud ajalugu, mis on dokumenteeritud taastepunkt. `app` teenuse `depends_on: db: service_healthy` jäi samuti alles, seega `docker compose up` toob DB testitee jaoks endiselt üles.
- **Kontroll jääb kasutajale:** `docker compose up -d` ja siis `localhost:3005/today` peab näitama canonical run'i **#39 või hilisemat**, mitte #34. Mina seda ise kontrollida ei saa, sest see nõuab töötavat brauserisessiooni.
- **Turvamärkus.** Selle töö käigus printisin Neoni lahendatud connection stringi ilma korralikku redigeerimist, mistõttu rolli parool sattus agendi transkripti. Parool on **rotateeritud** ning uuendatud nii `.env`-is kui GitHubi secret'is `NEON_DATABASE_URL`; kasutaja kinnitas töötamist eduka `collect:status` jooksuga. Õppetund: kasuta olemasolevat `redact()` mustrit (`scripts/migrate.cjs`), mitte ad-hoc regexit — minu muster eeldas skeemi `postgres://`, tegelik oli `postgresql://`.

### 2026-08-20 - Väline cron-trigger: päevane kadents ei sõltu enam ükskõik millisest arvutist

- **Mis valmis.** `cron-job.org` (tasuta tier) kutsub iga päev **08:10 Europe/Tallinn** GitHubi `workflow_dispatch` API endpointi, mis käivitab workflow `collect-daily`. Autentimine käib **fine-grained PAT-iga, mille skoop on ainult selle repo Actions (read/write)** — mitte klassikalise laia õigusega tokeniga.
- **Kontrollitud käsitsi testtriggeriga, mitte eeldatud.** Trigger `cron-job.org`-ist käivitas workflow päriselt ja see lõppes GitHub Actionsis edukalt. Sellega on **kogu ahel otsast otsani tõestatud**: `cron-job.org` → GitHubi API → `workflow_dispatch` → `collect:daily` → Neon.
- **See sulgeb algse probleemi.** Lähtepunkt oli, et koduarvuti ei pruugi kell 08:05 sees olla ja siis jääb päev vaikselt vahele — HANDOFF-is oli see kirjas kui „ei garanteeri igapäevast kadentsi" ja pikalt ka kui teadlikult skoobist väljas olev „alati-püsti keskne DB + pilve-scheduler". Nüüd on mõlemad olemas: kogumine jookseb **sõltumatult igast lokaalsest masinast**.
- **Koduarvuti Windows Task Scheduler jääb sekundaarseks varutriggeriks** (08:05 Tallinna aeg, viis minutit enne cron'i). Teda ei ole vaja muuta, sest ta loeb `.env`-i ja sihib juba Neoni. Kaks triggerit sama päeva sees on ohutu: canonical run on Tallinna kalendripäeva kohta idempotentne (`run_key = mudeliversioon:rklb_daily:Tallinna kuupäev`) ja kogu job on Postgres advisory locki taga, seega hilisem jooks taaskasutab sama päeva canonical run'i ega loo teist. Sama idempotentsus sai eraldi tõendi juba varasema GitHub Actionsi päris jooksuga, mis taaskasutas canonical run'i #39.
- **Ajastust EI pandud `schedule:` plokki** ka nüüd: privaatne repo GitHubi tasuta astmes, kus GitHubi enda cron ei käivitu. Trigger on teadlikult repost väljas.
- **Kaks järelevalve lahtist otsa, mis jäävad avatud** (vt „Avatud sõltuvused ja otsused"): fine-grained PAT aegub kunagi ja siis lakkab kadents **vaikselt** — GitHub Actionsis ei teki ebaõnnestunud jooksu, mida märgata; ning puudub igasugune teavitus, kui kadents katkeb. Avastamisviis on praegu `/frequency` või `collect:status` käsitsi vaatamine.
- Koodi ei muudetud; see oli dokumentatsioonimuudatus. Cron-teenuse ja PAT-i seadistas ning testtriggeri käivitas kasutaja — mina `cron-job.org`-i ega Actions'i logi ise ei näinud, seega ülaltoodud tulemus on kasutaja raporteeritud.

### 2026-08-20 - GitHub Actions collector Neoni vastu, kaks päris jooksu

- **Mis valmis.** `.github/workflows/collect-daily.yml` (commit `7b185f7`) käivitab `npm run collect:daily` Neoni golden-source DB vastu `ubuntu-latest` runneril: Node 22 (vastab app `Dockerfile:3` `node:22-slim`-ile; `engines`/`.nvmrc` repos ei ole), `npm ci`, `timeout-minutes: 10`, `permissions: contents: read`, concurrency group `collect-daily` `cancel-in-progress: false` teise kaitsekihina Postgres advisory locki peal. Sellega on **arvutitest sõltumatu collector olemas** — see oli cutover'i järel viimane suur lahtine tükk.
- **Secret'id on seadistatud repo Actions secret'ites:** **`NEON_DATABASE_URL`** (→ `DATABASE_URL`) ja **`SEC_USER_AGENT`**. Nimekiri on tuletatud päris `process.env` kasutusest kogu kogumise kooditeel, mitte oletatud: `DATABASE_URL` (`src/lib/db.ts:13`, `scripts/_ts-loader.cjs:50`), `SEC_USER_AGENT` (`company-financials.ts:337,353,638`, `company-data.ts:77,141`, `sec.ts:45`), `FMP_API_KEY` (`collect.ts:104`, `backtest.ts:97-98`, valikuline). `CRON_SECRET` ja `CLASSIFICATION_ENRICHMENT_LIMIT` jäid **teadlikult välja**: neid loeb ainult `collect-route-handler.ts`, mille impordib üksnes `src/app/api/collect/route.ts`, seega CLI seda kihti ei läbi.
- **Kontroll 1, `dry_run: true`.** Kinnitas DB-ühenduse Neoni vastu, secret'ite läbiandmise, TZ pinni toimimise (Tallinna tänane kuupäev lahenes õigesti) ja rohelise preflight'i. **Ühtki rida ei kirjutatud** — dry-run ei kutsu ühtki kirjutavat funktsiooni.
- **Kontroll 2, `dry_run: false` — päris jooks.** Lõi collection run **#10** ja **taaskasutas sama päeva olemasolevat canonical run'i #39** uue loomise asemel. See on tugevaim seni saadud idempotentsuse tõend: `run_key = mudeliversioon:rklb_daily:Tallinna kuupäev` pidas ka siis, kui trigger tuli **täiesti teisest keskkonnast** kui kodu- või tööarvuti. Kirjutatud päris andmed: `price_snapshots` **+54**, `financial_enrichment_status` **+5**, SEC faktidega ettevõtted **+5**, SEC enrichment **5/5 õnnestus**, classification enrichment **5/5 õnnestus**.
- **`schedule:` trigerit teadlikult EI OLE.** Privaatne repo GitHubi tasuta astmes — GitHubi enda cron ei käivitu, seega `schedule:` plokk ei annaks kadentsi, küll aga jätaks eksliku mulje, et workflow ajastab end ise.
- **Järgmine samm, MITTE veel tehtud: väline trigger.** Tasuta cron-teenus (nt cron-job.org), mis kutsub `workflow_dispatch` endpointi GitHubi API kaudu. Kuni seda ei ole, käivitub workflow **ainult käsitsi** ja automaatset päevast kadentsi GitHubi poolelt ei ole. *(Tehtud samal päeval — vt kirjet „Väline cron-trigger".)*
- **Koduarvuti Windows Task Scheduler jääb sekundaarseks varutriggeriks.** Ta sihib juba Neoni `.env` kaudu ja teda ei ole vaja muuta. Kaks triggerit korraga on ohutu: canonical run on Tallinna päeva kohta idempotentne (tõestatud run #39 taaskasutusega ülal) ja kogu job on advisory locki taga.
- Koodi ei muudetud: see kirje dokumenteerib juba commit'itud workflow'd ja selle kahte päris jooksu. Jooksud käivitas ja nende väljundi raporteeris kasutaja; mina neid ise ei jälginud.

### 2026-08-20 - Migrate-guardi polaarsuse parandus (fail-closed)

- **Probleem, tõestatud koodilugemisega.** `scripts/migrate.cjs` guard oli `dbName === PROTECTED_DATABASE`, kus `PROTECTED_DATABASE = 'discovery'`. See on blocklist ehk default-allow. Pärast 2026-08-19 cutover'it on päris golden source Neonis nimega `neondb`, seega `'neondb' === 'discovery'` on `false` ja guard ei saanud päris baasi vastu **põhimõtteliselt** käivituda; kaitstud jäi ainult külmutatud lokaalne `discovery`. Kaitse oli täpselt tagurpidi. Selle tõendamiseks Neoniga ei ühendutud.
- **Kus guardile tugineti.** Ainus väline tarbija on `tests/setup/global-setup.ts`, mis kutsub `runMigrations()` sihilikult ilma kinnituslipuga, et runneri enda kaitse jääks viimaseks kaitseliiniks. `--preflight` raporteerib kaitstud oleku, aga ei blokeeri. `runConformance` ei läbi guardi üldse.
- **Lahendus: fail-closed allowlist.** `SCRATCH_DATABASE_PATTERN = /_(test|tmp)$/` ja uus `isScratchDatabase()`. Apply ilma lipuga on lubatud ainult äraviskamiseks mõeldud baasi; kõik muu nõuab `--allow-golden-source`. Kaalutud alternatiivid (nimekirja uuendamine, `.env` marker, hosti kontroll) ja nende tagasilükkamise põhjused on otsuste sektsioonis.
- **Muudetud ainult guardi kiht.** `PROTECTED_DATABASE` → `SCRATCH_DATABASE_PATTERN`, uus `isScratchDatabase()`, `assertDatabaseAllowed(dbName, allowGoldenSource)`, preflight-silt, CLI lipp, jsdoc ja veateate näide (`minu_tmp_db` → `minu_migration_tmp`, sest vana näide oleks uue reegli järgi ise kaitstud olnud). Guard eksporditakse nüüd, et seda saaks testida puhta funktsioonina. Kogumis-, discovery-, skoorimis- ega scheduleri loogikat ei puudutatud; skeemi- ega andmemuudatusi ei tehtud.
- **Testid:** uus `tests/unit/migrate-guard.test.ts`, **16 testi**, täielikult DB-vaba: Neon/`neondb` on kaitstud ja veateade nimetab õiget lippu; `--allow-golden-source` lubab; külmutatud `discovery` jääb kaitstuks; `discovery_test` läheb läbi **ilma** lipuga (muidu katkeks kogu testikomplekt); `schema_conformance_diff_tmp` ja `*_migration_tmp` lähevad läbi; kuus mitte-ajutist nime on ümbernimetamiskindlalt kaitstud; `_test`/`_tmp` peab olema sufiks, mitte suvaline osa nimest (`test_golden_source`, `tmp_discovery`, `discovery_testing`, `neondb_temp` jäävad kaitstuks).
- **Mutatsioonikontroll.** Guard taandati ajutiselt vanale loogikale (`dbName === 'discovery'`), tagastuskuju muutmata: **11/16 testi kukkus** täpselt õigel põhjusel — `AssertionError: expected [Function] to throw an error`, sh kõik kuus ümbernimetamiskindluse juhtumit ja `neondb`. Läbisid ainult need 5, mis kirjeldavad muutumatut käitumist (`discovery` blokeeritud, ajutised baasid lubatud). Kood taastati muutmata kujule.
- **Verifikatsioon:** `npm run typecheck` exit 0, `npm run lint` „No ESLint warnings or errors", `npm test` **317/317 (34 faili, 301 → 317)** isoleeritud `discovery_test` vastu, `npm run build` exit 0. Testibaasi ehitamine läks uue guardi kaudu läbi (`skeem migratsioonidest: 5 rakendatud, 5 kirjet schema_migrations-is`) — see on ühtlasi live-tõend, et harness ei murdunud.
- **Neoni vastu ei jooksutatud ühtki migratsiooni ega päringut.**
- Runbook `db/migrations/README.md` uuendatud samas commit'is: lipu nimi, kaitse kirjeldus (fail-closed), preflight-ootus, apply-käsk ja ajutise baasi näide.

### 2026-08-19 - Golden-source cutover lokaalsest Dockerist Neoni

- **Mis muutus.** Golden-source andmebaas viidi koduarvuti lokaalsest Docker Postgresist (`localhost:5433/discovery`) **Neoni** (tasuta tier, projekt `stock-discovery`, eu-central-1). See on **päris cutover, mitte paralleelne ega duaalne seadistus**: Neon on ainus autoriteetne golden source ja kõik päris `collect:daily` jooksud sihivad seda `DATABASE_URL` kaudu failis `.env`.
- **Kuidas.** `pg_dump` custom-formaadis lokaalsest Dockerist → `pg_restore` Neoni. Enne cutover'it kontrolliti klappivaid ridade arve (`collection_run_items`, `collection_runs`) ja `schema_migrations` sisu mõlemal pool.
- **Lõppkontroll oli päris jooks, mitte ainult ridade lugemine.** Neoni vastu käivitati päris `collect:daily`: `collectionRunId #9`, canonical run **#39**. See tõestas, et lugemine, kirjutamine ja canonical discovery loogika töötavad Neoni vastu — mitte ainult see, et andmed kopeerusid.
- **Lokaalne Docker Postgres jääb alles ainult testi-isolatsiooniks.** `tests/setup/global-setup.ts` loob ja kustutab `discovery_test` baasi ning vajab selleks töötavat lokaalset Postgresit; testid ei sihi Neoni. Lokaalne `discovery` baas on **külmutatud/pensionile saadetud ajalooline snapshot ja backup** ega tohi enam kirjutusi saada.
- **Külmutatud seis mõõdetud, mitte üle kirjutatud** (lokaalne `discovery`, 2026-08-19): `collection_runs` 8 (max id 8), `collection_run_items` 789, canonical `rklb_daily` jooksud 8, max `discovery_runs` id 34 (viimane canonical #34, `decision_date` 2026-08-19, 5 kaasatut), `investment_theses` 11, `schema_migrations` 5. See vastab „canonical run #8/#34" seisule.
- **Task Scheduler ei vaja muutmist.** Kontrollitud: `.env` sisaldab nüüd `DATABASE_URL`-i, mis osutab `neon.tech`-ile, ja `scripts/collect-daily.cjs` teeb `loadEnv()` enne `ensureLocalDatabaseUrl()`-i, mis olemasolevat väärtust üle ei kirjuta. Seega `StockDiscoveryDailyCollect` sihib **juba praegu Neoni** ilma ülesande definitsiooni puutumata ja jääb sekundaarseks/varutriggeriks.
- **Järgmine samm, MITTE veel tehtud:** GitHub Actions (`workflow_dispatch`) + tasuta väline cron (cron-job.org), et `collect:daily` jookseks Neoni vastu **mõlemast arvutist sõltumatult**. Koduarvuti Task Scheduler jääb varutriggeriks; redundantsed triggerid on ohutud, sest `collect:daily` on juba Tallinna päeva kohta idempotentne (`run_key = mudeliversioon:rklb_daily:Tallinna kuupäev`). *(Seisuga 2026-08-20 on MÕLEMAD pooled tehtud ja tõestatud: GitHub Actions collector ja `cron-job.org` väline trigger — vt 2026-08-20 kirjeid.)*
- **Aususe märkus (AGENTS.md §5).** See kirje dokumenteerib cutover'i, mille käivitas ja verifitseeris kasutaja. Selles sessioonis kontrollisin **ise** ainult kahte asja: `.env` osutab `neon.tech`-ile ja lokaalse `discovery` baasi külmutatud read ülal. Neoni-poolseid arve (ridade klapp, `schema_migrations`, run #9/#39) **ma ise ei mõõtnud** — need on kasutaja raporteeritud. Koodi ei muudetud; see oli dokumentatsioonimuudatus.
- **Vananenud runbook parandatud samas commit'is.** `db/migrations/README.md:76` nõudis migratsioonide rakendamist „AINULT koduarvuti golden source DB vastu", mis suunaks tulevase sessiooni külmutatud baasi kirjutama; nüüd osutab see Neonile ning ütleb eksplitsiitselt, et ka koduarvuti `localhost:5433/discovery` ei ole enam golden source. Muudetud ainult see üks hoiatuse rida.
- **Uus leid:** Neoni baasi nimi on `neondb`, mitte `discovery`, seega `scripts/migrate.cjs` kaitstud-nime guard **ei rakendunud päris golden source'ile** — kaitstud nimi kuulus külmutatud lokaalsele baasile. Kaitse oli cutover'iga ümber pööratud. **Parandatud 2026-08-20**, vt sessioonilogi kirjet „Migrate-guardi polaarsuse parandus".

### 2026-08-19 - TZ pinning follow-up (F1 järeltöö)

- Kontrollitud, mitte eeldatud: `today()` (`src/lib/collect.ts:31-38`) kasutab tõepoolest `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', … })`, seega F2 parandus on peal ja funktsioon ei sõltu süsteemi TZ-ist. Sama kehtib `tallinnDate()` kohta (`discovery-validation.ts:157-164`), mis annab canonical `decision_date`.
- Kaardistatud kogu „Tallinna kalendripäeva" loogika `src/`, `scripts/` ja `tests/` ulatuses. Lokaalsete akcessorite otsing (`getFullYear/getMonth/getDate/getHours`) andis kaks vastet: `date-only.ts:22` (`localDateOnly`, tõestatult TZ-sõltumatu pg `DATE` puhul) ja üks kommentaar testifailis. `toLocale*` otsing andis 30 vastet, millest 29 on **arvuvormindus**; ainus kuupäevavormindus ilma `timeZone`'ita on `src/app/daily/page.tsx:122`. Vt otsuste sektsiooni täielikku kaarti.
- Lisatud `ENV TZ=Europe/Tallinn` failidesse `Dockerfile:8` ja `scheduler/Dockerfile:3`, sobitades selle, mida `docker-compose.yml` juba seadis. Kontrollitud `docker run`-iga **ilma compose'i**, et ENV päriselt jõustub ja `node:22-slim`/`node:20-slim` sisaldavad tzdata't: mõlemas `resolved TZ: Europe/Tallinn`, `process.env.TZ: Europe/Tallinn`, ning `2026-08-17T21:00:00Z` annab lokaalse kuupäeva `2026-08-18` (Tallinna päevapiir). Ilma selle kontrollita oleks ENV võinud vaikselt UTC-le langeda.
- **Windows Task Scheduleri jaoks TZ-mehhanismi ei loodud.** Empiiriline põhjendus: kogu testikomplekt läbib **301/301 ka `TZ=America/New_York`** all konteineris (käivitusaeg 15:42 vs Tallinna jooksu 22:54 kinnitab, et TZ kehtis). Negatiivne nihe on ainus koht, kus lokaalse aja eeldus katki läheks, seega ükski test ega kalendripäeva-arvutus ei sõltu süsteemi lokaadist.
- `Dockerfile` sisaldab **segatud reavahetusi** (rida 3 lõpeb LF-iga, ümbritsevad CRLF-iga). Ei parandanud — see on käesoleva ülesandega mitteseotud ja `.gitattributes` normaliseerib ainult `*.sql`. Mainitud siin, et järgmine sessioon ei üllatuks.
- Koodimuudatusi `src/`-s ei tehtud; muudetud ainult `Dockerfile`, `scheduler/Dockerfile` ja see dokument. Verifikatsioon: `npm run typecheck` exit 0, `npm run lint` „No ESLint warnings or errors", `npm test` **301/301 (33 faili)** isoleeritud `discovery_test` vastu, `npm run build` 21-leheline production build exit 0.

### 2026-08-19 - F1 DATE timezone fix (toDateOnly)

- Parandatud `src/lib/date-only.ts` `toDateOnly()`: Date-haru luges kalendripäeva `toISOString().slice(0, 10)`-ga, mis nihutas selle päeva võrra tagasi igas positiivse UTC-nihkega ajavööndis. Lisatud privaatne `localDateOnly()` abifunktsioon, mis kasutab `getFullYear/getMonth/getDate`. Stringi-haru regex jäi muutumatuks; `new Date(text)` fallback kasutab nüüd sama abifunktsiooni, seega funktsioonis ei ole enam ühtki ajavööndist sõltuvat teisendust.
- **Auditi eeldus oli empiiriliselt vale ja see on oluline teadmine.** `investigation/postgresql-date-timezone-audit.md` väidab F1 all, et „node-postgres may parse it as a `Date` object with UTC midnight" ning soovitab UTC-põhist parandust. Mõõtmine näitas vastupidist: pg-types parsib DATE **lokaalseks kesköökes**, seega `getUTC*` oleks andnud täpselt sama vale kuupäeva nagu senine kood. Auditi fail sisaldab endiselt seda ekslikku väidet ja ka sisemist vastuolu (kokkuvõttetabel märgib F1 „Benign / Fix needed: No", detailosa „Severity: Moderate") — faili ma ei muutnud.
- Mõõdetud golden-source andmetega, `discovery-frequency.ts:211` päringu kujuga, TZ=Europe/Tallinn: canonical run #34 (DB `2026-08-19`) andis `2026-08-18`, #32 (`2026-08-17`) andis `2026-08-16`, #31 (`2026-08-16`) andis `2026-08-15`. Kõik kolm on nüüd õiged.
- Mõjutatud olid **neli kutsekohta kuuest**, sest need saavad pg-lt Date objekti: `discovery-frequency.ts:249` ja `:243` (päring real 211/223 ei tee `::text` cast'i) ning `missed-moves.ts:116` ja `:115` (`(captured_at AT TIME ZONE 'Europe/Tallinn')::date` ja selle `lag()`). Kaks kutsekohta olid juba ohutud, sest SQL castib teksti: `today-brief.ts:613` (`decision_date::text`, rida 710) ja `:940` (`catalyst_linked_period_end::text`, rida 810). **Neid nelja faili ei muudetud** — üks parandus `toDateOnly()`-s katab kõik kutsekohad.
- Testid: `tests/unit/data-boundaries.test.ts` sai F1 regressiooniploki (5 testi) kolme päris golden-source kuupäevaga, kuu/aastapiiriga, stringi-teega, instant-sisendiga ja muutumatu vea-käitumisega. Olemasolev fixture real 9 kasutas UTC-kesköökes Date'i, mis ei vasta pg DATE kujule ja oleks pärast parandust muutunud TZ-sõltuvaks — asendatud `new Date(2026, 7, 15)`-ga. Testid ei muuda `process.env.TZ`-i, sest Windowsil ignoreerib Node IANA TZ väärtusi peale UTC ja selline test läbiks vale põhjusel. Mutatsioonikontroll parandamata koodiga: 5 testi kukkus täpselt päeva-nihkega, sh aastapiir `2025-12-31` oodatud `2026-01-01` asemel.
- **TZ pinnimise leid ja soovitus (ei rakendatud).** `docker-compose.yml:26` (app) ja `:45` (scheduler) pinnivad `TZ: Europe/Tallinn` kõvakodeeritult. `Dockerfile` ei pinni midagi ja **hostis jooksev CLI** (`npm run collect:daily` Task Scheduleri kaudu, `collect:status`, testid, migratsioonid) kasutab Windowsi süsteemi tsooni, mis ei ole kuskil kirjas. `.env.example:8` sisaldab `TZ=Europe/Tallinn`, aga päris `.env` seda ei sisalda. See parandus ise on ajavööndist sõltumatu, seega F1 ei sõltu pinnimisest — kuid „Tallinna kalendripäeva" äriloogika (nt `today()` failis `collect.ts`) sõltub. Soovitus eraldi tööna: pinnida `TZ` eksplitsiitselt ka `Dockerfile`-is ja hosti scheduleri käsus. Ootab kinnitust.
- Verifikatsioon: `npm run typecheck` exit 0, `npm run lint` „No ESLint warnings or errors", `npm test` 301/301 (33 faili, 294 -> 301) isoleeritud `discovery_test` vastu, `npm run build` 21-leheline production build. F3 ja F4 jäävad auditis hinnatud kujul benign'iks; koodimuudatust ei tehtud.
### 2026-08-19 - ApeWisdom cross-page duplicate fix

- Juurpõhjus: `fetchApeWisdom` (`src/lib/apewisdom.ts`) teeb iga lehe kohta eraldi HTTP päringu ja ApeWisdomi edetabel on elav. Kui järjestus nihkub päringute vahel, lükkub lehepiiri lähedal olev ticker alla ja ilmub MÕLEMAL lehel. Funktsioon ei dedupinud kunagi, ja see kood ei olnud muutunud alates `f0510d8 Initial commit`-ist.
- `collect.ts` ehitab `collection_run_items` batch'i ühe `apeRows.map()`-iga (1:1), seega duplikaatne toorik andis duplikaatse batch-kirje ja `recordCollectionRunItems` guard viskas. See nurjas `collection_runs` #4 (`4:FN`), #5 (`5:OPEN`) ja #6 (`6:CBRS`) — kolm järjestikust jooksu 2026-08-18/19. Guard töötas õigesti; nurjumised ei olnud commit'ide `98bda20`/`64e7580` põhjustatud, sest `resolveCollectionCompanyIds()` tagastab `Map`-i ega saa massiivi kirjeid lisada.
- Elav reprodutseering 2026-08-19: 2 lehte, 200 rida, **195 unikaalset** (GLP rank 87→101, EU 86→102, MSS 85→103, XYZ 84→104, CDNL 83→105). Nimekiri nihkus päringute vahel ~18 positsiooni.
- Parandus: `fetchApeWisdom` dedupib ÜKS kord lõpus (mitte lehe kaupa), esimene esinemine võidab, võti on juba normaliseeritud ticker (`trim` + `toUpperCase`, sama mis `collection-run-items.ts` `normalize()`). Tagastus on nüüd `{ rows, rawRowCount }`, seega toore ja unikaalse arvu vahe on kutsujale nähtav.
- Metrikud: `scanned` ja `providers.apewisdomRows` jäävad TOORE arvu tähendusega (UI, `today-brief` ja püsiv ledger-semantika ei muutunud); lisandus `providers.apewisdomUniqueRows`. Ranking, scoring, scheduler, canonical discovery, migratsioonid ja ajaloolised andmed on puutumata; run'e #4/#5/#6 ei parandatud tagantjärele — need jäävad ausaks auditijäljeks.
- Batch-guard oli varem täiesti katmata (ükski test ei andnud mitme-elemendilist massiivi). Lisati A11–A13: kehtiv mitme-kirjeline batch salvestub tervikuna, duplikaatne batch lükatakse tagasi ega salvesta ühtki rida, ja guard võtmestab normaliseeritud tickeri järgi. Guard jääb teadlikult alles teise kaitsekihina DB `UNIQUE (collection_run_id, ticker)` kõrval.
- Testid: uus `tests/unit/apewisdom-dedupe.test.ts` (5 testi) reprodutseerib täpse veatingimuse. Mutatsioonikontroll — dedup-loop eemaldatud, tagastuskuju alles — kukutas 4 testi 5-st õigel põhjusel (`expected [...(5)] to have a length of 4 but got 5`), kontrolljuhtum jäi õigesti roheliseks. Täiskomplekt 286 → **294 testi (33 faili)**.
- Verifikatsioon: `npm run typecheck` exit 0, `npm run lint` „No ESLint warnings or errors", `npm test` **294/294** isoleeritud `discovery_test` vastu, `npm run build` 21-leheline production build õnnestus. Typecheck püüdis ühe päris tagajärje: `tests/db/collect-route-lock.test.ts` mock hoiab tervet `runCollection` tagastuskuju ja katkes valjult, nagu kavandatud — lisati `apewisdomUniqueRows: 0`.

### 2026-08-17 - Enrichment last_error truncation coverage

- Located the branch in `src/lib/company-financials.ts`: `saveEnrichmentAttempt()` truncated with `error?.slice(0, 500)`. ASCII length was correct, but JavaScript code-unit slicing could split a surrogate pair at the boundary.
- Added a minimal Unicode-safe helper using code-point iteration and retained the same 500-character/null semantics. No schema, retry, budget, queue or status behavior changed.
- Extended only the SEC test fixture with an explicit thrown-error option. The DB regression sends 499 ASCII characters plus an emoji and suffix through the real enrichment error path, then proves 500 code points, an intact final emoji, exact truncation point and absent suffix in `financial_enrichment_status.last_error`.
- Verification: typecheck and lint passed; targeted enrichment-budget tests passed 36/36; direct full Vitest runner passed 273/273 tests in 30 files against isolated `discovery_test`; the 21-page production build passed.

### 2026-08-17 - Market-Data Persistence Fix V2

- `resolveCollectionCompanyIds()` now calls the existing private `insertPriceSnapshot()` immediately after a usable current-run fundamentals identity is upserted. It persists only the available price, market cap, volume, currency and provider source; the existing five-minute identical-value dedupe remains the single write rule.
- Social candidate rows and daily social snapshots remain candidate-only. `buildCandidates()`, ranking, scoring, canonical discovery, outcomes, API routing and scheduler behavior are unchanged.
- DB regressions prove that a provider-resolved ticker filtered out of candidates gets its quote snapshot, an existing identity without current fundamentals gets no fabricated snapshot, unknown identity gets neither company nor price, and candidate+identity paths produce exactly one snapshot.
- This is forward-only. Historical `collection_run_items` and `price_snapshots` were not repaired or backfilled. Only lookup-selected tickers benefit (about 16/200 in the observed run); the broader selection bottleneck remains a separate future slice.
- Exchange is still out of the `Fundamentals` model. Sector and industry remain out of scope and continue through the limited Yahoo `assetProfile` classification enrichment, now indirectly eligible for more non-ETF identities because fresh prices can exist.
- Verification: typecheck and lint passed; direct Vitest runner passed 272/272 tests in 30 files against isolated `discovery_test`; the 21-page production build passed. No real collection cycle was run on the work computer.

### 2026-08-17 - Company Link Persistence Fix V1

- Root cause kinnitati kooditeel: `fetchFundamentals()` tagastas kasutatava provider-identiteedi, kuid ainult `buildCandidates()` l�binud read j�udsid `saveCollectedCompanies()` kaudu ID-kaarti. Seet�ttu v�is `market_data_found=true` item j��da `company_id=NULL`; olemasolevaid unselected tickeri-identiteete samuti ei lahendatud.
- Lisati `src/lib/db.ts` helper `resolveCollectionCompanyIds()`: see normaliseerib observed tickerid, loeb olemasolevad `companies` ID-d ning upsertib ainult current-run fundamentaalid, millel on v�hemalt price, market cap v�i volume. Helper ei loo hinnasnapshote ega tundmatu provider-payloadiga ettev�tteid.
- `src/lib/collect.ts` kasutab collection item'i lingiks laiemat identity map'i ja liidab sellesse olemasoleva candidate persistence'i ID-d. Candidate filter, social snapshot, ranking, canonical scoring, outcomes, scheduler ja API-providerite hulk j�id muutmata.
- DB-regressioonid katavad filtered-but-found identity, olemasoleva unselected identity, t�iesti tundmatu tickeri, t�hja/out-of-universe provider-payloadi ja ajaloolise null-lingi muutumatuse. Canonical decision'i olemasolev tickerip�hine item-link ning oma company ID toimivad endiselt s�ltumata item'i nullable company lingist.
- Skeemi ega migratsiooni ei lisatud ning ajaloolisi `collection_run_items` ridu ei backfillitud. J�rgmine soovitus on kontrollida esimese uue golden-source daily collect'i j�rel `/research/metadata-root-cause` vaates tulevase run'i valid-link coverage'it; varasemat kohorti tuleb hoida immutable auditina.
- Verification: typecheck passed, lint passed, direct Vitest runner passed 271/271 tests in 30 files, and the 21-page production build passed. `npm test` itself is blocked by the work-computer Group Policy shim restriction, so the same suite was run with `node node_modules/vitest/vitest.mjs run` against isolated `discovery_test`.

### 2026-08-17 - Metadata Join Root Cause Audit V1

- Lisati `/research/metadata-root-cause`, nav-link, pipeline funnel, sortable failure breakdown ja sortable item-level diagnostic. Audit kasutab üht `REPEATABLE READ, READ ONLY` päringut ning ei lisa skeemi, migratsiooni, write-path'i, schedulerit, rankingut ega välisallikat.
- Golden-source leid: 200 item'it; 16 selected, attempted ja market-data-found; 26 tickeril on current company identity, kuid valid persisted item-company link on 7 real. First-failure jaotus on 165 not-selected-without-existing-identity, 19 company-found-but-item-not-linked, 9 selected/found-but-no-current-company-identity, 5 exchange-missing ja 2 complete. 19 unselected tickeril on identity juba olemas ning 9 item'il on exact decision score vaatamata puuduvale item-company linkile.
- Lisati 9 testi; täiskomplekt kasvas 257 → 266 (30 faili). Typecheck, lint, `npm test` (266/266), 21-leheline production build ning nelja route'i HTTP 200 läbisid. Build'i järel restartitud app'i browser QA kinnitas nav-linki, päris funnelit, failure- ja item-tabeli sortimist, console error'ite ning page-level overflow puudumist.
- Audit ei parandanud andmeid. Järgmine soovitatud töö on eraldi collect persistence code-path audit 9 `market_data_found=true` kuid company identity'ta rea kohta ning otsus, kas olemasoleva identity'ga unselected item'idele tuleb persisted link kirjutada.

### 2026-08-17 - Metadata Coverage Audit V1

- Lisati `/research/metadata-coverage`, üks schema-driven batched `REPEATABLE READ, READ ONLY` query ning kolm sortable tabelit: Field Coverage, Top Values ja Unknown/Missing Breakdown. Country ja Total Score kuvatakse schema gap'ina, kuid SQL ei viita olematule veerule; 53 lisavälja tulid ainult current `information_schema` leidudest.
- Golden-source audit: 200 item'i, 62 auditeeritud välja (9 requested + 53 discovered), 60 stored, 2 schema gap'i, 7 fully covered, 52 partial, 1 stored-but-empty ning stored-field average coverage 21,2%. Sector/industry/market cap/Coverage Score on 16/200 (8%); Health 15/200 (7,5%), Growth 14/200 (7%), exchange 2/200 (1%); country ja Total Score pole skeemis.
- Lisati 8 testi; täiskomplekt kasvas 249 → 257 (28 faili). Typecheck, lint, `npm test` (257/257), 20-leheline production build ja kuue route'i HTTP 200 läbisid. Build'i järel restartitud app'i värske browser QA kinnitas nav-linki, kolme sortable tabelit, 200 päris item'it, console error'ite ning page-level overflow puudumist; QA käigus leitud duplicate React key warning parandati enne lõppkontrolli.
- Skeemi, migratsioone, schedulerit, rankingut, write-path'i ega välisallikaid ei muudetud. Järgmine soovitus on eraldi read-only root-cause audit, miks item→company/decision metadata seos katab ainult 14–16/200 rida.

### 2026-08-16 - Discovery Quality Audit V1

- Lisati üks batched `REPEATABLE READ, READ ONLY` auditipäring ja `/research/discovery-quality`: overview, sector/market-cap/country/exchange mix, duplicate discovery ning Growth/Health/Coverage bucketid. Total Score jääb unavailable ning puuduvat country/metadata't ei oletata.
- Lisati sortable composition-, duplicate- ja score-tabelid, factual highlight'id, nav-link ning responsive nav parandus (`flex-wrap` + `min-width: 0`), et research-linkide kasv ei tekitaks page-level overflow'd. Skeemi, migratsioone, schedulerit, rankingut, write-path'i ega välisallikaid ei muudetud.
- Golden-source browser QA: 200 item'i, 200 distinct tickerit, üks run ja 0 korduvat tickerit. Sector ja market cap on teada 16 item'il (8%); Technology on 7 item'iga suurim teada sektor ning mid cap 12 item'iga suurim teada cap-bucket, kuid 184 unknown rida tähendab, et neid ei tohi pidada kogu universumi tugevaks eelistuseks. Exchange on teada 2 item'il, country väli puudub. Growth/Health/Coverage linked immutable score on vastavalt 14/15/16 item'il; üle 80 on 5/5/5 teada väärtust.
- Lisati 8 testi; täiskomplekt kasvas 241 → 249 (26 faili). Typecheck, lint, `npm test` (249/249), 19-leheline production build ning viie route'i HTTP 200 läbisid. Build'i järel restartitud app'i browser QA kinnitas navigeerimist, kolme tüüpi sortable tabeleid, Total/country unavailable state'i, console error'ite ja page-level overflow puudumist.

### 2026-08-16 - Outcome Snapshot Backfill Audit V1

- Lisati `/research/outcome-backfill-audit` ning üks `REPEATABLE READ, READ ONLY` auditipäring collection item'i, immutable snapshot'i ja olemasoleva kohaliku hinnajaloo kohta. 30D/90D/180D vanus, snapshot ja hinnavalmidus jäävad eraldi signaalideks.
- Symbol-, horizon- ja run-tabelid on sortable või kompaktselt võrreldavad; status on deterministlik `Too recent`, `Missing price data`, `Already measured` või `Eligible for backfill`. Puuduv price table annab kontrollitud missing-state'i, mitte crash'i ega sünteetilist hinda.
- Lisati 8 testi; täiskomplekt kasvab 233 → 241 (24 faili). Skeemi, migratsioone, external API-sid, schedulerit, rankingut ja write-path'i ei muudetud.
- Golden-source browser QA: 200 item'i ja 200 distinct tickerit ühest item'e sisaldavast run'ist; kõik item'id on observed 2026-08-16 ning 30D/90D/180D eligible loendurid on 0/0/0. Measured symboleid on 0, kõik 200 on igas horizonis liiga värsked ja `Missing Price Data = 0` tähendab siin “hind pole veel due”, mitte tõestatud tulevast hinnakatet. Seetõttu pole actual snapshot backfill praegu ausalt võimalik.
- Typecheck, lint, `npm test` (241/241), 18-leheline production build ja kolme research-route'i HTTP 200 läbisid. Build'i järel restartitud app'i browser QA kinnitas nav-linki, sortable Symbol/Run/Coverage tabeleid, ausat Attribution empty state'i, console error'ite puudumist ja page-level overflow puudumist.

### 2026-08-16 - Outcome Coverage V1

- Lisati üks batched read-only päring ja `/research/outcome-coverage`, mis näitab outcome tracking'u üld-, run- ja vanusekatvust ainult `collection_runs`, `collection_run_items` ja immutable `outcome_analysis_snapshots` põhjal.
- Headline'i kokkulepitud mixed-unit definitsioon on UI-s nähtav; run/age tabelites on item-level numerator ja denominator ning mitu outcome-horisonti ei dubleeri measured item'it.
- Lisati sortable tabelid, päris andmetest tuletatud highlight'id ja nullandmestiku empty state. Skeemi, migratsioone, rankingut, schedulerit ega andmeid ei muudeta.
- Lisati 8 testi; täiskomplekt kasvas 225 → 233 (22 faili), kõik rohelised. Typecheck, lint ja 17-leheline production build läbisid; build'i järel restartitud app andis `/`, `/today`, `/research/outcome-coverage`, `/research/outcome-attribution`, `/frequency`, `/backtest` ja `/portfolio` route'idel HTTP 200.
- Päris brauseri QA golden-source DB peal näitas 200 collection item'i, 0 measured distinct tickerit ja ausat 0,0% coverage'it; mõlemad sortable tabelid renderdusid, sort toimis, console error'e ega horisontaalset page overflow'd ei olnud. Need väärtused on olemasoleva DB hetkeseis, mitte fixture ega kirjutus.

### 2026-08-16 - Outcome Attribution V1

- Lisati read-only `/research/outcome-attribution` ja üks batched query immutable canonical outcome snapshot'ide ning nende decision-time Health/Sector/Market Cap väljade jaoks. Growth/Coverage tulevad otse snapshotist; live score-, price- ega company-andmeid ei loeta.
- Kuus sortable attribution-tabelit kuvavad sample count'i, average/mediaani, üle 10% win rate'i ja alla 0% loss rate'i. Alla viie vaatlusega bucket on low sample ning automaatsetest highlight'idest väljas; tühi forward-valim annab ausa empty state'i.
- RKLB discovery's ei ole Total Score'i, seega vastav sektsioon on teadlikult unavailable ja uut koondskoori ei loodud. Skeemi, migratsioone, rankingut, schedulerit ega write-path'i ei muudetud.
- Lisati 8 testi; täiskomplekt kasvas 217 → 225 (20 faili). Typecheck, lint ja production build läbisid.

### 2026-08-16 - Today UX V3.4 human-readable catalyst evidence

- `/today` catalyst evidence on nüüd deterministlik inimkeelne kirjeldus olemasolevast event kind/source kind/novelty/direction/materiality/relevance sisendist. Event date ja source link jäävad kohe nähtavaks; raw enumid ja stored detail kolisid `Technical details` plokki.
- Puuduva sündmuse korral ütleb brief seda otse ega leiuta katalüsaatorit. DB-test tabas PostgreSQL `date` → JavaScript `Date` ajavööndinihke; päring tagastab seotud perioodi nüüd `::text`, säilitades otsusehetke kuupäeva täpselt.
- Lisati 3 pure wording-testi ja 1 DB-integratsioonitest; täiskomplekt kasvas 213 → 217 (18/18 faili). Typecheck, lint ja 15/15 production build läbisid; rankingut, skeemi, allikaid ega write-path'i ei muudetud.

### 2026-08-16 - Today UX V3.3 inline rank and evidence changes

- Päevavõrdlus valib nüüd viimase varasema canonical run'i, mille `model_version` kattub latest run'iga; teise mudeliversiooni vahepäev ei tekita eksitavat delta't.
- Kandidaadikaart ja “What changed?” kasutavad sama `changedFields` loendit. Renderduvad ainult muutunud Rank, Fundamental Growth, Financial Health, Coverage, Mandate või Catalyst evidence; muutumatut “still partial” müra enam ei lisata.
- Lisati 1 DB-test ning olemasolevat rank-change testi tugevdati exact-field assert'iga; täiskomplekt kasvas 212 → 213. Typecheck, lint, 17/17 Vitest failid ja 15/15 production build läbisid.

### 2026-08-16 - Today UX V3.2 ownership badges

- `/today` kandidaadi nime juures kuvatakse olemasoleva `portfolio_positions` kirje põhjal Watchlist või Portfolio ning olemasoleva current `investment_theses` rea põhjal Thesis koos staatuse ja päris route-lingiga. Puuduva kirje korral badge'i ei teki.
- Kõik kandidaatide ownership-read tulevad ühe `ticker = ANY(...)` batched query kaudu sama read-only transaktsiooni sees; N+1 päringuid, skeemi ega write-path'i ei lisatud.
- Lisati 1 DB-integratsioonitest (Watchlist+Thesis, Portfolio ja empty); täiskomplekt kasvas 211 → 212. Typecheck, lint, 17/17 Vitest failid ja 15/15 production build läbisid.

### 2026-08-16 - Today UX V3.1 adjacent rank explanation

- Discovery ranking ja `/today` selgitus kasutavad nüüd sama `compareRklbRankFactors()` funktsiooni; reegel jäi semantiliselt samaks: supported criteria → catalyst tier → Fundamental Growth → Coverage → Financial Health → deterministic ticker.
- Iga kandidaadikaart peale viimase selgitab, milline esimene erinev research-väli eraldas selle järgmisest rank'ist. Kõigi sisuliste väljade viik öeldakse välja ning tickerit ei esitata investeerimisargumendina.
- Lisati 8 pure comparatori testi ja 1 DB-integratsioonitest; täiskomplekt kasvas 202 → 211. Typecheck, lint, 17/17 Vitest failid ja 15/15 production build läbisid. Skeemi, rankingureeglit, skoorimist, allikaid ega write-path'i ei muudetud.

### 2026-08-16 - Price Context + Scenario Valuation V1

- Lisati DB-vabad `price-context-v1` ja `scenario-valuation-v1` helperid. Price context kasutab ainult canonical run'i ajani salvestatud hindu, kindlaid reference-window tolerantsse ja nähtavaid run-up lävesid; puuduv ajalugu jääb unknown-state'i.
- `/today` kandidaadikaart nimetab score'i `Fundamental Growth x/100` ning inline detail eristab Price Contexti Bear/Base/Bull sensitivity'st. Scenario kasutab otsuse score snapshot'i exact SEC source-väärtusi, market cap'i ja hinda; see ei muuda rankingut ega score'i.
- Lisati 6 pure testi ja 2 DB-integratsioonitesti; täiskomplekt kasvas 194 → 202. Lint, typecheck, 15/15 build, app restart, viis HTTP route'i ning desktop/mobile browser QA läbisid.
- Responsive QA käigus parandati mobiilinavi nowrap-overflow väikese CSS wrap-muudatusega. Skeemi, migratsioone, migration runnerit, schedulerit, collectorit, allikaid ega AI-d ei muudetud; commit'i ei tehtud.

### 2026-08-16 - Daily Research Brief UX V2

- Tehti olemasolevatest immutable/read-only andmetest candidate-first `/today`: neli selget primaarstaatust, deterministlik “Why research this today?”, inimkeelsed catalyst/source-path väärtused ja inline võrdlus viiele kandidaadile. Rankingut, skoorimist, skeemi, migratsioone, collectorit ega schedulerit ei muudetud.
- Universe health eraldati kandidaatide review-warningutest. Unknown provenance jääb subtle traceability note'iks; off/partial mandate, negative FCF, dilution, low coverage, missing sector, attention recall ja universe gap on inimese review-signaalid.
- Päevavõrdlus näitab repeated tickeri previous/current rank'i ning usaldusväärselt tuletatavaid score/coverage/mandate/catalyst muutusi. Next outcomes ja missed moves on kompaktsed; tehniline run/collect info on `System details` all.
- Lisati 4 DB-testi; täiskomplekt kasvas 190 → 194. Lint, typecheck, 15/15 production build, app restart, viis HTTP-smoke route'i ja päris browser QA läbisid; commit'i ei tehtud.

### 2026-08-16 - Daily Research Dashboard / Morning Brief

- Lisati `/today` read-only research cockpit, navilink ja avalehe CTA. Vaade koondab canonical/collect staatuse, immutable kandidaadid, collection provenance'i, quality snapshot'i, review-itemid, päevamuutuse, missed-move auditi ning järgmised outcome-kuupäevad.
- `getTodayBrief()` kasutab üht PostgreSQL `REPEATABLE READ, READ ONLY` transaktsiooni; uusi allikaid, AI-d, rankingut, skoorimist, schedulerit, migratsioone ega DB kirjutusi ei lisatud. Puuduv sisend jääb unknown või nähtavaks warninguks.
- Lisati 7 DB-testi; täiskomplekt kasvas 183 → 190. Lint/typecheck/build/restart, nõutud HTTP-smoke ja päris in-app browser QA läbisid; commit'i ei tehtud.

### 2026-08-15 - Outcome Analysis Snapshot V1

- Lisati migratsioon `0005_outcome_analysis_snapshots`: üks immutable rida measured outcome'i kohta, otsuse tickeritaseme collection-item FK, canonical/manual/unknown scope, winner ja benchmark-beat eraldi väljad, kvaliteedi suhtarvud ning catalyst/mandate signaalid.
- Snapshoti build-päringul on range nelja tabeli boundary: `discovery_decisions`, `candidate_outcomes`, `data_quality_snapshots`, `collection_run_items`. Puuduv sisend jääb unknown; live price/facts/score/catalyst tabeleid ei loeta.
- `refreshCandidateOutcomes()` salvestab pärast kandidaadi ja benchmark'i mõõtmisfaase kõik puuduvad snapshotid. Kordus on idempotentne, versioonikonflikt ei kirjuta üle ning PostgreSQL trigger keelab snapshoti UPDATE/DELETE.
- Lisati canonical-only summary bucketi, winneri, catalyst tier'i ja mandate relevance'i kaupa koos eraldi winner/benchmark-beat määrade ja keskmiste score/quality sisenditega. Legacy manual/unknown scope on summary'st väljas.
- Lisati 11 DB-testi ja infra-assert; täiskomplekt kasvas 171 → 183. Golden-source backup/apply/conformance, lint/typecheck/build/restart ja runtime-smoke läbivad; measured outcome'i ega backfilli kunstlikult ei loodud.

### 2026-08-15 - Collection → Canonical Ticker Provenance Bridge

- Lisati ainult migratsioonina `0004_collection_run_items.sql`: collect-run'i cascade-FK, company nullable FK, unikaalne run+ticker, bucket/signaal/market-data väljad, JSON-kuju ja lifecycle CHECK-id ning nullable `discovery_runs.collection_run_id`.
- `runCollection()` annab ledgeri ID operatsioonile, salvestab iga ApeWisdomi radaritickeri immutable `collection-run-item-v1` rea ning lõpetab run'i failure'ina, kui kohustuslik tickeriaudit ei salvestu. Growth on primary path ja võidab võimaliku recall-konflikti.
- API ja daily CLI annavad eduka collection ID canonical discovery sammule. Uus canonical run külmutab seose loomisel; sama päeva kordus ei kirjuta varasema snapshot'i seost üle. Manual run jääb seoseta.
- Lisati 10 DB-testi ning infra migratsiooniassert; täiskomplekt kasvas 160 → 171 ja on roheline. Golden-source 0004 backup/apply/conformance, dry-run, build/restart ja HTTP-smoke läbivad; päris hilist collect'i ega ajaloolist backfilli ei tehtud.

### 2026-08-15 - TOP 10 #4 Point-in-time Data-quality Snapshot

- Lisati ainult migratsioonina `0003_data_quality_snapshots.sql`: üks cascade-FK ja UNIQUE rida canonical run'i kohta, mittenegatiivsed/bounds/JSON-kuju CHECK-id ning versioonitud metrics/warnings payload. Runtime DDL-i, migration runnerit ega schedulerit ei muudetud.
- `src/lib/data-quality-snapshots.ts` ehitab run-at piiriga universumi- ja freshness-loendurid ning immutable decision/score payload'ist coverage-, mandate-, negatiivse FCF ja dilution flagid. Outcome'e ei loeta; manual `rklb` run lükatakse tagasi; olemasolevat sama versiooni snapshot'i ei kirjutata üle.
- Canonical discovery salvestab kvaliteedisnapshot'i kohe pärast `recordDiscoveryRun` commit'i. Snapshot'i viga on kriitiline: CLI lõpetab exit 1-ga ja `/api/collect` tagastab HTTP 500; juba committed canonical run jääb nähtavalt alles.
- Lisandus 7 sihitud DB-testi ja 1 infra migration-test; kogu komplekt kasvas 152 → 160 ning läbis. Lint, typecheck ja 14/14 production build läbisid; app restart ja HTTP smoke läbisid.
- Preflight oli GO. Kontrollitud backup `pre-0003-data-quality.dump` (597 612 baiti, 203 TOC, SHA-256 `C6D6656AC16DE3BAC2B8E3289C9FEF5AC5160F285B4D4460FB4DFEED7B853867`) võeti enne apply'd; 0003 rakendus 23 ms-ga ja conformance on `VASTAB`.
- Tänast varem loodud canonical run #29 ei backfillitud ega dubleeritud. Esimene rida jääb järgmise daily collecti luua; selle järel tuleb kontrollida run-seost ja kordusjooksu idempotentsust.

### 2026-08-15 - TOP 10 #7 Collection Runs Ledger

- Lisati migratsioon `db/migrations/0002_collection_runs_ledger.sql`; migration runnerit ei muudetud. Tabelil on trigger, lifecycle staatus, algus/lõpp, kestus, JSONB metricud, veatüüp/teade, neli CHECK-piirangut ja kaks auditipäringute indeksit.
- `runCollection()` loob rea enne providerikutsed ja finalize'ib selle `success`/`failure`; API märgib triggeriks `api`, muud olemasolevad kutsed `direct`. Schedulerifaili, schedulerit ennast ega Neonit ei muudetud.
- Metric schema v1 sisaldab capture date'i, scanned/candidates/flagged, SEC tracked, live-data salvestuse olekut, growth/recall/total lookup'i ning ApeWisdom/Tradestie/SEC/Yahoo/FMP loendureid ja fallback-lippe.
- Testibaasis rakendus kaks migratsiooni, `collection_runs` lifecycle'i 10 testi ja infra 16 testi läbisid; kogu komplekt 152/152 roheline. TypeScript läbis.
- Golden-source preflight: GO, `0002` pending ja 19 lisatavat objekti. Enne apply'd võeti kontrollitud custom dump `pre-0002-collection-runs-20260815.dump` (593 867 baiti, 194 TOC, SHA-256 `4AC280683CE408E768A21214B11154D0D1C04F0B4666211238BE7A4942DD480E`). `0002` rakendus 40 ms-ga, 0001 checksum klappis; järel-conformance `VASTAB` 0/0/0/0 driftiga.
- Päris `runCollection({trigger: 'verification'})` lõi golden-source rea #1: `success`, 4362 ms, scanned 200, candidates 7, lookup 23/0/23, Yahoo 23, SEC 25, Tradestie fallback true, liveDataSaved true. Sünteetilist failure-rida tootmisbaasi ei lisatud.
- Scheduler jäi kogu töö vältel puutumata ja töötama. Ajutisi test-DB ridu harness kustutas; golden-source verification-rida on teadlik audititõend ja jääb alles.

### 2026-08-15 - RDDT recall, valuuta/date parandused ja missed-move audit

- RDDT point-in-time audit kinnitas: ticker oli 11.–14.08 sotsiaalradaris, kuid negatiivse mention-growth'i tõttu jäi Yahoo top-40 päringust välja; `saveCollectedCompanies` viskas seejärel turuandmeteta nime ettevõtete universumist välja. Vana hinnatõusu tagantjärele snapshotiks ei backfillitud.
- Collection valib nüüd growth top-40 kõrval kuni 20 kõrge absoluutse tähelepanuga recall-tickerit ning säilitab kõik eelfiltri radaritickerid `companies` tabelis. `price_snapshots` saab rea ainult päris turuandme korral.
- Lisati `/missed-moves`: vähemalt 8% salvestatud päevahinnaliikumised klassifitseeritakse liikumisele eelnenud canonical otsuse ja radari ajaloo põhjal. Sündmuste loendur kasutab ainult olemasolevaid Yahoo/SEC/earnings ridu.
- Frequency 500 parandati PostgreSQL `DATE` normaliseerimisega andmekihi piiril ja kaitsva UI fallback'iga.
- Portfell ei märgista USD noteeringuid enam eurodeks: noteeringu valuuta liigub päringust UI-ni, EUR/USD kogusummad jäävad eraldi ja FX-konversiooni ei oletata.
- Uut välist allikat ega tasuta AI providerit ei lisatud. ClawLabsAI repo jääb võimaliku mudelitaristu ideeks, mitte turusündmuste allikaks.
- Verifitseerimine: TypeScript ja lint puhtad; production build kompileeris 14/14 lehte, sh `/missed-moves`; Vitest 141/141 roheline; app restart pärast buildi; `/frequency`, `/portfolio` ja `/missed-moves` HTTP 200. HTML smoke kinnitas Frequency vigase kuupäeva puudumist, portfelli USD/FX märkust ning missed-move päringu veatut renderdust. Ajutisi tootmis-DB testiridu ei loodud.

### 2026-08-12 - Catalyst Evidence V2 hardening audit

- Auditeeriti kõik read route'id: `/company/[ticker]`, `/thesis/[positionId]`, `/scanner`, `/scanner?preset=rklb`, `/watchlist`, `/daily`, `/validation` ja `/backtest` kirjutavad andmebaasi. Kõik kirjutused on olemasolev teadlik disain, kuid neid ei olnud dokumenteeritud ega UI-s nähtavad.
- Company detaili lisati nähtav hoiatus „Company detail may enrich local SEC data when opened.” koos selgitusega, et see võib muuta järgmise discovery jooksu sisendit.
- `/validation` ja `/backtest` koondnäitajad kuvavad nüüd mudeliversiooni ja run type'i jaotust ning ütlevad, et v1/v2 ja canonical/manual jooksu ei tohi lugeda ühe frequency-seeriana. Per-run `model_version` oli juba varem nähtav.
- CAKE off-mandate juhtumile lisati kandidaadikaardil eraldi hoiatus „Off-mandate evidence”; see ei ole gate ja ei muuda kaasamist.
- Provenance risk dokumenteeriti: `financial_facts` ei salvesta kirjutanud voogu; praegu on ainult heuristikad. Migratsiooni ei tehtud, tulevane otsus on `source_flow` väli.
- Migration sanity kontrolliti puhtal DB-l (`db/init.sql` + runtime `ensureSchema()`), olemasoleval DB-l ja pärast Docker restarti; catalyst-tabelid ja -veerud tekkisid mõlemal teel.
- Catalyst hindamise põhireegleid ei muudetud; bugi ei leitud. Score'e, Data Freshness loogikat ega discovery kaasamisreegleid ei puudutatud.

### 2026-08-12 - Catalyst Evidence V2 ehitatud

- Eemaldati catalyst hard gate: `getRklbDiscoveryCandidates` ei välista enam ühtegi ettevõtet katalüsaatori puudumise tõttu.
- Lisati `src/lib/catalyst-evidence.ts` (puhas hinnangukiht) ja `src/lib/catalyst-events.ts` (kogumine + püsivus). Avaldatud tõend tuletatakse olemasoleva `financial_facts` accession-grupist; uut välist allikat ei lisatud.
- Lisati tabelid `catalyst_events` ja `catalyst_assessments` ning 15 otsusehetke catalyst-veergu `discovery_decisions`-i; ajaloolisi ridu ei backfillitud.
- Mudeliversioon tõsteti `rklb-discovery-v2`-ks, sest kaasamisreegel muutus. Frequency-arvestus algab v2 esimesest canonical run'ist.
- Catalyst evidence tier lisati leksikograafilisse järjestusse ühe astmena; koondskoori ei tekkinud.
- Scanneri kandidaadikaart kuvab uue catalyst evidence ploki koos vastutõendite ja teadmata info plokiga; `/validation` kuvab salvestatud otsuse evidence-staatust.
- Lisati `npm run qa:catalyst` (11 juhtu) ja see kuulub `npm run check` koosseisu.
- Growth, Financial Health, Coverage ja `data-quality-v1` loogikat ei muudetud; catalyst kasutab data-quality väljundit stale/alignment kontrolliks.
- Kontrollid: lint, typecheck, `qa:data-quality` 7/7, `qa:catalyst` 11/11, production build, app restart, päris DB canonical run ja kaks kaitstud collect-jooksu idempotentsuse tõestuseks.

### 2026-08-12 - Catalyst Evidence V2 disain

- Koostati [`docs/CATALYST_EVIDENCE_V2.md`](CATALYST_EVIDENCE_V2.md) ainult olemasoleva funnel-auditi, viie ettevõtte research sprindi ja `data-quality-v1` kihi põhjal; uut andmeallikat ei eeldatud.
- Eristati kolm mõistet: sündmus, tõend ja catalyst. Praegune gate mõõdab ainult kirje olemasolu ajaaknas.
- Määrati viis hinnangumõõdet (materiality, direction, source quality, novelty, thesis-relevance) ning neist eraldi mandate-relevance, mille vajadust tõestas CAKE.
- Eristati earnings-kuupäev päris katalüsaatorist: `scheduled_window` ei saa olla `supported`, tõend nõuab uue `financial_facts` perioodi sidumist ning möödunud kuupäev ilma uue perioodita on `collection_gap`, mitte sündmusetus.
- Kirjeldati andmemudel `catalyst_events` + versioonitud `catalyst_assessments` ja otsusehetke väljad `discovery_decisions` uutel ridadel ilma backfill'ita; kaasamisreegli muutus nõuab `rklb-discovery-v2` mudeliversiooni.
- Kirjeldati BW ja CAKE juhtumite muutus ning kaheksa kaitset PLUG tüüpi false positive'ide vastu; lisati cohort'i põhine kalibreerimise testhulk.
- Koodi, filtreid, skeemi, score-valemeid ega provider'eid ei muudetud. Ehitamisotsus jääb kasutajale.

### 2026-08-11 - Data Freshness + Period Alignment V1

- Tehti research-dokumentide source sanity-check: API viitab Agorale, BW Babcock & Wilcoxile, CAKE Cheesecake Factoryle, HIMS Hims & Hersile ja ACHR Archerile; parandusi ega DB teesi automaatmuudatusi polnud vaja.
- Lisati eraldi `data-quality-v1` arvutuskiht seitsmele score'i põhimõõdikule koos perioodi, period kind'i, fact-vanuse, fact ID, accession number'i ja SEC algallikaga.
- Lisati ettevõtte kokkuvõte: newest/oldest period, oldest metric, median age, stale/unknown count ja period span; eraldi Freshness ning Alignment kvalitatiivsed olekud.
- Company detail näitab täielikku evidence-tabelit, RKLB kandidaadikaart kompaktset warning'ut ja Thesis Builder `Data quality warnings` plokki koos mitteblokeeriva Ready soft warning'uga.
- Growth, Financial Health, Coverage, catalyst hard gate, RKLB filtrid, universum, DB skeem ja välised andmeallikad jäid muutmata.
- Deterministlik QA läbis 6/6 juhtu. Päris DB ja brauser kinnitasid BW Coverage 100 + `mixed/poor`, API `fresh/good`, ACHR `fresh/warning` ning TSM ühe metricu puhul ausa `alignment unknown` oleku.
- Päris kaheksa ettevõtte kontrolli staatused: API `fresh/good`; BW `mixed/poor`; CAKE/HIMS/ACHR/RKLB/AAPL `fresh/warning`; TSM `fresh/unknown`.
- Lint, typecheck ja production build läbisid. App taaskäivitati; scanner, company detail, Thesis Builder, Validation ja Backtest kontrolliti töötavas runtime'is.
- Ajutisi DB QA-ridu ei loodud; cleanup-päring andis `companies`, `portfolio_positions` ja `discovery_decisions` TEST/QA tickerite arvuks 0.

### 2026-08-11 - Data Freshness + Period Alignment V1 lõpetamine ja kontroll

- Pooleli jäänud muudatused viidi lõpuni ilma uue funktsionaalsuse lisamiseta; roadmapi ei muudetud.
- README kirjeldab nüüd Data Freshness + Period Alignment kihti, selle 550/120/730 päeva heuristikaid ja `npm run qa:data-quality` käsku.
- `npm run check` sisaldab nüüd ka data-quality QA-d, et uus deterministlik test ei jääks aggregate gate'ist välja.
- Parandati perioodivahe ausus: alla kahe teadaoleva perioodi korral on span `unknown`, mitte 0 päeva. QA laienes 6-lt 7 juhule.
- Thesis Builderi Ready soft warning viidi ühtsesse eestikeelsesse sõnastusse ja eristab tühja sisendihulga aegunud/joondamata sisenditest.
- Kontrollid läbisid app-konteineris: lint, typecheck, `qa:data-quality` 7/7 ja production build; pärast build'i taaskäivitati app.
- Päris runtime kontroll kattis 14 ettevõtte detailvaadet, `/scanner?preset=rklb` viie kandidaadi kaarti, `/thesis/12`–`/thesis/16` ning puuduva SEC-andmestiku empty state'i. Ajutine kontrollpositsioon eemaldati.

### 2026-08-11 - Viie ettevõtte manual research sprint

- Kontrolliti API, BW, CAKE, HIMS ja ACHR olemasolevaid score'e, SEC CompanyFactsi fakte ning ettevõtete SEC/IR primaarallikaid.
- Loodi viiele tickerile koguseta Watchlisti research-kirjed ja versioonitud Thesis Builderi otsused: API `ready`, BW/HIMS `researching`, CAKE/ACHR `rejected`.
- Iga tees sisaldab business'i, why now, moat- ja mispricing-hüpoteesi, catalyst'i, riske, invalidation'it ning mõõdetavat 12 kuu kontrollpunkti.
- API jõudis ready staatusesse kasumlikkuse pöörde, likviidsuse, ADS buyback'i ja conversational AI mõõdetava kombinatsiooni tõttu; see ei ole ostusoovitus.
- CAKE ja ACHR rejection'id säästsid edasist research-aega eri põhjustel: esimene ei sobinud asümmeetria mandaadiga, teine ei tõendanud commercial economics'it.
- BW ja CAKE kinnitasid catalyst hard gate'i research false-negative riski. BW ja HIMS kinnitasid Freshness/Period Alignment vajadust.
- Koodi, UI-d, filtreid, score-valemeid, catalyst-reegleid, Coverage Score'i, universumit, välist API-t ega infrastruktuuri ei muudetud.
- Detailne allikapõhine tulemus ja järgmine tootesoovitus on failis `docs/RESEARCH_SPRINT_2026-08-11.md`.

### 2026-08-11 – Thesis Builder V1

- Laiendati `investment_theses` skeem struktureeritud väljade, staatuse, versiooni, content-hashi ja score snapshot'i viitega.
- Lisati versioonitud teesi andmekiht ja duplikaatversioone vältiv salvestus.
- Lisati `/thesis/[positionId]`, 12 kuu kontrollpunkt, „5-minute defense” ja versiooniajalugu.
- Lisati Growthi ja Financial Healthi kolm suurima kaalutud mõjuga põhjust Thesis Builderisse ja company detaili.
- Watchlistist saab alustada või muuta teesi; olemasoleva portfellipositsiooni tees suunatakse samasse Builderisse.
- Eristati automaatsed SEC-põhised tõendid kasutaja moat'i, mispricing'u ja „miks praegu?” hüpoteesidest.
- Kontrolliti build, runtime, server action'id, DB-versioonid, idempotentsus, `ready` valideerimine ja puuduva andmestiku empty state.
- Järgmine fookus viidi Watchlisti score-change alert'ile; sellele järgneb „Leia järgmine RKLB” eelseadistus.

### 2026-08-11 – Watchlisti score-change alert

- Lisati score snapshot'ide sama mudeliversiooni võrdlus ja 10 punkti olulisuse lävi.
- Lisati komponendi seisundimuutuse tuvastus ning suuna klassifikatsioon `new catalyst`, `new risk`, `needs review` või `no major changes`.
- Laiendati `alerts` tabelit struktureeritud JSON payloadi ja positsiooni ajaloo indeksiga.
- Lisati snapshotipaaril põhinev dedupe-võti; Watchlisti ja Daily kordusjooks ei loonud duplikaati.
- Lisati Watchlisti avatav score-muutuse detail ja Daily Changes põhjendus.
- Mudeliversiooni vahetus on nähtav, kuid seda ei esitata võrreldava skoorimuutusena.
- Kontrolliti lint, typecheck, production build, päris brauser, HTTP, PostgreSQL, idempotentsus ja testandmete cleanup.
- Järgmine fookus viidi `/scanner` eelseadistusele „Leia järgmine RKLB”.

### 2026-08-11 - „Leia järgmine RKLB” V1 ja kasutajajuhend

- Lisati läbipaistev `/scanner?preset=rklb` ilma koondskoorita.
- Lisati Growth, Coverage, ettevõtte mastaabi, runway ja katalüsaatori eraldi kriteeriumid.
- Kandidaat näitab valikupõhjuseid, peamisi riske, puuduvaid andmeid ja investori enda tõendamisküsimusi.
- Lisati tegevused `Lisa Watchlisti` ja `Alusta teesi`; olemasolev aktiivne või watch-positsioon taaskasutatakse.
- Null kandidaati on teadlikult korrektne tulemus.
- Lisati rakenduse `/guide`, navigatsioonilink ja põhjalik `docs/USER_GUIDE.md`.
- Kontrolliti päris brauseris kandidaadikaarti, Watchlisti lisamist, Thesis Builderisse suunamist, kasutajajuhendit ja empty state'i.
- Kõik CANDQA integratsioonitesti andmed eemaldati.
- Järgmine fookus viidi point-in-time discovery otsusesnapshotile, mis on ausa backtesti eeltingimus.

### 2026-08-11 - Discovery Decision Snapshot + Validation Framework

- Lisati muutumatud `discovery_runs`, tickeritaseme `discovery_decisions` ja viie horisondiga `candidate_outcomes`.
- RKLB scanner salvestab nüüd kõik vaadeldud tickerid koos kaasamise või välistamise põhjusega, mitte ainult lõplikud kandidaadid.
- Lisati mudeliversiooni, Tallinna otsusekuupäeva ja sisendräsi põhine idempotentsus.
- Lisati hilisemate tegelike hinnatulemuste mõõtmine 1n, 2n, 1k, 3k ja 6k horisondil; hind leitakse seitsmepäevasest vaatlusaknast.
- Outcome-värskendus käivitub päevase kaitstud `/api/collect` töö lõpus ning ka `/validation` avamisel.
- Lisati `/validation` horisondipõhise keskmise, mediaani, võitjate/kaotajate, parima/halvima kandidaadi ning täieliku run-auditiga.
- Kontrolliti lint, typecheck, päris runtime, PostgreSQL-i read, identne kordusjooks, viis tootlust, backfill-muutumatus ja päris brauseri UI.
- Kontrolliti pärast lõplikku restarti `/scanner?preset=rklb` 200, `/validation` 200 ja saladuseta `/api/collect` 401.
- Kõik VALQA integratsioonitesti andmed eemaldati.
- Järgmine fookus on aus point-in-time backtest / walk-forward valideerimine ja benchmark'i fikseerimine.

### 2026-08-11 - Point-in-time Backtest V1

- Laiendati `candidate_outcomes` benchmark'i sümboli, staatuse, algus-/lõpphinna, benchmark return'i ja excess return'i väljadega.
- Fikseeriti V1 benchmark'iks `SPY`; päevane `/api/collect` kogub selle hinna olemasoleva Yahoo/FMP kihi kaudu enne outcome'ide värskendamist.
- Lisati point-in-time benchmark'i algus- ja lõppaknad ning mõõdetud candidate/benchmark outcome'ide muutumatus.
- Lisati `/backtest` horisondistatistika, aus empty state, run-level detail ja nähtavad anti-cheat reeglid.
- Puuduv benchmark jätab excess return'i `unknown`; nulli ei fabritseerita.
- `BACKTESTQA1` andis candidate +10%, SPY +4% ja excess +6%; `BACKTESTQA2` andis candidate -5%, SPY +3% ja excess -8%.
- `BACKTESTQA3` candidate +2% mõõdeti, kuid puuduva SPY algushinna tõttu jäid benchmark ja excess `NULL`/`unknown`.
- Hiljem lisatud varasemad candidate ja SPY backfill-hinnad ei muutnud mõõdetud väärtusi.
- `/backtest` kontrolliti päris brauseris koos horisondistatistika, run-detaili, skooride, põhjenduste, riskide ja `SPY unknown` olekuga.
- Kaks BACKTESTQA run'i, kolm QA-ettevõtet, decision'id, outcome'id, QA hinnad, test-SPY ja ajutised SQL-failid eemaldati; DB järelkontrollid andsid 0.
- Lõplik `npm run lint`, `npm run typecheck` ja app-konteineri `npm run build` läbisid; build sisaldas dünaamilist `/backtest` route'i.
- Pärast buildi taaskäivitati app. `/scanner?preset=rklb`, `/validation` ja `/backtest` vastasid 200; saladuseta `/api/collect` vastas 401.
- Kaitstud päevakogumise päris runtime-test vastas 200 ja `benchmarkCaptured: true`; SPY hinnasnapshot salvestus olemasoleva hinnakihi kaudu ning outcome-värskendusi polnud vaja (`outcomeUpdates: 0`).
- Järgmine fookus on päris 3k/6k forward-valimi ning SPY hinnasnapshot'ide järjepidev kogumine.

### 2026-08-11 - Sector-relative Ranking V1

- Auditi alguses puudusid `companies` tabelist sector/industry väljad ja katvus oli 0/24. Olemasolev Yahoo provider tagastas AAPL jaoks `Technology / Consumer Electronics`, seega uut API-t ega võtit ei lisatud.
- Lisati ettevõtte klassifikatsiooni väljad ning Yahoo `assetProfile` andmete DB-sse salvestamine koos allika ja uuendamise ajaga; puuduv väärtus jääb ausalt unknown olekusse.
- Lisati sama score-versiooni industry/sector grupi Growth, Health, Coverage ja market cap percentile'id, võrreldavate arv ning skoorimediaanid. Alla viie täieliku võrreldava ettevõtte korral arvutust ei näidata.
- Scanneri kandidaadikaart, company detail ja Thesis Builder kuvavad sector-relative faktiplokki. Thesis Builder näitab evidence'it, kuid ei kirjuta kasutaja teesi.
- Uued discovery decision'id säilitavad sector, industry, grupitüübi, percentile'id, comparable count'i ja mediaanid otsuse hetkel; ajaloolised run'id jäid muutmata.
- SECTORQA kontrollides kuvati unknown-state, neljase grupi `Not enough comparable companies`, viiese grupi mediaanid/percentile'id ning scanneri ja Thesis Builderi plokid. Snapshotis oli `QA Systems | Growth percentile 50 | count 5 | median 89`.
- Kõik kümme SECTORQA ettevõtet, üks Watchlisti positsioon, üks discovery run, 1200 finantsfakti, hinnad, earnings ja score snapshotid eemaldati. Seitse järelkontrolli andsid 0.
- `npm run lint`, `npm run typecheck` ja app-konteineri `npm run build` läbisid. Pärast restarti vastasid `/scanner?preset=rklb`, `/company/AAPL`, `/validation` ja `/backtest` 200.

### 2026-08-11 - Koduarvuti handoff-audit ja järgmine kasutusfaas

- Pulliti tööarvuti `main` fast-forward commit'ini `1454157` ning kontrolliti koduarvuti Dockeri runtime'i ja uusi vaateid.
- Kinnitati, et scheduler käivitab iga päev `/api/collect`, kuid discovery run tekib praegu ainult RKLB scanneri avamisel.
- Päris DB-s oli üks null kandidaadiga discovery run ning puudusid Watchlisti ideed, teesid ja candidate outcome'id; 27 hinnaga ettevõttest oli SEC/score katvus ainult kolmel.
- Lisati enne canonical discovery automatiseerimist vajalikuks tööks olemasoleva SEC CompanyFactsi allika piiratud ja veakindel enrichment-järjekord.
- Planeeriti järgmise 1-2 nädala põhifookuseks regulaarne canonical discovery ajalugu, päris Watchlist/Thesis kasutus ja validation'i täitumine.
- Lisati järgmise väikese arendusena automaatne päevane discovery snapshot ning pärast vähemalt 5-10 päevast valimit discovery frequency/persistence: included-days, streak, first/last seen, rank trend ja muutunud vs sama evidence.

### 2026-08-11 - Daily SEC enrichment + canonical discovery

- Lisati olemasoleva SEC CompanyFactsi allika veakindel enrichment-järjekord ja `financial_enrichment_status` audit/retry tabel.
- Päevane eelarve on maksimaalselt viis katset Tallinna kalendripäeva kohta; sama päeva korduscollect uut batch'i ei käivita.
- `/api/collect` ootab live-hindade DB-salvestuse ära, kuid logib selle vea ega nurja ülejäänud kogumist.
- Collect salvestab pärast SPY ja enrichment'i ühe `rklb_daily` canonical run'i; käsitsi `rklb` run'id jäävad eraldi.
- Sama päeva muutunud sisend ei kirjuta canonical snapshot'i üle ning API näitab salvestatud universe/count väärtusi koos `inputChangedAfterCanonicalSnapshot` lipuga.
- API ja manuaalse collect-nupu staatus näitavad SEC katvust, päevast eelarvet ning daily discovery loendureid.
- Päris kordusjooksud kasvatasid SEC/score katvuse 3 ettevõttelt 13-le; DB-s oli täpselt üks daily run ja 8 muutumatut decision-rida.
- Kontrolliti lint, typecheck, production build, Docker runtime, API auth, päris SEC/Yahoo kogumine, DB read ja kordusjooksu idempotentsus.

### 2026-08-11 - Kahe arvuti canonical-history ja tasuta scheduler'i otsus

- Kinnitati, et Git sünkroniseerib koodi, kuid kodu- ja tööarvuti Docker PostgreSQL volume'id sisaldavad eri andmeid.
- Kell 08:00 koduarvutis töötav cron tunnistati kasutusmustriga mittesobivaks; tööarvutit ei valitud isikliku süsteemi püsihostiks.
- Soovituslikuks tasuta arhitektuuriks valiti üks Neon PostgreSQL canonical DB ning GitHub Actionsis ajastatud UI-st sõltumatu collector; mõlemad lokaalsed app'id loevad sama DB-d.
- Discovery frequency/persistence jäi järgmiseks analüütiliseks funktsiooniks, kuid alles pärast 5-10 päris canonical jooksu ja piisavat SEC/score katvust.
- IPO/Nasdaq radar jäeti hilisemaks ning selle eelistatud sisendiks valiti ametlik võtmeta Nasdaq Trader symbol directory, mitte juhuslik uus API.
- Kiiraudit tõi enne avalikku deploy'd esile autentimise puudumise, automaattestide puudumise, hajutatud skeemimuudatused, collection job'i luku/ledgeri puudumise ja Next.js 14 EOL staatuse.
- Uute API-võtmete kogumise asemel otsustati esmalt teha provider-gap/coverage audit; jagatud või mitteametlikke võtmeid ei kasutata.

### 2026-08-11 - 42 tickeri read-only funnel audit

- Auditeeriti viimast persisted radar snapshot'i, latest stored hindu, SEC fact'e, score snapshot'e ja viimast canonical `rklb_daily` run'i ilma collector'i, välise refresh'i või DB kirjutuseta.
- Varasema 43 asemel oli tõeallikaks olevas snapshot'is 42 tickerit; audit ei fabritseerinud puuduvat rida.
- 42-st oli hind ja market cap 31-l, SEC/score 10-l, sector/industry 0-l ja persisted instrument type ainult kahel; canonical jooks hindas radari seest viit ning kaasas null.
- Catalyst põhjustas nelja hinnatud radari tickeri välistamise; BW ja CAKE jäid välja ainult selle gate'i tõttu.
- Leiti, et Coverage ei kontrolli recency/period alignment'i: ARR revenue pärines 2011-st, BW debt 2021-st ja PLUG debt 2024-st, kuigi teised score-sisendid olid uuemad.
- Valiti manual research cohort API, BW, CAKE, HIMS ja ACHR ning koostati API, BW ja ACHR ausad thesis seed'id failis `docs/FUNNEL_AUDIT.md`.
- Järgmine soovitus on manual research sprint; filter-, score-, API-, UI- ja infraarendus jäävad seniks ootele.

### 2026-08-11 - Catalyst counterfactual + Freshness read-only audit

- Simuleeriti SQL-is catalyst hard gate'i eemaldamist ilma scannerit või DB andmeid muutmata.
- Immutable canonical run'is oleks lisandunud BW ja CAKE; post-enrichment hetkeseisus läbivad muud baasfiltrid BW, CAKE, API, HR ja PLUG.
- Praeguses snapshot'is pole ühelgi viiest base-eligible nimel catalyst'it; event-window on olemas ainult ARR-il ja ACHR-il, mis ei läbi või ei saa fundamentaalfiltreid.
- Auditeeriti kümne scored radari ettevõtte 60 olemasolevat core metricut. Üle kahe aasta vanad olid ARR revenue (2011) ja BW debt (2021); BW sai sellest hoolimata Coverage 100.
- PLUG debt oli range kahe aasta piiri sees, kuid 675 päeva ettevõtte uusimast score-sisendist maas, mis kinnitas eraldi Period Alignment vajadust.
- Järjekord jäi: esmalt manual research sprint ja inimese false-negative/rejection labels, seejärel Freshness/Period Alignment integrity layer, alles pärast seda catalyst hard gate'i võimalik muutmine evidence field'iks.
- Koodi, UI-d, score-valemeid, filtreid, väliseid API-sid ega DB andmeid ei muudetud.

## Session changelog — 2026-09-30

- **2026-09-30 paper checkpoint completed:** read-only Neon audit found entry-aware invested $8,508.50, marked value $8,310.52, unrealized loss $197.98 (-2.33%) versus matched SPY +$7.28. 85 buys / 14 open tickers / zero sales or pending entry-aware orders. Marks are today 16:30–16:35 Tallinn, not live. All 12 intervening core collections/canonical runs and fills on all eight trading days are present. DKS/YOU captured gains, CRDO entry timing lagged; EU/CAKE/BE were excluded by documented rules. All-picks still has three HRGN pending pairs and stale MSC valuation; causes remain unresolved. Independent SQL reconciles P/L. See [dated evidence and review](research/2026-09-30/REVIEW.md). No runtime code, strategy, database data or history changed; no tests/build/UI checks claimed.


### Session addition — external winners

- **2026-09-30 external-winner audit:** internet-selected winners compared with historical DB evidence. KOD arrived after its jump; GLND/INOD/VKTX were fetched but have zero financial facts and no canonical decisions, explained by the financial-facts inner join. META/INTC are explicitly blacklisted; MRNA lost tier slots or same-collection eligibility. GRML and several event winners have no recorded coverage under checked tickers. See [external review](research/2026-09-30/EXTERNAL_MOVERS.md). Next: investigate existing-source enrichment coverage and evaluate exclusions against user scope before any separately versioned policy change. No new provider, database writes or strategy changes; read-only evidence and source inspection only.

## Session changelog — market radar implementation, 2026-09-30

- Coverage expansion authorized by the user. Added six Yahoo discovery screens, bounded to 25 rows each, with explicit per-channel failures and US equity / USD validation. Added Today radar visibility for unscored companies; normal daily execution in both CLI and API expands existing SEC CompanyFacts budget to 20. Historical canonical decisions and paper policy remain unchanged. Verified on 1 October: 68 files / 519 tests passed; typecheck/lint/build passed, app restarted and real UI/DB checks completed. Collection #62 yielded 137 names and 15 new SEC-covered companies without changing the daily canonical snapshot. See [verification report](research/2026-09-30/MARKET_RADAR_VERIFICATION.md).

- **2026-10-01 publication:** feature commit `fb627d8` pushed to `origin/main`; `git ls-remote` confirmed `fb627d8182fa909ed6f06bbc26d46835fa021ce2`. Final runtime after Docker Desktop recovery: Today/Performance 200, unauthenticated collection POST 401; isolated test database count 0. No failed check was substituted for the full successful 519-test run. Next unattended execution remains pending.

## Session changelog — 2026-10-01 early discovery

- User requested discovery before a rise. Added versioned early scan inside market-radar collection with a maximum 20 Yahoo history requests, 15-second request timeout, evidence dates/IDs/SEC links and transparent exclusion/unknown reasons. No migration or paper policy change. First qualification is read from immutable collection metrics; later quotes are known-time USD observations only. Qualifying names remain in the existing daily capped tracking queue for 30 days even if they disappear from the latest screen.
- Real collection #63: 138 radar names, 2 watch / 43 excluded / 93 unknown. AMKR observed $52.3464, revenue +27.48%, 1/3/6m returns +14.47%/-24.84%/+11.30%; CDE $17.595, revenue +125.86%, returns -12.90%/+1.71%/-5.35%. Both have same-period positive OCF. These facts do not establish valuation, organic growth, safety or a future price jump. Canonical #95 reused, zero new orders/decisions/outcomes; tracking attempted/saved 2 with zero gaps or deferred names; CLI exit 0 and heartbeat HTTP 200. Final required verification completed: typecheck/lint/build passed, app restarted, 70 files / 523 tests passed, auth/UI/DB checks passed and isolated test DB count 0.

- **Early-discovery publication:** feature commit `4b98b67` pushed to `origin/main`; exact remote `4b98b67d6e859e8d13e638e86d43855b8227a299` verified. Final code checks and runtime evidence above are complete; next external unattended execution remains pending.

## Session changelog — 2026-10-03 status check

- Answered user follow-up with read-only persisted collection and early-history evidence. Checked first prices, latest known-time marks, AMKR exclusion reason and tracking rows; retained distinction between discovery return and actual paper P/L. Next focus remains broader forward sample, losses/misses and incomplete financial coverage. No code, schema, strategy or production database changes.

## Session changelog — 2026-10-06 status check

- Verified recent persisted collections, first-discovery returns and current paper dashboard using read-only application queries. Reported AMKR gain and CDE loss together; did not substitute discovery gains for filled-trade P/L or invent a total for the incomplete FOR valuation. Next follow-up: FOR mark coverage and broader forward cohort; profitability remains unproven.


## Session changelog — 2026-10-06 paper valuation recovery

- User authorized repairing the app and specified $20,000 initial paper capital / $10,000 monthly net-profit target. Fixed-budget policy is not yet implemented; maximum acceptable loss is unresolved.
- Refreshed existing simulated orders/holdings through the existing Yahoo executor. Actual terminal output: `pendingOrders: 6`, `filledOrders: 0`, `deferredOrders: 6`, `markedTickers: 34`; stale HRGN/MSC remained unusable and CLI exited 1. FOR received a fresh regular-session mark; current entry-aware total is now available and negative. [Recovered database evidence](research/2026-10-06/recovered-paper.json).
- Local fix exposes distinct `unmarkedHeldTickers` and fails regular-session execution when held-price refresh is incomplete even with no pending orders. Performance displays concrete valuation issues beside the primary money result. Regression checks cover no-pending missing held quotes, repeated fresh marks and market-session boundaries. No selection/eligibility/exit rule, schema, old fill or old evidence was rewritten. Verification completed for this reliability fix only; profitability and the fixed-capital strategy remain unresolved.

- Verification evidence: `npm run typecheck` exit 0; `npm run lint` emitted `No ESLint warnings or errors`; explicit golden-target production build exit 0 (`Compiled successfully`). The ordinary host build deliberately failed the `.env.local`/golden target guard; no guard was disabled. Host Vitest stalled before producing results and was interrupted, not counted as a pass. Supported `docker compose run --rm -T app npm test` completed: 70 files / 524 tests passed, 383.80s, exit 0. App restarted after build; real browser Performance displayed -$128.54 and all 14 positions; HTTP Today/Performance 200; disposable test database count 0. [Full regression output](research/2026-10-06/reliability-tests-docker.log), [build output](research/2026-10-06/reliability-build-golden.log), [runtime executor output](research/2026-10-06/reliability-execute.log). Runtime executor preserved all six deferred orders, inserted 33 new marks and explicitly reported `unmarkedHeldTickers: [MSC]` with exit 1. Next scheduled execution remains unverified.

- Publication blocker: local verified code/evidence commit is `f68bbba`. Automatic approval review rejected the combined force-add of diagnostic logs and `git push origin main`: potentially sensitive diagnostic data and unverified destination/main authorization. No force-add or push executed. Read-only verification subsequently confirmed `https://github.com/mnoormets/stock-discovery.git` and remote main `ed418cebb58f398a8a821529a1b11723733c2cd6`; source changes remain local. Resolved by the user's subsequent explicit approval and verified push on 6 October; raw diagnostic logs remain local/ignored. The next unattended job can now load the published fix, but its outcome has not been checked.


## Session changelog — 2026-10-06 approved publication

- Published the previously verified fix after explicit user approval. Read-only remote check before push found `ed418ce`; successful push advanced main to exact SHA `64cd931b8cb5193cb45472af5aef4ac679c20a79`. Diagnostic logs and database dumps were not staged or uploaded. This turn changes documentation only; previous verification remains the applicable code evidence. No new collection, simulated execution, production DB mutation or live order in this publication turn.


## Session changelog — 2026-10-06 persistent profit goal and finite-capital experiment

- User explicitly requested continued work until $10,000 profit. Created an active persistent goal; no completion claim, no real-money authorization. Rules are explicit design assumptions for paper testing because maximum acceptable loss remains unspecified: $2,000 including commission per entry, eight positions, $4,000 reserve, one first entry per ticker, no leverage/top-ups/re-entry, -8%/+20%/30-day observed exits and a latched $18,000 portfolio floor. The daily cadence can miss intraday exits and does not bound actual loss to the stop percentage. Taxes, FX, dividends and corporate-action adjustments remain unsupported; any apparent success needs independent reconciliation, including splits, before goal completion.
- Migration 0011 adds three isolated tables and immutable trade rows. Preflight GO (0 duplicate prices / invalid thesis states); private backup 13,567,817 bytes, 332 TOC entries, SHA-256 68fc1d5b3f1b97e2663935950cae4dde92d7b8401c69c9779efc5622486ca687, validated with PostgreSQL 18 pg_restore. Local app/scheduler stopped before apply; 0011 applied to Neon neondb in 114ms, ten old migrations skipped. Post-conformance VASTAB, zero missing/extra objects. App restarted after the explicit golden-target production build.
- Capital experiment executes before original V1 in the existing runner/workflow. Actual activation produced four capital trades, issues [], sourceCurrent true, candidateCount 2 and cashUsd 16000. Original control still exited 1 for six stale HRGN pending orders; do not describe the whole runner as healthy. Repeat capital-only execution filled zero trades. No broker order or temporary production test fixture was created.
- Created same-chat heartbeat `aktsia-pi-10-000-dollari-eesm-rgi-j-tkut`, ACTIVE, daily 18:00 Europe/Tallinn. It checks/repairs the experiment, preserves history/capital across policy changes, stays quiet without actionable changes and requires independently verified $30,000 cash / zero positions before completion. Desktop local follow-up requires this computer and app running; the existing GitHub-triggered executor remains the independent daily execution path after publication. Next unattended run is unverified.
- Focused tests: 2 files / 30 tests passed in 45.60s, including concurrent cash enforcement, repeated-run idempotence, immutable trades, known-time reads, missing/late/overheated entry prices, paired exits, risk latch and success only after liquidation. Typecheck/lint exit 0; production build exit 0; full suite 71 files / 531 tests passed in 425.58s. Final runtime: Today/Performance HTTP 200, disposable discovery_test count 0. Raw logs remain local/ignored under the user's publication preference.
- Published feature commit 0d969d0fb1deb52176a7a8fafd396346ee86ea5a to origin/main; exact remote verified with git ls-remote. Private backups and diagnostic logs were not staged or published. Scheduled execution on this new revision is still unverified; goal remains active, not achieved.

## Session changelog — 2026-10-07 capital split integrity

- Previous goal turn made concrete progress: remote manual paper workflow #40 (37510330202) ran published SHA 9956866 in 44s; capital issues [], zero new fills, current source #69, cash $16,000. V1 deferred six HRGN orders for stale timestamp, so whole job failed and healthy heartbeat stayed withheld. DB audit independently matches remote capital run at 18:19:23.976 UTC and four total trades. No claim of an unattended new-version run.
- New successful source #70 contains one watch name (CDE); missing financial/history coverage remains a limitation. No additional provider, retrospective discovery or real trade was introduced.
- Add existing-Yahoo split checks for held strategy/benchmark instruments from the entry day. Split/unknown/missing checks block affected quotes and fills; audit records split issues/check time. Performance withholds valuation without a usable check or when marks extend beyond the checked window. No automatic quantity adjustment, ledger rewrite, strategy threshold change or capital reset. Corporate actions other than splits remain unsupported.
- Docker was initially unavailable; focused tests did not start (not counted as a failure of test cases or as a pass). Restarted installed Docker Desktop and local test DB. Initial focused run had 10 pass / 1 failed assertion: its fixture made all healthy stocks rise and incorrectly expected their legitimate realized gains below $10,000. Corrected the fixture to isolate the split-distorted leg; 2 files / 11 tests passed in 10.90s. Final Docker typecheck/lint/build exit 0 (22/22 static pages), app restarted; Today/Performance HTTP 200 and real UI showed the dated -$13.50 / $0 realized result and guard explanation. Real Yahoo CDE/SPY/AMKR checks returned no split issues. A premarket executor audit at 08:49:30.240 UTC recorded zero fills, source #70, splitIssues [], four existing trades and unchanged cash/realized P/L. Full regression passed: 72 files / 535 tests in 582.45s; disposable discovery_test count 0. Full test command exited 0. Published fix a51716fbee8c6368db75d40c133b1eea0f7a9256 to origin/main; exact remote SHA verified. New-guard unattended market-session execution remains unverified. No private backups or diagnostic logs were published.

- Read-side coverage diagnosis against source #70/current stored financial summaries partitions the 79 unknowns: 34 have no stored summary, 13 lack revenue, 1 lacks comparable revenue, and 31 have different latest revenue/OCF periods. This is a current diagnostic, not a rewrite of scan-time evidence. Next: inspect compatible same-period filed facts and existing enrichment queue before proposing another versioned entry rule; do not assume all 79 would meet growth/positive-cash-flow/run-up rules, and do not relax guards merely to fill slots.

## Session changelog — 2026-10-07 18:20 Tallinn heartbeat

- Read README/AGENTS/HANDOFF and golden-source account. Prior capital run 13:35:41.322 UTC had split checks, issues [], zero new trades; external trigger provenance was not independently inspected. More than 30 minutes elapsed, so ran the existing paper CLI at 15:21:43.689 UTC. Capital remained active with source #70, one candidate, splitIssues [], issues [], cash $16,000 and zero fills. Account retains two positions and four trades; no top-up or policy change.
- Real dated quotes ~15:20 UTC: CDE $16.4299, AMKR $51.95, SPY $774.79. Dashboard equity $19,813.816855534566 / P&L -$186.18314446543445; independent SQL returned equity $19,813.816855534566 / P&L -$186.1831444654357. Realized P/L $0; target not reached and no completion claim.
- Whole CLI exited 1 because V1 deferred 10 orders and had unmarkedHeldTickers [API,BWFG]. Subsequent read-only Yahoo inspection confirmed API last trade 14:52:44 UTC, BWFG 14:57:10 UTC (both older than 20 minutes), HRGN previous close 6 October 20:00 UTC. Thus existing stale-price guard is functioning; did not force stale fills or relax it. Missing coverage remains explicit; unrelated legacy failure does not roll back the capital audit.
- Initial independent-query command had a shell quoting syntax error before DB execution; corrected literal here-string query succeeded. No code/schema changes, production test fixtures, tests/build claims, or real orders in this heartbeat. Next: compatible-period financial evidence/queue diagnosis and next fresh capital execution; preserve frozen policy and full loss history.


## Session changelog — 2026-10-07 AMD and Goal usage investigation

- Completed read-only AMD review: original collection #63/#70 rejection, exact stored SEC periods, compatible YTD evidence and retrospective strictly prior-date Yahoo references. Primary gap is summary period selection; independent run-up policy would still exclude AMD. No invented earlier buys or retroactive profits. See AMD_REVIEW.md for exact dates/values and evidence limits.
- Verified Goal usageLimited (213132 tokens / 1491 seconds reported) while ordinary account work remains allowed; exact persistent-goal stop condition is not exposed. Daily heartbeat configuration is ACTIVE. No goal completion/resume claim, code/schema/policy changes or test/build claim. Updated current state, focus and Now with concrete unresolved versioned work. Existing heartbeat documentation changes preserved.


## Session changelog — 2026-10-07 coherent-period growth and momentum discovery

- Implemented growth-opportunities-v2 alongside frozen early-opportunities-v1. Opt-in stored financial fact access preserves default company summaries. Latest known OCF period selects identical revenue start/end, kind and accession; comparable prior-year revenue must be in that same filing. No selecting an older favorable period over the latest negative OCF. Current evidence is bounded by quote time, not merely today.
- Separate early/momentum research categories; already-risen names are visible if documented growth/positive cash flow and positive 1/3-month momentum hold. Existing 20/35/50% run-up thresholds distinguish setups; no AMD-specific ticker preference. Daily chart closes on the quote date are excluded because Yahoo stamps bars at market open. Added evaluation-clock guard for DB/client clock skew.
- New Today section, source links, exact financial periods, transparent reasons and first-discovery history per ticker/category. New candidates share existing 50-symbol/day tracking budget for 30 days, with no orders, second capital account, top-ups or loss resets. Old early footer corrected to acknowledge its separate capital entry checks.
- Focused initial run: 5 files / 17 tests passed, 55.11s. Final typecheck/lint/build exit 0 and 22/22 pages. Initial fresh run --rm container creation stalled and was interrupted before tests. First full regression interrupted to add clock guard; the Docker client interruption left Vitest running, causing next setup to fail with empty schema_migrations. Identified/killed only orphan test PIDs; clean final full run passed 75 files / 547 tests in 518.23s on 11 migrations. Do not count either interrupted/setup-failed run as a pass.
- Real #71 radar 138: 30 excluded / 98 unknown / 5 momentum / 5 early, 17 chart attempts, no deferrals. AMD actual new discovery $644.37 at quote 16:00:23 UTC; evaluatedAt 16:02:18.871 UTC, facts 40702/40708/40762 and revenue growth 44.08%. DB completion clock was ~76s behind client evaluation clock; new read-side guard prevents exposing a future evaluation. No retrospective AMD purchase/profit. Collection CLI exit 1 for tracking cap: 5 attempted/saved, 4 deferred (IREN/LRCX/MU/PLTR); no missing/stale/invalid/failed quotes in that batch. Canonical #103 reused with 0 new orders/outcomes. Repeat #72 preserved first prices/times, reused canonical #103 with zero new orders/outcomes, and deferred the same four tracking names at the shared cap.
- Executor at 16:09:44.353 UTC reported sourceCurrent false; a completed-source retry at 16:12:56 also failed, proving client/DB clock skew rather than collection concurrency was the remaining cause, still 4 trades/$16,000 cash, splits []. V1 separately filled 4 pending orders, deferred 6 HRGN pairs and left BWFG/MSC without fresh marks; CLI exit 1. Read-only capital dashboard after marks: equity $19,818.741425 / total -$181.258575 / realized $0, issues []. Final #73 DB-clock collection and 16:24:52 executor resolved sourceCurrent to true, issues/splitIssues [], zero new capital trades. No real-money order.

- Final runtime: #73 evaluatedAt 16:18:20.799 UTC precedes finished_at 16:18:21.058 UTC; both scans use DB clock. Existing skewed #71/#72 history was preserved. Capital equity $19,823.559180 / total -$176.440820, realized $0, matched SPY -$21.590366. Whole paper CLI still exits 1 for six HRGN V1 orders; capital issues [].
- Final checks exit 0: typecheck; lint (No ESLint warnings or errors); build (Compiled successfully, 22/22); npm test (75 files / 547 tests, 518.23s). Disposable discovery_test count 0. App restarted after build; warm HTTP Today/Performance 200 with expected v2 and -176,44 content. Browser showed all 10 discoveries, matching AMD SEC periods, immutable first price $644.37, latest $642.50 (-0.29%), and actual Performance -$176.44 / realized $0 / source current yes. Initial cold smoke timed out before compilation completed; it is not counted as a pass. No real-money order or profitability/completion claim.

- Publication: verified feature commit `7f1422e0a2ea0e0b23c56d202f890c12870e3e46` pushed to origin/main; git ls-remote confirmed the same SHA. Diagnostic logs, database dumps and unrelated files were not staged. Next unattended execution and profitability remain unverified.

## Session changelog — 2026-10-07 same-ledger growth entry transition

- User asked why work stopped after research delivery. Implemented explicit, immutable growth-capital-entry-v2 activation on the existing early-capital-v1 account. Original rules, initial date/cash, old positions, trades, costs, losses and risk-stop latch remain. No parallel funded account or backdated entry. New policy uses coherent-period early/momentum research ranked by revenue growth then ticker, with all old quote, one-entry, reserve, sizing and exit checks. Only collection evaluations after the DB activation timestamp qualify.
- Migration 0012 adds only the immutable entry transition table, without data rewrites. Read-only Neon preflight GO: 0 duplicate prices / invalid thesis statuses, one pending migration and no unexpected objects. Backup/apply/activation/full regression/runtime verification are now complete; see the final evidence below. Focused disposable-DB tests passed 2 files / 11 tests in 32.42s; typecheck/lint/build passed with 22/22 pages.

- Final full regression: 76 files / 550 tests passed, 481.49s, exit 0; no disposable test DB remains. Initial full run failed solely on missing new table in infra-smoke inventory (549 passed / 1 failed, 559.16s); updated the inventory and reran the entire suite. Typecheck/lint/build exited 0 (22/22 pages). Backup verified: 14,295,236 bytes / 357 TOC entries, SHA-256 4b66d57ad74a6cfb3a2789a229692892c274f6cc7200d1ad9b19d523cc747b96; migration applied 117ms, conformance VASTAB, no missing/extra objects.
- Activated 16:58:20.389 UTC; repeat activation returns identical row. Source #74: 137 radar stocks / 11 growth candidates, evaluated 17:00:00.596 UTC before completion 17:00:00.813. Core collection under shared advisory lock; existing Tradestie fallback / missing optional FMP key remain explicit, no paid/new provider. Executor 17:00:23.466 filled 12 capital trades (six stock/SPY pairs), issues/splitIssues []; repeat 17:00:47.032 filled 0. Six new names MU/PLTR/IREN/CORZ/DELL/AVGO; initial CDE/AMKR still held. Old 4-row whole-record MD5 03559f4d667e7e71eb14b328de53fa3b unchanged before/after. One account, original start/capital, now 16 total trades/eight holdings/$4,000 cash. Independent SQL cash/equity/P&L reconciles to strategy -$190.269215 and SPY -$36.089400; realized $0. Whole combined CLI still exits 1 for six unrelated HRGN V1 deferred orders, not capital failure. App restarted after build; warm Performance/Today HTTP 200 with expected content and actual Performance browser showed active growth-capital-entry-v2, activation 19:58:20 Tallinn, eight positions, $4,000 cash, -$190.27 / $0 realized and source current yes. Publication remains pending at this checkpoint. Goal not achieved.

- Current focus/Now: run the activated policy forward and audit fresh paired marks, risk/target/holding exits and next unattended execution. Entry-policy transition work is completed and removed from Next implementation; broader strategy effectiveness, tracking capacity and legacy HRGN deferrals remain unresolved. No target completion claim.
