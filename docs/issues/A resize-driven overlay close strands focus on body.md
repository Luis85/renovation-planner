---
type: Issue
parent: "[[Layers]]"
order: 10
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

# A resize-driven overlay close strands focus on body

## The question

`src/presentation/editor/shell/ResponsiveEditorShell.vue:56-58` sends every measured width to
`WorkspaceStore.setLayoutMode`. When a pane grows from `constrained` to `full`,
`src/presentation/stores/WorkspaceStore.ts:47-51` clears the overlay directly. That path bypasses
`ResponsiveEditorShell.closeOverlay` at
`src/presentation/editor/shell/ResponsiveEditorShell.vue:79-83`, the only close path that moves
focus back to the rail button.

The focused overlay is then removed by the full-layout render branch, leaving
`document.activeElement` on `<body>`. Is a layout-driven close allowed to discard the keyboard
user's focus location when [[Layers]] criterion 5 says opening and closing restore focus
predictably?

## What is true today

- Design spec §5.5 at
  `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:241-247`
  requires focus return for Escape, but says nothing about a resize-driven close.
- [[Keep layer controls usable in constrained leaves]] records the wider acceptance criterion
  and its amendment at `docs/tasks/Keep layer controls usable in constrained leaves.md:50-54`
  names this resize path as the unmet half.
- `tests/presentation/editor/shell/responsiveShell.test.ts:125-143` resizes an open Inspector
  drawer from 460px to 1280px and checks that the drawer and rail disappear and the persistent
  panels return. It never checks `document.activeElement`.
- Measured with
  `rg -n "setLayoutMode|closeOverlay|activeElement" src/presentation/editor/shell/ResponsiveEditorShell.vue src/presentation/stores/WorkspaceStore.ts tests/presentation/editor/shell/responsiveShell.test.ts`:
  the only `activeElement` assertions are the explicit Escape/close-button cases at
  `responsiveShell.test.ts:88,122`; the resize case has none.

## Why it matters

A keyboard user who resizes a constrained leaf loses the control they were operating and has
no predictable next Tab position. The overlay disappears successfully, so the existing test
and visible UI both look correct while criterion 5's focus half is broken.

## What closes it

Keep the resize decision in the shell long enough to retain which overlay owned focus, then,
after the full layout renders, move focus to an explicit surviving target in the corresponding
persistent Layers or Inspector region. Add one discriminating case beside
`responsiveShell.test.ts:125-143` that focuses each open overlay, resizes to full, and asserts
the designated surviving target is `document.activeElement`.

Calling the existing `closeOverlay` is not sufficient: it focuses a rail button that the same
transition removes, returning focus to `<body>`. Leaving focus to browser fallback preserves
the defect, while keeping a constrained overlay open in full mode contradicts the store's
one-layout-state rule.

## What closed it

**2026-09-04.** `ResponsiveEditorShell.measure` retains the decision long enough to act on it
(ruling R10): `regionInheritingFocus(next)` is asked BEFORE `workspace.setLayoutMode`, which
clears `overlay` in the same statement, and answers `'layers'`, `'inspector'` or `null` — `null`
for every resize that closes nothing, which is nearly all of them. The focus move then waits for
`nextTick`, because the target does not exist until the `full` branch has rendered:
`[data-rp-region="layers"]` on `PropertyLayerPanel`'s aside and `[data-rp-region="inspector"]`
on `EntityInspector`'s, each `tabindex="-1"` so it is a programmatic TARGET rather than a new Tab
stop.

The target is the persistent REGION and not its first control, which is what the note's own last
paragraph asked for: the aside is what the overlay stood in for, while a control is a guess about
which one mattered. That `closeOverlay` could not serve is measured rather than argued —
replacing the focus call with `closeOverlay(region)` reddens both new cases with
`document.activeElement` reading `<body>`, because the rail button it focuses is removed by this
very transition.

Holding test: `tests/presentation/editor/shell/responsiveShell.test.ts` › the responsive shell ›
'growing back to full while %s is open moves focus to the persistent region it stood in for',
driven over BOTH containers — the layers overlay and the inspector drawer, since the store's
`inspector` and the rail's `details` are two vocabularies and a mapping can be right for one
entry. It asserts the panel is gone, that `document.activeElement` IS the designated region, and
that it is not `<body>`. Commit "fix(shell): focus survives a growth that closes an overlay, an
unmounted canvas abandons its gesture, and the dead panel toggles are gone".

## References

- [[Layers]]
- [[Keep layer controls usable in constrained leaves]]
- Reviewed at commit 16757d6d
- PASS 4 — documentation truth
