# Wall context records, the Add submenu and construction materials

**Date:** 2026-09-12
**Baseline:** `main` at `210be3f4`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-12. The
implementation plan derived from it is
`docs/superpowers/plans/2026-09-12-wall-context-records-and-materials.md` (to be written). Where
this document and the SDD disagree, the SDD is the authority. Delivered as **one pull request**, by
the user's decision (§9).

## 1. What this delivers

A renovator draws walls that bound no room — the outside border of a property, a garden wall, a
free-standing partition. Today they can record nothing about such a wall: every renovation record
needs a Room, and the Inspector answers "Choose a room to connect renovation details to this
element." Areas (Garden, Terrace, Driveway, Roof, Construction area, Custom) get no renovation
details at all. And no wall or window says what it is BUILT of: a wall is only start, end,
thickness, height and bulge, "Existing: brick wall" is free text, and every wall draws the same.

1. **A record may have no room** (Part 1, §3). Existing/planned facts, Work items, decisions, notes,
   photos, documents, costs and material requirements can be kept on a wall, opening or element
   that bounds no room. Areas get the same details a Room gets (Part 2, §4).
2. **Add › in the canvas context menu** (Part 3, §5). Right-clicking a room, area, wall, opening or
   element offers an **Add** submenu with **Work item**, **Note** and **Photo**; for a wall it also
   holds **Door**, **Window**, **Opening** and **Wall from here**.
3. **Construction materials from the catalogue** (Part 4, §6). A wall has one core material and a
   door or window one product, each an Asset, in its Existing and its Planned state. The material's
   plan pattern draws on the canvas, and a planned material change produces one linked quantity and
   cost entry automatically.

## 2. Decisions taken in brainstorming

| Question | Decision |
| --- | --- |
| What "Task" creates | **A Work item** (`WorkPackage`). Obsidian checkbox tasks stay with the later *Obsidian task integration* Feature. |
| Which targets get Add › | **Rooms, areas, walls, openings and elements.** |
| Where the wall's geometry creations go | **Into the same Add submenu**, separated from the record entries. |
| How a room-less record is represented | **`roomId` becomes optional** (approach A). A placeholder key, "require an Area" and "self context" were refused (§10). |
| Default room for a new record | A selected zone is its own context; otherwise the room of an existing subject/Work item on the target; otherwise the **first** room the wall bounds (unchanged from today); otherwise **none**. |
| A room-less wall later encloses a room | Its records **do not** gain that room. They still list under the wall. |
| Photo pins without a room | **No pin.** The photo still appears in the target's strip. |
| Multiple selection | **No Add submenu.** Batch actions are unchanged. |
| What a wall material does | **Both**: shows as a plan pattern and drives quantity and cost, chosen **from the asset catalogue**. |
| How detailed a wall's construction is | **One core material.** Finishes (plaster, paint, tiles) stay separate material entries on the wall. |
| What a door or window carries | **One catalogue product.** Frame and glazing live in the asset's own notes. |
| Automatic quantity entry | **Yes, one linked entry**, created, repointed and removed with the material. |
| Which state produces the entry | **Only planned changes**: a new wall/opening, or a planned material that differs from the existing one. |
| How a pattern is chosen | **A fixed pattern list on the asset**, drawn in theme colours. |
| How the entry is persisted | **M1 — one combined, compensated save** of the record and the entry (§6.5). M2 "computed until touched" was refused (§10). |
| Delivery | **One PR**, all four parts. |

## 3. Part 1 — Records without a room

### 3.1 The rule

A record's **context** is its room when it has one, and its own target when it has none:

```ts
/** A record's context: its Room, or — when it has none — its own spatial target. */
export function contextOf(item: { readonly roomId?: string; readonly targetId: string }): string
```

Every comparison that today asks "same room?" asks "same context?" instead: `hasRoomContext`
(`src/domain/renovation/SharedLinks.ts`), the decision/subject room match and the outcome rule in
`Renovation.ts`, `validatePlanningDepth`'s work-link and evidence-link rules, and
`inRenovationScope` (`src/presentation/editor/renovation/renovationSummary.ts`). So a note, cost or
decision on a border wall can link to that wall's room-less Work item, and a room-less record can
never link to a record in an unrelated room.

