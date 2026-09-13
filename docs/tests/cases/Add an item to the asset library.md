---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 220
sources:
  - Plan editor item modes and library design spec §A (rectangle or free-form)
  - Plan editor item modes and library design spec §B (Add to asset library)
status: Ready
---

# Add an item to the asset library

Add → Item draws a rectangle by default and switches to free-form corners and back. Right-click on a
saved item creates a library asset from its name and outline and puts a placement of it where the
item was. `docs/superpowers/specs/2026-09-13-plan-editor-item-modes-and-library-design.md` is the
design.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, a project with
a floor that has walls and one Room.

## Steps

1. Add → Item. **Expected:** the task bar shows **Rectangle** pressed and says to drag; details show
   the position and size fields open.
2. Drag inside the room. **Expected:** a rectangle follows the pointer; a single click afterwards
   leaves it unchanged.
3. Choose **Free-form**. **Expected:** the same four corners stay; clicking the plan adds a corner.
4. Choose **Rectangle**. **Expected:** the outline becomes the box around every corner.
5. Type a width in details, then try **Free-form**. **Expected:** nothing changes until the entry is
   applied or discarded.
6. Name it `Cabinet` and Finish. Right-click it. **Expected:** **Add to asset library** is listed.
7. Choose it. **Expected:** New asset opens with `Cabinet` and a footprint line giving the outline's
   size in millimetres, and no width or depth fields.
8. Enter a unit cost and create. **Expected:** the item redraws as a placement with the same outline;
   its Inspector offers Open in designer.
9. Open the asset library. **Expected:** `Cabinet` is listed; its designer shows the same footprint,
   without an unscaled warning.
10. Back on the plan, press Ctrl+Z. **Expected:** the placement is a plain item again; the asset is
    still in the library.
11. Switch to Review and right-click the item. **Expected:** no **Add to asset library**.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not run. Written with the increment; nobody has walked it in a vault yet. |
