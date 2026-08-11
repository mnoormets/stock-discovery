# Stock Discovery – master plan ja töö jätkamise memo

Uuendatud: 2026-08-11

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
- Versioonitud `company_score_snapshots`, mis säilitavad input-hashi, SEC fact ID-d, perioodid ja komponendid.
- `/scanner` fundamentaalne edetabel ja sortimine Growthi, Healthi või Coverage'i järgi.
- `/watchlist` kasutab `portfolio_positions.status = 'watch'` kirjeid ja pakub olemasolevate skooride põhjal uurimisideid.
- `/portfolio` positsioonid, P/L ja turuväärtus; olemasoleva positsiooni tees suunatakse Thesis Builderisse.
- `/daily` snapshot-võrdlused ja alert'id.
- `/thesis/[positionId]` struktureeritud, versioonitud Thesis Builder koos 12 kuu kontrollpunkti ja skooritõenditega.
- Watchlisti score-change alert võrdleb järjestikuseid sama mudeliversiooni snapshot'e, säilitab idempotentse alert'i ning näitab muutunud komponente nii Watchlistis kui Daily Changes vaates.
- `/scanner?preset=rklb` kuvab olemasolevast universumist 0-5 läbipaistvalt põhjendatud uurimiskandidaati koos kriteeriumide, riskide, teadmata info ning Watchlisti/Thesis tegevustega.
- Iga RKLB discovery käivitus salvestab `discovery_runs` ja `discovery_decisions` tabelitesse muutumatu point-in-time otsuse koos kogu vaadeldud universumi ning kaasamise/välistamise põhjustega.
- `/validation` värskendab `candidate_outcomes` tulemusi 1n, 2n, 1k, 3k ja 6k horisondil ning kuvab iga horisondi statistika ja jooksude auditivaate.
- `/backtest` kasutab ainult salvestatud discovery run'e ja outcome'e, võrdleb kandidaadi tootlust fikseeritud SPY benchmark'iga ning näitab puuduva benchmark'i korral excess return'i `unknown` olekuna.
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

## Praegune fookus

**Forward validation'i ja SPY benchmark'i valimi kogumine.**

Point-in-time discovery snapshot, Validation ja Backtest V1 on valmis. Süsteem peab nüüd koguma päris 3k/6k outcome'e ning SPY hinnasnapshote, enne kui väikese valimi põhjal saab teha protsessi kohta sisulisemaid järeldusi.

## Roadmap

### NOW - järgmine arendustükk

Päris forward-valimi kasvatamine ja Backtest V1 kvaliteedi jälgimine:

- kontrolli, et päevane kogumine salvestab SPY hinnasnapshotid järjepidevalt;
- lase 1n/2n/1k/3k/6k outcome'idel päriselt täituda;
- jälgi eraldi kandidaatide, mõõdetud outcome'ide ja benchmark'iga outcome'ide valimi suurust;
- ära tee väikese 1n/2n valimi põhjal strateegiajäreldusi;
- järgmine analüütiline laiendus on max drawdown ning jaotus mudeliversiooni/Coverage vahemiku järgi, mitte mineviku ümbervalimine.

### NEXT

- Fikseeritud horisondid 6 kuud, 1 aasta ja 3 aastat; mitte ideaalne tagantjärele tipuhind.
- Mõõdikud: mediaantootlus, hit rate, ületootlus benchmark'i suhtes, max drawdown ja valimi suurus; tulemused mudeliversiooni ja Coverage vahemiku kaupa.
- Enne backtesti tuleb fikseerida universum, benchmark ja otsuse hetke andmete säilitamise reegel.
- Thesis Evidence Engine: olemasolevad SEC/uudise/earnings/score signaalid teesi poolt ja vastu.
- Ülevaatuse kuupäev ja „mis muutus pärast eelmist ülevaatust?”.

### LATER

