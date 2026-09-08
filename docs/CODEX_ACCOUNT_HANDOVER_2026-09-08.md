# Codex account handover — 8 September 2026

This document lets a new Codex account continue the project without relying on the old account's chat history. It supplements, rather than replaces, [HANDOFF.md](HANDOFF.md), which remains the living product and delivery record.

## Repository and verified baseline

- Workspace: `D:\stock-discovery`
- Remote: `https://github.com/mnoormets/stock-discovery.git`
- Branch: `main`
- Starting `main` baseline before this document is committed: `fdcdddbbb285747755c642c052fdf76d647623f5`
- Latest commits:
  - `fdcdddb Record reconciliation publication`
  - `6760c47 Reconcile BW debt and API liquidity`
  - `a5dedd4 Record financial correction publication`
  - `717b2a9 Correct financial inputs and valuation guards`
  - `2024bd7 Review three theses and record price-tracking publication`
  - `aaf537c Track research prices continuously and qualify stale valuations`

The working tree contains only pre-existing, untracked local artifacts: several `*.dump` database backups, `96.3`, and `task-fixed.xml`. They are deliberately excluded from commits. Do not delete, add, move, or upload them without the user's explicit instruction.

At the initial handover inspection on 8 September, Docker Desktop was unavailable on this Windows host. After the user started Docker, `db` became healthy and `app` was started. The current smoke check is recorded below; no build, test run, collection command, migration, or direct production-data write was performed for the handover itself.

## Product context and user intent

The product is a personal investment-research tool. The user confirmed that the goal is to improve their own investing results, not sell subscriptions. It should turn intuition into source-backed, falsifiable investment theses and preserve what was known at the time of each decision.

Non-negotiable product rules:

- A high score means **research further**, never buy or sell.
- Keep facts, mechanical inferences, and user assumptions separate.
- Show inputs, source links, periods, coverage, model versions, and unknowns.
- Do not add an external data source, paid product, automated trading, opaque aggregate score, or hindsight backfill without an explicit user decision.
- Preserve immutable discovery decisions, score snapshots, outcomes, and thesis history. A formula change needs a new version; do not rewrite old records.

Read [AGENTS.md](../AGENTS.md), [README.md](../README.md), and [HANDOFF.md](HANDOFF.md) before making material changes. `AGENTS.md` requires updating `HANDOFF.md` after material work and requires real test/build/runtime evidence before declaring work complete.

## Architecture and environment

| Area | Current arrangement |
|---|---|
| Application | Next.js 14.2.35, React 18, TypeScript, Node 22 |
| Canonical production data | Neon PostgreSQL database named `neondb` |
| Local PostgreSQL | Docker service `db`; its `discovery` database is a frozen pre-cutover snapshot and must not receive production writes |
| Test database | Disposable local `discovery_test`, created/reset by the Vitest harness from migrations |
| Market/source data | Existing Yahoo, SEC EDGAR/CompanyFacts, ApeWisdom, optional FMP fallback, and application data only |
| App URL | `http://localhost:3005` when Docker is running |
| Time zone | `Europe/Tallinn`; collection dates use Tallinn calendar days |
| Migrations | `db/migrations/0001_baseline.sql` through `0010_thesis_valuation_review.sql`; all 0001–0010 are applied to Neon |

`docker-compose.yml` deliberately forces the app service to receive `DATABASE_URL` from `.env`. It should point to Neon. This prevents the application from silently falling back to the frozen local `db` database. `.env.local` can override `.env` for host-run Next processes, so verify the effective database target before using host `npm run dev`.

Secrets are ignored by Git and are not included here. A new environment needs a securely transferred `.env` containing at least:

```text
DATABASE_URL=<Neon golden-source URL>
CRON_SECRET=<long random value>
SEC_USER_AGENT=<identifying SEC-compliant application/contact string>
```

`FMP_API_KEY` and `HEALTHCHECKS_PING_URL` are optional. GitHub Actions also requires `NEON_DATABASE_URL` and `SEC_USER_AGENT`; its workflow uses `workflow_dispatch` and an external cron-job.org trigger. The separate paper-execution workflow also requires `NEON_DATABASE_URL`. Do not place secret values in Git, terminal transcripts, issues, or this handover.

## Recent work and where it lives

### Versioned valuation decision review — current workspace

Files: [0010_thesis_valuation_review.sql](../db/migrations/0010_thesis_valuation_review.sql), [thesis.ts](../src/lib/thesis.ts), and [Thesis Builder](../src/app/thesis/[positionId]/page.tsx).

