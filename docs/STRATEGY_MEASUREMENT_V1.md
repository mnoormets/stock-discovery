# Kahe protokolli mõõtmiskiht — 10. november 2026

## Tööjärjekorra parandamine

Kasutaja teine review on vastu võetud: olemasolev fail, funktsioon või läbitud tarkvaratest ei tõenda investeerimiseelist. Eelmise review „osa on juba olemas” märkused kirjeldasid teostust, mitte kasulikkust. Valuation'i, artiklisisu, insider'i ega sotsiaalse tähelepanu mõju kuludega puutumata tulemustele ei ole selle olemasoluga näidatud.

See tarne peatab järgmise AI-skoori, täiendavate skoorikomponentide ja seitsme paralleelse strateegia ehitamise. Fookus on **Strategy Protocol Registry + Outcome Coverage Audit** kahele fikseeritud uurimishüpoteesile. Kapitalikonto, Today skoor/valik, ostureeglid ja riskipiirid ei muutu. Ühtegi paber- ega pärisostu ei aktiveerita.

## Parandusrevisjonide ajalugu

Hüpoteesi ID-d jäävad fundamental_growth_v1 ja dated_news_event_v1; nende eraldi **version** väli on praegu 2. See ei ole uue läve või võitnud variandi valik. Esimene revisjon/audit #124 ja täpne lähtekood commit'is 5b8a8a9 jäävad alles. Revisjon 2 parandab kaks kontrollitud teostusviga: olemasolevad Yahoo NasdaqGS/GM/CM nimed olid liialt kitsast loendist väljas ning täpselt 5% basic-shares'i kasv võis IEEE754 ümarduse tõttu üle piiri näida. Mõlemad hüpoteesid said uue source-bound räsi; vana registrit ega auditit ei kirjutatud üle.

Varasema lähtekoodiga kohort näitab oma salvestatud auditit koos nähtava hoiatusega, mitte tänase mootoriga ümberarvutatud tulemust. Vaikimisi jälgitakse esimese **aktiivse revisjoni** prospektiivset kohorti; vanemad kohordid jäävad valitavaks. Kogu kasumieesmärgi ajalugu ega algset tähtaega see ei muuda.

## Protokollid ja ette määratud reeglid

Täielikud masinloetavad definitsioonid:
- [fundamental_growth_v1](../research/protocols/fundamental_growth_v1.json)
- [dated_news_event_v1](../research/protocols/dated_news_event_v1.json)
- [JSON Schema](../research/protocols/schema.json)

| Omadus | fundamental_growth_v1 | dated_news_event_v1 |
|---|---|---|
| Hüpotees | Sama filing'u USD käibekasv vähemalt 25%, sama perioodi positiivne OCF ning võrreldavate basic-shares'i kasv kuni 5%. | Selle kogumise ajal esimest korda kätte saadud ametlik SEC 10-Q/10-K/20-F/40-F sündmus, kontrollitud CIK/Archives URL ja varasema sama CIK/vormi/filing-kuupäeva korduse kontroll. |
| Dilution'i piir | Eelregistreeritud 5%; sama tag/taxonomy/ühik, kuni aasta vanune current point. See on issuer'i basic-share proxy, **mitte tõend fully diluted share count'i ega share-class/ADS samaväärsuse kohta**. Puudumine välistab, ei muutu nulliks. | Ei lisa fundamentaalfiltrit. |
| Sündmuse tähendus | Ei eelda, et kõrge kasv teeb aktsia odavaks. | financial_report_filed; suund, surprise ja materiality jäävad **Unknown**. Uus rakendusele ei tähenda turule ootamatut või positiivset uudist. Artikli pealkiri/ekstraheeritud väide ei kvalifitseeru primaarallika kinnituseks. |
| Horisondid | 60 ja 120 kauplemispäeva | 1, 5 ja 20 kauplemispäeva |
| Benchmark | Külmutatud USD market cap alla $2 mld: IWO; muidu QQQ. | Sama size-piir: IWM; muidu SPY. |
| Puuduv market cap | Benchmark määramata, võrreldav tulemus puudub. | Sama; mugavat SPY asendust ei kasutata. |
| Täitmise algus | Alles pärast otsuse külmutamist, päris NYSE tavaseansil; esimene sobiv hilisem quote kuni kolme sessiooni aknas. | Sama; filing'u kuupäevast ei tehta tagasiulatuvat südaöö signaali. Tegelik kättesaamisaeg on konservatiivne teadmise piir. |
| Entry hind | Positiivne USD Yahoo quote, market_at enne/koos captured_at'iga, kuni 20 min hilinemist; hinnavaatlus, mitte order. | Sama. |
| Horisondi hind | Esimene sobiv hind täpselt N-ndal järgneval sessioonipäeval. Kui see puudub, ei võeta hilisemat võitjahinda asemele. Benchmark'i entry ja endpoint kuni 5 min samast stock-quote'ist. | Sama. |
| Kulud | Sõltumatu $1000 arvestusbaas, $1 külje kohta ja 5 bps külje kohta; **valideerimata eeldus**, spread/impact Unknown. | Sama. |
| Järjestus | Käibekasv kahanevalt, ticker/CIK viik; kõik eligible rank'id säilivad. | Värskem kinnitatud receipt enne, ticker/CIK viik. |
| UI | Kuni kuus eligible uurimisvaatlust protokolli kohta. Ülejäänud on eligible_ui_cap_excluded, mitte ineligible. | Sama. |
| Corporate action | Kõik unverified. Verifitseeritud võrreldava tulemuse arv jääb nulli; raw hinnapaari ei loeta kasumiks. | Sama. |

