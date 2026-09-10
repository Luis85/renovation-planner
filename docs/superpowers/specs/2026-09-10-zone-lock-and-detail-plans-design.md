# Zone lock and detail plans from a zone

**Date:** 2026-09-10
**Baseline:** `main` at `ada324f9`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-10. The
implementation plan derived from it is
`docs/superpowers/plans/2026-09-10-zone-lock-and-detail-plans.md` (to be written). Where this
document and the SDD disagree, the SDD is the authority.

## 1. What this delivers

A renovator draws a whole property as one plan: a site zone, a garden zone, a house zone, and
the constructions inside them. Two things make that hard today.

1. **Large zones swallow clicks.** The site zone covers everything, so clicking, hovering,
   marquee-selecting or right-clicking anything inside it keeps landing on the wrong record.
   The renovator LOCKS a zone from the left sidebar, and the canvas then clicks through it.
2. **One plan cannot hold every level of detail.** The renovator right-clicks the house zone,
   chooses **New detail plan…**, and gets a new plan named after the zone, opened in the
   editor, showing the house outline as a guide. From there they build floors, and from the
   site plan they can jump down into any detail plan and back up again.

The two parts are independent and can ship in either order; §7 recommends lock first.

## 2. Decisions taken in brainstorming

| Question | Decision |
| --- | --- |
| What a lock does on the canvas | **Click-through.** The zone is not a hit candidate for click, hover, marquee or context menu. It stays visible and selectable from the sidebar. |
| Does a lock also refuse edits? | **No.** Inspector forms still edit a locked zone selected from the sidebar. |
| Where a lock is remembered | **On the zone note**, canonical, undoable, survives reload, same in every leaf. |
| Does a detail plan stay linked? | **Yes, and navigable** both down (zone context menu) and up (breadcrumb). |
| What a detail plan starts with | **Blank, plus the parent zone's outline as a non-interactive guide.** |

The first two rows **contradict** the existing PBI
[[Lock completed spatial geometry against accidental editing]], which keeps locked geometry
selectable and refuses its edits, and lists "making it unselectable" as out of scope. §3.8 amends
that PBI rather than leaving two answers standing.

## 3. Part 1 — Lock a zone

### 3.1 Scope

Zones only: Rooms and Areas (ADR-0016). Walls, openings, generic elements and saved groups are
not lockable in this increment. Unfinished drafts are not zones yet and offer no lock.

### 3.2 Domain

`Zone` gains `readonly locked: boolean`, default `false`, plus `withLocked(locked: boolean): Zone`
returning a new immutable entity. `CreateZoneProps.locked` is optional. No validation is needed:
the value is a boolean.

### 3.3 Persistence

- `zoneFrontmatter.ts` gains `ZoneFrontmatterSchemaV2 = V1.extend({ 'schema-version': 2,
  locked: z.boolean() })`, and the repository parses the union of V1 and V2.
- `zone.migrations.ts` stays empty: a V1 note is simply an unlocked zone, read in memory, never
  rewritten by a read.
- The zone mapper writes **v2 only when `locked` is `true`** and v1 otherwise, following
  `planSchemaVersion`'s rule that a save only raises the version when it has something an older
  reader would drop. An older build therefore refuses a locked zone's note instead of silently
  saving the lock away, and unlocking returns the note to v1.
- Geometry sidecar: unchanged. The lock is metadata, not geometry.

### 3.4 Command

No new command. `EditZoneDetailsCommand`'s `ZoneDetails` gains an optional `locked`; the toggle
dispatches a `details` edit whose forward and inverse restate the zone's current name and type
with the new and old lock. Absent `locked` leaves the lock untouched, so the area-details form is
unchanged. The originally planned `SetZoneLockedCommand` would have been a line-for-line clone of
that command (implementation plan, 2026-09-10). History, versioning, no-write and
`ZoneDetailsChanged` behave exactly as first described.

### 3.5 Read model

