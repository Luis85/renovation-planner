---
type: Task
parent: "[[Errors, diagnostics and the test harness]]"
order: 10
dependsOn:
  - "[[01-plugin-bootstrap-and-composition-root]]"
  - "[[02-core-primitives]]"
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---
# Design Slice 11: Error Handling, Diagnostics & Data Safety

## Purpose

Slice 2 defines the vocabulary of failure: the `AppError` family (`DomainError`,
`ValidationError`, `PersistenceError`, `GeometryError`, `ImportError`,
`MigrationError`, `ReferenceError`, `CalculationError`) and the `Result<T,E>`
type used to carry expected failures across layer boundaries. That vocabulary
is inert on its own — nothing yet says what happens when an Obsidian API call
throws, how a `Result` becomes a message a user reads, whether that message
also reaches a local log file, or what a repository must do before it is
allowed to touch a Vault file.

This slice builds that plumbing. It is cross-cutting: every other slice's
commands, repositories, and views are expected to conform to it rather than
invent their own error handling, logging, or write-safety conventions.

## Scope

### In scope

- The Error Boundary (SDD §66): the fixed pipeline that takes a thrown
  Infrastructure exception, maps it to one of slice 2's typed errors, wraps it
  in a `Result`, and turns it into a user-facing message at the Presentation
  boundary.
- Logging **policy** (SDD §67): which events take which of the four levels, the rule
  that every mapped `AppError` is logged with its original cause at the mapping step,
  and the hard rule that logs never leave the device automatically. The facility
  itself — the `Logger` port and its console adapter — is slice 1's, because bootstrap
  can fail before any of this slice's code exists to catch it; this slice consumes that
  port without widening it.
- Diagnostics (SDD §68): the structured, content-free technical snapshot the
  plugin can produce on request.
- Security & Privacy defaults (SDD §86) as they constrain this plugin's own
  logging, diagnostics, and error-reporting code.
- Data Safety rules (SDD §87) applied concretely to the repositories and
  migrations slices 3–4 introduce: what "validate before write", "preserve
  unknown Markdown content", "avoid full-note rewrites", "never cascade-delete
  silently", and "fail closed on unsupported schema versions" mean in this
  codebase's terms.
- The Reliability and Security subsections of the Non-Functional Requirements
  (SDD §88) as acceptance criteria for the above.

### Out of scope (covered by other slices)

- The base error type hierarchy and `Result<T,E>` itself — slice 2
  (`02-core-primitives.md`). This slice only consumes those types.
- The repository interfaces, Obsidian adapter implementations, schema
  validation with Zod, and migration runners themselves — slice 4
  (`04-persistence-and-repository-layer.md`). This slice states the safety
  rules those implementations must satisfy; it does not design the
  repositories.
- The domain entity error cases (e.g. which `ValidationError` a `Zone`
  constructor raises) — slice 3.
- Fixture/integration Vaults, migration test suites, repository contract
  tests, and architecture-enforcement tooling that verify these rules hold —
  slice 12 (`12-testing-and-architecture-enforcement-infrastructure.md`).
  This slice defines the rules; slice 12 defines the harness that catches a
  regression against them.
- How a `ToUserMessage` string is *rendered*: which surface it lands on (toast,
  modal, inline field error, save-state badge) is slice 17's routing decision,
  and what an inline field error looks like — draft retention, `aria-invalid`
  wiring, the error-code-to-field map — is slice 16's. This slice produces the
  typed error and the message; neither slice's container is designed here.

## Dependencies

- Slice 1 (Plugin Bootstrap & Composition Root) — the `Logger` port
  (`application/ports/Logger.ts`), its console adapter, and the composition root that
  injects it. This slice adds rules and call sites, not a second logger.
- Slice 2 (Core Primitives) — the `AppError` hierarchy and `Result<T,E>`.
- SDD §7.4 (Infrastructure Layer) — `infrastructure/logging/` is the home for
  the logger's implementation; diagnostics collection sits alongside it.
- SDD §7.3 (Application Layer) — commands and queries are the layer that
  performs Infrastructure → Application error mapping before anything reaches
  Presentation.

