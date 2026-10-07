# Stock Discovery V1

Uue kasutaja töövoog ja funktsioonide selgitused: [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md).

Personaalne investeerimisjälgimise alus, mis ühendab tickeri otsingu, ettevõtte faktivaate, portfelli ja reeglipõhise “Daily Changes” kokkuvõtte. Rakendus ei anna ostu- ega müügisoovitusi ega kasuta AI-d finantsandmete väljamõtlemiseks.

## V1 võimalused

- `/performance` now leads with the separate `early-capital-v1` forward paper experiment: $20,000 fixed starting cash, $10,000 realized-profit target, no top-ups, up to eight $2,000 entry budgets and $4,000 cash reserve. Latest successful early-opportunities-v1 watch evidence must be current and the paired Yahoo USD regular-session execution quote must follow collection completion. Each ticker gets one entry, with no averaging/re-entry. Observed exits use -8% / +20% / 30 elapsed days; a $18,000 equity floor stops new entries and attempts liquidation. A target is reached only after liquidation leaves $30,000 cash and no holdings. Commissions plus 5 bps modeled slippage are included; taxes, FX, dividends and corporate-action adjustments are not modeled. Held instruments receive a bounded Yahoo split-history check from entry; detected splits or unknown history quarantine affected fills and valuation until quantity reconciliation. Rules are unvalidated assumptions, not a forecast. V1 remains a separate control. Migration `0011_paper_capital` is required; the existing paper executor runs the capital experiment before the control, so an old-control failure does not roll back successful capital fills.


- `/today#early-opportunities` screens current radar names for documented revenue growth (>=25% YoY), positive same-period USD operating cash flow and limited prior price appreciation. A bounded Yahoo daily-history read requires known 1/3/6-month returns below +20%/+35%/+50%, with session gain below 5%. Missing history, split events and unknown financial evidence never count as early. First qualifying discovery price/evidence is preserved in versioned collection metrics; names join the existing capped price tracking queue for 30 days and show change since discovery, separately from actual paper P/L. Initial thresholds are unvalidated research assumptions, not predictions or automatic orders.

- `/today#market-radar` shows six Yahoo market screens beyond social mentions: gainers, small-cap gainers, active trading, small-cap growth, technology growth and undervalued growth. Up to 25 rows per channel are deduplicated with source reasons, observed prices/times, session change, volume ratio and current SEC coverage. Missing financials do not hide a name; channel failures and old quotes remain visible. This bounded daily research radar is separate from the canonical paper-buy shortlist.
- Daily CLI/API SEC enrichment now shares a 20-company Tallinn-day budget (the standalone helper retains its five-company default); the existing per-company retry windows and SEC pacing remain in force.

- Financial evidence keeps reporting dates and definitions visible: EV/Sales is unavailable when cash/debt dates differ or are stale/unknown/future. Investment deductions may include separately disclosed productive-asset and software purchases; derived FCF requires the same filing and period. Ordinary-share counts are not automatically ADS or fully diluted counts.