- Sector-relative ranking; eeldab usaldusväärset sektoriklassifikatsiooni ja piisavat valimit.
- Nasdaqi uute noteeringute radar; vajab eraldi tasuta ja kontrollitavat listing-feed'i ning idempotentset universumi ajalugu (`first_seen_at`, `last_seen_at`, listing status).
- Teesi eelduste täitumise analüüs: hea protsess vs õnnelik tulemus.
- Valuation Score alles pärast läbipaistva valuation-mudeli ja piisava coverage'i valmimist.
- Vajadusel keskne PostgreSQL, kui kahe arvuti dump/restore muutub liiga tülikaks.

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
- FCF on tuletatud kui OCF miinus capex ning peab olema sellisena märgitud.
- Score-versioon muutub alati, kui valem või kaalud sisuliselt muutuvad.
- Growth/Health sortimisel tulevad vähemalt 70 Coverage read enne madala kattega ridu.
- Watchlist kasutab `portfolio_positions.status = 'watch'`, kogust 0 ja ostuhinda 0.
- Thesis Builder ei esita moat'i, mispricing'ut ega „miks praegu?” välja automaatse faktina; need on kasutaja tõendatavad hüpoteesid.
- Teesi muutmine loob uue versiooni ainult siis, kui sisu või seotud score snapshot muutus.
- Teesi score snapshot'i viide valideeritakse sama ettevõtte vastu; skeemis pole teadlikult hilise tabeliloomise tõttu init-taseme FK-d.
- Score-alert võrdleb ainult järjestikuseid sama mudeliversiooni snapshot'e. Praegune lävi on 10 punkti või komponendi oluline seisundimuutus; see vajab päris ajaloo kasvades kalibreerimist.
- Score-alerti payload säilitab võrreldud snapshot'id, skoorid ja komponendid; dedupe-võti on seotud ettevõtte, positsiooni ja snapshotipaariga.
- „Leia järgmine RKLB” ei kasuta koondskoori. Kaasamine toimub nähtavate baasfiltritega ja järjestus eraldi tõendite tugevuse järgi.
- Discovery katalüsaatori aknad on praegu earnings 45 päeva, SEC sündmus 30 päeva ja uudis 14 päeva; neid tuleb ajaloolise valideerimise käigus kalibreerida.
- Aus backtest algab alles pärast idempotentse discovery run'i ja tickeritaseme otsusesnapshot'i salvestamist.
- Discovery run'i idempotentsusvõti on `mudeliversioon + Tallinna otsusekuupäev + kogu otsusesisendi räsi`; see hoiab kordusjooksu stabiilsena, kuid lubab uue faktiseisu samal päeval eraldi salvestada.
- Outcome baseline on otsusehetke hind. Horisondi vaatlusaken on sihtaeg kuni sihtaeg + 7 päeva; juba `measured` tulemust ei muudeta ka siis, kui ajalukku lisatakse hiljem varasem hinnasnapshot.
- Validationi keskmised, mediaanid ja hit rate arvutatakse iga horisondi jaoks eraldi.
- Backtest V1 fikseeritud benchmark on `SPY`. Benchmark'i hind kogutakse sama olemasoleva Yahoo/FMP hinnakihiga; uut välist allikat ega võtit ei lisatud.
- Benchmark'i alguspunkt on viimane salvestatud SPY hind run'i ajal või kuni seitse päeva enne run'i. Lõpp-punkt on esimene SPY hind outcome'i sihtajal või järgneva seitsme päeva jooksul.
- Excess return arvutatakse ainult siis, kui candidate ja benchmark return on mõlemad teada. `NULL` ei teisendata 0%-ks.
- Backtesti päringud loevad ainult salvestatud otsuseid; `getRklbDiscoveryCandidates` ega tänane kaasamisloogika ei osale ajaloolise statistika arvutamises.
- Git on koodi tõeallikas; `.env` ja PostgreSQL volume on masinapõhised.

## Avatud sõltuvused ja otsused

- Score-alerti 10 punkti lävi vajab ajaloolise valimi kasvades kalibreerimist.
- Backtesti benchmark: lai turg, vastav sektor või mõlemad.
- Sector-relative ranking vajab usaldusväärset sektorivälja; puuduvat sektorit ei tohi oletada.
- Uute Nasdaqi tickerite radar vajab tasuta listing-feed'i otsust.
- Sector-relative ranking jääb blokeerituks seni, kuni sektoriväli on kontrollitav ja point-in-time kujul säilitatav.
- Moat ja mispricing jäävad kasutaja väideteks, kuni neile on seotud kontrollitav tõend.

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
npm run build
```

## Testimise põhimõtted

- Ära raporteeri funktsiooni valmis enne päris runtime'i ja DB kontrolli.
- Kordusjooks ei tohi tekitada duplikaate.
- Puuduv tickeri hind või SEC andmestik ei tohi lehte katki teha.
- Ajutised integratsioonitesti read tuleb pärast kontrolli kustutada.
- Production build kirjutab dev-serveri `.next` kataloogi üle; pärast buildi taaskäivita `app` konteiner.

## Viimane testitud seis

- `npm run lint`: läbib ilma hoiatusteta.
- `npm run typecheck`: läbib.
- `npm run build`: läbib; uus dünaamiline route `/thesis/[positionId]` on buildis.
- `docker compose up --build -d`: app, db ja scheduler töötavad; db on healthy.
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
