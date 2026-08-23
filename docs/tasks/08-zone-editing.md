---
type: Task
parent: "[[Architecture and Software Design]]"
order: 100
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
# Design Slice 8: Zone Editing

## Purpose

Slice 6 built the editor tool framework (`EditorTool`, `UndoableCommand`,
`CommandHistory`, transaction boundaries, Transformer normalization, `SnapService`)
without wiring it to any concrete interaction. Slice 7 used that framework to build
calibration. This slice is the second and more demanding concrete consumer: it turns
the framework into the interaction set the SDD calls Increment 6 — a user can draw a
polygon zone, select it, move it, reshape it vertex by vertex, and delete it, with
every one of those actions safely undoable.

This slice is also the first place polygon geometry (as opposed to the two-point line
calibration uses) has to survive real pointer input without becoming corrupt. It is
where SDD §26's validation rules stop being a paragraph of intent and become the
actual boundary a `Zone`'s geometry cannot cross without being rejected.

## Scope

### In scope

- `DrawPolygonTool`: a concrete `EditorTool` that accumulates vertices from pointer
  input and closes them into one `ReversibleCreateZoneCommand`.
- `ReversibleCreateZoneCommand`: the adapter that makes creation undoable (PRD §68) —
  `execute()` wraps slice 3's plain `CreateZoneCommand`, `undo()` deletes what it made,
  and redo restores the same entity rather than minting a second one.
- `withEditorStateRefresh`: the decorator that puts a committed mutation on the canvas
  **and in the Inspector**, wrapping the three `CommandHistory` operations rather than
  each site that mutates.
- `SelectTool`, first built here against `Zone`: hit-testing, selection state, and the
  vertex/body handles rendered in the `InteractionLayer` for a selected zone.
