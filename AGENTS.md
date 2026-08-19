# Stock Discovery agent instructions

This is the canonical instructions file for this repository, read
natively by Codex CLI. `CLAUDE.md` and `QWEN.md` in this repo point
here — do not duplicate content into those files; edit this one.

## Master document

`docs/HANDOFF.md` is the project's living master document and source
of truth for product direction and delivery status.

Every agent session that performs material work must:

1. Read `README.md` and `docs/HANDOFF.md` before planning changes.
2. Keep the master document aligned with the actual repository and
   database behavior.
3. After a material feature, bug fix, schema decision, or verified
   test, update the relevant master-document sections:
   - current state and completed milestones;
   - current focus;
   - Now / Next / Later roadmap;
   - decisions and constraints;
   - test evidence;
   - session changelog.
4. Move completed work out of "Now"; do not leave stale plans marked
   as current.
5. Record blockers and unresolved questions explicitly instead of
   silently assuming an answer.

## Product constraints

- The product helps an investor turn intuition into a source-backed,
  falsifiable investment thesis.
- High scores mean "research further", never "buy".
- Do not add new external data sources unless the user explicitly
  reverses the current decision.
- Prefer improving traceability, thesis quality, decision history, and
  use of existing SEC/Yahoo/application data.
- Avoid opaque aggregate scores. Show inputs, assumptions, coverage,
  version, and evidence.
- Preserve "as known at the time" history to reduce hindsight bias.

## Completion standard

- Do not report a feature complete before real UI/runtime and database
  checks where applicable.
- Repeated runs must remain idempotent.
- Missing price, SEC, analyst, or score data must not crash a page.
- Remove temporary integration-test data after verification.
- After a production build in the mounted Docker development
  environment, restart the `app` container before final smoke testing.

---

## Behavioral guidelines

General-purpose guidelines to reduce common LLM coding mistakes.
These bias toward caution over speed; for trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?"
If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria
("make it work") require constant clarification.

### 5. Never Claim Done Without Proof

**Show real output. Never summarize a result you have not actually
produced.**

This project has directly observed agent sessions claiming a fix was
"complete," "verified," or "committed" when the underlying commit,
file edit, or test run did not actually exist or did not match the
claim. Treat this as a serious failure mode, not a minor slip — it is
a stricter, project-specific instance of the general "Completion
standard" above.

- After any code change, run the actual verification commands
  (`npm run typecheck`, `npm run lint`, `npm test` — with
  `TEST_DATABASE_URL` set per `docs/HANDOFF.md` when running outside
  Docker — and `npm run build`) and paste the real terminal output.
  Do not report "all passed" without showing the output that proves it.
- After any commit, show the actual `git log --oneline` and
  `git diff --stat` output. Do not describe a commit without showing
  proof it exists.
- If you are working across a branch, a remote, or a sandboxed
  environment, verify the change is actually visible via
  `git status --short` / `git log` before claiming it is done — never
  assume a write succeeded.
- If a test fails, or a verification step cannot be completed (e.g. a
  database or Docker dependency is unavailable), say so explicitly.
  Do not substitute a manual/alternate check and present it as
  equivalent to the standard one, and do not claim success anyway.
- If you are uncertain whether an action actually completed, say so
  and show whatever evidence you do have — do not round up to "done."

**These guidelines are working if:** fewer unnecessary changes in
diffs, fewer rewrites due to overcomplication, clarifying questions
come before implementation rather than after mistakes, and every
"done" claim is accompanied by real, checkable output.
