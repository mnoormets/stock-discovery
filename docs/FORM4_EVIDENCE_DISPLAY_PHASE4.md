# SEC Form 4 Phase 4 — candidate-card evidence proposal

Status: **Implemented and verified through Slice 4. The V1 UI is `/today`-only; scoring, ranking, canonical discovery, migrations, and historical rows are unchanged.**

Date: 2026-08-23

## Objective and assumptions

Phase 4 should let a researcher inspect the Form 4 purchase that caused an issuer to enter the insider lookup path. The surface contains raw, source-linked facts only: reporting owner, explicit owner role(s), transaction date, shares, reported price per share, derived notional, and the SEC filing link. It must not imply that an insider purchase predicts returns or is a buy recommendation.

The initial surface is assumed to be the canonical candidate card on `/today`, because that read model already links an immutable `discovery_decision` to its `collection_run_item`. The reusable component may later be used on `/scanner` or company detail, but only when those views have an equally explicit point-in-time provenance contract. Expanding Phase 4 to every company page without that contract is an alternative, not part of the recommended first increment.

## Confirmed current architecture

- `insider_filings`, `insider_reporting_owners`, `insider_transactions`, transaction footnotes, and `insider_transaction_owner_evidence` already persist every required normalized fact. The evidence view has one transaction/reporting-owner pair and exposes owner name; separate director, officer, 10%-owner, other, and no-declared-role flags; officer title; shares; price; derived notional/method; accession; dates; and SEC URLs.
- Future Phase 4 collection items freeze a versioned `insider` object in `collection_run_items.raw_signal` with the complete selected transaction and reporting-owner facts. Historical snapshots such as run #16 remain unchanged and do not gain fields from live Form 4 tables.
- `today-brief.ts` joins `discovery_decisions.collection_run_item_id` to `collection_run_items`, reads `raw_signal` inside its existing read-only transaction, and exposes only a strictly parsed `TodayInsiderEvidence` subtree. Legacy and malformed payloads fail closed without throwing.
- A candidate may have Form 4 evidence even when bucket precedence labels it `growth` or `recall`; the evidence condition is `raw_signal.insider != null`, not `lookup_bucket === 'insider'`.

## Alternatives

### A. Live join from the normalized Form 4 tables

Resolve the transaction IDs in `raw_signal` against `insider_transaction_owner_evidence` whenever a card renders.

Pros:

- no duplication of owner and transaction fields in JSONB;
- run #16 could gain more detail immediately.

Cons:

- the card would no longer be wholly reconstructable from decision-time evidence;
- a parser correction, owner-row change, or later amendment resolution could change an old card;
- absence could mean either “not known then” or “join failed now”;
- it encourages a read path to depend on the latest operational ingestion state.

This does not fit the project’s “as known at the time” constraint well enough for the primary design.

### B. Freeze the complete selected evidence in `raw_signal` — recommended

When the selector constructs the qualifying transactions, include the exact owner, role, transaction, derivation, and SEC URL fields in the collection item’s versioned insider evidence object. `today-brief.ts` reads only this snapshot.

Pros:

- old decisions remain reproducible and source-linked;
- the card does not write or refresh anything;
- social/insider overlap is represented without changing bucket precedence;
- no relational schema migration is required because the normalized source tables already exist and `raw_signal` is JSONB.

Cons:

- a small amount of normalized data is duplicated per selected issuer/run;
- run #16 remains partial unless a separately reviewed historical backfill is authorized;
- the snapshot contract needs an explicit version and validation tests.

### C. Add a dedicated decision-evidence snapshot table

Create an immutable table keyed by collection item or discovery decision.

This offers relational constraints and queryability, but adds a migration, lifecycle, idempotency, and historical-linking surface for a bounded evidence payload already naturally owned by `collection_run_items.raw_signal`. It is disproportionate for Phase 4 V1.

## Recommended evidence contract

Add `evidenceVersion: "form4-card-evidence-v1"` under `raw_signal.insider` for future collection items. Each selected transaction snapshot should contain:

- `transactionId`, `accessionNumber`, `formType`, `filedDate`, `transactionDate`;
- `securityTitle`, `shares`, `reportedPricePerShare` as lossless decimal strings or `null`;
- `derivedNotional` as a lossless decimal string or `null` and `derivedNotionalMethod` explicitly equal to `transaction_shares_x_transaction_price_per_share` when computed;
- `filingUrl`, preferring `sec_primary_document_url` and falling back to `sec_submission_url`;
- `owners[]`, each with `ownerName`, `ownerCik`, `isDirector`, `isOfficer`, `isTenPercentOwner`, `isOther`, `hasNoDeclaredRole`, `officerTitle`, and `otherText`.

Decimal strings avoid JavaScript rounding in a raw-fact surface. The read model may format them for humans but must retain the stored values. Missing price or shares stays visibly `unknown`; it must not become zero. A missing derived notional remains unknown rather than estimated from another market-data source.

Every owner row must render its role labels explicitly. Examples are `Director`, `Officer — Chief Financial Officer`, `10% owner`, and `Other — …`. Multi-label owners show every applicable label. Neither the data contract nor the UI may collapse these fields into a generic `Insider` or `Management` badge.

## Proposed read model and card treatment

`today-brief.ts` would select `i.raw_signal AS collection_raw_signal`, validate only the versioned Form 4 evidence subtree, and expose a nullable `TodayInsiderEvidence` on `TodayCandidate`. Malformed or legacy payloads fail closed to an honest partial/unknown state; they do not crash the page.

Inside the candidate card’s existing expanded evidence area, add a sibling section to catalyst evidence:

