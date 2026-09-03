---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 100
status: New
started: ""
finished: ""
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

## References

- [[Errors, diagnostics and the test harness]]
- [[Keep the editor truthful across failure and narrow layouts]]
- Reviewed at commit `16757d6d`, PASS 5.
