# Stock Discovery – kasutajajuhend

See juhend on inimesele, kes avab rakenduse esimest korda. Stock Discovery aitab leida uurimist vajavaid ettevõtteid, jälgida olemasolevaid ideid ja koostada kontrollitavaid investeerimisteese. Rakendus ei anna ostu- ega müügisoovitusi.

## Soovitatud igapäevane töövoog

1. Ava **Today** ja vaata kõigepealt Thesis Review Queue'd: kas mõne olemasoleva teesi järel on saabunud uus tõend.
2. Vaata Today kandidaate ning **Needs review** hoiatusi. Kõrge skoor tähendab „uuri lähemalt”; `Eligible for paper entry` on eraldi appi positiivne paper-otsus.
3. Ava **Watchlist** ning kontrolli olulisi Growth/Health muutusi ja muutunud komponente.
4. Ava huvipakkuva tickeri **ettevõtte faktivaade** ning kontrolli hind, SEC finantsid, uudised, earnings, skooride põhjused ja algallikad.
5. Uue idee leidmiseks ava **Skänner → Leia järgmine RKLB**.
6. Lisa põhjendatud kandidaat Watchlisti või alusta kohe teesi.
7. Täida **Thesis Builderis** kasutaja hüpoteesid ja 12 kuu mõõdetav kontrollpunkt. Muuda tees `ready` olekusse alles siis, kui invalidation-tingimus ja kontrollpunkt on selgelt sõnastatud.

### Today paper-entry otsus

Iga Today kandidaadikaart näitab Business- ja Market setup'i kõrval eraldi **Paper entry test** tulemust:

- Today canonical nimekiri kasutab ainult sama päeva collection run'is turuandmetega kinnitatud tickereid. Käsitsi avatud RKLB scanner võib endiselt näidata laiemat salvestatud research-universumit.
- `Eligible for paper entry` tähendab, et entry-aware V1 kõik väravad läbisid: Growth vähemalt 65, Health vähemalt 65, Coverage vähemalt 70, current collection kinnitas turuandmed ja salvestatud hinnalugu ei näita elevated run-up'i. Today nõuab positiivse sildi jaoks lisaks hiljutist ja kehtivat kuvatud decision-price'i. See on appi selgeim positiivne seis ning looks hüpoteetilise $100 buy intent'i.
- `Wait` tähendab, et ettevõte võib endiselt väärida uurimist, kuid vähemalt üks paper-entry värav ei läbinud. Kaart ütleb täpse põhjuse.
- Iga uus eligible päev tekitab uue intent'i ka sama tickeri korral. Kui see käitumine osutub halvaks, tuleb parandada ja versioonida signaalipoliitika; simulator ei peida probleemi tickeri dedupeerimisega.

Paper-entry seis on läbipaistev mudelikatse. Today ei saada brokerile orderit ning enne päris raha kasutamist tuleb kontrollida teesi, valuation'it, riske ja positsiooni suurust.

## Avaleht ja tickeri otsing

Tickeri otsing aktsepteerib näiteks `AAPL`, `NVDA`, `RKLB` ja `ASTS`. Vigane ticker ei põhjusta rakenduse viga. Kui andmeid pole veel kogutud, kuvatakse `No data available yet`.

Ettevõtte detailvaates erista alati kolme tüüpi infot:

- **fakt** – hind, SEC periood, filing, earnings'i aeg või uudise pealkiri;
- **reeglipõhine järeldus** – Growth/Health komponent või Research Briefi signaal;
- **kasutaja hüpotees** – moat, mispricing, „miks praegu?” ja teesi invalidation.

## Skoorid

### Growth Score

Kasutab revenue, net income'i, operating cash flow ja free cash flow aastamuutusi. Kõrge skoor tähendab „uuri lähemalt”, mitte „osta”.

### Financial Health Score

Kasutab rahavoogude kvaliteeti, cash/debt suhet, kasumlikkust ja aktsiate arvu muutust. Varajane kahjumlik ettevõte võib olla uuritav, kuid nõrk finantstervis peab olema riskina nähtav.

### Coverage Score