- heading: `SEC Form 4 purchase evidence` plus `form4-card-evidence-v1`;
- one factual transaction row per selected purchase: date, security title, shares, reported price/share, and `Derived notional = shares × reported price`;
- reporting-owner rows immediately beneath the transaction, with all role labels always visible;
- `Filed <date>` and `Open SEC filing ↗`;
- source-state note: `Captured from on-demand Form 4 ingestion; source filed date <date>. This is not a daily-completeness claim.`

The card should not display conviction, confidence, bullish/bearish, notable-quality, or score language. It should not add a top-card priority badge. If space is limited, the evidence section may be collapsed by default, but the owner role must be visible as soon as the section is opened and must not be hidden behind a second technical-details disclosure.

Legacy collection items such as run #16 should show only fields actually frozen in that snapshot plus `Detailed owner/share/price evidence was not captured for this historical collection item.` There should be no automatic live-table fallback and no historical backfill in Phase 4 V1.

## Relationship to catalyst evidence

The useful catalyst pattern is structural: a typed read model, event date, raw description, evidence state, and a primary-source link within the card. Form 4 evidence deliberately differs in one respect: it has no rule assessment, materiality tier, direction, novelty, thesis-relevance, or ranking effect. It is a parallel evidence item, not a catalyst event and not an input to the existing catalyst score/order.

## Tests required for a later implementation

- selector/snapshot test preserves lossless shares, price, derivation method, filing URL, and every owner role;
- multi-label regression proves director + officer + 10%-owner all render and `officerTitle` remains attached;
- 10%-owner label is visible even when director/officer is also true;
- social-precedence item with `lookup_bucket = growth` still exposes its Form 4 evidence;
- legacy/partial/malformed raw signal renders an explicit unknown/legacy state and does not crash;
- read-only test proves loading `/today` changes no participating table counts;
- UI test checks SEC link safety (`target="_blank"`, `rel="noreferrer"`) and missing numeric fields;
- isolation test proves Growth, Health, Coverage, catalyst fields, candidate rank, and inclusion remain byte-for-byte unchanged.

## Proposed implementation slices after review

1. **Implemented:** extend the Phase 3 selector query and `raw_signal.insider` snapshot contract; add persistence/legacy tests.
2. **Implemented:** add the strict `TodayInsiderEvidence` parser/read model and DB-level read-only tests.
3. **Implemented:** add a small reusable raw-fact component and render it on `/today`; add missing-data and multi-role UI tests.
4. **Implemented:** run the full verification chain, production build/restart, and read-only smoke checks. No historical rows were backfilled and no production collect was run.

No migration is expected for this recommended design.

## Slice 1 implementation — 2026-08-26

Future collection items with Form 4 evidence now freeze `evidenceVersion: "form4-card-evidence-v1"`. Each selected transaction contains accession/form/filed/transaction dates, security title, lossless string shares, lossless string reported price per share, lossless string derived notional, explicit derivation method, preferred primary-document URL with submission-URL fallback, 10b5-1 state, and every structured reporting owner with all independent role flags and role text.

The selector policy itself remains `form4-insider-selection-v1`: original Form 4 only, non-derivative `P+A`, director/officer required, derived notional strictly above 50,000, source freshness gate, fund exclusion, and maximum 20 issuers. Selection ordering and all aggregate issuer fields are unchanged. Existing unversioned payloads are neither mutated nor backfilled; the read model identifies them as legacy and the card renders the approved historical-item message.

## Slices 2–4 implementation — 2026-08-27

`today-insider-evidence.ts` validates the complete V1 subtree without converting decimal strings to JavaScript numbers. Required role flags, original Form 4, dates, the known derivation method, and an HTTPS SEC filing URL are structural guards. Missing insider evidence returns `null`; unversioned evidence is `legacy`; invalid or unknown-version evidence is `malformed`; neither partial state exposes transaction rows.

`Form4PurchaseEvidence` renders raw facts only inside the existing expanded `/today` candidate evidence area. It shows `Reporting owner(s)` and every applicable role label, preserves reported numeric strings, displays missing values as `unknown`, adds no currency symbol, and links safely to the frozen SEC URL. Complete snapshots include the on-demand-ingestion source-date caveat. Legacy and malformed snapshots show `Detailed owner/share/price evidence was not captured for this historical collection item.` with no live-table fallback.

Focused Slice 2 verification passed 26/26 tests; focused Slice 3 verification passed 32/32 tests. Final verification passed typecheck, lint, 376/376 tests across 43 files, and the 21/21-page production build. The app was restarted after the build and read-only smoke checks returned HTTP 200 for `/` and `/today`.

## Approved design decisions — 2026-08-23

- Use Option B: freeze the complete selected evidence in the future collection item's versioned `raw_signal.insider` snapshot. Do not render historical cards from live joins to the operational Form 4 tables.
- Label filing participants `Reporting owner(s)`, not `Purchaser(s)`. The current normalized association proves who reported the filing but does not always prove transaction-specific execution in a joint filing.
- Do not prepend `$`, borrow Yahoo quote currency, or otherwise imply a currency unless the filing explicitly establishes it. Numeric price and derived-notional values remain reported units when currency is unknown.
- Limit V1 display to canonical candidate cards on `/today`.
- Do not backfill run #16 or any other legacy collection item. Render the honest message `Detailed owner/share/price evidence was not captured for this historical collection item.` when the complete immutable payload was not captured.

These approved decisions are implemented in Phase 4 V1.

## Explicit non-goals

- no new score, weighting, rank, filter, alert, recommendation, or sentiment;
- no change to `buildCandidates()`, social inputs, canonical eligibility, or market-cap rules;
- no replacement of ApeWisdom and no new external source;
- no Form 4 ingestion scheduling or completeness claim;
- no amendment policy change and no 4/A selection change;
- no historical evidence backfill;
- no UI implementation in this design task.
