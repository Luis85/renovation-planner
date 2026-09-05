---
type: PBI
parent: "[[Editor foundation]]"
order: 100
status: Done
started: 2026-09-05
finished: 2026-09-05
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Undo and redo

## Actor

[[Private renovator]] experimenting with a floor plan and needing a safe way back.

## Preconditions

- The current editor leaf has one command-history authority.
- A completed reversible editor command has reported whether it wrote.
- The current vault revisions still permit the inverse operation.

## Main flow

1. A successful reversible editor action is added once to the leaf's shared history.
2. The context bar updates Undo and Redo availability.
3. The renovator activates Undo.
4. The history executes the command's inverse through the same application and persistence
   boundaries, then refreshes the projection.
5. The action becomes available to Redo.
6. The renovator activates Redo and the command replays exactly once against current versions.

## Extensions

- **1a** — A command succeeds without writing. It does not clear a save error or create a false
  history entry.
- **3a** — No undo entry exists. Undo is unavailable and no command runs.
- **4a** — The inverse refuses because vault state changed. The refusal is surfaced once and the
  history remains coherent; external work is not overwritten.
- **4b** — The write succeeds but refresh fails. The last valid projection remains marked stale
  and retry repeats only the read.
- **6a** — A new action occurs after Undo. The abandoned redo branch is retired predictably.
- **6b** — Redo refuses or faults. It does not execute a second time automatically.

## Guarantee

Undo and redo operate through one per-leaf history over completed reversible commands. They never
infer a write from success alone, overwrite a newer external revision or replay a write merely to
repair a failed read.

## Out of scope

- Persisting command history across plugin reloads.
- Undoing arbitrary manual edits made outside the plugin.
- Draft-local `Undo point` behavior before a creation task commits.
- Domain-specific inverse semantics not yet implemented by later Features.

## Acceptance criteria

1. Every reversible editor command uses one shared history for the leaf.
2. Undo and Redo availability reflect the actual stack and are keyboard reachable.
3. One Undo executes one inverse; one Redo replays one command.
4. A new action after Undo clears the redo branch.
5. Revision conflicts never overwrite external changes.
6. Successful no-write outcomes do not create misleading history or save-state transitions.
7. A failed post-write refresh retries hydration only and never repeats Undo or Redo.

## Assumptions

- History remains ephemeral while the resulting domain state persists.
- Composite actions supplied by later Features define one inverse and appear as one user action.
- Current reversible command and save-state mechanisms are evolved rather than replaced.

## Sources

- [M00 — Kitchen Selected Overview](../user-experience/renovation-planner-editor-specs/screens/M00-kitchen-selected-overview.md)
- [M03 — Add Room](../user-experience/renovation-planner-editor-specs/screens/M03-add-room.md)
- [M11 — Multi-Selection](../user-experience/renovation-planner-editor-specs/screens/M11-multi-selection.md)
- [M15 — Stale-Data Warning](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md)
- [Vertical-slice plan: WP7](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md)

## Amendments

**2026-09-05** — closed by the trust path increment
(`docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md`). **Almost none of the
mechanism is new here.** One per-leaf `CommandHistory`, the reversible adapters, the write ledger
and `DispatchOutcome` all pre-date this increment; what it added is that the criteria this PBI
names and nothing pinned now have a case each, in
`tests/presentation/editor/history.e2e.test.ts`, driven against the wired editor. Which test
holds each criterion:

1. **One shared history per leaf.** `runtime.ts` builds exactly one `CommandHistory` and every
   dispatch — the tools' `commandDispatcher`, the Inspector's `commit`, the delete action, room
   creation — funnels through the one wrapped dispatcher built around it
   (`tests/presentation/editor/runtime.test.ts` and
   `tests/presentation/editor/saveState/saveStateWiring.test.ts`, whose last two cases assert the chain
   is built from the tracked dispatcher and that `wrapDispatcher` receives the GATED one — a
   source-text pin over exactly the wiring this increment changed). `history.e2e.test.ts`'s second
   case reaches it behaviourally, with two DIFFERENT gestures so it cannot pass by the second
   command being the same object.
2. **Availability reflects the stack and is keyboard reachable.** The reactive `canUndo`/`canRedo`
   flags are refreshed by the same wrapper every dispatch passes through. **Keyboard reach is the
   context bar's two buttons and NO hotkey** — that is the whole of what this criterion means here,
   stated rather than implied, because "keyboard reachable" reads as a shortcut and there is none:
   design spec §14 puts hotkeys for Undo and Redo out of scope, and both buttons are ordinary
   focusable controls in the tab order.
3. **One Undo executes one inverse; one Redo replays one command.** `history.e2e.test.ts`'s first
   case counts at the REPOSITORY (`vi.spyOn(zonesRepo, 'delete')` exactly 1), because a doubled
   inverse still leaves one zone and reads identically from the store;
   `stalePath.e2e.test.ts`'s second case asserts a Redo restores the SAME entity id back, which a
   count cannot see.
4. **A new action after Undo clears the redo branch.** `history.e2e.test.ts`'s second case.
5. **Revision conflicts never overwrite external changes.** `history.e2e.test.ts`'s fourth case: a
   conflicting Undo refuses, the vault is unchanged, and `canUndo` stays true with a second press
   refusing identically — the recorded `undo.superseded` behaviour, pinned AS the recorded
   behaviour rather than fixed here.
