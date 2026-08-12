# Stock Discovery – master plan ja töö jätkamise memo

Uuendatud: 2026-08-12

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

- Next.js 14.2.35, PostgreSQL ja Docker Compose; rakendus pordil `3005`.
- Yahoo Finance hinnad, uudised, earnings ja analüütikute konsensus.
- SEC filingud ja tasuta SEC CompanyFacts: revenue, net income, operating cash flow, tuletatud free cash flow, cash, debt ja shares outstanding.
- CompanyFactsi perioodid ja YoY võrdlused tabelis `financial_facts`.
- Tasuta reeglipõhine Research Brief koos faktide, järelduste ja algallikatega.
- Growth Score, Financial Health Score ja Coverage Score.
- Data Freshness + Period Alignment V1 kuvab score'is kasutatud SEC põhimõõdikute perioodid, vanuse, fact-viited ja eraldi kvalitatiivsed staatused; skoorivalemeid ega filtreid see ei muuda.
- Catalyst Evidence V2: catalyst ei ole enam hard gate, vaid struktureeritud tõendikiht (`catalyst_events` + versioonitud `catalyst_assessments`), mis mõjutab ainult järjestust ja nähtavat tõendit.
- Versioonitud `company_score_snapshots`, mis säilitavad input-hashi, SEC fact ID-d, perioodid ja komponendid.
- `/scanner` fundamentaalne edetabel ja sortimine Growthi, Healthi või Coverage'i järgi.
- `/watchlist` kasutab `portfolio_positions.status = 'watch'` kirjeid ja pakub olemasolevate skooride põhjal uurimisideid.
- `/portfolio` positsioonid, P/L ja turuväärtus; olemasoleva positsiooni tees suunatakse Thesis Builderisse.
- `/daily` snapshot-võrdlused ja alert'id.
- `/thesis/[positionId]` struktureeritud, versioonitud Thesis Builder koos 12 kuu kontrollpunkti ja skooritõenditega.
- Watchlisti score-change alert võrdleb järjestikuseid sama mudeliversiooni snapshot'e, säilitab idempotentse alert'i ning näitab muutunud komponente nii Watchlistis kui Daily Changes vaates.
- `/scanner?preset=rklb` kuvab olemasolevast universumist 0-5 läbipaistvalt põhjendatud uurimiskandidaati koos kriteeriumide, riskide, teadmata info ning Watchlisti/Thesis tegevustega.
- Iga RKLB discovery käivitus salvestab `discovery_runs` ja `discovery_decisions` tabelitesse muutumatu point-in-time otsuse koos kogu vaadeldud universumi ning kaasamise/välistamise põhjustega.
- Päevane `/api/collect` töötleb Tallinna kalendripäeva kohta kuni viis puuduva või aegunud SEC CompanyFactsi katvusega ettevõtet, säilitab `financial_enrichment_status` retry/auditi ning loob ühe `rklb_daily` canonical discovery run'i.
- `/validation` värskendab `candidate_outcomes` tulemusi 1n, 2n, 1k, 3k ja 6k horisondil ning kuvab iga horisondi statistika ja jooksude auditivaate. Koondstatistika kasutab alates 2026-08-12 ainult canonical (`rklb_daily`) jooksu; jooksude ajalugu kuvab endiselt kõiki run'e (audit).
- `/backtest` kasutab ainult salvestatud discovery run'e ja outcome'e, võrdleb kandidaadi tootlust fikseeritud SPY benchmark'iga ning näitab puuduva benchmark'i korral excess return'i `unknown` olekuna. Koondnäitajad kasutavad alates 2026-08-12 ainult canonical jooksu; run-level detail kuvab kõiki run'e.
- `/frequency` (Discovery Frequency V1) kuvab canonical `rklb_daily` jooksude põhjal, kui järjekindlalt sama ticker jooksva mudeliversiooni piires kaasati: kaasamiste arv, 5/10/20 päeva aknad, jooksev streak, esimene/viimane kaasamine + rank'i muutus, `included/excluded/absent` timeline ning persistence (`stale_evidence` vs `evolving_evidence`). Käsitsi `rklb` jooksud ei osale kunagi; alla viie canonical päeva kuvab loendurid, aga märgib, et tõlgendada ei tohi.
- Sector-relative Ranking V1 kasutab olemasoleva Yahoo `assetProfile` sector/industry välju, võrdleb sama score-versiooni ettevõtteid eelistatult industry ja vajadusel sector grupis ning kuvab percentile'id ainult vähemalt viie täieliku võrreldava ettevõtte korral.
- Valuation Evidence V1 (`valuation-evidence-v1`) kuvab company detailis, Thesis Builderis ja `/scanner?preset=rklb` kandidaadikaardil valuation-ankrud (EV/Sales, P/E, FCF Yield arvutatuna olemasolevatest SEC faktidest + market cap'ist; Peer comparison ja Sum-of-parts alati `unknown`). Iga ankur on üks läbipaistev suhtarv (fakt/fakt) allika, confidence'i (tuletatud Data Freshness + Period Alignment kihist), viimase sisendi ja staatusega — **mitte koondskoor, mitte osta/müü soovitus**. `unknown` on lubatud kõikjal; negatiivse kasumi P/E on `not_meaningful`, negatiivne FCF yield märgitakse raha põletamiseks. Growth, Health, Coverage, Catalyst ja Frequency jäid muutmata.
- `/guide` ja `docs/USER_GUIDE.md` selgitavad uuele kasutajale kogu rakenduse soovitatud töövoogu.

Viimati kontrollitud päris skoorid:

| Ticker | Growth | Health | Coverage |
|---|---:|---:|---:|
| AAPL | 89 | 86 | 100 |
| RKLB | 69 | 36 | 100 |
| TSM | puudulik | 100 | 8 |

Growth/Health nimekirjades kuvatakse vähemalt 70 Coverage tulemused enne madala kattega tulemusi, et üksiku komponendi kõrge skoor poleks eksitav.

## Tehtud verstapostid

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

## Praegune fookus

**Catalyst Evidence V2 on tehtud; järgmine otsus peab põhinema uue tõendikihi kasutamisel päris research'is, mitte uue mooduli ehitamisel.**

Catalyst hard gate on asendatud structured evidence field'iga. Discovery mudeliversioon on `rklb-discovery-v2`, seega v1 canonical päevajooksud ja v2 jooksud ei ole üks frequency-seeria: persistence-loendur algab uuesti 2026-08-12 canonical run'ist #17.

`docs/FUNNEL_AUDIT.md` read-only audit näitas, et suurim vahetu bottleneck ei ole scheduler ega cloud DB, vaid radari sisenduniversumi ja otsustusfunneli tõendamata kvaliteet. Selle järel tehtud [`docs/RESEARCH_SPRINT_2026-08-11.md`](RESEARCH_SPRINT_2026-08-11.md) manual cohort andis päris Thesis Builderi otsused: API `ready`, BW ja HIMS `researching`, CAKE ja ACHR `rejected`. `ready` tähendab kaitstavat ning falsifitseeritavat teesi, mitte ostusoovitust.

Sprint kinnitas kaks hüpoteesi. Catalyst hard gate tekitas research false negative'e: BW-l oli päris Q2/backlog/Base Electron catalyst ning CAKE-l earnings/comparable-sales/unit-opening evidence, kuigi collector märkis catalyst'i puuduvaks. Coverage on endiselt completeness/presence; uus kiht teeb BW 100 Coverage + 2021 debt vastuolu nüüd nähtavaks. Järgmine samm ei ole uus provider: kasuta warning'uid järgmises manual research otsuses ja otsusta seejärel eraldi, kas catalyst hard gate muuta structured evidence field'iks.

Catalyst-otsuse jaoks on nüüd olemas kirjalik disain [`docs/CATALYST_EVIDENCE_V2.md`](CATALYST_EVIDENCE_V2.md): see on ainult disain, koodi, filtreid, skeemi ega provider'eid selle põhjal veel ei muudetud. Ehitamise eelduseks jääb sama cohort'i kasutamine märgistatud testhulgana.

## Roadmap

### NOW - järgmine töö

Kasuta Data Freshness + Period Alignment V1 ja Catalyst Evidence V2 päris research-kihina enne järgmise valemi või filtri muutmist:

- kontrolli API, BW, CAKE, HIMS ja ACHR olemasolevad teesiotsused uue evidence-ploki kõrval üle;
- dokumenteeri, kas warning muutis inimese tõlgendust või ainult kinnitas juba teadaolevat riski;
- kalibreeri 550 päeva stale-, 120 päeva good-alignment- ja 730 päeva poor-alignment piire ainult päris näidete põhjal;
- kalibreeri catalyst V2 läved (revenue 25%/5%, kasumi-rahavoo 20%, mandaadi 25%/10% ja 25 mld / 3 mld piirid) ainult päris otsuste põhjal; jälgi eraldi, kas `quantified_minor` + `mandate not_relevant` kombinatsioon (CAKE muster) toodab liiga palju madala väärtusega kandidaate;
- vaata, kas `mandate_relevance` peaks mõjutama järjestust; praegu see ainult kirjeldab ja ei muuda rank'i;
- jätka viie päris teesi 12 kuu checkpoint'ide jälgimist; ära kustuta neid integration-test andmetena.

Auditi järel ootel collection reliability ja canonical cloud-history:

- lisa DB-põhine `collection_runs` ledger ning PostgreSQL advisory lock või lease, et sama päeva kattuvad worker'id ei teeks paralleelset collecti;
- säilita job'i algus, lõpp, staatus, provider'ite loendurid ja piiratud veainfo, et ebaõnnestumine oleks UI-st või DB-st jälgitav;
- lisa automaattestid vähemalt scoring'u, päevase idempotentsuse, discovery canonical run'i, enrichment-budget'i ja outcome'ide muutumatuse jaoks;
- koonda hajutatud runtime `CREATE TABLE` / `ALTER TABLE` loogika versioonitud migratsioonide üheks tõeallikaks;
- planeeri Next.js 14 EOL tõttu kontrollitud üleminek toetatud ja turvaparandustega versioonile koos regressioonitestidega;
- eelista tasuta keskseks DB-ks Neon PostgreSQL-i ja arvutitest sõltumatuks scheduleriks GitHub Actionsit, mis käivitab collector CLI-d otse DB vastu; ära avalikusta selleks kogu Next.js rakendust;
- pärast keskse DB kontrolli suuna mõlema arvuti lokaalne app sama `DATABASE_URL` vastu; lokaalsed Docker DB-d jäävad arendus-/taastekeskkonnaks;
- tee olemasoleva kodu-DB ajaloo ühekordne kontrollitud dump/restore keskseks algseisuks;
- enne UI avalikku deploy'd lisa autentimine ja autoriseerimine portfelli, Watchlisti, Thesis Builderi ning kirjutavate server action'ite/API-de ette.

Pärast keskse kogumise käivitamist jätkub päris forward-valimi kasvatamine ja Backtest V1 kvaliteedi jälgimine:

- jälgi päevase `/api/collect` vastusest `financialUniverse`, `coveredAfter`, `enriched`, `failed`, `dailyRemaining` ja discovery `evaluatedCount` väärtusi;
- lase kuni viiesel SEC enrichment-batch'il kasvatada skooritavat universumit vähemalt 20 ettevõtte või 70% katvuseni;
- kontrolli, et iga Tallinna päeva kohta tekib maksimaalselt üks `rklb_daily` run ning käsitsi refresh ei muuda canonical snapshot'i;
- kasuta forward-valimi tõeallikana ainult keskset canonical DB-d; kodu- ja tööarvuti eraldi PostgreSQL volume'ite tulemusi ei tohi vaikimisi üheks looks pidada;
- kontrolli, et päevane kogumine salvestab SPY hinnasnapshotid järjepidevalt;
- lase 1n/2n/1k/3k/6k outcome'idel päriselt täituda;
- jälgi eraldi kandidaatide, mõõdetud outcome'ide ja benchmark'iga outcome'ide valimi suurust;
- kasuta rakendust 1-2 nädalat päris töövoona: lisa põhjendatud ideed Watchlisti ja kirjuta vähemalt paar tegelikku, mõõdetava 12 kuu kontrollpunktiga teesi;
- ära tee väikese 1n/2n valimi põhjal strateegiajäreldusi;
- vaata pärast vähemalt viit ja eelistatult kümmet eri otsusekuupäeva, kas sama ticker püsib valimis ning kas süsteem leidis midagi, mida tasub päriselt uurida;
- ära tõlgenda frequency't enne, kui vähemalt 20 ettevõttel või vähemalt 70%-l canonical kogutud universumist on arvutatav SEC/score katvus; UI peab näitama iga päeva evaluated-universumi suurust;
- järgmine analüütiline laiendus on discovery frequency/persistence; max drawdown ja jaotus mudeliversiooni/Coverage vahemiku järgi tulevad alles piisava outcome-valimi järel.

### NEXT

- Discovery Frequency V1 on **ehitatud 2026-08-12** (`/frequency`, [`docs/DISCOVERY_FREQUENCY_PROVENANCE.md`](DISCOVERY_FREQUENCY_PROVENANCE.md)); kasutab ainult canonical `rklb_daily` jooksu. Koos sellega rakendus canonical-only aggregation layer `/validation` ja `/backtest` koondnäitajatele (Tase 0 read-side filter, skeemi ei muudetud). Tõlgendus jääb ootama vähemalt 5 (eelistatult 10) canonical päevajooksu ning vähemalt 20 ettevõtte või 70% SEC/score katvust; UI kuvab loendurid ausalt, aga märgib alla läve, et järeldusi teha ei tohi. Sisu:
  - mitu eri canonical otsusepäeva viimase 5/10/20 päeva jooksul ticker kaasati;
  - praegune järjestikuste kaasatud päevade streak;
  - esimene ja viimane kaasamise kuupäev ning rank'i muutus;
  - erista `evaluated but excluded` päev päevast, mil tickerit universumis üldse ei hinnatud;
  - näita, kas püsimine tuli sama vana evidence'i jätkumisest või uutest/muutunud snapshot'idest.
- Fikseeritud horisondid 6 kuud, 1 aasta ja 3 aastat; mitte ideaalne tagantjärele tipuhind.
- Mõõdikud: mediaantootlus, hit rate, ületootlus benchmark'i suhtes, max drawdown ja valimi suurus; tulemused mudeliversiooni ja Coverage vahemiku kaupa.
- Enne backtesti tuleb fikseerida universum, benchmark ja otsuse hetke andmete säilitamise reegel.
- Catalyst evidence'i võimalikud järgmised sammud alles pärast päris kasutamist: kasutaja `assessed_by = 'user'` hinnangu UI, `primary_ir` katvus (nõuab eraldi otsust allika kohta) ja mandate-relevance eraldi versioonitud objektina teise preset'i jaoks.
- Thesis Evidence Engine: olemasolevad SEC/uudise/earnings/score signaalid teesi poolt ja vastu.
- Ülevaatuse kuupäev ja „mis muutus pärast eelmist ülevaatust?”.

### LATER

- Under-recognition proxy + Challenger-vs-incumbent tõlgenduskiht — disain: [`docs/UNDER_RECOGNITION_AND_CHALLENGER.md`](UNDER_RECOGNITION_AND_CHALLENGER.md) (ainult disain, mitte implementatsioon). Kaks evidence-vektorit olemasolevate kihtide peal (Growth/Health/Catalyst/Freshness/Frequency), mitte koondskoor; `unknown` lubatud kõikjal, challenger nõuab falsifitseeritavat checkpointi. Ehitamine eeldab vähemalt 5 (eelistatult 10) canonical päevajooksu, sest frequency-trend ja hinnareaktsiooni signaalid vajavad canonical aegrida; vahepealne lubatud samm on ainult point-in-time salvestus ilma järjestust muutmata. EI sisalda themes, strategic investors, insider trading, dividend, smart-money, valuation ega momentum mooduleid.
- Nasdaqi uute noteeringute radar ametliku võtmeta Nasdaq Trader symbol directory põhjal; vajab idempotentset universumi ajalugu (`first_seen_at`, `last_seen_at`, listing status), test issue/ETF filtreid ning uute tickerite enrichment'i olemasoleva SEC/Yahoo kihiga.
- Teesi eelduste täitumise analüüs: hea protsess vs õnnelik tulemus.
- Valuation Score alles pärast läbipaistva valuation-mudeli ja piisava coverage'i valmimist.
- Avalik web-deploy alles pärast kasutaja autentimist ja kirjutusõiguste piiramist.

Backtesti kuupäeval `t` tohib kasutada ainult selleks hetkeks avaldatud fakte ja siis kehtinud score-versiooni. Retrospektiivset tulemust ei tohi konstrueerida tänaste või restated SEC faktidega. Nii väldime look-ahead ja survivorship bias'i.

### Teadlikult mitte praegu

- Tasuline AI või massiline AI-analüüs.
- Options-moodul.
- Uus analüütikute konsensuse moodul.
- Kogu turu täismahus scanner.
- Läbipaistmatu „järgmise RKLB tõenäosus 1–10” koondskoor.
- Automaatne ostu- või müügisoovitus.
- Perfect-hindsight müügiaja optimeerimine.

## Olulised tehnilised ja tooteotsused

- Company detail on DB-first; aeglased live-värskendused toimuvad võimalusel taustal.
- **Write-on-read on teadlik, kuid dokumenteeritud risk.** Mitu GET-vaadet kirjutavad andmebaasi: `/company/[ticker]` ja `/thesis/[positionId]` käivitavad üle kuue tunni vanuse andmestiku korral taustal SEC CompanyFactsi värskenduse (kirjutab `companies` ja `financial_facts`) ning salvestavad score-snapshot'i; `/scanner`, `/watchlist` ja `/daily` salvestavad score-snapshot'e; `/scanner?preset=rklb` salvestab terve `rklb` discovery run'i, `discovery_decisions` read, `candidate_outcomes` read, `catalyst_events` ja `catalyst_assessments`; `/validation` ja `/backtest` käivitavad `refreshCandidateOutcomes()`. Lehe avamine ei tohi kunagi olla ainus põhjus, miks andmestik või valim muutub.
- Käsitsi sirvimine võib muuta sisendit, mille järgmine canonical `rklb_daily` run salvestab, kuid ei saa juba salvestatud canonical snapshot'i ümber kirjutada; hilisem sisendimuutus märgitakse `inputChangedAfterCanonicalSnapshot` väljaga.
- Käsitsi `rklb` jooksud salvestavad päris `candidate_outcomes` read ja lähevad seetõttu `/validation` ning `/backtest` koondnäitajatesse. Neid ei tohi lugeda canonical forward-valimiks; UI kuvab nüüd mudeliversiooni ja run type'i jaotust.
- FCF on tuletatud kui OCF miinus capex ning peab olema sellisena märgitud.
- Score-versioon muutub alati, kui valem või kaalud sisuliselt muutuvad.
- `data-quality-v1` on eraldi kvalitatiivne integrity-kiht: see ei muuda `scores-v1` punkte, Coverage tähendust, järjestust ega kaasamisfiltreid.
- Freshness V1 stale-piir on 550 päeva. Alignment on `good`, kui vähemalt kaks teadaolevat sisendit mahuvad 120 päeva sisse ja flow-period-kind'id pole läbisegi; üle 730 päeva span on `poor`; puuduva võrdlusbaasi korral on olek `unknown`.
- Puuduv metric mõjutab Coverage'it, mitte Alignment'i unknown-period loendurit. Unknown period tähendab olemasolevat sisendit, mille majandusperioodi ei saa tuvastada.
- Perioodivahet näidatakse ainult vähemalt kahe teadaoleva perioodi korral. Ühe sisendi puhul on span `unknown`, mitte 0 päeva, sest üksik fakt ei tõenda joondust.
- Annual, quarter ja YTD flow-sisendite segamine tekitab Alignment `warning` oleku ka sama period-end korral, sest nende väärtused ei kirjelda sama perioodipikkust.
- Growth/Health sortimisel tulevad vähemalt 70 Coverage read enne madala kattega ridu.
- Watchlist kasutab `portfolio_positions.status = 'watch'`, kogust 0 ja ostuhinda 0.
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

## Avatud sõltuvused ja otsused

- Score-alerti 10 punkti lävi vajab ajaloolise valimi kasvades kalibreerimist.
- Backtesti benchmark: lai turg, vastav sektor või mõlemad.
- 2026-08-11 auditi alguses oli sector ja industry olemas 0/24 ettevõttel. Pärast päris AAPL DB-first taustavärskendust oli olemasoleva Yahoo provider'i katvus 1/24; klassifikatsiooni ei backfillita väljamõeldud väärtustega.
- Uute Nasdaqi tickerite radari eelistatud tasuta feed on ametlik Nasdaq Trader `nasdaqlisted.txt`; enne ehitamist tuleb fikseerida noteeringu lisandumise/muutumise reeglid ja ETF/test issue filtrid.
- Canonical forward-validation DB otsus vajab kasutaja tasuta Neon projekti ja GitHub Actions secret'ite seadistamist. Soovitus: Neon Free + scheduled GitHub Actions collector, mitte tööarvuti lokaalne DB.
- Koduarvuti scheduler ei ole sobiv canonical lahendus, sest arvuti on öösel ja kell 08:00 väljas. Ajutine fallback võib käivitada päeva esimese collecti app'i käivitumisel, kuid see ei lahenda kahe arvuti ajaloo lahknemist.
- Kiiraudit leidis, et repo ei sisalda automaattestide komplekti, skeemi loomine/muutmine on hajutatud `db/init.sql` ja runtime teekide vahel ning rakendusel puudub kasutaja autentimine. Need on enne avalikku deploy'd P0/P1 töö, mitte uue research-provider'i lisamise põhjus.
- Next.js 14 haru ei ole enam aktiivselt toetatud; versiooniuuendus tuleb teha eraldi kontrollitud tööna, mitte segada seda collection reliability muudatustega.
- Funnel-auditi püsiv snapshot oli 42 rida, kuigi varasem collect-loendur näitas 43; puuduvat 43. rida ei rekonstrueeritud ega fabritseeritud.
- Viimase snapshot'i 42 tickerist oli 31-l hind/market cap, 10-l SEC/score, 0-l sector/industry ning ainult kahel persisted `quote_type`; universumi kvaliteeti ei saa hinnata ainult toore ticker-count'i järgi.
- Coverage Score mõõdab praegu komponendi olemasolu, mitte sisendi värskust. Audit leidis ARR revenue 2011/2010, BW debt 2021 ja PLUG debt 2024 segatuna uuemate 2026 faktidega; neid skoore ei tohi käsitleda võrdselt värske ja joondatud CAKE evidence'iga.
- Praeguse auditi põhjal on catalyst hard gate tõenäoliselt liiga karm; `BW` ja `CAKE` välistati ainult katalüsaatori puudumise tõttu. Koodi ei muudeta enne manual research sprinti.
- Catalyst Evidence V2 on 2026-08-12 seisuga ainult disain ([`docs/CATALYST_EVIDENCE_V2.md`](CATALYST_EVIDENCE_V2.md)). Praegune `catalystCriterion` boolean gate jääb tootesse kuni eraldi ehitamisotsuseni; disaini olemasolu ei ole luba filtreid muuta.
- Catalyst V2 lahtised küsimused enne ehitamist: kes annab `thesis_relevance` väärtuse enne teesi olemasolu; kuidas tuvastada `primary_ir` allikat ilma uue provider'ita, kui ainus tee on `news_items` pealkiri koos `sec_events` filing'uga; kas 45/30/14 päeva aknad kehtivad edaspidi ainult `scheduled_window` ja novelty kohta; kust tuleb `linked_fact_ids` seos, mis ei tohi olla pealkirja sõnesobitus.
- Catalyst counterfactual: immutable run oleks hard gate'ita lisanud BW ja CAKE; tänaste post-enrichment score'idega läbivad muud baasfiltrid BW, CAKE, API, HR ja PLUG, kuid ühelgi neist pole stored catalyst'it.
- Freshnessi range 2 aasta piir leidis 60 olemasolevast core metricust kaks vana sisendit: ARR revenue 2011 ja BW debt 2021. PLUG debt 2024 ei ületa veel kaht aastat, kuid jääb ettevõtte uusimast score-sisendist 675 päeva maha.
- Coverage, Freshness ja Period Alignment peavad jääma eraldi mõisteteks: completeness ei tohi vaikimisi tähendada, et kõik score-komponendid on värsked ja samast aruandeperioodist.
- Data-quality V1 läved on läbipaistvad heuristikad, mitte tõestatud investeerimisvalem. Need vajavad järgmise manual research cohort'i järel kalibreerimist.
- V1 arvutab kvaliteedi praeguse ettevõtte financial summary põhjal. Ajaloolise Thesis/Validation vaate jaoks eraldi muutumatu data-quality snapshot'i püsiv salvestamine on teadlikult lahendamata järgmine traceability-otsus; olemasolevaid score snapshot'e ei backfillitud ega kirjutatud ümber.
- SEC enrichment'i algne päevane batch-size on päris runtime'is kontrollitud väärtusega 5; seda võib muuta ainult logide, kestuse ja katvuse põhjal, mitte eesmärgiga teha korraga piiramatut masspäringut.
- Sector-relative valimi katvus kasvab ainult siis, kui olemasolev provider tagastab ettevõtte kohta sector/industry väärtuse; väikese grupi korral percentile teadlikult puudub.
- Moat ja mispricing jäävad kasutaja väideteks, kuni neile on seotud kontrollitav tõend.
- **Andmete provenance on hetkel ainult tuletatav, mitte salvestatud.** `financial_facts` ei säilita, milline voog rea kirjutas: sama `saveFacts` funktsiooni kasutavad nii päevane collector kui company detaili taustavärskendus ja `companies.source` jääb esimese kirjutaja väärtuseks. Praegused kaudsed tunnused on ainult heuristikad: `financial_enrichment_status` rea puudumine tähendab, et collector pole seda tickerit kunagi proovinud (2026-08-12 seisuga AAPL, TSM, RKLB ja ACHR), ning `max(financial_facts.updated_at)` hilisem kui `last_success_at` tähendab, et faktid on hiljem mõne teise voo poolt üle kirjutatud (BW ja PLUG). Tulevane otsus: lisada `financial_facts` (või eraldi ingest-ledger'isse) `source_flow` väli `collector` / `company_view` / `thesis_view` eristusega. Migratsiooni selle auditiga teadlikult ei tehtud.
- Canonical `rklb_daily` universum ei ole collectori logi põhjal üksi taastuv: kui inimene avas enne päevast collecti mõne company detaili, sisaldab canonical snapshot ka selle sirvimise käigus rikastatud fakte. See on „as known at the time” mõttes korrektne, kuid seda ei tohi esitada puhta automaatse kogumise tulemusena.
- **Outcome-valimi manual write-on-read saaste: koondnäitajad on nüüd canonical-only, aga kirjutamise pool on veel lahtine** ([`docs/DISCOVERY_FREQUENCY_PROVENANCE.md`](DISCOVERY_FREQUENCY_PROVENANCE.md)). 2026-08-12 seisuga oli 205-st `candidate_outcomes` reast 180 pärit manual `rklb` scanneri leheavamisest ja 25 canonical `rklb_daily` run'idest. Provenance on tuletatav ahelas `candidate_outcomes.decision_id → discovery_decisions.run_id → discovery_runs.run_type`. **Ehitatud (samm 2):** `/validation`, `/backtest` ja `/frequency` koondnäitajad kasutavad `CANONICAL_RUN_TYPE` (`rklb_daily`) read-side filtrit; skeemi ei muudetud, ajaloolisi outcome'e ei puudutatud, midagi ei backfillitud ega kustutatud. **Veel lahtine (teadlikult):** samm 1 — manual scanner loob endiselt outcome-ridu (kirjutamise pool muutmata); samm 3 — `counts_for_stats` veergu ei lisatud. Kuni samm 1 tegemata, kasvab manual ridade arv edasi, kuid need ei mõjuta enam statistikat.
- Skeemi loomine on jagatud `db/init.sql` ja runtime `ensureSchema()` vahel: `catalyst_events`, `catalyst_assessments` ja `discovery_decisions` catalyst-veerud tekivad ainult runtime'is. See töötab nii puhta init'i kui olemasoleva DB upgrade'i korral, kuid versioonitud migratsioonide koondamine jääb endiselt lahtiseks tööks.

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

Ava <http://localhost:3005>.

Kvaliteedikontroll:

```bash
npm run lint
npm run typecheck
npm run qa:data-quality
npm run build
```

`npm run check` käivitab sama järjekorra ühe käsuga.

## Testimise põhimõtted

- Ära raporteeri funktsiooni valmis enne päris runtime'i ja DB kontrolli.
- Kordusjooks ei tohi tekitada duplikaate.
- Puuduv tickeri hind või SEC andmestik ei tohi lehte katki teha.
- Ajutised integratsioonitesti read tuleb pärast kontrolli kustutada.
- Production build kirjutab dev-serveri `.next` kataloogi üle; pärast buildi taaskäivita `app` konteiner.

## Viimane testitud seis

- `npm run lint`: läbib ilma hoiatusteta.
- `npm run typecheck`: läbib.
- `npm run qa:catalyst`: 11/11 deterministlikku juhtu läbib: BW-tüüpi major/mixed, CAKE-tüüpi minor + mandaat not_relevant, PLUG false-positive, pealkirja mittekvalifitseerumine, uudis ei varja nõrka aruannet, Form 144, ainult planeeritud kuupäev, kogumislünk, sündmuse puudumine, aegunud seotud periood ja sama perioodi kordusavaldus.
- `npm run qa:data-quality`: 7/7 deterministlikku juhtu läbib: sama periood, mitme aasta vanune fakt, cash 2026 + debt 2021, unknown period, high Coverage + poor alignment, puuduv metric ja ühe teadaoleva perioodi `unknown` span.
- `npm run qa:frequency`: 12/12 deterministlikku juhtu läbib (Discovery Frequency V1 pure tuum): canonical päevaloend + readiness, never-included välja jäetud, kaasamiste/hinnatud loend, streak katkeb nii välistamisel kui universumist puudumisel, 5/10/20 aknad, persistence stale/evolving/single, rank ei ole evidence, timeline included/excluded/absent, leksikograafiline järjestus, decision_date dedup (suurim runId võidab), vähene ajalugu pole tõlgendatav ja tühi sisend on korrektne tulemus.
- `npm run qa:valuation`: 12/12 deterministlikku juhtu läbib (Valuation Evidence V1 pure tuum): EV/Sales annualiseeritud kvartalist + confidence medium, negatiivse kasumi P/E `not_meaningful`, negatiivne FCF yield märgitud, peer/sum-of-parts alati `unknown`, viis ankrut alati, positiivne aastane P/E high confidence, stale debt → low confidence, puuduv cash → `insufficient_data`, teadmata market cap → kõik hindamise ankrud napivad, YTD ei annualiseeru, tühi sisend korrektne ning ükski ankur ei tagasta koondskoori (unit ainult x/%/null).
- `npm run check` käivitab lint, typecheck, data-quality QA, catalyst QA, frequency QA, valuation QA ja build'i ühe käsuga; 2026-08-12 läbis täies mahus.
- Discovery Frequency V1 + canonical-only aggregation layer kontrolliti päris Postgresi (port 5433) vastu: `getDiscoveryFrequencyDashboard`, `getValidationDashboard` ja `getBacktestDashboard` käivitusid `ensureSchema` järel veatult; canonical-only filter jättis olemasolevad 2 manual `rklb` v1 jooksu koondnäitajatest välja (`canonicalRuns 0`, kõik horisondi kandidaadiloendid 0), kinnitades, et manual read ei mõjuta enam statistikat.
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