### 3.2 Domain changes

- `roomId` becomes `roomId?: string` on `RenovationSubject`, `WorkPackage`, `RenovationDecision`,
  review findings and the depth records' context (costs, evidence, procurement) —
  `src/domain/renovation/Renovation.ts` and `PlanningDepth.ts`.
- **Secondary shared links keep a required `roomId`.** `SpatialLink` is unchanged: a secondary link
  exists only to name another Room context (ADR-0021 §"Editor completion"). A room-less primary may
  still carry secondary links into rooms.
- `validateRenovationTargets` (`renovationTargets.ts`):
  - a record WITH `roomId` — the zone must be present (unchanged);
  - a record WITHOUT `roomId` — its `targetId` must be a wall, opening or element in the current or
    intended structure. A zone-targeted record without `roomId` is refused (`renovation.room-missing`).
- The identity check in `validateRecords` refuses an **empty string** `roomId` and accepts an absent
  key, so `''` can never stand in for "no room".
- `validEvidence`: evidence without `roomId` must have no `pin`.
- `renovationReferents` already lists a record whose `roomId` OR `targetId` is the deleted id, so a
  room-less record still blocks deleting its wall. Covered by a test, not changed.
- Review findings carry the optional `roomId`; a finding without one routes to its target (§4.4).

### 3.3 Projections that group by room

- **Costs** — `renovationCostSummary` and `planningProjection.costRows` gather rows per room from
  the geometry's zone ids. Room-less cost records and room-less materials (§6.6) are gathered by
  context too, so the floor total counts each once and a wall's own cost summary shows them.
- **Project work view** — `readProjectWork` (`src/application/queries/schedule/ProjectWork.ts`)
  drops absent room ids; a row with no room shows its target's name instead.
  *Amended 2026-09-13:* the row shows **No room** instead — a wall has no user-given name to show
  there, so a generated label would name nothing the renovator recognises.
- **Review markers** — `ReviewRoomMarkers.vue` / `useReviewPresentation.ts` draw no room marker for
  a room-less finding; it is listed in the Review inspector and selects its target when chosen.

### 3.4 Persistence

