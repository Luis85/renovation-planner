# Add submenu and renovation records without a room

**Date:** 2026-09-12
**Baseline:** `main` at `210be3f4`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-12. The
implementation plan derived from it is
`docs/superpowers/plans/2026-09-12-add-submenu-and-roomless-records.md` (to be written). Where this
document and the SDD disagree, the SDD is the authority. Delivered as **one pull request**.

## 1. What this delivers

A renovator draws walls that bound no room — the outside border of a property, a garden wall, a
free-standing partition. Today they can record nothing about such a wall: every renovation record
needs a Room, and the Inspector answers "Choose a room to connect renovation details to this
element." Areas (Garden, Terrace, Driveway, Roof, Construction area, Custom) get no renovation
details at all.

1. **A record may have no room.** Existing/planned facts, Work items, decisions, notes, photos,
   documents and costs can be kept on a wall, opening or element that bounds no room. Areas get
   the same details a Room gets.
2. **Add › in the canvas context menu.** Right-clicking a room, area, wall, opening or element
   offers an **Add** submenu with **Work item**, **Note** and **Photo**. For a wall it also holds
   the geometry creations that are top-level items today: **Door**, **Window**, **Opening** and
   **Wall from here**.

## 2. Decisions taken in brainstorming

| Question | Decision |
| --- | --- |
| What "Task" creates | **A Work item** (`WorkPackage`). No new entity; Obsidian checkbox tasks stay with the later *Obsidian task integration* Feature. |
| Which targets get Add › | **Rooms, areas, walls, openings and elements.** |
| Where the wall's geometry creations go | **Into the same Add submenu**, separated from the record entries. |
| How a room-less record is represented | **`roomId` becomes optional** (approach A). A placeholder "floor" key and "require an Area" were refused (§8). |
| Default room for a new record | A selected zone is its own context; otherwise the room of an existing subject/Work item on the target; otherwise the **first** room the wall bounds (unchanged from today); otherwise **none**. |
| A room-less wall later encloses a room | Its records **do not** gain that room. They still list under the wall, because listing is by target. |
| Photo pins without a room | **No pin.** A pin is a fraction of the room's bounding box. The photo still appears in the target's strip. |
| Multiple selection | **No Add submenu.** The batch actions are unchanged. |
| Delivery | **One PR.** |

## 3. Part 1 — Records without a room

### 3.1 The rule

A record's **context** is its room when it has one, and its own target when it has none. One pure
domain helper states it:

```ts
/** A record's context: its Room, or — when it has none — its own spatial target. */
export function contextOf(item: { readonly roomId?: string; readonly targetId: string }): string
```

Every comparison that today asks "same room?" asks "same context?" instead:
`hasRoomContext` (`src/domain/renovation/SharedLinks.ts`), the decision/subject room match and the
outcome rule in `Renovation.ts`, `validatePlanningDepth`'s work link and evidence link rules, and
`inRenovationScope` (`src/presentation/editor/renovation/renovationSummary.ts`). So a note, cost or
decision on a border wall can link to that wall's room-less Work item, and a room-less record can
never link to a record in an unrelated room.

### 3.2 Domain changes

- `roomId` becomes `roomId?: string` on `RenovationSubject`, `WorkPackage`, `Decision`,
  `ReviewFinding` and the depth records' context (costs, evidence, procurement) —
  `src/domain/renovation/Renovation.ts` and `PlanningDepth.ts`.
- **Secondary shared links keep a required `roomId`.** `SpatialLink` is unchanged: a secondary link
  exists only to name another Room context (ADR-0021 §"Editor completion"). A room-less primary
  may still carry secondary links into rooms.
- `validateRenovationTargets` (`renovationTargets.ts`):
  - a record WITH `roomId` — the zone must be present (unchanged);
  - a record WITHOUT `roomId` — its `targetId` must be a wall, opening or element in the current or
    intended structure. A zone target always has its zone as context, so a zone-targeted record
    without `roomId` is refused (`renovation.room-missing`).
