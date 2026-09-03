---
type: Task
parent: "[[Start one creation task from Add]]"
order: 30
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Run one temporary creation task from Add

## Evidence

The [component library creation contract](../user-experience/renovation-planner-editor-specs/components/component-library.md) and M02 require one activation path, temporary task state and return to Select by default.

## Why it matters

Parallel activation paths create duplicate writes and leave the editor stuck in a creation mode.

## Approach

Bind each enabled catalogue entry to one task-manager activation, pass selected context once, centralize finish/cancel precedence and retire task state after one completion.

## Acceptance criteria

- One menu activation starts exactly one task.
- Current context is passed without creating a second command path.
- Cancel writes nothing and returns to Select.
- Success returns to Select unless repeat was explicitly chosen.
- Refusal retires unsafe draft state and preserves the last valid projection.

## Risks

Repeated pointer or keyboard activation can race before the menu closes.

## Outcome

Add hands control to one bounded creation task and reliably returns the editor to safety.

## Amendments

**2026-09-03** — criterion 1 is
`tests/presentation/editor/add/addMenu.test.ts`'s 'ArrowDown moves focus through enabled and
disabled items alike; Enter on Room starts exactly one tool and closes'.

**2026-09-04** — criterion 1's evidence is the COUNTING case instead: 'Enter on Room starts
exactly one tool and emits exactly one close' asserts `toHaveBeenCalledTimes(1)` on a spied
`setTool` and one `close` emission, where the cited case above proved only the settled end state
and would pass just as well on a duplicate activation. Criterion 3 is
`tests/presentation/editor/shell/temporaryToolBanner.test.ts`'s 'Cancel returns to Select whether
or not a draft exists, and a drafted room is discarded with it' beside
`tests/presentation/editor/escapeRouting.test.ts` — the banner's Cancel LEAVES the task and Escape
steps back one interaction — two questions, ruled apart on 2026-09-04 (R7). The RETURN half of
criterion 4 is
`tests/presentation/editor/tools/drawPolygonTool.test.ts`'s `DrawPolygonTool.onCompleted` cases,
bound to `returnToSelect` in `src/presentation/editor/runtime.ts`. Criterion 5 is
`tests/presentation/editor/toolRefusalSurfaces.test.ts`.

Criterion 2 is vacuous: Room carries no context, so there is no second command path to avoid.
Criterion 4's 'unless repeat was explicitly chosen' has no subject — repeated creation is not
built, the banner carries no toggle for it, and spec §7.3 and §12 record that as a decision
rather than an omission.