## Design

### The Error Boundary

SDD §66 fixes the pipeline shape:

```text
Infrastructure Exception
        ↓
Application Error Mapping
        ↓
Typed Result
        ↓
Presentation
        ↓
User Message
```

Concretely:

- **Infrastructure Exception.** Anything the Obsidian API, the filesystem
  adapter, or a third-party library (Zod, a geometry library) can throw is
  caught at the Infrastructure boundary, not left to propagate raw. Per SDD
  §65, unexpected technical failures may throw inside Infrastructure; they
  must not throw past it.
- **Application Error Mapping.** Application-layer commands and queries (SDD
  §7.3) are the mapping point. Each catch site maps a caught exception to the
  narrowest applicable slice-2 error type — a Vault write failure becomes
  `PersistenceError`, a Zod parse failure becomes `ValidationError`, a stale
  or dangling entity ID becomes `ReferenceError`, an unsupported
  `schema-version` becomes `MigrationError`. A mapping site must not
  default everything to a generic `DomainError`; that defeats the purpose of
  having a typed hierarchy.
- **Typed Result.** The mapped error is returned as `Result<T, AppError>`,
  never thrown further. Commands and queries have no `throws` in their public
  contract.
- **Presentation.** Presentation code (Pinia actions, Vue components) pattern
  matches on the `Result`. It never receives a raw exception and never
  inspects `error instanceof SomeInfrastructureType` — by the time an error
  reaches Presentation it is always one of slice 2's domain error types.
- **User Message.** Presentation renders a short, actionable message derived
  from the error's *type and domain-level fields only* (e.g. "Zone geometry
  is invalid: polygon is self-intersecting"), never the raw exception message
  or stack trace. The full technical detail — original exception, stack,
  offending payload — goes to the logger (below), not to the user-facing
  string.

This gives every error two representations from the same mapping step: a
terse user message, and a detailed log entry. They are produced together and
must not drift into being produced from two independent code paths.

```typescript
// application/commands/zone/MoveSpatialObject.ts (illustrative — the same shape every
// command in this codebase has; slice 3 owns this command's actual body)
async function execute(input: MoveSpatialObjectInput): Promise<Result<void, AppError>> {
  try {
    const saveResult = await zoneRepository.save(zone); // Result — resolves, never throws
    if (isErr(saveResult)) {
      logger.error('zone.save.failed', { zoneId: input.zoneId, cause: saveResult.error });
      return saveResult;
    }
    return ok(undefined);
  } catch (cause) {
    const mapped = mapPersistenceException(cause); // -> PersistenceError | ValidationError
    logger.error('zone.save.failed', { zoneId: input.zoneId, cause });
    return err(mapped);
  }
}
```

The `try`/`catch` here still matters: it is the boundary for whatever *does*
throw (an unexpected technical fault per SDD §65, not the repository's own
expected-failure path). Slice 3's repository port resolves a failed `Result` for an
expected write failure rather than throwing, so that result must be inspected
and returned explicitly — the `catch` block is not what runs for it, and this
function must not report a failed write as `ok(undefined)` by falling through
the happy path unchecked.

```typescript
// presentation/stores/zone-store.ts (illustrative)
const result = await moveZoneGeometry(input);
if (!result.ok) {
  surfaceError(toUserMessage(getLanguage(), result.error), origin); // domain-level, translated
}
```

`surfaceError` stands in for a decision this slice deliberately does not make: *which*
surface the message lands on — a toast, a modal, an inline field error, or the
save-state indicator — is slice 17's routing table, over containers slices 13, 15 and 16
build. What this slice fixes is that the argument is always a `ToUserMessage` string
derived from a typed `AppError`, never a raw exception.

### Logging

- Levels: `debug`, `info`, `warn`, `error` (SDD §67). The port and its single
  implementation in `infrastructure/logging/` already exist (slice 1); what this slice
  adds is which events take which level, and the requirement that they be used at all.
