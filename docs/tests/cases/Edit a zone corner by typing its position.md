---
type: Test case
parent: "[[Smoke Test the Editor]]"
sources:
  - BP-04 (docs/releases/first-beta-readiness/01-improvement-plan.md)
  - "[[Vertex editing has no keyboard path]]"
  - SDD §60
status: Ready
---

# Edit a zone corner by typing its position

BP-04's non-drag corner route in a real vault: **Edit corners** from the zone's right-click menu
and from its Inspector, the numbered corner list, the preview, the write and its Undo. The route
landed in three slices — A (`6546f402c`, `152a3c18c`), A2 (`8bfd6dd6a`, `b6b6a1f27`, `e2d524a9b`)
and B, the reach (`1f2cf7cf8`). Before slice B nothing in the UI opened this dialog at all, so
**no step below has ever been performed by a user**.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a plan
holding at least one Room and one non-Room zone. `Create sample renovation project` seeds both —
three Rooms, a five-corner **Terrace** and a rectangular **Garden**. The Terrace is the zone to
use wherever a step says "a zone with more than four corners".

Browser reproduction of the dialog alone: `npm run harness` →
`?view=plan-editor&select=harness-terrace&outline=1`, which opens it **programmatically**. That
knob is not a door a user can press, so it discharges the dialog's own look and not the reach;
the reach is what slice B added and what steps 1–4 below are for.

**What the automated suite already reaches, so a runner does not re-derive it.**
`tests/presentation/editor/resize/zoneOutlineReach.e2e.test.ts` walks from each door to the
opened dialog, writes a typed corner to the repository from the Inspector door, cancels from it,
greys both doors while writes pause, and asserts the perspective gating (greyed in Renovate,
absent in Review). Those are jsdom results against fake hosts. What is left here is everything
jsdom does not have: Obsidian's own context menu, a real keymap, a themed leaf, a rendered
canvas, a real sidebar width and a screen reader.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and what
they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | In Plan, select the Terrace and right-click it | The menu's edit group offers **Edit corners** beside the zone's rename/details entry | The menu door, in Obsidian's own `Menu` rather than the suite's recorded item list. The entry is pushed for every zone type, so a Terrace must offer it exactly as a Room does |
| 2 | `obsidian` | Choose **Edit corners** | The dialog opens, titled for that zone, over the plan | The reach itself. Until slice B this action existed and nothing opened it (limitation L-24) |
| 3 | `obsidian` | Close the dialog, select a **Room**, and use the Inspector's **Edit corners** button instead | The same dialog opens, titled for the Room | The second door. Both doors call one function; a second door that built its own dialog would look identical here until the two disagreed |
| 4 | `obsidian` | Repeat step 3 on the **Garden** | The Inspector offers the button there too | The Inspector door is mounted for the `room` and `area` record kinds; a zone that is neither in the Inspector's vocabulary would silently lose the button |
| 5 | `suite` | In the open dialog, click **Edit** on corner 3 in the numbered list | Corner 3 is announced, its row reads pressed, and the caret lands in that corner's **X position (m)** field | BP-04's "choose a numbered corner", and its focus move. A chooser that only highlights leaves the user hunting for the field |
| 6 | `browser` | Look at the plan behind the dialog | Corner 3 is marked on the outline and the other corners are not | BP-04 action 3. jsdom draws no canvas, so only a real engine can show the mark at all |
| 7 | `suite` | Type a new X, using a comma as the decimal separator | The outline previews at the typed position; the saved zone, its area and any linked figures do not move | The preview is not a write, and the locale number parser accepts a comma |
| 8 | `suite` | Submit the dialog | One saved change; the corner is at the typed position and every other corner is byte-identical | The write, and "keep untouched coordinates exactly as loaded" — a form that rewrites every corner from its rounded display would look the same on screen |
| 9 | `judgement` | Read the submit button's own label before pressing it | Recorded, not asserted: it reads **Apply name** today, the shared `editor.rename.apply` string, which is the wrong words for this dialog | A copy defect no gate can see — the key resolves, both locales are written, and sentence case holds |
| 10 | `obsidian` | **Ctrl+Z**, then **Ctrl+Y** | Undo restores the exact previous outline; Redo re-applies it. The zone keeps its id, name, type, status and links | One reversible history entry, through Obsidian's keymap rather than the suite's synthetic key events |
| 11 | `suite` | Reopen the dialog, change a corner, then press **Cancel** | Nothing is written and no history entry appears; the mark on the plan is cleared | Cancel creates no history, and a cancelled dialog leaves no mark behind |
| 12 | `suite` | Reopen, submit without changing anything | No write and no history entry | A no-op submission that still dispatches would add an Undo step that undoes nothing |
| 13 | `obsidian` | Switch to **Renovate** and right-click the same zone | **Edit corners** is present but greyed, titled **Edit geometry in plan**, and opens nothing. The Inspector offers no button at all in this perspective | Typing a corner is geometry, and geometry is held to Plan. The zone's rename and delete are NOT gated here, so nothing else in the menu would catch a missing guard |
| 14 | `obsidian` | Switch to **Review** and right-click the zone | Neither door exists | Read-only means the entry is absent rather than greyed — a different mechanism from step 13 and worth its own look |
| 15 | `browser` | Repeat steps 2 and 5 with the pane at a sidebar's width (460 px) | Recorded, not asserted: the dialog covers the canvas, so the mark from step 6 cannot be seen while the dialog that chooses it is open | Limitation **L-27**, and BP-04's own *constrained-layout focus* test item. The headless capture `plan-editor-outline-narrow.png` shows this at 460 px; what a real Obsidian sidebar leaf does is unverified |
| 16 | `obsidian` | Resize the leaf between a wide and a constrained layout while the dialog is dirty, then Cancel | The typed text is retained, and focus lands on a control that still exists | At a constrained width `ResponsiveEditorShell` shows the Inspector column only while its overlay is open, reached from the **Details** rail — so the opener a dialog returns focus to can stop being displayed while the dialog is up. Whether that changes how a user reaches the Inspector door is a separate open question, not something this step settles |
| 17 | `obsidian` | Switch Obsidian's language to German and repeat steps 1–3 and 5 | Both doors read **Eckpunkte bearbeiten**, and the corner list, its fields and the hint render in German | The one string slice B minted. It is owner-supplied in both locales and has never been rendered in a running app |
| 18 | `desktop` | Repeat steps 5–8 using the keyboard alone: reach the Inspector button, open the dialog, reach a corner's **Edit** control, type, submit | Recorded, not asserted: whether every control is reachable in a sensible order, whether the focus ring is visible on each, and where focus lands after the dialog closes | **The condition [[Vertex editing has no keyboard path]] is still open for.** Nothing in this repository can grade it: the accessibility scans run in jsdom, which has no rendering engine and measures neither focus visibility nor contrast nor hit-target size |
| 19 | `desktop` | Repeat with a screen reader | Recorded, not asserted: whether the corner list, the chosen-corner announcement, the field labels and units, the preview and the busy state are understandable, and whether announcements are excessive | The other half of that condition. No assistive technology has been near this route |

