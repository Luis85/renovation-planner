---
type: Test case
sources:
  - ADR-0029
status: Ready
---

# Drag a caption

Run in `npm run test-build`'s vault with a plan holding one room, one object and one placed asset.

| Reachable by | Action | Expected result |
|---|---|---|
| suite + obsidian | Select the room; hover its name | Grab cursor over the caption; outside it the ordinary target cursor |
| suite + obsidian | Drag the room's caption to a corner of the room and release | Caption follows the pointer; on release it stays there; the room does not move |
| suite + obsidian | Undo, then Redo | Caption returns to the room's centre, then back to the corner |
| suite + obsidian | Move, nudge and rotate the room | Caption keeps its place relative to the room |
| suite + obsidian | Select a room that has a detail plan; drag its caption | The three-line caption moves as one block and stays where dropped |
| suite + obsidian | Click an unselected room on its caption and drag | The room moves, not the caption |
| suite + obsidian | Turn on select multiple, click a selected room's caption | The room is deselected; nothing is dragged |
| suite + obsidian | Select the object, drag its name tag; repeat for the asset | Each tag stays where dropped; geometry unchanged |
| obsidian | Close and reopen the plan | Every moved caption is where it was dropped |
| suite + obsidian | Calibrate the plan | Captions keep their place relative to their items |
| obsidian | Switch to the renovation perspective; press a selected room's caption | No caption drag starts |

## Runs

Not yet run. Record the build hash, date and outcome of each row here when it is.
