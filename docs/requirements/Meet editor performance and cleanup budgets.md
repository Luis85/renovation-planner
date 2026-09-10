---
type: PBI
parent: "[[Release hardening]]"
order: 70
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Use the editor in Obsidian themes and constrained layouts]]"
---

# Meet editor performance and cleanup budgets

## Quality outcome

The released editor responds at homeowner scale and leaves no active canvas resources after its
Obsidian leaf closes.

## Main flow

1. Representative typical and large plan fixtures are defined with rooms, markers, and images.
2. Initial render, pan/zoom, selection, Inspector changes, and recalculation are instrumented.
3. Measurements are compared with the proposed Phase 12 budgets.
4. The leaf is closed and retained stages, listeners, object URLs, stores, and subscriptions are
   checked.
5. Results, environment, fixture size, and exceptions are recorded as release evidence.

## Extensions

- **3a** — A proposed budget is not achievable or does not predict usability. It is not silently
  weakened; evidence and a product decision revise the target before release.
- **3b** — An operation exceeds 300 ms. It remains asynchronous or incremental and exposes
  truthful visible status.
- **4a** — A retained resource is found. The release is blocked until removed or explicitly
  accepted through the release decision.

## Guarantee

Performance claims name their fixture and environment, and a closed editor leaf retains no Konva
stage, registered listener, or object URL owned by that leaf.

## Acceptance criteria

1. Proposed budget to validate: initial usable render under 1.5 seconds for a typical local
   project after Obsidian is ready.
2. Proposed budget to validate: pan/zoom targets 60 fps and never falls below 30 fps at
   representative floor complexity.
3. Proposed budgets to validate: selection feedback under 100 ms and Inspector change under
   200 ms from an available read model.
4. Recalculation is incremental/asynchronous when large and shows status above 300 ms.
5. No Konva stages, listeners, or object URLs remain after leaf close.

## Assumptions

- These numbers are proposed budgets from the implementation plan, not validated product facts.
- Fixture thresholds are measured during this work rather than guessed in advance.
- Real Obsidian measurements complement deterministic automated leak checks.

## Sources

Performance budgets and Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md);
WP2 and WP8 in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md).

## Amendments

**2026-09-10** — the merged editor stack, `main` at `5dcc1f20`. **No measurement on record
describes it.** In `docs/user-experience/renovation-planner-editor-specs/implementation/`,
`RESUME.md` holds two recovery measurements, both on one fixture of 80 rooms, 240 materials, 24
assets and 40 photos. The earlier, taken before the metadata join, reads usable in 506.9 ms,
selection 65.4 ms, Inspector 75.4 ms, pan median 16.6 ms and p95 17.1 ms, with three close/reopen
cycles, and says that not every time or frame-rate budget is asserted automatically. The later,
under *Verifizierte Pan-Performancekorrektur*, is an unprofiled rerun on UI `dba43e5f` across all
four scenarios: usable 467.4–508.6 ms, selection 52.6–59.8 ms, Inspector 43.7–53.1 ms, pan median
16.6–16.7 ms and p95 at most 17.1 ms, with twelve close/reopen cycles reporting
`trackedResources 0`. `completion-matrix.md`'s G18 row reads "Prior measurements do not describe
integrated tree". `remaining-plan.md`'s row *P2 – Leistungs- und Aufräumprüfung* asks for the large
fixtures, the latency and frame budgets and twelve close/reopen cycles against unchanged budgets,
and names no driver. On `main`, `scripts/editor-recovery-check.mjs` is the one script found that
asserts zero stages, listeners, images and object URLs after a close, and it loops three times.
`git log --all -S'trackedResources'` finds no commit, so the driver behind the twelve-cycle rerun is
not in the repository.

So the three Tasks beneath this PBI owe their run against `5dcc1f20` or later, and that run owes
these added criteria:

- The driver and fixtures that carry each budget are named by file. A budget with no driver is
  recorded as unmeasured, never as passed.
- Raw values are recorded per budget beside the fixture and environment. No pass is inferred from
  an exit code.
- The camera delta is shown to be a real change.
- Twelve close/reopen cycles leave zero tracked stages, listeners, DOM images and object URLs —
  twelve, against the three the existing driver runs. The driver that ran twelve on `dba43e5f` is
  found, or rebuilt, and committed first; `scripts/editor-recovery-check.mjs` does not stand in
  for it.
- Budgets not asserted automatically are compared by hand and listed.
- The evaluation lands before the H4 row of
  [[Run native Obsidian acceptance H1 to H6 in the repository vault]].

Ownership does not move: [[Instrument the proposed editor response budgets]] keeps the protocol,
[[Benchmark representative floors and interactions]] the budgets and any failed budget's defect or
revision decision, and [[Prove editor resources end with the leaf]] the counters. This amendment is
written here rather than on one of them because the evaluation spans all three.
