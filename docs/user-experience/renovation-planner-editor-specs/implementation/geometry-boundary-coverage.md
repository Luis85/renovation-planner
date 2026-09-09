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
