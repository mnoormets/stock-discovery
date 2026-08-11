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
- Watchlist kasutab olemasolevat portfelli `watch` staatust ning aitab Growth, Financial Health ja Coverage skooride järgi uusi uurimisideid leida.
- Thesis Builder loob Watchlisti ideest struktureeritud ja versioonitud teesi, seob selle otsuse hetke skoorisnapshotiga ning näitab Growthi ja Financial Healthi kolme peamist põhjust.
- Watchlist ja Daily Changes võrdlevad järjestikuseid sama mudeliversiooni score-snapshot'e ning näitavad olulise muutuse korral skoorid, muutunud komponendid ja täpsed snapshot'i viited.
- Skänneri „Leia järgmine RKLB” preset annab olemasolevast universumist 0-5 läbipaistvalt põhjendatud uurimiskandidaati, ilma koondskoori või ostusoovituseta.
- Iga RKLB discovery jooks salvestab muutumatu otsusehetke universumi, kaasatud ja välistatud tickerid, põhjused, skoorid, hinna, market cap'i, runway-kirjelduse, katalüsaatori, riskid ja teadmata info.
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

`DATABASE_URL` peab osutama andmebaasile. Esmakäivitusel loob rakendus vajalikud V1 tabelid; värske Dockeri andmebaas kasutab ka faili `db/init.sql`.

## Kaitstud radari kogumine

Ajastaja saadab `CRON_SECRET` väärtuse Bearer tokenina. Käsitsi saab koguda dashboardi vormist või käsurealt:

```bash
curl -X POST http://localhost:3005/api/collect \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

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
npm run build
```

## Praegused piirid

- “Daily Changes” kasutab läbipaistvaid reegleid ja kuni 20 aktiivset/jälgitavat positsiooni ühe vaate kohta.
- Uudise pealkirja märksõna on ainult ülevaatuse signaal, mitte faktihinnang.
- SEC CompanyFacts ei ühtlusta kõigi emitentide XBRL tage täielikult; puuduv näitaja kuvatakse tühja olekuna. Free cash flow on rakenduses tuletatud kui operating cash flow miinus capital expenditure.
- Growth Score kaalub revenue, net income’i, operating cash flow ja free cash flow aastamuutusi. Financial Health kaalub rahavoogude kvaliteeti, cash/debt suhet, kasumlikkust ja aktsiate arvu muutust. Mõlemad on uurimisfiltrid, mitte investeerimissoovitused.
- Coverage Score on Growth ja Financial Health mudelite kaalutud sisendikatte keskmine. Growth/Health edetabelites kuvatakse vähemalt 70 coverage ettevõtted enne madalama kattega tulemusi, et üksiku komponendi kõrge skoor ei oleks eksitav.
- Score-mudeli versioon on salvestatud iga snapshotiga. Valemi muutmisel tuleb versiooni tõsta, et eri valemitega tulemusi ei võrreldaks vaikimisi sama ajaloona.
- Rakendus ei sisalda optsioonianalüüsi, ajaloolist ümbervalikut ega automaatset kauplemist.
- Validation on forward outcome tracking, mitte täielik ajalooline backtest: see kogub tulemusi alates salvestatud discovery jooksudest ega rekonstrueeri minevikku tänaste andmetega.
- Backtest V1 on salvestatud forward outcome'ide aus koondvaade, mitte tõend strateegia toimivuse ega tulevase tootluse kohta.
- Sector-relative ranking kasutab ainult salvestatud klassifikatsiooni ja sama score-versiooni täielikke võrreldavaid ettevõtteid. Puuduv sector/industry või alla viie liikmega grupp jääb unknown/insufficient olekusse.
- Research Brief kasutab läbipaistvaid kohalikke reegleid ja rakendusse kogutud allikaid; see ei asenda algdokumentide kontrollimist ega investeerimisnõustamist.
- Redditi skoor on uurimisnimekirja signaal, mitte tootluse prognoos.
