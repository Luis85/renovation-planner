---
adr: 34
title: A write incident is durable and vault-scoped
status: Accepted
date: 2026-09-16
area: application
---

# ADR-0034: A write incident is durable and vault-scoped

## Context

`markUncompensated` (`src/application/commands/DispatchOutcome.ts`) already stamps a refused
`Result` with `{ uncompensatedWrite: true }` at the moment a compensating undo itself fails —
the vault is left half-written and nothing put it back. Its own docblock re-derives the count on
every edit rather than keeping a list, and the 2026-09-16 re-measurement
(`grep -rn "markUncompensated(" src/`, excluding the docblock's own self-matching quoted line)
printed 24 lines for 23 producers in 17 files, exactly what the docblock claims. The stamp is
read today by `affects-save-state.ts:254` and `with-save-state-tracking.ts:57`, which turn it
into a per-leaf, per-Pinia-store `unrecoveredWrite` flag: real inside the tab that raised it,
gone the moment that tab closes or the plugin reloads. `docs/using-planning-recovery.md` already
tells the user otherwise — "Nothing clears it: a successful read does not repair those files, a
later successful write is not evidence that the affected ones were the ones mended, and saving
plugin settings no longer loses it either" — a promise the session-scoped flag cannot keep past a
reload, and BP-02 exists to close that gap.

The obvious place to store something durable is the mechanism this codebase already trusts for
exactly this class of fact: `SequenceMarkerFileStore`
(`src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore.ts`), one JSON file rewritten
whole per mutation, behind the narrow `TextFileAdapter` port, behind one `KeyedQueues` lane, wired
once at `RenovationPlannerPlugin.ts:851-860`. ADR-0019 already refused to let that reuse happen
silently: "the sequence-marker mechanism for irreversible delete/rebuild operations is not
silently repurposed." This is the non-silent path — a decision record with its own reasoning,
not a second write to that file.

This ADR decides what a write incident IS, who raises and observes it, where it lives, what
retires it, which command families it reaches, and how coarse its gate is. It does not implement
any of it and does not touch the schema-version direction-blindness `SequenceMarkerFileStore`
already has (SDD §87 rule 7, "fail closed on unsupported schema versions") — that is a separate
increment's subject, recorded but not fixed here.

## Decision

**A write incident is a refused write that left the vault half-written and whose compensating
undo also failed** — precisely the condition `markUncompensated` already raises today. This ADR
makes that condition durable and vault-scoped instead of per-mount; it does not change when the
condition is raised, only what happens to the record of it afterward.

**Identity is a best-effort set of `{ kind, id }` pairs, and the set is knowingly incomplete.**
This copies the codebase's own existing answer to "how do you disambiguate an id" —
`SequenceMarker` pairs `entityId: string` with `entityKind: 'zone' | 'asset'` under the comment
"an ID alone cannot say" — rather than inventing a branded array. Of the 23 raise sites, 17 are
single-entity writes where completeness is moot and six cross two ids; of those six, three are
refuted against the "affected ids are in scope at the raise site" premise:
`ObsidianZoneRepository.ts:370` (`compensateFailedSidecarWrite`) takes `(zoneId, wasUpdate,
notePath, snapshotText, cause)` and never receives the plan id its caller `saveQueued` holds as
`zone.planId` — its sibling `delete()` at `:449` closes over `cachedPlan: PlanId` inline in the
same class and stamps it correctly, so the gap is an accident of one helper's parameter list, not
a structural limit; `deleteResolution.ts:499` (`compensate`) logs per-requirement ids inside its
loop but the stamp statement outside it names only `ops.entityId`; and `undoDeleteResolution.ts:131`
(`rollBack`) cannot reach them at all, because its `done` list is an array of zero-argument
closures with no id exposed. **Because the set is provably incomplete, it is evidence for the
user to read, and never a predicate a gate evaluates.**

**The application layer raises and observes it, through the single chokepoint already there.**
`guardCommand` (`src/application/errors/guardAgainstThrowing.ts`) is the one place a command's
`Result` is inspected after every dispatch — 69 call sites in 14 files, all under `src/plugin/`,
already pass through it, and `PersistenceError` is already part of every guarded door's declared
error union, so recognising an incident there widens no signature.

**It is stored in its own plugin-local JSON file beside `sequence-markers.json`, not inside it.**
Same narrow `TextFileAdapter` port, same single `KeyedQueues` lane, same versioned whole-envelope
rewrite, same construction site in `RenovationPlannerPlugin`, wired the way `SequenceMarkerFileStore`
already is — proven shape, new file. Two measured reasons it is not a second map in the existing
envelope are in Alternatives below. An unreadable envelope is not this file's own subject (the
schema-version handling that governs it is `SequenceMarkerFileStore`'s recorded, unfixed
direction-blindness, Context above) but the ruling it must not contradict is: a file this build
cannot read is never presented as zero open incidents. SDD §87 rule 8 — "never present a missing
or refused read as zero, empty or nothing yet" — makes that the wrong default in either direction,
and the gate this decision adds treats an unreadable incidents file as blocking, the same fail-closed
answer rule 7 already gives an unsupported schema version.