## Acceptance criteria

1. Both doors in steps 1–4 open the same dialog, on the zone that was selected, for a Room and
   for a non-Room zone alike.
2. Step 5 chooses a corner and moves the caret to it; step 6 marks that corner and no other.
3. Step 8 writes one reversible change and leaves every untouched corner exactly as loaded.
4. Steps 11 and 12 write nothing and add no history.
5. Steps 13 and 14 keep the route out of Renovate and Review, by their two different mechanisms.
6. Step 17 renders both doors and the dialog in German.
7. Steps 9, 15, 18 and 19 are **recorded**, not passed or failed. Their outcomes belong in the
   Outcome section and in the execution tracker's limitation list, not in a pass verdict.

## Deliberately NOT checked

- **Adding or removing a corner.** This dialog edits the positions of the corners a zone already
  has; **Add point** and Undo are the route for changing their number, and
  `preservePointCurves` refuses a point-count change rather than guessing.
- **Contrast, focus-ring visibility and hit-target size**, anywhere above. The repository's axe
  scans run in jsdom and explicitly grade none of the three; steps 6 and 15 are claims about
  what is drawn and where, not measurements of colour.
- **WCAG conformance for this operation.** Steps 18 and 19 record observations. Conformance is
  a claim [[Vertex editing has no keyboard path]] still refuses, and this case does not close it.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | **Not run.** No step above has been performed, in a vault or anywhere else. Every row is an expectation derived from the shipped code, the automated suite and BP-04's interaction contract. The 460 px behaviour in step 15 is the one thing that has been LOOKED at, in a headless Chromium capture rather than in Obsidian. |

## Outcome

Written after the first walk: which steps passed, what the four recorded steps recorded, and
anything only a live vault showed.
