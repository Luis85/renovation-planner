# Plan editor foundation, increment 2 — Add Room

**Date:** 2026-09-03
**Epic:** `docs/requirements/Plan editor.md` → Features `Editor foundation` (Increment A, the two
halves it left open) and `Spatial creation` (Increment B, its first two PBIs).
**Baseline:** `main` AFTER pull request #66 (`claude/plan-editor-foundation-read-path`) merges.
This increment is not built on the open branch; see §12.
**Status:** proposed design. `docs/superpowers/plans/2026-09-03-plan-editor-add-room.md` is the
implementation plan derived from it. Where this document and the SDD disagree, the SDD is the
authority; where it and a PBI under `Spatial creation` disagree, the PBI is.

## 1. What this increment delivers

This is the vertical-slice plan's checkpoint **C2 — the creation path**: *"Add Room creates and
selects Kitchen. Does one homeowner action produce one coherent domain result?"* Scenarios A
(Create Kitchen), B (Cancel room creation) and C (Reload) of that plan's §8 are its acceptance.

A private renovator opens Add, chooses Room, and lands in a temporary creation task with one
instruction. They drag a rectangle on the floor and watch its width, depth and area update live;
or they type a width and a depth with no pointer at all. They name the room, or take one of the
suggested names. Create writes ONE reversible Room — a zone note and its sidecar geometry under
one id — selects it, and returns to Select. Escape or Cancel writes nothing. Undo removes the
room; redo restores it under the same id. Closing and reopening the floor shows the same room.

The first increment (`2026-09-02-plan-editor-foundation-read-path-design.md`) built the read
path and the Add menu whose Room entry routed to the polygon tool, and recorded three residues
this increment closes: the banner had no Finish, the default room name said "Zone", and repeated
creation had no subject. It writes to the vault through the write path slice 8 already built and
changes NO schema — the Room is still a `Zone` note plus a sidecar entry, exactly as
`editorRoundTrip.test.ts` says it is.

### PBIs and tasks this increment closes or advances

| PBI (`docs/requirements/`) | Tasks (`docs/tasks/`) touched here |
|---|---|
| Start room creation from Add | Define the Add-to-room creation contract; Route Add Room through every entry point; Verify cancellable room-start UX |
| Draw and name a rectangular room | Deliver rectangular room creation end to end; Persist and reload rectangular rooms; Verify reversible and accessible room creation; Suggest a localized Room name from its type; Keep adding Rooms only by explicit choice; Announce live Room dimensions without repetition and refuse out-of-bounds input |
| Start one creation task from Add (Editor foundation) | Run one temporary creation task from Add (the repeat option, its one open half); Show an active creation-task banner with complete controls (Finish — Remove last stays open, §11) |