- The identity check in `Renovation.ts` (`!item.roomId.trim()`) refuses an **empty string** but
  accepts an absent key, so a DTO can never smuggle `''` in as "no room".
- `validEvidence`: evidence without `roomId` must have no `pin`.
- `renovationReferents` (deletion preview) already lists a record whose `roomId` OR `targetId` is
  the deleted id, so a room-less record still blocks deleting its wall. Covered by a test, not
  changed.
- `reviewRenovation` findings carry the optional `roomId` and their `targetId`; a finding without a
  room routes to its target (§4.4).

### 3.3 Projections that group by room

- **Costs** — `renovationCostSummary` and `planningProjection.costRows` gather rows per room from
  the geometry's zone ids. Room-less cost records are gathered by context too, so the floor total
  counts each once and a wall's own cost summary shows them.
- **Project work view** — `readProjectWork` (`src/application/queries/schedule/ProjectWork.ts`)
  builds each row's `rooms` from `work.roomId` and its outcomes' rooms. Absent ids are dropped; a
  row with no room shows its target's name instead of a room (presentation, via the plan's
  structure records).
- **Review markers** — `ReviewRoomMarkers.vue` / `useReviewPresentation.ts` place a marker per room.
  A room-less finding is listed in the Review inspector and, when chosen, selects its target; no
  room marker is drawn for it.
- **Material requirements stay room-scoped in this increment.** A `Requirement`'s
  `origin.zoneId` is required by its own note format and `RequirementSource` measurements need a
  zone. The material picker for a room-less context is **greyed with a reason** rather than hidden.
  This is a named non-goal (§9), not an oversight.

### 3.4 Persistence

- `src/infrastructure/persistence/dto/renovation.ts` and `planningDepth.ts`: `roomId: id.optional()`
  on subjects, work, decisions and the depth `context`. `SharedLinksSchema` is unchanged.
- **Plan note schema v11.** `PlanFrontmatterSchemaV11 = PlanFrontmatterSchemaV10.extend({
  'schema-version': z.literal(11) })`, added to the union; `PLAN_MIGRATIONS` gains the pure 10→11
  discriminator migration. The shared `RenovationSchema` loosens for every version, following the
  v5 shared-links precedent: the version exists to make **older writers refuse**, not to gate the
  reader.
- `planSchemaVersion` (`src/infrastructure/persistence/mappers/planMapper.ts`) returns **11** when
  any subject, Work item, decision or depth record has no `roomId`, checked before the existing
  `north` → 10 rule. A plan with no room-less record keeps writing exactly what it writes today.
  The function was just split under fallow's cognitive threshold (`38480853`); the new check goes
  in a helper rather than a new branch there.
- The geometry sidecar is untouched: no geometry schema change.

### 3.5 ADR

