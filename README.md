# Stock Discovery V1

Personaalne investeerimisjälgimise alus, mis ühendab tickeri otsingu, ettevõtte faktivaate, portfelli ja reeglipõhise “Daily Changes” kokkuvõtte. Rakendus ei anna ostu- ega müügisoovitusi ega kasuta AI-d finantsandmete väljamõtlemiseks.

## V1 võimalused

- Tickeri valideeritud otsing ja ettevõtte detailvaade.
- Yahoo Finance’i hind, turukapitalisatsioon, maht, uudised ja tulemuste aeg, kui need on saadaval.
- SEC EDGARi viimased avaldused, kui `SEC_USER_AGENT` on seadistatud.
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

Vaja on Node.js 20 ja töötavat PostgreSQL-i.

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
| `SEC_USER_AGENT` | SEC jaoks | SEC EDGAR ja kauplemispeatamiste feed |
| `FMP_API_KEY` | ei | Yahoo varuallikas radari fundamentaalidele |
| `TZ` | ei | Ajavöönd, vaikimisi Europe/Tallinn |

Yahoo Finance, ApeWisdom ja Tradestie ei vaja selles prototüübis API-võtit, kuid nende avalikud liidesed võivad olla piiratud või muutuda.

## Kvaliteedikontroll

```bash
npm run lint
npm run typecheck
npm run build
```

## V1 piirid

- “Daily Changes” kasutab läbipaistvaid reegleid ja kuni 20 aktiivset/jälgitavat positsiooni ühe vaate kohta.
- Uudise pealkirja märksõna on ainult ülevaatuse signaal, mitte faktihinnang.
- Rakendus ei sisalda optsioone, analüütikute konsensust, kogu turu skännerit, backtesti ega automaatset kauplemist.
- Redditi skoor on uurimisnimekirja signaal, mitte tootluse prognoos.