Näitab, kui suur osa mudeli kaalutud sisenditest oli arvutatav. Madala Coverage'iga kõrget üksikskoori ei tohi käsitleda täieliku pildina.

Iga Growth/Health skoor näitab kolme suurima kaalutud mõjuga põhjust. Score snapshot säilitab kasutatud faktid, komponendid, mudeliversiooni ja arvutamise aja.

## Data Freshness ja Period Alignment

Ettevõtte detail, RKLB kandidaadikaart ja Thesis Builder näitavad Coverage'ist eraldi andmekvaliteedi plokki.

- **Freshness** näitab score'is kasutatud viimaste SEC faktide vanust. V1 loeb üle 550 päeva vana fakti stale sisendiks ning kuvab oleku `fresh`, `mixed`, `stale` või `unknown`.
- **Period Alignment** näitab, kas kasutatud mõõdikud kirjeldavad võrreldavat majandushetke. Kuni 120-päevane vahe on hea ainult siis, kui flow-mõõdikutes pole läbisegi annual/quarter/YTD kestusi; üle 730-päevane vahe on `poor`.
- Plokk näitab iga olemasoleva põhimõõdiku väärtust, perioodi, perioodiliiki, vanust, fact ID-d, accession number'it ja SEC algallikat.
- Puuduv mõõdik vähendab endiselt Coverage'it, kuid seda ei fabritseerita teadmata perioodiga sisendiks. Ühe teadaoleva mõõdiku põhjal jääb Alignment ausalt `unknown`.

Coverage 100 võib seega olla samal ajal Alignment `poor`. Näiteks BW cash on 2026. aasta perioodist, kuid score'is kasutatud debt pärineb 2021. aastast. Growth ja Financial Health punkte V1 ei muuda; hoiatus ütleb investorile, milline algallikas tuleb enne järeldust üle kontrollida.

Thesis Builder kuvab alignment/freshness probleemi korral `ready` staatuse juures soft warning'u. See ei blokeeri salvestamist, sest lõpliku tõendi piisavuse otsustab kasutaja.

## Catalyst evidence

Kandidaadikaardil on eraldi **Catalyst evidence** plokk. Catalyst ei otsusta enam, kas ettevõte üldse nimekirja pääseb — see näitab, kui tugev on sündmuse tõend, ja mõjutab ainult järjestust.

- **Materiality** — kas sündmus muutis numbrit, millel on ettevõtte mastaabis kaalu. `quantified_major` tähendab suurt mõõdetud muutust või kasumi/rahavoo pööret, `quantified_minor` järkjärgulist muutust, `unquantified` seda, et avaldus ei kandnud mõõdetavat pööret, ja `unknown` seda, et värskeid võrreldavaid sisendeid ei olnud.
- **Suund** — `improving`, `deteriorating`, `mixed` või `unknown`; tuletatud ainult avalduse enda faktidest, mitte hinnast ega tähelepanust.
- **Allikas** — `primary_sec` on SEC-i avaldus, `secondary_news` on uudise pealkiri. Pealkiri ei tõsta tõendit kunagi materiaalseks.
- **Uudsus** — `new_information` tähendab, et avaldus tõi ettevõtte uusima majandusperioodi. Sama perioodi kordusavaldus on `repeat_of_prior_event`.
- **Thesis-relevance** — kas tõend puudutab avatud küsimust otsustavalt, toetavalt, ainult kõrvalt või üldse mitte.
- **Mandaat** — eraldi hinnang, kas sündmus sobib „järgmise RKLB” varajase asümmeetria mandaadiga. Hea ettevõtte päris sündmus võib olla `not_relevant`.

Plokk näitab alati ka vastutõendeid (dilution, negatiivne rahavoog, aegunud sisendid), et sündmus ei jääks kunagi ilma oma teise poole. Planeeritud earnings-kuupäev ütleb ainult, millal järgmist tõendit vaadata — see ei ole katalüsaator. Kui earnings-kuupäev on möödas, aga uut avaldust ei ole kogutud, näitab rakendus `collection gap` olekut: see on kogumislünk, mitte tõend, et ettevõttel sündmusi ei olnud.

