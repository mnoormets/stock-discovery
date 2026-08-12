# Under-Recognition & Challenger — disain

Kuupäev: 2026-08-12
Staatus: **under-recognition proxy V0 ehitatud 2026-08-12; challenger-vs-incumbent jääb disainiks.** Under-recognition Evidence V0 (`under-recognition-v0`) on read-only evidence-kiht (`src/lib/under-recognition.ts` + `UnderRecognitionEvidence` komponent), mis kuvab § 1 signaalivektori ja viie-oleku tuletuse company detailis ja Thesis Builderis. **Skeemi, filtreid, skoore, API-sid ega uut andmeallikat ei lisatud; ranking'ut ei muudetud.** V0 ei arvuta frequency't ega hinnareaktsiooni (mõlemad `unknown`, § 7.5) ega catalyst novelty't neil kahel surface'il (jääb `unknown`, kuna neid vaateid ei arvuta catalyst'it). Cohort QA kinnitab § 4.1 tulemust. **Challenger-vs-incumbent (§ 2) on endiselt ainult disain.**

Skoop on **teadlikult kitsas:** ainult kaks kihti — **under-recognition proxy** ja **challenger-vs-incumbent narrative**. See dokument **ei** kirjelda ega luba themes, strategic investors, insider trading, dividend, smart-money ega valuation mooduleid (§ 6).

Alus: olemasolevad kihid — Growth / Health / Coverage, Data Freshness + Period Alignment V1, Catalyst Evidence V2 ([`CATALYST_EVIDENCE_V2.md`](CATALYST_EVIDENCE_V2.md)), Thesis Builder, Validation / Backtest ja Discovery Frequency V1 canonical-only andmetega ([`DISCOVERY_FREQUENCY_PROVENANCE.md`](DISCOVERY_FREQUENCY_PROVENANCE.md)). Uus kiht **kasutab** neid, ei asenda. Uusi andmeallikaid ega võtmeid ei eeldata.

## 0. Küsimus, millele see kiht vastab

> „Kas see ettevõte võib olla **varajane research-kandidaat**, sest **tõend on paranemas**, aga **turg/konsensus ei pruugi seda veel täielikult hinnastada**?"

See ei ole ostusignaal ega tõenäosusskoor. See on suunatud tähelepanu: „vaata siia varem, sest siin on koos uus tõend ja madal tähelepanu". Lõpliku kaitstava otsuse teeb inimene Thesis Builderis.

Kaks põhimõtet, mis kehtivad kogu dokumendis:

- **Evidence-vektor, mitte koondskoor.** Iga signaal on eraldi nähtav ja iga signaal lubab `unknown`. Ei ole „Under-recognition Score 87" ega „Challenger Score 1–10". See järgib „Leia järgmine RKLB" leksikograafilist mustrit ja Catalyst Evidence V2 tier-loogikat.
- **Iga väide kannab allikat/tõendit või on `unknown`.** `unknown` on aus ja sagedane vastus, mitte viga. Puuduv andmestik ei muutu vaikimisi nulliks ega negatiivseks järelduseks.

---

## 1. Under-recognition proxy

Eesmärk: hinnata olemasolevatest andmetest, kas ettevõte võib olla **ala-märgatud** — st tõend liigub, aga tähelepanu (kate, hind, avastamine) ei ole veel järele jõudnud. **See ei ole koondskoor.** See on signaalivektor, kus iga rida on eraldi loetav ja iga rida lubab `unknown`.

Kriitiline eristus, mis hoiab kihi ausana:

> Under-recognition = **madal tähelepanu KORRUTATUD paraneva tõendiga**. Madal tähelepanu üksi ei ole võimalus (§ 5). Signaal on tähenduslik ainult siis, kui vähemalt üks „tõend paraneb" mõõde on `strong`.

### 1.1 Signaalid

**a) Analyst coverage count (kui olemas)**
- *Tähendus:* mitu analüütikut ettevõtet jälgib (Yahoo consensusest, juba olemas).
- *Tugev:* madal kate (nt ≤ 2–3 analüütikut) koos paraneva tõendiga → tähelepanu pole veel saabunud.
- *Nõrk:* kõrge kate → konsensus on juba olemas, edge ebatõenäoline.
- *`unknown`:* consensus-andmed puuduvad. **Puuduv kate ≠ null kate.** Ilma andmeta ei tohi väita „keegi ei jälgi".