- **Application and Infrastructure code log; Domain code does not.** Callers depend on
  the `application/ports/Logger.ts` interface, never the concrete implementation — the
  layer rule (SDD §8) would not permit otherwise. Domain is excluded deliberately rather
  than by omission: a `Zone` that logged would be a pure entity with a side effect and an
  injected dependency, against ADR-006. It returns a `Result`, and the command that
  called it is the layer that records what happened — which is the same place the error
  mapping below already sits, so the log line and the mapped error come from one step.
- `debug` — verbose, developer-facing, off by default.
- `info` — notable state transitions (migration ran, project index rebuilt).
- `warn` — recovered-from problems (a stale index entry was repaired, an
  optional sidecar was missing and was regenerated).
- `error` — every mapped `AppError` that reached a command/query boundary,
  logged with the original cause, at the Application Error Mapping step
  above.
- **Logs never leave the device automatically** (SDD §67, §86). The logger
  writes to a local sink only (console and/or a local log file under the
  plugin's data directory). There is no network transport, no remote
  aggregation, and no background upload path in this layer. Nothing in this
  slice contradicts that; any future opt-in export of logs is a distinct,
  explicit user action (e.g. "copy diagnostics to clipboard"), never an
  automatic one.

### Diagnostics

A `GetDiagnosticsSnapshot` query (SDD §7.3 query pattern) assembles a single
structured, JSON-serializable snapshot from data already known to the
Application layer:

```typescript
interface DiagnosticsSnapshot {
  pluginVersion: string;
  obsidianVersion: string;
  schemaVersions: Record<string, number>; // entity type -> current schema version in use
  migrationState: {
    pending: string[];   // migrations not yet applied, if any
    lastApplied: string | null;
  };
  validationIssues: Array<{
    entityType: string;
    entityId: string;
    issue: string; // domain-level description, e.g. "unknown schema-version: 3"
  }>;
}
```

Hard rule (SDD §68, §86): **project content is never included.** No zone
names, no note bodies, no frontmatter values beyond the schema-version
number, no file paths beyond what is needed to identify *that an* entity has
an issue (an opaque entity ID is acceptable; a human-readable project or zone
name is not). A user can explicitly export a project (SDD Infrastructure
`export/`) — that is a separate, deliberate action outside this snapshot, not
something Diagnostics does on their behalf.

The snapshot is presentation-agnostic: it is a plain object a settings view
can render, copy to clipboard, or write to a file the user chooses to save —
never something the plugin transmits on its own.

### Security & Privacy defaults

Per SDD §86, the default posture — which this slice's own logging and
diagnostics code must not violate — is:

```text
no telemetry
no remote calls
no account
no cloud persistence
```

Consequences for this slice specifically:

- The `Logger` and `DiagnosticsSnapshot` implementations must not contain any
  HTTP client, websocket, or analytics SDK dependency. If a future slice adds
  an integration that needs one (e.g. an optional crash-report uploader),
  SDD §86's "future integrations are explicit and optional" applies: it must
  be off by default, require a separate opt-in setting, and be documented as
  a deviation from the default posture — not bundled silently into logging or
  diagnostics.
- SDD §88 Security: "no unnecessary external communication or privileged
  APIs" — the Obsidian APIs this slice's error-mapping code touches
  (`Vault`, `Notice`) are read/write-local only.

### Data Safety rules, applied to this plugin

SDD §87 states seven rules in the abstract. Applied to the repositories and
migrations slices 3–4 build:

1. **Never develop against production Vaults.** All development, manual
   testing, and CI runs against the fixture Vaults slice 12 provides
   (`tests/vault/`, SDD §75) — never against a real user Vault. This slice
   states the rule; slice 12 owns the fixtures.
2. **Validate before write.** Every repository `save()` runs the entity
   through its Zod schema (SDD §43) before any Vault write is issued. A
   `Result` failure from validation short-circuits the write entirely — the
   Vault is never touched with a payload that hasn't parsed.
3. **Preserve unknown Markdown content.** A note's frontmatter may carry keys
   this plugin doesn't know about (added by the user, another plugin, or a
   future plugin version), and its body is always free-form (SDD §38: "The
   note body remains free-form"). A repository read-modify-write cycle must
   round-trip both unchanged: parse frontmatter into a superset object,
   update only the keys the current command intends to change, and re-serialize
   the rest as received. The note body is never regenerated from domain
   state; it is passed through untouched unless a command explicitly edits it.
4. **Avoid full-note rewrites where targeted changes suffice.** Prefer a
   frontmatter property patch (rewrite only the YAML block) over rewriting
   the entire file. A full-note rewrite is reserved for cases with no
   narrower option (e.g. first-time note creation), and even then must still
   satisfy rule 3 for the parts it is asked to preserve (e.g. a template's
   body).
5. **Never cascade-delete silently.** The SDD has no Deletion Semantics
   section, but the PRD does (§64), and it specifies the flow rather than just
   the prohibition: Cancel / Remove References / Reassign / Delete Anyway.
   Stated as a rule for this layer: deleting an entity that other entities
   reference (e.g. a `Zone` referenced by `Requirement`s) must not silently
   delete or orphan those referents as a side effect. The command layer either
   (a) blocks the delete and returns a `ReferenceError` naming the referents,
   or (b) proceeds only on an explicit resolution passed in as data, after a
   confirmation step that enumerated what would be affected. Silent, implicit
   cascades are disallowed either way. Slice 15 builds the dialog; slice 10
   wires this slice's two entities into it; the enforcement stays in the
   command, because a script or a migration never sees a dialog.
6. **Maintain migration tests.** Every migration under `migration/` (SDD §45)
   ships with a test fixture pair (pre-migration, expected post-migration)
   exercised by slice 12's test infrastructure. This slice's obligation is
   that migrations stay deterministic and idempotent where practical (SDD
   §45) so such tests are meaningful; slice 12 owns running them in CI.
7. **Fail closed on unsupported schema versions.** SDD §44: every persistent
   format carries a schema version. When a repository encounters a
   `schema-version` newer than the version this plugin build supports, or
   for which no migration path exists, it refuses to load that entity — it
   returns a `MigrationError` (or `ValidationError` for a malformed version
   field), surfaced through the Error Boundary above, rather than guessing,
   truncating, or coercing the data. Per Architecture Completion Criteria
   item 13 (SDD §92), this failure is scoped to the one affected entity: it
   does not prevent the rest of the project or plugin from loading.

## Interfaces & Contracts

```typescript
// core/errors (slice 2, referenced here) — not redefined. AppError is the
// full eight-category union (DomainError | ValidationError | PersistenceError
// | GeometryError | ImportError | MigrationError | ReferenceError |
// CalculationError); every type below that accepts "any mapped error" is
// typed as AppError, not the narrower literal DomainError category slice 2
// also defines — conflating the two would make this file's own `DomainError`
// name collide with slice 2's, with a different (and incompatible) shape.

// application/ports/Logger.ts (slice 1, referenced here) — not redefined and not
// widened. Four levels, `(event, context?)`, `error`'s context carrying `cause`. A
// second declaration of this interface beside its consumers is how two loggers with
// drifting signatures start.

// application layer — the one place Infrastructure exceptions are mapped
type ExceptionMapper = (cause: unknown) => AppError;

// application/queries
interface DiagnosticsSnapshot {
  pluginVersion: string;
  obsidianVersion: string;
  schemaVersions: Record<string, number>;
  migrationState: { pending: string[]; lastApplied: string | null };
  validationIssues: Array<{ entityType: string; entityId: string; issue: string }>;
}
type GetDiagnosticsSnapshot = () => Promise<DiagnosticsSnapshot>;

// presentation — the only place an AppError becomes copy. It takes the language,
// because it produces user-facing text and every user-facing string in this plugin
// resolves through presentation/i18n's t(language, key). The mapping an
// implementation performs is `error.code` -> StringKey -> t(...); a code with no key
// falls back to a generic per-category message, never to the error's own `message`
// field, which is developer-facing English written at the throw site.
type ToUserMessage = (language: string, error: AppError) => string;
```

Contract notes:

- `Logger` is injected via the composition root (slice 1) like any other
  Application port; Domain code never imports it at all (see Logging above). Nothing
  outside `infrastructure/logging/` reaches the console instead — slice 1's `no-console`
  ban is what makes that checkable for code this slice never sees.
- `ExceptionMapper` implementations are one-per-Infrastructure-adapter (one
  for the Obsidian Vault adapter, one for the import adapter, etc.), each
  narrowing to the smallest correct `AppError` variant — they are not a
  single catch-all switch, and "smallest correct" still permits the literal
  `DomainError` category itself for a genuine domain-invariant violation that
  doesn't warrant a narrower one (see slice 17's worked example).