- Whole-zone move (drag the body) as one `ReversibleMoveZoneCommand` (slice 6's
  `UndoableCommand` adapter wrapping slice 3's plain `MoveSpatialObjectCommand`) per
  drag gesture.
- Single-vertex reshape (drag a vertex handle) as one `ReversibleMoveZoneVertexCommand`
  per vertex-drag gesture — a second adapter over the same slice-3
  `MoveSpatialObjectCommand`, not a new domain command.
- Zone deletion as one new `UndoableCommand`, `ReversibleDeleteZoneCommand` —
  wrapping slice 3's plain `DeleteZoneCommand` the same way slice 6's
  `ReversibleMoveZoneCommand` wraps `MoveSpatialObjectCommand` — whose `undo()`
  resurrects the exact deleted entity (same ID, same geometry) as a compensated
  sequence, so an undo that fails part-way changes nothing.
- Geometry validation at the point geometry is about to become a command input:
  minimum vertex count, finite/non-NaN coordinates, world-unit coordinates, and a
  well-formed viewport transform — per SDD §26's required (non-"Future") rules.
- Explicit deferral of self-intersection detection, winding normalization, polygon
  repair (§26 "Future"), boolean polygon operations via `clipper2-ts` (§27), and an
  `rbush` spatial index for hit-testing (§28) — all correctness in this slice is
  achieved without any of them.

### Out of scope (covered by other slices)

- The calibration tool and the world/screen transform it produces — slice 7.
- `EditorTool`, `UndoableCommand`, `CommandHistory`, the transaction-boundary rule,
  Konva Transformer normalization, `SnapService` — slice 6 (consumed here, not
  redefined).
- The `Zone` entity itself, its schema, and the plain (non-undoable)
  `CreateZoneCommand` / `MoveSpatialObjectCommand` / `DeleteZoneCommand`
  implementations — slice 3. This slice wraps `DeleteZoneCommand` in an
  `UndoableCommand` the same way it wraps `MoveSpatialObjectCommand`; it does not
  reimplement zone deletion from scratch.
- Repository mechanics, the plan geometry sidecar format, and the
  Markdown-plus-sidecar consistency rule — slice 4. This slice only triggers those
  paths via commands.
- Deletion reference-integrity checking (PRD §64: "Referenced by: N Work Packages...").
  No domain module references `Zone` yet at this point in the build (Requirement and
  Work Package arrive in slices 9–10) — deferred to whichever of those slices
  introduces the first entity that can reference a Zone. That is slice 10, which widens
  `DeleteZoneInput` with an optional `resolution` and defines what each of PRD §64's
  four actions does. Nothing in this slice changes when it lands: an absent `resolution`
  means "refuse if referents exist", and in this slice there are none.
- Configurable/custom zone types (PRD §84) and post-creation metadata editing (rename,
  Markdown links, custom fields) — these flow through the generic Inspector
  edit-to-command pipeline slice 6 already provides; no new architecture is needed
  here to support them.
- Spatial queries over zones (Epic 4) — these read derived data slice 9's quantity
  engine and/or a later query layer produce; not an editing concern.

## Dependencies

- **Slice 2 (Core Primitives)** — `Polygon`, `Point`, geometry operations
  (point-in-polygon, area, perimeter), `Result<T,E>`, `GeometryError`.
- **Slice 3 (Domain Foundation)** — `Zone` entity, `CreateZoneCommand`,
  `MoveSpatialObjectCommand`, `DeleteZoneCommand` as plain `Command<TInput,TResult>`
  implementations; this slice wraps the latter two in slice 6's `UndoableCommand`
  adapters rather than modifying them.
- **Slice 4 (Persistence & Repository Layer)** — `ZoneRepository`, the plan geometry
  sidecar, and the Markdown+sidecar transaction rule (SDD §42).
- **Slice 5 (Canvas Rendering & Editor Shell)** — `ZoneLayer`, `InteractionLayer`,
  `worldToScreen()` / `screenToWorld()`.
- **Slice 6 (Editor Tool Framework)** — `EditorTool`, `EditorContext`,
  `UndoableCommand`, `CommandHistory`, `SnapService`, Transformer normalization, the
  `ReversibleMoveZoneCommand` adapter this slice's whole-zone-move gesture constructs
  one instance of per drag, and `InspectorStore.refresh()` — declared there because the
  store is, and called only from this slice's post-command decorator.
- **Slice 7 (Calibration)** — sibling, not a hard dependency. A `Plan` need not be
  calibrated before a zone can be drawn on it (the two slices can be built in either
  order per the slice map); `screenToWorld()` always produces *some* well-formed world
  point, calibrated or not. What this slice requires is only that the transform is
  well-formed, not that it is calibrated.

## Design

### Drawing a zone — `DrawPolygonTool`

A concrete `EditorTool` with an internal vertex buffer and three states: idle,
drawing, closing.

```text
activate()      → buffer = []
pointerDown()   → world = event.worldPoint; snapped = snapService.snapPoint(world)
                  if snapped is within closing tolerance of buffer[0] and buffer.length >= 3:
                      closePolygon()
                  else:
                      buffer.push(snapped); render vertex + edge preview
pointerMove()   → render a rubber-band preview edge from buffer.last to pointer
                  (InteractionLayer only, per §19 — no domain state touched)
cancel()        → buffer = []; clear preview; no command dispatched
```

`closePolygon()` is the only place this tool talks to the domain:

```text
polygonResult = createPolygon(buffer)          # slice 2's smart constructor (SDD §26)
if polygonResult is Err:
    show inline validation message; stay in drawing state; buffer is NOT cleared
else:
    command = ReversibleCreateZoneCommand over
              { planId, name, zoneType, geometry: polygonResult.value }
    result  = context.commandDispatcher.run(command)   # slice 6's CommandHistory
    on success: buffer = []; selection := command.createdZoneId
    on failure: show error; buffer is NOT cleared
```

Keeping the buffer intact on failure means a rejected close never discards the user's
in-progress work — they can keep placing vertices or press cancel deliberately.

Vertex removal mid-draw (e.g. "undo last point" before the shape is closed) is a
reasonable UX affordance but is not required by the SDD and is left to implementation
discretion; it does not appear in the Definition of Done below.

### Un-creating a zone — `ReversibleCreateZoneCommand`

Creation is undoable like every other gesture in this slice, and for two independent
reasons: PRD §68 names `CreateZoneCommand` first among the changes that go through
command history, and slice 6's `commandDispatcher.run()` accepts an `UndoableCommand` —
nothing else. Dispatching slice 3's plain command from the tool would leave a mistaken
polygon reachable only by deleting it, and would not type-check against the one entry
point every path in this slice ends at.

`execute()` is the same thin wrapper the move adapters are: it dispatches slice 3's
plain `CreateZoneCommand` and keeps the created `Zone` from the payload an
`UndoableCommand` otherwise discards. `undo()` is this slice's one adapter whose inverse
is a *different* plain command rather than the same one replayed with swapped input:
creation's inverse is deletion, so it dispatches `DeleteZoneCommand({ zoneId })` — which
publishes `ZoneDeleted`, which is what actually happened.

**Redo must not mint a second identity.** `CommandHistory.redo()` calls `execute()`
again (slice 6), so an adapter that simply re-dispatched `CreateZoneCommand` would put a
*new* Zone, with a new ID, where the user expects the one they drew. That is not a
cosmetic difference — draw, move, undo, undo, redo, redo replays the move against the ID
captured at drag time, which the re-created Zone no longer has, so the redo resolves a
`ReferenceError` and the stacks record an edit that did not happen. The second and every
later `execute()` therefore restores the captured snapshot verbatim through
`zoneRepository.save()`, the ID-keyed upsert slice 3's port contract already guarantees
and the same call `ReversibleDeleteZoneCommand.undo()` makes for the same reason.

The two adapters are mirror images — create's `undo()` is delete's `execute()`, create's
redo is delete's `undo()` — which is why both take the plain command family *and* the
repository port, and why they sit together rather than one of them living with the
pure-replay adapters.

`createdZoneId` is readable on the adapter once `execute()` has succeeded. The tool needs
it to select the zone it just drew, and `UndoableCommand.execute()` resolves
`Result<void, AppError>` by design (slice 6: the adapter discards the payload). Reading
it off the instance keeps that contract intact — no widening of `UndoableCommand` for one
caller — and the adapter has to hold the snapshot for undo and redo regardless.

Once slice 10 lets a Requirement reference a Zone, `undo()` inherits
`DeleteZoneCommand`'s reference behaviour unchanged: with no `resolution` forwarded, a
Zone that has since acquired referents refuses to be un-created and the command stays on
`undoStack` (slice 6), rather than the adapter cascading on its own. An adapter that
interpreted references would be a second place reference integrity is decided — the same
reason `ReversibleDeleteZoneCommand` forwards its `resolution` without reading it.

### Selecting a zone — `SelectTool`

First concrete implementation of `SelectTool` (SDD §57), scoped to `Zone` because
`Zone` is the only spatial object type that exists in the domain at this point in the
build (`Asset` arrives in slice 10). Hit-testing is deliberately written against a
generic "spatial objects on the active plan" list so slice 10 can extend the candidate
set later without a parallel select mechanism.

```text
pointerDown() → world = event.worldPoint
                candidates = activePlan.spatialObjects   # linear scan, see below
                hit = first candidate (in reverse z-order) whose Polygon contains world
                if hit: selection.set(hit.id)
                else:   selection.clear()
```

Hit-testing is a linear scan using Core's point-in-polygon test (slice 2), evaluated
topmost-first so visual stacking order matches selection order on overlapping zones.
This is correct at any plan size; it is simply not the fastest approach on a plan with
many hundreds of zones. See "Deferred: spatial index" below.

A selected zone renders, in the `InteractionLayer` (transient only, per §19):

- a body-drag handle (the whole shape, for moving it), and
- one draggable handle per vertex (for reshaping it).

Clicking empty canvas clears the selection. The Inspector reacts to selection through
the pipeline slice 6 already defines (§59: Selection → Inspector Query → Inspector DTO
→ Vue UI) — not redefined here.

### Moving a zone

Dragging the body handle only updates a transient Konva preview while the pointer
moves; domain geometry is untouched mid-drag (§20: normalize before persistence).
`MoveSpatialObjectCommand` (slice 3) takes a full replacement `geometry: Polygon`, not
a delta — "move" collapses to the same whole-geometry-replacement operation slice 3
already defined, matching slice 3's own reasoning for using one command for both move
and resize. On `pointerDown`, this slice captures the zone's current `Polygon` as the
inverse snapshot; on `pointerUp`:

1. Compute the total world-space delta via `screenToWorld()`, and translate every
   vertex of the captured original polygon by it to produce the candidate final
   polygon.
2. Run the candidate polygon's points through `SnapService` (`snapToGrid` /
   `snapToVertex` / `snapToEdge`).
3. Re-validate the translated polygon (translation cannot change vertex count, but the
   result is still passed back through `createPolygon()` — see Validation below —
   because snap adjustment is arithmetic that must not be trusted blindly).
