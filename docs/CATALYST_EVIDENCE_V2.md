# Catalyst Evidence V2 — disain

Kuupäev: 2026-08-12
Staatus: **disain, koodi ei ole muudetud.** Ükski olemasolev filter, score, skeem ega provider selle dokumendi põhjal veel ei muutu.

Alus: [`FUNNEL_AUDIT.md`](FUNNEL_AUDIT.md) read-only audit, [`RESEARCH_SPRINT_2026-08-11.md`](RESEARCH_SPRINT_2026-08-11.md) viie ettevõtte manual cohort (API, BW, CAKE, HIMS, ACHR) ning 2026-08-11 valminud `data-quality-v1` kiht. Uusi andmeallikaid ei eeldata.

## 1. Probleem, mida V2 lahendab

Praegune `catalystCriterion` on boolean hard gate:

- earnings kuni 45 päeva ette → `supported`;
- SEC sündmus kuni 30 päeva tagasi → `supported`;
- uudis kuni 14 päeva tagasi → `uncertain`;
- muidu `missing` ja ticker **välistatakse**.

See mõõdab ainult ühte asja: kas andmebaasis on kirje ajaaknas. Cohort tõestas mõlemat viga korraga.

**False negative (tõendatud).** BW ja CAKE olid ainsad, mis kukkusid välja *ainult* catalyst'i tõttu, kuigi mõlemal oli päris primaarallika sündmus: BW Q2 2026 revenue $319,7m (+130%), backlog $2,6b (+533%), Base Electron $100,7m; CAKE Q2 2026 revenue $1,03b (+7,7%), comparable sales +5,8%, operating margin 6,8% → 7,6%. Viga oli sündmuste kogumises ja semantikas, mitte ettevõtete sündmusetuses.

**False positive (tõendatud stress-testina).** PLUG Growth 71 / Coverage 100 läbiks kõik baasfiltrid ja vajaks ainult üht suvalist pealkirja, kuigi salvestatud tõend näitab revenue +2,5%, sügavalt negatiivset OCF-i ja FCF-i, aktsiate arvu +21% ning 2024. aasta debt-sisendit, mis jääb ettevõtte uusimast score-sisendist 675 päeva maha.

Järeldus: gate ei erista **sündmust**, **tõendit** ja **katalüsaatorit**.

## 2. Mis on catalyst?

Kolm eraldi mõistet, mida praegu koheldakse ühena:

| Mõiste | Definitsioon | Praegune allikas |
|---|---|---|
| **Sündmus (event)** | Millegi toimumine dateeritud hetkel. | `earnings_events`, `sec_events`, `news_items` |
| **Tõend (evidence)** | Sündmus kannab kontrollitavat numbrit või fakti, mis muudab teadmist. | `financial_facts` uus periood, filing'u sisu, IR-teate number |
| **Katalüsaator (catalyst)** | Tõend puudutab konkreetse teesi avatud küsimust või invalidation-tingimust. | puudub |

**V2 definitsioon.** Catalyst on dateeritud ja allikaga seotud tõend, mis muudab teesi tõendibaasi: kas teeb varem tõendamata väite mõõdetavaks/tõendatuks või muudab 12 kuu kontrollpunkti täitumise tõenäosust või ulatust.

Catalyst **ei ole**: kirje olemasolu andmebaasis, tulevane earnings-kuupäev, pealkiri ilma numbrita, korduv rutiinne filing, sotsiaalmeedia tähelepanu ega hinnaliikumine.

## 3. Millal on catalyst thesis-relevant?

Viis mõõdet, iga mõõde eraldi salvestatud ja igal on lubatud `unknown`. Ükski neist ei tohi tuletuda hinnast ega tähelepanust.

1. **Materiality** — kas sündmus muudab numbrit, mis on ettevõtte mastaabis oluline? Nõuab kogust *ja* võrdlusbaasi. BW: Base Electron $100,7m kvartali $319,7m revenue'st = 31% → `quantified_major`. ACHR Boeing/Wisk 8-K: kvantifitseeritud economics puudub → `unquantified`.
2. **Direction** — `improving`, `deteriorating`, `mixed`, `unknown`; tuletatud sündmuse enda faktidest. HIMS Q2: revenue +38,2%, kuid gross margin 73% → 65%, GAAP net loss ja omandatud kasv → `mixed`, mitte positiivne.
3. **Source quality** — `primary_sec` > `primary_ir` > `secondary_news` > `social`. Pealkiri ei ole tõend.
4. **Novelty** — kas info on uus võrreldes eelmise sama liiki sündmuse ja seda sisaldanud score-snapshot'iga: `new_information`, `confirms_known`, `repeat_of_prior_event`.
5. **Thesis-relevance** — `decisive`, `supporting`, `adjacent`, `not_relevant`; koos viitega konkreetsele avatud küsimusele või invalidation-klauslile. ACHR sertifitseerimise Phase 3 sulgemine on mandaadi mõttes asjakohane, kuid ei puuduta otsustavat avatud küsimust (commercial economics) → `adjacent`.

