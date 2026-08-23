# CompanyFacts enrichment queue audit — 2026-08-23

Status: **read-only investigation and options only. No queue, budget, collection, scoring, ranking, or canonical-discovery implementation changed.**

## Method and exact current behavior

The Neon audit ran at 2026-08-23 18:06 Europe/Tallinn inside `BEGIN READ ONLY` and ended with `ROLLBACK`. It did not call `collect:daily`, CompanyFacts refresh, or any writer.

The production queue in `src/lib/company-financials.ts:527-581`:

- includes non-SPY companies whose `quote_type` is not known as `ETF` and whose latest price is at most 30 days old;
- puts companies with no facts ahead of companies whose facts are more than seven days stale;
- for missing facts, permits never-attempted rows immediately, `error` after one day, and `unavailable` after 30 days;
- orders missing facts first, then never-attempted first, oldest prior attempt first, **newest latest-price timestamp first**, then ticker;
- takes the remaining part of a five-attempt Tallinna-day budget (`DAILY_FINANCIAL_ENRICHMENT_LIMIT = 5`, lines 105 and 632-684).

The budget is attempts, not successes. A successful CompanyFacts parse writes facts; unavailable/error still consumes a slot. The next canonical step runs after enrichment in `scripts/collect-daily.cjs:116-144` and `src/lib/collect-route-handler.ts:61-108`. A newly successful ticker can therefore enter that day’s evaluated canonical universe when the day does not already have an immutable canonical snapshot. Inclusion as a candidate is a stricter later question: `rklb-discovery.ts:320-367` also requires calculable Growth, Growth at least 65, Coverage at least 70, and known market cap no greater than $75B.

In this report, **canonical scoring eligibility** means the first, narrower milestone: stored accepted CompanyFacts are available to `getAllStoredCompanyFinancials()` and the company can be evaluated/scored. It does not mean it will pass the candidate filters.

## Real state of run #16’s insider items

Run #16 has 16 `lookup_bucket = insider` items, but only **14 were newly created company identities**. KEEL and GO already existed. The earlier phrase “16 new insider companies” was imprecise.

| Insider rank | Ticker | Current facts / canonical state | Current queue position | Frozen-queue attempt day |
|---:|---|---|---:|---:|
| 1 | GWRS | 0 facts, 0 scores, 0 decisions | 7 | 2 |
| 2 | COE | 0 facts, 0 scores, 0 decisions | 4 | 1 |
| 3 | AAT | 0 facts, 0 scores, 0 decisions | 1 | 1 |
| 4 | ALK | 0 facts, 0 scores, 0 decisions | 3 | 1 |
| 5 | ELAN | 0 facts, 0 scores, 0 decisions | 6 | 2 |
| 6 | DXST | 0 facts, 0 scores, 0 decisions | 5 | 1 |
| 7 | MED | 0 facts, 0 scores, 0 decisions | 9 | 2 |
| 8 | INV | 0 facts, 0 scores, 0 decisions | 8 | 2 |
| 9 | NOMD | 0 facts, 0 scores, 0 decisions | 11 | 3 |
| 10 | NAKA | 0 facts, 0 scores, 0 decisions | 10 | 2 |
| 11 | UUU | 0 facts, 0 scores, 0 decisions | 15 | 3 |
| 12 | KEEL | 44 facts, 1 score snapshot, 15 decisions; already eligible | stale-refresh position 100 | already eligible |
| 13 | ZWS | 0 facts, 0 scores, 0 decisions | 16 | 4 |
| 14 | GO | 239 facts, 1 score snapshot, 11 decisions; already eligible | stale-refresh position 105 | already eligible |
| 15 | AFCG | 0 facts, 0 scores, 0 decisions | 2 | 1 |
| 16 | PCF | 0 facts, historical fund edge | 12 | 3 |

Every one of the 14 uncovered rows has a fresh price, no `financial_enrichment_status`, no SEC CIK on `companies`, and has never been attempted. Task 1 prevents PCF from being selected in future runs, but it deliberately did not rewrite run #16 or delete PCF, so the historical PCF row remains eligible in the generic queue because its `quote_type` is NULL. That is a consequence to review, not silently clean up.

## Timing estimate

Today’s five-slot budget was already exhausted before run #16. The real attempts were CBRS, IBKR, IT, SNDK, and SNOW; all five are stored as success. Run #16 therefore attempted zero insider companies.

If the queue froze now, one successful daily collection occurred on each subsequent Tallinna day, and every attempt yielded usable facts:

- the first 12 queue positions contain 12 uncovered run-#16 insider items;
- SPCX and TTWO occupy positions 13 and 14;
- UUU and ZWS occupy positions 15 and 16;
- the 14 uncovered historical items would all be attempted by the **fourth** available collection day;
- excluding the known PCF fund leaves 13 legitimate uncovered issuers, but ZWS still makes the lower bound four days;
- KEEL and GO are already scoring-eligible, so there is no ten-day wait for those two.

Thus **four collection days is the current fixed-queue lower bound, not a promised completion date**. “All reach eligibility” cannot be guaranteed before the responses are processed: an `unavailable` result creates no scorable facts and is not retried for 30 days; an error waits at least one day.

