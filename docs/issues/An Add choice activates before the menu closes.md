---
type: Issue
parent: "[[Start one creation task from Add]]"
order: 50
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

# An Add choice activates before the menu closes

## The question

Design spec §7.2 says an available entry closes the menu and then calls `activate`
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:358-365`).
`AddMenu.activate` performs those operations in the opposite order:
`entry.activate(runtime)` at `src/presentation/editor/add/AddMenu.vue:173`, then
`emit('close')` at line 174.

If activation throws, the close event is never emitted. Even on success, tool activation and
its banner can begin while the menu is still the mounted top interaction surface.

## What is true today

- The source order is measured directly at `src/presentation/editor/add/AddMenu.vue:170-175`;
  there is no `try/finally` or prior close.
- The integration case at `tests/presentation/editor/add/addMenu.test.ts:42-61` checks only the
  settled end state: menu absent and `activeToolId === 'draw-polygon'`. It cannot observe which
  happened first.
- The catalogue's unsupported activation throws deliberately
  (`tests/presentation/editor/add/creationCatalogue.test.ts:32-36`), but the menu guards that
  path before calling it; no test makes an available activation fault.

## Why it matters

Activation is allowed to perform arbitrary task setup. A fault leaves the menu open and focus
ownership unresolved, and a future asynchronous or focus-moving activation can race the menu's
unmount. The implementation contradicts the ordering chosen specifically to avoid that state.

## What closes it

Emit close before invoking the available entry. Add a standalone `AddMenu` test with a provided
runtime whose `setTool` throws; after the activation rejects, the component must already have
emitted exactly one close event. A second assertion should observe that the close callback runs
before `setTool`, so a final-state-only implementation cannot pass.

## What closed it

**2026-09-04.** `activate` swapped to `emit('close'); entry.activate(runtime);`. Holding test:
`addMenu.test.ts` › standalone › 'emits close before it calls the entry, and exactly once, even
when the entry throws' — asserts the SEQUENCE (`order` toEqual `['close', 'setTool']`) rather than
only the settled end state, with `setTool` throwing so a final-state-only implementation cannot
pass. Commit "fix(add-menu): close before activate, root-owned Escape, focus boundary, wheel and
unmount retirement — with tests that count".

## References

- `src/presentation/editor/add/AddMenu.vue:170-175`
- `tests/presentation/editor/add/addMenu.test.ts:42-61`
- `tests/presentation/editor/add/creationCatalogue.test.ts:32-36`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:358-365` — §7.2.
- [[Start one creation task from Add]]
- [[Operate the Add menu by pointer and keyboard]]
- Reviewed at commit `16757d6d`, PASS 2.