4. Build one `ReversibleMoveZoneCommand` (slice 6) — the same adapter pattern this
   slice's `ReversibleDeleteZoneCommand` follows — with `forward: { zoneId, geometry:
   candidatePolygon }` and `inverse: { zoneId, geometry: originalPolygon }`, and run it
   through `CommandHistory.run()`.

If `pointerUp` fires with a near-zero delta (a click, not a drag), this is a pure
selection, not a move: no command is dispatched and nothing is pushed onto
`CommandHistory`. This matters — a no-op move must not pollute the undo stack.

`MoveSpatialObjectCommand` itself stays exactly as slice 3 defined it — a plain
`Command<MoveSpatialObjectInput, Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError
| PersistenceError>>`, never modified to implement `UndoableCommand` directly. This
slice is where it is first driven by real pointer input, wrapped in
`ReversibleMoveZoneCommand` for `CommandHistory` compliance — one drag, one command,
one history entry, per the transaction-boundary rule (§31).

### Editing a single vertex

Only available while a zone is selected and its vertex handles are showing. Dragging
one vertex handle:

1. Updates only the affected edge pair as a transient preview while the pointer moves.
2. On `pointerUp`, converts the handle's final position through `screenToWorld()` and
   `SnapService`, and builds the candidate point list (the polygon's existing points
   with just that one index replaced).
3. Re-validates through `createPolygon()` on the candidate list. On failure (e.g. the
   transform produced a non-finite point), the handle snaps back to its last valid
   position and no command is dispatched.
4. On success, dispatches a `ReversibleMoveZoneVertexCommand` built from the pre-drag
   and post-drag point lists — the same adapter shape `ReversibleMoveZoneCommand` uses
   over slice 3's `MoveSpatialObjectCommand`. `undo()` restores the prior point list, so
   only that vertex differs; every other vertex is untouched by construction.

Inserting a new vertex mid-edge or removing a vertex (changing the vertex count) is
out of scope — this slice only repositions existing vertices. Nothing here blocks
adding that later as an extension of the same command family.

### Deleting a zone

`ReversibleDeleteZoneCommand` is the first delete-type `UndoableCommand` in the
codebase. Its `execute()` is a thin wrapper around slice 3's plain `DeleteZoneCommand`
(SDD §29 names the general operation `DeleteSpatialObjectCommand`; slice 3 already
named its concrete, Zone-only command `DeleteZoneCommand` — the same "general SDD
name in principle, concrete entity name in this codebase" choice slice 3 made for
`MoveSpatialObjectCommand`, so this slice follows suit rather than introducing a
second, competing delete command under the SDD's general name). Its `undo()` is the
one place in this slice where "undo" means more than replaying an inverse delta
through that same wrapped command — deletion has no natural "delete the opposite
thing" inverse, so `undo()` bypasses the command layer entirely and restores the
snapshot directly through the repository:

```text
execute(): snapshot := read the full Zone entity + its sidecar geometry entry via
                       zoneRepository, BEFORE dispatching the delete below — once
                       deleteZoneCommand.execute() succeeds, that data is gone and
                       cannot be recovered from the Zone/sidecar itself
           result := deleteZoneCommand.execute({ zoneId })   // slice 3's plain command
           if isErr(result): return result    // snapshot is discarded, unused
           clear selection if it pointed at this zone
           return result

