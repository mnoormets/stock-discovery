# CompanyFacts queue observation plan

Status: **implemented as a standalone read-only observer and non-blocking GitHub Actions artifact capture; no queue, budget, migration, or database-write change.**

Date: 2026-08-23

## Decision this evidence should support

The current preference is a source-neutral increase to `DAILY_FINANCIAL_ENRICHMENT_LIMIT` rather than a Form 4 reserved quota, because it would address the complete eligible backlog without adding source-provenance priority rules. No new limit is selected yet. First collect 7–14 valid daily observations of arrivals, service outcomes, queue movement, and waiting age.

## Recommended no-migration observer

The approved implementation adds `scripts/report-companyfacts-queue.cjs` and `npm run observe:companyfacts`. It:

- open one database connection and execute every query inside `BEGIN TRANSACTION READ ONLY`, followed by `ROLLBACK`;
- issue only `SELECT` statements and make no SEC, Yahoo, or other network request;
- avoid importing `collect.ts`, CompanyFacts writers, or any application route with write-on-read behavior;
- emit a versioned `companyfacts-queue-observation-v1` JSON document to stdout or a caller-supplied local file;
- report the database name and observation time, but never log `DATABASE_URL` or credentials.

This needs no schema migration and writes no database rows. A report file or CI artifact is calibration telemetry outside the golden source, not a new application data source. The current schema does not store a lifetime per-company attempt count, so the artifact emits `attemptCount: null` plus `attemptCountAvailability: "not_stored"`; it does preserve exact paired-window attempts and the stored `consecutiveFailures` value rather than inventing history.

## Paired daily capture

The most useful lightweight arrangement is two snapshots around the existing scheduled collector:

1. Capture `before` immediately before `npm run collect:daily`.
2. Capture `after` in an `if: always()` step immediately after it, so collector failures remain visible.
3. Combine both snapshots and the collector exit status into one dated JSON/NDJSON report.
4. Upload that report as a private workflow artifact with a bounded retention period, such as 30 days.

This is orchestration around the existing command, not a production-pipeline rewrite. Both observer steps and artifact upload use `continue-on-error: true`; a telemetry failure cannot block collection or retroactively fail a successful collector. Each observer step also has `timeout-minutes: 1`, while the PostgreSQL pool uses a 10-second connection timeout and 30-second statement timeout, so a hung observation cannot consume the workflow's full 10-minute job budget before `collect:daily` runs. The after step uses `if: always()` so collector failures remain represented as partial observations. Artifacts are private workflow artifacts retained for 30 days.

## Required observation fields

Each snapshot should include:

- `schemaVersion`, `observedAt`, Tallinn calendar date, and `phase` (`before` or `after`);
- total eligible queue depth, split into missing facts and stale facts;
- never-attempted count;
- oldest never-attempted company's first-observed timestamp and age in days, using `companies.created_at` and labeling it explicitly as a proxy for first eligibility;
- the ordered eligible queue as stable company ID/ticker records, or at minimum enough identifiers to compare membership safely;
- the latest `financial_enrichment_status` state per eligible or newly attempted company: status, last attempt time, attempt count, and error category without unrestricted error text;
- attempts during the paired interval, split into `success`, `unavailable`, and `error`;
- queue depth and oldest-age deltas.

The paired set comparison can measure arrivals that a post-run count alone would miss:

- `remaining entrants` are eligible after the run but absent before it;
- `entrant and serviced in the same run` is absent from the before queue but has a new attempt timestamp within the observed interval;
- their union is the run's observed new eligible entrants.

That derivation should be labeled an observation-window result. Over the few minutes of a normal collection it is materially stronger than estimating from company creation dates, but a failed or unusually long run must remain marked invalid or partial rather than silently folded into the normal daily rate.

## Review window and decision summary

Collect at least seven valid collection days and prefer fourteen. Preserve failed and duplicate-day runs in the report, but exclude them explicitly from normal throughput percentiles. The eventual review should show:

- daily entrants: median, p75, p95, and range;
- attempts and success/unavailable/error rates;
- queue-depth slope before to after and across days;
- oldest-never-attempted age slope;
- service ratio (`attempts / observed entrants`);
- simple source-neutral counterfactual clearance estimates for candidate budgets such as 8, 10, and 12, clearly labeled as estimates rather than replayed outcomes.

A higher source-neutral budget becomes evidence-supported only if arrivals and oldest-wait age show that five attempts/day is not keeping up, while observed success/error behavior and runtime remain acceptable. The actual number remains a future user decision.

## Scope boundaries

- no migration, database write, attempt ledger, or collection-run metric change;
- no change to `DAILY_FINANCIAL_ENRICHMENT_LIMIT`, queue ordering, retry windows, or SEC pacing;
- no Form 4 priority or reserved capacity;
- no `collect:daily`, ingestion, or other Neon write is authorized by this proposal;
- no scoring, ranking, `buildCandidates()`, or canonical-discovery change.

## Implemented commands and artifacts

The workflow writes these files under `artifacts/companyfacts-queue/`:

- `before.json` and `after.json`: versioned point-in-time snapshots;
- `observation.json`: paired result with collector outcome, validity, deltas, interval attempts, and observed entrants;
- `observation.ndjson`: before, after, and paired-summary records for later multi-day analysis.

The before form is:

```bash
npm run observe:companyfacts -- --phase before --output artifacts/companyfacts-queue/before.json
```

The after form adds `--before`, `--collector-status`, `--collector-mode`, `--report`, and `--ndjson`. Direct execution only reads the configured database inside `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` and ends with `ROLLBACK`; it makes no provider request. Connections fail after 10 seconds and individual statements after 30 seconds; the workflow independently terminates either observer step after one minute.
