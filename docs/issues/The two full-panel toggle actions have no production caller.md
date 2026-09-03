---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 80
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: medium
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

# The two full-panel toggle actions have no production caller

## The question

Are `toggleLayersPanel` and `toggleInspectorPanel` product capabilities, or test-only
flexibility left over from the previous shell?

## What is true today

`WorkspaceStore` exports both actions and the booleans they mutate
(`src/presentation/stores/WorkspaceStore.ts:15-28`,
`src/presentation/stores/WorkspaceStore.ts:84-96`). `ResponsiveEditorShell` reads those booleans
to conditionally render the full-layout panels
(`src/presentation/editor/shell/ResponsiveEditorShell.vue:103-117`), but no production control
calls either action.

Measured with `rg -n "toggleLayersPanel|toggleInspectorPanel" src tests`: each action has only
its definition/export in `src`; all calls are in
`tests/presentation/editor/shell.test.ts:536-554` and
`tests/presentation/stores/stores.test.ts:518-527`. The test header itself says there is no
toggle control yet (`tests/presentation/editor/shell.test.ts:530-535`).

Design spec §5.6 deliberately provides no View menu because nothing would be in it
(`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:249-256`).
The owning boundary task says panel visibility belongs to UI state, but not that unused public
actions must exist (`docs/tasks/Enforce shared editor component and state boundaries.md:29-40`).

## Why it matters

Test-only callers make dead product flexibility look used, keep two unreachable panel states in
the shell, and can prevent dead-export analysis from identifying the residue. This is the
opposite of the shell task's goal of explicit shared state ownership.

## What closes it

Unless a concrete production affordance is approved, delete the two toggle actions, their
test-only scenarios, and any booleans that become constant as a result. If panel collapsing is
still required, first name and build its production control rather than preserving an API for a
future View menu the design explicitly omits.

The discriminating check is a production-caller assertion: if the actions remain, a component
test must click the real controls and prove each panel changes independently. If no controls are
approved, the compiler and shell render tests should instead prove the simplified store and both
full panels still compose; direct store calls are not evidence of reachability.

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Enforce shared editor component and state boundaries]]
- `src/presentation/stores/WorkspaceStore.ts:15-28`
- `src/presentation/stores/WorkspaceStore.ts:84-96`
- `src/presentation/editor/shell/ResponsiveEditorShell.vue:103-117`
- `tests/presentation/editor/shell.test.ts:530-554`
- `tests/presentation/stores/stores.test.ts:518-527`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:249-256`
- Reviewed at commit 16757d6d
- PASS 4
