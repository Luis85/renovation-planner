# AD17 — Add explicit native asset portability after beta

**Owner:** INTEGRATION · **Scope:** post-beta · **Relative size:** L

**Prerequisites:** AD04, AD05, AD13, AD14, AD16  
**Exclusive lock groups:** portability, schema, exports. Exact file leases are still required.

## User or delivery outcome

Users can transfer an editable asset without confusing a preview image with a native definition.

## Entry points to inspect

- `Existing import/export services and asset repositories`
- `Current reference-resource handling`
- `Schema and recovery paths from AD04/AD14`

These are investigation/ownership entry points, not blanket edit permission. Resolve actual files and leases in AD00/dispatch; proposed files are not claimed to exist.

## Implementation work

1. Define a versioned native manifest containing metadata, geometry, identity/remapping policy and optional explicitly selected resources.
2. Export geometry plus allowed resources and a preview; omit unrelated project/private reference content by default.
3. Validate import paths, resource counts/sizes, supported versions, resource types and external references before writing anything.
4. Preview identity collisions and import as a new asset by default; never overwrite an existing definition automatically.
5. Use staged writes with recoverable commit/failure behavior and deterministic ID/reference remapping.
6. Keep SVG/PNG export distinct from editable native packages. Arbitrary SVG import remains a separate security and geometry project.

## Acceptance criteria

- [ ] Export → import in a fresh test vault preserves editable geometry, placement and intended metadata.
- [ ] No traversal path, unexpected network request or silent overwrite can occur.
- [ ] Cancelled/failed imports leave no apparently valid half-imported asset.
- [ ] Unknown future versions and unsupported resources are reported before mutation.
- [ ] Only intentionally selected reference resources leave the vault.
- [ ] This task is not auto-started by the beta orchestrator.

## Required verification

- Round-trip fresh-vault tests and collision remapping.
- Hostile archive/path/resource and partial-write failure tests.
- Validate exported file list for accidental reference/project data disclosure.

## Handoff and integration gate

Use [TASK-REPORT.md](../templates/TASK-REPORT.md). Record exact base/candidate/integrated commits, contract revision, files changed, tests and exit codes, acceptance coverage, screenshots where relevant, and all verification not performed. Apply [DECISIONS.md](../contracts/DECISIONS.md) and the task-specific requirements above.

No task is verified until its actual integration wiring and relevant consumers pass the required checks. The worker cannot waive missing dependencies, future-schema refusal, negative cases or a real-host test by declaring completion.
