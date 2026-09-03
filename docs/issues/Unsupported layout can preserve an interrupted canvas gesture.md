---
type: Issue
parent: "[[Open a floor plan in the Obsidian editor shell]]"
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
effort: M
complexity: ""
business-value: ""
business-value-model: ""
---

# Unsupported layout can preserve an interrupted canvas gesture

## The question

What retires an in-flight canvas gesture when the responsive shell crosses below 400px and
unmounts the canvas?

## What is true today

`ResponsiveEditorShell.vue` removes the canvas in `unsupported` mode
(`src/presentation/editor/shell/ResponsiveEditorShell.vue:110-131`). The design explicitly
expects that unmount below 400px (`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:225-239`).

`EditorSurface` keeps the gesture's pointer identity in its component-local
`toolGesturePointer` (`src/presentation/editor/surface/EditorSurface.vue:140-149`), but its
unmount hook only removes the window blur listener and disconnects its observer
(`src/presentation/editor/surface/EditorSurface.vue:1174-1181`). The leaf-scoped
`ToolManager` survives with `gestureInFlight === true`
(`src/presentation/editor/tools/tool-manager.ts:40-48`, `src/presentation/editor/tools/tool-manager.ts:129-151`).
The remounted surface therefore has a live manager gesture and a fresh null pointer owner.

Measured with `rg -n "toolGesturePointer|cancelInterruptedGesture|onBeforeUnmount"
src/presentation/editor/surface/EditorSurface.vue`: the interruption cleanup is called from
pointer cancellation and blur, not from unmount. The responsive suite proves only
full-to-constrained element identity and unsupported canvas replacement
(`tests/presentation/editor/shell/responsiveShell.test.ts:31-49`,
`tests/presentation/editor/shell/responsiveShell.test.ts:145-167`).

## Why it matters

The parent requires constrained layout not to reset an active temporary task, and SDD §15
classifies that task as ephemeral state. A stale in-flight flag can lock camera actions or make
the next pointer stream belong to no owner, while the screen looks freshly mounted.

## What closes it

Before unsupported layout destroys `EditorSurface`, abandon only the interrupted press/release
gesture and clear its camera ownership while preserving any completed multi-click draft. Keep
that lifecycle decision at the surface boundary rather than teaching the shell tool details.

Add a responsive-shell test that starts a real tool gesture, resizes to 320px, returns to a
supported width, and proves both that `gestureInFlight` is false and that the next complete
pointer gesture commits normally. A drawing-tool variant must also prove that vertices completed
before the interrupted press survive, discriminating abandonment from a full cancel.

## What closed it

**2026-09-04.** The lifecycle decision stayed at the surface boundary, as this note asks, and the
shell was taught no tool details at all. `EditorSurface.onBeforeUnmount` now calls
`releaseInterruptedInputs()` before disconnecting its observer, followed by
`editor.setPointer(null)`.

`releaseInterruptedInputs` is an EXTRACTION rather than a second copy: the four statements
`onBlur` already ran — `swallowedPointers.clear()`, `panOverride.cancel()`, `syncPanPhase()`,
`editor.abandonPan()`, `toolManager.cancelInterruptedGesture()` — are now one function with two
callers, because the moment that sequence is spelled out longhand the count of doors missing a
line of it is unknowable. `onBlur`'s ordering is unchanged: the pointer move is re-issued FIRST,
then the release, then `lastStagePoint` is forgotten. The pointer readout is cleared HERE and not
there, which is the one difference between the two doors and is stated where it is paid: focus
can leave with the pointer still resting over the plan, but this canvas is about to stop
existing, so a coordinate readout would be a claim about a pointer over nothing.

`cancelInterruptedGesture` and never `cancelGesture`, which is the "abandon only the interrupted
press" half: a multi-click tool sits between clicks with nothing in flight, and a narrowing split
says nothing about a buffer the user is still filling. Two caller-list docblocks that this made
stale were corrected in the same edit — `ToolManager.cancelInterruptedGesture`'s and
`PanOverride.cancel`'s.

Holding tests, both in `tests/presentation/editor/shell/responsiveShell.test.ts` › the responsive
shell:

- 'an interrupted Select drag is abandoned when the canvas unmounts below the floor, and the next
  click selects normally' — a real drag on the Kitchen (its centre projected through the camera
  with `worldToScreen`, moved 40 screen pixels, ten times `SelectTool`'s click epsilon), then
  320px, then 1280px; it asserts `gestureInFlight` is false AND that the next complete click
  selects `zone-kitchen`, because the flag alone is equally true of a build that cancelled the
  whole tool.
- 'a drawing tool keeps its placed vertices across the unmount; only the interrupted press is
  abandoned' — one completed click plus a press with no release, and TWO vertices afterwards,
  which is the discrimination: this tool places its vertex on the PRESS and its `abandonGesture`
  is a documented no-op, so a `cancelGesture()` at this door would leave none.

Both were watched red at `gestureInFlight` before the fix and red again with
`releaseInterruptedInputs()` removed from the unmount hook. Commit "fix(shell): focus survives a
growth that closes an overlay, an unmounted canvas abandons its gesture, and the dead panel
toggles are gone".

## References

- [[Open a floor plan in the Obsidian editor shell]]
- [[Keep the editor truthful across failure and narrow layouts]]
- `src/presentation/editor/shell/ResponsiveEditorShell.vue:110-131`
- `src/presentation/editor/surface/EditorSurface.vue:140-149`
- `src/presentation/editor/surface/EditorSurface.vue:1174-1181`
- `src/presentation/editor/tools/tool-manager.ts:129-151`
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md:225-239`
- `tests/presentation/editor/shell/responsiveShell.test.ts:145-167`
- Reviewed at commit 16757d6d
- PASS 2
