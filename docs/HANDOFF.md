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
- Sector-relative Ranking V1 kasutab olemasoleva Yahoo `assetProfile` sector/industry välju, võrdleb sama score-versiooni ettevõtteid eelistatult industry ja vajadusel sector grupis ning kuvab percentile'id ainult vähemalt viie täieliku võrreldava ettevõtte korral.
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
- Sector-relative Ranking V1:
  - `companies` säilitab `sector`, `industry`, klassifikatsiooni allika ja uuendamise aja; uus väline API ega võti ei lisandunud;
  - grupp valitakse sama score-versiooni seest: vähemalt viie liikmega industry, muidu vähemalt viie liikmega sector, ebapiisava valimi korral suurem olemasolev grupp;
  - Growth, Health, Coverage ja market cap saavad tie-adjusted percentile'i ning kolm skoori grupimediaani;
  - alla viie täieliku võrreldava ettevõtte korral kuvatakse `Not enough comparable companies` ja percentile/mediaan jääb `NULL`;
  - scanneri kandidaat, company detail ja Thesis Builder kuvavad sama faktiploki; Thesis Builder ei kirjuta selle põhjal teesi;
  - uued `discovery_decisions` read säilitavad otsusehetke sector-relative väärtused, kuid ajaloolisi otsuseid ei backfillita ega kirjutata ümber.

## Praegune fookus

**Forward validation'i, SPY benchmark'i ja discovery persistence'i valimi kogumine.**

Point-in-time discovery snapshot, Validation ja Backtest V1 on valmis. Süsteem peab nüüd koguma päris 3k/6k outcome'e ning SPY hinnasnapshote, enne kui väikese valimi põhjal saab teha protsessi kohta sisulisemaid järeldusi.

Praegu loob discovery run'i ainult `/scanner?preset=rklb` avamine. Kell 08:00 scheduler käivitab `/api/collect`, mis kogub turuandmed ja SPY ning värskendab outcome'e, kuid ei salvesta automaatselt uut discovery otsusesnapshot'i. Regulaarse ja võrreldava ajaloo jaoks on järgmine väike tehniline töö päevase canonical discovery run'i lisamine collect-töö lõppu.

Koduarvuti auditis oli hinnainfo 27 ettevõttel, kuid SEC CompanyFacts ja skoor ainult kolmel. Discovery saab hinnata ainult `financial_facts` katvusega ettevõtteid, seega tuleb enne frequency järeldusi automatiseerida olemasoleva SEC allika järkjärguline enrichment. See on pipeline'i katvuse parandamine, mitte uue andmeallika lisamine.

## Roadmap

### NOW - järgmine arendustükk

Päris forward-valimi kasvatamine ja Backtest V1 kvaliteedi jälgimine:

- lisa päevasesse collect-töösse piiratud SEC CompanyFactsi enrichment-järjekord: eelista puuduva või aegunud finantsajalooga juba kogutud ettevõtteid, töötle tickereid ükshaaval ning ühe tickeri viga ei tohi kogu collection'it nurjata;
- kuva/logi iga päev vähemalt `financialUniverse`, `enriched`, `failed` ja discovery `evaluatedCount`, et valimi katvus oleks nähtav;
- lisa `/api/collect` lõppu üks idempotentne päevane discovery run pärast turu- ja SPY andmete salvestamist; discovery vea korral säilita collection'i tulemus ning logi/raporteeri discovery eraldi staatusena;
- kasuta forward-valimi tõeallikana üht canonical DB-d; kodu- ja tööarvuti eraldi PostgreSQL volume'ite tulemusi ei tohi vaikimisi üheks looks pidada;
- kontrolli, et päevane kogumine salvestab SPY hinnasnapshotid järjepidevalt;
- lase 1n/2n/1k/3k/6k outcome'idel päriselt täituda;
- jälgi eraldi kandidaatide, mõõdetud outcome'ide ja benchmark'iga outcome'ide valimi suurust;
- kasuta rakendust 1-2 nädalat päris töövoona: lisa põhjendatud ideed Watchlisti ja kirjuta vähemalt paar tegelikku, mõõdetava 12 kuu kontrollpunktiga teesi;
- ära tee väikese 1n/2n valimi põhjal strateegiajäreldusi;
- vaata pärast vähemalt viit ja eelistatult kümmet eri otsusekuupäeva, kas sama ticker püsib valimis ning kas süsteem leidis midagi, mida tasub päriselt uurida;
- ära tõlgenda frequency't enne, kui vähemalt 20 ettevõttel või vähemalt 70%-l canonical kogutud universumist on arvutatav SEC/score katvus; UI peab näitama iga päeva evaluated-universumi suurust;
- järgmine analüütiline laiendus on discovery frequency/persistence; max drawdown ja jaotus mudeliversiooni/Coverage vahemiku järgi tulevad alles piisava outcome-valimi järel.

