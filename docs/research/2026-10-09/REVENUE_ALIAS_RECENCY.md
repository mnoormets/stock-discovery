# Supported revenue concept recency — 9 October 2026

The existing SEC extractor selected the first supported revenue tag with any USD records. An issuer changing concepts could therefore remain on obsolete revenue even with current supported facts available. Official [NVDA CompanyFacts](https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json) confirms the preferred contract-revenue tag ends in January 2022 while Revenues provides July 2026 reporting data.

The correction considers only the existing supported revenue concepts. It selects the most recent validated reporting end, then filing date, independently of reported value. Equal dates retain declared tag priority. It retains one concept series per refresh; no newly guessed tags, cross-currency mapping, mixed filing comparison or threshold/ranking/entry/exit/risk change. Existing fact identities and historical collection evidence are retained.

## Actual verification

The targeted regression failed with expected three facts versus an empty comparison before the correction. An earlier environment run could not initialize while Docker was stopped; a subsequent cold dynamic import timed out and was moved to normal static test import before reproducing the actual assertion.

- Focused enrichment suite: 27 passed, 36.96s, including old-fact preservation, repeated refresh idempotence, declared priority on equal dates and rejecting disallowed forms for recency selection.
- npm run typecheck: exit 0; npm run lint: No ESLint warnings or errors, exit 0.
- docker compose exec -T app npm run build: exit 0; Compiled successfully; Generating static pages 22/22. App restarted afterward.
- Real NVDA detail page returned HTTP 200 and its existing stale-data background refresh persisted current Revenues facts while retaining the old revenue records. Subsequent HTML contains the July 2026 period and exact filing link. Performance returned HTTP 200. No visual browser inspection claimed.
- A new locked forward collection succeeded with NVDA current/prior revenue and operating cash flow from the identical current filing and proper periods. The earlier frozen unknown observation remains unchanged. The full universe is still bounded and missing evidence stays visible.
- Full isolated npm test suite: 78 files / 560 tests passed, 608.48s, exit 0. Test database removed by teardown.

Separate ingestion-order finding: twelve companies obtained usable comparisons after the earlier morning collection had already frozen its result. This explains some unknown rows; it does not justify rewriting their earlier history or weakening same-filing requirements. Reordering capped enrichment before future growth evaluation remains separate work.