Need benchmark'id on fikseeritud size/style proxy'd, mitte täpsed sector/matched-control mudelid ega dividendidega total-return tõend. Lävesid ei otsita ega muudeta tulemuste järgi selles töös. Vana konto kahjum/riskipeatus ja möödunud eesmärgi tähtaeg säilivad.

## Täielik külmutatud nimetaja

Iga uue kogumise juures säilib kogu kehtiv SEC USA börside ticker-inventar ning kõik varem salvestatud või selles kogumises hinnatud nimed. Üksnes UI-s nähtavad, hinnaga või finantsandmetega nimed ei määra universumit.

- Puuduv common-stock klassifikatsioon, issuer'i identiteet, finantsfakt, benchmark või tulevane hind jääb põhjusega nimetajasse.
- Varem nähtud nimi jääb alles ka siis, kui see puudub tänasest inventarist. See märgitakse inventarist puuduvaks; **ei oletata automaatselt delisting'u põhjust**.
- CIK on püsiv issuer'i ID, mitte FIGI ega aktsiaklassi püsiv ID. Tickeri/CIK vastuolud jäävad eraldi identiteedikirjeteks; raport näitab nii liikmekirjete kui erinevate tickerite/issuer'ite arvu.
- SEC inventari tõrke või tühja vastuse korral märgitakse partial_inventory, mitte täielik turg. Täielik inventarinimekiri ei tähenda täielikke common-stock ega finantsandmeid.
- Iga rea juures säilivad avastamise alus, eligibility/signal/reference/earliest-executable ajad, komponendid ja puudumised, faktide ID/tag/periood/ühik/filing/tegelik DB teadmise aeg, allikad, rank, välistamispõhjused ja benchmark.
- Kõik uued protokollid on signal-study-only; ineligible nimede hilisemad hinnad on **kontrollvaatlused**, mitte tagantjärele ostud.
- Kogumised on korduvate issuer'itega panel. Eri päevade sama issuer'i vaatlused ei ole sõltumatud tehingud. Raport vaikimisi järgib esimest aktiivse revisjoni prospektiivset kogumist; see ei vali tagantjärele parimat kohorti.
- Hilisemad parandatud finantsandmed ei muuda külmutatud signaali. Quote/identiteedi puudumine või muutus ei tohi tekitada väljamõeldud tootlust.

## Registri ja replay leping

Lisav migratsioon [0014](../db/migrations/0014_research_strategy_measurement.sql) loob:
1. research_protocols: immutable ID/version/JSON/source manifest/version hash ja registreerimise aeg.
2. research_universes: kogu nimetaja ja kasutatud sisendid koos source hash'iga.
3. research_strategy_snapshots: kummagi protokolli kõik read, järjestus ja snapshot hash.
4. research_outcome_audits: as-of raport koos hash'iga; sama collection/as-of kordus on idempotentne ning vastuoluline kordus ei kirjuta vana üle.

Kõik neli on append-only DB trigger'itega. Strateegia versiooniräsi seob definitsiooni ja tegelike signaali-, andmevaliku-, kalendri- ning outcome-moodulite lähtekoodi. Reeglit või seotud lähtekoodi ei saa sama registreeritud versiooni all vaikselt muuta; uus versioon peab säilitama vana ajaloo. LF/CRLF normaliseeritakse, et Windows/CI annaks sama räsi.

Registreerimine toimub **enne** uue collection'i algust. Snapshot tehakse selle töö ajal; terminalse ajaloolise collection'i külge ei ehitata uut prospektiivset katset. Taastootmine toimub ainult külmutatud input'ist, mitte hetke finantsandmete uuesti lugemisest.

## Raport ja kasutamine

App: /research/strategy-coverage, link Today allikate juures.

