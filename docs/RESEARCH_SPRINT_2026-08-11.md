# Manual research sprint — API, BW, CAKE, HIMS ja ACHR

Kuupäev: 2026-08-11  
Otsusehetk: kohaliku PostgreSQL-i ja 2026-08-11 seisuga avalike primaarallikate põhjal

## Eesmärk ja piir

Selle sprindi eesmärk ei olnud leida ostukandidaati, vaid kontrollida, kas olemasolev funnel, Watchlist, skoorid ja Thesis Builder aitavad teha ausa, allikapõhise ning ümberlükatava investeerimisotsuse. `ready` tähendab siin ainult seda, et teesi saab viie minutiga kaitsta, selle eeldused ja invalidation on kirjas ning 12 kuu kontrollpunkt on mõõdetav. See ei tähenda „osta”.

Kasutati olemasolevaid SEC CompanyFactsi fakte, score-snapshot'e, hinnasnapshot'e, Watchlisti ja Thesis Builderit ning ettevõtete SEC/IR primaarallikaid. Filtreid, score-valemeid, catalyst-reegleid, Coverage Score'i, universumit, välist andmeallikat, UI-d ega infrastruktuuri ei muudetud.

## Lõpptulemus

| Ticker | G / H / C otsuse ajal | Lõppstaatus | Põhiotsus |
|---|---:|---|---|
| API | 81 / 92 / 93 | **ready** | Väikese market cap'i, likviidsuse, kasumlikkuse pöörde, ADS buyback'i ja conversational AI kombinatsioonist sai mõõdetav tees; aeglane ajalooline kasv ja Hiina risk jäävad keskseks vastuväiteks. |
| BW | 100 / 67 / 100 | **researching** | Backlog ja suur projekt on päris catalyst/evidence, kuid vana debt-sisend, negatiivne FCF ja ligi 47% suurem aktsiate arv ei luba per-share turnaround'i veel kaitsta. |
| CAKE | 81 / 81 / 100 | **rejected** | Hea ettevõtte execution ei teinud sellest „järgmise RKLB” teesi: kasv on mõõdukas ning valuation/asümmeetria jäi tõendamata. |
| HIMS | 59 / 35 / 58 | **researching** | Headline Q2 kasv on huvitav, kuid orgaaniline vs omandatud kasv, gross margin, GLP-1 risk ja normaliseeritud FCF vajavad eraldamist. |
| ACHR | 1 / 30 / 75 pärast enrichment'i | **rejected** | Sertifitseerimisprogress ja partnerlused on sündmused, kuid väga väike revenue, kiire burn ja tõendamata commercial economics ei õigusta praegu ownership-thesis't. |

Thesis Builderis säilitati iga tickeri esialgne draft ja sisuline lõppversioon. ACHR-i detaili avamine rikastas olemasoleva SEC allika kaudu ettevõtte 173 finantsfaktiga ja lõi score snapshot'i `#111`; lõppotsus salvestati uuesti, et rejected-tees oleks selle point-in-time snapshot'iga seotud.

## 1. API — Agora, Inc. — ready

### Aus tees

Agora on kasutuspõhine Real-Time Engagement PaaS: ettevõtte Agora ja Shengwang divisjonid annavad arendajatele API-d video, voice, chat, live-streamingu ja conversational AI lisamiseks. Tees ei põhine ainult „AI-lukul”. Selle kandvad osad on 2025 kasumlikkuse ja rahavoo pööre, Q1 2026 kasvu kiirenemine, suur likviidsuspuhver, vähenenud ADS-arv ning võimalus, et conversational AI parandab tagasihoidlikku top-line kasvu.

### Piisav evidence

