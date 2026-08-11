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

## Praegune fookus

**`/scanner` eelseadistus „Leia järgmine RKLB”.**

Eesmärk on kasutada olemasolevat kogutud universumit ja leida 0–5 läbipaistvalt põhjendatud uurimiskandidaati. See ei ole RKLB sektorikoopia, ostusoovitus ega üks udune tõenäosusnumber. Päeval, mil piisavalt tugevaid kandidaate pole, kuvatakse null tulemust.

## Roadmap

### NOW – järgmine arendustükk

`/scanner` eelseadistus **„Leia järgmine RKLB”**:

- kasuta ainult olemasolevat kogutud universumit ja olemasolevaid SEC/Yahoo/application andmeid;
- tagasta 0–5 uurimiskandidaati, mitte kohustuslik esikolmik;
- iga kandidaat näitab, miks ta valimisse jõudis, kas kasv on erakordne, kui hea on andmekate, milline on finantsiline runway, lähenev katalüsaator, peamine risk ja mis on teadmata;
- moat ja mispricing jäävad investori tõendatavateks küsimusteks;
- iga kriteerium saab eraldi staatuse `supported`, `uncertain` või `missing`;
- kandidaadikaardilt saab valida `Lisa Watchlisti` või `Alusta teesi`;
- üks läbipaistmatu „RKLB tõenäosuse” koondskoor on keelatud;
- lisa päris UI ja DB/runtime kontroll ning eemalda ajutised testread.

### NEXT

- Otsuse hetke snapshot: hind, skoorid, tees, eeldused ja allikad.
- Aus point-in-time score backtest / walk-forward valideerimine.
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
- Git on koodi tõeallikas; `.env` ja PostgreSQL volume on masinapõhised.

## Avatud sõltuvused ja otsused

- Score-alerti 10 punkti lävi vajab ajaloolise valimi kasvades kalibreerimist.
- Backtesti benchmark: lai turg, vastav sektor või mõlemad.
- Sector-relative ranking vajab usaldusväärset sektorivälja; puuduvat sektorit ei tohi oletada.
- Uute Nasdaqi tickerite radar vajab tasuta listing-feed'i otsust.
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
