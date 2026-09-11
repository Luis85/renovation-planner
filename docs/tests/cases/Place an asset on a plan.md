---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 200
sources:
  - Plan editor asset placement design spec §2 (placing and editing)
  - Plan editor asset placement design spec §3 (the placement-count rule)
  - Plan editor asset placement design spec §4 (deleted and missing assets)
status: Ready
---

# Place an asset on a plan

Add → Asset… picks a designed asset from the library; clicking the floor places copies, each a
reversible write, turning to face the room when the pointer is near a wall. A placement's
Inspector shows its size, opens its designer, replaces its asset and adds a material that counts
placements in its room. `docs/superpowers/specs/2026-09-10-plan-editor-asset-placement-design.md`
is the design.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, a project
with a floor that has walls and one Room, and two library assets with a unit of piece — one
designed with a footprint, one never opened in the designer.

## Steps

1. Add → Asset…, choose the undesigned asset. **Expected:** a notice says it has no footprint; the
   tool does not start.
2. Add → Asset…, choose the designed asset. **Expected:** the banner reads the placing
   instruction; a preview footprint follows the pointer.
3. Move the pointer next to a wall inside the room and click. **Expected:** the footprint's back
   edge sits on the wall's inner face, the facing tick points into the room.
4. Click twice more in open floor. **Expected:** two more copies, the tool still active.
5. Press Ctrl+Z once. **Expected:** only the last copy disappears. Press Esc. **Expected:** Select
   is active.
6. Select the wall-side copy. **Expected:** the clearance outline appears; the Inspector shows its
   width × depth and Open in designer, Replace asset…, Add as material.
7. Add as material, save. **Expected:** the material's quantity equals the copies inside the room.
8. Delete one copy inside the room. **Expected:** the material recalculates one lower.
9. Delete the designed asset in the asset library, return to the plan. **Expected:** every copy
   draws as a dashed crossed square; the Inspector says the asset no longer exists; the material
   still counts them.
10. Replace asset… on one placeholder with another designed asset. **Expected:** it redraws with
    that footprint; Ctrl+Z restores the placeholder.
11. Hide the Assets layer row. **Expected:** placements disappear and cannot be clicked.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not run. Written with the increment; nobody has walked it in a vault yet. |
