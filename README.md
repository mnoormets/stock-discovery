# 📡 Stock Discovery — vähemtuntud aktsiate radar

Personaalne tööriist, mis leiab **vähemtuntud** aktsiaid, mille tähelepanu
**tõuseb alt üles** — mitte neid, mis on juba kõigi huulil (NVDA, TSLA jne).

> ⚠️ **Informatiivne ideede-leidmise tööriist, MITTE investeerimisnõustamine.**
> Väike turukap + järsk mainimiste kasv on ka klassikaline pump-and-dump profiil.

---

## Kuidas see töötab (lihtsalt)

Iga kogumine käib läbi 5 sammu (fail `src/lib/collect.ts`):

1. **ApeWisdom** (tasuta, ilma võtmeta) — kust ticker mainimised kasvavad. Peamine signaal. Katab ~15 000 tickerit.
2. **Tradestie** (tasuta, ilma võtmeta) — sentiment (Bullish/Bearish). Katab ainult WSB top ~50.
   - Kui tickerit Tradestie's pole → kasutame ApeWisdomi upvote-suhet **nõrga varusentimendina** (aruandes märgitud "proxy").
3. **Hind + turukap + maht** — kaheastmeline:
   - **Yahoo Finance** (`yahoo-finance2`, ilma võtmeta) esimesena.
   - Kui Yahoo 429/tühi → **Financial Modeling Prep** (FMP) varuvariant, `/stable/profile` endpoint (turukap + hind + keskmine maht ühe kutsega). Vajab tasuta võtit `.env`-is (`FMP_API_KEY`). Pärib ainult top-kandidaatidele (250/päev limiit).
   - _NB: FMP uuel tasuta plaanil on `/market-capitalization` ja `/quote` PREMIUM — seepärast kasutame `/profile`, mis on tasuta ja annab kõik korraga._
4. **SEC kauplemispeatamised** (`src/lib/sec.ts`, ilma võtmeta) — RSS-feed peatatud ettevõtetest. Sobitus firma NIME järgi (feedis pole tickereid). Klapp → suur trahv + ⚠️ märgis.
5. **Avastamise loogika** (`src/lib/discovery.ts`) — filtreerib suured nimed ja annab skoori 0–100:
   - **BAAS:** mainimiste kasv (max 35, tipp ~+150%) + mitmepäevane järjekindlus (max 15) + sentiment (max 25) + väiksem turukap (max 25) + uudsus (max 5)
   - **TRAHVID:** SEC-peatamine −60, üliäge üleöö-piik −20, madal likviidsus/mikrokapp −12
   - Kahtlaseid tickereid **ei kustutata** — märgitakse ⚠️ hoiatusega, et ise näeksid.
6. **Salvestab** päevase snapshoti PostgreSQL-i, et näha trende ajas.

**Ainus võti = FMP** (tasuta), ja seegi on valikuline (ilma selleta jääb turukap Yahoo najale). Pane `.env` faili:

```
FMP_API_KEY=sinu_voti_siia
```

---

## Käivitamine

```bash
docker compose up --build
```

Seejärel ava **http://localhost:3005** ja vajuta **„▶ Kogu andmed nüüd"**.

- Dashboard näitab top leide: ticker, skoor, mainimised, kasv vs eile, sentiment (+allikas), turukap, hind.
- Ajastaja (`scheduler`) kogub automaatselt iga päev kl 08:00 (Europe/Tallinn). Muuda aega `docker-compose.yml`-is `CRON_SCHEDULE`.
- Andmebaas kuulab hostis pordil **5433** (et mitte segada su teist Postgresi).

### Käsitsi kogumine ilma dashboardita
```bash
curl -X POST http://localhost:3005/api/collect
```

### Loetav päevaaruanne (JSON + markdown)
```bash
curl http://localhost:3005/api/report
```

---

## Häälestamine

Kõik nupud failis `src/lib/config.ts`:

| Muutuja | Mida teeb |
|---|---|
| `BLACKLIST` | tuntud nimed, mis alati välja filtreerida |
| `MAX_MARKET_CAP` | ülempiir turukapile (vaikimisi $10 mld) |
| `MIN_MENTIONS` | müralävi — alla selle ignoreeri |
| `TOP_N` | mitu leidu dashboardile/aruandesse |

Skoori valem: `src/lib/discovery.ts` → `scoreCandidate()`.

---

## Riskid (loe enne kasutamist)

- **Pump-and-dump** — sinu sihtprofiil kattub manipulatsiooniskeemi profiiliga.
- **Müra** — üksik thread/bot võib mainimised üleöö üles ajada.
- **Hilinemine** — Reddit-tähelepanu tuleb tihti *pärast* hinnaliikumist.
- **Likviidsus** — väikeaktsiaid on lihtne manipuleerida, raske müüa.

Kohtle tulemusi kui **„mida uurida"** nimekirja, mitte kui ostusoovitust.
