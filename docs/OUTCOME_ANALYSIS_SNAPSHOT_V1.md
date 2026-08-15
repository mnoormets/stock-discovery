# Outcome Analysis Snapshot V1

## Eesmärk

Õppida mõõdetud forward outcome'idest ilma tänaste andmetega minevikku ümber
seletamata. Snapshot on kirjeldav auditikiht, mitte uus strateegia, ranking,
skoor või kauplemissoovitus.

## Lubatud sisendid

Snapshoti build-päring loeb ainult:

- `discovery_decisions` — otsusehetke growth, coverage, catalyst tier, mandate
  relevance ja canonical/manual/unknown scope;
- `candidate_outcomes` — horisont, kandidaadi tootlus, benchmark'i tootlus ja
  excess return;
- `data_quality_snapshots` — sama run'i otsusehetke kvaliteet;
- `collection_run_items` — sama tickeri growth/recall provenance ja lookup'i
  tulemus.

Live `price_snapshots`, `financial_facts`, `company_score_snapshots`, catalysti
runtime-tabelid ega tänased company-andmed snapshoti ei mõjuta.

## Semantika

- üks `outcome_analysis_snapshots` rida ühe measured `candidate_outcomes.id`
  kohta;
- `winner`: kandidaadi `return_percent > 0`;
- `benchmark beat`: `excess_return_percent > 0`;
- need kaks tunnust on eraldi — negatiivse tootlusega kandidaat võib langevat
  benchmark'i siiski võita;
- puuduv sisend annab `unknown`/`NULL` ja nähtava warning'u;
- vanad otsused, mille canonical/manual scope'i ei salvestatud, on `unknown`;
  vaikimisi summary ei sega neid canonical forward-kohordiga.

## Lifecycle ja muutumatus

`refreshCandidateOutcomes()` proovib esmalt mõõta kandidaadi ja benchmark'i ning
salvestab seejärel kõik puuduvad measured outcome-analysis snapshotid. Sama
outcome kordus tagastab olemasoleva rea. Teise snapshot-versiooniga vaikne
overwrite on keelatud.

Andmebaasi trigger keelab snapshotirea `UPDATE` ja `DELETE`. Hilisem benchmark'i,
hinna, skoori või muu source-andme backfill ei muuda juba salvestatud snapshoti.
Kui benchmark polnud capture-hetkel teada, jääb benchmark-beat alatiseks
`unknown`.

## Analüüs

`getOutcomeAnalysisSummary()` kasutab vaikimisi ainult `canonical` scope'i ja
annab eraldi winner- ning benchmark-beat määra järgmiste lõigete kaupa:

- growth / recall / not-selected / unknown bucket;
- winner / not-winner;
- catalyst evidence tier;
- mandate relevance.

Samades gruppides on keskmine growth, coverage ning SEC/score/recent-price
data-quality coverage. Väike valim ei tõesta põhjuslikkust ega strateegia
toimivust.
