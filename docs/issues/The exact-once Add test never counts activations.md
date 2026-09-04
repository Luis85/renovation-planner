---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 60
status: Done
started: 2026-09-04
finished: 2026-09-04
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

# The exact-once Add test never counts activations

## The question

[[Run one temporary creation task from Add]] requires one menu activation to start exactly one
task (`docs/tasks/Run one temporary creation task from Add.md:24-29`). The test cited as proof is
named "starts exactly one tool," but after Enter it checks only that the menu closed and the final
tool is `draw-polygon` (`tests/presentation/editor/add/addMenu.test.ts:42-61`).

The catalogue test invokes Room with a spy but asserts only
`toHaveBeenCalledWith('draw-polygon')`
(`tests/presentation/editor/add/creationCatalogue.test.ts:24-29`). Both assertions also pass if
activation runs twice.

## What is true today

- A search for exact-count assertions beside the Add activation finds no
  `toHaveBeenCalledTimes(1)` or `toHaveBeenCalledOnce()` in either cited case.
- Setting the same active tool twice is idempotent at the observed ref, so the integration
  test's final `activeToolId` cannot reveal duplicate dispatch.
- The PBI amendment at
  `docs/requirements/Start one creation task from Add.md:113-116` and the task amendment at
  `docs/tasks/Run one temporary creation task from Add.md:42-45` both claim this evidence holds
  exact-once activation.

## Why it matters

Exact-once is the PBI's central guarantee because later creation entries can allocate task state
or dispatch writes. The current test proves only "Room eventually became the draw tool," so a
duplicate activation can ship under evidence explicitly claiming to rule it out.

## What closes it

Drive `AddMenu` with a countable runtime seam and assert one `setTool('draw-polygon')` call and
one close emission for one Enter or click gesture. At minimum, add a count assertion to the
catalogue spy, but retain a menu-level count so duplicate routing above the catalogue is also
caught. Mutation-check by calling `activateFocused()` twice and requiring the test to fail.
Amend the PBI and task evidence until that discriminating assertion exists.

## What closed it

**2026-09-04.** `addMenu.test.ts` gained 'Enter on Room starts exactly one tool and emits
exactly one close', which spies `setTool` and asserts `toHaveBeenCalledTimes(1)` beside one
`close` emission; `creationCatalogue.test.ts`'s 'offers exactly one available entry...' gained
the same `toHaveBeenCalledTimes(1)` assertion on its own spy. Mutation-checked by calling
`activate(entry)` twice inside `activateFocused`: red at `toHaveBeenCalledTimes(1)` (2 calls
observed). The PBI and task evidence are amended to cite the counting cases rather than the
settled-end-state ones. Commit "fix(add-menu): close before activate, root-owned Escape, focus
boundary, wheel and unmount retirement — with tests that count".

## References

- `tests/presentation/editor/add/addMenu.test.ts:42-61`
- `tests/presentation/editor/add/creationCatalogue.test.ts:24-29`
- `docs/requirements/Start one creation task from Add.md:113-116`
- `docs/tasks/Run one temporary creation task from Add.md:24-29,42-45`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:358-365` — §7.2.
- [[Start one creation task from Add]]
- [[Run one temporary creation task from Add]]
- Reviewed at commit `16757d6d`, PASS 3.
