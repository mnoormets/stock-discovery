# Stock Discovery V1

Uue kasutaja töövoog ja funktsioonide selgitused: [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md).

Personaalne investeerimisjälgimise alus, mis ühendab tickeri otsingu, ettevõtte faktivaate, portfelli ja reeglipõhise “Daily Changes” kokkuvõtte. Rakendus ei anna ostu- ega müügisoovitusi ega kasuta AI-d finantsandmete väljamõtlemiseks.

## V1 võimalused

- Tickeri valideeritud otsing ja ettevõtte detailvaade.
- Yahoo Finance’i hind, turukapitalisatsioon, maht, uudised ja tulemuste aeg, kui need on saadaval.
- SEC EDGARi viimased avaldused ja tasuta CompanyFactsi finantsajalugu (revenue, net income, OCF, tuletatud FCF, cash, debt ja shares outstanding), kui `SEC_USER_AGENT` on seadistatud.
- PostgreSQL-ist kohe avanev ettevõtte detailvaade; aegunud live-andmed värskendatakse taustal.
- Tasuta modulaarse signaalimootoriga Research Brief ettevõtte hinnamuutustest, finantsidest, katalüsaatoritest ja riskidest koos allikaviidetega.
- Läbipaistvad 0–100 Growth ja Financial Health skoorid koos komponentide, kaalude ja andmekattega; fundamentaalne edetabel on mõlema skoori järgi sorditav.
- Eraldi Coverage Score ning versioonitud score-snapshotid: iga tulemus säilitab kasutatud SEC fact ID-d, perioodid, komponendid ja input-hashi.
- Coverage'ist eraldi Data Freshness + Period Alignment plokk näitab iga score-sisendi perioodi, perioodiliiki, vanust, SEC fact ID-d ja algallikat ning eraldi `fresh/mixed/stale/unknown` ja `good/warning/poor/unknown` olekuid; skoore ega filtreid see ei muuda.
- Watchlist kasutab olemasolevat portfelli `watch` staatust ning aitab Growth, Financial Health ja Coverage skooride järgi uusi uurimisideid leida.
- Thesis Builder loob Watchlisti ideest struktureeritud ja versioonitud teesi, seob selle otsuse hetke skoorisnapshotiga ning näitab Growthi ja Financial Healthi kolme peamist põhjust.
- Watchlist ja Daily Changes võrdlevad järjestikuseid sama mudeliversiooni score-snapshot'e ning näitavad olulise muutuse korral skoorid, muutunud komponendid ja täpsed snapshot'i viited.
- Skänneri „Leia järgmine RKLB” preset annab olemasolevast universumist 0-5 läbipaistvalt põhjendatud uurimiskandidaati, ilma koondskoori või ostusoovituseta.
- Catalyst Evidence V2: catalyst ei ole kaasamisfilter, vaid struktureeritud tõend, mis näitab sündmuse materiality't, suunda, allika kvaliteeti, uudsust, thesis-relevance'i ja mandaadi sobivust eraldi. Planeeritud earnings-kuupäev ega uudise pealkiri ei kvalifitseeru tõendiks.
- Iga RKLB discovery jooks salvestab muutumatu otsusehetke universumi, kaasatud ja välistatud tickerid, põhjused, skoorid, hinna, market cap'i, runway-kirjelduse, katalüsaatori, riskid ja teadmata info.
- Päevane `/api/collect` kasvatab olemasoleva SEC CompanyFactsi allika katvust maksimaalselt viie ettevõtte kaupa ning salvestab ühe idempotentse `rklb_daily` canonical discovery run'i Tallinna kalendripäeva kohta.
- Iga `runCollection()` põhikogumise katse loob `collection_runs` auditikirje: `running` läheb terminalolekusse `success` või `failure`, säilitades algus-/lõpuaja, kestuse, triggeri, versioonitud JSON-metricud ja piiratud veainfo. Katkenud protsess jääb nähtavalt `running` olekusse.
- Iga uus canonical `rklb_daily` discovery run saab ühe immutable `data_quality_snapshots` kirje: otsuse hetke universumi SEC/score/sektori/hinnakate, freshness-loendurid ja nähtavad riskiflagid. Manual `rklb` run'idele snapshot'i ei looda.
- Iga measured candidate outcome saab automaatselt immutable Outcome Analysis Snapshot V1 kirje, mis külmutab ainult otsusehetke decision/quality/collection provenance'i ning outcome'i enda. Winner ja benchmark beat on eraldi; puuduv sisend jääb `unknown`.
- `/research/outcome-attribution` koondab canonical measured outcome'id Growth, Health, Coverage, sektori ja market cap'i bucketitesse ning näitab keskmist/mediaantootlust, üle 10% win rate'i ja alla 0% loss rate'i. Alla viie vaatlusega bucket ei lähe automaatsetesse highlight'idesse; RKLB Total Score'i ei leiutata, sest discovery kasutab leksikograafilist järjestust.
- `/research/outcome-coverage` mõõdab read-only vaates, kui suur osa `collection_run_items` ajaloost on seotud immutable Outcome Analysis Snapshotiga. Vaade näitab üldkatvust, collection-run'i ja kandidaadi vanuse bucketite katvust ning eristab ausalt headline'i distinct-symbol ühikut item-level run/age loenduritest.
- `/research/outcome-backfill-audit` näitab ilma kirjutamata, millised collection item'id on täpselt 30D/90D/180D vanused ning kas olemasolevas lokaalses `price_snapshots` ajaloos leidub ausaks mõõtmiseks nii algus- kui lõpphind. Vaade ei loo outcome'e, hindu ega snapshot'e.
- `/today` on read-only Daily Research Brief: latest canonical run, collection status, top kandidaadid, provenance, data quality, review-itemid, päevamuutus, missed moves ja järgmised outcome-kuupäevad ühel hommikusel research-vaatel. See ei ole trading recommendation.
- `/validation` mõõdab kaasatud kandidaatide tegelikku hinnamuutust eraldi 1 nädala, 2 nädala, 1 kuu, 3 kuu ja 6 kuu horisondil ning näitab keskmist, mediaani, võitjaid, kaotajaid, parimat ja halvimat tulemust.
- `/backtest` loeb ainult salvestatud point-in-time discovery run'e ja outcome'e, võrdleb mõõdetud kandidaate SPY benchmark'iga ning kuvab excess return'i ainult siis, kui mõlemad hinnad on päriselt olemas.
- Sector-relative Ranking võrdleb Growth, Financial Health, Coverage ja market cap'i olemasoleva Yahoo sector/industry grupi sees; alla viie võrreldava ettevõtte korral percentile'i ei kuvata.
- Rakenduses ja failis `docs/USER_GUIDE.md` on uue kasutaja töövoogu selgitav kasutusjuhend.
- Portfelli CRUD: ticker, kogus, keskmine ostuhind, tees, ajahorisont, staatus ja märkmed.
- Teesi muutmise ajalugu PostgreSQL-is.
- “Daily Changes” aktiivsetele ja jälgitavatele positsioonidele.
- Varasem Redditi tähelepanuradar on säilitatud eraldi abisignaalina.

