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

**Correction, 2026-09-17 (BP-02 slice 3): that separate increment landed.** Each ENTRY
`SequenceMarkerFileStore` cannot read is now preserved verbatim across every rewrite — the entry,
not the ENVELOPE around it, whose own top-level `schemaVersion` every write stamps with this
build's — and reported
through the `unreadable` half of `SequenceMarkerListing`
(`src/application/ports/SequenceMarkerStore.ts`), which recovery neither replays nor clears — the
same fail-closed answer this ADR reasons about for incidents, shaped as a separate half rather
than a sentinel because anything shaped like a `SequenceMarker` would be replayed and retired.

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
refuted against the "affected ids are in scope at the raise site" premise (**dated 2026-09-16:
the count below is this ADR's own, taken at the moment it was written. It moved later in the
same slice, BP-02 slice 2 task 4 Part B, when `relocateEvidence.ts` gained a stamp naming only
`plan` entities — it never crosses to a second entity KIND, so the six-sites ruling below is
unaffected either way. `DispatchOutcome.ts`'s own docblock re-runs the grep and carries the
current figure; this ADR is a record of a decision at a point in time and does not chase it**):
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
`Result` is inspected after every dispatch — **44 call sites in 13 files** (superseded below,
2026-09-17: 46 in 14), all under
`src/plugin/`, measured by `grep -rnE "guardCommand[<(]" src/plugin/`, already pass through it, and
`PersistenceError` is already part of every guarded door's declared error union, so recognising an
incident there widens no signature. The sibling door, `guardQuery`, adds 16 call sites in 3 files
(`grep -rnE "guardQuery[<(]" src/plugin/`); the union of both is 60 call sites in 14 files, but a
write incident can only be raised at a write, so `guardCommand` alone is the number that governs
raising it. Two things that grep cannot see: it matches the literal text `guardCommand(` or
`guardCommand<`, so a call reached through an alias, a re-export, or a reference held in a
variable is invisible to it; and a call SITE is not a guarded DOOR — `guardBothDoors`
(`src/plugin/guardedServices.ts:365`) has 11 call sites of its own, each wrapping two doors
(`execute` and `executeWithVersion`) through two `guardCommand` calls inside its body, both
already counted in the 44. "44 call sites" and "44 doors" are therefore different claims, and
this ADR uses only the former. (Both figures superseded below, 2026-09-17: 46 in 14.)

**Correction, 2026-09-17 (BP-02 slice 4, task L-05): the count is now 46 call sites in 14 files,
and that supersedes every "44" in this document.** The same quoted instrument, re-run:
`grep -rnE "guardCommand[<(]" src/plugin/ | wc -l` prints **46**, and `-rlE … | wc -l` prints
**14**. The two new sites are both inside `src/plugin/guardedZoneEdit.ts`'s `guardZoneEdit`,
which brought the Inspector's `'details'` and `'name'` zone edits inside the chokepoint — see
the Coverage correction of the same date below. The recorded 44 is left standing wherever it
appears because it was true when written; this paragraph is the number a reader should use, and
the grep above is the thing to re-run rather than to trust either figure.

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
after checking their vault against a backup, and then loading the plugin again — an action
outside the plugin's UI that no stray click performs. **The reload is part of the gesture, not a
convenience** (D-06): the registry reads the file once at `seed()` and nothing re-reads it, so
the deletion alone resumes nothing. The user copy in both locales and
`docs/using-planning-recovery.md` say so; earlier drafts of both stopped at the deletion and sent
a blocked user round a loop with no stated way out. The existing content-free diagnostics query, `GetDiagnosticsSnapshotQuery`
(reached from a settings ACTION row and a palette command), is required by this decision to name
each open incident and the incidents file's path, so the removal gesture is discoverable without
becoming a control the plugin offers. `docs/using-planning-recovery.md` already states the user
half of this: "There is no 'I have repaired this' control, because nothing here can tell a write
that mended the affected files from any other write that happened to land."

**Coverage is exactly the 44 `guardCommand` call sites above, and this ADR names what is outside it.** Three
paths bypass the chokepoint entirely and are not reached by an incident raised here:
`context.commands.zones`, the raw `ZoneRepository` port handed to presentation
(`composition-root.ts:212` into `presentation/editor/planEditorCommands.ts:126`), against which
`inspector-wiring.ts:99` and `:101` construct `EditZoneDetailsCommand` and
`ReversibleRenameZoneCommand` unguarded; the geometry sidecar spread into `planEditorQueries`
(`composition-root.ts:562-568`, a brand-new `ObsidianPlanGeometrySidecar` beside the guarded
queries object, called at `read-models/planEditorQueries.ts:256`); and `relocateEvidence`'s
host-rename listener (`src/plugin/evidenceRename.ts`), which has its own ad-hoc try/catch boundary
around a THROW rather than a guarded `Result`.

