---
type: Task
parent: "[[Errors, diagnostics and the test harness]]"
order: 10
dependsOn:
  - "[[01-plugin-bootstrap-and-composition-root]]"
  - "[[02-core-primitives]]"
status: Done
started: 2026-08-25
finished: 2026-08-27
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

### Carried forward from the slice 8 review pass (2026-08-25)

The slice 8 review pass moved the boundary this slice formalizes. Four
things to know before designing the Error Boundary.

- **A THROWN fault now triggers a store re-read.** SDD 65 lets an unexpected technical
  fault throw, and `ObsidianZoneRepository`'s own post-write bookkeeping runs after both
  files are already on disk — so a throw says nothing about whether a write landed.
  `withEditorStateRefresh` therefore re-reads the canvas and Inspector on a rejection as
  well as on success, and re-throws the fault unchanged. The consequence for this slice:
  by the time a fault reaches the boundary, the stores may already show the post-write
  state. The fault is still a fault; the stores are not evidence either way.
- **`runtime.ts`'s `reportFault` was a PLACEHOLDER for this slice's boundary, and this
  slice filled it.** It exists because every dispatch in a leaf is ultimately bound to a
  click handler that discards its promise, so a fault used to surface as a console
  unhandled rejection and that button silently stopped working. It called `notify()` with a
  raw `Error.message`, which was the wrong text for a user and the right shape for a seam;
  it calls `notifyFault` now, which maps the cause through the same
  `createVaultExceptionMapper` a guarded service uses and prints the locale table's copy
  for the resulting code. The door stays open on purpose rather than becoming unreachable —
  see item 1's withdrawn clause: the raw repository PORTS presentation holds are what can
  still throw at it.
- **The serialization queue must never reject.** `tools/serial-queue.ts` is shared by
  `CommandHistory` and the refresh decorator; its `tail.catch` is what stops one command's
  technical fault from poisoning the chain and wedging every later gesture in the leaf
  with no error anywhere. It was copy-pasted between the two before, which is two chances
  to lose a line whose absence is invisible.
- **Category is a discriminant, so one logical failure must not arrive as two.** The two
  reversible zone adapters minted the identical `zone.nothing-to-undo` code as a
  `Reference` failure in one file and a `Persistence` failure in the other, both as
  hand-built object literals, in a file that already imports the `referenceError` factory
  and uses it a few lines further down. Reach for the factory; a hand-built `AppError` literal is how
  that happened.

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
  A test matrix is a list, though, and the claim is a category — so the same rule is also
  asked of the COMPOSITION: a walk of everything the root hands out, driving a fault
  through every door it finds and requiring the mapped refusal back, with every exception
  carved out by name. A service composed next month without a guard has to survive that
  rather than be remembered.
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
- **Diagnostics content test**: assert the produced `DiagnosticsSnapshot` carries only
  the fields in the interface above, and that each of them is populated from the sources
  named there. It is deliberately NOT the obvious shape — a fixture with sample project
  data loaded, asserted to contain no zone names — because a ledger written content-free
  by the same hand that writes the assertion proves only that the query adds nothing. The
  no-content half lives at `DiagnosticsLedger.record`'s parameter list instead (a closed
  kind union, a branded id, the whole `AppError`), where a caller could break it; see the
  Definition of Done item below for what that reaches and what it still does not.
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

### What the closing pass measured, and what it left open (2026-08-27)

Every box below is ticked and every one has a check behind it. Two of them are ticked
against **narrower sentences than this document originally carried** — item 1's first
clause and item 6's "demonstrably" — and both narrowings are written into the item itself
rather than left for a reader to infer, because a claim this architecture cannot reach is
the same defect as an unchecked comment.

Eight things are true of the code and are NOT protected by a check. Each is here rather
than hidden behind a tick:

- **The repository PORTS handed to presentation are outside the Error Boundary.**
  `PlanEditorCommandServices.zones` and `requirementEdits`' `requirements`/`assets` leave
  the composition root raw, because the reversible adapters restore their snapshots through
  them. Item 1 says so; `presentation/notices/notify.ts`'s `notifyFault` is what keeps a
  fault from one of them presentable.
- **The fail-closed gate is on the READ path only.** No save path calls `migrateNote`, so
  "refuses to load" is the whole guarantee. Item 10 says so, `migrateNote`'s header says so
  where the code is, and `errorPaths.test.ts`'s "is a READ gate" case pins today's truth: a
  save holding a current expectation overwrites a future-version note.
