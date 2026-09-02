# valid-project

The healthy baseline. **Its intended consumer does not exist yet** and this slice does not
add one.

That consumer is the Obsidian arm of the repository contracts, repointed off `FakeVault`
onto this fixture. The repoint is deferred: it is not one adapter but a second composition
root for tests — `NoteVaultDeps` declares eight members and `ObsidianZoneRepository` takes a
`PlanGeometryStore` beside them — and the existing one lives in `tests/helpers/vault.ts`.

Read by `tests/helpers/fixtureVault.test.ts` only, as the case its conformance tests open.
Most of that file exercises the adapter's own read/write mechanics over this directory's
bytes — a create, a modify, a folder listing — and asserts nothing about what any note
MEANS. One case goes further than that: it reads `Project.md` through a constructed
`ObsidianProjectRepository` and asserts `entity.name` on the result, to prove the repository
this fixture stands up is genuinely usable and not merely `toBeDefined()`. That is a smoke
check on the read PATH, not the scenario-shaped consumer the repository-contract repoint
above would be — `broken-references/` and `legacy-schema/` each have one of those (a refusal
that must not crash the plugin, a migration that must be idempotent), and `valid-project/`
does not yet. Said plainly rather than left for the next reader to work out from the test
file, because fixture content nothing exercises as a scenario is indistinguishable from
content that happens to be correct.

**`Library/` holds a designed asset and an undesigned one** (ADR-0014), read by
`tests/infrastructure/obsidian/repositories/assetGeometrySidecar.test.ts` through the
`AssetGeometrySidecar` port. `Base cabinet 600.md` (`asset-designed`) has a sidecar at
`Library/Geometry/asset-designed.rpgeo`; `Worktop oak 40mm.md` (`asset-undesigned`) has
none, on purpose. The PAIR is the fixture — an asset with no geometry is the ordinary
starting state of every asset ever created, and a fixture that could only express the
designed one would hide every "no shape yet" path in the suite behind a `.rpgeo` somebody
remembered to add. This is scenario-shaped content in the sense the paragraph above says
`valid-project/` did not yet have: both cases assert what the bytes MEAN, and removing the
sidecar turns the first one red rather than quietly changing nothing.

`Library/` is a top-level folder here rather than a child of `Renovation/`, matching
`openFixtureVault`'s own `DEFAULT_LIBRARY_FOLDER` and the §83 rule it was chosen for: a
library nested under the project root would overlap every project this stack creates.

**Must contain at least one file in a SUBFOLDER.** `Plans/Ground.md` is that file. The
adapter's path-enumeration conformance case (`fixtureVault.test.ts`, "enumerates
vault-relative, forward-slashed paths") asserts that no enumerated path carries a native
separator — and a fixture whose files all sat at the root would have no path with a
separator in it, so the assertion would be vacuous exactly on the platform (Windows) it
exists for. The case checks this itself, so a flattened fixture fails there rather than
silently weakening the check; recorded here too, because the requirement belongs where the
fixture is built and not only where it is read.
