# Zone editing contract alignment

The integrated 2026-09-09 run exposed older test expectations after hover-only rotation
arrows and the M00 initial floor setup were introduced. An unchanged quiet run of
zoneEditing and renovateRoomManipulation reproduced exactly four assertion failures:
three expected rotation arrows before any hover, and one expected obsolete empty-floor
copy. The drawing case that timed out in the eight-worker run passed quietly.

The shared test helper retains the exact direct vertex-circle count, emits a real
buttons=0 pointer move using the current camera, and requires the nested rotation group.
Existing vertex coordinates, area refresh, whole-geometry Undo/Redo and zero Circle/Line
teardown assertions remain intact. After the unchanged Delete action, the test requires
no selected/deleted Room panel and the actual M00 floor setup plus an enabled starting
action. No production code or timeout/threshold was changed.

Scoped Oxlint/ESLint, vue-tsc and all 19 tests across the two files passed with
VITEST_MAX_WORKERS=1. This is automated contract verification, not a manual/native run.

The subsequent inspector contract pass keeps Create's exact description ID under test
while allowing the unrelated persistent free-shape help. Multi-selection now clicks the
named member-focus row, preserving both selected IDs, instead of the newly preceding
Group Inspect action. Marker visibility targets the current planned-layer checkbox.
All 55 cases across newRoomInspector, multiSelectionInspector and renovationRoutes passed
quietly, along with scoped linters and vue-tsc. Production behavior was not changed.