- **A `plan-geometry` read refusal never reaches the diagnostics ledger.** The sidecar
  refuses a future `schemaVersion` with the same code and category a note read produces, but
  `PlanGeometryStore` is not on the one `ledger.record` path, so that kind can appear in a
  snapshot's `schemaVersions` and never in its `validationIssues`. Pinned as an absence in
  `errorPaths.test.ts`, and expected to be deleted when the sidecar records.
- **The set of codes with copy of their own is not a closed set.** The two override commands
  re-emit the error they were handed, so a money or cost code can reach the Inspector and
  render its category sentence. That is still `t()` copy, so item 3's claim holds — but it is
  the general sentence rather than the specific one.
- **German vocabulary has no gate.** The sentence-case lint runs over `en.ts` only, nothing
  renders `de.ts`, and this slice found two drifts in it by reading (an Asset called
  "Material" where the German UI says "Objekt", and a Reference pair using
  "Verweis"/"umhaengen" where the delete dialog says "Referenz"/"neu zuweisen"). A glossary
  comment in `de.ts` names the three terms and the keys that own them; a comment is not a
  mechanism.
- **Nothing checks that a level is used for its CATEGORY, and only two of `warn`'s seven
  call sites are asserted at all.** Measured rather than argued, by converting every
  `logger.warn` in `src/` to `logger.error` and running the gates: `npm run build` and
  `npm run lint` pass, `npm run analyze` passes and reports nothing whatever about a
  `Logger.warn` no production code calls (dead exports 0.0%, and only the 13 pre-existing
  private-type leaks), and the suite reds exactly two of 2055 tests — the reassignment
  recalculation in `deleteResolutionEngine.test.ts` and the excluded note in
  `pipeline.test.ts`. So the level cannot reach zero callers silently, because those two
  stand in the way; but the other five sites can change level with every gate green, and
  §67's "which events take which level" is checked by nobody. An earlier version of this
  bullet claimed the last call site could go with all four gates green — that was the audit's
  own unmeasured hypothesis, repeated here as fact, and the measurement above is what
  replaced it.
- **The boundary check's detonation list is HAND-WRITTEN.** `guardCategory.test.ts` blows up
  seven collaborators by name — the five repositories, the geometry port and the file probe —
  while `index`, `vaultDeps`, `migrations`, `geometryStore`, `locks`, `markers` and
  `changeAdapter` are left intact, and `DeleteZoneCommand` is composed WITH `markers`. The
  walk, the doors and the carve-outs are all category-shaped; this one list is not. It costs
  nothing today because the instrument fails closed — an undetonated service answers a
  success and a success is a finding — but it is the "list the places" shape this slice spent
  five review rounds removing, and it is disclosed here rather than left to be discovered.
- **An `EntityId` is branded, not validated.** `buildProjectIndexEntries` asserts a note's
  raw frontmatter `id` into `EntityId<string>` after checking only that it is a non-empty
  string, so a hand-edited `id:` reaches the ledger verbatim. The brand stops a call site
  from passing content; it cannot stop the vault from having supplied it.

**Data Safety rule 5 is no longer the exception it was recorded as.** Slice 11's own commit
message closed with "Data safety rule 5 documented N/A until slice 10 referents exist",
which was true of a tree in which nothing referenced anything. Slice 10 closed it, and
closed it in the right place: `checkConsentedSet` in
`application/reference/deleteResolution.ts` refuses a bare delete that has live referents
and names them, and a resolution must carry the exact `resolvedReferents` set the dialog was
built from, compared as a SET rather than as a count. The enforcement is in the COMMAND,
which is what rule 5's own text demands, because a script or a migration never sees a
dialog. Item 9 below is ticked on the command's tests, not on the flow's.

