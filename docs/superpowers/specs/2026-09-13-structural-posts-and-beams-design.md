# Structural posts and beams on the plan (timber-frame houses)

**Date:** 2026-09-13
**Baseline:** `main` at `39fe06a3`.
**Status:** proposed design, approved section by section in brainstorming on 2026-09-13. No
implementation plan exists yet. Where this document and the SDD disagree, the SDD is the authority
(§17 architecture layer, §40 geometry sidecar).

## 1. What this delivers

A renovator planning a half-timbered house (Fachwerkhaus) can draw what a floor plan actually
shows of a timber frame: the **vertical posts** (Ständer, Stützen) standing in or free of a wall,
and the **beams** overhead (Deckenbalken, Unterzüge). Both are generic structural elements, not
timber-specific, so a steel column or a concrete downstand beam is drawn the same way.

Each carries a **load-bearing** switch. Deleting a load-bearing element stays possible, and the
confirmation says plainly what is being removed.

The other half of the request — owners who expose the frame and give up partition walls — needs no
new field: posts do not belong to a wall, so a partition wall planned for removal leaves its posts
standing, and "expose and sand the beam" is a planned change on that beam in the existing
renovation model.

Braces and rails (Streben, Riegel) lie in the plane of the wall and do not appear in a plan view at
all; they are out of scope (§8).

What exists today:

| Fact | Where |
| --- | --- |
| Point-based floor elements are one union; a new kind plugs in there | `SpatialElementKind`, `validSpatialElement` in `src/domain/spatial/SpatialElement.ts` |
| Geometry sidecar is at schema version 10; elements are a `z.enum` of kinds with per-kind `refine`s | `src/infrastructure/persistence/dto/planGeometry.ts` |
| Nothing structural beyond walls and openings; no column, beam or load-bearing concept anywhere in `src/` | — |
| Element drawing is one tool class keyed by tool id | `ElementTool.ts`, `ELEMENT_TOOLS` in `elements/elementDraft.ts` |
| Every creation route is one catalogue entry the mapped type forces | `ENTRIES_BY_ID` in `add/creationCatalogue.ts` |
| Wall centre lines and element geometry are already snap candidates | `snapping/roomSnapCandidates.ts` |
| Elements are deleted through exactly two doors | `elementActions.remove` (one) and `spatialRemoval` (many); `deleteItems` sends a walls-and-openings-only selection to `structureActions`, which never holds an element |
| Every element already carries existing condition and planned change | `ExistingFacts`, `PlannedFacts` in `src/domain/renovation/Renovation.ts`; `StructureRenovationEntry` in the element inspector |

## 2. Decisions taken in brainstorming

| Question | Decision |
| --- | --- |
| What to represent | **Posts and beams.** No wall-level "timber frame / load-bearing" property. |
| Deleting a load-bearing element | **Load-bearing switch plus a warning.** Default on; delete stays possible and undoable; the confirmation names the load-bearing items. No lock. |
| Model | **Two new `SpatialElementKind`s, `post` and `beam`.** A flag on `object`/`path` was refused (one kind meaning two things, no own symbol or defaults); separate `Structure.columns`/`beams` lists were refused (a parallel path through validation, clipboard, groups, move, removal and renovation for the same behaviour). |
| Posts and walls | **Independent.** A post is never hosted by a wall. It snaps to a wall's centre line when drawn. |
| Exposed frame | **No field.** A planned change on the wall (`remove`) and on the beam (`modify`, description) in the existing renovation model. |
| Round posts | Not now (§8). |

## 3. Domain model

`src/domain/spatial/SpatialElement.ts`:

```ts
export type SpatialElementKind = 'object' | 'path' | 'fence' | 'measurement' | 'stair' | 'arrow' | 'asset' | 'post' | 'beam';
export interface SpatialElement {
	// … existing members
	/** A beam's width across its axis, world mm. Only a `'beam'` carries one, and it always does. */
	readonly width?: number;
	/** Only `'post'` and `'beam'` carry one, and both always do. */
	readonly loadBearing?: boolean;
}
```

- **Post.** `points` is a closed outline, like `object`: four corners of the cross-section. Width and
  depth are derived from the outline, never stored beside it. Rotation and move come from the
  existing object machinery.
- **Beam.** `points` is exactly two distinct points, the axis. `width` is a finite number `> 0`.
- **`validSpatialElement`** adds:
  - `post`: at least three points (the outline must not cross itself — `acceptsElementPoints`
    already applies `areaOutline` to `object`, and applies it to `post` too), `loadBearing` is a
    boolean, `width` absent.
  - `beam`: two distinct points, `width` finite and `> 0`, `loadBearing` a boolean.
  - every other kind: `width` and `loadBearing` absent.
- Defaults for a new element live in the presentation draft, not the domain: post 140 × 140 mm,
  beam width 160 mm, `loadBearing: true`.

## 4. Persistence

`src/infrastructure/persistence/dto/planGeometry.ts`, following the v9 → v10 `labelOffset`
precedent:

- `SpatialElementShapeV11` extends the v10 element shape: `kind` enum gains `post` and `beam`;
  `width: z.number().positive().finite().optional()`; `loadBearing: z.boolean().optional()`.