- Tickeri valideeritud otsing ja ettevõtte detailvaade.
- Yahoo Finance’i hind, turukapitalisatsioon, maht, uudised ja tulemuste aeg, kui need on saadaval.
- SEC EDGARi viimased avaldused ja tasuta CompanyFactsi finantsajalugu (revenue, net income, OCF, tuletatud FCF, cash, debt ja shares outstanding), kui `SEC_USER_AGENT` on seadistatud.
- PostgreSQL-ist kohe avanev ettevõtte detailvaade; aegunud live-andmed värskendatakse taustal.
- Tasuta modulaarse signaalimootoriga Research Brief ettevõtte hinnamuutustest, finantsidest, katalüsaatoritest ja riskidest koos allikaviidetega.
- Läbipaistvad 0–100 Growth ja Financial Health skoorid koos komponentide, kaalude ja andmekattega; cash/debt komponent nõuab sama bilansipäeva. Fundamentaalne edetabel on mõlema skoori järgi sorditav.
- Eraldi Coverage Score ning versioonitud score-snapshotid: iga tulemus säilitab kasutatud SEC fact ID-d, perioodid, komponendid ja input-hashi.
- Coverage'ist eraldi Data Freshness + Period Alignment plokk näitab iga score-sisendi perioodi, perioodiliiki, vanust, SEC fact ID-d ja algallikat ning eraldi `fresh/mixed/stale/unknown` ja `good/warning/poor/unknown` olekuid; skoore ega filtreid see ei muuda.
- Watchlist kasutab olemasolevat portfelli `watch` staatust ning aitab Growth, Financial Health ja Coverage skooride järgi uusi uurimisideid leida.
- Thesis Builder loob Watchlisti ideest struktureeritud ja versioonitud teesi, seob selle otsuse hetke skoorisnapshotiga ning näitab Growthi ja Financial Healthi kolme peamist põhjust.
- Thesis Builder versions company-specific revenue, margin, cash-flow, dilution, valuation and downside assumptions, a reverse-valuation question and the next review trigger. Each saved version can retain the exact company price snapshot visible when it was written; older theses remain valid with unavailable price context rather than receiving a hindsight backfill.
- Today includes a read-only Thesis Review Queue for every current non-rejected active/watchlist thesis. It shows the thesis-linked decision price and latest stored price, computes their change only when currencies match, shows the recorded trigger and assumptions, and marks review due only for newer financial filings, qualifying assessed SEC events, or a passed results date without a newer filing. Free-text assumptions are never parsed into automatic pass/fail claims; saving a new thesis version records the human review.
- Watchlist ja Daily Changes võrdlevad järjestikuseid sama mudeliversiooni score-snapshot'e ning näitavad olulise muutuse korral skoorid, muutunud komponendid ja täpsed snapshot'i viited.
- Skänneri „Leia järgmine RKLB” preset annab olemasolevast universumist 0-6 läbipaistvalt põhjendatud uurimiskandidaati (kuni kaks igast versioned market-cap tier'ist), ilma koondskoori või ostusoovituseta.
- Catalyst Evidence V2: catalyst ei ole kaasamisfilter, vaid struktureeritud tõend, mis näitab sündmuse materiality't, suunda, allika kvaliteeti, uudsust, thesis-relevance'i ja mandaadi sobivust eraldi. Planeeritud earnings-kuupäev ega uudise pealkiri ei kvalifitseeru tõendiks.
- Iga RKLB discovery jooks salvestab muutumatu otsusehetke universumi, kaasatud ja välistatud tickerid, põhjused, skoorid, hinna, market cap'i, runway-kirjelduse, katalüsaatori, riskid ja teadmata info.
- Päevane `/api/collect` kasvatab olemasoleva SEC CompanyFactsi allika katvust maksimaalselt 20 ettevõtte kaupa ning salvestab ühe idempotentse `rklb_daily` canonical discovery run'i Tallinna kalendripäeva kohta. Canonical v4 lubab tier-kohtadele ainult sama collection run'i market-data lookupis kinnitatud tickerid, et varasem salvestatud nimi ei tõrjuks tänast kinnitatud kandidaati välja; käsitsi scanner jääb olemasoleva salvestatud universumi vaateks.
- Iga `runCollection()` põhikogumise katse loob `collection_runs` auditikirje: `running` läheb terminalolekusse `success` või `failure`, säilitades algus-/lõpuaja, kestuse, triggeri, versioonitud JSON-metricud ja piiratud veainfo. Katkenud protsess jääb nähtavalt `running` olekusse.
- Iga uus canonical `rklb_daily` discovery run saab ühe immutable `data_quality_snapshots` kirje: otsuse hetke universumi SEC/score/sektori/hinnakate, freshness-loendurid ja nähtavad riskiflagid. Manual `rklb` run'idele snapshot'i ei looda.
- Iga measured candidate outcome saab automaatselt immutable Outcome Analysis Snapshot V1 kirje, mis külmutab ainult otsusehetke decision/quality/collection provenance'i ning outcome'i enda. Winner ja benchmark beat on eraldi; puuduv sisend jääb `unknown`.
- `/research/outcome-attribution` koondab canonical measured outcome'id Growth, Health, Coverage, sektori ja market cap'i bucketitesse ning näitab keskmist/mediaantootlust, üle 10% win rate'i ja alla 0% loss rate'i. Alla viie vaatlusega bucket ei lähe automaatsetesse highlight'idesse; RKLB Total Score'i ei leiutata, sest discovery kasutab leksikograafilist järjestust.
- `/research/outcome-coverage` mõõdab read-only vaates, kui suur osa `collection_run_items` ajaloost on seotud immutable Outcome Analysis Snapshotiga. Vaade näitab üldkatvust, collection-run'i ja kandidaadi vanuse bucketite katvust ning eristab ausalt headline'i distinct-symbol ühikut item-level run/age loenduritest.
- `/research/outcome-backfill-audit` näitab ilma kirjutamata, millised collection item'id on täpselt 30D/90D/180D vanused ning kas olemasolevas lokaalses `price_snapshots` ajaloos leidub ausaks mõõtmiseks nii algus- kui lõpphind. Vaade ei loo outcome'e, hindu ega snapshot'e.
- `/research/discovery-quality` auditeerib read-only kujul collection item'ite tegelikku koostist: sector/market-cap/country/exchange katvus, korduvad tickerid ning immutable decision'itega seotud Growth/Health/Coverage jaotused. Unknown read jäävad nimetajasse ja Total Score'i ei sünteesita.
- `/research/metadata-coverage` inventeerib iga collection item'i kohta nõutud ja skeemist automaatselt leitud metadata väljad. SQL NULL, tühi väärtus, Unknown/N/A-silt ja skeemis puuduv väli jäävad eraldi; vaade ei rikasta ega paranda andmeid.
- `/research/metadata-root-cause` jälgib read-only funnelis collection item'i market-data valikut, company identity/linki, metadata't ja item-linked score'e ning määrab iga rea esimese tegeliku katkekoha. Olemasoleva company identity'ga unselected tickerit ei nimetata ekslikult lookup failure'iks.
- `/today` on read-only Daily Research Brief: latest canonical run, collection status, top kandidaadid, provenance, data quality, review-itemid, päevamuutus, missed moves ja järgmised outcome-kuupäevad ühel hommikusel research-vaatel. Kandidaadikaart eristab kõrvuti fundamentaalset Business-olekut, hinnaliikumise Market setup'i ja üheselt nimetatud `Eligible for paper entry` / `Wait` otsust. `Eligible` tähendab, et entry-aware V1 looks sellele päevale uue hüpoteetilise $100 buy intent'i; see on appi selgeim positiivne uurimisseis, mitte pärisorder ega personaalne investeerimissoovitus.
- `/validation` eraldab canonical tulemused mudeliversiooni ja 1 nädala, 2 nädala, 1 kuu, 3 kuu ning 6 kuu horisondi järgi. Sama tickeri korduvad otsused keskmistatakse esmalt tickeri sees; tickeripõhised tulemused ja otsuseridade katvus kuvatakse eraldi.
- `/backtest` loeb ainult salvestatud point-in-time discovery run'e ja outcome'e, hoiab mudeliversioonid eraldi ning võrdleb võrdse tickerikaaluga tulemusi SPY benchmark'iga. Iga kohort näitab otsuste, eri tickerite, mõõdetud, ootel, puuduvate ja unavailable tulemuste arvu.
- `/performance` opens with entry-aware paper money put in (including fees), holdings value plus sale proceeds, and dollar/percentage gain or loss. Each filled ticker shows its first purchase, quantity-weighted average buy price, usable dated mark, and net P/L. Repeat buys are combined; pending/skipped orders are excluded. Sold positions retain their net sale result. Missing marks remain unavailable; comparisons, rules and the order ledger are collapsed below.
- `/performance` on versioned Paper Strategy V1 mõõtmisvaade: iga canonical valik saab `$100` all-picks baseline'i ning läbipaistvate business/freshness/run-up väravatega entry-aware paralleelvariandi. Entry-aware `eligible` on appi hüpoteetiline buy signal ja iga uus eligible päev loob uue $100 intent'i ka korduva tickeri puhul. Mõlemal on sama rahavoo SPY book; hypothetical fill nõuab Yahoo `REGULAR` turuseisu ja kuni 20 minuti vanust USD quote'i. Iga order näitab kõrvuti immutable signal-time Business ja Market setup olekut ning selle tegelikke põhjuseid; vana või vigane snapshot jääb `unknown`. See ei saada brokerile ordereid.
- Sector-relative Ranking võrdleb Growth, Financial Health, Coverage ja market cap'i olemasoleva Yahoo sector/industry grupi sees; alla viie võrreldava ettevõtte korral percentile'i ei kuvata.
- Rakenduses ja failis `docs/USER_GUIDE.md` on uue kasutaja töövoogu selgitav kasutusjuhend.
- Portfelli CRUD: ticker, kogus, keskmine ostuhind, tees, ajahorisont, staatus ja märkmed.
- Teesi muutmise ajalugu PostgreSQL-is.
- “Daily Changes” aktiivsetele ja jälgitavatele positsioonidele.
- Varasem Redditi tähelepanuradar on säilitatud eraldi abisignaalina.

Kui allikas andmeid ei anna, kuvab rakendus `No data available yet`.

Price integrity: Today shows the decision-linked price observation time; stale observations make the current setup unknown, and partial history is labelled explicitly. Paper execution also refreshes open holdings without new orders. Performance withholds value/P&L when USD marks are missing, stale, or differ from SPY by date or more than 20 minutes. Read-side recency allows one elapsed New York trading day, excluding weekends and the NYSE's published 2026–2028 full-day holidays; dates outside that explicit schedule fall back conservatively to weekdays. A hypothetical app order and its same-cash-flow SPY benchmark now fill only as a complete pair when both quotes are executable. During an expected New York regular session, any deferred hypothetical order or held ticker without a fresh executable mark makes the executor CLI fail, so its workflow cannot send a healthy heartbeat while an eligible buy remains unfilled or holdings cannot be freshly marked. The CLI lists unmarked held tickers even when no orders are pending. Closed-market and holiday runs may leave orders pending for the next session. Frozen signal evidence and the original paper eligibility policy remain unchanged.

Continued price tracking runs after the canonical snapshot and before outcome measurement in both daily collection entrypoints. It uses Yahoo quotes for active/watchlist positions, open paper holdings and canonical picks with unmeasured horizons whose seven-day observation windows have not ended, plus SPY. The cap is 50 symbols per New York day; repeated runs share that budget and older attempts receive priority. Only finite positive USD prices with recent, non-future market timestamps are saved. Closed-market quotes may be research observations, never paper fills. `price_tracking_attempts` records each symbol's reason and result separately from discovery items. `price_snapshots.captured_at` records receipt time; `market_at` records quote time, and repeating the same quote cannot manufacture another observation. All Yahoo price writers preserve quote time. New outcome endpoints require known market time at/after the target, no later than receipt, and receipt no later than the evaluation clock. Unknown legacy timestamps cannot create new measurements; already-measured rows remain unchanged and results pages flag this historical limitation. Today displays the latest tracking batch and remaining queue. Migration `0009_price_tracking` is required; incomplete tracking returns HTTP 503 / CLI failure while preserving completed collection work.

## Kohalik käivitamine Dockeriga

1. Kopeeri `.env.example` failiks `.env`.
2. Määra Neoni `DATABASE_URL` ja jäta `DATABASE_TARGET=golden`.
3. Määra pikk juhuslik `CRON_SECRET`.
4. Määra SEC nõuetele vastav `SEC_USER_AGENT`, kui soovid EDGARi andmeid.
5. Käivita:

```bash
docker compose up --build
```

Ava <http://localhost:3005>.

## Kohalik käivitamine ilma rakenduse Dockerita

Vaja on Node.js 22 ja töötavat PostgreSQL-i.

```bash
npm ci
npm run dev
```

`DATABASE_URL` ja `DATABASE_TARGET` tuleb seada paarina. Golden source nõuab väärtust `golden` ja `neon.tech` hosti; tahtlik lokaalne app nõuab väärtust `local` ja lokaalset hosti; testid nõuavad väärtust `test` ning `_test` või `_tmp` lõpuga baasinime. Vale paar katkestab käivituse enne ühendamist, mis takistab `.env.local` failil Neoni sihti vaikselt lokaalse koopiaga asendamast. Skeemi kanooniline allikas on **versioonitud migratsioonid** kaustas `db/migrations` — rakenda need runneriga:

```bash
npm run migrate -- --preflight
npm run migrate
```

Ajalooline taust: värske Dockeri andmebaas jookseb ka `db/init.sql` ja rakendus loob puuduvad tabelid käivitusel ise (`ensureSchema()`). Nii jääb rakendus töökorda ka ilma migratsioone rakendamata, kuid `schema_migrations` raamatupidamine ja mõned piirangud jäävad puudu. Runbook ja kaitstud golden-source DB reeglid: [`db/migrations/README.md`](db/migrations/README.md).

## Kaitstud radari kogumine

Ajastaja saadab `CRON_SECRET` väärtuse Bearer tokenina. Käsitsi saab koguda dashboardi vormist või käsurealt:

```bash
curl -X POST http://localhost:3005/api/collect \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Automaatne GitHub Actions päevatöö teeb enne põhikogumist idempotentse SEC Form 4 rolling catch-up'i eelmise seitsme USA kalendripäeva kohta. Form 4 tõrge ei jäta sotsiaalset põhikogumist vahele, kuid muudab workflow lõpus failure'iks, et allikaauk ei jääks vaikseks; dry-run Form 4 ingestion'it ei käivita. Üks edukas põhikogumine salvestab radariettevõtete hinnad, SPY benchmark'i, kuni viis puuduva või aegunud SEC CompanyFactsi katvusega ettevõtet, canonical discovery snapshot'i, selle point-in-time andmekvaliteedi kirje ning valminud candidate outcome'id. Põhikogumise lifecycle ja providerimõõdikud salvestatakse `collection_runs` tabelisse. Enrichment- või discovery alamfaasi viga logitakse ja tagastatakse eraldi staatusena; canonical discovery järel ebaõnnestunud kvaliteedisnapshot teeb discovery sammu kriitiliselt ebaõnnestunuks, kuid juba committed run jääb auditisse alles.

## Keskkonnamuutujad

| Muutuja | Vajalik | Kasutus |
|---|---:|---|
| `DATABASE_URL` | jah | PostgreSQL ühendus |
| `DATABASE_TARGET` | jah | Sihtlepingu tüüp: `golden`, `local` või `test` |
| `CRON_SECRET` | jah | `/api/collect` kaitse |
| `SEC_USER_AGENT` | SEC jaoks | SEC EDGAR, CompanyFacts ja kauplemispeatamiste feed |
| `FMP_API_KEY` | ei | Yahoo varuallikas radari fundamentaalidele |
| `HEALTHCHECKS_PING_URL` | ei | `collect:daily` dead-man-switch heartbeat pärast kinnitatud edukat canonical run'i |
| `PAPER_STRATEGY_HEALTHCHECKS_PING_URL` | ei | eraldi dead-man-switch heartbeat pärast edukat paper-strategy execution'it |
| `TZ` | ei | Ajavöönd, vaikimisi Europe/Tallinn |

Yahoo Finance, ApeWisdom ja Tradestie ei vaja selles prototüübis API-võtit, kuid nende avalikud liidesed võivad olla piiratud või muutuda.

`HEALTHCHECKS_PING_URL` tuleb pärast Healthchecks.io check'i loomist lisada lokaalsesse `.env` faili ja GitHub Actionsi samanimelise repository secret'ina. CLI saadab sellele GET-päringu ainult siis, kui kõik collect'i sammud lõppesid veata ja tänase Tallinna päeva canonical run on andmebaasis kinnitatud (uus või idempotentselt taaskasutatud). Dry-run, osaline/ebaõnnestunud jooks ega puuduv canonical run heartbeat'i ei saada; heartbeat'i enda tõrge jääb hoiatuseks ega muuda edukat collection'it failure'iks.

`PAPER_STRATEGY_HEALTHCHECKS_PING_URL` viitab eraldi Healthchecks.io check'ile ja on GitHub Actionsi samanimelise repository secret'ina seadistatud. `paper-strategy-execute` workflow pingib seda ainult pärast edukat hypothetical execution'it; ebaõnnestunud execution ei saa tervet ping'i saata. Seadistamata URL jätab sammu vahele ning Healthchecks-võrgutõrge ei muuda juba õnnestunud paper execution'it ebaõnnestunuks.

## Kvaliteedikontroll

```bash
npm run lint
npm run typecheck
npm run qa:data-quality
npm run qa:catalyst
npm run build
```

`npm run check` käivitab kõik viis järjest.

## Praegused piirid

- “Daily Changes” kasutab läbipaistvaid reegleid ja kuni 20 aktiivset/jälgitavat positsiooni ühe vaate kohta.
- Uudise pealkirja märksõna on ainult ülevaatuse signaal, mitte faktihinnang.
- SEC CompanyFacts ei ühtlusta kõigi emitentide XBRL tage täielikult; puuduv näitaja kuvatakse tühja olekuna. Free cash flow on rakenduses tuletatud kui operating cash flow miinus capital expenditure.
- Growth Score kaalub revenue, net income’i, operating cash flow ja free cash flow aastamuutusi. Financial Health kaalub rahavoogude kvaliteeti, cash/debt suhet, kasumlikkust ja aktsiate arvu muutust. Mõlemad on uurimisfiltrid, mitte investeerimissoovitused.
- Data Freshness + Period Alignment on eraldi kvalitatiivne integrity-kiht, mitte skoor: V1 loeb üle 550 päeva vana fakti stale sisendiks, kuni 120-päevast perioodivahet joondatuks ja üle 730-päevast vahet halvasti võrreldavaks. Need läved on läbipaistvad heuristikad ja vajavad päris näidete põhjal kalibreerimist.
- Catalyst evidence läved (revenue 25%/5%, kasumi-rahavoo 20%, mandaadi 25%/10% ja 25 mld / 3 mld market cap) on läbipaistvad heuristikad, mis kalibreeriti olemasoleva research cohort'i päris SEC faktide järgi. Nõrk catalyst langetab järjestust, ei välista ettevõtet.
- Mitu vaadet kirjutavad avamisel andmebaasi: company detail ja Thesis Builder võivad käivitada taustal SEC CompanyFactsi värskenduse ning salvestada score-snapshot'i, `/scanner?preset=rklb` salvestab discovery jooksu ja `/validation` ning `/backtest` värskendavad outcome'e. Käsitsi sirvimine võib seega muuta järgmise discovery jooksu sisendit; juba salvestatud canonical päevajooksu see ümber ei kirjuta.
- `financial_facts` ei säilita, kas fakt tuli päevasest collectorist või lehe avamisel käivitunud taustavärskendusest. Provenance on praegu ainult heuristikaga tuletatav.
- Catalyst evidence ei erista ettevõtte IR-teadet omaette allikana: olemasolevate allikatega ei saa seda uudise pealkirjast eristada, mistõttu `primary_ir` katvus puudub ja see kuvatakse teadmata infona.
- Coverage Score on Growth ja Financial Health mudelite kaalutud sisendikatte keskmine. Growth/Health edetabelites kuvatakse vähemalt 70 coverage ettevõtted enne madalama kattega tulemusi, et üksiku komponendi kõrge skoor ei oleks eksitav.
- Score-mudeli versioon on salvestatud iga snapshotiga. Valemi muutmisel tuleb versiooni tõsta, et eri valemitega tulemusi ei võrreldaks vaikimisi sama ajaloona.
- Rakendus ei sisalda optsioonianalüüsi, ajaloolist ümbervalikut ega automaatset kauplemist.
- Paper Strategy ei ole automaatne kauplemine: `paper_strategy_orders` on ainult hüpoteetiline ledger. V1 modelleerib USA aktsiaorderi 0,1% komisjoni (min $0.10, max $1), kuid mitte makse, dividende, FX-i, slippage'it ega Lightyeari tegelikku täitmist. `0008_paper_strategy` on Neoni golden source'il rakendatud; esimene 12-orderiline hypothetical fill ja `/performance` smoke on kontrollitud. `paper-strategy-execute` workflow jääb ainult `workflow_dispatch`-iks, kuid cron-job.org dispatch'ib seda iga päev 09:35 `America/New_York`; 11. septembri unattended run #11 õnnestus 42 sekundiga. Eraldi Healthchecksi dead-man heartbeat on aktiivne ja selle esimene live-ping tõestati 13. septembri manuaalse run #13-ga. Turutunni ajal ei loeta execution'it edukaks, kui mõni hüpoteetiline order jääb deferred olekusse.
- Nasdaq new-listing radar ei ole veel production discovery'ga ühendatud. `npm run calibrate:nasdaq-listings` on DB-vaba read-only kalibratsioon, mis võrdleb ametlikke jooksvaid `nasdaqlisted.txt` ja `TradingSystemAddsDeletes.txt` faile; `--artifact-dir` säilitab mõlemad täpsed source-payloadid ja versioneeritud `observation.json` raporti. Eraldi `nasdaq-listing-observation` workflow ei saa DB secret'it ega käivita collect'i; cron-job.org dispatch'ib seda iga päev 09:35 `America/New_York`, et koguda 30 päevaks säilitatavaid kalibratsiooniartifact'e. Esimene täielik directory on ainult baseline ning ühtki olemasolevat tickerit ei nimetata selle põhjal uueks.
- Validation on forward outcome tracking, mitte täielik ajalooline backtest: see kogub tulemusi alates salvestatud discovery jooksudest ega rekonstrueeri minevikku tänaste andmetega.
- Backtest V1 on salvestatud forward outcome'ide aus kohordivaade, mitte tõend strateegia toimivuse ega tulevase tootluse kohta. Mudeliversioone ei liideta ning korduvat päevast tickerit ei loeta sõltumatuks panuseks.
- SEC enrichment'i päevane eelarve on vaikimisi viis katset Tallinna kalendripäeva kohta. `unavailable` tickerit proovitakse uuesti kõige varem 30 päeva ja transient `error` tickerit järgmisel päeval.
- Sector-relative ranking kasutab ainult salvestatud klassifikatsiooni ja sama score-versiooni täielikke võrreldavaid ettevõtteid. Puuduv sector/industry või alla viie liikmega grupp jääb unknown/insufficient olekusse.
- Research Brief kasutab läbipaistvaid kohalikke reegleid ja rakendusse kogutud allikaid; see ei asenda algdokumentide kontrollimist ega investeerimisnõustamist.
- Redditi skoor on uurimisnimekirja signaal, mitte tootluse prognoos.