- `ToUserMessage` takes an `AppError`, never `unknown` — this is what enforces
  "Presentation never sees a raw exception" at the type level. The `AppError`'s own
  `message` field is *not* what it returns: that string is written for a log line, in
  English, at the site that raised it. User-facing copy comes from the locale tables,
  keyed by `error.code`, so a German user reads German and the sentence-case lint that
  runs over `en.ts` covers it.

## Persistence Impact

- This slice does not add new persisted entities or file formats.
- It constrains how slice 4's repositories perform every read-modify-write:
  validate-before-write, targeted patches over full rewrites, preservation of
  unrecognized frontmatter keys and the free-form note body, and refusal
  (not silent correction) on an unsupported schema version.
- The local log sink (if file-backed) is plugin-local data, not project data,
  and is excluded from any project export — logs are operational, not part of
  the Markdown-native project record (SDD §3.2, §87).
- Diagnostics snapshots are computed on demand and are not persisted as a
  file by default; if a user chooses to save one, that is the explicit-export
  path, not an automatic write.

## Testing Strategy

(Test *infrastructure* — fixture Vaults, contract-test runners, CI wiring —
is slice 12's responsibility. This section states what must be true of this
slice's own logic, testable at the unit/application level slice 12's harness
will run.)

- **Error mapping unit tests**: for each `ExceptionMapper`, feed a
  representative Infrastructure exception (Vault write failure, Zod parse
  failure, dangling reference, unsupported schema version) and assert the
  correct narrow `AppError` variant is produced — never a generic fallback
  when a specific mapping exists.