## Sector-relative ranking

Plokk **Compared with similar companies** võrdleb ettevõtte Growth, Financial Health ja Coverage skoori sama industry või sector grupi mediaani ning percentile'iga. Võrdluses kasutatakse ainult sama score-versiooni ettevõtteid, millel on kõik kolm skoori olemas. Market cap saab eraldi percentile'i.

Industry gruppi eelistatakse, kui selles on vähemalt viis võrreldavat ettevõtet; muidu kasutatakse piisava suurusega sector gruppi. Kui sector/industry puudub, näitab rakendus `Sector / industry unknown`. Kui võrreldavaid ettevõtteid on alla viie, näitab rakendus `Not enough comparable companies` ega kuva eksitavat percentile'i või mediaani.

See aitab vältida näiteks AAPL-i ja RKLB otse võrdlemist täiesti erineva äriprofiiliga universumis. Sector-relative väärtus kirjeldab ainult ettevõtte kohta olemasolevat fakti oma grupi suhtes. See ei mõõda moat'i, valuation'it ega tulevast tootlust ning ei ole ostu- ega müügisoovitus.

## Watchlist

Watchlist on uurimisnimekiri. Watchlisti kirje kogus ja keskmine ostuhind on null ning seda ei arvestata portfelli turuväärtusse.

Veerg **Skoori muutus** võrdleb kahte järjestikust sama mudeliversiooni snapshot'i:

- `new catalyst` – oluline positiivne skoori- või komponendimuutus;
- `new risk` – oluline negatiivne muutus;
- `needs review` – segatud muutus, puuduv võrdlus või mudeliversiooni vahetus;
- `no major changes` – vähemalt 10-punktilist või olulist komponendi seisundimuutust ei leitud.

Detailist näeb vana ja uut skoori, muutunud komponente, mudeliversiooni ja snapshot'i ID-sid. See on ülevaatuse signaal, mitte kauplemiskorraldus.

## Thesis Review Queue

Today lehe Thesis Review Queue seob praeguse teesi selle salvestamisel valitud hinnasnapshotiga ja viimase salvestatud sama valuuta hinnaga. Hinnamuutus on kontekst, mitte teesi läbimise või ebaõnnestumise otsus.

- `Review due` tähendab, et pärast praeguse teesi loomist on salvestatud uuem finantsavaldus, otsustava/toetava thesis-relevance'iga SEC sündmus või earnings-kuupäev on möödunud ilma uuema finantsavalduseta.
- `Awaiting evidence` tähendab, et uuemat kvalifitseeruvat tõendit ei ole ja järgmine earnings-kuupäev on teada.
- `Reviewed` tähendab, et praegusest versioonist uuemat kvalifitseeruvat tõendit ega tulevast earnings-kuupäeva ei ole salvestatud.

Kaart näitab revenue-, margin-, cash-flow-, dilution-, valuation- ja downside-hüpoteese, reverse-valuation küsimust ning järgmist review trigger'it. Need väljad on vabatekst, mistõttu rakendus ei nimeta neid automaatselt läbituks ega ebaõnnestunuks. Kui `Review due` ilmub, ava Thesis Builder, kontrolli algallikat ja salvesta oma hinnang uue versioonina. Nii jääb alles nii eelmine otsus kui ka uue ülevaatuse aeg ja hinnakontekst.

## „Leia järgmine RKLB”

Skänneri preset otsib olemasolevast kogutud universumist RKLB-laadset varajase kasvu mustrit, mitte sama sektorit. RKLB ise jäetakse tulemustest välja.

Kaasamise baasreeglid:

- Growth vähemalt 65;
- Coverage vähemalt 70;
- teadaolev market cap kuni 75 miljardit;
- vähemalt üks katalüsaator: earnings 45 päeva jooksul, SEC sündmus 30 päeva jooksul või uudis 14 päeva jooksul.

Iga kriteerium kuvatakse eraldi olekuga `supported`, `uncertain` või `missing`. Kandidaadikaart näitab põhjuseid, runway'd, riske, puuduvaid andmeid ja küsimusi, mida investor peab moat'i ning mispricing'u kohta ise tõendama.