Not advanced here: `Create a free-form room` (§2.1 says why and what it inherits), `Choose how
to start a floor` (M05's three-way start state; this increment only re-routes the existing
no-rooms empty state's one button, §7.2), `Grid and snapping`, `Switch the measurement unit in the
plan editor` (§2.6), `Edit a selected room shape and dimensions` (resize handles, §2.7).

## 2. Decisions

### 2.1 Room is a rectangle here; free shape is the free-form PBI's

M03 and interaction spec §17 Method 1 describe Add → Room as a rectangular drag. The Room entry
of the creation catalogue activates a NEW tool, `'draw-room'` (§4), and no longer the polygon
tool. `DrawPolygonTool` stays registered in the Plan Editor's `ToolManager` — the asset designer
registers the same class twice and twenty-one test files drive it by id — but **no control in
the Plan Editor reaches it after this increment**. That is a stated absence, recorded in this
section, in the `Start room creation from Add` PBI's amendments and in CLAUDE.md, with its
trigger: the `Create a free-form room` PBI, whose "Create free-form room drafts" task adapts the
polygon tool behind Room language and gives it a door (§17 Method 2's Free shape choice).

Why not a shape switch on the banner now: a free shape that closed into an immediate "Room 6"
while a rectangle asks for a name would be two creation flows with different endings. The draft
store (§3) is designed so the polygon tool's close can feed it later — `accept(geometry)` in
place of `commandFor(geometry)` — and that plug is the free-form increment's first task.

### 2.2 One draft, edited from two surfaces, dispatched once

The rectangle being drawn is a Pinia store per leaf, `RoomDraftStore` (§3): the canvas drag
writes it, the Inspector's numeric fields write it, both read it, and ONE action
(`createRoomFromDraft`, §6) turns it into ONE `ReversibleCreateZoneCommand` and dispatches it
through the leaf's one wrapped dispatcher. "Dragging and numeric dimensions converge on the same
creation command" is then a fact about the code's shape rather than a test's assertion — there is
no second path to converge.

This is a recorded deviation from the rule that a tool's transient visual lives in `RenderState`
(SDD §19). Two reasons, and the second decides it: the draft is not only a visual — it carries a
name, two field drafts, two field errors and a checkbox — and it must outlive the gesture that
created it, because the numeric route creates a rectangle with no gesture at all. `RenderState`
is left untouched; the Konva sketch (§5.3) reads the store.

### 2.3 The naming step lives in the Inspector, not in a dialog

M03's Inspector content is the form: type/name, width, depth, area, `Keep adding rooms`, Create.
A `FormDialog` would have been cheaper and is refused: slice 15's dialog makes the rest of the
view `inert`, so the user could not re-drag after seeing the numbers, and the live dimensions
could not update a preview behind a modal. `EntityInspector` routes to `NewRoomInspector` while
`activeToolId === 'draw-room'`, ahead of the selection routing (§5.1). In the constrained layout
the same body sits in the Inspector drawer the rail's Details button opens, and the banner
carries the second door to the same action — **Finish** — so the room can be created without
opening the drawer at all (§5.2).

### 2.4 No room-kind field; a name suggestion picker; the model question deferred

M03 says "choose a room type; suggest a default localized name", and interaction spec §69's list
is Kitchen, Living room, Bedroom, Bathroom, Other. `Zone` has no such field: `ZoneType` is the
Room/Area classifier (ADR-0016), and Add → Room has already decided it is `'Room'`. Persisting a
room kind is a new frontmatter key — additive at v1, but a MODEL decision with consumers this
increment does not have.

So the form offers **"What room is this?"** as a row of suggestion buttons that set the NAME
(Kitchen, Living room, Bedroom, Bathroom, Hallway, Office). Nothing but the name is stored, which
is what the task "Suggest a localized Room name from its type" actually requires: *"Confirmation
persists the visible name, not a translation key or internal type."* The default name is
`Room {n}` (`n` = zones on the floor + 1) and is applied only while the name is untouched; a
suggestion button is an explicit gesture and always sets the name.

The room-kind question is registered in the consolidation report as gap #6 and as deferred
ADR-RK, with its trigger: the first consumer that must QUERY by kind — per-kind cost defaults,
per-kind material lists, a room filter. Until then a kind would be a stored label nothing reads.

### 2.5 No schema change; the write path is slice 8's

`CreateZoneCommand` mints the `ZoneId`, `Zone.create` validates, `ObsidianZoneRepository.save`
writes the note and the sidecar entry as one logical write with compensation (its class docblock
describes the five steps), and `ReversibleCreateZoneCommand` owns undo and redo under the same id.
This increment adds no command, no repository method and no schema key. "Persist and reload
rectangular rooms" is discharged by a round-trip case and by the e2e rig detonating the sidecar
write (§10), not by new persistence code.

### 2.6 Units: metres, in one module, until the units PBI replaces it

Canvas labels and the two numeric fields show and read METRES with up to two decimals through
`formatMetres(mm)` and `parseMetres(text)` in `presentation/editor/shell/formatLength.ts`, beside
`formatArea`. `en-US` formatting, for the reason `formatArea` already gives. The `Switch the
measurement unit in the plan editor` PBI owns the per-plan unit and will replace both functions;
putting them in ONE module is what makes that replacement one edit.

### 2.7 Bounds: a Floor has no extent

The task "Announce live Room dimensions … and refuse out-of-bounds input" speaks of Floor bounds.
ADR-0017's Plan has no extent, and a background is optional. So "out of bounds" reduces to numeric
sanity, stated once as `parseMetres`'s three refusals: not a number, not positive, longer than
`MAX_ROOM_SIDE_MM` (1,000,000 mm — a kilometre). The task's amendment records the narrowing.
Resize handles on the draft (M03's "handles") belong to `Edit a selected room shape and
dimensions` and are not built; re-dragging replaces the rectangle, the fields refine it.

### 2.8 Snapping is deferred with its PBI

`SnapService` receives no candidates today and the `Grid and snapping` PBI owns giving it some.
The rectangle is axis-aligned in world space, so Shift constrains nothing and `draw-room` is NOT
added to `CONSTRAINING_TOOLS` — the status bar's hint would advertise a key that does nothing.

### 2.9 A stale or failed floor does not block Add

Extension 1a of `Start room creation from Add` ("Add is unavailable because the Floor cannot be
edited") is the trust path's — checkpoint C3, scenario D ("disables unsafe follow-up edits").
`stale` feeds the warning strip and nothing else, exactly as the first increment recorded for
Delete. Left standing, named in the PBI's amendments.

### 2.10 Repeated creation IS built

M03's `Keep adding rooms` is off by default; the task that asks for it sits under this
increment's own PBI, it costs one checkbox and one branch, and it closes a residue the first
increment recorded twice. On success with the box ticked the created room is selected, the draft
resets to a fresh default name, and the tool stays active.

## 3. The draft store

`src/presentation/editor/add/room-draft-store.ts`, Pinia id `'editor-room-draft'`, one per leaf
like every editor store.

```ts
export interface RoomRect { readonly x: number; readonly y: number; readonly width: number; readonly depth: number } // world mm; x,y = min corner

state:
  origin: Point | null        // min corner; null until a drag or a placement
  widthMm: number | null
  depthMm: number | null
  name: string
  nameTouched: boolean
  keepAdding: boolean         // reset to false on beginTask
  widthText: string           // what the field shows; kept verbatim on a refusal
  depthText: string
  widthError: LengthRefusal | null   // 'not-a-number' | 'not-positive' | 'too-large'
  depthError: LengthRefusal | null
  settledSize: string | null  // the announced sentence, see §5.4
  submitting: boolean

getters:
  rect: RoomRect | null       // all three of origin/width/depth present
  geometry: Polygon | null    // four points from rect: (x,y) (x+w,y) (x+w,y+d) (x,y+d)
  areaMm2: number | null      // width × depth
  valid: boolean              // rect !== null && name.trim() !== '' && no field error && !submitting

actions:
  beginTask(defaultName)      // reset everything, name = defaultName, nameTouched = false
  setRect(rect)               // the drag's writer: origin, width, depth; texts re-formatted; errors cleared
  clearRect()                 // Escape's writer: origin/width/depth/texts/errors cleared; name and keepAdding kept
  reset()                     // deactivate's writer: clearRect + name '' + keepAdding false
  setName(text)               // nameTouched = true
  suggestName(text)           // sets name; nameTouched = true (an explicit gesture)
  commitDimension(axis, text, placeAt: () => Point)
                              // parse; on refusal keep text and set the axis error; on success set the side,
                              // clear the error, and if origin is null and both sides are now known,
                              // origin = placeAt() − half of each side; then settle()
  settle()                    // settledSize = the sentence for rect, or null
  setKeepAdding(flag)
```

`placeAt` is a thunk because the store may not know the viewport: the Inspector passes the stage
centre in world coordinates, so a room typed with no pointer at all lands where the user is
looking. A numeric commit while a rect already exists keeps the min corner and changes the side.

## 4. The tool

`src/presentation/editor/tools/draw-room-tool.ts`, `'draw-room'` added to `ToolId`. Deps:
`{ draft: RoomDraftPort; defaultName: () => string }` where `RoomDraftPort` is the store's
`rect`, `setRect`, `clearRect`, `reset`, `beginTask` and `settle`.

- `activate(context)`: `draft.beginTask(defaultName())`.
- `pointerDown` (primary only): remember the anchor (world) and `rectBefore = draft.rect`.
- `pointerMove` with an anchor: `draft.setRect(normalised(anchor, worldPoint))` — min corner and
  absolute sides, so a drag in any direction is one rectangle.
- `pointerUp`: if the pointer moved less than `CLICK_EPSILON_PX × worldPerScreenPixel()` (the
  same epsilon `SelectTool` uses, extracted to `handleMetrics.ts` so it is one number), restore
  `rectBefore` — a click changes nothing; else keep the rectangle and `draft.settle()`.
- `hasDraft()`: `draft.rect !== null`. `cancel()`: `draft.clearRect()`, drop the anchor.
  `abandonGesture()`: restore `rectBefore`, drop the anchor — the interruption abandons only what
  the missing release would have completed. `deactivate()`: `draft.reset()`.

Nothing here touches `RenderState`, dispatches or names a Zone. Escape precedence is the existing
`routeEscape` unchanged: a drafted rectangle is cancelled and the tool stays; a second Escape
returns to Select; the banner's Cancel leaves the task in one gesture as before.

## 5. Shell

### 5.1 Components

| Component | Responsibility |
|---|---|
| `shell/NewRoomInspector.vue` (new) | The form: `<h3>` "New room"; Name field; "What room is this?" suggestion buttons; Width (m) and Depth (m) text fields with inline `FieldError`s, committed on blur and Enter; Area as a calculated `<dl>` row; `Keep adding rooms` checkbox; Create room (`aria-disabled` until `valid`) and Cancel; one `role="status"` for the settled size (§5.4) |
| `shell/EntityInspector.vue` (modified) | Routes to `NewRoomInspector` FIRST while `activeToolId === 'draw-room'`, then by selection as today |
| `shell/TemporaryToolBanner.vue` (modified) | `TASKS` gains `draw-room` with its own name and instruction; a task may declare `finish: true`, which renders a Finish button (`aria-disabled` with a reason while `!canCreateRoom`) calling `runtime.createRoom()`. Calibrate and draw-polygon declare none — they finish by gesture |
| `layers/RoomDraftSketch.vue` (new, mounted inside `InteractionLayer`) | The dashed closed rectangle plus two dimension labels (width above the top edge, depth right of the right edge), screen-projected through the layer's existing `toScreen`; drawn from the store, nothing else |
| `shell/formatLength.ts` (new) | `formatMetres`, `parseMetres`, `MAX_ROOM_SIDE_MM`, `LengthRefusal` |
| `add/roomCreation.ts` (new) | `createRoomFromDraft` (§6) |
| `add/creationCatalogue.ts` (modified) | Room activates `'draw-room'`; exports `activateCreationEntry(id, runtime)` so the empty state can take the same door |
| `PlanEditorRoot.vue` (modified) | `onEmptyStateAction` calls `activateCreationEntry('room', runtime)` |
| `runtime.ts` (modified) | Registers `DrawRoomTool`; exposes `createRoom` and `canCreateRoom`; `registerEditorTools` and `EditorToolDeps` move to `tools/registerEditorTools.ts` first, because the file is at its line cap |

### 5.2 Two doors, one action

Create room in the Inspector and Finish on the banner both call `runtime.createRoom()`. Both are
`aria-disabled` while the draft is not valid, each with `aria-describedby` naming why ("Size the
room and give it a name"), following `KnownDistanceForm`'s pattern rather than `:disabled` — the
control stays focusable and announced. A second press while a dispatch is in flight is dropped
(`submitting`), the same rule `useFormCommit.submit` applies to a repeated submit.

### 5.3 The sketch

Stroke from `tokens` like the polygon sketch, dashed and closed; label text `formatMetres(width)`
and `formatMetres(depth)` with the unit, `fontSize` in screen pixels so zoom does not scale it.
Drawn only while `rect !== null`, so a task with no rectangle yet shows nothing on the canvas and
the banner's instruction says what to do.

### 5.4 Live dimensions without repetition

The Inspector shows width, depth and area continuously (they are reactive reads of the store).
The `role="status"` element shows `settledSize` — `"{width} m by {depth} m, {area}"` — which
`settle()` writes on drag END and on a numeric COMMIT, never on a move. A live region announces
on DOM change, so an identical settled sentence is not re-announced and a hundred pointer moves
announce nothing. The store's `settle()` is the one writer; the test asserts the element's text
changes exactly once across a drag of many moves.

### 5.5 What the shell deliberately does not show

No perspective switch, no property tree, no grid or snap controls (unchanged from increment 1).
No resize handles on the draft (§2.7). No type selector (§2.4). No shape switch (§2.1).

## 6. The one creation action

`src/presentation/editor/add/roomCreation.ts`:

```ts
export type RoomCreationOutcome = 'created' | 'invalid' | 'refused' | 'busy';

export interface RoomCreationDeps {
  readonly planId: PlanId;
  readonly commands: Pick<PlanEditorCommandServices, 'createZone' | 'deleteZone' | 'zones'>;
  readonly ledger: WriteLedger;
  readonly dispatcher: { run(command: UndoableCommand): Promise<DispatchResult> };
  readonly draft: RoomDraftStore;
  readonly selection: Pick<SelectionStore, 'select'>;
  readonly defaultName: () => string;
  readonly returnToSelect: () => void;
  readonly reportRejected: (error: AppError) => void;
}

export async function createRoomFromDraft(deps: RoomCreationDeps): Promise<RoomCreationOutcome>
```

1. `submitting` → `'busy'`. `!valid` → `'invalid'` (nothing dispatched — the buttons are
   `aria-disabled`, so this arm is the keyboard's and a test's).
2. Build `new ReversibleCreateZoneCommand(commands.createZone, commands.deleteZone, commands.zones,
   ledger, { planId, name: draft.name.trim(), zoneType: 'Room', geometry: draft.geometry })` and
   `dispatcher.run` it — the wrapped dispatcher, so the history, the refresh and the save
   indicator all see it. `submitting` is true across the await.
3. Refused: `reportRejected(error)` (slice 17's `reportDispatchFailure` — a dispatched refusal
   goes wherever the indicator did not), the draft is KEPT, the tool stays → `'refused'`.
4. Created: `selection.select([command.createdZoneId])`; then `keepAdding` ?
   `draft.beginTask(defaultName())` : `returnToSelect()` → `'created'`.

A persistence failure produces no phantom: nothing was hydrated, the repository compensated its
own half-write, and the draft still shows the rectangle the user drew, with the toast saying why.

## 7. Entry points and vocabulary

### 7.1 One door

`CREATION_CATALOGUE`'s Room entry: `activate: (runtime) => runtime.setTool('draw-room')`. The Add
menu's Enter and click, and the empty state's action, all reach `activateCreationEntry('room',
runtime)`. Tests spy on `runtime.setTool` and assert `'draw-room'` exactly once from each door;
no test and no `src/` path under `presentation/editor/add/` or `PlanEditorRoot.vue` references
`'draw-polygon'` after this increment.

### 7.2 Room, never Zone

`editor.zone.default-name` ("Zone") is deleted; `editor.room.default-name` is `Room {n}` / `Raum
{n}` and is the one default both the room tool and the polygon completion (still registered, §2.1)
use. `empty.plan.no-zones.*` copy is reworded to rooms — headline "No rooms yet", action "Add a
room" — with its keys unchanged, since the selector and its tests key on them. `strings.test.ts`
gains a case refusing the word "Zone"/"zone" in every `editor.*`, `empty.plan.*` and
`editor.room.*` value of both locales.

## 8. Strings

All in `locales/en/editor.ts` and `locales/de/editor.ts`, same edit; German formal (Sie). Keys:
`editor.task.add-room.name` ("Adding a room"), `editor.task.add-room.instruction` ("Drag on the
floor to size the room, or type its width and depth."), `editor.task.finish` ("Create room"),
`editor.task.finish.blocked` ("Size the room and give it a name first"), `editor.room.new.heading`
("New room"), `editor.room.name`, `editor.room.suggestion.prompt` ("What room is this?"),
`editor.room.suggestion.kitchen|living-room|bedroom|bathroom|hallway|office`, `editor.room.width`
("Width (m)"), `editor.room.depth` ("Depth (m)"), `editor.room.area` ("Area"),
`editor.room.keep-adding` ("Keep adding rooms"), `editor.room.create` ("Create room"),
`editor.room.error.not-a-number` ("Enter a length in metres, such as 4.2"),
`editor.room.error.not-positive` ("A side must be longer than zero"),
`editor.room.error.too-large` ("A side cannot be longer than 1000 m"),
`editor.room.settled` ("{width} m by {depth} m, {area}"), `editor.room.default-name` ("Room {n}").
The sentence-case lint rule applies; "Create room" not "Create Room".

## 9. Escape, Cancel and focus

Unchanged routine, one new answerer. `routeEscape`: pan swallows; `hasDraft()` (the rectangle)
→ `clearRect`, tool stays; non-Select tool with no draft → Select; selection → cleared. Banner
Cancel and Inspector Cancel both call `runtime.cancelActiveTask()`, which clears the draft and
returns to Select in one gesture (R7). Escape inside a NAME or dimension field reaches nothing —
the Inspector is a sibling region of the canvas — and that is deliberate: a field's Escape is not
a canvas gesture. After Create the control that was pressed is unmounted with the form or the
banner, and a browser then drops focus to `<body>` — the defect the first increment's
resize-close fix closed for the overlays. Each of the two unmounting surfaces recovers it for
itself in `onBeforeUnmount`, when focus is inside it: `NewRoomInspector` focuses the Inspector
`<aside>` (which gains `tabindex="-1"`), the banner focuses the canvas container (already
focusable, since it hears keys). A test asserts `document.activeElement` is never `<body>` after
a Create from either door.

## 10. Testing

| layer | cases |
|---|---|
| store | geometry from rect (four points, order); area; `valid` needs rect + name + no error; `commitDimension` refuses three ways and keeps the text; a valid commit with no origin places the rect centred on `placeAt()`; a valid commit with an origin keeps the min corner; `beginTask` resets `keepAdding`; `clearRect` keeps the name; `settle` writes the sentence once |
| length | `formatMetres` two decimals, `parseMetres` accepts `4.2` and `4,2` (a decimal comma, since `de.ts` exists), refuses text, `0`, negatives, `Infinity`, `> 1000` |
| tool | a drag in each direction yields one normalised rect; a click under the epsilon leaves the previous rect; secondary button ignored; `cancel` clears; `abandonGesture` restores the pre-press rect; `deactivate` resets; `hasDraft` follows `rect`; `settle` called once per drag END |
| action | valid draft dispatches exactly one command whose geometry equals the numeric route's for the same size; invalid → no dispatch; refused → `reportRejected` once, draft kept, `returnToSelect` NOT called; created → `select([id])` then `returnToSelect`; `keepAdding` → fresh draft, tool stays; second call while submitting → `'busy'` |
| components (jsdom) | `NewRoomInspector` renders fields, chips set the name, a refused width shows inline and clears on correction, area follows the rect, Create `aria-disabled` until valid, status element text changes once per settled size; `EntityInspector` routes to the form under `draw-room` even with a selection; banner shows Finish under `draw-room` only, `aria-disabled` with reason, calls `createRoom`; Add menu Enter/click and the empty-state action each call `setTool('draw-room')` exactly once |
| e2e (`planEditorRig`) | drag → name → Create: one zone in the repository, its id equals the selection, Select active, Inspector shows the Room; undo removes it, redo restores the same id; Escape with a drafted rect clears it and writes nothing, second Escape returns to Select; a detonated `zones.save` leaves zero zones, the draft intact and `draw-room` active; typing 4.2 and 3.8 with no pointer creates the same four points as a drag of that size |
| contract | `editorRoundTrip.test.ts` gains a rectangle created through `CreateZoneCommand`: id, name, `'Room'`, four points and area survive the note + sidecar round trip |
| accessibility (axe) | plan editor under `draw-room` with a valid draft (full layout); with a refused width; the banner with Finish; constrained drawer showing the form |
| build | both locales complete; no `editor.zone.default-name`; no "zone" in the named prefixes; every new stylesheet class declared |
| harness | `?room=4200x3800` seeds the draft and activates the tool; shots `plan-editor-add-room` (1280) and `plan-editor-add-room-narrow` (460), read by eye |
| manual | `docs/tests/cases/Add a room.md` (order 90): the real drag feel, focus after Create in Electron, the drawer at sidebar width, reload in a vault |

Coverage floors are the binding constraint; every new arm ships with its test in the same task.

## 11. Residues, stated so they are not read as forgotten

- Free shape has no door (§2.1); trigger: the free-form PBI.
- Add is live over stale content (§2.9); trigger: checkpoint C3.
- No snapping, no resize handles, no per-plan unit (§2.6–2.8); each has its PBI.
- **Remove last** on the banner stays open: a rectangle has no removable step, and the polygon
  tool has no door here. The banner task's amendment says so.
- The room kind is unmodelled (§2.4); consolidation report gap #6, deferred ADR-RK.
- Focus after Create in Electron is checked by the manual case, not by jsdom.

## 12. Sequencing

1. **Gate**: PR #66 merged; branch `claude/plan-editor-add-room` from `main`. If #66 is not
   merged, STOP — this increment edits `runtime.ts`, `EntityInspector.vue`,
   `TemporaryToolBanner.vue`, `creationCatalogue.ts` and `PlanEditorRoot.vue`, all of which that
   pull request is still changing.
2. **Wave 1** (pure and jsdom, no shell): `formatLength.ts`, the draft store, `CLICK_EPSILON_PX`
   extraction, `DrawRoomTool`, `roomCreation.ts`, `registerEditorTools.ts` extraction and the
   tool's registration.
3. **Wave 2** (shell): strings; `NewRoomInspector`; `EntityInspector` routing; banner Finish;
   `RoomDraftSketch`; catalogue and empty-state routing; runtime `createRoom`/`canCreateRoom`.
4. **Wave 3** (proof and record): e2e, round-trip case, accessibility, harness knob and shots,
   manual case, PBI/task/Feature statuses, consolidation report gap #6, CLAUDE.md.

## 13. Risks

| risk | control |
|---|---|
| `runtime.ts` trips `max-lines` when the fourth tool is registered | `registerEditorTools` is extracted BEFORE the tool is added, as its own step |
| Two writers of the draft disagree (drag vs. field) | one store, one `rect` getter; the action reads only the getter |
| A drag that is really a click replaces a carefully typed rectangle | the epsilon restores `rectBefore`; a case drives a 2px "drag" after a numeric commit |
| The live region announces on every pointer move | `settle()` is called only at drag end and field commit; a case counts text changes across twenty moves |
| Coverage headroom of one unit | each task names its arms and their tests |
| The polygon tool's loss of a door reads as an oversight later | §2.1, the PBI amendment and CLAUDE.md all name the trigger |

## 14. Out of scope

Free-shape rooms; walls and openings; snapping and guides; resize handles; a room kind field;
per-plan display units; the three-way floor start (M05); blocking Add while stale; context menus;
any schema change or migration; any new repository method or command.
