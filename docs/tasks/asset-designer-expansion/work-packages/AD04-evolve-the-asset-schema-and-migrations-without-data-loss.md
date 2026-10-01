# AD04 — Evolve the asset schema and migrations without data loss

**Owner:** MODEL · **Scope:** beta · **Relative size:** L

**Prerequisites:** AD02, AD03  
**Exclusive lock groups:** domain, schema, persistence. Exact file leases are still required.

## User or delivery outcome

Old assets and newly composed objects share one validated, versioned model.

## Entry points to inspect

- `src/domain/asset/AssetDetail.ts`
- `src/domain/asset/AssetShape.ts`
- `src/infrastructure/persistence/dto/assetGeometry.ts`
- `src/application/ports/AssetGeometrySidecar.ts`
- `Actual asset geometry mapper/store/adapter paths resolved in AD00`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Implement the accepted minimal extension: closed geometry and open polyline geometry, stable element identity, optional user labels, shallow graphic groups, and only the authoring metadata needed by accepted behavior.
2. Keep the current stable semantic name separate from a user-editable label; preserve existing solid/dashed and pending semantics.
3. Implement open-geometry validators and pure model constructors now; AD11 adds authoring tools, not a second schema.
4. Allocate the next schema version available at implementation time (reviewed baseline is v2, with v1 read support). Migrate v1/v2 losslessly; reject unsupported future versions.
5. Implement DTO/domain mapping, expected-version preservation, storage failure behavior and fixture round-trips. Avoid destructive bulk rewrites on mere reads.
6. Keep AD04 independently compilable: add compatibility projections or include the necessary mechanical closed-kind consumer adaptations under integration leases. AD05 is functional cross-surface completion, not a future repair for a broken build.
7. Coordinate expanded consumers through AD05 before any new geometry-writing UI is exposed.

## Acceptance criteria

- [ ] Legacy IDs, order, semantic names, bulges, scale flags, calibration, anchor and facing survive migration.
- [ ] Missing optional legacy data is distinguished from present malformed data; corruption is not coerced into valid empty content.
- [ ] Groups contain only graphic element IDs, no cycles/nesting, no dangling or duplicate membership.
- [ ] Open paths have finite valid points and are never faked as zero-area polygons.
- [ ] An older supported binary refuses a newer schema rather than silently stripping group/geometry fields on write.
- [ ] Failed migration or persistence leaves original content recoverable; rollback instructions do not assume old binaries can read new files.
- [ ] Existing source consumers compile and old-geometry behavior remains functional before AD05; new unsupported kinds fail explicitly rather than silently disappearing.

## Required verification

- Golden fixtures: v1 plain, v2 detailed/curved, unscaled/mixed flags, null shape, malformed current, unknown future.
- Migrate → save → reopen → compare semantic equality; corrupt IDs/membership/units must fail.
- Exercise mapper/store/application seams, not just Zod unit tests.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