### NEXT

- Fikseeritud horisondid 6 kuud, 1 aasta ja 3 aastat; mitte ideaalne tagantjärele tipuhind.
- Mõõdikud: mediaantootlus, hit rate, ületootlus benchmark'i suhtes, max drawdown ja valimi suurus; tulemused mudeliversiooni ja Coverage vahemiku kaupa.
- Enne backtesti tuleb fikseerida universum, benchmark ja otsuse hetke andmete säilitamise reegel.
- Discovery frequency/persistence:
  - mitu eri canonical otsusepäeva viimase 5/10/20 päeva jooksul ticker kaasati;
  - praegune järjestikuste kaasatud päevade streak;
  - esimene ja viimane kaasamise kuupäev ning rank'i muutus;
  - erista `evaluated but excluded` päev päevast, mil tickerit universumis üldse ei hinnatud;
  - näita, kas püsimine tuli sama vana evidence'i jätkumisest või uutest/muutunud snapshot'idest.
- Thesis Evidence Engine: olemasolevad SEC/uudise/earnings/score signaalid teesi poolt ja vastu.
- Ülevaatuse kuupäev ja „mis muutus pärast eelmist ülevaatust?”.

### LATER

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
- Automaatne canonical jooks peab kasutama eristatavat `run_type = 'rklb_daily'` väärtust; käsitsi scanneri avamised jäävad auditi jaoks `rklb` jooksudeks, kuid frequency arvestusse lähevad ainult canonical päevajooksud.
- Discovery frequency ei loe tooreid leheavamisi. Ühe Tallinna kuupäeva ja mudeliversiooni kohta peab olema üks canonical päevane vaatlus, et korduv käsitsi refresh ei kasvataks streak'i.
- Frequency on persistence-signaal, mitte kvaliteedi- ega ostuskoor. Viis päeva sama muutumatu evidence'iga peab olema eristatav viiest päevast, mille jooksul lisandus teesi toetavat uut infot.
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

## Avatud sõltuvused ja otsused

- Score-alerti 10 punkti lävi vajab ajaloolise valimi kasvades kalibreerimist.
- Backtesti benchmark: lai turg, vastav sektor või mõlemad.
- 2026-08-11 auditi alguses oli sector ja industry olemas 0/24 ettevõttel. Pärast päris AAPL DB-first taustavärskendust oli olemasoleva Yahoo provider'i katvus 1/24; klassifikatsiooni ei backfillita väljamõeldud väärtustega.
- Uute Nasdaqi tickerite radar vajab tasuta listing-feed'i otsust.
- Canonical forward-validation DB tuleb valida. Soovitus on hoida koduarvuti DB päris ajaloo tõeallikana ja kasutada tööarvuti DB-d arendustestideks või liigutada canonical dump'i teadlikult, mitte koguda kahte lahknevat “päris” ajalugu.
- Koduarvuti peab kell 08:00 töötama või päevane collect/discovery tuleb hiljem käsitsi käivitada; praegune scheduler ei taasesita magamise ajal vahele jäänud cron-tööd.
- SEC enrichment'i päevane batch-size tuleb valida nii, et olemasoleva SEC User-Agentiga päringud oleksid viisakad ja collection jõuaks lõpuni; algväärtus tuleb päris runtime'i põhjal kalibreerida, mitte teha korraga piiramatut masspäringut.
- Sector-relative valimi katvus kasvab ainult siis, kui olemasolev provider tagastab ettevõtte kohta sector/industry väärtuse; väikese grupi korral percentile teadlikult puudub.
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
- Pärast tööarvuti commit'i `1454157` koduarvutisse fast-forward pullimist vastasid `/scanner?preset=rklb`, `/validation`, `/backtest`, `/guide` ja `/company/AAPL` HTTP 200; app, db ja scheduler töötasid ning db oli healthy.
- Koduarvuti päris DB audit pärast pulli: 27 ettevõtet ja 68 hinnasnapshot'i, kuid ainult 3 ettevõtet SEC finantsfaktide/skooridega ning 1 sector/industry klassifikatsiooniga; 1 discovery run (3 hinnatud, 0 kaasatud), 0 candidate outcome'i, 0 Watchlisti positsiooni ja 0 teesi. See kinnitab, et järgmine faas on katvuse kasvatamine, päris kasutus ja forward-ajaloo kogumine, mitte uute analüüsimoodulite lisamine.
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