**Correction, 2026-09-16 (BP-02 slice 2 task 4 review-fix pass): the claim that those three paths
"stay covered by the Plan editor's own `writesBlocked` gate" was false as written, and this
paragraph replaces it rather than restating it more carefully — the earlier text is not a
weaker true thing, it is a wrong one.** Verified against the code: `writesBlocked`
(`src/presentation/editor/runtime.ts:607`) is `computed(() => projectStore.stale ||
unsafeHistory())`, and `unsafeHistory` reads `save.unrecoveredWrite` — a per-leaf Pinia flag
(`src/presentation/editor/save-state/save-state-store.ts`) set only by that leaf's own guarded
dispatches, never by the vault-scoped `WriteIncidentRegistry` this ADR adds. So that gate closes
on THIS leaf's own staleness or its own incident, not on an incident raised anywhere else in the
vault. Concretely: `inspector-wiring.ts:99` and `:101` construct `EditZoneDetailsCommand` and
`ReversibleRenameZoneCommand` unguarded, and a vault-scoped incident raised by a DIFFERENT
command, a different leaf, or `relocateEvidence`'s own listener does not close `writesBlocked`
for either — both stay reachable while that incident is open. The third path,
`relocateEvidence`'s host-rename listener, is not "covered" by anything at all:
`src/plugin/evidenceRename.ts`'s own docblock already states it is "not gated, unlike a guarded
command" and runs regardless of any open incident. **This is a stated coverage gap, not a
behaviour this ADR changes.** A later increment owns closing it, if it is closed at all; this
record exists so a reader comparing coverage against the code finds the true boundary rather than
an aspirational one.

**Correction, 2026-09-17 (BP-02 slice 4, task L-05): the first of those three paths is CLOSED,
and both paragraphs above are stale in the other direction.** `EditZoneDetailsCommand` and
`ReversibleRenameZoneCommand` are no longer constructed against the raw `ZoneRepository` port in
`inspector-wiring.ts` — its `'details'` and `'name'` arms now call `editZoneDetails` and
`renameZone` factories composed through `guardZoneEdit` (`src/plugin/guardedZoneEdit.ts`) in
`src/plugin/planEditorDeps.ts`, so BOTH doors of both adapters — `execute` and `undo` — pass
through `guardCommand` and are refused while any incident is open. The file-and-line citations in
the two paragraphs above (`inspector-wiring.ts:99` and `:101`) no longer name what they described;
they are left as the record of what was true on 2026-09-16. **The remaining coverage gap is two
paths, not three**: the geometry sidecar spread into `planEditorQueries`, and `relocateEvidence`'s
host-rename listener. Beside them sits the wider one this ADR's Consequences correction already
states — `reversible-delete-zone-command.ts`'s undo half, dispatched by `CommandHistory` against
the raw `commands.zones` port, which is a CATEGORY rather than a path and has no check under it
(tracker limitation L-06).

**Correction, 2026-09-17 (BP-02 slice 4, task SCOPE): the 2026-09-16 paragraph's claim that the
per-leaf gate is closed "never by the vault-scoped `WriteIncidentRegistry` this ADR adds" is now
false, and this paragraph says what replaced it.** The 2026-09-16 text above is left exactly as
written — it is a record of what was true that day, and this file keeps earlier text visible.

**What is now true.** The gate SEES this registry, at two moments.
`src/presentation/editor/save-state/save-state-store.ts` initialises its vault-pause ref from
`activeWriteIncidentRegistry()?.anyOpen() ?? false` while the store is being created, and
`src/presentation/editor/save-state/with-save-state-tracking.ts` calls that store's
`markVaultPaused()` whenever a refusal carries `WRITES_PAUSED_CODE` — the constant `guardCommand`
itself builds its refusal from, matched on the exported code and never on a message. Every
`ItemView` mounts its own Vue app and its own Pinia (ADR-0004), so each leaf builds its own store
and asks the vault's record for itself: a SECOND Plan Editor pane opened while an incident is open
is paused from its first frame, without any leaf knowing another exists.

**What is still NOT true, and each of these is a live limitation rather than a nuance.**

