---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 100
status: Done
started: 2026-09-04
finished: 2026-09-04
horizon: Now
start: ""
due: ""
risk: ""
priority: high
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: S
complexity: ""
business-value: ""
business-value-model: ""
---

# Three plan-editor captures can complete before their intended state appears

## The question

Spec §10 says the harness shots are evidence of the hydrated editor and its 460-pixel
constrained layout. `scripts/harness-shot.mjs:200-219` sends three of those shots through the
view wrapper selector, while `scripts/captureReadiness.mjs:90-115` treats attachment of that
selector as readiness. What proves hydration and the rail have landed before capture?

## What is true today

`plan-editor-dark`, `plan-editor-light` and `plan-editor-narrow` wait only for the Plan Editor
view wrapper. That wrapper is attached before asynchronous project hydration establishes the
ready editor state, so all three captures can complete while the intended contents are still
loading.

The narrow shot additionally waits on no constrained-layout marker. It can therefore capture a
460-pixel-wide wrapper without proving that the Layers and Details rail has appeared. The
selected-room and Add-menu shots are precise because their selectors name the state each shot
exists to show.

Measured by running `npm run harness-shot` at `16757d6d`: all twenty PNGs were written and the
five plan-editor images happened to show their intended states, but the command's successful
wait condition remained only the wrapper for these three.

## Why it matters

A successful command can produce a valid PNG of the wrong state. That is the most dangerous
failure for a visual instrument: the file exists, the run exits cleanly, and the reviewer
reasons from a picture that never reached the state named by its filename.

## What closes it

Give the resting shots a readiness selector that appears only after hydration, and make the
narrow shot wait for a constrained-layout element or attribute in addition to the ready editor.
Extend `tests/build/harness-shot.test.ts` to assert that dark and light name a hydrated
floor-state selector and that narrow additionally names
`.rp-editor-shell[data-layout="constrained"] .rp-panel-rail`; mutations back to
`PLAN_EDITOR_VIEW` must fail those assertions.

## What closed it

**2026-09-04 (R14).** `plan-editor-dark` and `plan-editor-light` now wait on
`.rp-floor-inspector` (`FLOOR_STATE`) rather than the bare view wrapper — drawn only once
project hydration is ready and nothing is selected — and `plan-editor-narrow` waits on a LIST,
`.rp-plan-canvas` alongside `.rp-editor-shell[data-layout="constrained"] .rp-panel-rail`, since
the canvas alone can attach before the constrained reflow that produces the rail has actually
happened. `waitUntilReady` in `scripts/captureReadiness.mjs` now accepts `string | string[]`
for a fixed shot and resolves only once every named selector has attached. `PLAN_EDITOR_VIEW`
is gone from `scripts/harness-shot.mjs` entirely — every Plan Editor shot now names a selector
proving its own state, so there is no bare-wrapper spelling left for a future shot to fall back
to. Mutating `plan-editor-dark` back to a bare view-wrapper selector was run and watched red at
exactly the predicted assertion before being reverted. Holding tests:
`tests/build/harness-shot.test.ts` › 'the headless harness capture script' › 'waits for the
hydrated floor state on the resting plan-editor shots, and for the rail as well on the narrow
one', and `tests/build/captureReadiness.test.ts` › 'waitUntilReady' › 'waits on every selector
of a list for a fixed shot'. Commit "test(harness-shot): wait for the state each plan-editor
shot names, derive the inventory from SHOTS, and measure the 320 px shell for horizontal
overflow".

## References

- [[Errors, diagnostics and the test harness]]
- [[Keep the editor truthful across failure and narrow layouts]]
- Reviewed at commit `16757d6d`, PASS 5.
