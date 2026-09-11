---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 91
sources:
  - Plan editor copy and paste design spec §1 (what this increment delivers)
  - Plan editor copy and paste design spec §5 (PasteCommand)
  - Plan editor copy and paste design spec §6 (wiring)
  - PRD §39
status: Ready
---

# Copy and paste across floors

Ctrl/Cmd+C snapshots the canvas selection into a clipboard the whole plugin shares across every
open leaf; Ctrl/Cmd+V places it on any floor of any project as one undoable `PasteCommand`,
selected. `docs/superpowers/specs/2026-09-10-editor-copy-paste-design.md` is the design and
`docs/superpowers/plans/2026-09-10-editor-copy-paste.md` the plan this case's wave belongs to.

## Why a human is the only instrument here

What no suite here can see: Obsidian's own handling of Ctrl/Cmd+C and Ctrl/Cmd+V inside a
Plan Editor leaf, the native menu icons `copy` and `clipboard-paste` in the installed host, and
a paste written into a real vault across two floors.

Preconditions: `npm run test-build`, then open this repository as a vault with the plugin
enabled, and one project with two floors — on the ground floor, a Room drawn with its walls
("room" ticked on the wall tool), a door on one of those walls, and one object element.

## Steps

1. Ground floor: select the Room, the object and the door. Press Ctrl+C (Cmd+C on macOS).
   **Expect:** nothing visible changes; no notice.
2. Open the first floor in a second tab. Click an empty spot on the canvas — the shortcut reaches
   the editor only while focus is inside it, and opening a tab focuses nothing there — then, with
   the pointer still on that spot, press Ctrl+V.
   **Expect:** the Room, its walls, the door and the object appear centred under the pointer,
   selected. The Room keeps its name. The Zones folder holds a second note with that name
   (suffixed with its id).
3. Press Ctrl+Z once. **Expect:** everything pasted in step 2 disappears, and its Zone note is gone.
4. Press Ctrl+Y. **Expect:** it all returns.
5. Right-click an empty spot on the first floor. **Expect:** Paste is listed with a paste icon;
   choosing it pastes centred where you right-clicked.
6. Point at the Room pasted in step 2 and press Ctrl+V again.
   **Expect:** a notice begins "Walls cross or overlap."; nothing is added, and the Zones folder
   gains no note — the refusal is checked before any note is written, so none reaches the trash
   either.
7. Click into the Inspector's name field and press Ctrl+V. **Expect:** the canvas adds nothing;
   the field receives whatever the system clipboard holds (step 1's copy did not put anything
   there).
8. Switch to Review. Right-click the Room pasted in step 4. **Expect:** Copy is listed, Paste is not.
9. Close and reopen the first floor. **Expect:** what steps 4 and 5 wrote is still there.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Written with the increment; unrun until walked in a vault. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
