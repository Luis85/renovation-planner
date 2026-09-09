# Stair and Direction arrow supplemental browser journey

Prepared against integrated source `996ef1a591fbb5e8abfd40bb0704b0029af7298a`.
Run `node scripts/editor-stairs-arrows-check.mjs` from the checked source worktree after
the serialized browser slot is available. The actual CLI is declared in `.fallowrc.json`.

The existing four-scenario matrix covers light, dark, custom accent and German constrained
layouts. Setup reuses the existing reference/wall/Room journey. The reference layer is then
hidden through its real checkbox and checked before every Stair/Arrow screenshot, so a
baked-in scan cannot be mistaken for native tread or arrowhead rendering.

The journey uses native keyboard and pointer input for Add, Shift-constrained placement,
stair width/run/tread/direction editing, stair pointer rotation, Arrow point editing and
endpoint dragging, quarter turns, and exact geometry/metadata Undo/Redo. Constrained Add
starts with Details open and requires activation to close it and focus the canvas. It
checks no-write previews, schema-8 output, real Konva tread/Arrow nodes, and persisted
two-point stair centrelines rather than stored footprint copies.

`editorElementProbe.ts` reads only the rendered scene, current projection and configured
drawing increment. Its transform supplies client coordinates for actual browser input;
it does not call commands, assign draft fields, inject tool gestures or change view state.
Existing fidelity probes and the nine final journeys are unchanged in behavior.

Outputs are under `harness-shots/editor-stairs-arrows`; the shared runner records exact Git
source and hashes of images actually produced. This is a supplemental Chromium/FakeVault
journey, not installed-host evidence. At this checkpoint only script syntax is verified;
execution, screenshot inspection, accessibility results and native Obsidian acceptance
remain pending.