**Nothing the plugin does retires it.** Not a settings save, not a plugin reload, not a later
successful write anywhere. **R1 — the flag is set, and this decision adds no path that unsets
it.** That mirrors `PlanEditorView.ts:336`'s own "set, never unset" for the session-scoped flag
this replaces, extended to survive a restart. Retirement is the user removing the incidents file
after checking their vault against a backup — an action outside the plugin's UI that no stray
click performs. The existing content-free diagnostics query, `GetDiagnosticsSnapshotQuery`
(reached from a settings ACTION row and a palette command), is required by this decision to name
each open incident and the incidents file's path, so the removal gesture is discoverable without
becoming a control the plugin offers. `docs/using-planning-recovery.md` already states the user
half of this: "There is no 'I have repaired this' control, because nothing here can tell a write
that mended the affected files from any other write that happened to land."

**Coverage is exactly the 69 `guardCommand` doors, and this ADR names what is outside it.** Three
paths bypass the chokepoint entirely and are not reached by an incident raised here:
`context.commands.zones`, the raw `ZoneRepository` port handed to presentation
(`composition-root.ts:212` into `presentation/editor/planEditorCommands.ts:126`), against which
`inspector-wiring.ts:99` and `:101` construct `EditZoneDetailsCommand` and
`ReversibleRenameZoneCommand` unguarded; the geometry sidecar spread into `planEditorQueries`
(`composition-root.ts:562-568`, a brand-new `ObsidianPlanGeometrySidecar` beside the guarded
queries object, called at `read-models/planEditorQueries.ts:256`); and `relocateEvidence`'s
host-rename listener (`src/plugin/evidenceRename.ts`), which has its own ad-hoc try/catch boundary
around a THROW rather than a guarded `Result`. Those editor paths stay covered by the Plan
editor's own `writesBlocked` gate — a different, existing mechanism this ADR does not fold in.

**The gate is coarse, and that is a decision, not an omission.** While any incident file holds a
record, every guarded COMMAND is refused; guarded QUERIES are not, so the vault stays inspectable
— which is what `docs/using-planning-recovery.md` already tells the user to do. Two measured
reasons an intersection gate (refuse only writes touching the recorded ids) was rejected: ten
sampled command inputs use five different id field names (`CreateAssetInput` and
`CreateProjectInput` carry none at all; `SetAssetFootprintInput`/`SetAssetFootprintFromDimensionsInput`/
`SetAssetAnchorInput` carry `assetId`; `DeleteAssetInput` carries `assetId` plus an optional
`reassignTo` and optional `resolvedReferents: RequirementId[]`; `CreatePlanInput` carries only its
parent `projectId`; `UpdatePlanDetailsInput`/`DeletePlanInput` carry `planId`; `AssignAssetInput`
carries `zoneId` and `assetId`; `DeleteRequirementInput` carries `requirementId`) — an affected
set cannot be derived structurally at the wrapper, since `Command<I, R>`'s `I` carries no
constraint and `withBoundary` passes `input` through unread, so intersection gating would need a
declaration added at all 69 sites, relocating the forgetting this ADR exists to close rather than
closing it; and the recorded id set is knowingly incomplete per the identity ruling above, so an
intersection gate would let a write land on an entity that IS inconsistent while presenting as
precise. A coarse, vault-wide gate is the sound answer here, not merely the cheap one.

**`project.write-uncompensated` (`ObsidianProjectRepository`) is narrowed by this decision and
stops raising an incident**, while keeping its existing log line and ledger record. Its residue is
an empty folder: no note was written, so the vault's data stays coherent and "half-written" is
true only of the folder tree — `DispatchOutcome.ts`'s own docblock already names this as the case
to decide once a gate exists, and under the coarse-gate ruling above a stamp is now a vault-wide
write block, so blocking every write over a stray empty folder is the worse answer. Narrowing by
completeness of the id set instead — gate only stamps that name an entity — was considered and
refused: three generic compensators (`ConstructionMaterialCommand.ts:78`, `composedSteps.ts:27`,
`runSpatialCommand.ts:14`) may also carry no id while the data they touched IS inconsistent, so
"has an id" does not track "is safe to leave ungated."

## What this decision refuses

Nine recorded declinations elsewhere in this repository all name the same shape, and none of them
is walked into here:

- **No automatic replay.** A restart never re-runs the interrupted command.
- **No rollback journal.** This record stores no entity snapshots — unlike `SequenceMarker`,
  which carries a full `entitySnapshot` for exactly the operations it recovers. Nothing here can
  undo a partial write; it can only say one happened.
