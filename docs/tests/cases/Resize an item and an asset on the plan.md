---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 205
sources:
  - docs/superpowers/specs/2026-09-15-plan-editor-transform-box-design.md (Interaction)
  - docs/superpowers/specs/2026-09-15-plan-editor-transform-box-design.md (Geometry)
  - docs/superpowers/specs/2026-09-15-plan-editor-transform-box-design.md (Data)
  - docs/superpowers/specs/2026-09-15-plan-editor-transform-box-design.md (Inspector)
status: Ready
---

# Resize an item and an asset on the plan

Covers the transform box on one selected Item (`object`) and one placed library asset, in Plan.
Browser automation and the jsdom suite are supplemental; this case has not been run in a vault.

| Reachable by | Action | Expected result |
|---|---|---|
| suite + obsidian | Draw a rectangle Item and select it | A dashed box stands just outside the outline with eight square handles; the corner dots stay grabbable; the rotation arrow still shows |
| suite + obsidian | Drag the far corner handle outward, release | The Item grows about the opposite corner; one history entry; Undo restores the exact points |
| suite + obsidian | Drag a side handle; then a corner with Shift held | A side handle changes one dimension only; Shift keeps the proportions |
| suite + obsidian | Rotate the Item 30°, then drag a corner handle | The box follows the Item's own edge; the Item stays rectangular |
| suite + obsidian | Drag a handle past the opposite side and release | The last valid preview shows while dragging; release writes nothing |
| suite + obsidian | Place a library asset, select it, drag a corner handle | The placement grows, the opposite corner stays put; the Inspector shows the new width × depth and Reset to library size |
| suite + obsidian | Open the same asset in a second place on the plan | The second placement keeps the library size; the asset in the library is unchanged |
| suite + obsidian | Type a width in the Inspector; then press Reset to library size | The placement resizes about its centre; reset removes its own size |
| suite + obsidian | Replace the resized asset with another | The new asset draws at its own library size |
| suite | Switch to Renovate or Review; select two items | No box and no size fields |
| obsidian | Save, reopen the vault, reopen the plan | Resized Item points and the placement's own size survive; the sidecar reads schema 15 |
| obsidian | Open the plan with a build from before this change | The plan is refused as newer than the build supports, never silently shrunk |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not run. Written with the increment; nobody has walked it in a vault yet. |
