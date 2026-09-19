# Task report — AD15-T25

Outcome: implemented
Owner / worktree / branch: T25 worker / `.worktrees/ad07` / `ad15-t25-gestures`
Base commit / candidate commit: `7edff8c4c` / first candidate `11b9cb6f1`, fix-round candidate the second commit on `ad15-t25-gestures`
Accepted contract revision: AD15 validation matrix row T25, plus the fix round's four review conditions and its one added case
Allowed scope and shared-file leases: one new file,
`tests/presentation/designer/designerCanvasGestureOwnership.test.ts`, plus this report as the
stated exception. No `src/` file and no other `tests/` file was modified in the committed tree.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/designer/designerCanvasGestureOwnership.test.ts` | Asserts the designer mounts `EditorSurface` with its interruption doors wired, by firing real DOM events at the mounted surface | Yes — the one file the card names |
| `docs/tasks/asset-designer-expansion/reports/AD15-T25-gesture-ownership.md` | This report | Yes — the card's one stated exception |

## What the gap was and what closes it

Row T25: every designer case reached an interruption by calling `tool.cancel()` /
`tool.abandonGesture()` directly on the tool object, and the mapping from a real `pointercancel`
or a `blur` to `abandonGesture` survived only as a label string in a test title. `DesignerCanvas.vue`
mounts the same `EditorSurface` the plan editor does, so the shared component is covered through the
plan editor's fixture.

**The gap is narrower than the row's "the wiring", and the fix round corrected the file's header to
say so.** `designerMarqueeCanvas.test.ts` already dispatches real `PointerEvent`s at `rig.canvasEl`
and `designerEscapeRouting.test.ts` a real `keydown` Escape at the same element, both asserting
designer-side outcomes — so a press and a key already travel through the props `DesignerCanvas`
hands `EditorSurface`, and a mis-bind there is already red somewhere. What had no designer-side
dispatch at all is the three INTERRUPTION doors, and that is what this file closes.

The new file fires three real DOM events at the real mounted designer surface (`designerRig`) and
observes what `DesignerSelectTool.abandonGesture` leaves behind, rather than spying on a call:

1. `pointercancel` on the canvas element (`EditorSurface.onPointerCancel`).
2. `blur` on the canvas element (the template's `@blur="onBlur"`).
3. `blur` on the owner window (the `listenOnOwner(element, 'window', 'blur', onBlur)` registration
   `onMounted` makes). `blur` does not bubble, so 2 and 3 are independent instruments — confirmed by
   the red-watch, where breaking one left the other green.

Each of those three asserts both halves: the `.selection-marquee` rectangle is gone from the Konva
stage, and the selection the press cleared is put back in `assetDesignStore.selected`; plus that the
sidecar document is byte-identical to the one that went in.

A fourth case, added in the fix round, asserts what the interruption UNLOCKS rather than what the
tool tidied away: a wheel is refused while the sweep runs and zooms the camera once the
`pointercancel` has landed. `ToolManager.cancelInterruptedGesture()` is the only thing that clears
`#gestureInFlight`, and `EditorSurface.onWheel` returns early on `gestureInFlight()` — so an
interruption that is never HEARD leaves the camera and the keyboard refused indefinitely with the
band already gone and nothing on screen to say why. The three cases above all read state the TOOL
cleared; this one reads a door the MANAGER reopened.