undo():    a SNAPSHOT INVERSE, so it takes slice 6's snapshot-inverse contract whole,
                        which for a multi-file restore includes slice 10's
                        compensated-sequence contract — both lock levels, held through
                        the compensation, and a durable marker. Not "the same idea as"
                        the forward resolution: the same contract, because it is the
                        same sequence run backwards. Obligation 4 lands on the other
                        side here than in slice 7: this publishes NOTHING, because the
                        Zone was restored rather than created (see "Not a domain-event
                        subscriber" below for how the canvas still updates)
           level 1:  the Zone being restored, and every OTHER endpoint the restored
                        Requirements point at — one sorted batch
           level 2:  every Requirement in affectedBefore — one sorted batch, after
                        level 1. Endpoint locks alone do not exclude an ordinary
                        override edit, and an override edit on an already-restored
                        Requirement is what makes this undo's own compensation refuse
           REVALIDATE against current state, EXCLUDING the Zone this undo is restoring:
                        every other endpoint still exists, still shares the project, and
                        still has a unit of the kind each restored Requirement's
                        quantity was computed in. The Zone is deliberately absent — that
                        is what "undo a delete" means — and it is restored first, so it
                        exists by the time any Requirement referencing it is written.
                        Requiring it to exist beforehand would refuse every undo that
                        touched a Requirement, which is every undo this check was
                        written for. Refuse the whole undo if any check fails — see below
           write the marker (kind 'delete-undo') before the first write
           postDelete := read the CURRENT state of the Zone and of every entity in
                        affectedBefore, before overwriting any of them — absent is
                        a state, and here it is the usual one
           restore the Zone FIRST, then each entity in affectedBefore (see below),
           each verbatim — same ID, same zone type, same points, same schema
           version — via zoneRepository.save() directly, NOT via CreateZoneCommand
           (which would mint a fresh ID and publish ZoneCreated, misrepresenting a
           restore as a new zone)
           on any failure: replay postDelete over every entity already written,
           then return the error — see "A failed undo is a no-op" below
```

**Restoring an ID is not restoring a legal state.** The compare-and-swap on each write
guards the note being written and nothing else: it asks "is this Requirement as I left
it", never "does the thing this Requirement points at still exist". Those come apart
precisely because the delete succeeded. After `remove-references` deletes the
Requirements that referenced an Asset, that Asset is unreferenced — so deleting it, or
changing its unit from `m2` to `m`, becomes *legal*, and a user may well do exactly that
next, because the plugin just told them nothing depends on it. Undo then re-inserts
snapshots pointing at an Asset that is gone, or one whose unit no longer matches the
dimension the stored quantity was computed in, and every CAS succeeds while doing it.
Neither error is visible at the moment it is created: the Vault simply now contains a
Requirement that no invariant in this codebase would have allowed anyone to create.

So `undo()` re-runs the checks `AssignAssetCommand` runs at creation — existence, same
project, unit kind — against the endpoints as they are *now*, under the locks, before
writing anything. **Against every endpoint except the one it is restoring.** The Zone is
absent by construction — the delete being undone is what made it absent — so a check
requiring every endpoint to exist refuses unconditionally, and refuses hardest in exactly
the case it was added for: any delete that touched a Requirement. Its own validity comes
from the snapshot being written, and the restore order (Zone first, then Requirements) is
what makes that sound rather than assumed. The live check is for the *opposite* endpoints,
the Assets, which are the ones that can have moved. This is the same correction `ReversibleAssignAssetCommand`'s
redo already carries (slice 10): **an inverse restores identity, never validity.** That
this adapter needed it too, after the redo case had been fixed, is the shape worth
naming — a rule established on one path and not carried to the symmetric one.

Refusal is all-or-nothing and returns a `ReferenceError` or `ValidationError`; the
command stays on `undoStack` per slice 6, so the user is told the undo is no longer legal
rather than being handed a Vault the plugin's own rules forbid. Restoring the subset
whose endpoints survived is deliberately not offered: a Zone back with half its
Requirements is not the state before `execute()`, and this adapter's whole contract is
that `execute()`/`undo()` is a true inverse or nothing.

**The snapshot is the Zone plus everything the delete touched.** Once slice 10 forwards
a reference `resolution`, `execute()` no longer changes one entity: it can delete the
referencing Requirements, repoint them at another target, or flip their
`recalculationStatus`. A Zone restored on its own, with its Requirements still deleted or
still repointed, is not the state that existed before `execute()` — which would break the
rule this slice's own Testing Strategy states, that every `execute()`/`undo()` pair is a
true inverse.

Slice 10's resolution already captures that state as `affectedBefore`, because it needs
it to compensate a partial failure, and returns it in the command's payload. This adapter
captures it on success and restores it alongside the Zone. Nothing new is computed here:
the adapter is still a thin wrapper that snapshots and replays, the snapshot just covers
what the wrapped command actually mutates. In this slice, with no entity able to reference
a Zone yet, `affectedBefore` is always empty and the behaviour is exactly as described
above.

**A failed undo is a no-op, so the restore is compensated too.** Once `affectedBefore`
is non-empty, `undo()` is N+1 writes across N+1 files, and calling it "the restore" no
more makes it one operation than calling the resolution "one logical operation" made
*that* one — the point slice 10 argues for `execute()` and then has to hold to on the way
back. A failure after the Zone, or after an earlier Requirement, has been written leaves
a half-restored Vault while `undo()` resolves an error and `CommandHistory` keeps the
command on `undoStack` for the user to retry (slice 6). That retention is only honest if
a failed undo left the Vault exactly as the delete left it; otherwise the retry starts
from a state neither the command nor the stack describes, and the "true inverse" this
slice's Testing Strategy demands is asserted against a state that only ever existed when
nothing went wrong.

So the restore runs as its own compensated sequence, the mirror of slice 10's:

- **Order is the exact reverse of `execute()`'s.** The resolution writes the referents
  and deletes the entity last, so the restore writes the entity first and the referents
  last. No intermediate state then has a Requirement pointing at a Zone that is not
  there — the one shape of partial state that is wrong in the same way whether it is
  reached going forwards or backwards.
- **The compensation snapshot is read, not derived.** Before overwriting an entity, the
  adapter reads what is currently there; a Requirement that `remove-references` deleted
  reads as absent, and compensating it means deleting it again. Reading rather than
  reconstructing is what keeps the adapter's promise not to interpret `resolution`: it
  never has to know which of the three outcomes produced the state it is putting back.
- **A failing compensation is logged through the `Logger` (slice 1's port, slice 11's
  rule for what an unrecoverable step owes a log line), never swallowed** — the same
  admission slice 10 makes on the execute side. The repository does not promise
  multi-file atomicity (slice 4 promises it per file), and a compensated sequence is what
  this design offers instead of pretending otherwise.

Restoring a Requirement needs slice 10's `RequirementRepository`, which that slice adds to
this adapter's constructor along with the referents themselves — the port arrives with the
entities that need it, not ahead of them. In this slice `affectedBefore` is empty,
`zoneRepository` covers both halves, and the sequence collapses to a single write whose
compensation is never reached.

Undo must resurrect the same entity, not create a new one with a fresh ID. That makes
`save()` an idempotent upsert keyed by entity ID rather than insert-only — a command's
`undo()` cannot go through a path that mints new identity. This is not a requirement
this slice discovers late and imposes on slice 4: it is written into slice 3's
repository port contract and asserted in the shared contract suite both slice 3 and
slice 4 run, so an implementation that got it wrong fails before reaching here.

### Showing the result — refreshing the editor's working state

A committed mutation is not finished when the write lands. `ZoneLayer` renders from
`ProjectStore.zones` and `SelectTool` hit-tests the same map, and slice 5 hydrates it
from `GetPlan` and `FindZonesByPlan` when the Plan Editor opens — the only moment any
slice so far refreshes it. Left there, this slice's own Definition of Done would be
unreachable: a drawn zone would be persisted and invisible, missing from the canvas and
from the hit-test candidates until the view was closed and reopened, and a deleted zone
would stay on screen, still selectable, after its note and sidecar entry were gone.

**Two stores hold that working state, not one.** `InspectorStore.dto` (slice 6) is the
same kind of cached read as `ProjectStore.zones` — a query result taken when the
selection last changed — and a mutation invalidates it for the same reason: move or
reshape the selected Zone and the panel keeps showing the pre-command area; rename it
from the panel itself and the panel keeps showing the old name; and once slice 10 hangs
Requirements off a Zone, a geometry commit's recalculation cascade changes the very
quantity and cost figures the panel is displaying. Refreshing only the canvas would fix
the half of the screen that happens to be drawn by Konva and leave the half drawn by Vue
holding numbers the Vault no longer agrees with — a worse failure than the stale canvas,
because a wrong number reads as a current one where a missing shape at least reads as
missing.

The refresh goes at the funnel every editor mutation already passes through, not at each
site that mutates:

```text
withEditorStateRefresh(history, projectStore, inspectorStore, planQueries)
  .<op>(...)                                             op in run | undo | redo
  → queue this whole step behind any step already running (see below)
  → result = await history.<op>(...)
  → result.ok → re-run GetPlan + FindZonesByPlan for the active plan and re-hydrate
                ProjectStore, through slice 5's own hydration routine
              → then inspectorStore.refresh() — re-runs the inspector query for whatever
                is currently selected; a no-op when nothing is
  → return result unchanged to the caller
```

**The canvas is re-hydrated before the Inspector, and both inside the one queued step.**
The Inspector renders a panel *for* the selection, and a selection is only meaningful
against the entity map the canvas hit-tests, so re-reading the panel first would leave a
window where a new DTO is paired with a pre-command entity set. Neither store's refresh
is skipped on account of the other's: they are separate reads through separate queries,
and assuming one answers for both is how a panel ends up trusting a hydration that never
covered it.

**The operation and its refresh are one queued step, not two.** `CommandHistory`
serializes `run`/`undo`/`redo` (slice 6), but that queue ends when the operation
resolves — a refresh started after it runs outside it. Two editor sources can dispatch
concurrently (slice 13's overlapping-dispatch case), and then command A's re-query can
begin before command B's write, resolve after B's refresh, and overwrite `ProjectStore`
with zones that predate B — both writes succeeded, the indicator reads `Saved`, and the
canvas shows the older of the two. So this decorator holds its own queue around the pair
rather than relying on the inner one: same reasoning slice 6 gives for serializing at
`CommandHistory` instead of at the dispatcher — the guarantee belongs wherever the whole
unit is, and here the unit is "write, then read back what was written". The inner queue
stays where it is and is simply never contended by this caller.

A generation token on the store — apply a hydration only if no later one already
landed — would also prevent the overwrite, and is the cheaper option if the extra
serialization ever costs measurable latency. It is not the one taken here because it
still permits a stale snapshot to render briefly before the newer one replaces it, and
because a counter is a second thing to keep correct next to a queue this decorator needs
anyway.

**Not a domain-event subscriber**, which is the obvious alternative and the wrong one
here — and it is slice 6's obligation 4 that says which side of the line these fall on: a
lifecycle event is never re-emitted by a restore. The undo paths in this slice deliberately
publish nothing a `ZoneCreated`
subscriber would hear. `ReversibleDeleteZoneCommand.undo()` restores through the
repository precisely so a restore is not announced as a creation, and
`ReversibleCreateZoneCommand`'s redo restores the same way. A refresh keyed on events
would leave the canvas blank after exactly the Undo the user pressed to get their zone
back — the failure it was added to prevent, arrived at from the other side. Sitting on
`CommandHistory` instead covers every command, including ones this slice does not
define: slice 6's Inspector commits, slice 7's calibration rescale, and whatever slice
10's cascade wrote, since slice 10 runs that cascade to completion inside the dispatch.

Three properties this decorator holds to:

- **It returns the wrapped `Result` unchanged.** A refresh is a read of data that is
  already written; turning its failure into a failed write would misreport the one thing
  the user needs to be true, and — through slice 13's decorator — would light
  `Save Error` for a save that succeeded. A failed re-query surfaces through slice 17's
  rules for a failed hydrating read, and the store keeps what it had — which is also why
  neither re-read short-circuits the other: a failed plan hydration still leaves the
  Inspector to be refreshed, and an entity the user is looking at is the last thing that
  should silently keep pre-command numbers because an unrelated read failed.
- **It nests inside slice 13's `withSaveStateTracking`**, i.e.
  `withSaveStateTracking(withEditorStateRefresh(history, …), …)`, so the indicator does
  not read `Saved` while the canvas still shows the pre-command state. Because the
  refresh never alters the `Result`, the nesting order cannot change what the indicator
  reports, only when.
- **It re-queries the whole plan, and the whole selection**, which is proportional to
  plan size on every gesture — the same trade the hit-test scan makes, and correct at any
  size. The Inspector's share of the cost is bounded by the selection, not the plan.

  *Considered and declined: use what `save()` already returned instead of re-reading.*
  Slice 4's `save()` resolves the written `Loaded<T>`, so the entity this command wrote is
  in hand and re-reading it is provably redundant — an N+1-file read where one file's
  contents were already known. It still does not answer this refresh, for two reasons
  that are structural rather than incidental. The wrapped value is **discarded before it
  gets here**: `UndoableCommand.execute()` resolves `Result<void, AppError>` by contract
  (slice 6), and the adapter reads the payload for one `EntityVersion` and drops the
  rest — widening that contract to carry entities back out would put a domain entity in
  the return type of every reversible adapter, for the benefit of one caller. And it is
  the wrong *set* even where it is available: what this refresh has to cover is not the
  entity the command saved but everything the command's **cascade** wrote — slice 7's
  calibration rescales every Zone on the plan, slice 10's handler rewrites Requirements
  the command never named, and an undo restores through the repository without announcing
  anything. A refresh built from one save's return value would be correct for exactly the
  commands that change one entity and silently wrong for the ones that do not, which is
  the worse of the two failure modes: it would look right in every simple test.

  Refreshing only what changed therefore needs a durable record of what the whole
  dispatch touched, not a return value — and that is a real design, for whichever slice
  can measure the cost it would save.

This is also what makes `DrawPolygonTool`'s `selection := command.createdZoneId` land on
something: by the time `commandDispatcher.run()` resolves, the new zone is in the store,
rendered, and a valid hit-test candidate.

### Geometry validation (SDD §26)

Two layers, both required, neither optional:

- **Tool-level (fast feedback).** `DrawPolygonTool`, the move handler, and the
  vertex-edit handler all call `createPolygon()` before they ever construct a command
  input, so a user sees a rejection immediately and no invalid command is dispatched.
- **Domain-level (authoritative).** `Zone`'s own geometry-replacing operation
  re-validates through the same `createPolygon()` invariant regardless of caller. A
  command handler is not a trusted caller by convention (§3.3 Domain First) — the
  entity protects its own invariant even if a future caller skips the tool layer
  entirely (a script, a migration, a different tool).

What is checked, matching §26's required list exactly:

| Rule | Where enforced |
| --- | --- |
| ≥ 3 vertices | `createPolygon()` rejects 0, 1, 2 points |
| finite coordinates, no NaN, no Infinity | `createPolygon()` checks every point |
| valid unit | `DrawPolygonTool` and every zone-editing handler read only `event.worldPoint` (slice 6), never `event.screenPoint` — `Point` (world mm) and `ScreenPoint` (slice 5) are distinct, incompatible types, so passing a screen coordinate to `createPolygon()` is a compile error, not a runtime bug (slice 6's `EditorPointerEvent`) |
| valid transform | `worldToScreen`/`screenToWorld` (slice 5) do not themselves return a `Result` — a degenerate viewport (e.g. zero zoom) producing a non-finite point is instead caught by `createPolygon()`'s own finite-coordinate check, the same backstop that catches any other bad input. This slice relies on that backstop rather than adding a second one. |

What is explicitly **not** checked, per §26's own "Future" list, and why that is safe
for this slice's correctness requirement:

- **Self-intersection detection** — a user can draw a bowtie-shaped polygon; it is
  accepted, stored, rendered, and its area/perimeter are computed on it as-is (Core's
  formulas do not require a simple polygon to return *a* number, just not necessarily
  the number a human expects). Increment 6's success criterion is "create and safely
  modify," not "prevent every geometrically awkward shape."
- **Winding normalization** — a zone is stored in whatever winding order it was drawn.
- **Polygon repair** — no automatic correction is attempted.

None of these three block correct create/select/move/edit-vertex/delete behavior; they
are quality-of-result concerns the SDD itself defers.

### Deferred: boolean polygon operations (§27)

No `clipper2-ts` adapter is built in this slice. Nothing in draw, select, move,
vertex-edit, or delete requires union/intersection/difference/offset — all of it runs
on Core's existing point-in-polygon, area, and perimeter primitives (slice 2). When a
future feature needs boolean ops, they arrive through an Infrastructure/Core adapter
per §27 with no Clipper-specific type crossing into Domain or Application; this
slice's `Zone` entity and its commands are not expected to change shape to
accommodate that adapter's eventual arrival.

### Deferred: spatial index (§28)

No `rbush` index is built in this slice. `SelectTool`'s hit-testing is the linear scan
described above — correct at any plan size, just not the fastest at very large ones.
The SDD frames the index purely as an optimization ("correctness must not depend on
it"); this slice takes that literally and ships correct behavior without it. Nothing
in the hit-test design (a plain "candidates for this plan" list) forecloses dropping
an `rbush`-backed candidate prefilter in front of it later.

## Interfaces & Contracts

```typescript
// presentation/editor/tools/DrawPolygonTool.ts
class DrawPolygonTool implements EditorTool {
  readonly id: ToolId = 'draw-polygon';

  activate(context: EditorContext): void;
  deactivate(): void;
  pointerDown(event: EditorPointerEvent): void;
  pointerMove(event: EditorPointerEvent): void;
  pointerUp(event: EditorPointerEvent): void;
  cancel(): void;
}

// presentation/editor/tools/SelectTool.ts
class SelectTool implements EditorTool {
  readonly id: ToolId = 'select';
  // pointerDown hit-tests activePlan spatial objects; pointerMove/pointerUp
  // distinguish click-to-select from drag-to-move/drag-vertex.
}
```

```typescript
// Slice 3's commands are REFERENCED here, not redefined — slice 11's
// `// (slice N, referenced here)` convention, adopted for the reason this document
// itself demonstrates: a restated input silently loses a field the original carries, and
// slice 10's copy of DeleteZoneInput dropped `expected`, un-specifying an undo in THIS
// slice. Both restatements below were drift-free at the time of writing, which is not a
// property a copy keeps.
//
// CreateZoneInput / CreateZoneCommand (slice 3) — consumed unchanged. Geometry is
//   already validated by the time DrawPolygonTool builds an input, see
//   Design/Validation.
// MoveSpatialObjectInput / MoveSpatialObjectCommand (slice 3) — consumed unchanged. A
//   plain Command taking a full replacement geometry, not a delta, which this slice
//   wraps in slice 6's ReversibleMoveZoneCommand rather than making it implement
//   UndoableCommand directly. Its optional `expected` field carries the whole
//   EntityVersion: this slice's tools leave it absent on the forward gesture, and slice
//   6's adapters fill it in for every inverse, from WriteLedger.

// application/commands/zone/ReversibleCreateZoneCommand.ts (new) — beside the delete
// adapter it mirrors, and for the same reason: both need the repository port, because
// both have a half whose inverse is an identity-preserving restore rather than a plain
// command replayed with different input.
class ReversibleCreateZoneCommand implements UndoableCommand {
  constructor(
    private readonly createCommand: Command<CreateZoneInput, Result<{ zone: Loaded<Zone> }, ValidationError | ReferenceError | GeometryError | PersistenceError>>,
    // Creation's inverse is deletion, so undo() dispatches a different plain command
    // rather than replaying createCommand — the only adapter in this slice that does.
    // `resolution` is left undefined: a Zone that has acquired referents refuses to be
    // un-created rather than cascading on an adapter's own judgement.
    private readonly deleteCommand: Command<DeleteZoneInput, Result<DeleteWithReferencesResult, ReferenceError | ValidationError | PersistenceError>>,
    private readonly zoneRepository: ZoneRepository,  // redo's restore, keyed by ID
    private readonly input: CreateZoneInput,
  );
  // First call dispatches createCommand and captures the created Zone; every later
  // call (i.e. redo) re-saves that snapshot verbatim, so the ID survives undo/redo.
  // Both halves are conditional, per slice 6's rule that an inverse expects what its
  // own previous write left — and the two ends of this adapter make the two shapes an
  // expectation takes. Redo re-saves with `'absent'`: undo deleted the note, so a note
  // at that ID now is somebody else's, and restoring over it is not an undo. Undo
  // deletes with the version the create (or the last redo) returned, so a Zone the
  // user has edited since refuses to be un-created rather than losing that edit —
  // including a hand edit, which the token half of that version is what catches.
  execute(): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>;   // dispatches deleteCommand for createdZoneId
  readonly createdZoneId: ZoneId | null;     // set once execute() has succeeded; how
                                             // DrawPolygonTool selects what it drew
}

// presentation/editor/commands/ReversibleMoveZoneVertexCommand.ts (new) — a vertex
// drag is a whole-geometry replacement like a body drag, so it needs no new plain
// command: it is a second ReversibleMoveZoneCommand-shaped adapter over slice 3's
// MoveSpatialObjectCommand, differing only in how forward/inverse are computed (one
// index replaced, versus every vertex translated). An UndoableCommand that wrote to a
// repository itself bypasses the plain-command layer; the two adapters here that do
// (delete's undo, create's redo) buy identity preservation with it, and a vertex move
// has nothing to buy.
//
// The target is a ZoneId, not a SpatialObjectId: no `spatial-object` domain module
// exists (slice 3's Out of scope), so there is no such ID type to name. When one
// arrives, this widens with the rest of the Zone command family, not ahead of it.
class ReversibleMoveZoneVertexCommand implements UndoableCommand {
  constructor(
    private readonly moveCommand: Command<MoveSpatialObjectInput, Result<{ zone: Loaded<Zone> }, ReferenceError | GeometryError | PersistenceError>>,
    private readonly forward: MoveSpatialObjectInput,  // whole polygon, one vertex moved
    private readonly inverse: MoveSpatialObjectInput,  // whole polygon, captured at pointerDown
  );
  // Both operations go through the same conditional dispatch slice 6 specifies:
  // the first execute() carries no expectation, and every operation after it presents
  // the EntityVersion THIS EDITOR'S HISTORY last wrote for the entity, read from
  // WriteLedger — not this adapter's own last write, which goes stale the moment a
  // sibling command touches the same Zone. Sharing the mechanism rather than the words
  // is the point — an adapter that re-derived it is where the unconditional replay
  // comes back.
  execute(): Promise<Result<void, AppError>>;
  undo(): Promise<Result<void, AppError>>; // restores the prior point list, so only that vertex differs
}

// application/commands/zone/ReversibleDeleteZoneCommand.ts (new) — wraps slice 3's
// plain DeleteZoneCommand for the delete itself; undo() bypasses the command layer
// (see Design). zoneRepository is used on BOTH paths: execute() reads the
// pre-delete snapshot through it before dispatching deleteCommand, and undo()
// writes that snapshot back through it directly.
class ReversibleDeleteZoneCommand implements UndoableCommand {
  constructor(
    // The wrapped command's payload carries `affectedBefore` — the pre-resolution state
    // of every entity the delete touched (slice 10). Empty in this slice; undo() restores
    // it alongside the Zone, so the pair stays a true inverse once it is not.
    private readonly deleteCommand: Command<DeleteZoneInput, Result<DeleteWithReferencesResult, ReferenceError | ValidationError | PersistenceError>>,
    private readonly zoneRepository: ZoneRepository,
    // Forwarded verbatim into DeleteZoneInput. Undefined in this slice; slice 10's
    // delete dialog supplies it. This adapter never interprets it — the resolution is
    // the wrapped command's business, and an adapter that branched on it would be a
    // second place reference integrity is decided.
    private readonly input: DeleteZoneInput,
  );
  // Conditional on both halves, the same way: execute() (the first delete, and every
  // redo) presents the EntityVersion the last restore wrote, and undo() re-inserts with
  // `'absent'` — slice 10's `affectedAfter` carries the same pair of expectations for
  // each Requirement the resolution touched, for the same reason.
  execute(): Promise<Result<void, ReferenceError | PersistenceError>>; // reads snapshot, then delegates to deleteCommand
  // Re-inserts the snapshot verbatim, same ID — the Zone first, then every entity in
  // affectedBefore, as one compensated sequence: each entity's current state is read
  // before it is overwritten, and a failure part-way restores what was already written
  // to that state, so a failed undo leaves the Vault as the delete left it.
  undo(): Promise<Result<void, PersistenceError>>;
}
```

```typescript
// presentation/editor/commands/with-editor-state-refresh.ts (new) — decorates the
// same three CommandHistory operations slice 13's withSaveStateTracking decorates,
// and nests inside it. Transparent: the wrapped Result is returned unchanged, so a
// failed re-query never reports a successful write as a failure. canUndo/canRedo/
// clear pass through untouched — they change no persisted state to re-read.
// Each wrapped call queues the operation and its refresh together: CommandHistory's
// own queue releases at the operation, so an unqueued refresh can read pre-command
// state and land after a later command's refresh (see Design).
type RefreshedHistory = Pick<CommandHistory, 'run' | 'undo' | 'redo'>;

export function withEditorStateRefresh(
  history: RefreshedHistory,
  projectStore: Pick<ReturnType<typeof useProjectStore>, 'hydrate'>,   // slice 5's own
  // slice 6's own; `refresh` is the only member this decorator may touch — taking the
  // whole store would let a later edit dispatch `commit` from inside the refresh path
  // and re-enter the queue this decorator holds.
  inspectorStore: Pick<InspectorStore, 'refresh'>,
  planQueries: { getPlan: GetPlanQuery; findZonesByPlan: FindZonesByPlanQuery }, // slice 4
): RefreshedHistory;
```

```typescript
// core/geometry/Polygon.ts (slice 2, consumed here — this slice adds no geometry
// validation of its own; it is the first real caller of slice 2's smart constructor)
function createPolygon(points: readonly Point[]): Result<Polygon, GeometryError>;

// domain/zone/Zone.ts (slice 3, consumed here — the authoritative re-validation
// layer, which routes through the same createPolygon invariant)
class Zone {
  withGeometry(polygon: Polygon): Result<Zone, GeometryError>;
}
```

Tools never call `ZoneRepository` or any Obsidian API directly (§58) — every path above
ends at `context.commandDispatcher.run(...)`, the method name slice 6's `EditorContext`
declares, consistent with the layer dependency rule (Presentation → Application →
Domain).

Where the plain commands and the `ZoneRepository` port an adapter is constructed with
come from is slice 6's wiring question, not a new one this slice opens: its own
`ReversibleMoveZoneCommand` example already takes a `moveCommand` from somewhere
`EditorContext` does not name. This slice adds one dependency to whatever answer that
is — the repository port the two restore-halves need — and no second mechanism beside
it. Stated as an assumption rather than designed here, because designing it would mean
redefining `EditorContext`, which this slice's Out of scope refuses.

## Persistence Impact

- **Create**: writes a new Markdown note (zone metadata: id, zone type, schema
  version) and appends one entry (`id`, `type: "polygon"`, `points`) to the plan's
  geometry sidecar (§39–40). Both writes are one logical transaction per §42 — this
  slice triggers that path via `CreateZoneCommand`; it does not redefine it. Undoing a
  creation removes both again through `DeleteZoneCommand`, and redoing it re-saves the
  captured snapshot under the original ID rather than minting a second one.
- **Move / vertex edit**: rewrites only the sidecar's `points` array for that object's
  entry. The Markdown note is not touched — a drag or a vertex nudge must not churn
  the note's file mtime or frontmatter on every gesture.
- **Delete**: removes the Markdown note and the sidecar entry together. Undo relies on
  the repository's `save()` being an ID-keyed upsert — a property of slice 3's port
  contract, already covered by the shared contract suite — so the resurrected zone is
  the same entity, not a new one with the same visible content.
- No new persistent schema is introduced by this slice — it uses the `Zone` entity
  schema and the geometry sidecar schema exactly as slice 3/4 defined them.

## Testing Strategy

- **Unit (Core/domain, no Obsidian/Vue/Konva)**:
  - `createPolygon()` boundary table: 0/1/2/3 points, a point with `NaN`, a point
    with `Infinity`, a well-formed polygon.
  - Point-in-polygon hit test: inside, outside, on an edge, on a vertex.
  - `Zone.withGeometry()` rejects what `createPolygon()` rejects, independent of any
    tool-level check (proves the domain does not trust its caller).
  - Every command's `execute()` → `undo()` pair is a true inverse: state after
    `undo()` is identical to state before `execute()` — compared over every entity the
    command touched, not only the one it is named for, so a delete that cascades to
    referents is held to the same standard as one that does not.
- **Application tests (in-memory repositories, per §71)**:
  `CreateZoneCommand → InMemoryZoneRepository → assertions`; `ReversibleMoveZoneCommand`
  and `ReversibleMoveZoneVertexCommand` roundtrips; `ReversibleDeleteZoneCommand`
  roundtrip asserting the resurrected zone has the same ID, not a new one.
  - `ReversibleCreateZoneCommand`: `execute()` → `undo()` leaves no Zone and no sidecar
    entry; `execute()` → `undo()` → `execute()` (the redo path) yields a Zone with the
    **same ID as the first execute**, asserted directly — a test that only checked "a
    zone exists again" passes against the fresh-identity bug this design exists to
    prevent. Then the sequence that bug actually breaks: create, move, undo, undo,
    redo, redo succeeds, with the move landing on the same entity.
  - `ReversibleDeleteZoneCommand.undo()` against a repository stubbed to fail the
    restore: the error is returned, the Vault is left exactly as the delete left it,
    and — per slice 6 — the command is still on `undoStack`; retrying against a
    repository that stops failing then succeeds, which is the property that retention
    is for. With `affectedBefore` empty this exercises the compensated sequence's
    trivial case (nothing written, nothing to compensate). The case that can actually
    strand a half-restored Vault — a failure on the second of several writes — cannot
    be written here, because `Requirement` does not exist until slice 10; it is that
    slice's Definition of Done, alongside the execute-side compensation test it
    already carries.
- **Repository contract tests (§72)**: extend the shared suite (reused, not
  duplicated) with zone-geometry sidecar cases — add entry, update entry, remove
  entry — run against both `InMemory` and the Obsidian-backed repository.
- **Component tests (Vue, §73)**: `DrawPolygonTool` driven by simulated pointer
  sequences produces the expected vertex buffer and, on close, exactly one
  `commandDispatcher.run()` call and one `CommandHistory` entry; `SelectTool`
  hit-testing against a fixture of overlapping zones resolves ties by z-order;
  Inspector shows the selected zone's Core-derived length/area (not a Quantity/Cost
  figure — that is slice 9).
- **Store-refresh tests**: `withEditorStateRefresh` table-driven over `run`/`undo`/
  `redo` — a successful operation re-hydrates `ProjectStore` from the queries **and
  calls `inspectorStore.refresh()`**, a failed one does neither, and the wrapped
  `Result` comes back unchanged either way; a re-query that itself fails still returns
  the write's success and leaves the store's previous contents in place. Asserted per
  store, never on one of them standing in for both: a decorator that refreshed only the
  canvas satisfies every assertion written about the canvas, and the panel is exactly
  where that gap hides. Then the ordering case, which needs the
  refreshes to resolve out of order to mean anything: two overlapping dispatches whose
  fakes make the *first* command's re-query the slower one, asserting the store ends
  holding both commands' results rather than the first's snapshot. A test whose queries
  resolved in dispatch order would pass against an unqueued decorator. Then the symptom,
  asserted where a user would see it rather than
  on the decorator: after a create dispatch resolves, the new ID is in
  `ProjectStore.zones` and `SelectTool` hit-tests it; after a delete dispatch resolves,
  it is in neither — with no view reopen in between; and after a move of the selected
  zone resolves, the Inspector's DTO carries the post-move area, with no reselect in
  between. Slice 10 asserts the same symptom one cascade further out, on a figure this
  slice has no entity to produce.
- **Canvas tests (§74)**: Transformer normalization (slice 6) exercised for the first
  time on a non-rectangular shape — confirm normalized command input never carries
  `scaleX`/`scaleY` (§20).
- **E2E (PRD §101)**: create zone → persist/reload; create → undo → redo (same ID);
  select → move → undo; select → edit vertex → undo; select → delete → undo.
- **Explicitly not tested here** (nothing to test — not built): self-intersection
  rejection, `clipper2-ts` adapter behavior, `rbush` index performance.

## Definition of Done

1. Drawing ≥ 3 vertices and closing the shape produces a persisted `Zone` — Markdown
   note plus sidecar geometry entry — that survives a plugin unload/reload.
2. Closing a polygon produces exactly one `ReversibleCreateZoneCommand` and one
   `CommandHistory` entry; undo removes the zone, and redo brings back **the same
   entity, same ID** — asserted against the ID the first execute produced, not merely
   "a zone exists again".
3. Every mutation above is visible on the canvas the moment its dispatch resolves — a
   drawn zone renders and is selectable, a deleted one is gone and is no longer a
   hit-test candidate — with no close-and-reopen of the Plan Editor, and the same holds
   for the undo of each. **The Inspector is refreshed by the same dispatch**: moving or
   reshaping the selected zone leaves its panel showing the post-command area, with no
   reselect in between, and the assertion is made on the panel's DTO rather than only on
   `ProjectStore`.
3a. `ReversibleDeleteZoneCommand.undo()` revalidates before it restores: with a
   `remove-references` delete followed by deleting the now-unreferenced Asset, and
   separately by changing that Asset's unit from `m2` to `m`, the undo refuses and
   writes nothing rather than re-inserting Requirements that point at a missing Asset or
   carry an area quantity against a length unit. Both cases are only reachable *because*
   the delete succeeded — that is what made the Asset unreferenced and those operations
   legal — so both need their own test; and each passes trivially against an
   unconditional restore, since every individual compare-and-swap succeeds while the
   Vault ends up in a state no command would have produced.
3b. The **happy path** of that same undo still succeeds: a `remove-references` delete
   with every other endpoint untouched restores the Zone and every Requirement. This is
   a Definition of Done item rather than an obvious one because the first version of 3a
   checked that *every* endpoint referenced by `affectedBefore` exists — including the
   Zone it was about to restore, which is absent by construction — and so refused every
   undo it was written to permit. A refusal test passes just as happily against a check
   that refuses everything; only asserting the permitted case tells the two apart.
3c. That undo is a compensated multi-entity sequence and takes slice 10's contract in
   full: both lock levels held through the compensation, and a marker written before its
   first write. Asserted the same two ways slice 10 asserts the forward path — an
   ordinary override edit interleaved against an already-restored Requirement does not
   block the compensation, and a marker left behind by a simulated process exit is
   recovered at next load.
4. Attempting to close a polygon with fewer than 3 vertices, or with any non-finite
   coordinate, is rejected before `CreateZoneCommand` is ever dispatched; no invalid
   geometry reaches the sidecar.
5. Clicking an existing zone selects it and shows its vertex handles; clicking empty
   canvas clears the selection.
6. Dragging a selected zone's body — regardless of how many `pointermove` events
   fired — produces exactly one `ReversibleMoveZoneCommand` and one `CommandHistory`
   entry; pressing undo restores the exact prior point set.
7. Dragging one vertex handle produces exactly one `ReversibleMoveZoneVertexCommand`
   per gesture; undo restores that vertex's exact prior coordinate without altering
   any other vertex.
8. Deleting a selected zone removes both its Markdown note and its sidecar geometry
   entry; **pressing undo immediately afterward restores the zone exactly** — same
   ID, same zone type, byte-identical geometry — verified by comparing pre-delete and
   post-undo state in a test. The comparison covers every entity in `affectedBefore`
   too, so the assertion stays honest when slice 10 makes that set non-empty.
9. An `undo()` whose restore fails leaves the Vault exactly as the delete left it and
   the command on `undoStack`, so retrying it is a retry and not a repair. Proven here
   for the single-entity case; the multi-write case that can strand a half-restored
   Vault is slice 10's, which is where `affectedBefore` first has more than one thing
   in it.
10. All of the above passes with `clipper2-ts` and `rbush` absent from the dependency
    graph entirely — zero boolean-geometry calls, zero spatial-index lookups, on any of
    the paths above.
11. Vitest coverage exists for the §26 validation boundary table and for every
    command's `execute()`/`undo()` pair listed in Testing Strategy.

## References

- SDD §16 Spatial Rendering Architecture, §19 Interaction Layer, §20 Selection and
  Transformation, §21 Snapping Architecture, §22 Geometry Core, §23 World Coordinate
  System, §24 Viewport Transform.
- SDD §26 Geometry Validation (required rules and deferred "Future" list — this
  slice's central reference).
- SDD §27 Advanced Polygon Operations (`clipper2-ts`) — explicitly deferred.
- SDD §28 Spatial Index (`rbush`) — explicitly deferred, "optimization only."
- SDD §29 Command Architecture, §30 Undoable Editor Commands, §31 Transaction
  Boundary.
- SDD §39 Sidecar Files, §40 Plan Sidecar Schema, §42 Persistence Consistency.
- SDD §56 Editor Tool Architecture, §57 Initial Editor Tools, §58 Editor Context, §59
  Inspector Architecture.
- SDD §64 Error Model, §65 Result Pattern, §66 Error Boundary.
- SDD §91 Increment 6 — Zone Editing (success criterion this slice satisfies).
- SDD §92 Architecture Completion Criteria, items 5, 8, 10, 11, 12.
- SDD ADR-002 (JSON sidecar for plan geometry), ADR-006 (plain TypeScript domain),
  ADR-007 (command-based mutations), ADR-009 (world coordinates in millimeters).
- PRD §8 Core Entities (Zone), §15 Epic 4 — Zones & Spatial Objects, §59 Entity
  Relationship Rules, §63 Reference Integrity, §64 Deletion Semantics (deferred
  aspect — see Out of scope), §68 Undo/Redo Architecture, §85 Command Model, §101
  E2E Tests.
- `docs/tasks/README.md` — slice map and shared conventions.