1. **The gate is not reactive.** `WriteIncidentRegistry.record()` publishes no event and holds a
   plain array, so an incident raised while a pane is already mounted does not re-render that
   pane's controls. It catches up at its next write, which is refused at the guarded door and
   marks the vault fact from there. No data is at risk; the affordance is late.
2. **A leaf Obsidian RESTORES seeds clean.** `RenovationPlannerPlugin` calls
   `void this.stores.writeIncidents.seed()` from `startPersistence`, which runs at
   `onLayoutReady`, and that same function's own comment records that Obsidian restores its leaves
   BEFORE `onLayoutReady`. A registry whose file read has not resolved holds an empty list and
   answers `anyOpen() === false`. So a restored pane is not paused from its first frame either; it
   is the same non-reactive limitation reached from startup. Startup was deliberately not
   reordered for it — the registry must read a file before it can answer, and nothing on this
   branch has ever run in Obsidian.
3. **The Asset Designer is not gated at all.** `src/presentation/designer/runtime.ts` now hands
   its `EditorContext` a truthful `writesBlocked` where it hard-coded `false`, and NOTHING reads
   it: `grep -rn "writesBlocked()" src/presentation/editor/` prints 23 call sites in six modules
   (scoped to `editor/` because the unscoped grep also counts the comments that quote the call),
   and the designer registers none of those tools. Its buttons,
   inspector fields, toolbar and preset form all stay live and their dispatches are refused
   underneath. An affordance gap, not a data-safety one, and its own increment.
4. **The two ungated paths named above are unchanged.** The geometry sidecar spread into
   `planEditorQueries`, `relocateEvidence`'s host-rename listener, and the reversible-adapter
   `undo` category of tracker limitation L-06 are all still outside the chokepoint, so an incident
   raised in one of them still becomes no durable record and reaches no other leaf.

The gate's scope also remains COMMANDS only, which the section below states and which the same
change had to repair in one place: `DraftRecovery.vue` reads the store's narrow
`leafUnrecoveredWrite` rather than the wider gate, because its fourth read site removes a **Try
again** button that performs a re-READ.

**The gate is coarse, and that is a decision, not an omission.** While any incident file holds a
record, every guarded COMMAND is refused; guarded QUERIES are not, so the vault stays inspectable
— which is what `docs/using-planning-recovery.md` already tells the user to do. Two measured
reasons an intersection gate (refuse only writes touching the recorded ids) was rejected: eleven
sampled command inputs use five different id field names (`CreateAssetInput` and
`CreateProjectInput` carry none at all; `SetAssetFootprintInput`/`SetAssetFootprintFromDimensionsInput`/
`SetAssetAnchorInput` carry `assetId`; `DeleteAssetInput` carries `assetId` plus an optional
`reassignTo` and optional `resolvedReferents: RequirementId[]`; `CreatePlanInput` carries only its
parent `projectId`; `UpdatePlanDetailsInput`/`DeletePlanInput` carry `planId`; `AssignAssetInput`
carries `zoneId` and `assetId`; `DeleteRequirementInput` carries `requirementId`) — an affected
set cannot be derived structurally at the wrapper, since `Command<I, R>`'s `I` carries no
constraint and `withBoundary` passes `input` through unread, so intersection gating would need a
declaration added at all 44 `guardCommand` sites, relocating the forgetting this ADR exists to
close rather than closing it; and the recorded id set is knowingly incomplete per the identity ruling above, so an
intersection gate would let a write land on an entity that IS inconsistent while presenting as
precise. A coarse, vault-wide gate is the sound answer here, not merely the cheap one.

**`project.write-uncompensated` (`ObsidianProjectRepository`) is narrowed by this decision and
stops raising an incident**, while keeping its existing log line — there is no separate ledger
record at this path; verified against the code, which carries only a `logger.error` call
(`project.insert-compensation-failed`, one per stranded folder) and no `deps.ledger.record`, so
this ADR names only what actually survives. Its residue is
an empty folder: no note was written, so the vault's data stays coherent and "half-written" is
true only of the folder tree — `DispatchOutcome.ts`'s own docblock already names this as the case
to decide once a gate exists, and under the coarse-gate ruling above a stamp is now a vault-wide
write block, so blocking every write over a stray empty folder is the worse answer. Narrowing by
completeness of the id set instead — gate only stamps that name an entity — was considered and
refused: three generic compensators (`ConstructionMaterialCommand.ts:78`, `composedSteps.ts:27`,
`runSpatialCommand.ts:14`) may also carry no id while the data they touched IS inconsistent, so
"has an id" does not track "is safe to leave ungated."