The claim in the file's header about no prior designer case firing these events is written from a
grep run in the same edit, after the file existed — `grep -rn pointercancel tests/presentation/designer/`
reached two prose mentions and one test title over a direct `tool.abandonGesture()` call and no
dispatch. `grep -rn blur` over the same directory printed thirteen hits, of which every DISPATCH —
five — was an `input.trigger('blur')` on a number field in the Inspector or the dimensions form,
never the canvas; the other eight were five test titles and three prose comments. The header states
exactly that and no wider claim.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| A real `pointercancel` at the designer surface abandons the designer's tool gesture | Pass, watched red | `@pointercancel="onPointerCancel"` neutered in `EditorSurface.vue` → `AssertionError: expected Rect{ _id: 36, …(15) } to be undefined`, `Tests 1 failed \| 3 passed` | None |
| A container `blur` at the designer surface abandons it | Pass, watched red | `@blur="onBlur"` neutered → `AssertionError: expected Rect{ _id: 87, …(15) } to be undefined`, `Tests 1 failed \| 3 passed` | None |
| A window `blur` abandons it | Pass, watched red | `onBeforeUnmount(listenOnOwner(element, 'window', 'blur', onBlur));` removed → `AssertionError: expected Rect{ _id: 138, …(15) } to be undefined`, `Tests 1 failed \| 3 passed` | None |
| The restore half of each case is load-bearing, not decoration | Pass, watched red | `dropMarquee(context, true)` → `false` in `designer-select-tool.ts` → `AssertionError: expected [] to deeply equal [ …(2) ]`, `Tests 3 failed \| 1 passed` | None |
| An interruption UNLOCKS the camera, so the event was really heard | Pass, watched red | `@pointercancel` neutered → `AssertionError: expected 0.1 not to be 0.1 // Object.is equality`, `Tests 2 failed \| 2 passed` | None |

**Every red-watch in this table ran against a FOUR-case version of the file, and every count in it
ends `(4)` — but they are two DIFFERENT four-case versions.** Breaks A–D were taken on the
predecessor of this fix round: the three interruption cases plus the case since dropped, which is
why `11b9cb6f1`'s own green run reads `3 passed (3)` and no red here does. Break F was taken on the
file this round commits: the same three plus the new camera case. So the first four rows are not
evidence taken against either committed artifact in its exact shape — they are evidence about the
three interruption assertions, which are byte-identical across all three versions, and that is the
whole of what they are evidence for. The greens in the Executed checks table were taken on the
committed files and are labelled with which.

**Break E is withdrawn as evidence about this file.** Mis-binding `:active-tool-id` in
`DesignerCanvas.vue` makes `cursorClass` throw on `EditorSurface`'s first render, so every designer
mount test in the tree crashes identically — this file's reds under it are a global mount failure
and not a property this file holds. The observation is kept below because it is worth knowing that
the mis-bind is loud rather than silent; it is not a red-watch for these assertions.

## Verbatim red output, per case

Break A — `@pointercancel="onPointerCancel"` replaced with `@pointercancel="() => undefined"` in
`src/presentation/editor/surface/EditorSurface.vue`:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |suite| tests/presentation/designer/designerCanvasGestureOwnership.test.ts > an interrupted designer gesture, interrupted through the DOM > takes the band away and puts the selection back: the pointer is taken away
AssertionError: expected Rect{ _id: 36, …(15) } to be undefined

- Expected:
undefined

