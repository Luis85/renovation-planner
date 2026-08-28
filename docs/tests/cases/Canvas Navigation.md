---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 70
sources:
  - SDD §24
  - SDD §57
  - SDD §60
  - SDD §85
status: Approved
---
# Canvas Navigation

The camera gestures a user reaches for while doing something else: **hold space and drag**,
**middle-button drag**, **shift+wheel**, and **`Shift+1` / `Shift+2`** to frame the plan or
the selection.

Run [[Editor Walkthrough]] first, or at least its steps 1–2, so a plan is open with zones on
it. Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled.

## Why a human is the only instrument for four of these

`tests/presentation/editor/canvasNavigation.test.ts` drives every gesture below through the
real mounted editor and asserts what the camera did. Four things it structurally cannot see,
and they are the reason this file exists:

1. **The cursor.** jsdom resolves no styles, so nothing in the suite can tell that
   `.rp-plan-canvas-armed` means `cursor: grab`. The suite asserts the CLASS; only an eye can
   confirm the keyword reaches the pointer. `npm run harness-shot` cannot help either —
   nothing in a headless capture is hovering.
2. **Obsidian's own keymap.** jsdom models no host keymap at all. The space bar, `Shift+1`
   and `Shift+2` are all bindable in Obsidian's hotkey settings, and a user's binding fires
   from Obsidian's `Scope` stack, not from this canvas. Steps 3 and 9 ask what actually
   happens and **record the answer** rather than assert one.
3. **The middle button as the host sees it.** Chrome opens an autoscroll widget on a middle
   press and X11 pastes the primary selection into a focused text input. The canvas calls
   `preventDefault()`, which the suite can check — that the OS then leaves the gesture alone
   is a claim only a real desktop settles.
4. **Focus.** Keys are listened for on the canvas element rather than on `document`, so
   every keyboard gesture below needs the canvas focused first. Step 2 is where that is
   confirmed to happen on its own.

## Procedure

1. Open a plan with zones (the sample project's five will do). Note roughly where they sit.
2. **Click once on empty canvas.** The canvas should now be focused — nothing visible says
   so, which is why the next step is the actual check.
3. **Hold the space bar.** Expected: the pointer becomes a **grab hand** and the plan does
   NOT scroll. Then, still holding, **drag**: the pointer becomes a **closed** grabbing hand
   and the plan moves with it.
   *Record what Obsidian itself did with the space bar, if anything.*
4. **Release the space bar mid-drag**, with the button still down, and keep dragging. Expected:
   the pan continues. This is the rule every canvas editor shares and the one most easily got
   wrong — the gesture belongs to the drag, and the modifier only started it.
5. **Select the Draw zone tool. Place two vertices. Now hold space and drag** to move the
   view, release, and place the third vertex and close the polygon. Expected: the zone is
   created from all three points — the half-drawn polygon **survives the pan**. This is the
   whole reason the pan is an override rather than a tool; a `PanTool` would have discarded
   the buffer on the way in.
6. **Middle-button drag** on the canvas, with the Select tool active. Expected: the plan pans.
   No autoscroll widget appears, and nothing is pasted anywhere.
7. **Start a zone drag with the left button, and press the middle button mid-drag.** Expected:
   nothing pans. The zone drag finishes normally on the left release.
8. **Shift+wheel.** Expected: the plan moves **sideways** and the zoom does not change. Then
   wheel **without** shift: it zooms, as before. Try it on a **trackpad** too — a two-finger
   sideways swipe should pan **with no modifier held**, and a mostly-vertical swipe should
   still zoom rather than drifting sideways as your fingers wobble.
8a. **On a touch device, if you have one:** with the plan panning under one finger, put a
   second finger down and move it, then lift it. Expected: neither disturbs the first
   finger's pan. Try it in camera mode (no tool selected), which is where a second finger
   most plausibly lands.
9. **`Shift+1`.** Expected: the camera reframes so every zone is visible at once, centred,
   with a margin. Then zoom in hard on one corner and press it again.
   *Record whether Obsidian's own keymap took `Shift+1` first.*
   **On a non-US keyboard, this is the step to watch.** Both shortcuts match the PHYSICAL
   digit key (`event.code`), not the character the layout produces — `Shift+2` is `@` on a
   US layout and `"` on the German and UK ones. If either does nothing on your keyboard,
   that is a real defect and not a local quirk.
10. **Select one zone, then `Shift+2`.** Expected: the camera frames that zone. With
    **nothing** selected, `Shift+2` must do **nothing at all** — the view you had is kept.
11. **Hold space, then Alt+Tab away and back** without releasing it. Expected: the canvas is
    NOT stuck in pan mode — the next click selects normally. Focus leaving is the only notice
    the canvas gets that the key was released.
    **This step is the ONLY instrument for a claim no gate can settle.** The cleanup is
    registered twice — on the container's own `blur` and on the `window`'s — because Chromium
    can deactivate a window while leaving the focused element focused, and nothing here can
    determine which of the two Electron actually delivers: jsdom models no window activation,
    and a headless browser has no OS window to deactivate. Registering both is what makes this
    step pass whichever way the host behaves; if it still fails, neither fired and that is a
    real finding.
11a. **On a plan with a background and NO zones**, the canvas shows an empty state with a
    "Draw a zone" button. **Tab to that button and press Space.** Expected: the button
    activates and the Draw zone tool becomes active — the canvas must NOT arm the camera or
    swallow the key. The one keyboard-reachable control inside the canvas, and the canvas's
    own shortcuts must not take precedence over it.
12. **Right-click the canvas.** Expected: whatever Obsidian normally does. The right button is
    deliberately not claimed by the camera — see below.
    *Record what appeared.*

## What is deliberately absent, so a tester does not file it

**Right-drag does not pan**, and that is a decision rather than a gap. It works in Obsidian's
own Canvas on Windows and not on macOS, because macOS fires `contextmenu` on mousedown where
Windows fires it on mouseup — Obsidian's own developers called supporting it "very
hard/impossible (due to API limitations and differences among OSes)". Claiming it here would
mean suppressing the context menu on every platform, on a canvas that may yet want one. Space
and the middle button are the two gestures that behave identically everywhere.

**Nothing snaps** during any of this, and no grid is drawn. That is [[Zone Editing
Walkthrough]]'s territory and still unimplemented — `SnapService` is wired and handed no
candidate geometry.

## Findings

Record anything the steps above turned up here, then treat it as a defect of the slice that
owns the surface. A manual case whose findings are not converted into an automated check will
find the same thing again next release — and for steps 3, 9 and 12 the conversion may be a
sentence in the case rather than a test, since no gate here can reach a host keymap.

_No run recorded yet._
