---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 30
sources:
  - SDD §12
  - SDD §29
  - SDD §60
  - SDD §65
  - SDD §85
  - SDD §91
status: Approved
---
# Calibrate a Plan

Design slice 15's dialog framework and its first real caller, walked end to end in a real
vault — and with it the thing slice 7 built and slice 8 shipped unreachable. This file is
the **canonical procedure**; `docs/tasks/15-modals-and-confirmation-dialogs.md` records what
the runs found and points here.

Run [[Editor Walkthrough]] first, or at least its steps 1–2, so a plan is open with zones on
it. A plan **with** zones is the interesting case: the recalibration confirmation is gated on
whether there is geometry to rescale, not on whether the plan was ever calibrated, so the
sample project's five zones are what make step 4 appear at all.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and
`editor-background-png-test.png` from [`docs/tests/fixtures/`](../fixtures/) set as the
plan's background ([[Editor Walkthrough]] steps 7–8 do that). That fixture carries a
**1000 mm scale bar with end ticks** — the two points to click — plus a 100 mm / 1000 mm grid
with metre labels. Distances are typed in **millimetres** (ADR-009); there is no unit picker.

**Calibrate it to the WRONG length on purpose, and the case says so because the obvious
instruction is a trap.** The fixture is drawn at 1 px = 1 mm and an uncalibrated plan already
uses a placeholder scale of 1 (`PLACEHOLDER_WORLD_SCALE`), so telling the plugin that its
1000 mm bar is 1000 mm is telling it what it already believes: the correction is exactly 1
and **nothing visible changes**. A tester following "type the real length" would see no
effect and file a defect against working code. Typing `2000` instead doubles every
coordinate, so every area must **quadruple** — an arithmetic pass condition, which is a far
stronger check than "the number changed".

**Why a human still matters here, after 1324 automated tests:** two of this slice's defects
were found by driving a real browser and none of them could fail a test. A dialog opened
during `pointerdown` lost focus to Chromium's own default mousedown handling, so `Escape` did
nothing — jsdom implements no focus-on-mousedown at all. And Obsidian's own
`button:not(.clickable-icon)` outranked `.rp-dialog-button-danger` on specificity, so the
destructive button rendered plain white — jsdom never resolves `var()` to a colour. Both
classes of failure are invisible to `npm run check` by construction, and steps 7, 9 and 12
below are where a hand and an eye are the only instrument.

## Steps

| # | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- |
| 1 | Open a plan with zones and write down the Kitchen's area from the Inspector | It shows a number in m² | The baseline, and step 11 needs the actual figure. Before calibration this is background pixels relabelled as millimetres at the placeholder scale of 1 — the defect being fixed, not a passing result |
| 2 | Look at the toolbar | A **Calibrate** button sits beside Pan / Select / Draw zone | The registration itself. `CalibrateTool` existed, tested, registered nowhere for a whole slice — no gate can see a tool that is merely absent from a list |
| 3 | Click Calibrate, then click the two end ticks of the fixture's 1000 mm scale bar | A dialog appears after the SECOND click | The gesture completing on `pointerup`. Opening from `pointerdown` let the browser's own focus-to-`<body>` default land after the dialog and steal its focus |
| 4 | Read the dialog | It asks about rescaling the zones on this plan, and its rightmost button is styled DESTRUCTIVE — red-ish, not the same plain fill as Cancel | The specificity defect. Obsidian's own button rule beat the danger class at (0,1,1) vs (0,1,0), and the only place a `var()` becomes a colour is a real vault |
| 5 | Press `Escape` | The dialog closes, the plan is untouched, and focus returns to where it was before the dialog opened | Escape-cancels plus focus restoration. Slice 6's meaning of `Escape` — abandon the transient interaction, commit nothing — extended to a dialog |
| 6 | Repeat step 3, and this time confirm | A second dialog appears asking for the real-world distance, with the measured plan distance shown above the field | Two dialogs in sequence through the one-at-a-time store. A microtask-ordering mistake here throws `DialogStackingError` out of an uncaught promise |
| 7 | With that dialog open, press `Tab` repeatedly | Focus cycles inside the dialog and NEVER reaches the toolbar, the canvas or the layers panel. The focused control is visibly ringed at every stop | The focus trap, and the one accessibility property the axe check cannot grade: jsdom has no rendering engine, so a focus indicator that is invisible passes every automated check |
| 8 | With that dialog open, try to click a toolbar button and the canvas behind it | Nothing happens — no tool changes, no zone is selected, no vertex is placed | `inert` on the background. jsdom implements no `inert` behaviour at all, so the suite can only assert the ATTRIBUTE is there |
| 9 | Look at where the dialog sits | It is centred over THIS pane, not over the whole Obsidian window | The overlay positions `absolute` against the view root. It depends on that root declaring `position: relative`, which nothing but an eye confirms |
| 10 | Clear the field, or type `0` | The Save button is disabled | The form's own guard. A submit that silently no-ops reads as a broken button |
| 11 | Type `2000` and save | The dialog closes and the Kitchen's area is **four times** the figure from step 1 | The whole chain: form → tool → reversible command → sidecar → the Inspector's post-command refresh. Four and not two is the assertion — the correction applies to each coordinate, so area goes with the SQUARE of it. A ×2 here means the scale reached one axis or was applied to the area directly |
| 12 | Press Undo | Every area returns to its step-1 value | The calibration's inverse. It rescales every coordinate on the plan, so this is the step that proves the inverse covers the zones and not just the calibration record |
| 13 | Calibrate a plan with NO zones drawn on it | No confirmation appears — it goes straight to the distance form | The gate is "is there geometry to rescale", not "has this been calibrated". A fresh import with nothing on it has nothing to lose and must not be asked |
| 14 | Open the same plan in two tabs; start a calibration in one | Only that tab shows a dialog. The other tab stays fully usable | One store and one host per view (SDD §12). A plugin-global dialog would trap both panes |
| 15 | With a dialog open in one tab, press `Escape` while that tab has focus | Only that tab's dialog closes | The `Escape` listener is on the dialog element, not on `document` — a document-level listener per host closes both |
| 16 | **With a dialog open, press `Ctrl+P`** | Record what happens. The command palette is EXPECTED to open on top of the dialog | The honest scope of "modal". This is not an Obsidian `Modal`: nothing pushes a `Scope`, and the keydown handler calls `preventDefault()` without `stopPropagation()`, so Obsidian's keymap stays live behind the `inert` background. Note whether the dialog is still usable after dismissing the palette, and whether `Escape` still cancels. If this vault binds a hotkey to `Escape`, press that too — it fires alongside the dialog's own cancel |
| 17 | **With a dialog open, click the leaf's own view header** — the tab title or its "more options" menu | Record what happens. Focus is EXPECTED to leave the panel, after which `Escape` does nothing until you click back inside | That chrome sits outside the subtree the host inerts, so it stays clickable. Accepted as a boundary rather than fixed; this step exists to find out how bad it actually feels |
| 18 | Open the Renovation project view (the ribbon button) | It opens with no error in the console | The host mounts in BOTH view roots, not just the editor's. Slice 14's empty-state actions open a dialog from here, and a host mounted only beside the canvas would leave that click with nothing to open |
| 19 | Toggle the plugin off and on, then re-open the plan | The calibrated areas are still calibrated; the console shows no `Several Konva instances detected` | Persistence of the calibration across unload — it lives in the `Geometry/*.rpgeo` sidecar, not in the plan note |

Steps 16 and 17 are the two whose expected outcome is **"record what happens"** rather than
a pass condition. They are not soft: they are the two places where the framework's guarantee
is narrower than the word "modal" implies, and the point of walking them is to decide whether
that narrowness is acceptable. Write the answer into the Runs table either way.

## Deliberately NOT checked

- **`DeleteReferenceDialog` and `EntityPickerDialog` cannot be reached from the UI.** Both
  are built and unit-tested with no production caller by design — their caller is slice 10's
  delete-with-references flow, and the queries feeding their rows are slice 10's to define.
  Definition-of-Done items 6, 8 and 8a of the task document are open and say so. Do not hunt
  for a way to open them; there is none, and that is not a defect.
- **Zone names and types.** Every drawn zone is still "Room", named "Zone N". This slice
  built the dialog framework, not creation forms — those are slice 16's, and slice 14 owns
  the empty-state actions that open them. Renaming is not wired.
- **A refused calibration's message.** A refused dispatch reports through the same seam the
  other tools use, and a refused undo/redo reports too — but both need something else to
  touch the plan between the write and the undo, which is not reliably reproducible by hand.
  Covered automatically instead:
  `tests/presentation/editor/tools/calibrateTool.test.ts` for the refused dispatch, and
  `tests/presentation/editor/runtime.test.ts` for the refused undo and redo, the latter
  against a real repository.
- **Colour contrast and hit-target size.** The axe check in
  `tests/harness/accessibility.test.ts` grades roles, names, labels and ARIA validity, and
  explicitly not these three (jsdom has no rendering engine to measure them). Step 7 covers
  the focus indicator; contrast and target size are a theme-by-theme question this case does
  not attempt.

## Runs

| Date | Result | Findings |
| --- | --- | --- |

Anything on this list which does not work is a slice 15 defect, except steps 1 and 2, which
are slice 7's tool becoming reachable, and step 12, which is slice 7's reversible command.
