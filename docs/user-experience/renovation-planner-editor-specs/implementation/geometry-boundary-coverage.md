# Geometry boundary coverage follow-up

Base: `b10c3b24d51735fdf53b3acd5fbc095024c987ad`.
Status: test source prepared, not executed. Types, lint, focused tests and coverage
remain pending in the coordinator's combined verification batch.

The full baseline run passed 730 files / 8,624 tests, but branch coverage remained
97.28%. The fresh summary identified eight missing branches in operations, six in
groupTransforms, three each in groupSnapshot and CurvedPolygon, and two in circular
intersections. This follow-up selects public geometric boundaries rather than trying
to force every internal fallback. No production code or threshold changes are made.

`curvedOperationBoundaries.test.ts` exercises consistent refusal across area,
perimeter, centroid, bounds, containment and area-admission for malformed edge maps,
nonfinite bulges and unrepresentable radii. It also checks a collapsed curved edge,
an extreme-aspect-ratio boundary whose area remains representable but centroid
normalization cannot represent its thin axis, and exactly concentric semicircles in
both argument orders.

`groupTransformBoundaries.test.ts` exercises saved singleton Rooms without any
structure, retaining curved geometry and metadata through translation/rotation;
refuses retired/out-of-range envelopes; and counts only changed existing unselected
wall neighbours in impact previews. Source snapshots remain unchanged. New walls,
unchanged remote walls and selected hosts are excluded from neighbour counts.

These are nine proposed test cases. No additional coverage gain or passing result is
claimed until the combined batch runs. Existing assertions, timeouts, skips and
coverage settings are unchanged. CircularArc and curved marquee helpers already had
no missing entries in this summary, so their existing tests were left alone.

## Group and repository continuation

Ten additional proposed cases in `groupMembershipBoundaries.test.ts` and
`groupVersionBoundaries.test.ts` cover absent structural documents, preservation of
independent Room membership, peer reuse of a deleted singleton group identity,
unrelated membership, missing Room notes, unsupported note versions, invalid names,
frozen version receipts after a peer rename, rejected next geometry, legacy schemas
5/6/7 with exact data preservation, corrupt curve maps and dangling group writes.
These are also unrun; the combined coordinator batch owns their validation.

Five uncovered migration arms are primitive/null fallbacks in the version 3–7
migration functions. The actual repository extracts those declared versions only
from an object, and each migration preserves object shape. Primitive JSON instead
starts at version 0 and is refused before those stages. The nonnumber branch inside
`schemaVersionOf` is likewise preceded by an explicit malformed-version refusal.
No invented version/primitive pairing or threshold exemption was added to force
those arms. The real legacy read path is exercised without changing any bytes.

The coordinator's combined 168-case batch passed 155 and failed 13. One failure was
this continuation's curved-content fixture: a one-entry bulge map is already refused
by the DTO's edge-count refinement, so it never reaches geometric validation. The
test now supplies four valid DTO points and four bulges with a collapsed first curved
edge, and explicitly asserts schema acceptance before the repository's geometric
refusal. Exact sidecar/all-byte preservation and dangling-group checks remain.
This test-only correction is unrun; no production validator or assertion threshold
was changed. The target test file was identical to coordinator source `56a63e32`
before the correction.

## Remaining diagnostic boundaries

After the coordinator reported all 168 combined boundary cases passing, six further
source-only cases were selected from the diagnostic union. `priceReadBoundary.test.ts`
checks that AssignAsset and RecalculateRequirement preserve existing quantities/costs
and emit no write/event when the project-price read fails, then allow a clean retry.
`geometryQuantityRefusals.test.ts` covers unavailable perimeter quantities for an
unfinished Room, already-restored peer membership, straight-first/curved-second wall
contacts and rejection of a bend beyond a semicircle. These remain unrun.

The diagnostic union is used only to find missing behavior; it is not a passing
coverage result. Higher-guard-only migration/optional-field fallbacks remain untouched.
No existing production code, gate, timeout or threshold changes accompany these tests.