**ADR-0029 — A renovation record may have no Room context.** It amends ADR-0021 line 19 ("one Room
context") and line 116 ("refer to a present Room context") for the PRIMARY context only, states
`contextOf`, the pin rule, the v11 writer rule and the material non-goal. ADR-0021 gains a one-line
pointer to ADR-0029 under each amended sentence, so the contradiction is findable from both sides.

## 4. Part 2 — Inspector

### 4.1 One default-context function

Two watchers write `session.roomId` today and disagree — `StructureRenovationEntry.vue` also reads
`work.targetId`, `RenovationInspector.vue` does not. Both are replaced by one pure function:

```ts
/** The Room context a new record on `targetId` starts in; '' for none. */
export function defaultRenovationContext(project: ContextSource, targetId: string, remembered: string): string
```

Order: a selected zone (any `zoneType`) → itself; otherwise the `roomId` of an existing subject, then
Work item, whose `targetId` is the target; otherwise the first boundary room containing the wall (or
an opening's host wall); otherwise the remembered room when it is still valid for this target;
otherwise `''`. Lives in `src/presentation/editor/renovation/`, driven by node tests.

### 4.2 Details panel

- `RoomRenovationDetails.vue` is renamed `RenovationDetails.vue` and takes `room?: ZoneDto` plus the
  session target. Room-only parts (area metadata, `RoomRenovationActions`) render only with a room;
  the record lists, New buttons, evidence and summaries render for any context.
- `RenovationInspector.vue` renders it when `session.roomId` names a zone **or** the selection is a
  structure target, so a wall with no room shows its details instead of "Choose a room…".
  `renovation.target.choose` is removed.
- `renovationActions.edit` drops the `zoneType !== 'Room'` guard: it accepts any present zone id or
  `''` with a structure target selected. `renovationTargetDraft` writes no `roomId` for `''`.
- Areas render the same panel. `standaloneZone`'s rotation controls stay.

### 4.3 Room picker

`RoomContextSelect.vue` lists rooms **and areas**, grouped by kind, and its empty option reads
**No room** (new `renovation.target.none`; `renovation.select-room` keeps its heading use in
`RenovationInspector.vue`). It is the one place a room-less record gains a room or a
roomed record loses one. Changing it on an existing record is an edit through the existing form
and `RenovationCommand`.

### 4.4 Other entry points

- `noteCreation.ts` (the shell Add menu's Note) uses `defaultRenovationContext` and accepts any
  zone or a room-less structure target.
- A Review finding without a room selects its target and opens its record.

## 5. Part 3 — Add submenu in the canvas context menu

### 5.1 Model

`useCanvasMenuActions.ts`'s item type becomes a union:

```ts
export interface CanvasMenuAction { /* unchanged */ }
export interface CanvasMenuSubmenu { readonly id: string; readonly label: StringKey; readonly group: CanvasMenuGroup; readonly icon: string; readonly children: readonly CanvasMenuAction[] }
export type CanvasMenuItem = CanvasMenuAction | CanvasMenuSubmenu;
```

Children carry their own `group` — `'create'` for geometry and a new `'records'` for Work item, Note
and Photo — and the list draws a separator where it changes, exactly as the top level does. A
submenu with no children is not emitted. A submenu is greyed (with the first child's reason) only
when every child is disabled.

### 5.2 Contents

| Right-clicked | Add › |
| --- | --- |
| Wall | Door, Window, Opening, Wall from here │ Work item, Note, Photo |
| Room, area, opening, element | Work item, Note, Photo |
| Nothing | unchanged top-level **Add** that opens the shell Add menu |
| Several items, or Review perspective | no Add submenu |

The four wall creations keep their ids (`add-door`, `add-window`, `add-opening`, `new-wall`), their
disabled reasons (`editor.structure.error.opening-split`), their icons and their `run`; only their
labels shorten (`editor.input.add.door`, …) because the parent already says "Add". The submenu sits
in the `create` group beside **Measure from here**.

### 5.3 Record actions

- **Work item** — `runtime.renovation.focus(context, 'work')`, then `runtime.renovation.edit('work',
  context)` on the selected target.
- **Note** / **Photo** — `focus(context, 'notes' | 'photos')`, then `planning.edit('evidence')`, the
  path `noteCreation.activate` already takes.

`context` is `defaultRenovationContext(...)`, so the form opens with the right room or **No room**
preselected and the user can change it there. Each child is greyed with a reason while writes are
blocked (`editor.stale-write-refused` / `editor.input.unavailable`), or when the renovation or
evidence-file services are absent (new key `editor.input.records-unavailable`; no existing key says
this).

### 5.4 Rendering and interaction

A new `CanvasMenuList.vue` renders one level — title, items, separators, submenu parents — and
renders itself for an open submenu. `CanvasContextMenu.vue` keeps opening, positioning, dismissal and
the Delete key, and stays under its complexity budget.

WAI-ARIA menu pattern:

- The parent is `role="menuitem"` with `aria-haspopup="menu"`, `aria-expanded` and a trailing
  `chevron-right` icon; the submenu is a nested `role="menu"` labelled by its parent.
- **Opens** on pointer enter, click, Enter, Space or ArrowRight, focusing its first enabled item when
  opened from the keyboard. Pointer entry into a sibling top-level item closes it.
- **ArrowUp/Down, Home/End** move within the focused level only (`:scope >` queries), wrapping as
  today.
- **ArrowLeft** or **Escape** inside the submenu closes it and focuses its parent. Escape at the top
  level and **Tab** anywhere close the whole menu and restore focus as today.
- The submenu is a DOM descendant of the menu element, so the existing outside-press and focus-out
  dismissal see it as inside.
- **Placement** is a pure function `submenuPlacement(parent, submenu, host)`: right of the parent,
  flipped left when it would cross the editor root's right edge, clamped vertically inside it. Pure
  because jsdom measures no layout.
- Styles go in `styles/editor-context-menu.css`, Obsidian variables only.

### 5.5 Copy

`en` and `de` in `src/presentation/i18n/locales/*/input.ts` and the renovation locale: `Add`, `Door`,
`Window`, `Opening`, `Wall from here`, `Work item`, `Note`, `Photo`, `No room`. Sentence case.

## 6. Error handling

- A record whose target is deleted while its form is open fails through `RenovationCommand`'s
  existing target validation and save-state reporting; nothing new.
- A hand-edited note with a room-less record on a **zone** target, or a room-less evidence pin,
  refuses to read under the same `plan.frontmatter-invalid` / `renovation.*` codes as today's
  invalid records.
- A v11 note opened by an older build is refused by that build's schema union — the purpose of
  the version.

## 7. Testing

| Layer | Cases |
| --- | --- |
| Domain | room-less subject/work/decision/cost/evidence on a wall valid; room-less record on a zone target refused; room-less on an unknown target refused; room-less evidence with a pin refused; `''` roomId refused; evidence/cost linking a room-less Work item on the same target valid, on another target invalid; secondary link still needs a room; `renovationReferents` lists a room-less record for its wall; `contextOf` |
| Persistence | round-trip of every room-less record kind; `planSchemaVersion` → 11 only when a record has no room, otherwise unchanged (10/9/…); 10→11 migration; a v11 note refused by the v10 union |
| Application | `RenovationCommand` creates, edits and removes a room-less Work item and photo on a fixture vault (`openFixtureVault`); cost totals count a room-less cost once; `readProjectWork` row without a room |
| Inspector | wall bounding no room shows details and New buttons; area shows details; `defaultRenovationContext` order (node); picker lists areas and **No room**; changing a record to **No room** and back |
| Context menu | Add › contents per kind (§5.2); geometry children only for walls; hidden for multi-select and Review; hover/click/Enter/ArrowRight open; ArrowLeft/Escape return to parent; Escape again and Tab close all; greyed children keep reasons; parent greyed only when all children are; `submenuPlacement` flip and clamp (node); existing `wallContextActions.test.ts` cases driven through the submenu |
| Accessibility | an axe scan with the submenu open, beside the existing context-menu scans |
| Visual | a `harness-shot` capture of the open submenu on a wall, dark and light, default and 460 px |
| Manual | new `docs/tests/cases/Record work and a photo on a property-border wall.md`, unrun until walked in a vault |

Every invariant asserted in a comment above gets a test watched failing first.

## 8. Refused alternatives

- **A placeholder "floor" key in `roomId`.** Every `zones.get(roomId)` misses it silently, so the
  failures are blank panels rather than compile errors, and it is a fabricated key ADR-0021 forbids
  ("names and paths are display/navigation properties, never keys").
- **Require an Area instead of a Room.** No domain change, but annotating a border wall would first
  need an "outside" area drawn around the property — the friction this change removes.
- **Store the target id in `roomId` ("self context").** Fewer type changes, but a field named
  `roomId` holding a wall id misleads every reader; `contextOf` derives the same comparison without
  storing it.
- **Two pull requests.** Rejected by the user; one PR.

## 9. Non-goals

- Material requirements on a room-less context (`Requirement.origin.zoneId` stays required).
- Obsidian checkbox tasks.
- Evidence pins relative to a wall or element.
- Re-homing room-less records automatically when a wall later encloses a room.
- An Add submenu for multiple selections.
