# Stock Discovery agent instructions

## Master document

`docs/HANDOFF.md` is the project's living master document and source of truth for product direction and delivery status.

Every Codex session that performs material work must:

1. Read `README.md` and `docs/HANDOFF.md` before planning changes.
2. Keep the master document aligned with the actual repository and database behavior.
3. After a material feature, bug fix, schema decision, or verified test, update the relevant master-document sections:
   - current state and completed milestones;
   - current focus;
   - Now / Next / Later roadmap;
   - decisions and constraints;
   - test evidence;
   - session changelog.
4. Move completed work out of “Now”; do not leave stale plans marked as current.
5. Record blockers and unresolved questions explicitly instead of silently assuming an answer.

## Product constraints

- The product helps an investor turn intuition into a source-backed, falsifiable investment thesis.
- High scores mean “research further”, never “buy”.
- Do not add new external data sources unless the user explicitly reverses the current decision.
- Prefer improving traceability, thesis quality, decision history, and use of existing SEC/Yahoo/application data.
- Avoid opaque aggregate scores. Show inputs, assumptions, coverage, version, and evidence.
- Preserve “as known at the time” history to reduce hindsight bias.

## Completion standard

- Do not report a feature complete before real UI/runtime and database checks where applicable.
- Repeated runs must remain idempotent.
- Missing price, SEC, analyst, or score data must not crash a page.
- Remove temporary integration-test data after verification.
- After a production build in the mounted Docker development environment, restart the `app` container before final smoke testing.