**b) Market cap peer/sektori grupi suhtes**
- *Tähendus:* sector-relative market cap percentiil (Sector-relative Ranking V1 loogika laieneb).
- *Tugev:* väike grupi mediaani suhtes + tõendatult paranevad numbrid → veel radari all.
- *Nõrk:* juba grupi suurim → alahindamine ebatõenäoline.
- *`unknown`:* grupp alla viie võrreldava ettevõtte (percentile teadlikult puudub V1-s).
- *Hoiatus:* väike cap **ei tähenda automaatselt upside'i** (§ 5). See on tähelepanu-, mitte väärtusmõõt.

**c) Discovery frequency: madal, aga tõusev**
- *Tähendus:* Frequency V1 canonical-only ajaloost — ticker ilmub kaasatuna harva, aga streak on äsja alanud / aknad 5/10/20 näitavad tõusu.
- *Tugev:* madal ajalooline kaasamine + hiljutine tõus + `evolving_evidence` persistence → süsteem alles hakkab teda leidma.
- *Nõrk:* pikk stabiilne kõrge kaasamine (juba tuntud) või `stale_evidence` (püsib vana kordusega, mitte uue infoga).
- *`unknown`:* alla frequency tõlgenduse läve (< 5 canonical päeva). **See on praegu tõenäoline vaikeseis** ja põhjus § 7 ootamissoovituses.

**d) Evolving evidence, aga hind ei ole veel tugevalt reageerinud**
- *Tähendus:* uus tõend on lisandunud (Catalyst `evidence` või `linked_period_end` edenes), aga hind selle sündmuse järel pole materiaalselt liikunud.
- *Tugev:* `material_new_evidence` tier + väike/olematu hinnaliikumine tõendi kuupäevast alates → turg pole veel hinnastanud.
- *Nõrk:* hind on juba tõusnud → uudis on hinnas.
- *`unknown`:* hinnasnapshotte tõendi kuupäeva ümber ei ole piisavalt. **Ära arvuta reaktsiooni ühe punktiga** (sama distsipliin nagu benchmark start/end aknad).
- *Look-ahead hoiatus:* „hind pole reageerinud" tuleb hinnata **ainult otsusehetkeni teadaoleva** hinnaga, mitte tänase teadmisega.

**e) Catalyst evidence: material_new_evidence**
- *Tähendus:* Catalyst V2 kõrgeim tier (primaarallikas + kvantifitseeritud materiality + teadaolev suund + `new_information` + mitte-aegunud periood).
- *Tugev:* material_new_evidence on olemas → „tõend paraneb" mõõde on täidetud.
- *Nõrk:* `scheduled_only`, `collection_gap`, `weak_or_unconfirmed`, `none_recorded`.
- *`unknown`:* catalyst-hinnangut pole veel arvutatud.
- See on kihi **kvalifitseeriv mõõde:** ilma vähemalt ühe „tõend paraneb" signaalita (see või d) ei ole under-recognition tähenduslik.

**f) Under-followed but improving financials**
- *Tähendus:* Growth liigub üles, Financial Health talutav (ellujäämine), aga kate/cap madal.
- *Tugev:* Growth ≥ baaslävi + Health ei signaali otsest ellujäämisriski + madal kate/cap.
- *Nõrk:* numbrid ei liigu või Health näitab runway-riski → mitte „paranev tõend".
- *`unknown`:* Growth või Health puudulik (Coverage liiga madal usaldusväärseks järelduseks).
- *Freshness-sõltuvus:* „paranemine" loeb ainult värske ja joondatud sisendi puhul (Data Freshness / Period Alignment). Coverage 100 aegunud sisendiga ei ole paranemise tõend.