`ZoneDto` and `SpatialRecordDto` gain `locked: boolean`. `toZoneDto` copies it.

### 3.6 Canvas

- `canvasCandidates` drops zones whose `locked` is `true`. It is already the single source for
  `SelectTool` click and hover, marquee finishing and `CanvasContextMenu`'s target, so all four
  click through in one change. Its `zones` parameter type gains `locked?: boolean`.
- Because `resolveSelectionTarget` finds vertex handles only on a SELECTED CANDIDATE, a locked
  zone selected from the sidebar has no hittable handles. Its selection overlay therefore draws
  **no vertex handles**, so nothing is drawn that cannot be used.
- A locked zone renders as today, at reduced opacity, with its caption unchanged.
- Saved groups: selecting another member of a group still expands to every member, locked ones
  included, and a group move moves them. Lock is click-through, not edit protection (§2).

### 3.7 Sidebar and Inspector

- `RoomSummaryList.vue` rows become `<li>` → row button (unchanged) + a sibling **lock toggle
  button** (a button cannot nest in a button). The toggle carries `aria-pressed`, an accessible
  name of `Lock {name}` / `Unlock {name}`, and a `lock` / `unlock` host icon. Both lists that
  mount `RoomSummaryList` (Property panel *Elements*, Floor Inspector rooms/areas) get it.
- The row button keeps selecting and framing, so a locked zone remains reachable for inspection,
  rename and unlock.
- `RoomInspector` and the Area inspector show a **Locked** badge (icon + text) and the same
  toggle, so the state is visible without colour alone.
- The toggle is disabled while `runtime.writesBlocked` is true, like every other write control.
- New strings in `en` and `de` locales, through `tr`.

### 3.8 Documentation

