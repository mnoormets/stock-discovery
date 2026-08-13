# Migratsioonid — konventsioon ja rakendusjärjekord

Staatus: **Slice 0 — ettevalmistus.** Siin kaustas olevaid faile **ei rakendata kuskil automaatselt**. Migratsioonimootorit ei ole veel olemas; `ensureSchema()` jääb esialgu tootmise skeemiteeks. Migratsioonid lisanduvad **kõrvale**, mitte asemele.

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

Käsitsi käivitatav, **midagi ei käivitu automaatselt** (ei app startup, ei testid, ei `npm run check`).

```bash
npm run migrate -- --status
```

```bash
npm run migrate -- --database-url postgres://discovery:discovery@localhost:5433/minu_tmp_db
```

| Lipp | Tähendus |
|---|---|
| *(puudub)* | Rakendab rakendamata migratsioonid `DATABASE_URL` sihtbaasi |
| `--status` | Ainult raport (applied / pending / checksum mismatch). **Ei kirjuta midagi, ei loo `schema_migrations` tabelit.** Töötab ka kaitstud baasi vastu |
| `--database-url <url>` | Eksplitsiitne sihtbaas; muidu `DATABASE_URL` või lokaalne vaikeväärtus |
| `--allow-discovery` | **Ainus viis** rakendada baasi nimega `discovery` |

**Kaitstud baas.** Runner **keeldub vaikimisi** baasist nimega `discovery` (dev / golden source). Ilma `--allow-discovery` liputa katkeb ta enne mistahes DDL-i. Testimiseks kasuta ajutist baasi, nt `*_migration_tmp`.

**Advisory lock.** Kogu jooks on kaetud `pg_try_advisory_lock(hashtext('stock-discovery:migrate'))`-iga ühel pühendatud ühendusel; teine samaaegne migrator lõpetab puhtalt ilma rakendamata. Lukk vabastatakse alati (`finally`).

**Checksum.** Iga faili SHA-256 salvestatakse. Kordusjooks, kus checksum klapib → `SKIP`. Kui rakendatud migratsiooni fail on **tagantjärele muudetud**, katkeb runner veaga ja **ei rakenda ka järgnevaid** — parandus käib alati **uue** migratsiooniga.

## Rakendusjärjekord (kui mootor kunagi valmib)

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

**Tabelit ei ole veel üheski andmebaasis loodud.** Slice 0 on ainult disain.

## Miks `ensureSchema()` jääb esialgu alles

`ensureSchema()` kutsutakse **18 kohast** `src/`-s ja see on praegu ka testibaasi skeemi-tõeallikas (`tests/setup/global-setup.ts`). Selle eemaldamine on eraldi, hilisem samm. Slice 0 ei muuda ühtki käivitusteed.

## Teadaolev kahesuunaline drift (mõõdetud 2026-08-13)

| Suund | Sisu |
|---|---|
| **Ainult runtime'is** (init.sql-ist puudu) | `catalyst_events` (15 veergu), `catalyst_assessments` (22 veergu), `discovery_decisions` + 15 catalyst-veergu, 7 catalyst-piirangut |
| **Ainult `init.sql`-is** (runtime ei loo) | `price_snapshots` **UNIQUE (company_id, captured_at)**, `investment_theses` **CHECK (status ∈ draft/researching/ready/rejected)**, 6 jõudlusindeksit |

Kumbki pool **ei ole** teise ülemhulk. Baseline-migratsiooni ülesanne on kirjeldada **liitu** (runtime ∪ init.sql).

Tagajärg, mida tuleb teada: testibaas ehitatakse `ensureSchema()`-st, seega **testides puuduvad `price_snapshots` UNIQUE ja thesis-staatuse CHECK** — testiskeem on tootmisest nõrgem.