### 1.2 Kokkuvõttev loogika (mitte skoor)

Under-recognition on **tähenduslik**, kui:
- vähemalt üks **tähelepanu-madaluse** mõõde on `strong` (a, b või c), **ja**
- vähemalt üks **tõend-paraneb** mõõde on `strong` (d, e või f),
- ning kõik tugineb värskele/joondatud sisendile (Freshness).

Kui ainult tähelepanu on madal, aga tõend ei parane → see on **penny-stock/ignored-for-a-reason** muster, mitte võimalus. Vektor kuvatakse ikka, aga järjestuses ei tõuse.

---

## 2. Challenger-vs-incumbent narrative

Eesmärk: modelleerida ettevõtet kui **challenger'it** suure incumbent'i või domineeriva kategooria vastu (RKLB vs SpaceX-tüüpi loogika). See **ei tohi olla vaba narratiivtekst.** Iga väide kannab `source`/`evidence` või on `unknown`. Narratiiv ilma tõendita on täpselt see, mida süsteem peab `skeptical` hoidma (§ 4, ACHR).

### 2.1 Tõendimõõtmed

| Mõõde | Mida ta väidab | Allikas / `unknown` |
|---|---|---|
| **category_being_challenged** | Millist turgu/kategooriat rünnatakse. | Ärikirjeldus (SEC filing) või `unknown`. |
| **incumbent / reference_company** | Domineeriv võrdlusettevõte. | Nimeliselt; `unknown` kui pole selget incumbent'i. |
| **challenger_advantage_hypothesis** | Miks challenger võiks võita (kulu, tehnoloogia, ärimudel). | See on **hüpotees**, mitte fakt — märgistatud kui kasutaja väide, kuni seotud tõendiga. |
| **evidence_of_share_shift** | Kas turuosa liigub. | Revenue-kasv vs incumbent'i stagnatsioon; `unknown` kui incumbent'i võrdlust pole. |
| **evidence_of_technical/product_progress** | Kas toode/tehnoloogia edeneb mõõdetavalt. | Filing / earnings; `unknown`. |
| **evidence_of_customer_wins / backlog / partnerships / unit_economics** | Kas kliendid/tellimused/ühikuökonoomika kinnitavad. | Primaarallikas (nt BW backlog $2,6b); `unknown`. |
| **financial_confirmation** | Kas Growth/Health/Catalyst kinnitavad numbriliselt. | Olemasolevad skoorid + Catalyst tier; `unknown` kui Coverage madal. |
| **invalidation_checkpoint** | Mõõdetav sündmus, mis teeb challenger-teesi valeks. | **Kohustuslik** — ilma selleta ei ole see challenger-tees, vaid lugu (§ 5). |

### 2.2 Millal challenger-muster kehtib

- Väike/keskmine ettevõte ründab suuremat turgu, incumbent on suur/aeglane/ülekindel, **ja** challenger'il on **mõõdetav progress** (share shift VÕI product progress VÕI customer/backlog/unit-economics tõend).
- Kui ainult `challenger_advantage_hypothesis` on olemas, aga kõik tõendimõõtmed on `unknown` → see on narratiiv ilma tõendita → `skeptical`, mitte kandidaat.
- Incumbent'i haavatavus ühendub Data Freshness kihiga: incumbent, kelle avalik sisend on aegunud/langev, on tõenäolisemalt pime muutuse suhtes — kuid ka see on tõend, mitte oletus.

---

## 3. Kompositsioon olemasoleva süsteemiga

Uued kihid istuvad **peale**, ei asenda ega muuda ühtki olemasolevat valemit ega filtrit:

- **Growth** → kas numbrid liiguvad (challenger'i share-shift / improving-financials sisend).
- **Health** → kas ettevõte suudab ellu jääda (challenger'i puhul sageli nõrk — see on osa asümmeetriast, mitte diskvalifikaator, kui runway on teada).
- **Coverage / Freshness / Alignment** → kas andmeid saab usaldada. „Paranemine" loeb ainult värske/joondatud sisendi puhul.
- **Catalyst Evidence V2** → kas lisandus uus mõõdetav tõend (`material_new_evidence` on under-recognition kvalifitseeriv mõõde ja challenger'i financial_confirmation sisend).
- **Discovery Frequency V1** → kas signaal püsib canonical jooksudes; `evolving_evidence` persistence on under-recognition tugevaim „turg jõuab järele" kinnitus.
- **Thesis Builder** → koht, kus inimene teeb lõpliku kaitstava otsuse. Challenger'i `invalidation_checkpoint` kaardub otse Thesis Builderi `invalidation` + 12 kuu kontrollpunkti peale; `challenger_advantage_hypothesis` kaardub `mispricing` peale.

**Uued kihid ei anna buy/sell soovitust.** Nad mõjutavad ainult järjestust ja nähtavat tõendit, nagu catalyst tier ja sector-relative.

---

## 4. Cohort kontrollnäited (API / BW / CAKE / HIMS / ACHR)

Kasutan olemasolevat 2026-08-11 research sprinti märgistatud testhulgana. Otsused: API `ready`, BW `researching`, HIMS `researching`, CAKE `rejected`, ACHR `rejected`.

### API — `ready`
- *Under-recognition:* **tõenäoliselt kasulik.** Sprint kinnitas kaitstava, falsifitseeritava teesi; küsimus, kas `ready` tuli just **under-recognition + improving fundamentals** kombinatsioonist, on täpselt see, mida see kiht teeks nähtavaks. Data-quality oli `fresh/good` — st „paranemine" tugineks värskele sisendile.
- *Challenger:* sõltub, kas API-l on selge incumbent; kui ei, jääb `reference_company` = `unknown` ja kiht ei sunni narratiivi peale.
- *`unknown`:* analyst coverage ja hinnareaktsioon tõendi järel vajaksid kontrollimist.
- *Kas oleks aidanud:* jah — oleks teinud eksplitsiitseks, **miks** API on `ready`, mitte ainult **et** ta on.

### BW — `researching`
- *Under-recognition:* **tugev kandidaat.** Q2 2026 revenue $319,7m (+130%), backlog $2,6b (+533%), Base Electron $100,7m = `material_new_evidence`, samas kui catalyst hard gate ta varem valesti välistas. Turnaround + uus tõend + `mixed/poor` alignment (Coverage 100 varjas 2021 debt'i) = klassikaline „screen eksib, sest kohtleb stale't värskena".
- *Challenger:* sobib — mõõdetav backlog/product progress on olemas.
- *`unknown`:* debt 2021 tõttu jääb Health/alignment osaliselt ebausaldusväärseks; see **peab** jääma nähtavaks `unknown`/`poor`, mitte kaduma paranemise entusiasmi.
- *Kas turnaround + evidence + poor alignment teeb ta `researching`-kandidaadiks:* jah — täpselt see kombinatsioon (paranev tõend + andmete ebakindlus) on „vaata lähemalt", mitte „osta".

### CAKE — `rejected`
- *Under-recognition:* nõrk. Q2 2026 revenue $1,03b (+7,7%), comparable sales +5,8% = päris, aga `quantified_minor` + `mandate not_relevant` (CAKE muster). Hea ettevõte, aga tõend ei ole asümmeetriline ega ala-märgatud.
- *Challenger:* **ei sobi.** Hea, küps, adekvaatselt kaetud restoraniettevõte ei ole challenger domineeriva incumbent'i vastu. See on näide, **miks hea ettevõte ei pruugi olla challenger/asümmeetriline kandidaat** — kihi mõte pole „hea firma", vaid „väärhinnatud varajane".
- *`unknown`:* vähe; CAKE on hästi mõistetav.
- *Kas oleks aidanud:* jah, negatiivse kinnitusena — oleks kiiremini näidanud, et CAKE ei kuulu asümmeetria-koridori.

### HIMS — `researching`
- *Under-recognition:* võimalik, aga hägune.
- *Challenger:* narratiiv **on olemas** (D2C tervis vs traditsiooniline mudel), aga see on **liiga sõltuv omandatud vs orgaanilise kasvu lahtiharutamisest.** Ilma segment-/orgaanilise kasvu tõendita jääb `evidence_of_share_shift` suures osas `unknown`. See on aus test kihi distsipliinile: kui kasvu allikat ei saa tõendada, jääb challenger-hüpotees `unknown`, mitte `supported`.
- *Kas oleks aidanud:* jah — oleks sundinud eristama „kasvab" vs „võidab turuosa", mis on täpselt `researching` põhjus.

### ACHR — `rejected`
- *Under-recognition:* ainult tähelepanu-madalus (Growth 1, Health 30, Coverage 75) **ilma** paraneva tõendita → § 1.2 järgi mitte tähenduslik.
- *Challenger:* **tugev narratiiv (eVTOL vs status quo) ilma economicsita.** See on arhetüüpne juhtum, mida süsteem peab `skeptical`/`rejected` hoidma: `challenger_advantage_hypothesis` olemas, aga `evidence_of_customer_wins/backlog/unit_economics` ja `financial_confirmation` on `unknown`/puuduvad.
- *Kas oleks aidanud:* jah, kõige selgemini — kiht oleks näidanud vektorit, mis on üleni narratiiv ja `unknown`, kinnitades `rejected`. **Tugev narratiiv ilma economicsita on täpselt see, mida see kiht peab tõkestama, mitte võimendama.**

**Cohordi järeldus:** kiht oleks olnud kasulik peamiselt **negatiivse ja täpsustava kinnitusena** (CAKE ei ole asümmeetriline; ACHR on narratiiv ilma tõendita; HIMS vajab kasvu-allika tõendit), ja BW puhul positiivse „screen eksib" leidjana. Ükski juhtum ei nõudnud uut andmeallikat.

## 4.1 Under-recognition cohort validation (2026-08-12)

> **See on validation note, mitte implementatsioon.** Under-recognition kihti ei ehitatud: koodi, UI-d, DB-d, skeemi, filtreid ega skoore ei muudetud. Allolev on ainult kontroll, kas kontseptsioon seletab meie päris cohorti.

**Metoodika ja §1.2 diskrimineerija.** Rakendan §1 signaalid ja §1.2 reegli 2026-08-11 sprindi faktidele. Diskrimineerija:

> Under-recognition on **tähenduslik ainult siis, kui vähemalt üks tähelepanu-madaluse mõõde (a/b/c) on `strong` JA vähemalt üks tõend-paraneb mõõde (d/e/f) on `strong`, värske/joondatud sisendil.** Madal tähelepanu üksi = penny-stock / ignored-for-a-reason lõks.

**Kaks ausat piirangut kogu testis:**

- **Frequency behavior on kõigil viiel `unknown`.** v2 canonical seeria algas alles run'ist #17 (2026-08-12), seega signaal (c) ei saa veel eristada. Kogu diskrimineeriva töö teevad (a) attention, (b) market cap, (e) catalyst novelty — nagu § 7.5 ennustas.
- **Täpseid analyst coverage arve sprint ei fikseerinud.** Attention on hinnatud kvalitatiivselt (small-cap ADR vs high-profile nimi); täpne count jääb `unknown` (§ 1.1a: „puuduv kate ≠ null kate").

**API — Agora (ready · 81/92/93 · fresh/good)**
- *Analyst attention:* kvalitatiivselt **madal** (väike Hiina RTE-PaaS ADR, ~$391m cap); täpne count `unknown` → strong (a).
- *Market cap context:* ~$391m cap $366m likviidsuse ja $80m debt'i kõrval → väike implied EV → strong (b).
- *Catalyst novelty:* 6. järjestikune GAAP-kasumlik kvartal + Q1 revenue +13,5% = `material_new_evidence` → strong (e).
- *Frequency behavior:* `unknown`.
- *Under-recognition hypothesis:* **STRONG** — madal tähelepanu × paranev tõend värskel sisendil täidab §1.2 mõlemad pooled; `ready` tuli tõenäoliselt just under-recognition + improving fundamentals kombinatsioonist.

**BW — Babcock & Wilcox (researching · 100/67/100 · mixed/poor)**
- *Analyst attention:* ebaselge/keskmine, mitte selge attention-edge → attention-pool nõrk/unknown.
- *Market cap context:* väike/mid-cap, mitte selgelt ignoreeritud → weak (b).
- *Catalyst novelty:* backlog +533%, revenue +130%, Base Electron = `material_new_evidence` → strong (e).
- *Frequency behavior:* `unknown`.
- *Under-recognition hypothesis:* **PARTIAL** — tõend-paraneb pool tugev, aga põhineb `mixed/poor` alignment'il (2021 debt) ja ~47% suuremal aktsiate arvul → per-share pööret pole tõestatud, valuation-alus madala usaldusega → `researching`, mitte puhas edge.

**HIMS — Hims & Hers (researching · 59/35/58 · fresh/warning)**
- *Analyst attention:* **kõrge** (laialt jälgitud consumer-nimi) → weak (a).
- *Market cap context:* ei väike ega ignoreeritud → weak (b).
- *Catalyst novelty:* headline +38,2%, aga Eucalyptus'e omandamine saastab uudsuse → nõrk/uncertain (e).
- *Frequency behavior:* `unknown`.
- *Under-recognition hypothesis:* **EI** — tähelepanu kõrge; `researching` tuleneb tõendi kvaliteedist (orgaaniline vs omandatud), mitte tähelepanu-lõhest. Under-recognition ≠ „raske analüüsida".

**CAKE — Cheesecake Factory (rejected · 81/81/100 · fresh/warning)**
- *Analyst attention:* **kõrge** (suur, küps, hästi kaetud) → weak (a).
- *Market cap context:* väljakujunenud, adekvaatselt kaetud → weak (b).
- *Catalyst novelty:* revenue +7,7%, comp sales +5,8%, aga `quantified_minor` + mandate not_relevant → weak (e).
- *Frequency behavior:* `unknown`.
- *Under-recognition hypothesis:* **EI** — kukub läbi mõlemal §1.2 poolel (tähelepanu pole madal JA tõend pole inflekteeruv); hästi mõistetav, adekvaatselt hinnastatud.

**ACHR — Archer Aviation (rejected · 1/30/75 · fresh/warning)**
- *Analyst attention:* **kõrge** (hype'itud eVTOL story-stock) → weak (a).
- *Market cap context:* tuntud spekulatiivne nimi, $1,78b cash, mitte ignoreeritud → weak (b).
- *Catalyst novelty:* sertifitseerimine + partnerlused = sündmused, mitte materiaalne finantstõend (revenue $1,6m, burn $217,7m) → nõrk (e).
- *Frequency behavior:* `unknown`.
- *Under-recognition hypothesis:* **EI** — narratiiv on tugev just seetõttu, et tähelepanu on kõrge (hype). Under-recognition nõuab madalat tähelepanu + paranevat tõendit; §5 guardrail tõkestab loo, ei võimenda.

| Ettevõte | Under-recognized? | Otsustav põhjus |
|---|---|---|
| **API** | ✅ **Jah (strong)** | Madal tähelepanu + kasumlikkuse inflection värskel sisendil — §1.2 mõlemad pooled |
| **BW** | 🟡 **Osaliselt** | Tõend paraneb, aga `poor` alignment + ~47% dilution → madal confidence → `researching` |
| **HIMS** | ❌ **Ei** | Tähelepanu kõrge; `researching` tuleneb tõendi kvaliteedist, mitte tähelepanu-lõhest |
| **CAKE** | ❌ **Ei** | Kõrge tähelepanu + küps/minor tõend — hästi mõistetav, adekvaatselt hinnastatud |
| **ACHR** | ❌ **Ei** | Kõrge tähelepanu + narratiiv ilma economicsita; kontseptsioon tõkestab loo |

**Järeldus.** Under-recognition kontseptsioon **seletab cohorti järjekindlalt:** üks selge jah (API strong), üks kvalifitseeritud osaline (BW partial) ja kolm põhjendatud ei-d (HIMS, CAKE, ACHR no) — ja iga „ei" tuleb **õigel põhjusel** (kõrge tähelepanu vs narratiiv-ainult vs küps-adekvaatne), mitte ühesuguse tõrjena. See kinnitab §1.2 põhihüpoteesi: madal tähelepanu üksi ei kvalifitseeru, ja tõend ilma tähelepanu-lõheta ei ole edge. Aegrea-jalg (frequency, signaal c) ei lisanud veel midagi — see jääb `unknown`, kuni canonical seeria kasvab (§ 7.5). See ei muuda ehitusotsust: kiht jääb disainiks.

---

## 5. Guardrails

- **Hype ei tohi muutuda teemaks.** Ala-märgatus + narratiiv on kõrgeima hype- ja hindsight-riskiga pinnad; siin kehtivad kõik olemasolevad kaitsed (evidence tier, point-in-time, invalidation, fakt/järeldus/oletus eristus).
- **Narratiiv ei tohi asendada tõendit.** Iga challenger-väide kannab source/evidence või `unknown`. Vaba tekst ilma tõendita ei tõsta järjestuses.
- **Madal kate ei tähenda automaatselt võimalust.** Ilma paraneva tõendita on madal kate „ignored for a reason". Tähelepanu-madalus üksi ei kvalifitseeru (§ 1.2).
- **Väike market cap ei tähenda automaatselt upside'i.** Cap on tähelepanu-, mitte väärtusmõõt; penny-stock lõks välditakse nõudega, et Health ei signaali otsest ellujäämisriski ja et tõend on värske/joondatud.
- **Challenger vajab falsifitseeritavat checkpointi.** `invalidation_checkpoint` on kohustuslik; ilma selleta ei salvestu see challenger-teesina.
- **Kõik point-in-time salvestatav.** Kui implementatsioon kunagi tuleb, peab under-recognition vektor ja challenger-tõend salvestuma as-known-at-decision-time (nagu `discovery_decisions` sector/catalyst väljad), muidu tekib hindsight narrative-fitting — selle kihi halvim rike.

---

## 6. Mida praegu EI ehita

Selgelt väljaspool skoopi. Need **ei** kuulu praeguse töö keskmesse; võivad minna backlog'i eraldi otsusena:

- Seeking Alpha kloon;
- analyst rating kloon;
- dividend screener;
- insider trading moodul;
- smart-money / 13F tracker;
- theme taxonomy;
- valuation score;
- momentum / day-trading scanner.

See dokument katab **ainult** under-recognition proxy ja challenger-vs-incumbent kihi kontseptsiooni.

---

## 7. Väljund

### 7.1 Soovitatud data model V1 (ainult kontsept, mitte skeem)

Kaks point-in-time tõendiobjekti, mõlemad versioonitud ja `unknown`-lubavad, salvestatuna otsusehetkel (kontseptuaalselt `discovery_decisions` laiendus või paralleelne kiht — **mitte praegu loodav**).

**Under-recognition vektor (per decision, per point-in-time):**

| Väli | Required / Optional / Unknown |
|---|---|
| attention_analyst_coverage | Optional; `unknown` kui consensus puudub |
| attention_market_cap_percentile | Optional; `unknown` kui grupp < 5 |
| attention_frequency_trend (low_rising / stable / high / unknown) | Optional; `unknown` kui < 5 canonical päeva |
| evidence_price_reaction (muted / reacted / unknown) | Optional; `unknown` kui hinnaandmeid tõendi ümber napib |
| evidence_catalyst_tier (viide olemasolevale) | Optional; `unknown` kui catalyst arvutamata |
| evidence_financials_improving (viide Growth/Health + Freshness) | Optional; `unknown` kui Coverage madal |
| meaningful (tuletatud reegel § 1.2, mitte skoor) | Required kuvamiseks; võib olla `false` |

**Challenger tõend (per decision, per point-in-time):**

| Väli | Required / Optional / Unknown |
|---|---|
| category_being_challenged | Optional; `unknown` |
| reference_company (incumbent) | Optional; `unknown` |
| challenger_advantage_hypothesis | Required kui objekt olemas; märgistatud kui **kasutaja hüpotees** |
| evidence_share_shift | Optional; `unknown` |
| evidence_product_progress | Optional; `unknown` |
| evidence_customer_wins_backlog_partnerships_unit_economics | Optional; `unknown` |
| financial_confirmation (viide Growth/Health/Catalyst) | Optional; `unknown` |
| invalidation_checkpoint | **Required** — ilma selleta ei salvestu challenger-teesina |
| source_ref iga tõendivälja kohta | Required iga mitte-`unknown` väite kohta |

`unknown` on lubatud kõikjal peale `invalidation_checkpoint` (challenger) ja `meaningful` (under-recognition).

### 7.2 Millised olemasolevad tabelid/vaated seda tulevikus kasutaksid

- **`discovery_decisions`** — point-in-time salvestus (sama muster nagu sector-relative ja catalyst väljad; ajaloolisi ridu ei backfillita).
- **Discovery Frequency V1** — `attention_frequency_trend` sisend tuleb otse canonical frequency ajaloost.
- **Validation / Backtest** — mõõdaks canonical-only, kas under-recognition/challenger-lipuga kandidaadid tõesti käitusid asümmeetriliselt (hit rate / excess return lipu järgi).
- **Thesis Builder** — `challenger_advantage_hypothesis` → `mispricing`; `invalidation_checkpoint` → `invalidation` + 12 kuu kontrollpunkt.
- **Data Freshness / Period Alignment** — värvib „improving financials" usaldusväärsuse.

### 7.3 Minimaalne implementatsioon hiljem (kui otsus tuleb)

Väikseim aus samm oleks **ainult point-in-time salvestus**, ilma järjestust muutmata: arvuta ja salvesta vektor iga canonical discovery decision'i juurde, kuvamata seda esialgu kandidaadikaardil ja mõjutamata rank'i. See kogub märgistatud ajalugu, mida backtest saab hiljem valideerida, ilma et UI või filtrid muutuksid. Järjestuse/lääts-vaate lisamine tuleb alles pärast seda, kui backtest näitab, et lipp eristab tulemusi.

### 7.4 Suurim risk, kui valesti ehitada

**Hindsight narrative-fitting.** Kui under-recognition/challenger-tõendit ei salvestata point-in-time, hakkab süsteem tagantjärele sobitama narratiivi võitjatele („muidugi ta oli ala-märgatud challenger") — survivorship bias kõige mürgisemal kujul. Teine suur risk: kihist saab de-facto koondskoor (nt „meaningful + challenger = osta"), mis rikub kogu „kõrge skoor = uuri, mitte osta" põhimõtte. Mõlemad välditakse ainult range evidence-vektori ja point-in-time distsipliiniga.

### 7.5 Kas oodata rohkem canonical frequency andmeid?

**Jah — oota.** Kaks under-recognition tugevaimat signaali (`attention_frequency_trend` madal-aga-tõusev ja `evidence_price_reaction` muted uue tõendi järel) **eeldavad canonical aegrida**. 2026-08-12 seisuga on v2 canonical seeria alles alguses (persistence-loendur algas run'ist #17), seega need signaalid oleksid praegu valdavalt `unknown` ja kiht ei annaks usaldusväärset eristust.

Soovitus: **enne interpreteerivat implementatsiooni oota vähemalt 5, eelistatult 10 canonical päevajooksu** (sama lävi nagu Frequency V1 tõlgendusel) ja vähemalt 20 ettevõtte või 70% SEC/score katvust. Vahepealne lubatud samm on ainult § 7.3 point-in-time salvestus, mis ei tõlgenda ega järjesta, vaid kogub ausat ajalugu tulevaseks backtestiks.