Eraldi ja tahtlikult lahus: **mandate-relevance**. CAKE tõestas, et „hea ettevõtte sündmus” ja „selle asümmeetria mandaadi jaoks relevantne sündmus” on kaks eri asja.

**Reegel.** Catalyst on thesis-relevant ainult siis, kui materiality on kvantifitseeritud **või** tegu on primaarallika avaldusega, mis vastab nimetatud avatud küsimusele; **ja** direction ei ole `unknown`; **ja** novelty on `new_information`.

## 4. Kuidas eristada earnings date'i päris katalüsaatorist?

See on praeguse gate'i kõige suurem semantiline viga: „earnings 45 päeva pärast” saab kõige tugevama staatuse `supported`, kuigi midagi pole veel juhtunud, midagi pole loetud ja suund on teadmata.

V2 eristab kaht liiki:

- **`scheduled_window`** — kuupäev on teada, tõendit ei ole. Maksimaalne staatus `pending`. See ei õigusta kaasamist ega järjestust; see ütleb ainult, **millal vaadata**. Koht on „mida jälgida” väljal.
- **`disclosed_evidence`** — filing või ettevõtte avaldus on olemas ja sellega saab siduda numbri: uus `financial_facts` period_end, konkreetne 8-K item või IR-teate kvantifitseeritud fakt.

Kolm kontrolli, mis muudavad kuupäeva tõendiks:

1. **Fact-sidumine.** Sündmus loeb tõendiks alles siis, kui sellega saabus uus `financial_facts` periood (BW Q2: net income pöördus positiivseks, kuue kuu OCF $0,4m). Ilma selleta on „filing eksisteerib” endiselt ainult sündmus.
2. **Perioodikontroll `data-quality-v1` kaudu.** Kui tänase kuupäevaga sündmuse juures on endiselt vana period_end, on tegu aruandlussündmusega, mitte uue majandustõendiga. Värske pressiteade ei tohi aegunud tõendibaasi üles hinnata.
3. **`expected_but_unconfirmed`.** Kui earnings-kuupäev on möödas, aga uut perioodi ei ilmunud, on see **kogumislünk**, mitte ettevõtte sündmusetus. Täpselt see olukord peitis BW ja CAKE Q2 tõendid 2026-08-11 canonical run'is; V2 peab selle nähtavaks tegema, mitte tickerit vaikselt välja viskama.

## 5. Andmemudel

Täiendav ja pöörduv. `scores-v1`, Coverage tähendus, `financial_facts`, `discovery_runs` idempotentsus ja olemasolevad otsuseread jäävad muutumata. Vaatlus ja hinnang on **eraldi**, et ümberhindamine ei kirjutaks kunagi vaatlust ümber.

### `catalyst_events` — vaatlus (idempotentne)

| Väli | Sisu |
|---|---|
| `company_id` | olemasolev FK |
| `event_kind` | `earnings_scheduled` \| `earnings_disclosed` \| `sec_filing` \| `company_release` \| `news_headline` |
| `occurred_at` | sündmuse kuupäev; tulevik/minevik tuletatakse vaatlushetkest |
| `source_kind` | `primary_sec` \| `primary_ir` \| `secondary_news` \| `social` |
| `source_ref` | viide olemasolevale reale: `sec_events.id`, `earnings_events.id`, `news_items.id` |
| `url`, `accession_number` | olemasolevast allikast, kui on |
| `headline` | kogutud kujul, ei kirjutata ümber |
| `linked_fact_ids` | `financial_facts` read, mis selle avaldusega saabusid — sild sündmuselt tõendile |
| `linked_period_end`, `period_kind` | uusim periood, mille avaldus tõi |
| `first_seen_at`, `last_seen_at` | novelty ja idempotentsus |

Unikaalsus: `(company_id, event_kind, source_ref)` — korduskogumine ei tekita duplikaati.

### `catalyst_assessments` — versioonitud hinnang

