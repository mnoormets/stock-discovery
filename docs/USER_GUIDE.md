# Stock Discovery – kasutajajuhend

See juhend on inimesele, kes avab rakenduse esimest korda. Stock Discovery aitab leida uurimist vajavaid ettevõtteid, jälgida olemasolevaid ideid ja koostada kontrollitavaid investeerimisteese. Rakendus ei anna ostu- ega müügisoovitusi.

## Soovitatud igapäevane töövoog

1. Ava **Daily Changes** ja vaata, millised portfelli või Watchlisti tickerid vajavad ülevaatust.
2. Ava **Watchlist** ning kontrolli olulisi Growth/Health muutusi ja muutunud komponente.
3. Ava huvipakkuva tickeri **ettevõtte faktivaade** ning kontrolli hind, SEC finantsid, uudised, earnings, skooride põhjused ja algallikad.
4. Uue idee leidmiseks ava **Skänner → Leia järgmine RKLB**.
5. Lisa põhjendatud kandidaat Watchlisti või alusta kohe teesi.
6. Täida **Thesis Builderis** kasutaja hüpoteesid ja 12 kuu mõõdetav kontrollpunkt.
7. Muuda tees `ready` olekusse alles siis, kui invalidation-tingimus ja kontrollpunkt on selgelt sõnastatud.

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

## Watchlist

Watchlist on uurimisnimekiri. Watchlisti kirje kogus ja keskmine ostuhind on null ning seda ei arvestata portfelli turuväärtusse.

Veerg **Skoori muutus** võrdleb kahte järjestikust sama mudeliversiooni snapshot'i:

- `new catalyst` – oluline positiivne skoori- või komponendimuutus;
- `new risk` – oluline negatiivne muutus;
- `needs review` – segatud muutus, puuduv võrdlus või mudeliversiooni vahetus;
- `no major changes` – vähemalt 10-punktilist või olulist komponendi seisundimuutust ei leitud.

Detailist näeb vana ja uut skoori, muutunud komponente, mudeliversiooni ja snapshot'i ID-sid. See on ülevaatuse signaal, mitte kauplemiskorraldus.

## „Leia järgmine RKLB”

Skänneri preset otsib olemasolevast kogutud universumist RKLB-laadset varajase kasvu mustrit, mitte sama sektorit. RKLB ise jäetakse tulemustest välja.

Kaasamise baasreeglid:

- Growth vähemalt 65;
- Coverage vähemalt 70;
- teadaolev market cap kuni 75 miljardit;
- vähemalt üks katalüsaator: earnings 45 päeva jooksul, SEC sündmus 30 päeva jooksul või uudis 14 päeva jooksul.

Iga kriteerium kuvatakse eraldi olekuga `supported`, `uncertain` või `missing`. Kandidaadikaart näitab põhjuseid, runway'd, riske, puuduvaid andmeid ja küsimusi, mida investor peab moat'i ning mispricing'u kohta ise tõendama.

Rakendus ei arvuta „RKLB tõenäosuse” koondskoori. Kui ükski ettevõte filtreid ei läbi, kuvatakse null kandidaati.

## Discovery valideerimine

Iga „Leia järgmine RKLB” avamine salvestab otsusesnapshoti. Sama päeva täiesti identne sisend taaskasutab varasemat run'i; muutunud faktid loovad uue run'i. Snapshot sisaldab kõiki vaadeldud tickereid, mitte ainult lõplikke kandidaate.

Leht **Validation** näitab:

- millal ja millise mudeliversiooniga discovery käivitati;
- millised tickerid kaasati ning millised jäeti välja;
- täpset kaasamise või välistamise põhjust;
- otsusehetke hinda, market cap'i, Growth/Health/Coverage skoore, runway-kirjeldust, katalüsaatorit, riske ja teadmata infot;
- kaasatud kandidaadi tegelikku hinnamuutust 1 nädala, 2 nädala, 1 kuu, 3 kuu ja 6 kuu järel.

Horisondi tulemuseks võetakse esimene hinnasnapshot sihtajal või järgneva seitsme päeva jooksul. Kui selles aknas hinda pole, märgitakse tulemus puuduvaks. Tulemusi värskendatakse igapäevase kogumise lõpus ja ka Validationi lehe avamisel. Mõõdetud tulemust hilisema backfill'i tõttu ümber ei kirjutata. Eri horisonte kuvatakse eraldi, et 1 nädala ja 6 kuu tulemused ei satuks eksitavalt samasse keskmisesse.

Runway väli ei väida kuude arvu, sest praegune andmestik ei arvuta rahapõletuse põhjal usaldusväärset runway'd. Kuvatakse Financial Healthi ja cash/debt komponendi tegelik olemasolev tõend.

## Validation ja Backtest

**Validation** vastab küsimusele: „Mida iga salvestatud discovery run otsuse hetkel nägi ja mis juhtus iga kandidaadiga hiljem?” See on detailne otsuselogi, kus näeb ka välja jäetud tickereid ja välistamise põhjuseid.

**Backtest V1** vastab küsimusele: „Kuidas kõik seni mõõdetud discovery candidate outcome'id horisondi kaupa kokku võtavad ja kuidas need võrdlesid SPY-ga?” Backtest ei käivita tänast skännerit vanade kuupäevade peal ega vali minevikku ümber.

Backtesti põhireeglid:

- kasutatakse ainult varem salvestatud `discovery_runs`, `discovery_decisions` ja `candidate_outcomes` andmeid;
- candidate return on kandidaadi otsusehetke hinna ja fikseeritud horisondi lõpphinna muutus;
- benchmark return kasutab SPY run'i-eelset salvestatud algushinda ja sama horisondi lõpphinda;
- excess return = candidate return miinus benchmark return;
- puuduva SPY algus- või lõpphinna korral jäävad benchmark ja excess `unknown`, mitte 0%;
- juba mõõdetud candidate ja benchmark outcome'e hilisema backfilliga ümber ei kirjutata;
- null kandidaati on korrektne tulemus.

1 nädala ja 2 nädala tulemused võivad olla väga mürased: neid mõjutavad turu üldine liikumine, üksikud uudised, madal likviidsus ja juhuslik ajastus. 3 kuu ja 6 kuu tulemused annavad teesi ning katalüsaatorite avaldumiseks rohkem aega ja on seetõttu protsessi hindamisel üldiselt informatiivsemad. Pikem horisont ei tee väikest valimit automaatselt usaldusväärseks; alati vaata ka kandidaatide ja benchmark'iga mõõdetud ridade arvu.

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
- Rakendus ei sisalda veel ausat backtesti, sector-relative ranking'ut ega IPO/Nasdaq uute noteeringute radarit.

## Kahe arvuti kasutamine

Kood liigub Gitiga, kuid `.env` ja lokaalne PostgreSQL andmebaas mitte. Kummaski arvutis võib olla eraldi `.env`. Sama portfelli, Watchlisti, teeside ja ajaloo jaoks tee aktiivses arvutis DB dump ning taasta see teises arvutis. Täpsed käsud on failis `docs/HANDOFF.md`.
