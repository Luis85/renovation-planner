# AD02 — Make resizing and geometry operations predictable

**Owner:** DOMAIN · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD01  
**Exclusive lock groups:** domain, geometry. Exact file leases are still required.

## User or delivery outcome

Resizing an existing object preserves its identity and intended geometry instead of unexpectedly replacing it.

## Entry points to inspect

- `src/domain/asset/shapeEdits.ts`
- `src/domain/asset/AssetShape.ts`
- `src/core/geometry/CurvedPolygon.ts`
- `src/presentation/designer/AssetDesignerRoot.vue (integration lease only)`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Separate creation from dimensions, whole-object resize, selected-part resize and explicit footprint replacement. Move policy out of the root into tested domain/application operations.
2. Preserve straight-sided nonrectangular topology on resize. Choose the fixed anchor deliberately. Keep height independent and retain fractional precision.
3. Apply the accepted circular-arc policy across numeric and handle transforms. The default is proportional scaling for curved geometry; supersede the existing circular-reinterpretation behavior explicitly.
4. Keep measured and pending coordinate spaces separate. Prevent whole-object operations from silently combining incompatible spaces.
5. Implement the agreed clearance-on-resize refusal or review path; do not silently scale a planning clearance into a smaller one.

## Acceptance criteria

- [ ] An L-shaped footprint remains L-shaped after a width edit; only explicit Replace footprint produces a rectangle.
- [ ] Cancel and unchanged values write nothing and add no undo entry.
- [ ] A curved object does not silently undergo an inexact affine stretch advertised as an exact one.
- [ ] Repeated unit switches and edits retain canonical values within the declared numeric tolerance.
- [ ] Footprint-derived dimensions ignore decorative parts; height and plan calibration do not change.
- [ ] Existing assets with clearance are protected even before persistent review metadata lands in AD04.

## Required verification

- Regression fixtures: L-shape, rectangle, circular arc, off-centre anchor, sub-millimetre values and mixed pending flags.
- Reject NaN, infinity, zero/negative factors, overflow and degenerate geometry.
- Test transform then inverse within documented tolerances; mirror twice preserves orientation and curve semantics.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
