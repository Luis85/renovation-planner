---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 10
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: high
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# A Cancel button with a drafted room leaves the creation task active

## The question

`createCancelActiveTask` delegates the banner's Cancel button to `routeEscape`
(`src/presentation/editor/runtime.ts:477-493`). The draft arm clears the draft and returns
immediately without changing tools (`src/presentation/editor/escapeRouting.ts:43-49`), so the
draw tool and its banner remain active.

That is the opposite of [[Start one creation task from Add]] acceptance criterion 7 and main-flow
step 6 (`docs/requirements/Start one creation task from Add.md:51-54,90`), which require
cancellation to return to Select by default. Design spec §7.3 says the runtime returns to Select
on a cancel with an empty draft, but does not justify making the visible Cancel button mean
"clear this draft and continue the task."

## What is true today

- `tests/presentation/editor/shell/temporaryToolBanner.test.ts:22-35` asserts the contradictory
  behavior: an empty draft returns to Select, while a drafted room is cleared and
  `activeToolId` remains `draw-polygon`.
- A repository search for the claimed criterion reaches the PBI amendment at
  `docs/requirements/Start one creation task from Add.md:118-120` and the task amendment at
  `docs/tasks/Run one temporary creation task from Add.md:42-48`; both cite this test as evidence
  that cancellation is met.
- No write occurs, but the temporary creation task is not retired.

## Why it matters

The control says Cancel, not "clear draft." After using it, the user remains in a creation mode
with the banner still visible, contrary to the safe Select state promised by both the PBI and
task. The current amendment therefore records a failed criterion as met.

## What closes it

Make the banner's explicit Cancel path clear any draft and then return to Select, without
changing Escape's separately specified precedence unless that contract is deliberately revised.
Change the drafted-room banner test to require `activeToolId === 'select'`, a null sketch and an
absent banner. Amend the PBI and [[Run one temporary creation task from Add]] closing evidence so
they no longer cite the current keep-active assertion.

## References

- `src/presentation/editor/runtime.ts:477-493`
- `src/presentation/editor/escapeRouting.ts:43-49`
- `tests/presentation/editor/shell/temporaryToolBanner.test.ts:22-35`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:367-375` — §7.3.
- [[Start one creation task from Add]]
- [[Run one temporary creation task from Add]]
- Reviewed at commit `16757d6d`, PASS 1.