- **ADR-0027, "Zone lock is canonical click-through"**: compares workspace state, view state and
  canonical state (the choice the PBI's task *Record the spatial lock state authority* asks for),
  records v1/v2 writing, history and reload semantics, and names `canvasCandidates` as the
  enforcing boundary. Revisit when walls, elements or groups need locking, or when edit
  protection is asked for.
- Amend the PBI *Lock completed spatial geometry against accidental editing* and its four tasks
  with a dated amendment: scope narrowed to zones, semantics changed to click-through, edit
  refusal withdrawn, pointing at ADR-0027.

### 3.9 Failure handling

A refused lock write keeps the prior state; the store is refreshed from the authority, never
from an optimistic flag, and the failure goes through the editor's existing dispatch/notice path.
A version conflict is the same stale-read path every other zone write uses.

### 3.10 Tests

- `canvasCandidates`: a locked zone is not a candidate; unlocked and structure candidates are.
- `SelectTool` / marquee / context menu: clicking inside a locked zone over an unlocked one
  selects the unlocked one; clicking a locked zone alone clears selection.
- `EditZoneDetailsCommand` with `ZoneDetails.locked` — lock, unlock, undo/redo as one step, a
  details edit without `locked` leaves the lock alone, unchanged lock is no-write, event published
  (see tests/application/commands/editZoneDetails.test.ts).
- `EditZoneDetailsCommand`'s own `execute`/`undo` (no separate adapter): redo after undo restores
  the prior lock exactly, per the same test as above.
- Mapper/repository: v1 reads as unlocked; locked saves v2; unlocked saves v1; round trip on the
  disk-backed fixture vault.
- `RoomSummaryList` in jsdom: toggle dispatches, `aria-pressed` follows the store, row click
  still selects a locked zone.
- Axe scan still passes on the Plan Editor with a locked zone present.

## 4. Part 2 — Detail plans from a zone

### 4.1 Domain

`Plan` gains `readonly parent: { planId: PlanId; zoneId: ZoneId } | null`, set only through
`CreatePlanProps.parent` and carried unchanged by every `with…` method. No command changes it
after creation, exactly as no command moves a plan between projects. No `Floor`, `Building` or
`Site` entity is introduced.

`parent.planId` is stored beside `parent.zoneId` on purpose: the up-link survives the zone's
deletion, and finding the parent plan needs no zone read.

### 4.2 Persistence

- `PlanFrontmatterSchemaV9 = V8.extend({ 'schema-version': 9, 'parent-plan': z.string().min(1),
  'parent-zone': z.string().min(1) })`, added to the union.
- `planSchemaVersion` returns 9 when `plan.parent` is set, before its existing checks.
  Parentless plans keep writing whatever version they write today.
- A v9 note missing either key fails the schema like any other malformed note.

### 4.3 Command

`CreatePlanInput` gains `parent?: { planId; zoneId }`. When present, `CreatePlanCommand`:

1. loads the parent plan and refuses `plan.parent-plan-not-found` if absent;
2. refuses `plan.parent-project-mismatch` if it belongs to another project;
3. loads the zone and refuses `plan.parent-zone-not-found` if absent or on a different plan.

All three are `ReferenceError`s with EN/DE user messages. `PlanCreated`'s payload is unchanged.
The command stays outside canvas history, as "New plan" in the project view is today.

### 4.4 Queries

`PlanEditorQueryServices` gains:

- `listDetailPlans(planId)` → `{ id, name, parentZoneId }[]`, from `ListPlansByProject`
  filtered by `parent.planId === planId`. Unreadable plans are counted, not shown.
- `getPlanAncestry(planId)` → `{ id, name }[]` from the root plan down to the parent, following
  `parent.planId` through `getPlan`. A visited-set guard stops at a cycle a hand-edited note could
  create; a missing ancestor ends the chain there.
- `getParentZoneOutline(planId)` → `{ name, points, bulges } | null`, reading the parent plan's
  zones through `findZonesByPlan` and picking `parent.zoneId`.

`unavailablePlanEditorQueries` refuses all three like the others.

### 4.5 Navigation

`EditorNavigation` gains `plan(planId: string): Promise<void>`, bound at the composition root to
`revealPlanEditor` through `renovationProjectOpenSeams`, so it reuses a leaf already showing that
plan (CLAUDE.md's "one action, every input").

### 4.6 Creating and opening from the canvas

For a single selected zone, `useCanvasMenuActions` adds, after Delete:

- **New detail plan…** — opens a root-owned dialog (the existing `NewPlanForm` pattern in the
  editor's `DialogHost`) prefilled with the zone's name. Create dispatches `CreatePlanCommand`
  with `parent`, then `navigation.plan(newId)`. Disabled when `writesBlocked`, in review
  perspective, or when `context.navigation` is absent.
- **Open "{name}"** — one entry per existing detail plan of that zone, sorted by name, each
  calling `navigation.plan(id)`.

The detail-plan list refreshes on hydrate and after this leaf's own Create. The plan-change
source filters `PlanCreated` by the created plan's own id, so a detail plan created from a
different leaf of the same parent appears on that leaf's next hydrate rather than immediately;
widening the source is not worth a payload change for that case.

### 4.7 Going up

`PropertyLayerPanel`'s property context and `EditorContextBar` both render one derived chain:
`Project › Site › House › Ground floor`. Project and each ancestor are buttons
(`navigation.project` / `navigation.plan`); the current plan is `aria-current="page"` text. A
missing ancestor simply ends the chain after the project. This extends ADR-0017's two-segment
breadcrumb without adding persisted hierarchy beyond §4.2.

### 4.8 The outline guide

- Drawn in the Plan Editor for a plan with a parent: a dashed outline with the zone's name, in a
  non-listening Konva group (`listening: false`) above the reference image and below zones.
- **Never** a selection candidate, never in the sidebar lists, never in a fit-to-content
  bound, never persisted into the detail plan.
- **Placement:** translated by `-min(x), -min(y)` of the zone's bounding box, so its top-left
  bounding corner is world origin. ADR-0019 pins a reference crop's corner at world origin with
  no free translation, so cropping a drawing at the matching corner aligns the two.
- **Scale:** world millimetres from the parent. It matches a detail plan's drawing once that
  plan is calibrated; before then the mismatch is expected and not corrected. Recalibrating the
  detail plan does not move it, because it is derived on every hydrate rather than stored.
- Hidden when the background layer is hidden.

### 4.9 When the parent is gone

| Situation | Behaviour |
| --- | --- |
| Parent zone deleted or unreadable | Plan opens normally; no guide; the property context shows "Parent zone no longer exists". Up-link to the parent plan still works. |
| Parent plan deleted or unreadable | Chain ends at the project; no guide. |
| Zone with detail plans is deleted | Allowed, no extra warning; detail plans survive (see §5). |

### 4.10 Documentation

- **ADR-0028, "A plan may detail a zone of another plan"**: amends ADR-0017's consequence "no
  persisted hierarchy" to one optional, immutable parent link; compares storing the link on the
  child plan, on the zone, or as a Site/Building entity; states the guide-at-origin rule against
  ADR-0019. Revisit when plans must align across different origins or a zone-delete must account
  for its detail plans.
- New PBI through the backlog skill: *Create a detail plan from a zone and move between levels*,
  with ADR-0028 as its decision; cross-link from *Navigate property, building and floor context in
  the editor*.
- `docs/using-plan-editor.md`: one section each for locking and detail plans.

### 4.11 Tests

- `Plan.create` carries `parent`; every `with…` method preserves it.
- Mapper: parentless plans write their old version; a parent writes v9; v9 round trip on the
  fixture vault; v9 without `parent-zone` is refused.
- `CreatePlanCommand`: success with parent, and each of the three refusals.
- `getPlanAncestry`: three levels in order, missing ancestor ends the chain, a cycle stops.
- `listDetailPlans`: filters by parent, excludes other projects' plans.
- Guide placement: a zone at (30000, 12000) yields a guide whose bounding corner is (0, 0).
- Context menu: *New detail plan…* and one *Open* per child for a zone; neither for a wall or
  for a multi-selection; disabled when writes are blocked.
- Breadcrumb in jsdom: ancestors are buttons calling `navigation.plan`.
- Manual case in `docs/tests/cases/`: create site → house → ground floor in a vault, walk down
  and up, confirm the guide lines up after cropping and calibrating. Unrun until run.

## 5. Deliberately not in this increment

| Skipped | Add when |
| --- | --- |
| Locking walls, openings, elements, groups | A wall or element starts swallowing clicks the way a zone does. |
| Edit protection on locked zones | Accidental edits through the Inspector are reported, not only accidental clicks. |
| Zone delete dialog naming its detail plans | A detail plan is lost track of after its zone is deleted. |
| Tree view of plans in the project view | A project has enough detail plans that the flat list stops being scannable. |
| Inheriting the parent's background, cropped | The garden/site case needs the parent's image rather than its own drawing. |
| A `Site`/`Building`/`Floor` entity | ADR-0017's trigger: two buildings, or floors aligned across plans. |

## 6. Risks

- **Two schema bumps at once** (zone v2, plan v9). Each is independent and each keeps old notes
  readable, but a user who opens a vault in an older build after locking a zone or creating a
  detail plan will see those notes refused. That is the intended behaviour and must be stated in
  `CHANGELOG.md`.
- **The guide's alignment rests on ADR-0019's crop-at-origin rule.** If free reference
  translation is ever introduced, §4.8's placement must be revisited in the same change.
- **Context-menu length** grows with detail plans per zone. Acceptable for the expected handful.

## 7. Order of work

1. Part 1 (lock): domain → persistence → command and adapter → read model → `canvasCandidates`
   → sidebar/Inspector → ADR-0027 and PBI amendment.
2. Part 2 (detail plans): domain → persistence → command → queries → navigation → context menu
   and dialog → breadcrumb → guide → ADR-0028, PBI, user doc, manual case.

Each step lands with its tests; `npm run check` runs once before each commit.
