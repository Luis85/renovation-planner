# Native shell input and task completion coverage

Source-only continuation from the `b10c3b24` coverage report. Seven cases in two
new files exercise reachable UI paths; no production, thresholds, timeouts or
exclusions changed.

`nativeShellInputBoundaries.test.ts` covers forward/vertical radio navigation and
wrap, modifier and ordinary-key non-interference, focus/selection/camera retention,
actual header Redo, explicit Pan's painted active/armed phases, native pointermove
with button -1, overlay cancellation isolation, and Shift+F10 context admission
from a real wall list row with Escape focus restoration.

`taskBannerOperationBoundaries.test.ts` saves a real curve and a wall through the
canvas task banner, verifies exact undo, refuses Curve Cancel while its geometry
write is pending, and refuses free-form Room switching during a captured Room save.
Room's separate accepted live-Cancel behavior during creation is unchanged and is
not mislabeled as a blocked action.

The remaining nullable root/canvas fallbacks and optional Group-provider fallback
in CanvasContextMenu cannot normally occur in the composed editor. No detached
fake tree or corrupted state was added just to reach them. The actual list-context
case verifies its accessible native route without claiming it covers those guards.

`git diff --check` passed. All seven cases, types, linters and coverage are **unrun**
locally; root owns the combined verification. The earlier diagnostic union is not
an acceptance result for these additions. No heavy process or native-host capture
was started.