Thesis Builder now records company-specific revenue, margin, cash-flow, dilution, valuation and downside assumptions, a reverse-valuation question, the next observable review trigger, and the exact company price snapshot shown when the version was written. Existing versions remain nullable and were not backfilled. Migration `0010` is applied to Neon; the full isolated suite passes 61 files / 477 tests and the rebuilt `/thesis/12` runtime page was visually checked without saving user content. See `docs/HANDOFF.md` for the backup, migration, and verification record.

### Forward price tracking — `aaf537c`

Files: [0009_price_tracking.sql](../db/migrations/0009_price_tracking.sql), [price-tracking.ts](../src/lib/price-tracking.ts), [price-observation.ts](../src/lib/price-observation.ts), [ASTRA_REVIEW_2026-09-06.md](ASTRA_REVIEW_2026-09-06.md).

- Tracking runs after the canonical snapshot and before outcome measurement in both collection entry points.
- It watches active/watch positions, positive net paper holdings, eligible unmeasured canonical picks, and SPY.
- It has a shared cap of 50 symbols per New York day and preserves provider `market_at` separately from receipt `captured_at`.
- Repeat quotes cannot manufacture extra history. Closed-market observations may support research but cannot be paper fills.
- The app withholds current setup and portfolio valuation where timestamps, currency, or marks are incomplete/misaligned.
- The initial live batch saved 18 Yahoo observations on 7 September. It did not change frozen canonical snapshot #64 or fabricate old missing outcome windows.

### Three thesis reviews — `2024bd7`

File: [THESIS_REVIEW_2026-09-07.md](THESIS_REVIEW_2026-09-07.md).

API, BW, and HIMS received dated source-backed review drafts with explicit assumptions, triggers, and unknowns. They did **not** overwrite the user’s five saved thesis versions or change conviction/status.

### Financial-input corrections — `717b2a9` and `a5dedd4`

Relevant files: [company-financials.ts](../src/lib/company-financials.ts), [valuation-evidence.ts](../src/lib/valuation-evidence.ts), [ValuationEvidence.tsx](../src/components/ValuationEvidence.tsx), [valuation-balance-dates.test.ts](../tests/unit/valuation-balance-dates.test.ts).

- HIMS derived H1 FCF is `-$15.161m`, derived only from same-filing, same-period OCF and separately disclosed productive-asset plus software investment. It does not double count a rounded aggregate investment tag.
- API’s normalized figure is an ordinary-share count. The UI does not silently call it ADS or fully diluted shares.
- `valuation-evidence-v2` withholds EV/Sales when cash and debt dates differ, are stale, future, or unknown. It does not treat partial debt as total debt.

### BW debt and API liquidity reconciliation — `6760c47` and `fdcdddb`

Primary reference: [BW_API_RECONCILIATION_2026-09-07.md](BW_API_RECONCILIATION_2026-09-07.md).

New runtime files:

- [reviewed-balance-sheets.ts](../src/lib/reviewed-balance-sheets.ts): reviewed, dated SEC components and deterministic totals.
- [ReviewedBalanceSheet.tsx](../src/components/ReviewedBalanceSheet.tsx): company-page table for BW and API only.
- [company-scores.ts](../src/lib/company-scores.ts): `scores-v2` requires cash and debt to have exactly the same `periodEnd` before adding the cash/debt component.
- [financial-signals.ts](../src/lib/signals/financial-signals.ts) and [research-brief.ts](../src/lib/research-brief.ts): `signals-v3` applies the same date guard before generating cash-versus-debt claims.

Facts now visible on the company pages, all at 30 June 2026:

| Company | Reported bridge | Important limitation |
|---|---|---|
| BW | Four debt carrying-value lines total **$276.843m**; cash/equivalents are **$308.634m**. Preferred stock (~$191.7m), finance leases ($27.822m), operating leases ($17.623m), and restricted cash ($74.196m) are separate. | The normalized CompanyFacts debt remains an old partial 2021 figure. The dated manual bridge does not alter it, does not calculate equity value, and does not use subsequent redemption news as a new balance-sheet total. |
| API / Agora | Broad liquidity is **$361.655m** (cash, short-term deposits/products, long-term deposits); borrowings total **$100.316m**; borrowing-only difference is **$261.339m**. 1 ADS = 4 ordinary shares; ~335.1m ordinary shares = ~83.8m ADS equivalents at period end. | Broad liquidity is not distributable cash or an EV adjustment. It excludes restricted cash and short-term investments, and needs a separate maturity/access/operating-reserve assumption before valuation. Diluted ADSs are an earnings denominator, not period-end shares. |