6. **A no-write success creates no misleading history or save-state transition. — NARROWED.**
   `history.e2e.test.ts`'s third case, 'a no-write success writes nothing, keeps a standing save
   error, and still takes a history entry', holds the SAVE-STATE half — the badge does not move,
   made discriminating by a REAL standing `save-error` behind it. The HISTORY half was measured
   false as the plan stated it: `CommandHistory.runNow` puts a no-write gesture on the stack by
   design and says so in as many words, so the case pins that documented behaviour instead of the
   plan's. See below, and [[Record editor writes in one shared history]], where its own criterion
   2 is withdrawn for the same reason.
7. **A failed post-write refresh retries hydration only.** `history.e2e.test.ts`'s fifth case (4b):
   the inverse WROTE (one save, geometry restored) and the read-back did not; Try again then reads
   exactly once more and runs no save and no delete. The gate lets `undo` and `redo` through by
   construction, and `withStaleGate.test.ts` drives both arms both ways.

**Four brief and spec §8 claims were measured FALSE while writing those cases. None is a
production defect; each is the code deliberately doing otherwise, and the cases pin what is true.**
Recorded here because the next reader meets the cases before the reasoning, and would otherwise
read them as drift:

- **"Removing the stale gate reddens the 'commits nothing' and 'Delete is paused' assertions."**
  It reddens NEITHER. Both are held by a different mechanism — `SelectTool.pointerDown` returns
  early on `context.writesBlocked()`, and the paused attributes come from each component reading
  the same computed. The gate and the control guards are **defence in depth over one outcome**, and
  removing either alone leaves that outcome green. That is why the file's third case exists,
  driven at `runtime.createRoom()` where no control guard stands in front of the gate; it is the
  only case in either e2e file the gate-removed mutation reddens.
- **"A no-write success creates no history entry."** `CommandHistory.runNow` says the opposite in
  as many words — *"A gesture that wrote nothing still goes on the undo stack: it happened, and
  asking to undo it is legal."* The case pins the documented behaviour with the one instrument that
  can see it: the Undo that follows pops the NO-WRITE assign and leaves the requirement standing,
  where a build that skipped the entry pops the FIRST assign and takes the requirement with it
  (measured as a mutation). The half of the claim that IS this PBI's criterion 6 — that it moves no
  badge — is kept, and made discriminating with a REAL standing `save-error` behind it, because
  without one a neutral resolution and a successful one both leave a fresh leaf reading `Saved`.
- **"A revision conflict on Undo raises a toast."** It does not, and the reason is design slice 17's
  own rule. `zone.external-modification` is one of `WRITE_BOUNDARY_CODES`, which `affectsSaveState`
  carves back out of the pre-write categories, so it flips the BADGE — and `reportDispatchFailure`
  therefore routes it at the `autosave-write` origin, which `surfaceFor` maps to the `save-state`
  surface rather than to a toast — and whose save-state SINK is itself a no-op, because
  `withSaveStateTracking` one layer below has already flipped the badge. One failure, one widget.
  (`AUTOSAVE_SINKS` spreads `noticeOnlySinks`, whose `toast` IS `notifyError`; nothing reaches it,
  because the policy never routes this origin to a toast at all.)
  The case asserts the badge flips AND that `Notice.shown` is unchanged
  **over a live queue**, since over an inactive one that absence would be true of every build ever
  written.
- **"A restored view state naming a deleted zone."** Cannot be written as stated: a restored
  `setViewState` carries a plan id and nothing else, and a selection dies with the leaf's Pinia. The
  case is written from the half that IS observable at a reopen — the room is gone from the vault,
  the second leaf re-reads, opens in Select and draws what is there, with nothing selected — and its
  docblock says plainly what it does not reach, pointing at `selectionRetirement`'s own suite for
  the within-a-leaf half.

Extensions: **1a** is criterion 6's case. **4a** is criterion 5's. **4b** is criterion 7's. **6a**
is criterion 4's. **3a** and **6b** are pre-existing `CommandHistory` behaviour this increment
neither changed nor newly pinned.

Residues, recorded rather than ticked:

- **`undo.superseded` still pins the stack.** A refused undo stays on the stack, `canUndo` reads
  true, and every further press refuses for the leaf's life. Pinned as the recorded behaviour by
  criterion 5's case; the remedy is a decision about `CommandHistory` every surface inherits, and
  CLAUDE.md already carries it as open.
- **`withEditorStateRefresh` has no production caller.** Task 5 split the named
  `createProjectionRefresh` out of it and `runtime.ts` composes `withStateRefresh` directly, so the
  old wrapper is kept alive by its own test file and by the docblocks that name it. Retire it or
  repoint it at `createProjectionRefresh` in a later task.
- **Undo while stale can itself go stale**, by design: its refresh runs through the same
  keep-on-failure read, so a second failure leaves `stale` true and `retriesFailed` at 2. Pinned by
  criterion 7's case, and it is why `stalePath.e2e.test.ts` drives its Try again pair BEFORE the
  Undo — otherwise the `.again` swap would have been true of a build whose button did nothing.