- **Result-not-throw contract**: application command/query tests assert no
  command or query function can reject/throw past its public boundary for
  any input in its test matrix; failures always arrive as a resolved, failed `Result`.
- **Resolved-failure-is-not-a-throw test**: given a repository test double
  configured to resolve a failed `Result` (never to reject), assert the Application
  Error Mapping site inspects and returns that result — a `try`/`catch` around
  the call must not let the resolved error fall through to a happy-path
  `ok(...)` return, since it never entered the `catch` block to begin with.
- **Message/log separation**: given an `AppError`, `toUserMessage` returns a string
  containing no raw exception message, stack fragment, or file path — and, for a code
  with a locale entry, not the `AppError.message` field either; the paired
  `logger.error` call (asserted via a test double) receives the full cause. A companion
  case asserts the same error resolves to different text under `'en'` and `'de'`, which
  is what proves the message is coming from the locale tables rather than from a
  literal that happens to read well in English.
- **Diagnostics content test**: given a snapshot fixture with sample project
  data loaded, assert the produced `DiagnosticsSnapshot` contains no zone
  names, note bodies, or file paths — only the fields in the interface above.
- **Round-trip preservation test**: write a note with an unknown extra
  frontmatter key and a hand-authored body, run a command that patches one
  known property, and assert the unknown key and body are byte-for-byte
  unchanged in the result.
- **Cascade-delete test**: attempt to delete an entity with existing
  referents and assert the delete is refused (or requires the explicit
  confirmation path) rather than silently succeeding and orphaning or
  deleting the referents.
- **Fail-closed schema test**: load a fixture entity with a schema version
  above the highest one this build's migrations cover, and assert the load
  returns a `MigrationError` and does not fall through to a best-effort parse
  of the unknown shape.

## Definition of Done

- [ ] An Infrastructure exception thrown anywhere under `infrastructure/` is
    caught and mapped to a specific slice-2 `AppError` variant before it can
    reach Application or Presentation code; no command or query's public
    contract can throw.