- A `structuralRule` refine mirrors §3 (`beam` ⇔ `width` present; `post`/`beam` ⇔ `loadBearing`
  present).
- `PlanGeometrySchemaV11` (`schemaVersion: z.literal(11)`), added to the `PlanGeometrySchema`
  union and to `PlanGeometryDTO`'s version union. `PlanGeometryStore` validates the migrated
  document against V11.
- The migration v10 → v11 changes only `schemaVersion`: no v10 element can be a post or a beam.
- An older plugin build opening a v11 sidecar refuses it as it refuses any unknown version today.

Names stay in plan frontmatter `spatial-elements`, unchanged.

## 5. Drawing

**Add menu** (`add/creationCatalogue.ts`): two entries in the `structure` group, after `stair`:

| Entry | Tool | Synonyms (de) |
| --- | --- | --- |
| `post` | `place-post` | Pfosten, Ständer, Pfeiler, Säule, Stütze, Fachwerk |
| `beam` | `draw-beam` | Unterzug, Deckenbalken, Träger, Balken, Fachwerk |

Each gets a Lucide icon in `CREATION_ICONS` and `editor.add.<id>.label` / `.description` /
`.synonyms` keys in both locales. `ToolId` and `ELEMENT_TOOLS` gain the two ids.

**Post tool.** One primary click places a post whose centre is the snapped cursor, with the
width and depth from the task form (defaults §3), and saves it. The tool stays active so posts can
be set one after another along a wall. No vertex handles on a selected post (`hasPointHandles`
answers `false`): dragging one corner would skew a cross-section; size changes go through the edit
form.

**Beam tool.** Two clicks define the axis and save; the width comes from the task form. A selected
beam keeps its two point handles.

**Snapping.** Both tools already snap through `snapPointWithGuides` against `roomSnapCandidates`,
which includes wall centre lines. `collectElement` closes a `post` outline the way it closes an
`object` one.

## 6. Rendering and inspector

**Canvas** (`elements/ElementShapes.vue`, architecture layer; theme tokens only, no literal colour):

- **Post:** rectangle with both diagonals. Load-bearing: filled with the stroke token. Not
  load-bearing: outline only.
- **Beam:** two parallel dashed lines `width` apart along the axis — dashed is the plan convention
  for "above the cut plane". Load-bearing: heavier stroke.
- Selection, name label and body move behave as for every element.

**Inspector** (`elements/ElementInspector.vue`):

- Subline: post "Post · 14 × 14 cm", beam "Beam · 4.20 m · 16 cm wide" (localised, through
  `zoneTypeLabel`, `formatMetres`).
- A **Load-bearing** switch, shown for `post` and `beam` in the plan perspective. It writes
  through the same guarded path as edit and move (`elementActions`, `renovation.command` with
  `elementInput`), so it is undoable and stale-refused like them.
- **Edit** opens a form with centre, width and depth for a post (the new outline keeps the post's
  current rotation), and both points plus width for a beam. `elementEditPresentation`'s dispatch value widens to include `width` and `loadBearing`.

## 7. Deletion and renovation

**Warning.** A pure function names the load-bearing elements among the ids being removed. Both
deletion doors append one localised sentence to their confirmation when that list is not empty,
for example: *"Load-bearing: Post 3, Kitchen beam. Remove only after a structural check."*

- `elementActions.remove` — the single-element confirmation (`editor.element.delete-impact`).
- `spatialRemoval.approve` — the multi-item confirmation.

Deletion stays possible and undoable. Each door gets a test that fails without the sentence.

**Renovation.** No new fields. Posts and beams get `StructureRenovationEntry` like every element:
an existing condition ("investigate: woodworm") and a planned change ("modify: expose and sand").
The detail-kind vocabulary is unchanged.

## 8. Out of scope, each with its trigger

- **Round posts** (diameter): when a user draws a round column and a square one misrepresents it.
- **Braces and rails:** not visible in plan; they arrive with an elevation or wall view, if ever.
- **Warning when a wall holding posts is planned for removal:** posts stay drawn, so nothing is
  hidden; add when it is missed in practice.
- **Timber species, section class, structural calculation:** the renovation description carries
  free text; structural engineering is out of scope in the PRD.
- **Wall-level load-bearing flag:** refused in brainstorming (§2).

## 9. Testing

- **Domain (node):** `validSpatialElement` for both kinds, every refused field combination, and
  `width`/`loadBearing` refused on other kinds.
- **Schema:** a v11 sidecar with posts and beams parses; a v10 sidecar still parses and migrates;
  the structural refine refuses a beam without width and an object with `loadBearing`.
- **Tools:** a click places a post centred on the snapped point with the form's size; two clicks
  save a beam; a post outline contributes its closing edge to snap candidates.
- **Rendering (jsdom):** load-bearing versus not for both kinds; beam drawn dashed at `width`.
- **Inspector:** the switch dispatches, undoes, and is stale-refused; the edit form carries the
  dimensions.
- **Deletion:** the warning sentence at both doors, watched red without it.
- **Catalogue:** both entries resolve and activate their tools; locale keys exist in en and de.
- **Visual:** a harness capture of a plan with a timber-frame wall, posts and beams, in both
  schemes and at sidebar width.
- **Manual:** a case under `docs/tests/cases/`, marked not run until walked in a vault.
