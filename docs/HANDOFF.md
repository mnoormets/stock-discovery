# Stock Discovery – master plan ja töö jätkamise memo

Uuendatud: 2026-08-11

See on projekti elav master-dokument ja toote/tehnilise seisu peamine tõeallikas. Iga sisulise arendussessiooni järel tuleb siin uuendada tehtut, praegust fookust, järgmist plaani, otsuseid ja testitõendeid. Repo juurkausta `AGENTS.md` teeb selle tulevastele Codexi sessioonidele kohustuslikuks.

## North Star

Kasutaja peab suutma leida huvitava ettevõtte, eristada lugu tõenditest ning koostada viie minutiga kaitstava investeerimisteesi:

- miks see ettevõte;
- miks praegu;
- mida turg võib valesti hinnata;
- mis peab õnnestuma;
- milline sündmus või mõõdik muudab teesi valeks.

Edu ei mõõdeta tagantjärele ideaalse tipu tabamisega. Eesmärk on parandada otsustusprotsessi kvaliteeti ja säilitada see, mida otsuse hetkel tegelikult teati.

## Püsivad tootepõhimõtted

- Kõrge skoor tähendab “uuri lähemalt”, mitte “osta”.
- Faktid, järeldused ja kasutaja oletused peavad olema eristatavad.
- Iga skoor ja automaatne järeldus peab näitama sisendeid, coverage'it, versiooni ja algallikaid.
- Säilita ajalooline “as known at the time” seis, et vähendada hindsight bias'i.
- Ära lisa uusi väliseid andmeallikaid enne, kui olemasoleva andmestiku kasutajakogemus ja Thesis Builder on valmis.
- Puuduvad andmed ei tohi muutuda automaatselt nullpunktideks ega lehte crash'ida.

## Projekti eesmärk

Aidata investoril leida varajasi tugeva potentsiaaliga ettevõtteid ja ehitada nende kohta kontrollitav investeerimistees. Rakendus ei anna ostu- ega müügisoovitusi.

Oluline kasutuslugu: 2023. aastal leiti RKLB intuitsiooni ja Redditi kaudu, kuid puudus konkreetne viis põhjendada, miks ettevõte võiks olla hea investeering just sel ajahetkel. Rakendus peab aitama muuta intuitsiooni tõenditega kaitstavaks teesiks.

## Praegune töötav seis

- Next.js 14.2.35 + PostgreSQL + Docker Compose, rakendus pordil `3005`.
- Yahoo Finance hinnad, uudised, earnings ja analüütikute konsensus.
- SEC filingud ja tasuta SEC CompanyFacts:
  - revenue;
  - net income;
  - operating cash flow;
  - tuletatud free cash flow;
  - cash;
  - debt;
  - shares outstanding.
- CompanyFactsi perioodid ja YoY võrdlused on idempotentselt tabelis `financial_facts`.
- Tasuta modulaarne Research Brief koos faktide, järelduste ja algallikatega.
- Growth Score, Financial Health Score ja Coverage Score.
- Versioonitud `company_score_snapshots`, mis säilitavad input-hashi, SEC fact ID-d, perioodid ja komponendid.
- `/scanner` fundamentaalne edetabel ja sortimine Growth, Health või Coverage järgi.
- `/watchlist` kasutab olemasolevaid `portfolio_positions.status = 'watch'` kirjeid ning pakub olemasolevate skooride põhjal uurimisideid.
- `/portfolio` positsioonid, teesid, P/L ja turuväärtus.
- `/daily` snapshot-võrdlused ja alerts.

Viimati kontrollitud päris tulemused:

| Ticker | Growth | Health | Coverage |
|---|---:|---:|---:|
| AAPL | 89 | 86 | 100 |
| RKLB | 69 | 36 | 100 |
| TSM | puudulik | 100 | 8 |

Growth/Health nimekirjades kuvatakse vähemalt 70 Coverage tulemused enne madala kattega tulemusi, et üksiku komponendi kõrge skoor poleks eksitav.

## Tehtud verstapostid

- **Tükk 1:** idempotentne price/news/SEC/earnings ajalugu.
- **Tükk 2:** Daily Changes võrdleb päris snapshot-ajalugu ja loob idempotentseid alert'e.
- **Tükk 3:** portfelli turuväärtus, unrealized P/L ning võitja/kaotaja.
- **Tükk 4:** analüütikute konsensus ja hinnasihid.
- **Tükk 5:** turu scanner kogutud movers/earnings/SEC/news andmetega.
- Tasuta reeglipõhine Research Brief ja modulaarne signal engine.
- SEC CompanyFacts finantsajalugu ja võrreldavate perioodide YoY.
- Growth, Financial Health ja Coverage Score koos versioonitud ajalooga.
- Watchlist ja olemasolevatel skooridel põhinev idee-avastus.

## Praegune fookus

**Thesis Builder – esimene versioon pole veel alustatud.**