+ Received:
Rect {
  ...
  "attrs": {
    "dash": [ 5, 3, ],
    "height": 10,
    "listening": false,
    "name": "selection-marquee",
    "stroke": "rgb(0, 0, 0)",
    "strokeWidth": 1.5,
    "width": 10,
    "x": 138,
    "y": 138,
  },
  ...
```

(The received value is a multi-hundred-line Konva node dump; the `attrs` block above is quoted
verbatim and the elided parts are Konva's internal fields. The two `blur` breaks below print the
identical assertion with a different `_id`, so their dumps are not repeated.)

Break B — `@blur="onBlur"` replaced with `@blur="() => undefined"`:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |suite| tests/presentation/designer/designerCanvasGestureOwnership.test.ts > an interrupted designer gesture, interrupted through the DOM > takes the band away and puts the selection back: the canvas loses focus
AssertionError: expected Rect{ _id: 87, …(15) } to be undefined
...
      Tests  1 failed | 3 passed (4)
```

Break C — `onBeforeUnmount(listenOnOwner(element, 'window', 'blur', onBlur));` replaced with
`void listenOnOwner;`:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |suite| tests/presentation/designer/designerCanvasGestureOwnership.test.ts > an interrupted designer gesture, interrupted through the DOM > takes the band away and puts the selection back: the window loses focus
AssertionError: expected Rect{ _id: 138, …(15) } to be undefined
...
      Tests  1 failed | 3 passed (4)
```

Break D — `this.dropMarquee(context, true);` → `false` in
`src/presentation/designer/tools/designer-select-tool.ts` (the restore half):

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |suite| tests/presentation/designer/designerCanvasGestureOwnership.test.ts > an interrupted designer gesture, interrupted through the DOM > takes the band away and puts the selection back: the pointer is taken away
AssertionError: expected [] to deeply equal [ …(2) ]

- Expected
+ Received

- [
-   {
-     "id": "detail-1",
-     "kind": "detail",
-   },
-   {
-     "id": "detail-2",
-     "kind": "detail",
-   },
- ]
+ []

 ❯ tests/presentation/designer/designerCanvasGestureOwnership.test.ts:107:51
    105|
    106|   expect(band(rig)).toBeUndefined();
    107|   expect(useAssetDesignStore(rig.pinia).selected).toEqual(swept);
       |                                                   ^
    108|   // A cancelled sweep is no command and no history entry (AD08's "Esc…
    109|   expect(await rig.document()).toEqual(before);

      Tests  3 failed | 1 passed (4)
```

Break F — `@pointercancel="onPointerCancel"` neutered again, against the committed four-case file,
for the new camera case:

```
 FAIL  |suite| tests/presentation/designer/designerCanvasGestureOwnership.test.ts > an interrupted designer gesture, interrupted through the DOM > lets the camera go again: the wheel zooms once the gesture has been abandoned
AssertionError: expected 0.1 not to be 0.1 // Object.is equality
 ❯ tests/presentation/designer/designerCanvasGestureOwnership.test.ts:176:36
    174|   await settle();
    175|
    176|   expect(editor.viewport.zoom).not.toBe(before);
       |                                    ^
    177|   rig.unmount();
    178|  });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

The camera stayed at `DEFAULT_ZOOM` because `#gestureInFlight` was never cleared, which is the
reviewer's prediction confirmed: `cancelInterruptedGesture()` is the only thing that clears it and
`onWheel` returns early on `gestureInFlight()`. The case's first half — the wheel refused WHILE the
sweep runs — passes in the green run, so the second half is evidence about the flag being cleared
rather than about the guard never existing.

Break E — `:active-tool-id="editorRefs.activeToolId"` → `:active-tool-id="activeToolId"` in
`src/presentation/designer/DesignerCanvas.vue`. **Withdrawn as evidence** (see the acceptance
table): `cursorClass` throws on `EditorSurface`'s first render under this break, so this is a global
designer-mount failure that roughly every designer mount test in the tree catches identically. It is
recorded only because it shows the mis-bind is loud rather than silent:

```
 FAIL  |suite| ... > takes the band away and puts the selection back: the pointer is taken away
Error: the designer mounted no canvas; the read must have refused
 ❯ designerRig tests/helpers/designerRig.ts:346:29
 ❯ selecting tests/presentation/designer/designerCanvasGestureOwnership.test.ts:55:14

⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
TypeError: Cannot read properties of null (reading 'value')
 ❯ ComputedRefImpl.fn src/presentation/editor/surface/EditorSurface.vue:193:26

      Tests  4 failed (4)
```

Every break was made in the working tree only and restored with `git checkout -- <file>`;
`git status --porcelain` after the last restore printed exactly one line, the new test file.

## A case that asserted nothing, and was dropped rather than shipped

A case was written — *"is over: the press after a cancellation is an ordinary one"*: fire
down/move/`pointercancel`, then drag a fresh marquee and assert it selects both graphics. Under
Break A it stayed **GREEN**, because `DesignerSelectTool` drops a stale marquee at the start of the
next press regardless of whether the cancellation was ever heard. It asserted nothing the three
surviving cases do not already assert, so it was removed and the file's header records why. Nothing
in this file therefore covers the gesture that FOLLOWS an interruption on this surface.

**The fix round's new camera case is not that case returning.** The dropped one asked about the next
PRESS, which a tool tidies up for itself; the new one asks about the wheel and the keyboard, which
only `cancelInterruptedGesture()` reopens. Break F is the difference: the dropped case could not be
made to fail and this one fails on exactly the same break.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run …/designerCanvasGestureOwnership.test.ts` | **fix round, committed file** | exit 0 — `Test Files 1 passed (1)`, `Tests 4 passed (4)`, `Duration 18.82s` | `D:/tmp-claude/t25b-green.log` |
| Same command under Break F (`@pointercancel` neutered) | fix round, working tree only, reverted | `Tests 2 failed \| 2 passed (4)` — red quoted verbatim above | `D:/tmp-claude/t25b-red-wheel.log` |
| Same command under each of Breaks A–D | **predecessor `11b9cb6f1`'s working tree**, each reverted | reds quoted verbatim above, each `… (4)` | `t25-red-pointercancel.log`, `t25-red-elementblur.log`, `t25-red-windowblur.log`, `t25-red-restore.log` |
| Same command under Break E | predecessor's working tree, reverted | withdrawn as evidence — see the acceptance table | `t25-red-activetool.log` |
| `npx vitest run …` on the predecessor's three-case file | `11b9cb6f1` | exit 0 — `Test Files 1 passed (1)`, `Tests 3 passed (3)`, `Duration 37.47s` | `D:/tmp-claude/t25-green.log` |
| `npx oxlint …/designerCanvasGestureOwnership.test.ts` | fix round, committed file | exit 0, no findings | shell exit status |
| `npx eslint …/designerCanvasGestureOwnership.test.ts` | fix round, committed file | exit 0, no findings | shell exit status |
| `npx vue-tsc -noEmit` | fix round, whole tree | exit 0, no output | `D:/tmp-claude/t25b-tsc.log` |
| `npx vue-tsc -noEmit` | `11b9cb6f1`, whole tree | exit 0, no output | `D:/tmp-claude/t25-tsc.log` |
| `git status --porcelain` after restoring every break | both rounds | only this file and this report | shell output |

**Which version of the file each red was taken against, because the table alone would mislead.**
Breaks A–E ran against a FOUR-case file that was NOT the one `11b9cb6f1` committed: it carried the
three interruption cases plus the case since dropped, which is why every count in those stanzas ends
`(4)` while that commit's green run reads `3 passed (3)`. Break F ran against the file this fix round
commits, which is four cases again — the three plus the new camera case. No red in this report was
taken against `11b9cb6f1`'s committed three-case artifact; the reds are about the three interruption
assertions, which are byte-identical across all three versions, and that is the whole of what they
are evidence for.

Both linters, `vue-tsc` and the green run were all re-run on the committed fix-round file.

## Verification not performed

- **`npm run check`** — not run. The card forbids it: another worker is on this machine, and the
  guide's own rule is that a full gate contends and produces a wrong red. It runs on the
  integration SHA, in CI.
- **`npm run test:coverage`** — not run, same reason. So the coverage floors are unverified from
  here. This change adds a test file and no `src/` line, so it cannot lower a floor, but nothing in
  this worktree measured that.
- **`npm run lint` (whole tree) and `npm run analyze`** — not run, same reason. The one file was
  linted by hand with both linters at the exact paths above; nothing checked the rest of the tree,
  and fallow never ran, so a duplication or dead-export finding introduced by this file is unknown.
- **`npm run build`** — not run. `npx vue-tsc -noEmit` covers the type half of it over `src/` and
  `tests/`; the Vite bundle step, the stylesheet assembler and the colour check did not run, and
  this change touches no stylesheet.
- **A bare `npx vitest run` over the suite** — not run, by the card's narrow-runs rule. So whether
  this file interacts with any other file in a shared worker is unverified. It is a `jsdom` file in
  the `suite` project, which `vitest.config.ts` isolates per file; it mutates no module-level mock
  state (no `Platform`, no `setLanguage`) and unmounts its rig in every case.
- **A live vault (`npm run test-build`) and the manual smoke suite** — not run. Obsidian cannot run
  here. Whether a real Electron window delivers the container `blur`, the window `blur`, both or
  neither on an Alt+Tab is exactly the question `EditorSurface`'s own `onMounted` comment says no
  gate here can settle; this file asserts that EACH door, when fired, reaches the designer's tool,
  and asserts nothing about which one a host chooses to fire.
- **`npm run harness` / `npm run harness-shot`** — not run. Nothing here changes what is drawn, and
  a capture asserts nothing.
- **The KEY half of `gestureInFlight()`** — not driven. The new camera case fires a wheel, which
  `EditorSurface.onWheel` gates directly; the keyboard's arm is one layer down in
  `./keyDoors.ts` and nothing here asserts it. One door was enough to prove the flag is cleared, and
  the case's docblock says it claims no more than that.
- **The clone family the reviewer named** — `band`, `selecting`, `SHAPE`, `FROM`, `TO` and a
  docblock are verbatim duplicates of `designerMarqueeCanvas.test.ts`, whose natural home is
  `tests/helpers/designerRig.ts`. Deliberately NOT factored: that helper is integrator-owned and not
  sub-let this wave. `npm run analyze` did not run here, so whether the pair crosses the clone
  detector's floor is unmeasured from this worktree.
- **A second designer tool** — not driven. All three cases run against `DesignerSelectTool`'s
  marquee, because it is the one interruption with an observable on both the Konva stage and the
  store. The multi-click draw tools' `abandonGesture` is reached through the same
  `ToolManager.cancelInterruptedGesture()` call, so the chain is shared, but no case here drives
  one.
- **`pointerleave` / "a release outside the leaf"** — not covered, deliberately. Read against the
  code, `EditorSurface.onPointerLeave` abandons the PAN override and the camera drag and never
  calls `cancelInterruptedGesture()`, so there is no DOM event on that path that reaches a
  designer tool's `abandonGesture`. The matrix row's phrase comes from
  `designer-select-tool.ts`'s docblock, which names three inputs; two of them are real DOM doors
  and are covered here. See the finding below.

## Data and integration implications

Schema/migration change: none.
Relevant renderer/export/revision consumers: none — a test file only.
Undo/no-op/conflict/failure coverage: each case asserts the sidecar document is unchanged across
the interrupted gesture, which is AD08's *"Escape/pointercancel is none"*.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: none — reverting the commit removes one test file.

## Finding for the integrator — no `src/` change made

`src/presentation/designer/tools/designer-select-tool.ts`'s `dropMarquee` docblock says the
interruptions C05 names are *"a `pointercancel`, a focus loss and a release outside the leaf
(`abandonGesture`, which `EditorSurface` drives for all three)"*. Read against
`EditorSurface.vue`, the third item does not resolve to a distinct door: `onPointerLeave` returns
early for a non-owner pointer and otherwise abandons only `panOverride` and the store's drag —
it never calls `toolManager.cancelInterruptedGesture()`. What a release outside the leaf actually
reaches is the `blur` path, or nothing, depending on the host. So that clause reads as a third
mechanism where the code has two, which is the caller-list shape this repository has already paid
for several times.

This is reported rather than acted on, per the lease: no `src/` file is mine this wave, and a
docblock narrowing is a hypothesis until the integrator has measured it against the plan editor's
own cases, which share that component. If it is taken, the narrowing is to the two doors
`EditorSurface` demonstrably drives, with the third named as what it is.

**The fix round's reviewer strengthened this and the integrator has taken ownership of the edit.**
`setPointerCapture` fires at both press doors, so a release outside the leaf retargets to the stage
and COMMITS the gesture — meaning that third clause describes the opposite of what happens rather
than merely lacking a door. Recorded here so the finding and its strengthening sit in one place; the
`src/` edit is the integrator's.

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
