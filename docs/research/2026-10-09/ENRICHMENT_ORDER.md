# Same-collection SEC enrichment order — 9 October 2026

The daily collector froze early/growth research before its bounded SEC enrichment. Twelve names in the morning observation had usable comparisons only after that collection finished; this caused avoidable latency even though the data arrived on the same day.

The corrected order persists discovered radar companies, calls existing SEC enrichment within the shared 20-company Tallinn-day budget, then evaluates early/growth evidence. CLI/API reuse the captured result. Today exposes coverage and budget; a thrown enrichment failure retains raw names and unknown evidence, records a sanitized warning, and gives the API HTTP 503. Same-filing/period/currency gates, retry windows, supported sources, ranking, capital rules and older observations are unchanged. Per-company unavailable/failed counts remain explicit.

## Actual verification

Before correction the two new ordering/failure regressions failed because enrichment was never called and the snapshot had no enrichment error. After correction the focused order tests passed (2 tests, 5.38s). The three-file check passed 44/45; its remaining API error-status assertion exposed HTTP 200 despite ok=false. The status gate was fixed and the route file then passed 7/7 in 10.69s. No earlier failed run is counted as a pass.

Production typecheck and lint exited 0 (No ESLint warnings or errors). Docker build exited 0, compiled successfully and generated 22/22 static pages; the app was restarted before smoke checks.

A new locked forward collection #79 succeeded at 10:43:12.375 UTC with growth evaluated at 10:43:11.983 UTC. The enrichment result is persisted in that same collection's metrics. All six radar channels and Nasdaq status were ok; 139 growth rows remained visible. Its existing daily allowance was exhausted: 20 attempts earlier today, zero additional attempts, zero remaining. This runtime observation validates the cap and persistence; the isolated database regression demonstrates genuinely new same-run facts. No extra budget was granted to manufacture live evidence.

Today and Performance returned HTTP 200 after restart. Today HTML contains the new SEC coverage and earlier-today budget text. No visual browser inspection claimed. Existing capital trades were preserved and no executor ran outside the regular session. This is a data-order correction, not proof of profitability. Publication remains local pending existing authorization; remote deployment is not claimed.

Full isolated suite completed with exit 0. Actual terminal output:

```text
 Test Files  79 passed (79)
      Tests  564 passed (564)
   Start at  13:42:06
   Duration  550.42s (transform 1.63s, setup 9.60s, import 9.12s, tests 504.30s, environment 10ms)
```

Next verify the first unattended collection after publication and a day with remaining SEC budget; the live verification deliberately did not exceed the exhausted allowance.