> **Amendment (2026-09-13, merge of main #156):** main's ADR-0029 took plan note schema 11 for a plan's kind and sibling order; this branch writes **12** (`PlanFrontmatterSchemaV12` extends main's V11, pure 11→12 migration). Read every "11" for the plan note in §3.4, §6.2, §7, §8 and §9 as 12, and every "10" beside one as 11: §8's Persistence row reads "`planSchemaVersion` → 12 only when needed; 11→12 migration; v12 refused by the v11 union", and §9's delivery order reads "persistence v12".

- `src/infrastructure/persistence/dto/renovation.ts` and `planningDepth.ts`: `roomId: id.optional()`
  on subjects, work, decisions and the depth `context`. `SharedLinksSchema` is unchanged.
- **Plan note schema v11** (shared with §6.2): `PlanFrontmatterSchemaV11 =
  PlanFrontmatterSchemaV10.extend({ 'schema-version': z.literal(11) })`, added to the union;
  `PLAN_MIGRATIONS` gains the pure 10→11 discriminator migration. The shared `RenovationSchema`
  loosens for every version, following the v5 shared-links precedent: the version exists to make
  **older writers refuse**, not to gate the reader.
- `planSchemaVersion` (`src/infrastructure/persistence/mappers/planMapper.ts`) returns **11** when
  any record has no `roomId` or any subject carries an `assetId` (§6.2), checked before the `north`
  → 10 rule, in a helper — the function was just split under fallow's cognitive threshold
  (`38480853`). A plan with neither keeps writing exactly what it writes today.
- The geometry sidecar is untouched.

## 4. Part 2 — Inspector

### 4.1 One default-context function

Two watchers write `session.roomId` today and disagree — `StructureRenovationEntry.vue` also reads
`work.targetId`, `RenovationInspector.vue` does not. Both are replaced by one pure function in
`src/presentation/editor/renovation/`:

```ts
/** The Room context a new record on `targetId` starts in; '' for none. */
export function defaultRenovationContext(project: ContextSource, targetId: string, remembered: string): string
```

Order: a selected zone (any `zoneType`) → itself; otherwise the `roomId` of an existing subject,
then Work item, on the target; otherwise the first boundary room containing the wall (or an
opening's host wall); otherwise the remembered room when still valid for this target; otherwise `''`.

### 4.2 Details panel

- `RoomRenovationDetails.vue` becomes `RenovationDetails.vue` and takes `room?: ZoneDto` plus the
  session target. Room-only parts (area metadata, `RoomRenovationActions`) render only with a room;
  record lists, New buttons, evidence, materials and summaries render for any context.
- `RenovationInspector.vue` renders it when `session.roomId` names a zone **or** the selection is a
  structure target. `renovation.target.choose` is removed.
- `renovationActions.edit` drops the `zoneType !== 'Room'` guard and accepts any present zone id, or
  `''` with a structure target selected. `renovationTargetDraft` writes no `roomId` for `''`.
- Areas render the same panel; `standaloneZone`'s rotation controls stay.

### 4.3 Room picker

`RoomContextSelect.vue` lists rooms **and areas**, grouped by kind; its empty option reads **No
room** (new `renovation.target.none`; `renovation.select-room` keeps its heading use). Changing the
room of an existing record is an ordinary edit through the form and `RenovationCommand`.

### 4.4 Other entry points

- `noteCreation.ts` (the shell Add menu's Note) uses `defaultRenovationContext` and accepts any zone
  or a room-less structure target.
- A Review finding without a room selects its target and opens its record.

## 5. Part 3 — Add submenu in the canvas context menu

### 5.1 Model

```ts
export interface CanvasMenuAction { /* unchanged */ }
export interface CanvasMenuSubmenu { readonly id: string; readonly label: StringKey; readonly group: CanvasMenuGroup; readonly icon: string; readonly children: readonly CanvasMenuAction[] }
export type CanvasMenuItem = CanvasMenuAction | CanvasMenuSubmenu;
```

Children carry their own `group` — `'create'` for geometry and a new `'records'` for Work item, Note
and Photo — and a separator is drawn where it changes, as at the top level. A submenu with no
children is not emitted; it is greyed (with the first child's reason) only when every child is.

### 5.2 Contents

| Right-clicked | Add › |
| --- | --- |
| Wall | Door, Window, Opening, Wall from here │ Work item, Note, Photo |
| Room, area, opening, element | Work item, Note, Photo |
| Nothing | unchanged top-level **Add** that opens the shell Add menu |
| Several items, or Review perspective | no Add submenu |

The four wall creations keep their ids (`add-door`, `add-window`, `add-opening`, `new-wall`), disabled
reasons, icons and `run`; only their labels shorten (`editor.input.add.door`, …). The submenu sits in
the `create` group beside **Measure from here**.

### 5.3 Record actions

- **Work item** — `runtime.renovation.focus(context, 'work')`, then `edit('work', context)` on the
  selected target.
- **Note** / **Photo** — `focus(context, 'notes' | 'photos')`, then `planning.edit('evidence')`, the
  path `noteCreation.activate` already takes.

`context` is `defaultRenovationContext(...)`, so the form opens with the right room or **No room**
preselected. Each child is greyed with a reason while writes are blocked
(`editor.stale-write-refused` / `editor.input.unavailable`) or when the renovation or evidence-file
services are absent (new `editor.input.records-unavailable`).

### 5.4 Rendering and interaction

A new `CanvasMenuList.vue` renders one level — title, items, separators, submenu parents — and
renders itself for an open submenu. `CanvasContextMenu.vue` keeps opening, positioning, dismissal
and the Delete key, and stays under its complexity budget.

WAI-ARIA menu pattern:

- The parent is `role="menuitem"` with `aria-haspopup="menu"`, `aria-expanded` and a trailing
  `chevron-right` icon (already a pinned harness fixture); the submenu is a nested `role="menu"`
  labelled by its parent.
- **Opens** on pointer enter, click, Enter, Space or ArrowRight, focusing its first enabled item when
  opened from the keyboard. Pointer entry into a sibling top-level item closes it.
- **ArrowUp/Down, Home/End** move within the focused level only (`:scope >` queries), wrapping.
- **ArrowLeft** or **Escape** inside the submenu closes it and focuses its parent. Escape at the top
  level and **Tab** anywhere close the whole menu and restore focus as today.
- The submenu is a DOM descendant of the menu element, so outside-press and focus-out dismissal
  already treat it as inside.
- **Placement** is a pure `submenuPlacement(parent, submenu, host)`: right of the parent, flipped
  left at the editor root's right edge, clamped vertically. Pure because jsdom measures no layout.
- Styles go in `styles/editor-context-menu.css`, Obsidian variables only.

## 6. Part 4 — Construction materials

### 6.1 Where a material lives

A wall or opening has at most one subject in a floor register (ADR-0021), and that subject already
holds its Existing and Planned state. The material is part of those states:

```ts
export interface ExistingFacts { readonly description: string; readonly condition: …; readonly assetId?: string }
export interface PlannedFacts { readonly change: …; readonly description: string; readonly assetId?: string }
```

Rules in `validSubject` (`src/domain/renovation/Renovation.ts`):

- `assetId`, when present, is non-empty and allowed only on subjects whose `kind` is `wall`, `door`
  or `window`. That the target IS a wall (for `wall`) or an opening (for `door`/`window`) needs the
  structure, so it is checked in `validateRenovationTargets`, not in `validSubject`.
- `planned.change === 'unchanged'` requires `planned.assetId === existing.assetId`.
- `planned.change === 'remove'` carries no `assetId`.
- Choosing a material in the form fills an EMPTY description with the asset's name, so the existing
  non-empty description rule is kept rather than relaxed.

Whether the asset exists is an application-boundary check (the catalogue is not domain state):
`RenovationCommand`'s link check refuses an unknown `assetId` on write. A note that names a
since-deleted asset still reads, and the wall shows **Unknown material**, no pattern, and no change
to its entry.

### 6.2 Plan note persistence

`RenovationSchema`'s `existing` and `planned` objects gain `assetId: id.optional()`. The same v11
writer rule as §3.4 covers it: a subject with an `assetId` writes 11, so an older build refuses the
note rather than stripping the material.

### 6.3 Assets and patterns

- `Asset` gains `planPattern: PlanPattern | null`, with
  `PLAN_PATTERNS = ['brick', 'stone', 'concrete', 'timber', 'insulation', 'drywall', 'glass']`
  (`src/domain/asset/PlanPattern.ts`, the same union/array/guard shape as `AssetCategory`).
- Frontmatter key `plan-pattern`, `.nullable().catch(null)`, **no asset schema bump** — the additive
  precedent `height` and `background` set in `assetFrontmatter.ts`. The trade is the same one they
  accepted: an older build that saves the asset drops the key. It is named in ADR-0031.
- Edited in the Asset library inspector (`src/presentation/library/AssetInspectorFields.vue`,
  `definitionDraft.ts`) as a **Plan pattern** select with a **None** option.
- Material pickers filter by category: walls list `material` and `building-element`; doors and
  windows list `building-element` and `fixture`.

### 6.4 Inspector and forms

- `ExistingFields.vue` and `PlannedFields.vue` gain a **Material** select (a **Product** select for
  doors and windows) for `wall`/`door`/`window` subjects, with **None**. The planned select shows for
  `add` and `modify` only.
- `StructureInspector.vue` shows the wall's or opening's existing material, and its planned material
  when one differs, with **Set material…** opening the Existing form (the Planned form in the Planned
  mode). There is no instant-apply control: ADR-0021's explicit Apply/Cancel holds.
- When a planned material's unit has no rule (§6.5), the form says "Quantity isn't calculated for
  materials priced per {unit}". The entry itself is shown afterwards in the wall's Materials list;
  the form does not preview figures, so there is no second calculation path.

### 6.5 The automatic entry (M1)

**When it exists.** A subject gets exactly one **construction entry** — a `Requirement` — while its
planned facts carry an `assetId` and either `change === 'add'`, or `change === 'modify'` with
`planned.assetId !== existing?.assetId`, and a rule applies to the asset's unit. Otherwise it has
none. An unchanged wall costs nothing.

**What it measures.** `RequirementSource`:

| Target | Asset unit | `rule` |
| --- | --- | --- |
| Wall | `m2` | `wall-net` |
| Wall | `m` | `wall-length` |
| Wall | `m3` | **`wall-volume`** (new: length × height × thickness, in the source's state) |
| Door, window | `piece` | `count` |
| Door, window | `m2` | `opening-area` |
| any | anything else | no entry; material and pattern still set |

with `planId`, `targetId` = the subject's target, `state: 'intended'`, `outcomeId` = the subject id,
`workId: ''`, `coverage: '1'`, the asset's default waste, and a new marker `construction: true` that
identifies THE entry among any finishes the user linked to the same outcome.

**Lifecycle.**

- Material set on a qualifying subject → the entry is created.
- Planned material changed → the SAME entry is repointed (`Requirement.repointedTo`) to the new
  asset; a quantity override survives only if the unit is unchanged, and is cleared otherwise.
- Material cleared, or the subject stops qualifying (`unchanged`, `remove`, same as existing) → the
  entry is deleted. If a cost or procurement record references it (`materialReferents`), the WHOLE
  apply is refused and names them — nothing silently cascades.
- The subject is removed → its entry is deleted under the same refusal.
- Geometry edits re-measure it through the existing `onPlanningChanged` handler; nothing new.

**One save.** A new `ConstructionMaterialCommand` in `src/application/commands/renovation/` composes
the existing `RenovationCommand` (plan note + sidecar) and `MaterialCommand` (requirement note) into
**one** history entry, sharing the editor `WriteLedger`:

- It writes in reference order: the subject before a NEW entry (the entry references the outcome),
  the entry's deletion before a subject's REMOVAL (a referenced outcome cannot be removed).
- If the second write fails, it compensates the first with the versions that first write returned,
  and a failed compensation is reported through `markUncompensated`, exactly as `MaterialCommand`'s
  `confirmGeometry` does today.
- Undo runs the two in reverse reference order, each conditional on its own version, so a peer edit
  to either file retires the entry (`undoSuperseded`) rather than overwriting it.
- A form apply whose subject needs no entry change dispatches plain `RenovationCommand`, unchanged.

### 6.6 Material requirements without a room

- `RequirementOrigin` gains `{ kind: 'plan'; planId: PlanId }` — the discriminated union was left
  open for exactly this ("later epics can add origin kinds additively"). The spatial target is the
  source's `targetId`, as it is today for wall and opening sources.
- A requirement's origin is its subject's context: `{ kind: 'zone', zoneId }` when the record has a
  room, `{ kind: 'plan', planId }` when it has none. This applies to construction entries AND to
  materials added by hand in the Materials inspector for a room-less context, which is now enabled.
- `RequirementRepository.listByPlanOrigin(planId)` beside `listByZone` (the same scan-and-filter,
  Obsidian and in-memory); `readPlanning` merges it with the per-zone loop.
- Every reader of `origin.zoneId` narrows on `origin.kind` — the mapper, `Requirement.create` /
  `repointedTo`, `planningLinks.validateMaterialLinks`, `planningReferentialGuard`,
  `RecalculateRequirement`, `buildRequirementRow`, `contextualFigures`, `onPlanningChanged`,
  `MaterialCommand`'s locks (plan id instead of zone id), and the presentation readers
  (`MaterialsInspector`, `MaterialMarkers`, `CostFields`, `recordChoices`, `planningProjection`
  including its `[[rp-id:…]]` export line, `planningSelectionContext`, `recordNavigationContext`,
  `RenovationLinkedSummary`, `removalSources`, `AssetPlacementDetails`). The compiler finds them once
  the union widens; this list is the starting point, not the census.
- `sourceMeasurement`'s `roomId` parameter becomes optional; `room-area`, `room-perimeter` and
  `placement-count` refuse without one.

**Requirement note schema v5.** The frontmatter accepts `origin-kind: 'plan'` with `origin-plan`,
the `wall-volume` rule and `source.construction`. `requirementSchemaVersion` returns 5 when any of
the three is present; `REQUIREMENT_MIGRATIONS` gains the pure 4→5 migration.

### 6.7 Canvas pattern

- `StructureLayer.vue` draws a third pass, **`wall-pattern`**, after `wall-body`: per wall with a
  patterned material, a `v-shape` whose `sceneFunc` strokes that wall's centre-line (straight or
  arc) at the wall's thickness with a `CanvasPattern`.
- Tiles come from a pure `patternTile(pattern, tokens)` drawn on an offscreen canvas in theme
  colours (`--text-muted` over `wallFill`), cached per pattern and resolved theme, re-resolved on
  Obsidian's `css-change` through `useThemeTokens`. The tile is scaled by `1 / zoom` so hatch
  density is constant on screen. No literal colours.
- Which material draws: in the Planned renovation mode, the planned material (`unchanged` → the
  existing one, `remove` → none); everywhere else, the existing material. The intended structure is
  still not drawn as walls (unchanged).
- **Known gap:** the mitre wedge where two walls with different materials meet shows the plain body
  without hatch, because the pattern pass is per wall and the body pass is per run.
- Opening symbols are unchanged; a product shows only in the Inspector.

### 6.8 Asset deletion

`DeleteAsset` today resolves Requirement references. A subject material is a second kind of
reference: deleting an asset that any readable plan's subject names is **refused**, naming the
plans, and its resolution options (`remove-references`, `reassign`) do not cover subject materials
in this increment. Construction entries are Requirements and keep the existing resolution path.

### 6.9 ADR

**ADR-0031 — Construction materials, plan-origin requirements and plan patterns.** It records the
subject `assetId`, the construction entry and its lifecycle, M1's composite save, the `plan` origin,
`wall-volume`, the pattern list and its no-bump trade. It amends ADR-0020's deferral of "wall
construction text", ADR-0022's room-only requirement origin, and *Edit a selected wall precisely*'s
"Changing Wall construction, finish or renovation state" out-of-scope line; each gains a pointer
back.

## 7. Error handling

- A record whose target is deleted while its form is open fails through `RenovationCommand`'s
  existing target validation and save-state reporting.
- A hand-edited note with a room-less record on a zone target, a room-less evidence pin, an
  `assetId` on a `floor` subject, or an `unchanged` state with a different material refuses to read
  under today's `plan.frontmatter-invalid` / `renovation.*` codes.
- An unknown `assetId` is refused on write and tolerated on read (§6.1).
- A construction entry whose second write fails is compensated; a failed compensation is surfaced
  as uncompensated through the existing save state, and the command retires.
- Clearing a material whose entry a cost or procurement record references is refused with their
  names; the draft stays open.
- A v11 plan note or v5 requirement note opened by an older build is refused by that build's schema
  union — the purpose of both versions.

## 8. Testing

| Layer | Cases |
| --- | --- |
| Domain — context | room-less subject/work/decision/cost/evidence on a wall valid; room-less record on a zone target refused; unknown target refused; room-less pin refused; `''` roomId refused; links to a room-less Work item on the same target valid, another target invalid; secondary link still needs a room; `renovationReferents` for a room-less record; `contextOf` |
| Domain — materials | `assetId` only on wall/door/window subjects; `unchanged` needs the same material; `remove` carries none; `wall-volume` for straight and arc walls, current and intended; construction-entry qualification table (§6.5) including "same as existing" and units with no rule; `PlanPattern` guard |
| Persistence | round-trip of every room-less record kind and of subject `assetId`; `planSchemaVersion` → 11 only when needed; 10→11 migration; v11 refused by the v10 union; requirement `plan` origin, `wall-volume` and `construction` round-trip; `requirementSchemaVersion` → 5 only when needed; 4→5 migration; asset `plan-pattern` round-trip and a garbage value reading as `null` |
| Application | `RenovationCommand` creates, edits and removes room-less records on a fixture vault; unknown `assetId` refused; `ConstructionMaterialCommand` create / repoint (override kept for same unit, cleared otherwise) / delete; second write fails → first compensated; compensation fails → uncompensated + retired; undo/redo in reverse order; peer edit to either file → `undoSuperseded`; referenced entry → whole apply refused; `readPlanning` loads plan-origin requirements; costs count room-less materials once; `readProjectWork` row without a room; `DeleteAsset` refused while a subject names the asset |
| Inspector | wall bounding no room shows details, materials and New buttons; area shows details; `defaultRenovationContext` order (node); picker lists areas and **No room**; Material/Product selects filtered by category; planned select only for add/modify; the form's "isn't calculated" line; **Unknown material**; Plan pattern select in the Asset library inspector |
| Context menu | Add › contents per kind; geometry children only for walls; hidden for multi-select and Review; hover/click/Enter/ArrowRight open; ArrowLeft/Escape return to parent; Escape again and Tab close all; greyed children keep reasons; parent greyed only when all are; `submenuPlacement` (node); `wallContextActions.test.ts` driven through the submenu |
| Canvas | `structureLayerPasses.test.ts` extended with the `wall-pattern` pass order; planned vs existing material per mode; a pixel test (`tests/helpers/canvas.ts`) that a patterned wall differs from a plain one and that no literal colour is used; tile cache re-resolves on theme change |
| Accessibility | an axe scan with the submenu open; the Material select's label |
| Visual | `harness-shot` captures of the open submenu and of patterned walls, dark and light, default and 460 px |
| Manual | new `docs/tests/cases/Record work, a photo and a material on a property-border wall.md`, unrun until walked in a vault |

Every invariant asserted in a comment above gets a test watched failing first.

## 9. Delivery

One pull request, by the user's decision, over the recommendation of a stacked second PR. Commits
go in dependency order so the PR is reviewable commit by commit: domain context → persistence v11 →
Inspector → Add submenu → requirement `plan` origin and v5 → asset pattern → subject materials →
`ConstructionMaterialCommand` → canvas pattern → ADRs and docs.

## 10. Refused alternatives

- **A placeholder "floor" key in `roomId`.** `zones.get(roomId)` misses it silently — blank panels
  instead of compile errors — and it is a fabricated key ADR-0021 forbids.
- **Require an Area instead of a Room.** Annotating a border wall would first need an "outside" area
  drawn around the property — the friction this change removes.
- **Store the target id in `roomId` ("self context").** A field named `roomId` holding a wall id
  misleads every reader; `contextOf` derives the comparison without storing it.
- **M2 — the entry computed until touched.** Fewer writes, but project budgets, procurement and
  quote comparison read saved requirement notes, so they would undercount until every wall was
  touched.
- **Two dispatches for the record and the entry.** Two history entries and a half-applied state on
  failure.
- **Layered wall build-ups.** More realistic, much more UI and validation; finishes are already
  separate material entries.
- **A custom colour per asset.** Clashes with themes and needs a colour picker; the fixed list
  draws in theme colours.
- **A per-piece brick asset measured by wall area.** `sourceMeasurement` requires the measured unit
  to equal the asset's unit; converting m² to pieces would be a second quantity engine. Price
  masonry per m² or m³.
- **Storing the material on the wall in the geometry sidecar.** ADR-0021: the sidecar owns
  coordinates and measurements, Markdown owns descriptions and record links.

## 11. Non-goals

- Obsidian checkbox tasks.
- Evidence pins relative to a wall or element.
- Re-homing room-less records when a wall later encloses a room.
- An Add submenu for multiple selections.
- Layered build-ups, per-face finishes as structured wall data, frame/glazing fields.
- Drawing the intended structure as walls, or patterns on openings, zones or elements.
- `DeleteAsset` resolution options for subject materials.
- A **Set material** entry in the context menu.
