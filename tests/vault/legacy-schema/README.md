# legacy-schema

One zone note at `schema-version: 1`, carrying a `legacy-label` field that this fixture's
consumer migrates to `name` through a TEST-ONLY migration step.

Test-only, and the reason is mechanical rather than stylistic: every array in
`MIGRATION_SET` is empty, so `latest` derives to 1 for all six kinds and
`MigrationRunner`'s `while (version < latest)` loop iterates ZERO times for a version-1
note — nothing migrates and nothing is proven. A version-0 note finds no step from 0 and
throws `migration.chain-gap` before any assertion runs.

So the consumer registers a step in a test-local runner and proves the RUNNER: that it
applies a step, reaches the same state when run twice, and leaves a note already at the
current version untouched. It proves nothing about any production migration, because there
are none. That is the honest reading of Architecture Completion Criterion 9 — a claim about
the mechanism accepting a migration, not about one existing. Slice 12 owns no schema.

The project and plan notes beside the zone exist to make this a coherent vault, matching
`valid-project/` and `broken-references/`; the consumer reads only the planted zone note.
