# Modal and opening behavior coverage follow-up

Prepared against the missing behaviors reported by the stable `b758695c` coverage
artifact, with the verified reference-pointer naming repair already in this base.
This contribution changes tests only and does not alter production behavior or gates.

New cases cover wheel anchoring and delta bounds, competing/interrupted pointers,
high-DPI and collapsed viewport recovery, live theme redraw, visible marker labels,
prepare/measurement transitions and temporary 2D context loss. Reference setup also
receives a late public point event while stale and is disposed during a step transition.

Opening cases cover refused/stale reads, dispatcher rejection and clean retry, late
results after disposal, retired failed reads, and Door/Window/plain Opening movement
on a later host with field absence preserved. Photo cases cover picker cancellation,
default note creation and unavailable catalogue capability. The existing photo-strip
case additionally checks that hiding it does not steal external focus.

Status: source-ready, **not run or type/lint-verified yet**, as requested for the next
combined one-worker focused batch. `git diff --check` passed. Include these five files:

- referenceViewportControls.test.ts
- referenceWorkflow.e2e.test.ts
- openingMove.test.ts
- photoAdd.test.ts
- existingPhotoStrip.test.ts

Also rerun the unchanged planningWorkflow.test.ts for CostGroup navigation/selection,
which already has detailed assertions but timed out in the eight-worker run, and
referenceViewport.test.ts for its existing coordinate/zoom boundary coverage.
No full coverage percentage or native/browser acceptance is claimed by this checkpoint.
