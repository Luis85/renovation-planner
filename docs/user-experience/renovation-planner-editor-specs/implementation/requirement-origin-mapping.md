# Validated Requirement origin mapping

Root audited and approved this bounded cleanup. The only production file changed is
`src/infrastructure/persistence/mappers/requirementMapper.ts`.

`RequirementOrigin` currently has one variant: `{ kind: 'zone', zoneId }`.
`Requirement.create` still rejects any other origin kind. The writer therefore emits
the existing `zoneId` directly; it no longer carries a null fallback for an unsupported
future variant. Adding such a variant now requires the writer to handle it explicitly
because the direct property access would fail type checking.

The V1 Requirement frontmatter schema declares `origin-kind` as `z.literal('zone')`.
V2 extends only version/source, and V3 only the version. All three branches of the
read schema therefore guarantee this literal before `requirementFromPersistence`
receives `dto`. The second kind check after successful `parsePersisted` was unreachable
and has been removed, together with its now-unused `err` import.

The schema parser and domain rejection remain unchanged. No accepted origin, field,
wire value, schema version or input validation was removed. Existing mapper/Requirement
tests and public persisted roundtrips are the verification scope; exact counter removal
is measured from original counter files and recorded separately. No threshold, discovery
setting, timeout or suppression is changed.

Verified: 56/56 tests in eight files (14.85 seconds), types, whole Oxlint, scoped
ESLint and Fallow static analysis (zero issues/clones) passed. This includes the
existing mapper/Requirement neighbors and real persisted command roundtrips.
Exact counter removal remains pending the next matching full measurement. No scoped
counter run was started in this slot, which was returned for final UI verification.