Kandidaadikaardi **Compared with similar companies** plokk näitab sama otsusehetke Growth/Health/Coverage võrdlust sobiva industry või sector grupiga. Need väärtused salvestatakse uue discovery snapshotiga ja ajaloolisi run'e tänase grupiloogikaga ümber ei kirjutata.

Rakendus ei arvuta „RKLB tõenäosuse” koondskoori. Kui ükski ettevõte filtreid ei läbi, kuvatakse null kandidaati.

## Discovery valideerimine

Iga „Leia järgmine RKLB” avamine salvestab otsusesnapshoti. Sama päeva täiesti identne sisend taaskasutab varasemat run'i; muutunud faktid loovad uue run'i. Snapshot sisaldab kõiki vaadeldud tickereid, mitte ainult lõplikke kandidaate.

Kell 08:00 päevane `/api/collect` kasvatab lisaks SEC finantskatvust kuni viie ettevõtte kaupa ning loob ühe `rklb_daily` canonical snapshot'i Tallinna päeva kohta. Sama päeva korduscollect ei loo teist canonical run'i ega ületa päevast SEC eelarvet. Scanneri käsitsi avamised jäävad eraldi auditi-run'ideks ega hakka tulevast frequency streak'i kunstlikult kasvatama.

Leht **Validation** näitab:

- millal ja millise mudeliversiooniga discovery käivitati;
- millised tickerid kaasati ning millised jäeti välja;
- täpset kaasamise või välistamise põhjust;
- otsusehetke hinda, market cap'i, Growth/Health/Coverage skoore, runway-kirjeldust, katalüsaatorit, riske ja teadmata infot;
- kaasatud kandidaadi tegelikku hinnamuutust 1 nädala, 2 nädala, 1 kuu, 3 kuu ja 6 kuu järel.

Horisondi tulemuseks võetakse esimene hinnasnapshot sihtajal või järgneva seitsme päeva jooksul. Kui selles aknas hinda pole, märgitakse tulemus puuduvaks. Tulemusi värskendatakse igapäevase kogumise lõpus ja ka Validationi lehe avamisel. Mõõdetud tulemust hilisema backfill'i tõttu ümber ei kirjutata. Mudeliversioone ja horisonte kuvatakse eraldi, et eri valikureeglid või 1 nädala ning 6 kuu tulemused ei satuks samasse keskmisesse.

Runway väli ei väida kuude arvu, sest praegune andmestik ei arvuta rahapõletuse põhjal usaldusväärset runway'd. Kuvatakse Financial Healthi ja cash/debt komponendi tegelik olemasolev tõend.

## Validation ja Backtest

**Validation** vastab küsimusele: „Mida iga salvestatud discovery run otsuse hetkel nägi ja mis juhtus iga kandidaadiga hiljem?” See on detailne otsuselogi, kus näeb ka välja jäetud tickereid ja välistamise põhjuseid.

**Backtest V1** vastab küsimusele: „Kuidas iga discovery mudeliversiooni mõõdetud tickerid horisondi kaupa käitusid ja kuidas need võrdlesid SPY-ga?” Backtest ei käivita tänast skännerit vanade kuupäevade peal ega vali minevikku ümber.

Backtesti põhireeglid:

- kasutatakse ainult varem salvestatud `discovery_runs`, `discovery_decisions` ja `candidate_outcomes` andmeid;
- iga mudeliversioon ja horisont moodustab oma kohordi;
- sama tickeri korduvate mõõdetud otsuste tootlused keskmistatakse esmalt tickeri sees ning koondnäitajas saab iga ticker ühe võrdse kaalu;
- otsuste arv näitab korduvaid signal-time vaatlusi, eri tickerite arv näitab kohordi tegelikku laiust;
- `pending`, `missing` ja `unavailable` otsuseread kuvatakse eraldi, mitte ühe üldise „mõõtmata” arvuna;
- candidate return on kandidaadi otsusehetke hinna ja fikseeritud horisondi lõpphinna muutus;
- benchmark return kasutab SPY run'i-eelset salvestatud algushinda ja sama horisondi lõpphinda;
- excess return = candidate return miinus benchmark return;
- puuduva SPY algus- või lõpphinna korral jäävad benchmark ja excess `unknown`, mitte 0%;
- juba mõõdetud candidate ja benchmark outcome'e hilisema backfilliga ümber ei kirjutata;
- null kandidaati on korrektne tulemus.