Signaaliuniversum külmutatakse iga uue kogumisega automaatselt. **Salvestatud outcome-raportit uuendab selles tarneversioonis CLI --record; vaate avamine seda ei arvuta ega uuenda.** Vaade näitab alati auditi as-of aega. Hinnad tulevad olemasolevatest kogumistest; audit ei tee hinnapäringuid.

CLI vaikimisi **read-only**:

```powershell
node scripts/audit-strategy-coverage.cjs
node scripts/audit-strategy-coverage.cjs --collection COLLECTION_ID --output audit.json
node scripts/audit-strategy-coverage.cjs --collection COLLECTION_ID --as-of ISO_TIMESTAMP --record --output audit.json
```

--record lisab üksnes muutumatu mõõtmisraporti. See ei käivita kogumist, quote-fetch'i ega tehinguid.

Raport vastab:
- kui palju kogu nimetajast jõuab inventari, kontrollitud issuer'i/common-equity, teadaolevate komponentide, eligibility, benchmark'i ja entry-vaatluse etapini;
- eligible/ineligible ja UI-cap-excluded arvud eraldi;
- stock-quote, benchmark'i hinnapaari ja verifitseeritud võrreldava tulemuse katvus eraldi;
- outcome pending vs unavailable, kauplemispäeva tähtaeg ja puudumise põhjus;
- sama katvus rank'i, market-cap rühma ja protokolli järgi;
- signaali replay ja definitsiooni/source hash'i kontroll;
- puuduvate sisendite ja võimaliku selection bias'i nähtavus.

Tulemuste hinnastamine kasutab ainult juba kogutud hindasid, mitte uut mugavat hinnapäringut ainult võitjatele. Olemasolevaid quote-/finants-/ajalooeelarveid ei suurendata. Seetõttu võib välja tulla suur katvuspuudus — see on auditi tulemus, mitte lubadus, et kõigil nimedel tekib hind. Toorhinnapaari modelleeritud excess võib olla diagnostiline, kuid corporate-action'i või täitmiskulude ebakindlusega tulemust ei krediteerita algse kasumieesmärgi täitmiseks.

## Esimese pärisauditi konkreetne leid

Kogumine #124 külmutas 7618 SEC inventarikirjet ja 7736 identiteedikirjet / 7735 erinevat tickerit. Inventari 1025 issuer-iga seotud liikmest 1008-l puudusid kohalikus companies vahemälus quote_type ja exchange. Kümnel olemasoleval Nasdaq equity-kirjel oli tüüp/valuuta olemas, kuid revisjoni 1 kontroll ei tunnistanud provideri pikka börsinime; see on parandatud revisjonis 2, teadmata väärtusi ei täidetud oletusega.

Koodis on konkreetne andmevoo lünk: Yahoo fetchFundamentals säilitab researchQuote.quoteType/exchange, kuid saveCollectedCompanies/saveFundamentalsSnapshot'i senised salvestusteed annavad ettevõttele börsi nullina ning equity tüübi asemel valdavalt nulli (fondi ETF-erand säilib). See aitab selgitada vahemälu puudulikkust; ei tõenda, et kõigi 1008 nime kohta on tänases kogumises värske klassifikatsioon olemas. Järgmine parandussuund on olemasolevate allikate kontrollitud metadata kadudeta edasiandmine uutes vaatlustes, mitte uus AI-skoor ega vana ajaloo täitmine tänaste teadmistega.

## Mis jääb järgmiseks, pärast seda alust?

1. Lahendada auditis nähtud ajastuse, hinna/benchmark'i või identiteedi katvus enne tulemuste võrdlemist. Mitte lisada uut skoori, et puuduvat tulemust varjata.
2. Artikli extraction correctness, entity/event linking ja tegeliku allikasõltumatuse kontroll.
3. Eraldi käsitsi märgendatud artiklivalim; kasutaja pakutud ~200 artiklit ja issuer 98% / numbrid-ühik 95% / macro-F1 0,85 / duplicate precision 95% / vale-positiivne suund alla 5% on kavandatavad QA väravad, **mitte saavutatud näitajad ega kasumlikkuse tõend**. Selles töös ei loodud automaatselt „inimese” märgendeid.
4. Alles siis puutumata valimil sama universumi/timing'u/benchmark'i/kuludega ablation: momentum, finantskasv, finantskasv+pealkiri, finantskasv+artiklitõend. Ühtki neist uutest variantidest ei valita selle tarne tulemuste järgi.

Tõendusastmed jäävad eraldi: **kood olemas → runtime toimib → sisendid/katvus mõõdetud → analüüsi kvaliteet kontrollitud → lisanduv kuludega out-of-sample väärtus**. Artiklite kuue teksti lugemine tõendas ainult esimesi astmeid. Praegune raport võib näidata Unknown/puudulikku katvust; piisava katvusega tulevane katse peab lubama ka järeldust „edge'i ei leitud”.

