# Migratsioonid — konventsioon ja rakendusjärjekord

Staatus: **rakendatud.** `0001_baseline` on rakendatud golden-source DB-le **2026-08-13** (`schema_migrations`: 1 kirje) ja `--conformance` ütleb `VASTAB`. Testibaas ehitatakse migratsioonidest (`tests/setup/global-setup.ts`). Runner `scripts/migrate.cjs` on olemas ja **käsitsi käivitatav** — app startup ega `npm run check` seda ei kutsu. `ensureSchema()` jääb tootmises esialgu alles, kuid on migreeritud skeemil tõestatud **no-op** (vt „`ensureSchema()` staatus").

## Failinime formaat

```
NNNN_description.sql
```

- `NNNN` — nelja numbriga järjekorranumber, algab `0001`-st, ei taaskasutata kunagi.
- `description` — lühike `snake_case` kirjeldus (`add_price_snapshot_unique`).
- Sortimine on **leksikograafiline** — seetõttu on nullidega täidetud number kohustuslik.

## Reeglid

1. **Ainult forward-migratsioonid.** Rollback-faile ei kirjutata. PostgreSQL-i DDL on transaktsiooniline: ebaõnnestunud migratsioon rullub ise tagasi ja jätab baasi eelmisse kehtivasse olekusse. Vale migratsiooni parandab **uus** migratsioon, mitte vana muutmine.
2. **Iga migratsioon on transaktsiooniline, aga transaktsiooni omab RUNNER.** `scripts/migrate.cjs` teeb `BEGIN` → faili SQL → `INSERT INTO schema_migrations` → `COMMIT` ühe transaktsiooni sees. **Migratsioonifail ise EI TOHI sisaldada `BEGIN` / `COMMIT` / `ROLLBACK`-i** — muidu satuks raamatupidamiskirje migratsiooni transaktsioonist välja ja atomaarsus kaoks. Runner keeldub sellisest failist eksplitsiitse veaga.
3. **Rakendatud migratsiooni ei muudeta kunagi tagantjärele.** Mootor hakkab hoidma `checksum`-i; muudetud fail annab vea, mitte vaikse lahknevuse.
4. **Esimeses faasis ainult mittehävitav DDL:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD CONSTRAINT`. **Mitte ühtki `DROP`-i**, mitte ühtki tüübimuutust, mitte ühtki `NOT NULL` lisamist olemasolevale veerule.
5. **Enne piirangu lisamist on audit kohustuslik.** `UNIQUE` ja `CHECK` ebaõnnestuvad, kui andmes on juba rikkumisi. Jooksuta enne:

```bash
npm run schema:diff
```

   See raporteerib `price_snapshots` duplikaadid ja `investment_theses` vigased staatused **ainult `SELECT`-idega**. Kui rikkumisi on, tuleb need enne migratsiooni käsitsi lahendada — migratsioon ise ei tohi andmeid kustutada ega muuta.

## Runner: `scripts/migrate.cjs`

Käsitsi käivitatav: **app startup ega `npm run check` seda ei kutsu.** Ainus automaatne kasutaja on testharness — `tests/setup/global-setup.ts` ehitab testibaasi `runMigrations()` kaudu, mistõttu kogu testikomplekt valideerib ühtlasi runnerit, baseline'i ja `schema_migrations` raamatupidamist.

```bash
npm run migrate -- --status
```

```bash
npm run migrate -- --database-url postgres://discovery:discovery@localhost:5433/minu_tmp_db
```

| Lipp | Tähendus |
|---|---|
| *(puudub)* | Rakendab rakendamata migratsioonid `DATABASE_URL` sihtbaasi |
| `--preflight` | **GO / NO-GO kontroll enne apply't.** Koondab ühte vaatesse: sihtbaas + kas nõuab `--allow-discovery`, `schema_migrations` seis, iga migratsiooni pending/applied/mismatch, `price_snapshots` duplikaadid, `investment_theses` vigased staatused **ja conformance**. **Read-only.** |
| `--conformance` | **Kas sihtbaas vastab baseline sihtskeemile?** Ehitab ajutise DB baseline'ist ja diffib selle sihtbaasi vastu: puuduvad tabelid, veerud, indeksid, piirangud + „üle" objektid. **Sihtbaasi suhtes read-only**; ajutine DB kustutatakse alati |
| `--status` | Ainult raport (applied / pending / checksum mismatch). **Ei kirjuta midagi, ei loo `schema_migrations` tabelit.** Töötab ka kaitstud baasi vastu |
| `--database-url <url>` | Eksplitsiitne sihtbaas; muidu `DATABASE_URL` või lokaalne vaikeväärtus |
| `--allow-discovery` | **Ainus viis** rakendada baasi nimega `discovery` |

**Kaitstud baas.** Runner **keeldub vaikimisi** baasist nimega `discovery` (dev / golden source). Ilma `--allow-discovery` liputa katkeb ta enne mistahes DDL-i. Testimiseks kasuta ajutist baasi, nt `*_migration_tmp`.

**Advisory lock.** Kogu jooks on kaetud `pg_try_advisory_lock(hashtext('stock-discovery:migrate'))`-iga ühel pühendatud ühendusel; teine samaaegne migrator lõpetab puhtalt ilma rakendamata. Lukk vabastatakse alati (`finally`).

**Exit-koodid.**

| Kood | Tähendus |
|---:|---|
| `0` | Õnnestus / GO / **conformance ilma blokeerijateta** — vt hoiatust allpool |
| `1` | Viga: checksum mismatch, guard keeldus, `--database-url` ilma väärtuseta, migratsioon ebaõnnestus (rullitud tagasi) |
| `2` | `--preflight` või `--conformance` andis **NO-GO** (ehk leidis blokeerija) |
| `3` | Apply-režiim: **teine migrator hoiab advisory lukku**, midagi ei rakendatud |

> ⚠️ **`--conformance` exit-kood ei erista `VASTAB`-i ja `ERINEB`-i.** Mõlemad annavad `0`, sest `ERINEB (baseline suudab parandada)` ei ole blokeerija — exit `2` tuleb ainult päris blokeerijast (nt puuduv `NOT NULL` veerg olemasolevas tabelis). Tagajärg: `npm run migrate -- --conformance && echo OK` prindib `OK` ka mittevastava baasi korral. **Range värava jaoks kontrolli väljundist sõna `VASTAB`**, mitte exit-koodi.

Kood `3` on eraldi koodiga just seetõttu, et skriptitud kasutuses ei tohi „midagi ei tehtud" näida edukas migratsioonina.

**Timeoutid.** Apply-teel seatakse ainult sellele ühendusele `lock_timeout = 10s` ja `statement_timeout = 5min`. Põhjus: DDL võtab `ACCESS EXCLUSIVE` lukud ja ilma timeoutita ripuks migratsioon lõpmatuseni app'i lahtise ühenduse taga, hoides samal ajal advisory lukku. Ebaõnnestumisel rullub transaktsioon tagasi ja `schema_migrations` rida **ei teki**. `--status` / `--preflight` / `--conformance` on read-only ega vaja neid.

**Checksum on masinateülene.** Räsi arvutatakse **normaliseeritud** sisust (CRLF → LF). Ilma selleta annaks sama fail Windowsi `core.autocrlf=true` checkout'is ja Linuxis eri räsi ning runner viskaks vale CHECKSUM MISMATCH vea. `.gitattributes` (`*.sql text eol=lf`) on teine kaitsekiht, kuid runner **ei sõltu sellest**.

**Checksum.** Iga faili SHA-256 salvestatakse. Kordusjooks, kus checksum klapib → `SKIP`. Kui rakendatud migratsiooni fail on **tagantjärele muudetud**, katkeb runner veaga ja **ei rakenda ka järgnevaid** — parandus käib alati **uue** migratsiooniga.

## How to apply baseline to golden-source DB

> ⚠️ **HOIATUSED — loe enne igat sammu**
> - Käivita **AINULT koduarvuti golden source DB vastu**. Tööarvuti lokaalne DB **ei ole** golden source; sellel migratsioone ei rakendata.
> - **Mitte enne värsket dump'i/backup'i.** Vt „Käivitamine uues arvutis" (`docs/HANDOFF.md`) `pg_dump -Fc` käsku.
> - **Mitte enne, kui preflight näitab 0 duplikaati ja 0 vigast staatust.** `UNIQUE` ja `CHECK` **ebaõnnestuvad**, kui rikkuvad read on juba andmes.
> - `--allow-discovery` on **ainus** viis kaitstud baasi rakendada. Ära kasuta seda kunagi kogemata tööarvutis.
> - Baseline on **mittehävitav**: ei ühtki `DROP`-i ega tüübimuutust. Olemasolevad andmed jäävad puutumata.
> - **Peata enne apply't Task Scheduler ja app-konteiner.** Ajastatud `collect:daily` võib apply ajal ridu kirjutada ja `ADD CONSTRAINT` kukuks; lahtine app-ühendus võib DDL-i blokeerida (`lock_timeout` katkestaks migratsiooni).
> - **Mitte apply'da, kui `--conformance` näitab puuduvaid veerge, mida baseline EI paranda.** Need on `NOT NULL` ilma defaultita ja vajavad eraldi repair-migratsiooni.

### ENNE (kõik read-only)

Peata ajastatud töö ja app, et keegi ei kirjutaks apply ajal:

```bash
schtasks /End /TN "StockDiscoveryDailyCollect"
```

```bash
docker compose stop app scheduler
```

```bash
git pull origin main
```

```bash
npm ci
```

```bash
docker compose up -d db
```

```bash
npm run schema:diff
```

```bash
npm run migrate -- --preflight
```

```bash
npm run migrate -- --conformance
```

**Edasi tohib minna ainult siis, kui `--preflight` ütleb `GO`** ja näitab:
- `price_snapshots duplikaate` = **0**
- `investment_theses vigaseid` = **0**
- `0001_baseline` = **PENDING**
- `kaitstud baas? JAH` → seega apply nõuab `--allow-discovery`
- conformance ei raporteeri **ühtki** puuduvat veergu, mida baseline ei paranda

Kui verdikt on `NO-GO`, **peatu** ja lahenda blokeerijad. Ära lõdvenda baseline'i piiranguid selleks, et apply läbi läheks.

### VÕTA BACKUP

```bash
docker compose exec -T db pg_dump -U discovery -d discovery -Fc -f /tmp/pre-migration.dump
```

```bash
docker compose cp db:/tmp/pre-migration.dump ./pre-migration.dump
```

### APPLY

```bash
npm run migrate -- --allow-discovery
```

Oodatav väljund: `APPLY 0001_baseline ... OK (…ms)` ja `rakendatud 1, vahele jäetud 0`.

### PÄRAST (kontroll)

```bash
npm run migrate -- --conformance
```

Peab ütlema **`VASTAB`** ja 0 puuduvat objekti — see on H3 tõend, et sihtbaas jõudis päriselt sihtskeemi.

```bash
npm run migrate -- --preflight
```

```bash
npm run schema:diff
```

Nüüd peavad `price_snapshots UNIQUE` ja `investment_theses status CHECK` näitama **OLEMAS**.

```bash
npm run typecheck
```

```bash
node node_modules/vitest/vitest.mjs run
```

```bash
npm run collect:status
```

`collect:status` peab näitama samu loendureid nagu enne migratsiooni — canonical run'id, outcome'id ja faktid ei tohi muutuda.

### Kui midagi läheb valesti

Migratsioon jookseb ühes transaktsioonis: ebaõnnestumisel rullub ta **ise tagasi** ja `schema_migrations` rida ei teki. Andmete taastamiseks kasuta `pre-migration.dump`-i (`pg_restore --clean --if-exists`).

## Rakendusjärjekord (runneri tegelik käitumine)

1. Võta PostgreSQL advisory lock (sama muster nagu `scripts/collect-daily.cjs`), et kaks samaaegset startupi ei rakendaks korraga.
2. Loo `schema_migrations`, kui puudub.
3. Loe kaustast failid leksikograafilises järjekorras.
4. Iga rakendamata versiooni kohta: `BEGIN` → SQL → `INSERT INTO schema_migrations` → `COMMIT`.
5. Vabasta lukk.

## `schema_migrations` disain

| Veerg | Tüüp | Roll |
|---|---|---|
| `version` | `TEXT PRIMARY KEY` | Failinime number+kirjeldus, nt `0001_baseline` |
| `applied_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Millal rakendati |
| `checksum` | `TEXT NOT NULL` | Faili SHA-256; tuvastab tagantjärele muudetud migratsiooni |
| `execution_ms` | `INTEGER` | Kestus, et aeglane migratsioon oleks nähtav |

Tabel on olemas nii golden-source DB-s (rakendatud 2026-08-13) kui igas testibaasis.

## `ensureSchema()` staatus

`ensureSchema()` kutsutakse **18 kohast** `src/`-s ja jääb tootmises esialgu alles; selle eemaldamine on eraldi samm. Testibaasi skeemi-tõeallikas see **enam ei ole** — testibaas tuleb migratsioonidest.

Migreeritud skeemil on `ensureSchema()` **no-op** ja seda on tõestatud kahel tasandil:

1. **Testides** valvab seda D5 (`tests/db/infra-smoke.test.ts`): kui keegi lisab `ensureSchema()`-sse veeru ilma vastava migratsioonita, läheb test kohe punaseks.
2. **Golden-source DB-s** jäi `--conformance` verdikt `VASTAB` ka pärast päris `collect:daily` jooksu, mis `ensureSchema()` kutsub (mõõdetud 2026-08-13, Task Scheduleri esimene jooks).

## Teadaolev kahesuunaline drift (mõõdetud 2026-08-13)

| Suund | Sisu |
|---|---|
| **Ainult runtime'is** (init.sql-ist puudu) | `catalyst_events` (15 veergu), `catalyst_assessments` (22 veergu), `discovery_decisions` + 15 catalyst-veergu, 7 catalyst-piirangut |
| **Ainult `init.sql`-is** (runtime ei loo) | `price_snapshots` **UNIQUE (company_id, captured_at)**, `investment_theses` **CHECK (status ∈ draft/researching/ready/rejected)**, 6 jõudlusindeksit |

Kumbki pool **ei ole** teise ülemhulk. Baseline-migratsiooni ülesanne on kirjeldada **liitu** (runtime ∪ init.sql).

See kahesuunaline drift on nüüd **lahendatud**: baseline kirjeldab liitu ja testibaas ehitatakse migratsioonidest, seega `price_snapshots` UNIQUE ja thesis-staatuse CHECK on ka testiskeemis olemas (`tests/db/infra-smoke.test.ts`, D4). Testiskeem ei ole enam tootmisest nõrgem.

## Teadaolevad piirid (koodiülevaatus 2026-08-13)

Runner (`scripts/migrate.cjs`, 519 rida) vaadati rida-realt üle. Kaitsekihid on paigas: kaitstud baasi guard rakendub alles apply-teel (nii et `--status` / `--preflight` / `--conformance` töötavad ka `discovery` vastu), iga migratsioon jookseb koos oma `schema_migrations` kirjega ühes transaktsioonis, advisory lock vabastatakse `finally`-s, checksum normaliseeritakse reavahetuste osas ja `dropTmp` keeldub nimest, mis ei lõpe `_diff_tmp`-ga. Kolm piiri, mida tasub teada:

1. **`--conformance` ei valideeri `BEGIN`/`COMMIT` keeldu.** Conformance rakendab migratsioonid ajutisse baasi ilma `assertNoExplicitTransaction` kontrollita, apply-tee teeb seda. Seega conformance võib „läbida" migratsiooni, mille apply hiljem tagasi lükkab. Mõju on väike (ajutine baas kustutatakse), aga valideerimine on ebaühtlane.
2. **Kaks samaaegset `--conformance` / `--preflight` jooksu segavad üksteist.** Ajutise baasi nimi on fikseeritud (`schema_conformance_diff_tmp`) ja jooks alustab `DROP DATABASE … WITH (FORCE)`-ga, mis katkestab teise jooksu ühendused. Andmeohtu ei ole (sihtbaas on read-only), aga tulemus on segadust tekitav viga. Ära jooksuta kahte korraga.
3. **`baselineRepairableColumns` regex on kitsas** — see loeb ainult `ALTER TABLE <tabel> ADD COLUMN IF NOT EXISTS <veerg>` kuju. Teistsuguse kirjapildi (nt skeemiga kvalifitseeritud tabelinimi) korral alahindab see parandatavaid veerge ja annab **valehäire NO-GO**. Viga on konservatiivses suunas, seega ohutu, kuid võib blokeerida legitiimse apply.

Parandatud samas ülevaatuses: `--database-url` ilma väärtuseta langes varem vaikselt tagasi vaikimisi sihtbaasile ehk golden source'ile. Koos `--allow-discovery`-ga tähendanuks äralibisenud argument migratsiooni kaitstud baasi. Nüüd katkeb runner valjult exit-koodiga `1`.

## `db/init.sql` roll pärast baseline'i

`init.sql` jookseb endiselt **ainult värske Dockeri volume'i** loomisel (`docker-compose.yml` mount). Mõõdetud 2026-08-13: sellest tekkiv skeem on **19 tabelit** ja `--conformance` ütleb `ERINEB` — puuduvad `catalyst_events`, `catalyst_assessments`, `schema_migrations` (56 veergu, 7 indeksit, 8 piirangut). **Aga „sihtbaasis ÜLE" = 0:** `init.sql` ei loo midagi, mida baseline ei kirjelda.

Koondumine on **tõestatud, mitte järeldatud**: init.sql-ist ehitatud ajutisele baasile rakendatud `0001_baseline` andis `--conformance VASTAB` (0 puuduvat, 0 üle).

Tagajärg: pärast `docker compose down -v` on korrektne järjekord **`up -d db` → `npm run migrate`**. `init.sql` on nüüd üleliigne, kuid kahjutu; selle eemaldamine on eraldi otsus.
