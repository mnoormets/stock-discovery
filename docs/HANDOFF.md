# Stock Discovery – töö jätkamise memo

Uuendatud: 2026-08-11

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

## Käivitamine uues arvutis

```bash
git clone https://github.com/mnoormets/stock-discovery.git
cd stock-discovery
git pull origin main
```

Loo `.env` faili väärtused kohaliku `.env.example` põhjal. `.env` ei ole GitHubis ja tuleb turvaliselt eraldi üle tuua. Vajalikud on vähemalt:

- `CRON_SECRET`;
- korrektne kontaktiga `SEC_USER_AGENT`.

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