The key correction is BW: its 2026 cash had been compared with a debt fact from 2021. Under `scores-v2`, BW now has Financial Health **55/100** and **70% coverage**, without a cash/debt component. Its regenerated `signals-v3` brief no longer says cash covers that stale debt figure. Older `scores-v1` snapshots and `signals-v2` briefs remain immutable history.

## Database state and safety boundaries

The 7 September reconciliation check established these historical counts before its browser smoke:

| Table / measure | 7 September count |
|---|---:|
| `investment_theses` | 11 |
| `discovery_decisions` | 2,169 |
| `candidate_outcomes` | 845 |
| `paper_strategy_orders` | 144 |

On 8 September, the restored app was confirmed to connect to Neon database `neondb`; the counts had advanced through normal forward operations to 11 theses, 2,308 decisions, 875 outcomes, and 168 paper orders. It also held 139 `scores-v2` snapshots and two `signals-v3` briefs. Do not compare these counts to the 7 September figures as an immutability assertion: they represent different points in the live system's forward history. The two versions still preserve prior snapshots/briefs rather than rewriting them.

Important write behavior:

- Several read routes write on read: company detail may refresh stale SEC facts and save score snapshots; scanner/watchlist/daily can save score snapshots; `/scanner?preset=rklb` can save a discovery run; `/validation` and `/backtest` can refresh outstanding outcomes.
- Manual `rklb` scanner runs do not create `candidate_outcomes`; only canonical `rklb_daily` runs do.
- Treat browsing production pages as potentially mutating the golden source. Capture before/after counts when a task needs to prove historical records were preserved.
- The migration runner is fail-closed: only `*_test` and `*_tmp` databases can be changed without a flag. Applying to Neon requires `--allow-golden-source`, a preflight, and a fresh verified backup. See [db/migrations/README.md](../db/migrations/README.md).

## Current operational status