Eesmärk on muuta Watchlisti idee struktureeritud, tõenditega seotud ja ümberlükatavaks teesiks. Uusi andmeallikaid selleks ei lisata.

## Roadmap

### NOW – järgmine arendustükk

Watchlisti tickeri **Thesis Card**:

- kasutaja väljad: `business`, `why now`, `moat`, `mispricing`, `catalyst`, `invalidation`, ajahorisont;
- staatus: `draft`, `researching`, `ready`, `rejected`;
- automaatselt seotud olemasolevad Growth/Health/Coverage tõendid;
- teesi versiooniajalugu;
- detailvaade “5-minute defense”.

Valmiskriteeriumid:

- teesi saab Watchlistist luua, muuta ja versioonida;
- kasutaja näeb, millised väited on tõendatud ja millised on tema oletused;
- invalidation on kohustuslik enne staatust `ready`;
- korduv salvestamine ei tekita duplikaatversioone;
- päris UI ja DB test on tehtud ning ajutised read koristatud.

### NEXT

- Thesis Evidence Engine: olemasolevad SEC/uudise/earnings/score signaalid teesi poolt ja vastu.
- Otsuse hetke snapshot: hind, skoorid, tees, eeldused ja allikad.
- Ülevaatuse kuupäev ja “mis muutus pärast eelmist ülevaatust?”.
- Bear/base/bull stsenaarium kasutaja enda eeldustega.

### LATER

- Fikseeritud horisondi tulemuste ülevaade (6 kuud / 1 aasta / 3 aastat), mitte ideaalne tagantjärele tipuhind.
- Teesi eelduste täitumise analüüs: hea protsess vs õnnelik tulemus.
- Valuation Score alles pärast läbipaistva valuation-mudeli ja piisava coverage'i valmimist.
- Vajadusel keskne PostgreSQL, kui kahe arvuti dump/restore muutub liiga tülikaks.

### TEADLIKULT MITTE PRAEGU

- Uued välised andmeallikad.
- Tasuline AI või tasuline market-data API.
- Läbipaistmatu “järgmise RKLB tõenäosus 1–10” koondskoor.
- Automaatne ostu- või müügisoovitus.
- Perfect-hindsight “müü täpselt ajaloolises tipus” kui otsuse kvaliteedi mõõdik.

## Olulised tehnilised/tooteotsused

- Company detail on DB-first; aeglased live-värskendused toimuvad võimalusel taustal.
- FCF on tuletatud kui OCF miinus capex ning peab olema sellisena märgitud.
- Score-versioon muutub alati, kui valem või kaalud sisuliselt muutuvad.
- Growth/Health sortimisel tulevad vähemalt 70 Coverage read enne madala kattega ridu.
- Watchlist kasutab `portfolio_positions.status = 'watch'`, kogust 0 ja ostuhinda 0.
- Git on koodi tõeallikas; `.env` ja PostgreSQL volume on masinapõhised.

## Käivitamine uues arvutis

```bash
git clone https://github.com/mnoormets/stock-discovery.git
cd stock-discovery
git pull origin main
```

