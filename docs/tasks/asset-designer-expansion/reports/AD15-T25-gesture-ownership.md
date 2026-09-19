# Task report — AD15-T25

Outcome: implemented
Owner / worktree / branch: T25 worker / `.worktrees/ad07` / `ad15-t25-gestures`
Base commit / candidate commit: `7edff8c4c` / see commit on `ad15-t25-gestures`
Accepted contract revision: AD15 validation matrix row T25
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
plan editor's fixture — but nothing asserted the DESIGNER mounts it with the wiring intact.

The new file fires three real DOM events at the real mounted designer surface (`designerRig`) and
observes what `DesignerSelectTool.abandonGesture` leaves behind, rather than spying on a call:

1. `pointercancel` on the canvas element (`EditorSurface.onPointerCancel`).
2. `blur` on the canvas element (the template's `@blur="onBlur"`).
3. `blur` on the owner window (the `listenOnOwner(element, 'window', 'blur', onBlur)` registration
   `onMounted` makes). `blur` does not bubble, so 2 and 3 are independent instruments — confirmed by
   the red-watch, where breaking one left the other green.

Each case asserts both halves: the `.selection-marquee` rectangle is gone from the Konva stage, and
the selection the press cleared is put back in `assetDesignStore.selected`; plus that the sidecar
document is byte-identical to the one that went in.

The claim in the file's header about no prior designer case firing these events is written from a
grep run in the same edit, after the file existed — `grep -rn pointercancel tests/presentation/designer/`
reached two prose mentions and one test title over a direct `tool.abandonGesture()` call and no
dispatch; every `blur` under that directory was an `input.trigger('blur')` on an Inspector text
field. The header states exactly that and no wider claim.

## Acceptance coverage

| Criterion/test ID | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| A real `pointercancel` at the designer surface abandons the designer's tool gesture | Pass, watched red | `@pointercancel="onPointerCancel"` neutered in `EditorSurface.vue` → `AssertionError: expected Rect{ _id: 36, …(15) } to be undefined`, `Tests 1 failed \| 3 passed` | None |
| A container `blur` at the designer surface abandons it | Pass, watched red | `@blur="onBlur"` neutered → `AssertionError: expected Rect{ _id: 87, …(15) } to be undefined`, `Tests 1 failed \| 3 passed` | None |
| A window `blur` abandons it | Pass, watched red | `onBeforeUnmount(listenOnOwner(element, 'window', 'blur', onBlur));` removed → `AssertionError: expected Rect{ _id: 138, …(15) } to be undefined`, `Tests 1 failed \| 3 passed` | None |
| The restore half of each case is load-bearing, not decoration | Pass, watched red | `dropMarquee(context, true)` → `false` in `designer-select-tool.ts` → `AssertionError: expected [] to deeply equal [ …(2) ]`, `Tests 3 failed \| 1 passed` | None |
| A mis-bind in `DesignerCanvas.vue` turns this file red | Pass, watched red | `:active-tool-id="editorRefs.activeToolId"` → `:active-tool-id="activeToolId"` (the hazard that component's own docblock names) → all four cases red with `Error: the designer mounted no canvas; the read must have refused` and `TypeError: Cannot read properties of null (reading 'value')` at `EditorSurface.vue:193` | The red is a MOUNT failure, not an assertion failure — see below |

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

Break E — `:active-tool-id="editorRefs.activeToolId"` → `:active-tool-id="activeToolId"` in
`src/presentation/designer/DesignerCanvas.vue`:

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

A fourth case was written — *"is over: the press after a cancellation is an ordinary one"*: fire
down/move/`pointercancel`, then drag a fresh marquee and assert it selects both graphics. Under
Break A it stayed **GREEN**, because `DesignerSelectTool` drops a stale marquee at the start of the
next press regardless of whether the cancellation was ever heard. It asserted nothing the three
surviving cases do not already assert, so it was removed and the file's header records why. Nothing
in this file therefore covers the gesture that FOLLOWS an interruption on this surface.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run tests/presentation/designer/designerCanvasGestureOwnership.test.ts` | candidate, `.worktrees/ad07`, Windows, node from the worktree's `node_modules` | exit 0 — `Test Files 1 passed (1)`, `Tests 3 passed (3)`, `Duration 37.47s` | `D:/tmp-claude/t25-green.log` |
| Same command under each of Breaks A–E | working tree only, each reverted | reds quoted verbatim above | `t25-red-pointercancel.log`, `t25-red-elementblur.log`, `t25-red-windowblur.log`, `t25-red-restore.log`, `t25-red-activetool.log` |
| `npx oxlint tests/presentation/designer/designerCanvasGestureOwnership.test.ts` | candidate | exit 0, no findings | shell exit status |
| `npx eslint tests/presentation/designer/designerCanvasGestureOwnership.test.ts` | candidate | exit 0, no findings | shell exit status |
| `npx vue-tsc -noEmit` | candidate, whole tree | exit 0, no output | `D:/tmp-claude/t25-tsc.log` |
| `git status --porcelain` after restoring every break | candidate | one line: `?? tests/presentation/designer/designerCanvasGestureOwnership.test.ts` | shell output |

An earlier run of the file carried four cases and printed `Test Files 1 passed (1)` /
`Tests 4 passed (4)`; the committed file is the three-case version, which is the `3 passed` line
above.

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

## Reviewer and integrator acceptance

Reviewer outcome and findings:
Integrated commit:
Post-integration checks/evidence:
Final status: integrated / verified / blocked