Kui allikas andmeid ei anna, kuvab rakendus `No data available yet`.

## Kohalik käivitamine Dockeriga

1. Kopeeri `.env.example` failiks `.env`.
2. Määra pikk juhuslik `CRON_SECRET`.
3. Määra SEC nõuetele vastav `SEC_USER_AGENT`, kui soovid EDGARi andmeid.
4. Käivita:

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

`DATABASE_URL` peab osutama andmebaasile. Skeemi kanooniline allikas on **versioonitud migratsioonid** kaustas `db/migrations` — rakenda need runneriga:

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

Üks edukas päevatöö salvestab radariettevõtete hinnad, SPY benchmark'i, kuni viis puuduva või aegunud SEC CompanyFactsi katvusega ettevõtet, canonical discovery snapshot'i, selle point-in-time andmekvaliteedi kirje ning valminud candidate outcome'id. Põhikogumise lifecycle ja providerimõõdikud salvestatakse `collection_runs` tabelisse. Enrichment- või discovery alamfaasi viga logitakse ja tagastatakse eraldi staatusena; canonical discovery järel ebaõnnestunud kvaliteedisnapshot teeb discovery sammu kriitiliselt ebaõnnestunuks, kuid juba committed run jääb auditisse alles.

## Keskkonnamuutujad

| Muutuja | Vajalik | Kasutus |
|---|---:|---|
| `DATABASE_URL` | jah | PostgreSQL ühendus |
| `CRON_SECRET` | jah | `/api/collect` kaitse |
| `SEC_USER_AGENT` | SEC jaoks | SEC EDGAR, CompanyFacts ja kauplemispeatamiste feed |
| `FMP_API_KEY` | ei | Yahoo varuallikas radari fundamentaalidele |
| `TZ` | ei | Ajavöönd, vaikimisi Europe/Tallinn |

Yahoo Finance, ApeWisdom ja Tradestie ei vaja selles prototüübis API-võtit, kuid nende avalikud liidesed võivad olla piiratud või muutuda.

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
- Validation on forward outcome tracking, mitte täielik ajalooline backtest: see kogub tulemusi alates salvestatud discovery jooksudest ega rekonstrueeri minevikku tänaste andmetega.
- Backtest V1 on salvestatud forward outcome'ide aus koondvaade, mitte tõend strateegia toimivuse ega tulevase tootluse kohta.
- SEC enrichment'i päevane eelarve on vaikimisi viis katset Tallinna kalendripäeva kohta. `unavailable` tickerit proovitakse uuesti kõige varem 30 päeva ja transient `error` tickerit järgmisel päeval.
- Sector-relative ranking kasutab ainult salvestatud klassifikatsiooni ja sama score-versiooni täielikke võrreldavaid ettevõtteid. Puuduv sector/industry või alla viie liikmega grupp jääb unknown/insufficient olekusse.
- Research Brief kasutab läbipaistvaid kohalikke reegleid ja rakendusse kogutud allikaid; see ei asenda algdokumentide kontrollimist ega investeerimisnõustamist.
- Redditi skoor on uurimisnimekirja signaal, mitte tootluse prognoos.