- [ ] A repository call that resolves to a failed `Result` (an expected read or write
    failure, per slice 3's port contract) is inspected and propagated at its Application
    Error Mapping site, never mistaken for the absence of failure because no
    exception was thrown.
- [ ] A user-facing error message never contains a raw exception message, stack trace, or
    internal file path, and is produced by `t()` from the locale tables rather than by a
    literal or by `AppError.message`; the corresponding `logger.error` call always carries
    that full detail, in English, unaffected by the user's language.
- [ ] Every level slice 1's port declares has a real caller by the end of this slice —
    `warn` in particular, which slice 1 leaves without one — and each is used for the
    category stated above rather than being chosen by feel at the call site.
- [ ] The logger (slice 1's, injected via the composition root) still writes only to a
    local sink after this slice: no code path sends a log entry off the device
    automatically, and nothing under `domain/` imports the port.
- [ ] `GetDiagnosticsSnapshot` returns plugin version, Obsidian version, schema
    versions, migration state, and validation issues, and demonstrably contains
    zero project content (no entity names, note bodies, or content-bearing
    file paths) unless a separate, explicit export action was taken.
- [ ] No dependency on a network client, analytics SDK, or remote endpoint exists
    in `infrastructure/logging/` or the diagnostics query.
- [ ] A note with unknown extra frontmatter keys and a hand-authored body
    survives a targeted property-update round trip unchanged in both the
    unknown keys and the body.
- [ ] Deleting an entity with existing referents is either refused with a
    `ReferenceError` naming the referents, or gated behind an explicit
    confirmation step — never a silent cascade.
- [ ] An entity whose `schema-version` is unsupported causes the plugin to refuse
    to load that entity with a clear, typed error, not a silent
    best-effort parse, coercion, or drop — and this failure is scoped to that
    entity, not the whole plugin (per SDD §92 item 13).
- [ ] All of the above is exercised by unit/application-level tests runnable
    independent of slice 12's fixture Vaults (slice 12 additionally proves it
    end to end against real Vault-shaped fixtures).

## References

- SDD §64 Error Model — base error categories (defined in slice 2; referenced
  here, not redefined).
- SDD §65 Result Pattern — `Result<T,E>` usage convention (defined in slice
  2; referenced here).
- SDD §66 Error Boundary — the mapping pipeline this slice implements.
- SDD §67 Logging — logger levels and the local-only rule.
- SDD §68 Diagnostics — allowed fields and the no-content rule.
- SDD §7.3 Application Layer — where error mapping and queries live.
- SDD §7.4 Infrastructure Layer — `infrastructure/logging/` location.
- `src/presentation/i18n/` and `docs/requirements/Multilanguage.md` — the existing
  `t(language, key)` lookup `ToUserMessage` resolves through, and the standing
  requirement that makes a user-facing English literal a defect rather than a shortcut.
  Log lines are the deliberate exception: they stay English, since they are read by a
  developer, not the user.
- SDD §38 Markdown Entity Model — note body remains free-form.
- SDD §42 Persistence Consistency — preserve previous valid data on failure.
- SDD §43 Schema Validation — validate-before-domain-entry via Zod.
- SDD §44 Schema Versioning — every persistent format carries a version.
- SDD §45 Migration Architecture — deterministic, tested, idempotent
  migrations.
- SDD §75 Integration Test Vault — fixture Vaults (owned by slice 12).
- SDD §86 Security and Privacy — no telemetry/remote calls/account/cloud
  persistence by default.
- SDD §87 Data Safety — the seven numbered rules this slice applies.
- SDD §88 Non-Functional Requirements — Reliability ("persistence errors must
  never silently discard project data") and Security ("no unnecessary
  external communication or privileged APIs") subsections.
- SDD §92 Architecture Completion Criteria, item 13 — a broken project file
  does not prevent the entire plugin from loading.
- PRD §63–64 Reference Integrity, Deletion Semantics — the source of Data Safety
  rule 5's Cancel/Remove-References/Reassign/Delete-Anyway flow (not to be confused
  with the SDD's own §64, Error Model).
- `docs/requirements/Architecture and Software Design.md` — slice map and shared conventions.