1 nädala ja 2 nädala tulemused võivad olla väga mürased: neid mõjutavad turu üldine liikumine, üksikud uudised, madal likviidsus ja juhuslik ajastus. 3 kuu ja 6 kuu tulemused annavad teesi ning katalüsaatorite avaldumiseks rohkem aega ja on seetõttu protsessi hindamisel üldiselt informatiivsemad. Pikem horisont ei tee väikest valimit automaatselt usaldusväärseks; vaata otsuste kõrval alati eri ja mõõdetud tickerite arvu ning puuduva tulemuse katvust.

Validation ega Backtest ei ole prediction, hinnasiht ega ostu- või müügisoovitus. Need mõõdavad ainult varem salvestatud discovery candidate outcome'e.

## Thesis Builder

Thesis Builderi väljad:

- teesi lühikokkuvõte;
- mida ettevõte teeb;
- miks praegu;
- moat;
- mispricing;
- katalüsaator;
- invalidation – mis muudab teesi valeks;
- mis peab järgmise 12 kuu jooksul juhtuma;
- ajahorisont ja staatus.

Staatused on `draft`, `researching`, `ready` ja `rejected`. `ready` nõuab invalidation-tingimust, 12 kuu kontrollpunkti ja kinnitust, et kontrollpunkt on objektiivselt mõõdetav.

Iga sisuline muudatus loob uue versiooni. Identne kordussalvestus versiooni ei lisa. Versiooniga säilib otsuse hetke score snapshot, et hiljem oleks näha, mida sel ajal tegelikult teati.

Thesis Builderi **Sector-relative evidence** plokk esitab ainult grupi, mediaanid, percentile'id ja võrreldavate arvu. See ei täida automaatselt moat'i, mispricing'u ega teesi välju.

## Portfell

Portfelli positsioon sisaldab tickerit, kogust, keskmist ostuhinda, staatust ja märkmeid. Rakendus arvutab viimase kogutud hinna põhjal turuväärtuse ja realiseerimata P/L-i.

- `active` – olemasolev positsioon;
- `watch` – uurimisidee, mida portfelli väärtusse ei arvestata;
- `closed` – suletud positsioon.

Teesi muutmiseks kasuta Thesis Builderit, et versiooniajalugu säiliks.

## Daily Changes

Daily Changes koondab kuni 20 aktiivse või jälgitava positsiooni kohta:

- olulise hinnamuutuse;
- uued uudised;
- uued SEC sündmused;
- läheneva earnings'i;
- olulise score-muutuse.

Sõnastus `needs review`, `new catalyst`, `new risk` ja `no major changes` kirjeldab uurimisprioriteeti, mitte ostu- või müügisoovitust.

## Andmete puudumine ja piirangud

- Puuduv info kuvatakse tühja olekuna; seda ei muudeta automaatselt nullpunktideks.
- SEC CompanyFacts ei ole kõigi emitentide puhul ühtlaselt täielik.
- Free cash flow on rakenduses tuletatud kui operating cash flow miinus capital expenditure.
- Uudise märksõna on signaal, mitte uudise sisuline faktikontroll.
- Moat ja mispricing vajavad investori enda algallikaid.
- Rakendus ei sisalda veel IPO/Nasdaq uute noteeringute radarit ega ajaloolist turu universumi rekonstrueerimist enne salvestatud discovery run'e.

## Kahe arvuti kasutamine

Kood liigub Gitiga, kuid `.env` ja lokaalne PostgreSQL andmebaas mitte. Kummaski arvutis võib olla eraldi `.env`. Sama portfelli, Watchlisti, teeside ja ajaloo jaoks tee aktiivses arvutis DB dump ning taasta see teises arvutis. Täpsed käsud on failis `docs/HANDOFF.md`.
