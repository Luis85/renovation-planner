# legacy-schema

Two unrelated things live here, and the difference between them is the point of this file:
a zone NOTE whose migration is test-only, and three asset-geometry SIDECARS whose migration
is real. Read the section you came for; do not carry the first one's caveat onto the second.

## The zone note — a migration that does not exist

One zone note at `schema-version: 1`, carrying a `legacy-label` field that this fixture's
consumer migrates to `name` through a TEST-ONLY migration step.

Test-only, and the reason is mechanical rather than stylistic: every array in
`MIGRATION_SET` is empty, so `latest` derives to 1 for all seven kinds and
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

## `Library/Geometry/` — three migrations that DO exist

`asset-legacy-v1.rpgeo`, `asset-legacy-v2.rpgeo` and `asset-legacy-v3.rpgeo`, read by
`tests/infrastructure/obsidian/repositories/assetGeometryLegacyFixtures.test.ts` through the
`AssetGeometrySidecar` port.

**These are not the same kind of fixture as the zone note above, and the paragraphs above do
not apply to them.** `MIGRATION_SET` has nothing to do with asset geometry: the raising happens
in the DTO, in `raiseLegacyVersions`, which answers a v1, v2 or v3 document as version 4 before
`AssetGeometrySchemaV4` ever sees it. That is production code on the real read path, so removing
one of these files removes coverage of a shipped migration rather than of a test-local runner.

One file per version `raiseLegacyVersions` names, so the set is total over its own condition
rather than a sample of it. Each carries something a later version added and the file itself
predates, which is what the read has to default: v1 omits all three pending flags, v2 omits
`kind` and `pending` on its detail and carries a curved footprint, v3 omits
`clearanceNeedsReview` while carrying a clearance for it to have been about.

**Why files at all, when `dto/assetGeometry.test.ts` already drives the same schema on
literals** (AD15 row F08): a literal is built by the same process that reads it, so it can never
disagree with the reader about JSON's own surface. These go through a real `vault.read` and a
real `JSON.parse`. Their consumer asserts the version each file still DECLARES on disk beside
what came back, because this port answers an absent sidecar with a SUCCESS — so a deleted or
tidied-up fixture would not turn a read red on its own.

No asset NOTES accompany them, unlike `valid-project/`'s pair. `AssetGeometryStore.pathFor`
asks the Project Index first and DERIVES the path when the index has not joined one, which is
this vault's state — nothing rebuilds an index here — so a note would be inert scenery a reader
could mistake for load-bearing.