## What this decision refuses

The BP-02 discovery lane recorded in `docs/releases/first-beta-readiness/03-execution-tracker.md`
found this repository has declined durable crash-recovery metadata nine times, every one naming a
generic automatic replay-rollback journal — the same shape this decision also refuses, and none of
them is walked into here:

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
require a declaration at all 44 `guardCommand` sites, and the recorded set is known-incomplete,
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
- **"Vault-scoped" is true of the FILE and not of the GATE, and this record's own title
  overstates it.** The record lives in one file per vault; the gate that reads it is a
  per-process in-memory mirror, seeded once per plugin load
  (`WriteIncidentRegistry.seed`). Two Obsidian windows open on one vault are two plugin
  instances with two registries, so an incident recorded in one does not close the other's gate
  until that other one loads again. Related and from the same cause:
  `WriteIncidentFileStore.add` is a read-modify-write serialised by a `KeyedQueues` lane that is
  per process, so two processes can each read the same envelope and each write it back, losing
  whichever record landed first. Both are stated rather than fixed here; a cross-process lock
  and a re-reading gate are each their own increment, and the losing side still holds its
  incident in memory for its own session.
- **Durability rests on the plugin folder being writable, and where it is not the incident is
  session-scoped only.** A failed envelope write logs `incident.write-failed` and nothing more
  — correctly, since un-raising the incident would be the all-clear this decision refuses — but
  the NEXT load then finds no file, reads it as zero open incidents, and opens the gate.
  Separately, once the file exists and is unreadable, `add` refuses at its own read step, so no
  incident raised after that point is ever persisted either. Both are holes in the durability
  half of this decision, not in the fail-closed half: within the session that raised it, the
  gate is shut in every one of these cases.
- This deepens an existing recorded limitation rather than introducing a new one:
  `unrecoveredWrite` used to clear on a plugin reload because it lived in a per-mount Pinia store;
  after this it does not, because the record outlives the process.
- **What now reaches a durable reader is a CATEGORY, not a list: a stamp raised inside a
  `guardCommand` call stack becomes a durable incident, and a stamp raised outside one never
  does.** `guardCommand` is the single observation point (above), so where a stamp is raised
  decides whether anything records it — nothing about the repository method, the entity, or the
  operation's name. Compensation paths reached through a guarded dispatch —
  `ObsidianZoneRepository.delete`, `ObsidianPlanRepository` (its `delete` and `insertNew`),
  `trashNoteBackedEntity`, `undoDeleteResolution.rollBack` — are EXAMPLES of the covered half,
  and this list is not a claim of completeness. A fifth site the 2026-09-16 sweep found,
  `ObsidianProjectRepository`'s insert (`project.write-uncompensated`), is the one this decision
  narrows away under the id-set ruling above and does not gain a durable reader.
- **Correction, 2026-09-16 (final review-fix pass): an earlier version of the bullet above named
  `ObsidianZoneRepository.delete` flatly, and that was half true.** Its guarded FORWARD door is
  covered; the UNDO door of the reversible adapter over it is not.
  `ReversibleDeleteZoneCommand.undo()` stamps `markUncompensated` inside its `restoreEntity`
  callback (`src/application/commands/zone/reversible-delete-zone-command.ts:201`, verified
  2026-09-16), and that adapter is constructed by `deleteZoneHistory`
  (`src/presentation/editor/add/createZoneHistory.ts`) from `inspector-wiring.ts` and dispatched
  by `CommandHistory` against the raw `commands.zones` port — never through `guardCommand`. The
  stamp is produced, mapped into the leaf's own session flag, and never becomes a durable
  incident. `undo()` and `redo()` on every reversible adapter are outside the chokepoint the
  same way, for the same reason; the three bypass paths named above under Coverage are further
  examples of the same category.
- **Correction, 2026-09-17 (BP-02 slice 4, task L-06): "`guardCommand` is the single observation
  point" is FALSE, and has been since `relocateEvidence` gained a stamp.** There are TWO
  recorders, both spelled identically and measured with one command —
  `grep -rn "record(result.error as AppError & UncompensatedWrite)" src/` prints exactly two
  lines: `src/application/errors/guardAgainstThrowing.ts`'s
  `void incidents?.record(…)`, inside `guardCommand`, and `src/plugin/evidenceRename.ts`'s
  `void activeWriteIncidentRegistry()?.record(…)`, a hand-rolled recorder in the host-rename
  listener that ADR text above correctly lists as OUTSIDE the chokepoint. Read that grep
  narrowly: it matches one literal argument spelling, so a recorder written any other way is
  invisible to it, and it is a text scan rather than a reachability proof. What the correction
  changes for the category: the durable-reader category is **"a stamp that reaches one of the two
  recorders"**, not "a stamp raised inside a `guardCommand` call stack". The `relocateEvidence`
  path is therefore durable despite bypassing `guardCommand`, and every sentence in this document
  that reasons from a SINGLE observation point is stale by exactly that one path.