The live queue contains **120 eligible rows: 81 with no facts and 39 stale-fact refreshes; 85 have no recorded enrichment attempt**. At five attempts/day, a completely frozen backlog takes 24 collection days to service once, and the missing-facts tier alone takes at least 17 days. More importantly, the tie-breaker is latest price **descending**, not FIFO. A later collection that creates or reprices never-attempted companies gives them a newer timestamp and can move them ahead of today’s rows. The current unresolved never-attempted/missing-fact population includes bursts of 23 identities created on Aug 19 and 14 on Aug 23, both greater than the five-slot service rate. Continuous arrival at five or more eligible rows/day can postpone an incumbent indefinitely.

## Options for later review

### 1. Keep the queue unchanged

Pros:

- no source favoritism and no new policy;
- today’s 13 legitimate uncovered insider issuers are already near the front;
- no increase in SEC load or collection runtime.

Cons:

- newest-price-first admits starvation when fresh arrivals exceed five/day;
- the 120-row backlog shrinks slowly;
- on-demand Form 4 ingestion can add a burst of up to 20 issuer lookups at once;
- historical PCF can still consume a generic enrichment slot.

### 2. Give insider-sourced rows absolute priority within the existing five

Detect a recent `collection_run_items.raw_signal.insider`/selection path and order those missing-fact rows first.

Pros:

- a fresh 20-issuer Form 4 batch is attempted in at most four collection days if every slot goes to it;
- no SEC request-budget increase;
- directly closes the discovery-to-scoring delay.

Cons:

- social/general backlog can starve;
- “recent insider” needs a precise, versioned recency/provenance definition;
- social-precedence rows can also contain insider evidence, so checking only `lookup_bucket = insider` is incomplete;
- historical fund/false-positive rows need an explicit policy rather than inheriting priority forever.

### 3. Reserve part of the existing budget for insider rows

For example, reserve two of five slots for eligible Form 4-sourced companies and let unused reserved capacity spill back to the general queue.

Pros:

- bounded insider latency without fully starving the existing backlog;
- total SEC load remains unchanged;
- explicit source allocation is observable and testable.

Cons:

- at two reserved slots/day, 13 legitimate uncovered issuers require at least seven collection days if only reserved slots serve them;
- general throughput drops from five to three on days when the reserve is full;
- still needs versioned provenance/recency and fair spillover semantics.

The exact split (1/4, 2/3, or 3/2) is a product-policy choice; this audit does not choose it silently.

### 4. Raise the daily budget for every source

Raise the default from 5 to 10, keeping the same queue order.

Pros:

- source-neutral and mechanically simple;
- current positions 1–16 would be attempted within two collection days if the queue froze;
- the current 120-row frozen backlog drops from 24 to 12 service days.

Cons:

- doubles SEC CompanyFacts calls and per-run writes;
- today’s five real successes took about 23 seconds from first to last attempt, so ten similar attempts would roughly double this phase’s wall time;
- does not solve newest-first starvation if future eligible arrivals reach or exceed the new budget;
- the new limit needs runtime, SEC pacing, failure-rate, and canonical-universe-churn evidence before approval.

The existing 175 ms inter-request delay is approximately 5.7 requests/second before network latency and remains below the SEC-wide 10 requests/second ceiling, but rate compliance alone is not evidence that doubling the daily application budget is the right product tradeoff.

### 5. Add a one-off immediate enrichment path after insider selection

Pros: shortest apparent path from Form 4 selection to facts.

Cons: duplicates queue/retry/budget behavior, couples discovery to SEC availability, makes the five/day ledger ambiguous, and creates a second production writer path. This is the most structurally disruptive option and is not recommended.

## Recommendation for the next decision

Do not implement from this three-hour session. The meaningful choice is between:

- a **bounded reserved quota** if predictable Form 4 latency is worth explicitly reducing general-queue capacity; and
- a **source-neutral budget increase** if the goal is reducing the entire 120-row backlog and measured runtime/SEC load are acceptable.

The user is leaning toward the **source-neutral budget increase** because it addresses the complete 120-row backlog without provenance-specific allocation complexity. No number is approved. Before choosing one, collect 7–14 valid daily observations of new eligible entrants, attempts/success/unavailable/error, queue depth before/after, and oldest never-attempted age.

The approved next step is still evidence gathering, not a budget change. [`docs/COMPANYFACTS_QUEUE_OBSERVATION_PLAN.md`](COMPANYFACTS_QUEUE_OBSERVATION_PLAN.md) specifies a no-migration proposal: paired standalone `BEGIN READ ONLY` snapshots around the existing scheduled collector, saved as bounded-retention workflow artifacts rather than database rows. `financial_enrichment_status` stores only the latest attempt per company and current collection-run metrics omit enrichment results, so the paired snapshots preserve the required short calibration series without changing the golden-source schema.

## Scope boundaries

- no change to the five/day budget, queue ordering, retry windows, or SEC client;
- no change to Form 4 selection, collection, canonical discovery, scoring, ranking, or filters;
- no Neon write, collect, ingestion, migration, cleanup, or historical backfill;
- no assumption that an attempted company will yield enough facts to pass Growth/Coverage candidate filters.