- The last three core collections (#30–32, 4–6 September) succeeded. Canonical v3 runs #62–64 evaluated 119/124/129 companies and selected six each.
- The current v3 policy has nine canonical days, 54 selected decisions across nine tickers. Only eight 1-week outcomes across four tickers are measured; 262 v3 horizons remain pending. Canonical v2 has 63 measured outcomes across seven tickers, 53 missing and 284 pending. This is far too little independent evidence to claim a profitable strategy.
- The all-picks baseline currently has 42 filled stock buys and 42 matching SPY buys. Entry-aware's strategy book has one fill and 41 skips: 17 missing history, 17 missing both history and current-collection confirmation, and seven missing confirmation only. Do not lower gates merely to create trades.
- The tracker was independently observed through unattended 7 and 8 September runs. The 7 September batch recorded all 18 unchanged Friday quotes. GitHub `collect-daily #21` on 8 September completed its core writes but exited 1 after the tracking gate labelled all 18 Friday quotes stale before Tuesday's market open. The root cause was a weekday-only freshness rule across the US Labor Day closure. The code now excludes the NYSE's published 2026–2028 full-day holidays, falls back conservatively outside that schedule and preserves the historical attempt rows unchanged. New-SHA replay `collect-daily #22` succeeded in 19m47s, reused canonical run #67 and its 24 paper orders, created no duplicate decisions or outcomes, reported zero tracking errors and sent the Healthchecks heartbeat with HTTP 200.
- On 8 September after Docker was restored, `db` was healthy and `app` was running on port 3005. `/today`, `/company/BW`, and `/company/API` returned HTTP 200. BW rendered `scores-v2` and its total-borrowings reconciliation; API rendered broad liquidity and the ADS conversion. The holiday-recency correction then passed typecheck, lint and all 480 tests in 61 files. Its 22-route optimized build passed, the app was restarted, and `/today` plus `/performance` returned HTTP 200 with the new wording present. The fixed remote run and final Neon counters are recorded in `docs/HANDOFF.md`.

## Commands for a new environment

Run from the repository root. Prefer Docker because tests need the local PostgreSQL service even though the production app reads Neon.

```powershell
git clone https://github.com/mnoormets/stock-discovery.git
Set-Location stock-discovery
Copy-Item .env.example .env
# Securely set DATABASE_URL to Neon, CRON_SECRET, and SEC_USER_AGENT in .env.
docker compose up -d --build
```

Confirm the app’s target before any production-oriented action. It should use Neon, never `postgres://discovery:discovery@db:5432/discovery`.

```powershell
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:3005/today
```

Use the isolated test database for checks:

```powershell
docker compose exec -T app npm run typecheck
docker compose exec -T app npm run lint
docker compose exec -T app npm test
docker compose exec -T app npm run build
docker compose restart app
```

After a production build, restart `app` before smoke testing. For the recent BW/API work, the successful sequence was:

```powershell
docker compose exec -T app npm test
# Result: 60 files passed, 474 tests passed, 261.43 seconds
docker compose exec -T app npm run typecheck
docker compose exec -T app npm run lint
docker compose exec -T app npm run build
docker compose restart app
Invoke-WebRequest -UseBasicParsing http://localhost:3005/company/BW
Invoke-WebRequest -UseBasicParsing http://localhost:3005/company/API
```

Safe migration inspection:

```powershell
npm run migrate -- --status
npm run migrate -- --preflight
npm run schema:diff
```

Do **not** run `npm run migrate -- --allow-golden-source` against Neon unless the user has asked for a reviewed, backed-up migration apply. Read the migration README first.

Useful read/operation commands:

```powershell
npm run collect:status
npm run observe:companyfacts
npm run qa:valuation
npm run qa:data-quality
npm run qa:catalyst
npm run paper:strategy -- execute
```

`collect:daily` and `paper:strategy -- execute` can write production data when pointed at Neon. Check the current operational need and database target before running either.

## Next steps, in priority order

1. Restore Docker Desktop on this host or use a new environment, then verify the app connects to Neon and run the standard test/build/restart/smoke sequence before changing code.
2. Observe the next unattended price-tracking collection. Inspect the tracking panel and `price_tracking_attempts`; confirm forward prices append with provider market times, budget/fairness behaves as documented, and no old outcome window was fabricated.
3. Keep discovery and paper policies collecting forward evidence. Do not interpret the short existing sample as profitability and do not relax entry-aware gates merely to increase fills.
4. On a new BW or API filing, make a new dated review record rather than modifying `balance-review-2026-09-07`. Reconcile reported components first, then decide whether a new valuation assumption is warranted.
5. Build company-specific, versioned valuation assumptions and reverse-valuation questions inside the thesis workflow. Clearly label each as a user assumption rather than a reported fact.
6. Keep results separated by model version, horizon, distinct ticker, and distinct decision. Do not pool older outcomes with v3 or count repeated daily picks as independent evidence.
7. Only after defining cash, position/concentration limits, repeated-signal treatment, expiry, and exits, consider a separately versioned capital-constrained paper experiment. Preserve Paper Strategy V1 unchanged.
8. Continue read-only CompanyFacts queue and Nasdaq observation samples before changing the five-company enrichment budget, queue order, or adding listing discovery.
9. Repair the host `.env.local` override trap with a tested target-check mechanism. Docker’s explicit Neon environment is already verified; host Next execution is the risky path.

## Files a new Codex should read first

1. [AGENTS.md](../AGENTS.md) — mandatory repository behavior and completion rules.
2. [HANDOFF.md](HANDOFF.md) — full product direction, history, decisions, status, and evidence.
3. [README.md](../README.md) — local setup and feature inventory.
4. [ASTRA_REVIEW_2026-09-06.md](ASTRA_REVIEW_2026-09-06.md) — evidence-backed review driving the recent fixes.
5. [THESIS_REVIEW_2026-09-07.md](THESIS_REVIEW_2026-09-07.md) — current API/BW/HIMS thesis review drafts.
6. [BW_API_RECONCILIATION_2026-09-07.md](BW_API_RECONCILIATION_2026-09-07.md) — recent balance definitions and SEC links.
7. [db/migrations/README.md](../db/migrations/README.md) — migration guard, backup, and conformance procedure.

## Handover checklist for the user

- Give the new Codex environment repository access and the intended local workspace.
- Transfer `.env` and any `.env.local` configuration securely; never paste credentials into chat.
- Ensure the new environment can access Docker Desktop, GitHub, Neon, and the existing GitHub Actions/cron-job.org administration if it will operate scheduled jobs.
- Confirm the new environment’s `DATABASE_URL` points to Neon before opening write-on-read production routes or invoking collection commands.
- Keep this document and `HANDOFF.md` in the new account’s initial context.