- **Correction, 2026-09-17 (BP-02 slice 4, task L-06): the uncovered examples were short by two,
  and one site is on the wrong list.** Measured — `grep -rn "markUncompensated(" src/` prints 25
  lines in 18 files, of which two are `DispatchOutcome.ts`'s own quoted self-matches, so 23
  producers in 17 files, unchanged. Two of those producers reach neither recorder and are named
  nowhere above: `restoreSteps` in `src/application/commands/spatial/composedSteps.ts`, whose only
  importers are `DeleteSelectionCommand` and `PasteCommand`, both constructed in presentation and
  dispatched by `CommandHistory`; and `rollBack` in `src/application/reference/undoDeleteResolution.ts`,
  whose only importer in `src/` is `reversible-delete-zone-command.ts` (measured,
  `grep -rn "undoDeleteResolution" src/` — the other hits are prose), so its only reachable
  dispatch is the bypassed one the correction above describes. **That second one makes the first
  Consequences bullet's covered-examples list wrong where it names `undoDeleteResolution.rollBack`:
  it belongs on the uncovered side.** This list is still not a claim of completeness — it is three
  named sites out of a category nothing enumerates, and the check below sees none of them.
- **Nothing currently checks that category, and building a check is deferred.** CLAUDE.md's rule
  is that a category invariant is checked at the forbidden thing rather than by listing the
  places — here, a check would have to refuse (or account for) a `markUncompensated` call whose
  dispatch cannot reach `guardCommand`, which is a reachability question over the composition
  graph rather than a text scan. Until such a check exists, this record is the only instrument,
  and it is prose: a raise site added outside a guarded stack will not turn anything red.
- **Correction, 2026-09-17 (BP-02 slice 4, task L-06): the deferred-check bullet above is narrowed,
  not withdrawn — a check now exists for a NECESSARY CONDITION of violating the category, and the
  category itself is still unchecked.** A static check of the real relation was attempted and
  refuted by measurement: the guarded relation is made by wrapping an object at runtime and
  consumed by calling a port method, and neither is an import edge, so an import-graph walk from
  `guardedServices.ts` reaches 1 of the 17 stamping modules while one from `composition-root.ts`
  reaches 929 files including all of presentation. What was built instead is
  `tests/plugin/guardCategory.test.ts`'s class-instance skip census: every raw class instance the
  composition root hands out — which is what a raw write PORT is, and every uncovered site above
  reaches the vault through one — is now recorded by name and pinned by exact value. **What that
  buys is that the hole cannot get WIDER: a NEW raw port in the handoff turns the gate red. It
  does not close the hole.** The three uncovered sites named in the correction above stay live and
  stay silent — and "three" is the count of what has been NAMED, not a completeness claim — and a second
  `markUncompensated` added behind one of them turns nothing red. **The option that WOULD close the
  category by construction is to record inside `markUncompensated` itself** — 23 direct callers, no
  alias and no re-export, so it is already the chokepoint — and BP-02 slice 4 refused it
  deliberately for one reason worth taking on purpose later rather than rediscovering: it makes a
  pure stamping function effectful against module state, and it would record a stamp an
  intermediate caller deliberately SWALLOWS (`ConstructionMaterialCommand` reads
  `leftWritesBehind(error)` and retires the stamp rather than re-raising it), which under the
  coarse gate above turns a swallowed stamp into a vault-wide write block that does not happen
  today. Widening what raises the harshest mechanism this plugin has, on a branch nothing has ever
  run in a real Obsidian vault, is the trade a release owner should take explicitly.

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
- `docs/releases/first-beta-readiness/03-execution-tracker.md` — the BP-02 discovery lane that
  counted the nine recorded declinations of durable crash-recovery metadata this decision checks
  itself against under "What this decision refuses."
- SDD §68, §86 (diagnostics, content-free) and §87 rules 7 and 8 (fail closed on unsupported
  schema versions; never present a missing or refused read as nothing).