| Väli | Sisu |
|---|---|
| `catalyst_event_id` | FK vaatlusele |
| `assessment_version` | nt `catalyst-evidence-v2` |
| `materiality` | `quantified_major` \| `quantified_minor` \| `unquantified` \| `unknown` |
| `materiality_basis`, `materiality_ratio` | tekstiline põhjendus + suhtarv, nt „$100,7m / $319,7m = 31%” |
| `direction` | `improving` \| `deteriorating` \| `mixed` \| `unknown` |
| `novelty`, `prior_event_id` | `new_information` \| `confirms_known` \| `repeat_of_prior_event` \| `unknown` |
| `thesis_relevance`, `relevance_target` | tase + viidatud avatud küsimus või invalidation-klausel |
| `mandate_relevance` | teesist eraldi: kas sobib preset'i mandaadiga |
| `evidence_freshness` | `data-quality-v1` väljund seotud perioodi kohta |
| `assessed_by`, `assessed_at`, `notes` | `rule` \| `user`; kasutaja hinnang on **uus rida**, mitte muudatus |

### Tuletatud seis (persisteeritakse otsuse hetkel)

`evidence_status`: `material_new_evidence` \| `weak_or_unconfirmed` \| `scheduled_only` \| `none_recorded` \| `collection_gap`, koos `strongest_event_id`, `next_scheduled_at` ning olemasolevas stiilis `reasons[]` / `unknowns[]`.

### Mõju discovery kihile

- Catalyst ei ole enam kaasamise eeltingimus. Kriteerium jääb nähtavaks: `supported` ainult `material_new_evidence` korral; `uncertain` weak/unconfirmed/scheduled_only korral; `missing` või `unknown` ülejäänu korral — ja `collection_gap` peab olema visuaalselt eristatav „ettevõttel polnud sündmusi” olekust.
- Järjestus jääb leksikograafiline ja koondskoorita, catalyst lisandub ühe astmena: toetatud kriteeriumide arv → catalyst evidence tier → Growth → Coverage → Health → ticker. Nii asendub hard gate rank-sisendiga, mitte uue läbipaistmatu skooriga.
- `discovery_decisions` saab otsusehetke catalyst-väljad (evidence_status, tugevaim sündmus, materiality, direction, novelty, relevance, freshness). Uued read ainult; ajaloolisi otsuseid ei backfillita — sama muster nagu sector-relative V1.
- Mudeliversioon tõuseb (`rklb-discovery-v2`), sest kaasamisreegel muutub. Frequency/persistence statistika ei tohi v1 ja v2 run'e ühe loona võrrelda.

## 6. Kuidas BW ja CAKE juhtumid muutuksid?

**BW — praegu: välistatud ainult catalyst'i tõttu, kaardil nähtamatu.**

V2-s: Q2 2026 10-Q + IR-teade → `earnings_disclosed`, `primary_sec`/`primary_ir`, `linked_fact_ids` sisaldab Q2 fakte → `novelty = new_information`; `materiality = quantified_major` (revenue +130%, Base Electron 31% kvartali revenue'st, backlog $2,6b); `direction = mixed` (kuue kuu OCF +$0,4m, FCF endiselt −$13,4m, aktsiate arv +47%); `thesis_relevance = decisive` (puudutab otse checkpoint'i „kas backlog konverteerub ilma marginaali kokkuvarisemiseta”).

Tulemus: BW on kandidaat, mille kaart ütleb korraga kolme asja — päris materiaalne uus tõend, segune suund ning `mixed/poor` andmekvaliteet 2021. aasta debt-sisendi tõttu. See on täpselt inimese `researching` otsus. Süsteem lõpetab peitmise ja alustab kirjeldamist.

Kui collector ei ole Q2 filing'ut endiselt sisse lugenud, peab V2 näitama `collection_gap`, mitte „katalüsaatorit pole”.

**CAKE — praegu: välistatud ainult catalyst'i tõttu; hiljem inimese poolt põhjendatult rejected.**