`.env` ei pea arvutite vahel saatma. Turvalisem on kummaski arvutis luua eraldi lokaalne fail:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-local-env.ps1
```

Skript küsib SEC User-Agenti, genereerib uue juhusliku `CRON_SECRET` väärtuse ega väljasta saladust terminali. Soovi korral võib `.env` luua ka käsitsi `.env.example` põhjal. Vajalikud on vähemalt:

- `CRON_SECRET`;
- korrektne kontaktiga `SEC_USER_AGENT`.

`CRON_SECRET` ei pea kodu- ja tööarvutis sama olema, kui kummagi masina kohalik scheduler kasutab sama masina `.env` faili. `SEC_USER_AGENT` ei ole salajane võti ning selle võib mõlemas masinas samaks sisestada. `FMP_API_KEY` on valikuline.

GitHub ei sisalda ka kohalikku Dockeri `db_data` volume'it. Ilma varukoopiata käivitub tööarvutis sama kood uue tühja PostgreSQL andmebaasiga. Avalikud turu- ja SEC andmed saab uuesti koguda, kuid portfell, Watchlist, teesid ja score-ajalugu vajavad täpse seisundi säilitamiseks dump'i.

Loo praeguses arvutis binaarne varukoopia (ära commit'i seda reposse):

```bash
docker compose exec -T db pg_dump -U discovery -d discovery -Fc -f /tmp/stock-discovery.dump
docker compose cp db:/tmp/stock-discovery.dump ./stock-discovery.dump
```

Vii `stock-discovery.dump` tööarvutisse turvalise kanali kaudu. Pärast konteinerite käivitamist taasta see:

```bash
docker compose cp ./stock-discovery.dump db:/tmp/stock-discovery.dump
docker compose exec -T db pg_restore -U discovery -d discovery --clean --if-exists /tmp/stock-discovery.dump
```

`*.dump` ja `*.backup` on `.gitignore` failis, sest varukoopia võib sisaldada isiklikke portfelliandmeid ja investeerimisteese.

### Kahe arvuti tööreegel

- Enne arvuti vahetamist: lõpeta koodimuudatused, uuenda seda master-dokumenti, commit'i ja pushi.
- Teises arvutis: `git pull` enne töö alustamist.
- Kummalgi arvutil on oma `.env`; neid ei pea edasi-tagasi kopeerima.
- Kui vajad sama portfelli/Watchlisti/ajalugu, ekspordi aktiivsest arvutist värske DB dump ja taasta see teises.
- Ära muuda samaaegselt mõlemas lokaalses DB-s portfelli või teese. Vali ühe sessiooni jaoks üks andmebaas tõeallikaks, muidu tekivad lahknevad ajalood.

Seejärel:

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

Host-arvutis Node'i puudumisel käivita need `app` konteineris.

## Järgmine soovitatud tootesuund: Thesis Builder

Ära lisa praegu uusi väliseid andmeallikaid. Kasuta olemasolevaid SEC, hinna, uudiste, analyst- ja portfolio andmeid ning kasutaja enda sisestatud põhjendusi.

Iga Watchlisti idee peaks saama struktureeritud teesi:

1. **The business** – mida ettevõte müüb, kellele ja miks klient seda vajab?
2. **Growth proof** – millised olemasolevad finantsfaktid tõestavad kasvu?
3. **Why this company** – kasutaja kirjeldatud moat või konkurentsieelis.
4. **Why now** – konkreetne lähenev katalüsaator, mitte ainult pikaajaline lugu.
5. **Mispricing** – mida kasutaja arvab, et turg praegu alahindab?
6. **Risks and invalidation** – milline mõõdetav sündmus muudab teesi valeks?
7. **Valuation scenarios** – bear/base/bull eeldused, mitte tagantjärele ideaalne tipuhind.
8. **5-minute defense** – lühike vaade küsimusele „Kas ma suudan seda investeeringut viie minutiga tõendite abil kaitsta?”

### Soovitatud esimene tükk

Loo Watchlisti tickerile Thesis Card, mis sisaldab:

- kasutaja sisestatud `why now`, `mispricing`, `moat`, `invalidation` ja ajahorisonti;
- automaatselt lisatud olemasolevaid Growth/Health/Coverage skoori tõendeid;
- uusi SEC/uudise/earnings signaale teesi poolt ja vastu;
- staatust `draft`, `researching`, `ready`, `rejected`;
- teesi versiooniajalugu, et vältida hindsight bias'i.

Ära loo kohe uut „RKLB võimalus 1–10” koondskoori. Esmalt tee põhjendused, eeldused ja puuduvad vastused nähtavaks. Investor peab saama aru, miks tulemus tekkis.

## Testimise põhimõtted

- Ära raporteeri funktsiooni valmis enne päris UI ja DB kontrolli.
- Kordusjooks ei tohi tekitada duplikaate.
- Puuduv tickeri hind või SEC andmestik ei tohi lehte crash'ida.
- Ajutised integratsioonitesti read tuleb pärast kontrolli kustutada.
- Production build kirjutab dev-serveri `.next` kataloogi üle; pärast buildi taaskäivita `app` konteiner.

## Viimane testitud seis

- `npm run lint`: läbib.
- `npm run typecheck`: läbib.
- `npm run build`: läbib.
- AAPL detail: Growth 89, Health 86, Coverage 100, 8 trace-allikat.
- RKLB detail: Growth 69, Health 36, Coverage 100.
- TSM madala coverage'i tulemus ei tõuse täiskattega Health tulemustest ettepoole.
- Watchlisti lisamine/eemaldamine kontrollitud päris server action'i ja DB reaga.
- Score snapshot kordusjooks on idempotentne.
- `scripts/setup-local-env.ps1`: loob nõutud võtmetega lokaalse faili, genereerib 256-bitise juhusliku saladuse ja kordusjooks ei kirjuta olemasolevat faili üle.
- Viimane GitHubi põhiseis enne käesolevat master-dokumendi täiendust: `18f560e`.

## Sessioonilogi

### 2026-08-11

- Koondati ja pushiti SEC finantsid, Research Brief, signal engine, scanner, Growth/Health/Coverage skoorid ning Watchlist.
- Lisati versioonitud score-snapshotid ja auditivaade.
- Lepiti kokku, et uusi andmeallikaid praegu ei lisata.
- RKLB 2023 kogemuse põhjal valiti järgmiseks põhisuunaks Thesis Builder ja “5-minute defense”.
- Muudeti see fail elavaks master-dokumendiks ning lisati `AGENTS.md` uuendamiskohustus.
- Lisati masinapõhine `.env` setup ja kahe arvuti töövoog.