- **No plugin-decided all-clear.** Covered above under Retirement and R1.
- **No pre-write pending marker for the families that lack one.** A marker written before the
  first mutation exists today only for delete-resolution (`deleteResolution.ts:517-532`, which
  refuses the whole operation rather than proceed if that marker cannot itself be written).
  Widening that to every multi-file write site is its own increment. This decision records an
  incident AFTER the failure, so a process killed mid-write, for any family other than
  delete-resolution, still leaves no record — unchanged from today. That is a boundary this ADR
  states, not a guarantee it completes.
- **No content.** The record carries opaque ids, kinds, an error code and a timestamp — nothing
  more. No note bodies, no paths beyond what a kind/id pair already is, no plan content — the
  same constraint `GetDiagnosticsSnapshotQuery`'s own docblock states for the diagnostics
  snapshot it is part of (SDD §68, §86).

## Alternatives

**A second map inside `sequence-markers.json`, beside the existing `markers` record.** Cheapest
to wire, since the store, the queue and the construction site all already exist. Rejected for two
measured reasons: `recoverInterruptedSequences.recoverOne` switches on the record's
`entityDeleted` field, not on a `kind` discriminant, so anything reachable through that store's
`list()` would be treated as a delete-resolution sequence and its `progress` entries RESTORED
from `affectedBefore` on the next cold read — replayed, which is the one behaviour this decision
refuses outright; and retirement (this decision's own Retirement ruling) must be possible by
deleting the incidents record without touching a live delete-resolution marker in the same file,
which a shared envelope makes needlessly fragile to get right.

**A plugin-decided all-clear** — clearing on a successful write to the affected entity, or on
reload, or offering a "mark resolved" control. Rejected because nothing in this system can tell a
write that mended the affected files from any other write that happened to land on them; `R1`
above is the whole of the alternative this ADR takes instead, and `docs/using-planning-recovery.md`
already publishes the user-facing half of that refusal.

**Intersection-gate writes against the recorded affected-id set**, refusing only a write that
names one of the incident's ids rather than every guarded write. Rejected under the coarse-gate
ruling above: no common id field exists across sampled command inputs to gate on, gating would
require a declaration at all 69 `guardCommand` sites, and the recorded set is known-incomplete,
so a gate built on it would look precise while missing the exact writes item 2's three refuted
sites failed to name.

**Refuse to raise an incident for a stamp with no id at all**, treating an empty affected set as
"nothing to protect." Rejected because three generic compensators carry no id by design while the
data they touched is genuinely inconsistent; an empty id set is a fact about what the raise site
could name, not about whether the vault is safe.

## Consequences

- A restart no longer manufactures an all-clear after an unresolved multi-file operation. That is
  this package's user-facing outcome and the reason for the change.
- An open incident pauses every guarded write in the vault until the user removes the incidents
  file, including on projects unrelated to the fault that raised it.
- This deepens an existing recorded limitation rather than introducing a new one:
  `unrecoveredWrite` used to clear on a plugin reload because it lived in a per-mount Pinia store;
  after this it does not, because the record outlives the process.
- Four locations' compensation paths — `ObsidianZoneRepository.delete`, `ObsidianPlanRepository`
  (its `delete` and `insertNew`, two raise sites in one class), `trashNoteBackedEntity`, and
  `undoDeleteResolution.rollBack` — that `DispatchOutcome.ts`'s own docblock records as having
  raised nothing at all until the 2026-09-16 sweep now reach a reader that survives the tab that
  raised them, rather than a per-mount flag nobody read past that session. A fifth site the same
  sweep found, `ObsidianProjectRepository`'s insert (`project.write-uncompensated`), is the one
  this decision narrows away under the id-set ruling above and does not gain a durable reader.

## Revisit when

- An integrity signal exists that can distinguish a repaired vault from an unrepaired one. A
  plugin-decided all-clear is refused today specifically because nothing here can tell those
  apart; that is the condition under which the refusal above would need to be re-argued, not
  reversed by default.
- The coarse, vault-wide gate proves too blunt in real use — users routinely blocked from
  unrelated, genuinely unaffected work for long enough that the cost outweighs the safety it buys.
- Every raise site can name a complete affected set at the moment it raises. That is what an
  intersection gate would need instead of the census this decision found refuted at three of six
  multi-entity sites.

## References

- ADR-0019 — the declination this decision answers non-silently: "the sequence-marker mechanism
  for irreversible delete/rebuild operations is not silently repurposed."
- `docs/using-planning-recovery.md` — the user-facing statement of retirement and of "no 'I have
  repaired this' control" this decision keeps consistent with.
- SDD §68, §86 (diagnostics, content-free) and §87 rules 7 and 8 (fail closed on unsupported
  schema versions; never present a missing or refused read as nothing).