## Testid ja tegeliku kogumise audit

Lõplik kontroll: **105 faili / 695 testi läbisid, 478,62 s**. Lint hoiatusteta; typecheck/build exit0; build23/23. Pärast testide lõppu app taaskäivitatud. Praegune raport, ajalooline #124 ja Today HTTP200; tegeliku DOM-i iga coverage-maatriks vastab salvestatud auditi täielikule nimetajale. Kõik11 kontrollitud konto/tehingu/registri/snapshot/audit tabelit jäid GET kontrollides muutmata. Ajutine discovery_test baas eemaldati (loendur0). Visuaalset screenshot'i ei väideta.

Migratsioon0014 rakendati golden source'ile. Esimene #124/source5b8a8a9/revisjon1 ja parandatud #125/revisjon2 on eraldi muutumatud kirjed. Mõlema hüpoteesi esimese revisjoni kõik kuus lähtekoodiräsi vastavad arhiveeritud Git-versioonile. #125 signaalireplay läbis nii hostil kui tegelikus Node22 Docker CLI-s; sama as-of audit on idempotentne ning #124 registreid/raportit ei kirjutatud ümber.

Parandatud **#125**, külmutatud10.11.2026 / raport21:02:35.738UTC:

| Järjestikune etapp | Fundamentaalne kasv | Dateeritud primaarallika sündmus |
|---|---:|---:|
| Kõik säilitatud identiteedikirjed | 7736 | 7736 |
| Praeguses SEC inventaris | 7618 | 7618 |
| Kohaliku issuer-identiteediga seotud | 1025 | 1025 |
| Kohalik US-equity klassifikatsioon täidetud | 17 | 17 |
| Nõutud tunnused teada | 11 | 0 |
| Eligible | 2 | 0 |
| Benchmark määratud eligible nimedel | 2 | 0 |
| Hilisem entry-vaatlus olemas | 0 | 0 |

Kõik7735 erinevat tickerit jäävad nimetajasse. Tulemustähtajani jõudnud vaatlusi0; raw paired ja verified comparable tulemusi0. Kõigi liikmete seas1037 hinnavaatlust ootavad read ning6699 külmutatud identiteedi tõttu mõõtmispiiranguga rida on eraldi; see ei ole võitude/kaotuste jaotus.

Puuduvad sisendid kogu7736-kirjelises nimetajas (kategooriad kattuvad; neid ei liideta):
- sidumata/vastuoluline kohalik issuer-identiteet6699;
- ühildatav käibekasv7040;
- sama perioodi OCF7025;
- võrreldavad basic shares6949;
- benchmark'i määramiseks vajalik market cap6476.
Alles täielike sisendite järel on näha ka tingimuste mittetäitmine: käibekasv alla25%477, OCF mittepositiivne241, basic-shares'i kasv üle5%220 (samuti kattuvad, hõlmavad ka muul põhjusel välistatud ridu).

See näitab katvuse pudelikaelu. See **ei näita** kasumlikkust, olematut edge'i ega seda, et kaks eligible nime oleks head ostud. Kõigepealt tuleb parandada kadudeta metadata salvestus ja hinnata uuringu entry/target/benchmark hindade katvust. Ainult benchmark'i määramine ei taga selle quote'i olemasolu: IWO/IWM/QQQ jaoks ei lisatud selles tarneversioonis uusi päringuid ega suurendatud shared50 limiiti. Puuduvad paarid jäävad auditis nähtavale; enne puutumata tootluse võrdlust tuleb nende kogumine kontrollitult lahendada.

Privaatsed tõendid: docs/research/2026-11-10/measurement-revision2-runtime.json, measurement-revision2-audit.json, measurement-ui.json ja measurement-docker-cli.json; täielik CLI JSON säilitab iga eligible/excluded rea. Need andmestikud/logid ei lähe lähtekoodipublikatsiooni. All seven checked trading/decision tables retain original hashes: no funded or unfunded order/trade, capital run, policy activation, loss reset or original-goal profit credit was created by this measurement work.

## Avaldamine

Rakenduse lähtekood on main'is commit ceec713. [Täpsel lähtekoodil kirjutamiseta GitHubi eelkontroll](https://github.com/mnoormets/stock-discovery/actions/runs/42905675760) läbis: moodulid/sõltuvused ja Neoni ühendus korras, kirjutavaid funktsioone ei kutsutud. See ei tõenda järgmise tegeliku ajastatud kogumise või tulevaste quote-paaride õnnestumist.