V2-s: `materiality = quantified_minor` (revenue +7,7%, comps +5,8%, margin +0,8pp $5,6b market cap'i juures), `direction = improving`, allikas primaarne, `novelty = new_information`, `thesis_relevance = supporting`, kuid `mandate_relevance = not_relevant`.

Tulemus: CAKE muutub kaasatavaks, aga madalalt järjestatuks, ning kaart ütleb sõnaselgelt, et sündmus on päris ja positiivne, kuid ei rahulda asümmeetria mandaati. Inimene lükkab selle endiselt tagasi — aga õigel põhjusel ja pärast nägemist, mitte kogumislünga tõttu.

## 7. Kuidas vältida PLUG tüüpi false positive'eid?

Kaheksa kaitset, kõik olemasoleva andmestiku põhjal:

1. **Pealkiri ei tõsta staatust.** `news_headline` koos `secondary_news`/`social` allikaga ei ületa kunagi `uncertain` taset, ükskõik kui värske see on.
2. **Materiality nõuab numbrit ja baasi.** Kvantifitseerimata sündmus jääb `unquantified` → evidence tier ei jõua `material_new_evidence`-ni. „8-K eksisteerib” lõpeb `weak_or_unconfirmed` juures.
3. **Direction tuleb avalduse faktidest, mitte sündmuse olemasolust.** Revenue +2,5%, negatiivne OCF/FCF ja +21% aktsiaid annavad `mixed`/`deteriorating`; sellist catalyst'i ei saa esitada positiivse uurimispõhjusena.
4. **Freshness-kontroll `data-quality-v1` kaudu.** PLUG stale debt (2024, span 675 päeva) piirab hinnangut: värske teade ei tohi aegunud tõendibaasi üle hinnata.
5. **Novelty eelmise sündmuse vastu.** Korduv rutiinne 8-K, järjekordne rahastus või sama teate kordus → `repeat_of_prior_event` / `confirms_known`, ilma tõsteta. See takistab „sündmuste jooksuraja” ettevõtete püsivat katalüütilisena näimist.
6. **Vastutõend kõrvuti catalyst'iga.** Dilution ja burn peavad olema samas plokis: sündmus ei tohi kunagi ilmuda ilma oma vastutõendita.
7. **Ranking, mitte uus gate.** Nõrga tõendiga PLUG sorteerub BW ja API alla, mitte ei muutu pealkirja peale eligible'iks. Hard gate'i ei asendata teise hard gate'iga.
8. **`unknown` on täieõiguslik tulemus.** Materiality ja direction ei tohi vaikimisi olla positiivsed. ACHR õppetund — „uudise olemasolu võib narratiivi tugevdada ka siis, kui investeerimisriski alus ei muutu” — muutub modelleeritud olekuks.

## 8. Valideerimine olemasoleva cohort'iga

Cohort annab loomuliku märgistatud testhulga, ilma uut andmestikku kogumata. Reeglid loetakse kalibreerituks, kui V2 annab need kuus tulemust:

| Ticker | Oodatav evidence tier | Miks |
|---|---|---|
| API | `material_new_evidence`, improving | Q1 2026: revenue +13,5%, kuues järjestikune GAAP-kasumlik kvartal, ADS buyback |
| BW | `material_new_evidence`, mixed | Q2 backlog/Base Electron kvantifitseeritud, kuid FCF negatiivne ja dilution suur |
| CAKE | `material_new_evidence`, improving, mandate `not_relevant` | päris positiivne sündmus, vale mandaadi jaoks |
| HIMS | `material_new_evidence`, mixed | +38,2% revenue koos margin 73% → 65% ja omandatud kasvuga |
| ACHR | `weak_or_unconfirmed`, relevance `adjacent` | sündmus on päris, commercial economics kvantifitseerimata |
| PLUG | `weak_or_unconfirmed` | false-positive stress-test: pealkiri ei tohi kvalifitseeruda |

## 9. Teadlikult välja jäetud

- Uus väline provider, API-võti või sentiment/NLP pealkirjade skoorimine numbriks.
- Läbipaistmatu koondskoor („catalyst tugevus 1–10”).
- Automaatne teesi kirjutamine sündmuse põhjal.
- Ajalooliste `discovery_decisions` ridade backfill või ümberkirjutamine.
- Igasugune muudatus `scores-v1`, Coverage'i, Growthi või Financial Healthi valemites.

## 10. Avatud küsimused enne ehitamist

- Kes annab `thesis_relevance` väärtuse enne teesi olemasolu: mandaaditaseme reegel, kasutaja või mõlemad kihina?
- Kuidas tuvastada IR-teadet ilma uue provider'ita? Praegu on ainus tee `news_items` pealkiri + `sec_events` filing; see piirab `primary_ir` katvust ja see piirang tuleb ausalt kuvada.
- 45 / 30 / 14 päeva aknad tuleb ümber mõtestada: pärast tier'ide kasutuselevõttu peaksid need kehtima `scheduled_window` ja novelty kohta, mitte kaasamise kohta.
- Kas `mandate_relevance` reeglistik peab olema preset'i osa (RKLB mandaat) või eraldi versioonitud objekt, kui hiljem lisandub teine preset.
- Kust tuleb `linked_fact_ids` seos praktikas: accession number `financial_facts` ridade juures on olemas, kuid IR-teate ja filing'u sidumine vajab reeglit, mis ei tohi olla pealkirja sõnesobitus.
