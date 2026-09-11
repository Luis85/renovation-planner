---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 92
sources:
  - Editor Interaction & Mental Model Specification §9 (Delete / Backspace) and §65 (context menus)
  - M00 (Delete/Backspace only outside a field) and M11 (More → Delete)
status: Ready
---

# Delete a selection or group

Delete or Backspace deletes what is selected in the Plan Editor by running the context menu's own
Delete. One item takes the Delete it already had; two or more — a saved group included, since
clicking a member selects the whole group — are confirmed once and deleted as one undoable
`DeleteSelectionCommand`, Rooms and Areas with the walls, openings and elements around them.

## Why a human is the only instrument here

What no suite here can see: Obsidian's own handling of Delete and Backspace inside a Plan Editor
leaf (a host hotkey bound to either key would take it first), the host's `trash` menu icon, and a
group's Zone note leaving a real vault and coming back on Undo.

Preconditions: `npm run test-build`, then open this repository as a vault with the plugin enabled,
and a floor holding a Room enclosed through its context menu's **Enclose with walls and group**, a
door on one of those walls, and one object element outside the group.

## Steps

1. Click one of the Room's walls. **Expect:** the Room and all its walls are selected.
2. Press Delete. **Expect:** one confirmation titled "Delete selection" naming the Room and each
   wall, with "Rooms and areas deleted: 1" and "Openings removed: 1". Cancel.
   **Expect:** nothing changes.
3. Right-click the same wall. **Expect:** the menu ends with **Delete group** and a trash icon.
   Choose it and confirm. **Expect:** the Room, its walls and the door disappear, the object stays,
   and the Room's note is gone from the Zones folder.
4. Press Ctrl+Z (Cmd+Z on macOS) once. **Expect:** the Room, its walls, the door and the group all
   return, and clicking a wall selects the whole group again.
5. Press Ctrl+Y. **Expect:** they are deleted again. Press Ctrl+Z once more.
6. Right-click a wall of the group and choose **Select focused item**, then press Backspace.
   **Expect:** the single-wall confirmation, not the group's. Cancel.
7. Click into any text field in the sidebar and press Backspace. **Expect:** the field loses a
   character and no confirmation opens.
8. Switch to Review, select the group and press Delete. **Expect:** nothing happens, and the
   group's context menu has no Delete.
9. Close and reopen the floor. **Expect:** the state step 5's Undo left is still there.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Written with the increment; unrun until walked in a vault. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