- [x] **No command or query leaving the composition root can throw past the Application
    layer.** An unexpected Infrastructure exception raised beneath one is caught, mapped to a
    specific slice-2 `AppError` variant and logged with its original cause at that one step,
    and the public contract resolves a failed `Result` instead of rejecting.
    Checked at the forbidden thing rather than by listing the places:
    `tests/plugin/guardCategory.test.ts` composes a real root, detonates seven named
    collaborators beneath it (the five repositories, the geometry port and the file probe),
    walks everything the root and the editor bundle hand out, drives a hostile input through
    EVERY door it finds, and requires the mapped `vault.unexpected-failure` back. Seven is a
    hand-written list and the last one in that file; it does not weaken the check, because a
    service whose collaborators were not detonated answers a SUCCESS and a success is
    reported as a finding — the instrument fails CLOSED. See the open section above. Behavioural rather than structural on purpose — an "is this a wrapper?" check
    cannot see a facade pairing a guarded `execute` with a raw `executeWithVersion`, which is
    the door the Inspector dispatches through and the defect this slice shipped once. Two
    carve-outs, each by name, with its reason, and both asserted so the keys cannot quietly
    grow: the diagnostics query, which reads no vault and returns no `Result`, and
    `calibratePlan()#undo` before any execute, which is driven at the wrapper by
    `guardWiring.test.ts` instead.

    **The wider clause this item used to open with — "an Infrastructure exception thrown
    anywhere under `infrastructure/` is caught and mapped … before it can reach Application
    or Presentation code" — is WITHDRAWN rather than met.** It is unsatisfiable while
    `PlanEditorCommandServices` deliberately hands presentation raw repository PORTS
    (`zones`, and `requirementEdits`' `requirements` and `assets`), a decision slices 6, 8
    and 10 each made for the same reason: the reversible adapters read and restore their
    snapshots through them. Guarding a port is a different mechanism — every method, not one
    `execute` — so a fault inside one still arrives at presentation as a throw, and
    `notifyFault` maps it there into the same coded refusal a guarded service would have
    produced. Closing that seam belongs to a later slice; until then the sentence names it
    rather than reading over it.
- [x] A repository call that resolves to a failed `Result` (an expected read or write
    failure, per slice 3's port contract) is inspected and propagated at its Application
    Error Mapping site, never mistaken for the absence of failure because no
    exception was thrown. The boundary logs that half too, with the `AppError` as its cause
    (`guardAgainstThrowing.ts`, and its "logs a resolved failed Result" case), so a refusal
    and a fault each produce one log line rather than one of them producing none.
- [x] A user-facing error message never contains a raw exception message, stack trace, or
    internal file path, and is produced by `t()` from the locale tables rather than by a
    literal or by `AppError.message`; the corresponding `logger.error` call always carries
    that full detail, in English, unaffected by the user's language. `toUserMessage` resolves
    `error.code` -> suffix -> category, in that order, and its tests assert both the
    no-raw-detail half and that one error reads differently under `'en'` and `'de'`.
    `NOTICE_TEXT_BAN` in `eslint.config.mjs` puts the rule at the two notice doors this
    repository has (`notify(...)`, `new Notice(...)`) rather than at the call sites someone
    thought of; `tests/build/notice-text-boundary.test.ts` drives it through real fixture
    paths, blind spots included — a value one hop away, a template literal, a notice raised
    under a third name. Slice 10's nine reachable coded refusals have entries of their own in
    both locales, bound to their raise sites by the table in `toUserMessage.test.ts`.
- [x] Every level slice 1's port declares has a real caller by the end of this slice —
    `warn` in particular, which slice 1 leaves without one — and each is used for the
    category stated above rather than being chosen by feel at the call site. `debug`:
    `plugin.load.started`/`plugin.loaded`. `info`: `persistence.index.rebuilt`. `warn`: the
    index builder's and the change pipeline's recovered-from problems, plus slice 10's
    reassignment recalculation. `error`: the boundary, and the sequence and cascade sites.
- [x] The logger (slice 1's, injected via the composition root) still writes only to a
    local sink after this slice: no code path sends a log entry off the device
    automatically, and nothing under `domain/` imports the port — the second half is a
    `no-restricted-imports` gate rather than a convention, and `noInlineConfig` means no
    comment in a file can turn it off.
- [x] `GetDiagnosticsSnapshot` returns plugin version, Obsidian version, schema
    versions, migration state, and validation issues, and **carries no project content
    because `DiagnosticsLedger.record` has nowhere to put any**: a closed
    `DiagnosticEntityKind` union, a branded `EntityId`, and the whole `AppError` — off which
    the ledger reads `error.code` and drops the rest. There is no free-text parameter at all.
    The check is a COMPILE-TIME one and it is what makes this a gate rather than a reading:
    `tests/application/ports/diagnostics.test-d.ts` (named in `tsconfig.json`'s `include`,
    which is the whole mechanism) refuses a zone's NAME, a note PATH, a free-text third
    argument, a kind outside the union and the old three-string call shape, each under its
    own `@ts-expect-error` — and an unsatisfied directive is itself a build error, so a
    `record` widened back to strings fails `npm run build` at the directive that no longer
    has anything to suppress. One line beside them asserts what must still COMPILE: an
    `AppError` whose `message` and `cause` do hold content, offered deliberately, because the
    ledger is the one module allowed to decide what diagnostics keep.
    `schemaVersions` derives from `MIGRATION_SET` through `MigrationRunner.latestVersions`,
    so a kind reaches diagnostics because it was registered rather than because a second
    table was remembered.

    **"Demonstrably contains zero project content" was the wider claim, and it is
    WITHDRAWN.** The snapshot is a shape that CAN carry content, so no fixture can
    demonstrate its absence — a content-free ledger asserted to produce a content-free
    snapshot proves only that the query adds nothing. The check has to sit where a caller
    could break it, which is the parameter list. Two doors the types still leave open, both
    disclosed in `application/ports/diagnostics.ts`: an `AppError` whose CODE is content
    (codes come from a fixed vocabulary composed by error factories, so that is a review
    boundary rather than a compiled one), and a branded id that was never format-validated.
- [x] No dependency on a network client, analytics SDK, or remote endpoint exists
    in `infrastructure/logging/` or the diagnostics query — and it is a lint rule over those
    two subtrees now (the node network modules, `obsidian`'s `request`/`requestUrl`, and the
    network globals) rather than a fact about today's imports.
    `tests/build/network-boundary.test.ts` drives it through real virtual paths: each ban
    with a snippet that MUST report, the shapes these directories actually use that must NOT,
    the spellings the rule cannot see pinned as absences, and each subtree's resolved ban
    compared against its parent layer's for superset — because two flat-config blocks
    matching one file override rather than merge.
- [x] A note with unknown extra frontmatter keys and a hand-authored body
    survives a targeted property-update round trip unchanged in both the
    unknown keys and the body — for every note-backed write path, rather than for one of
    them. The rule is one shared helper (`tests/contracts/notePreservation.ts`); its callers
    are `preservation.test.ts`, one per kind plus `markStale`, and the list is ANCHORED
    against `Object.keys(MIGRATION_SET)` minus the sidecar, so a seventh note-backed kind
    turns it red until it has a case. Each caller also declares owned keys the write must
    have CHANGED, so a case cannot pass by doing nothing.
- [x] Deleting an entity with existing referents is either refused with a
    `ReferenceError` naming the referents, or gated behind an explicit
    confirmation step — never a silent cascade. Asserted on the COMMAND
    (`deleteResolutions.test.ts`, `assetCommands.test.ts`), which is the path a script or a
    migration takes; the dialog-gated branch is slice 15's and is covered beside it.
    `DeleteRequirementCommand` needs no gate, and its absence is correct rather than an
    oversight: nothing in the model references a Requirement.
- [x] An entity whose `schema-version` is unsupported causes the plugin to refuse
    to load that entity with a clear, typed error, not a silent
    best-effort parse, coercion, or drop — and this failure is scoped to that
    entity, not the whole plugin (per SDD §92 item 13). Both halves are driven for every
    note-backed kind from one table anchored to `MIGRATION_SET`: a future version refuses as
    a `MigrationError` (a malformed version field as a `ValidationError`, raised before any
    chain runs) while a healthy sibling of the same kind still loads, and the index scan
    never reads `schema-version` at all, so a poisoned note is indexed like any other.

    **The gate is READ-side only, and "refuses to load" is the whole of the guarantee.**
    Every save path resolves its note through `findNoteIdInFolder` + `versionOfFrontmatter`
    and never calls `migrateNote`, so nothing in a write stops a build that predates a note
    from overwriting its owned keys. Two things protect such a note today and NEITHER is this
    gate: every command loads before it saves and the load refuses, which is a property of
    the callers; and `schema-version` is an owned key, so an expectation minted before the
    note changed refuses as an external modification. A writer holding a CURRENT expectation
    meets nothing at all — pinned as true today by the "is a READ gate" case rather than
    claimed as safe. No command bypasses the load, so this is a narrowing rather than a live
    defect; closing it means running the check on the save side too, at four call sites
    rather than one.
- [x] All of the above is exercised by unit/application-level tests runnable
    independent of slice 12's fixture Vaults (slice 12 additionally proves it
    end to end against real Vault-shaped fixtures). Every suite named above runs under vitest
    against the in-memory `createRepositoryStack`, which builds its `MigrationRunner` from
    the SAME `MIGRATION_SET` the composition root registers — one table with two importers,
    after a fake built from its own four-kind copy spent several slices migrating a suite
    against a different schema world than production.

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
