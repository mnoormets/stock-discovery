# Kahe protokolli mõõtmiskiht — 10. november 2026

## Tööjärjekorra parandamine

Kasutaja teine review on vastu võetud: olemasolev fail, funktsioon või läbitud tarkvaratest ei tõenda investeerimiseelist. Eelmise review „osa on juba olemas” märkused kirjeldasid teostust, mitte kasulikkust. Valuation'i, artiklisisu, insider'i ega sotsiaalse tähelepanu mõju kuludega puutumata tulemustele ei ole selle olemasoluga näidatud.

See tarne peatab järgmise AI-skoori, täiendavate skoorikomponentide ja seitsme paralleelse strateegia ehitamise. Fookus on **Strategy Protocol Registry + Outcome Coverage Audit** kahele fikseeritud uurimishüpoteesile. Kapitalikonto, Today skoor/valik, ostureeglid ja riskipiirid ei muutu. Ühtegi paber- ega pärisostu ei aktiveerita.

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
- Kogumised on korduvate issuer'itega panel. Eri päevade sama issuer'i vaatlused ei ole sõltumatud tehingud. Raport vaikimisi järgib esimest prospektiivset kogumist; see ei vali tagantjärele parimat kohorti.
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

## Mis jääb järgmiseks, pärast seda alust?

1. Lahendada auditis nähtud ajastuse, hinna/benchmark'i või identiteedi katvus enne tulemuste võrdlemist. Mitte lisada uut skoori, et puuduvat tulemust varjata.
2. Artikli extraction correctness, entity/event linking ja tegeliku allikasõltumatuse kontroll.
3. Eraldi käsitsi märgendatud artiklivalim; kasutaja pakutud ~200 artiklit ja issuer 98% / numbrid-ühik 95% / macro-F1 0,85 / duplicate precision 95% / vale-positiivne suund alla 5% on kavandatavad QA väravad, **mitte saavutatud näitajad ega kasumlikkuse tõend**. Selles töös ei loodud automaatselt „inimese” märgendeid.
4. Alles siis puutumata valimil sama universumi/timing'u/benchmark'i/kuludega ablation: momentum, finantskasv, finantskasv+pealkiri, finantskasv+artiklitõend. Ühtki neist uutest variantidest ei valita selle tarne tulemuste järgi.

Tõendusastmed jäävad eraldi: **kood olemas → runtime toimib → sisendid/katvus mõõdetud → analüüsi kvaliteet kontrollitud → lisanduv kuludega out-of-sample väärtus**. Artiklite kuue teksti lugemine tõendas ainult esimesi astmeid. Praegune raport võib näidata Unknown/puudulikku katvust; piisava katvusega tulevane katse peab lubama ka järeldust „edge'i ei leitud”.

## Testid ja tegeliku kogumise audit

Sihitud kontroll: 3 faili/37 testi läbisid pärast SQL alias'e ebaselguse parandamist. Täielik suite, tootmisbuild, golden-source migratsioon, päris uus kogumine ja taaskäivitatud UI/DB võrdlus on **veel kontrollimisel**. Konkreetne lõpptulemus lisatakse pärast tõendeid.