- [2025 20-F](https://www.sec.gov/Archives/edgar/data/1802883/000119312526155920/api-20251231.htm) kirjeldab proprietary SD-RTN-i, üle miljoni registreeritud rakenduse, kasutuspõhist mudelit ja 2025 tulemusi: revenue +5,9%, net income $9,5m, OCF $27,2m ja rakenduses tuletatud FCF $25,5m.
- Sama 20-F järgi oli dollar-based net retention Agora divisjonis 109 ja Shengwangis 89; ühelgi kliendil polnud üle 10% revenue'st.
- [Q1 2026 ametlik tulemus](https://investor.agora.io/news-releases/news-release-details/agora-inc-reports-first-quarter-2026-financial-results/) näitas revenue kasvu 13,5%, 3 946 aktiivset klienti, DBNRR-i 99, kuuendat järjestikust GAAP-kasumlikku kvartalit ja $366,1m cash/deposits/bank financial products likviidsust.
- Ettevõtte avaldatud ADS buyback vähendas outstanding ADS-id ligikaudu 112,5 miljonilt 84,5 miljonile. Viimase äpi market cap'i (~$391m), laia likviidsuse ja CompanyFactsi $80,4m debt'i kombinatsioon annab piisava aluse odava implied enterprise value hüpoteesiks, mitte lõplikuks valuation'iks.

### Puuduv evidence

- Tasulise conversational AI revenue ja selle gross margin.
- Konkurentidega võrreldav retention, hinnastamisvõim ja win/loss evidence.
- Cash, deposits ja bank financial products täpne kvaliteet, piirangud ning ühildamine äpi kitsama `cash` factiga.
- Värske fully diluted share count ja valuation-multiple'i läbipaistev vaade.

### Kus süsteem aitas

- Score tõi kasumlikkuse/rahavoo pöörde kiiresti esile.
- Thesis Builder sundis eristama tõendatud võrku ja kliendibaasi tõendamata moat'ist.
- Invalidation ja 12 kuu checkpoint muutsid „AI võib kasvada” väite mõõdetavaks.

### Kus süsteem jäi nõrgaks

- Health kasutas kitsast cash/debt definitsiooni ega näidanud laia likviidsust.
- Äpp ei arvuta enterprise value't ega erista likviidsete finantsproduktide kvaliteeti.
- Aggregate Growth 81 peitis, et Q1 kasv oli parem kui 2025 aastakasv, kuid gross margin ja OCF kvartalivõrdlus halvenesid.

### Mõõdetav kontroll

Järgmise 12 kuu jooksul peavad vähemalt kaks uut kvartalit näitama revenue kasvu vähemalt 10%, DBNRR-i vähemalt 100, positiivset OCF-i ja mitte üle 5% ADS-arvu kasvu. Tees muutub valeks, kui kaks järjestikust raportit näitavad koos alla 5% revenue kasvu või DBNRR-i alla 95 ning negatiivset OCF-i ilma selge ühekordse põhjuseta.

## 2. BW — Babcock & Wilcox Enterprises — researching

### Aus tees

BW võib olla päris turnaround, kuid praegu on tõendatud projekti- ja backlog'i pööre, mitte veel püsiv per-share väärtuse kasv. Energy/environmental engineering äri sõltub suurte projektide execution'ist, marginaalist ja cash conversion'ist.

### Piisav evidence

- [Q2 2026 ametlik tulemus](https://www.babcock.com/home/about/corporate/news/babcock-and-wilcox-enterprises-reports-second-quarter-2026-results) näitas revenue'd $319,7m (+130%), adjusted EBITDA-t $21,8m (+57%), bookings'ut $151m (+38%) ja backlog'i $2,6b (+533%).
- Base Electron andis Q2 revenue'st $100,7m ning juhtkonna järgi oli projekt graafikust ees ja eelarves.
- Q2 SEC faktides pöördus kvartali net income positiivseks ja kuue kuu OCF $0,4m positiivseks; kuue kuu tuletatud FCF jäi siiski –$13,4m.
- Ametlik allikas ütleb ka ausalt, et backlog võib muutuda või tühistuda ning üle $14b pipeline pole lepinguline guarantee.

### Puuduv evidence

- Normaliseeritud marginaal ja cash conversion ilma Base Electroni ühekordse mõjuta.
- Customer concentration, cancellation terms ja projekti võimalik downside.
- Täielikult lahjendatud share count, preferred economics ja värske enterprise value.
- Täpselt ühildatud current debt/liquidity: äpi Health kasutas 2026 cash'i koos 2021 debt-faktiga.

### Kus süsteem aitas

- Score tõi suure operatiivse muutuse nähtavale ja funnel audit näitas, et BW kukkus välja ainult catalyst gate'i tõttu.
- Thesis Builder paljastas kohe, et headline Growth 100 ei vasta küsimusele, kas väärtus kasvas aktsia kohta.

### Kus süsteem jäi nõrgaks

- Coverage 100 jättis mulje täielikust pildist, kuigi debt oli viis aastat vana.
- Collector ei sidunud värsket Q2 filing'ut, backlog'i ja Base Electronit catalyst'iga. See oli päris research false negative.
- Growth ei karista piisavalt ligi 47% share-count kasvu ega erista ühe suurprojekti panust.

### Mõõdetav kontroll

Enne `ready` staatust tuleb näha vähemalt kahte kvartalit, kus backlog konverteerub ilma marginaali kokkuvarisemiseta, trailing 12-month OCF on positiivne, FCF paraneb ja share count ei kasva uuesti oluliselt. Vastasel juhul rejected.

## 3. CAKE — The Cheesecake Factory — rejected

### Aus tees

CAKE võib olla hea quality-compounder, kuid praegune „järgmise RKLB” tees lükati tagasi. Mature põhibränd, umbes 7–8% revenue kasv ja tõendamata valuation ei anna otsitud varajase kasvu/asümmeetria profiili.

### Piisav evidence

- [Q2 2026 ametlik tulemus](https://investors.thecheesecakefactory.com/news-and-events/news-releases/news-release-details/2026/The-Cheesecake-Factory-Reports-Results-for-Second-Quarter-of-Fiscal-2026/default.aspx) näitas revenue'd $1,03b (+7,7%), comparable sales'i +5,8%, operating margin'i paranemist 6,8%-lt 7,6%-ni ja net income kasvu 24,8%.
- Ettevõte plaanib 2026 avada kuni 26 uut restorani ning teatas $561,7m available liquidity'st, $575m convertible debt'ist ja $0 revolving balance'ist.
- Rakenduse aligned SEC faktid näitasid tugevat OCF/FCF paranemist ja ligikaudu stabiilset share count'i.

### Puuduv evidence

- North Italia, Flower Child ja teiste uute kontseptsioonide unit economics, payback ja mature-store returns.
- Traffic vs ticket contribution comparable sales'ile.
- Läbipaistev EV/EBIT, P/E või per-share FCF valuation ja pikaajaline kasvurada.

### Kus süsteem aitas

- Skoor leidis päriselt paraneva cash-flow ja execution'i.
- Funnel audit sundis kontrollima high-score nime, mida inimene oleks muidu „liiga tavalisena” ignoreerinud.

### Kus süsteem jäi nõrgaks

- Growth 81 võib kõlada nagu high-growth ettevõte, kuigi top-line oli +7,7%; komponentide selgitus oli otsuse jaoks hädavajalik.
- Catalyst hard gate jättis CAKE research-listist välja, kuigi comparable-sales ja unit-opening evidence olid olemas. Gate tekitas false negative'i research recall'i tasemel.
- Äpp ei suuda eristada „hea ettevõte” ja „hea ettevõte selle konkreetse asümmeetria mandaadi jaoks”.

### Reopen-tingimus

Rejected-otsus avatakse uuesti, kui uued kontseptsioonid tõendavad vähemalt 15% kestvat segmendikasvu, tugevat unit-level tootlust ja konsolideeritud per-share FCF kiirenemist ilma leverage'i või share-count kasvuta.

## 4. HIMS — Hims & Hers Health — researching

### Aus tees

HIMS-il on päris consumer-health platvorm ja suur potentsiaal, kuid headline kasv pole veel piisavalt kvaliteetne. Orgaaniline USA trend, Eucalyptus'e panus, GLP-1 mix, gross margin, regulatory risk ja normaliseeritud FCF tuleb enne ownership-thesis't eraldada.

### Piisav evidence

- [Q1 2026 ametlik tulemus](https://investors.hims.com/news/news-details/2026/Hims--Hers-Health-Inc--Reports-First-Quarter-2026-Financial-Results/default.aspx) kirjeldab valdavalt subscription-põhist toodete/teenuste mudelit, 2,584m subscriber'it (+9%) ning revenue'd $608,1m (+4%).
- Sama allikas näitas USA revenue langust 8%, Rest of World kasvu 969%, gross margin'i langust 73%-lt 65%-le, GAAP net loss'i $92,1m ja adjusted EBITDA langust $91,1m-lt $44,3m-le.
- [Q2 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1773751/000177375126000163/hims-20260630.htm) SEC faktid näitasid revenue'd $753,2m (+38,2%), GAAP net loss'i $86,3m ja kuue kuu OCF-i $53,4m võrreldes $90,0m-ga.
- Eucalyptus'e omandamine lõpetati 2026 juunis, mistõttu Q2 kasv ei ole puhtalt orgaaniline võrdlus.

### Puuduv evidence

- USA organic revenue, acquired revenue ja FX mõju selge bridge.
- Subscriber cohort retention, churn, CAC payback ja contribution margin.
- GLP-1 pakkumise regulatiivne kestvus ja normalized gross margin.
- FCF, fully diluted share count ja acquisition integration'i kapitalivajadus.

### Kus süsteem aitas

- Madal Health/Coverage takistas +38% headline revenue't automaatselt tugevaks teesiks pidamast.
- Thesis Builder sundis eristama business growth'i ja stock mispricing'ut.

### Kus süsteem jäi nõrgaks

- CompanyFacts ei seleta organic/acquired/geographic mix'i ega ühekordseid restructuring/fair-value mõjusid.
- Äpp ei näita retention'i, CAC-i, gross margin'i ega regulatiivset evidence'it — need on selle mudeli puhul otsustavamad kui aggregate revenue.

### Mõõdetav kontroll

USA organic revenue peab pöörduma kasvule, gross margin taastuma vähemalt 70% lähedale, trailing 12-month FCF jääma positiivseks ning ettevõte peab näitama retention/CAC kvaliteeti. Kui USA orgaaniline langus, alla 65% gross margin või korduv restruktureerimine püsib, liigub tees rejected staatusesse.

## 5. ACHR — Archer Aviation — rejected

### Aus tees

Archeri narratiiv on tehniliselt võimalik, kuid tänast ownership-thesis't ei saa kaitsta. Sertifitseerimisprogress, strateegilised partnerid ja Boeing/Wisk sündmus ei võrdu type certification'i, korduva passenger revenue, tootmismahu ega unit economics'iga.

### Piisav evidence

- [Q1 2026 ametlik tulemus](https://investors.archer.com/financials/quarterly-results/default.aspx) teatas FAA neljafaasilise type-certification protsessi Phase 3 sulgemisest ja 2026 USA operatsioonide eesmärgist.
- Sama allikas näitas ainult $1,6m revenue'd, $217,7m net loss'i, $149,1m operating cash use'i, $32,6m capex'it ning $1,776b cash/short-term investments'i.
- Rakendusse kogutud 2026-08-10 8-K ja Boeing/Wisk uudis on thesis-relevant sündmus, kuid see ei kinnita commercial economics'it.
- Existing CompanyFacts enrichment lõi 173 fakti ja skoori 1 / 30 / 75; see muutis süsteemi varasema „unknown” seisundi sisuliselt nõrgaks finantsprofiiliks.

### Puuduv evidence

- FAA Phase 4/type certification'i täpne kriitiline tee.
- Korduvad reisijaoperatsioonid ja Hawthorne'i kõrvaltegevusest eraldi commercial revenue.
- Aircraft delivery cadence, gross margin, utilization ja lifecycle/service economics.
- Order quality/cancellation terms, fully diluted share count ja tehingujärgne kapitalivajadus.

### Kus süsteem aitas

- SEC enrichment muutis „andmeid pole” olukorra konkreetseks 1/30/75 riskipildiks.
- Thesis Builder tegi kasutaja aastatepikkuse skeptilisuse mõõdetavaks: sertifikaat, passenger operations, revenue, burn ja dilution.

### Kus süsteem jäi nõrgaks

- Enne detaili avamist puudusid faktid ja score täielikult; funnel ei suutnud hinnata kõige olulisemat riski.
- Skoor saab mõõta pre-revenue burn'i, kuid mitte FAA milestone'i tõenäosust, aircraft safety't ega order quality't.
- Uudise olemasolu võib narratiivi tugevdada ka siis, kui investeerimisriski alus ei muutu.

### Reopen-tingimus

Otsus avatakse uuesti ainult siis, kui Archer saavutab selgelt dokumenteeritud Phase 4/type-certification progressi, korduvad reisijaoperatsioonid, nähtava aircraft delivery cadence'i ja commercial revenue ilma suure uue lahjenduseta. 2026 operatsioonieesmärgi oluline viivitus või kiirenev burn kinnitab rejection'it.

## Mida investor päriselt õppis

1. **Üks tees jõudis ready staatusesse.** API puhul ühendas süsteem raamatupidamisliku inflection'i ja inimese primaarallika kontrolli piisavalt hästi, et kirjutada falsifitseeritav tees. Ready ei tähenda, et risk on väike või aktsia on ost.
2. **Kaks teesi sai kiiresti tagasi lükata.** CAKE ei sobinud konkreetse asümmeetria mandaadiga; ACHR-i commercial evidence ei õigustanud narratiivi ja burn'i. Mõlemad rejection'id säästavad edasist research-aega.
3. **Kõrge skoor ei elanud automaatselt research'i üle.** CAKE 81/81/100 ei muutunud „järgmise RKLB” teesiks. BW 100/67/100 nõrgenes oluliselt pärast stale debt'i, dilution'i ja projekti concentration'i kontrolli. See kinnitab, et high score tähendab ainult „uuri”.
4. **Catalyst hard gate tekitas research false negative'e.** BW-l oli väga selge Q2/backlog/Base Electron catalyst; CAKE-l oli earnings, comparable-sales ja unit-opening evidence. Mõlemad jäid canonical funnel'is catalyst'i puudumise tõttu välja. Gate'i puudus oli sündmuste kogumise/semantika, mitte ettevõtete tegelik sündmusetus.
5. **Kõige valusam puuduv info oli valuation + per-share economics.** Süsteem näeb kasvu ja bilansi suunda, kuid ei vasta hästi, mida investor tänase hinna eest saab, kui suur osa kasvust on orgaaniline, kas dilution hävitab kasu või milline on unit/customer economics.
6. **Freshness ja period alignment on otsuse usaldusväärsuse eeltingimus.** BW Coverage 100 koos 2021 debt'iga on ohtlikum kui ausalt madal Coverage. HIMS näitas teist alignment-probleemi: omandatud ja orgaaniline kasv segunes ühte headline'i.

## Tooteotsus pärast sprinti

Järgmine arendustöö peaks olema **Data Freshness + Period Alignment layer**, mitte uus universe, infrastruktuur ega uus score. Põhjus on integrity: enne funnel'i recall'i laiendamist peab investor nägema, kas score kombineerib sama majandusperioodi ja kas input on tänase otsuse jaoks värske.

Pärast seda on tõend piisav, et muuta catalyst hard gate **structured evidence field'iks**, mis näitab sündmuse materiality't, suunda, allikat ja thesis-relevance'it. Praegu tuleks säilitada manual research cohort ning mitte veel järeldada, et universe tervikuna on halb: viiest nimest saadi üks ready, kaks researching ja kaks põhjendatud rejected otsust. Funnel on mürane, kuid toodab vähemalt mõne uurimist väärt idee.

