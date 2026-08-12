# Discovery Frequency & Run Provenance — disain

Kuupäev: 2026-08-12
Staatus: **sammud 1 ja 2 ehitatud 2026-08-12.** Ehitatud: samm 1 (manual scanner ei loo enam `candidate_outcomes` ridu, § 5.1) + samm 2 (canonical-only aggregation layer, § 5.2) + Discovery Frequency V1 (§ 3). `/validation`, `/backtest` koondstatistika ja `/frequency` kasutavad ainult `run_type = 'rklb_daily'` jooksu; ja alates sammust 1 tekivad outcome-read kirjutamise poolel ainult canonical run'idest. Skeemi ei muudetud, migratsiooni ei tehtud, ajaloolisi outcome'e ei puudutatud ega kustutatud. **Veel ehitamata (teadlikult):** samm 3 — `counts_for_stats` veergu ei lisatud (read-side filter piisab, kuni ilmneb vajadus indekseeritava lipu järele).

Alus: `discovery_runs` / `discovery_decisions` / `candidate_outcomes` olemasolev skeem ([`db/init.sql`](../db/init.sql), runtime `ensureSchema()` [`src/lib/db.ts`](../src/lib/db.ts)), Discovery Decision Snapshot + Validation Framework ja Backtest V1 juba salvestatud ajalugu, ning HANDOFF-i frequency-eeltingimused. Uusi andmeallikaid ega väliseid provider'eid ei eeldata.

## 1. Probleem, mida disain lahendab

2026-08-12 seisuga on `candidate_outcomes` valimis **205 rida**, millest:

- **25 rida** pärineb canonical daily discovery run'idest (`run_type = 'rklb_daily'`);
- **180 rida** pärineb manual run'idest (`run_type = 'rklb'`), mis tekivad `/scanner?preset=rklb` write-on-read käigus.

See tähendab, et **88% forward-valimi ridadest on kasutaja sirvimise kõrvalmõju, mitte ajastatud turuvaatlus.** Praegused koondvaated (`/validation`, `/backtest`) agregeerivad kõiki outcome-ridu run_type'i järgi eristamata, seega strateegia mediaantootlus, hit rate, benchmark-beat rate ja excess return arvutatakse valimist, mida domineerib kasutaja aktiivsus.

See rikub otseselt kaht juba dokumenteeritud põhimõtet:

- **„Lehe avamine ei tohi kunagi olla ainus põhjus, miks andmestik või valim muutub”** (HANDOFF, tehnilised otsused). Manual scanneri avamine loob praegu päris `candidate_outcomes` ridu.
- **„Discovery frequency ei loe tooreid leheavamisi”** (HANDOFF, tehnilised otsused). Enne frequency ehitamist tuleb see valimipiir puhtaks disainida, muidu mõõdab frequency kasutaja aktiivsust, mitte turusignaali.

### 1.1 Oluline täpsustus: ainult kaks teed loovad outcome-ridu

Neljast kontseptuaalsest run-liigist loob outcome-ridu tegelikult ainult kaks:

| Liik | Loob `candidate_outcomes`? | Reaalne allikas |
|---|---|---|
| canonical daily discovery | ✅ jah | `/api/collect`, `run_type = 'rklb_daily'` → 25 rida |
| manual exploration | ✅ jah | `/scanner?preset=rklb` write-on-read, `run_type = 'rklb'` → 180 rida |
| research workflow | ❌ ei | Thesis Builder cohort — ei loo `discovery_runs` ega outcome'e |
| validation / backtest | ❌ ei | ainult *mõõdab* olemasolevaid (`refreshCandidateOutcomes()`) |

Järeldus: **kõik 180 „saastavat” rida tulevad ühest ainsast teest** — käsitsi scanneri leheavamisest. Probleem ei ole nelja allika segadus; see on üks konkreetne write-on-read kõrvalmõju. Research workflow ja validation/backtest ei loo outcome'e üldse, seega nendega ei ole vaja frequency kontekstis tegeleda.

## 2. Canonical vs manual — definitsioon

Provenance **on juba andmes olemas**, mitte kaduma läinud. Iga outcome-rida on jälgitav kahe-hop FK-ahelas:

```
candidate_outcomes.decision_id → discovery_decisions.run_id → discovery_runs.run_type
```

