# Element and placement admission coverage

Source-only follow-up to the fresh `b10c3b24` coverage report. Ten cases across
three files exercise observable boundaries without changing production code,
thresholds, timeouts or exclusions. The earlier CurveTool tests are unchanged.

- `elementMoveAdmission.test.ts`: unsupported body/vertex targets cannot begin a
  move; a Stair translation retains options and original geometry; editing an
  Arrow's first endpoint constrains from its next point; collapsing that endpoint
  is refused rather than saved.
- `elementNativeBoundaries.test.ts`: a missing element and an Inspector click whose
  selection just retired stay inert; a late failed edit read after leaf disposal
  neither reports into that leaf nor steals focus; moving from unchanged geometry
  retains a later metadata-only rename, including after a subsequent write refusal;
  invalid native Stair dimensions remain pending and chorded Enter is consumed;
  actual pending geometry writes freeze creation parameters and save the reviewed
  dimensions once.
- `structureDraftAdmission.test.ts`: invalid door swing text is rejected while a
  generic opening ignores retained swing values; malformed or overlong widths
  refuse host snapping without replacing the last accepted host/offset.

Some reported defensive arms have no ordinary valid-state producer, such as a
private ElementMove points calculation with no active gesture or an Inspector name
missing from a valid persisted element. These tests do not corrupt stored metadata
or invoke private methods merely to increment counters. Final coverage gains must
be measured by the parent rather than inferred from case count.

`git diff --check` passed. Tests, types, linters and coverage are **unrun** for these
source-ready additions; root owns the combined single-worker gate. No browser or
installed-host acceptance is claimed. No heavy process was started locally.

The parent's first combined addition batch reported 155/168 passing, with two
failures owned by these cases. The Arrow's derived endpoint was
`-600.0000000000001` rather than `-600`; that coordinate now uses a 1e-9-scale
numeric comparison while ID, original geometry, point count and unchanged endpoint
identity remain exact. The refused move correctly compensated its Plan write,
restoring the entity at revision +2. Its test now verifies the attempted geometry
write/version, both Plan save versions, exact restored Plan entity/geometry and all
non-Plan bytes. These are corrected test expectations, not production changes.
The corrected cases are unrun locally and await the parent's combined rerun.