| Mõiste | Definitsioon | run_type | Idempotentsusvõti |
|---|---|---|---|
| **Canonical daily discovery** | Ajastatud, UI-st sõltumatu päevane vaatlus. Üks kirje Tallinna otsusekuupäeva ja mudeliversiooni kohta. | `rklb_daily` | `mudeliversioon:run_type:decision_date` |
| **Manual exploration** | Kasutaja avab `/scanner?preset=rklb`; write-on-read salvestab jooksu. Uus jooks tekib, kui sisendräsi muutub. | `rklb` | `mudeliversioon:decision_date:input_hash` |
| **Research workflow** | Teadlik manual cohort (nt RESEARCH_SPRINT). Loob Thesis-otsuseid, mitte discovery run'e ega outcome'e. | — (ei kasuta discovery run'i) | — |
| **Validation / backtest** | Loevad ja **mõõdavad** olemasolevaid outcome'e; ei loo run'e ega outcome-ridu. | — (ainult lugeja) | — |

**Kavatsuse erinevus.** Canonical run on strateegia forward-vaatlus: iga kaasatud kandidaat saab lubaduse mõõta tootlust viiel horisondil. Manual run on auditijälg — „mida ma nägin, kui scanneri avasin” — ja ei tohiks kanda sama forward-mõõtmise lubadust. Outcome-rida ei ole neutraalne „as known at the time” kirje; see on strateegia-hindamise artefakt.

## 3. Miks frequency peab kasutama ainult canonical run'e

Discovery Frequency on **persistence-signaal**: mitmel eristuval otsusepäeval ticker canonically kaasati. Selle statistiline eeldus on, et iga vaatlus on ajaliselt ühtlane sõltumatu draw. Manual run rikub seda eeldust neljal viisil:

- **Ajaline klasterdumine.** Manual read tekivad siis, kui kasutaja töötab, mitte ühtlaselt kalendris. Viis leheavamist ühel õhtul ei ole viis päeva turusignaali.
- **Kordus samal päeval.** Manual `rklb` run tekib iga kord, kui sisendräsi muutub; sama ticker võib saada mitu rida samal Tallinna kuupäeval, mil see juba canonically hinnati.
- **Kasutaja aktiivsuse võimendus.** Naiivne frequency, mis loeb outcome/decision ridu, mõõdaks „mitu korda ma vaatasin”, mitte „mitmel eristuval otsusepäeval turg selle kandidaadi esile tõstis”.
- **Sõltuvus UI-st.** Canonical run peab olema scheduler/collector poolt UI-st sõltumatult toodetud; nii ei saa inimene sirvimisega frequency-tick'i manufaktuurida.

Sellest tulenevad frequency vaatlusreeglid (kooskõlas HANDOFF roadmap NEXT-sektsiooniga):

- **Vaatlusühik = üks canonical otsus `(model_version, Tallinn decision_date)` kohta** — mitte toored read, mitte leheavamised.
- Frequency loeb **eristuvaid canonical decision-date'e**, mitte run-count'i; dedup `(ticker, decision_date)` canonical'i seest.
- Erista `evaluated but excluded` päev päevast, mil tickerit universumis üldse ei hinnatud — muidu on puudumine mitmetähenduslik.
- Erista **stale evidence'iga püsimine** vs **uue/muutunud evidence'iga püsimine** — 5 päeva muutumatut snapshot'i ≠ 5 päeva kogunevat uut tuge. Just see hoiab frequency't turusignaalina, mitte „scheduler jooksis 5 korda” signaalina.
- `rklb-discovery-v1` ja `rklb-discovery-v2` canonical jooksud ei ole üks frequency-seeria; persistence-loendur algab v2 esimesest canonical run'ist (#17, 2026-08-12).

## 4. Millised vaated tohivad millist valimit kasutada

Reegel ühe lausega: **kuva kõike, agregeeri ainult canonical'i.**

| Vaade | Lubatud valim | Põhjus |
|---|---|---|
| Discovery Frequency / persistence | ainult canonical | sagedus-/jaotusstatistika, iga rida = sõltumatu forward-vaatlus |
| Backtest koondnäitajad (mediaan, hit rate, benchmark-beat, excess) | ainult canonical | sama; manual read paisutavad ja kallutavad |
| Validation horisondistatistika (mean/median/hit rate) | ainult canonical | sama |
| Üksiku run'i detail / otsuselogi | kõik run'id | per-run audit, mitte cross-run statistika |
| Üksiku outcome jälgitavus | kõik run'id | „kas *see* otsus liikus” on legitiimne auditiküsimus |
| Run-provenance jaotus (model_version × run_type) | kõik run'id | selle vaate eesmärk ongi provenance näidata |

## 5. Soovitatud migration path

Kolm sammu, väikseima ajaloolise kahjuga esimesena.

1. **[EHITATUD 2026-08-12] Peata manual scannerist outcome-ridade loomine (käitumismuudatus, mitte skeem).**
   `recordDiscoveryRun` loob `candidate_outcomes` ridu ainult siis, kui `runType === CANONICAL_RUN_TYPE` (`rklb_daily`). Manual scanner (`rklb`) jätkab `discovery_runs` + `discovery_decisions` salvestamist auditijäljena, aga ei loo enam forward-mõõtmise ridu. Ükski olemasolev outcome ei muutunud, ühtki ajaloolist rida ei kustutatud, migratsiooni ega backfilli ei tehtud. Runtime-kontroll kinnitas: manual included-otsus → 1 decision, 0 outcome; canonical → 1 decision, 5 outcome.

2. **[EHITATUD 2026-08-12] Filtreeri kõik koond-/sagedusvaated canonical'ile (päringukiht).**
   `/validation`, `/backtest` ja `/frequency` agregeerivad ainult `run_type = 'rklb_daily'`. Tase 0 ei nõua skeemimuudatust — piir jõustatakse olemasoleva `run_type` JOIN-i kaudu.

3. **[EI EHITATUD] Lisa tuletatud klassifikatsioonilipp indekseeritavaks piiriks (§ 6).**
   Valikuline robustsuse samm, mis muudab filtri unustamise raskeks. Sammudega 1+2 pole see enam kriitiline, sest saaste on nüüd nii kirjutamise (samm 1) kui lugemise (samm 2) poolel tõkestatud.

Migratsiooni järjekord oli tahtlik: samm 1 sulgeb saasteallika kirjutamise poolel, samm 2 parandab olemasoleva statistika korrektsuse ilma andmeid puutumata, samm 3 (tegemata) kõvendaks tuleviku vastu.

## 6. `counts_for_stats` ettepanek

**Tase 0 — null skeemimuudatust.** Jõusta agregatsioonis olemasolev `discovery_runs.run_type` filter. See üksi lahendab statistilise saaste ja on piisav minimaalseks korrektsuseks.

**Tase 1 — üks tuletatud, salvestatud lipp (soovituslik).** Praegu on `run_type` üle-koormatud vabatekst vaikeväärtusega `'rklb'`. Robustsuse ja indekseeritavuse jaoks:

- selge run-kavatsuse taksonoomia `discovery_runs`-il: `canonical` / `manual` / `research` (validation/backtest **ei loo run'e** — jäävad puhtalt lugejaks);
- üks tuletatud, aga salvestatud agregatsioonipiir, nt `counts_for_stats BOOLEAN` — default `false`, ainult canonical seab `true`;
- kõik koondpäringud: `WHERE counts_for_stats`.

Omadused:

- **Täielikult backfillitav olemasolevast `run_type`-st** — puhas tuletus, mitte fabritseeritud andmed.
- **Austab immutability't** — lisatakse ainult klassifikatsiooni-metainfo run-tasemel; ühtki `candidate_outcomes` väärtust ei puudutata.
- **Ohutu vaikeväärtus** — `false` tähendab, et filtri unustamine jätab rea statistikast välja, mitte ei saasta seda vaikimisi.

**Skeemivõla hoiatus.** Skeem on defineeritud kahes lahknevas kohas — [`db/init.sql`](../db/init.sql) ja runtime `ensureSchema()` [`src/lib/db.ts`](../src/lib/db.ts) (osa veerge tekib ainult runtime'is). Iga uus veerg tuleb praegu lisada mõlemasse. See on juba teadaolev P1 (versioonitud migratsioonide koondamine). Enne selle lipu ehitamist tasub kaaluda migratsioonide koondamist, muidu tekib kolmas lahknemiskoht.

## 7. Miks olemasolevat 205 outcome'i ei muudeta

- **Klassifikatsioon on juba puhtalt tuletatav.** `run_type` on iga ajaloolise run'i peal olemas ja outcome→decision→run ahel on terve, seega kõik 205 rida saab tagasiulatuvalt õigesti liigitada ilma ühtki väärtust muutmata. Ajalugu **tõlgendatakse ümber, mitte ei muudeta**.
- **Immutability põhimõte.** Juba `measured` outcome't ei kirjutata ümber ka siis, kui ajalukku lisatakse hiljem varasem hinnasnapshot. Sama loogika kehtib provenance kohta: manual read on päris „as known at the time” kirjed ja jäävad auditiks alles.
- **Null fabritseeritud andmet, null kaotatud infot.** 180 manual rida ei kustutata — need kaob agregatsioonist filtri, mitte DELETE kaudu. Nad jäävad üksiku run'i detailivaates nähtavaks.
- **Kooskõla varasema praktikaga.** Sector-relative ja catalyst V2 read ei backfillinud ajaloolisi otsuseid; sama põhimõte kehtib siin.

## 8. Lahtised küsimused enne ehitamist

- Kas research workflow (Thesis cohort) peaks tulevikus saama *eraldi* mõõdetava run-klassi (`research`), või jääb see teadlikult outcome-vabaks? Praegu ei loo see outcome'e; frequency jaoks pole vaja, aga forward-valimi rikastamiseks võib olla.
- Kas manual scanner peaks üldse jätkama `discovery_runs` kirjete loomist (auditiks), või piisab `discovery_decisions` snapshot'ist? Praegune write-on-read salvestab mõlemad.
- Kas `counts_for_stats` peaks olema range-tuletus (canonical = true) või lubama tulevikus manuaalset promotimist (nt research cohort teadlik kaasamine valimisse)?
- Frequency „stale vs uus evidence” eristus vajab evidence-muutuse tuvastust otsusepäevade vahel; kust see signaal tuleb (accession-grupp, score-snapshot input_hash, catalyst assessment versioon) — fikseerida enne ehitamist.
