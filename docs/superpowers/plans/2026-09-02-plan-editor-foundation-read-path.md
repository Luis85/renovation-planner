# Plan Editor Foundation, Increment 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Plan Editor its homeowner-facing read path: Select as the default, a truthful floor summary and room list, one stable identity across canvas, list and Inspector, a Room Inspector that marks unbuilt sections unavailable, an Add menu whose only enabled entry routes to the existing draw tool, and a shell that survives a narrow leaf — with WP0's two ADRs and consolidation report written first and no new vault write anywhere.

**Architecture:** Presentation-layer read models (`SpatialRecordDto`, `FloorDto`, `FloorSummaryDto`, `RoomOverviewDto`) project the existing `ZoneDto`/`PlanDto` into Room and Floor vocabulary; the application layer keeps speaking Zone and Plan. A `ResizeObserver` writes `layoutMode` into `WorkspaceStore` and the shell rearranges panels around one canvas instance that is never remounted. One resolver decides what a click or hover targets; one function decides what Escape does; one catalogue decides what Add offers.

**Tech Stack:** TypeScript, Vue 3 + Pinia, Konva via vue-konva, Obsidian 1.13.0 API, vitest + jsdom + axe-core, ESLint + oxlint, lightningcss-checked stylesheets.

**Spec:** [`docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md`](../specs/2026-09-02-plan-editor-foundation-read-path-design.md)

## Global Constraints

- **`npm run check` must pass before every commit** (build + oxlint + ESLint + `test:coverage` + fallow). CI runs the identical command on Ubuntu 22/24/26 and Windows 22.
- **Layer bans are lint rules.** `presentation → application → domain → core`; only `src/plugin/` composes. `core/`, `domain/`, `application/` never name `vue`, `pinia`, `konva`, `vue-konva` or `obsidian`.
- **Nothing writes to the vault outside `infrastructure/`**; this increment adds NO write at all.
- **No user-facing string literal.** Every string is a key in **both** `src/presentation/i18n/locales/en.ts` and `de.ts`, added in the same edit. German addresses the user formally (Sie) and calls an asset `Objekt`. `tests/presentation/i18n/strings.test.ts` fails on a key German lacks.
- **Sentence-case UI text** in `en.ts` (linted). **No colour literal in `styles/`** — Obsidian variables only. **`max-lines` is 400** for every `src/**` file and every `styles/*.css` partial.
- **`I18N_LITERAL_BAN`** refuses a literal in `.setText`, `text:` options, `addCommand` names and ribbon titles; **`NOTICE_TEXT_BAN`** refuses raw error text in notices.
- **Coverage floors are 99/99/99/98** and the branch headroom is about one unit. Every new arm ships with the test that reaches it, in the same task.
- **A test is watched failing before the code that makes it pass**, and where a task says "mutation-check", the mutation is applied, the suite run, and the red observed before reverting.
- **No control that does nothing.** An unavailable capability is rendered as text with a reason, never as a `<button>`.
- **`vue-tsc` type-checks `tests/**`.** A fake that stops satisfying a widened interface fails `npm run build`; widen the fake in the same task.
- **Component-library ownership rules** (spec §5): the shell owns layout only; shapes emit intents; selection lives in the selection store; panel state lives in `WorkspaceStore`; save/stale state is orthogonal.

## Prerequisite check before Task 1

```bash
git branch --show-current            # expect: claude/plan-editor-foundation-read-path
git log --oneline -1                 # expect: cc62a67c docs: design spec ... (or a descendant)
ls docs/development/adrs | tail -2   # expect: 0013-... is the newest on main; asset-designer adds 0014/0015 on its branch
grep -n "getProject" src/presentation/read-models/planEditorQueries.ts   # expect: no matches
```

If `0014` or `0015` already exist on this branch, the asset-designer branch has merged: number the new ADRs 0016 and 0017 as this plan says. If they do not exist yet, STILL number them 0016 and 0017 — the numbers are reserved for that branch and reusing them would collide at the merge.

## File Structure

**Wave 0 — documents and one test (no `src/` change)**

| File | Responsibility |
|---|---|
| `docs/development/adrs/0016-a-room-classified-zone-presents-as-room.md` | ADR-RZ: Room is a presentation projection over `Zone` |
| `docs/development/adrs/0017-plan-presents-as-floor.md` | ADR-PF: Plan is the persisted concept, Floor its name |
| `tests/infrastructure/persistence/editorRoundTrip.test.ts` | the round-trip instrument the report cites |
| `docs/development/consolidation/2026-09-editor-model-consolidation.md` | inventory, mapping matrix, round-trip matrix, gap register, deferred ADRs |

**Wave 1 — read models and stores**

| File | Responsibility |
|---|---|
| `src/presentation/read-models/planEditorQueries.ts` | gains `getProject` |
| `src/presentation/stores/ProjectStore.ts` | hydrates `project` |
| `src/presentation/read-models/spatialRecords.ts` | `SpatialRecordDto`, `FloorDto`, `Aggregate`, `FloorSummaryDto` and their builders |
| `src/presentation/read-models/roomOverview.ts` | `INSPECTOR_SECTIONS`, `RoomOverviewDto`, `buildRoomOverview` |
| `src/presentation/editor/shell/layoutMode.ts` | `layoutModeFor(width)` and the two thresholds |
| `src/presentation/stores/WorkspaceStore.ts` | `layoutMode`, `overlay`, their actions |

**Wave 2 — selection, default tool, shell regions**

| File | Responsibility |
|---|---|
| `src/presentation/editor/tools/editor-tool.ts` | `hasDraft()` on `EditorTool` |
| `src/presentation/editor/tools/draw-polygon-tool.ts` | `hasDraft`, `onCompleted` dep |
| `src/presentation/editor/tools/select-tool.ts` | uses the resolver; writes hover |
| `src/presentation/editor/tools/calibrate-tool.ts` | `hasDraft` |
| `src/presentation/editor/selection/resolveSelectionTarget.ts` | the one hit-test priority |
| `src/presentation/editor/escapeRouting.ts` | `routeEscape` |
| `src/presentation/editor/runtime.ts` | select-as-default, `selectAndFrame`, gone-selection retirement, `returnToSelect` |
| gesture surface (`PlanCanvas.vue` on `main`; `surface/EditorSurface.vue` after Task 5) | Escape calls `routeEscape`; cursor class from hover |
| `src/presentation/editor/layers/InteractionLayer.vue` | hover outline |
| `src/presentation/editor/shell/EditorContextBar.vue` | breadcrumb, undo, redo |
| `src/presentation/editor/shell/FloatingPrimaryActions.vue` | Select, Add |
| `src/presentation/editor/layers/layerCatalogue.ts` | the two layer entries and their state |
| `src/presentation/editor/shell/LayerList.vue`, `PropertyLayerPanel.vue` | replaces `LayersPanel.vue` |
| `src/presentation/editor/shell/EntityInspector.vue`, `FloorInspector.vue`, `RoomSummaryList.vue` | the frame and the floor state |
| `src/presentation/editor/shell/RoomInspector.vue`, `HomeownerQuestionNav.vue`, `LinkedContentList.vue` | replaces `InspectorPanel.vue` |
| `styles/editor-shell.css`, `styles/editor-inspector.css` | new partials; `editor.css` is at 353 of 400 lines |

**Wave 3 — Add, banner, responsive shell, warnings**

| File | Responsibility |
|---|---|
| `src/presentation/editor/add/creationCatalogue.ts`, `AddMenu.vue` | the catalogue and its menu |
| `src/presentation/editor/shell/TemporaryToolBanner.vue` | active-task banner |
| `src/presentation/editor/shell/ResponsiveEditorShell.vue`, `PanelRail.vue`, `OverlayPanel.vue`, `InspectorDrawer.vue`, `UnsupportedWidthNotice.vue` | layout modes |
| `src/presentation/editor/shell/warnings.ts`, `PersistentWarningStrip.vue` | keyed warnings |
| `src/presentation/editor/PlanEditorContext.ts`, `src/presentation/views/PlanEditorView.ts` | `focusLeaf` |
| `src/presentation/editor/shell/StatusBar.vue` | scale state, pan hint, compact form |

**Wave 4 — instruments and records**

| File | Responsibility |
|---|---|
| `tests/harness/page.ts`, `tests/harness/planEditor.ts`, `scripts/harness-shot.mjs` | `?select=`, `?add`, three fixed shots |
| `tests/harness/accessibility.test.ts` | six new cases |
| `docs/tests/cases/Open a floor and select a room.md`, `docs/tests/cases/Canvas Navigation.md` | manual cases |
| `docs/requirements/*.md`, `docs/tasks/*.md` under Editor foundation | statuses |
| `CLAUDE.md` | the increment's section |

---

# Wave 0 — the consolidation gate (on `main`, no `src/` change)

### Task 1: ADR-0016 — a room-classified Zone presents as Room

**Files:**
- Create: `docs/development/adrs/0016-a-room-classified-zone-presents-as-room.md`

**Interfaces:**
- Produces: the decision Task 7's `toSpatialRecordDto` implements (`kind: 'room'` iff `zoneType === 'Room'`, every other type `'area'`).

- [ ] **Step 1: Read the two inputs**

Read `docs/development/adrs/0013-a-project-folder-is-derived-from-its-note.md` for the frontmatter and section shape (`adr`, `title`, `status`, `date`, `area`; sections Context, Decision, Alternatives, Consequences, Revisit when, References). Read `src/domain/zone/ZoneType.ts` (seven types, `Room` among them) and `src/domain/zone/Zone.ts` lines 13–23 (`CreateZoneProps`, including `domainNoteLink`).

- [ ] **Step 2: Write the ADR**

```markdown
---
adr: 16
title: A Room-Classified Zone Presents as Room
status: Accepted
date: 2026-09-02
area: presentation
---

# ADR-0016: A Room-Classified Zone Presents as Room

## Context

The locked editor screens (M00–M17) speak of Rooms, Areas and Floors. The implemented and
persisted model speaks of `Zone` (seven `ZoneType`s, `Room` among them) and `Plan`. Every
zone note in every vault carries `zone-type: room` (or another type) and a stable `id`, and
its geometry sits under that same id in the plan's `.rpgeo` sidecar. The first editor
increment needs to say "Room" to the user without rewriting that data or splitting its
identity.

## Decision

**Room is a presentation-layer projection of a `Zone` whose `zoneType` is `Room`. Every
other `ZoneType` projects as an Area.** The projection is `toSpatialRecordDto` in
`src/presentation/read-models/spatialRecords.ts`; it carries the `ZoneId` unchanged as the
record's `id`, derives area from geometry, and adds a `kind` of `'room' | 'area'`.

Nothing below `presentation/` changes: no entity rename, no frontmatter key, no schema
version, no persistence discriminator. The application layer keeps its Zone-speaking
commands and queries. A homeowner label is never written to a note.

## Alternatives

- **Rename `Zone` to `Room` throughout.** Touches every layer, every test and every vault
  note for a change in vocabulary, and it is wrong for Gardens and Terraces, which are zones
  and not rooms.
- **A separate `Room` entity linked to zone geometry.** Two identities for one spatial
  thing, a join nothing needs yet, and a migration for a vault that gains no field.
- **`kind` persisted on the note.** A homeowner label as a storage discriminator, derivable
  from `zone-type` already — a second source of truth for one fact.

## Consequences

- Canvas, list and Inspector share the `ZoneId`; the user reads "Room" or "Area".
- Rooms and Areas are listed separately in the floor summary; both are zones on the canvas.
- Type labels are locale keys (`editor.zone-type.<type>`), so the seven types read as
  Room, Garden, Terrace, Driveway, Roof, Construction area, Other.
- `Zone.domainNoteLink` is on the entity and absent from the v1 DTO and mapper; this ADR
  does not decide it, the consolidation report classifies it.

## Revisit when

A Room needs a field or an invariant a Zone cannot carry without harming Areas (a ceiling
height, a wall list, an Existing/Planned state that Areas do not have). That is the trigger
for a `Room` entity, and it arrives with Feature B's wall model or Feature C's semantics,
not before.

## References

- `docs/user-experience/renovation-planner-editor-specs/Renovation Planner — First Vertical Slice Plan and Data-Model Specification.md` §4.5, §5.3
- `docs/superpowers/specs/2026-09-02-plan-editor-foundation-read-path-design.md` §2.1, §3
- ADR-0001 (Markdown metadata), ADR-0002 and ADR-0011 (geometry sidecar)
```

- [ ] **Step 3: Commit**

```bash
git add docs/development/adrs/0016-a-room-classified-zone-presents-as-room.md
git commit -m "docs(adr): a room-classified zone presents as Room, in presentation only"
```

### Task 2: ADR-0017 — Plan presents as Floor

**Files:**
- Create: `docs/development/adrs/0017-plan-presents-as-floor.md`

**Interfaces:**
- Produces: the decision Task 7's `toFloorDto` implements (a `FloorDto` is a `PlanDto` plus the project name).

- [ ] **Step 1: Write the ADR**

```markdown
---
adr: 17
title: Plan Presents as Floor
status: Accepted
date: 2026-09-02
area: presentation
---

# ADR-0017: Plan Presents as Floor

## Context

The locked screens show a `Willow House › Main House › Ground Floor` breadcrumb and a
Property tree. The implemented model has `Project` owning `Plan`s; there is no Property,
Building or Floor entity, and the vertical-slice specification asks whether `Plan.name` can
carry floor context in the first slice.

## Decision

**`Plan` remains the persisted concept. "Floor" is its homeowner name in copy.** A
`FloorDto` (`src/presentation/read-models/spatialRecords.ts`) is a `PlanDto` with the
project's name beside it, and the context bar reads `Project › Floor`. No `Floor`,
`Building` or `Property` entity, no persisted hierarchy, no `FloorId`.

## Alternatives

- **Introduce `Floor` now and make `Plan` depict one.** A second identity per plan, a join
  and a migration, for a hierarchy with exactly one level of content today.
- **A presentation-only Building grouping.** Nothing to group: every project in the field
  study has one building. A grouping of one is a label pretending to be structure.

## Consequences

- The breadcrumb has two segments and the Property tree is not built in this increment.
- `Plan.name` is what a user reads as the floor's name; "Ground floor" is the sample's.
- Deciding hierarchy (ADR-HI) is deferred with the trigger below, recorded in the
  consolidation report.

## Revisit when

A project has two buildings, or two plans must be aligned as floors of one building
(stairs, shafts, load-bearing walls through). Either is the trigger for a `Floor` identity.

## References

- Vertical-slice specification §4.5 (Property, Building, Floor rows), §5.6
- Design spec §2.2
- `docs/requirements/Navigate property, building and floor context in the editor.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/development/adrs/0017-plan-presents-as-floor.md
git commit -m "docs(adr): Plan presents as Floor; no Floor entity"
```

### Task 3: the round-trip contract test

**Files:**
- Create: `tests/infrastructure/persistence/editorRoundTrip.test.ts`

**Interfaces:**
- Consumes: `createRepositoryStack` (`tests/helpers/vault.ts`), `makeProject`/`makePlan`/`makeZone` (`tests/helpers/entities.ts`), `expectOk`/`expectFound` (`tests/helpers/domain.ts`), `parseFrontmatter` (`tests/helpers/vault.ts`).
- Produces: the measured field list the report's round-trip matrix cites.

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../helpers/vault';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { createPolygon } from '../../../src/core/geometry/Polygon';

/**
 * WP0's round-trip instrument (design spec §2.5): a Project, a Plan and a Room-classified
 * Zone go entity → mapper → note + sidecar → mapper → entity through the REAL mappers and
 * repositories over the in-memory vault, and every field the first editor increment reads
 * comes back. The consolidation report cites this file; this file cites nothing.
 *
 * A user-authored body is written UNDER the frontmatter and asserted to survive a save,
 * because "the free-form body remains user-owned" is a rule the mappers cannot see.
 */
describe('editor round trip: Project, Plan and a Room-classified Zone', () => {
	async function seed() {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		const zoneId = createZoneId();
		expectOk(await stack.projects.save(makeProject({ id: projectId, name: 'Willow House' }), 'absent'));
		expectOk(await stack.plans.save(makePlan({ id: planId, projectId, name: 'Ground floor' }), 'absent'));
		const geometry = expectOk(
			createPolygon([
				{ x: 0, y: 0 },
				{ x: 4200, y: 0 },
				{ x: 4200, y: 3600 },
				{ x: 0, y: 3600 },
			]),
		);
		expectOk(
			await stack.zones.save(
				makeZone({ id: zoneId, projectId, planId, name: 'Kitchen', zoneType: 'Room', geometry }),
				'absent',
			),
		);
		return { stack, projectId, planId, zoneId };
	}

	it('reads back the project fields the context bar shows', async () => {
		const { stack, projectId } = await seed();
		const read = expectFound(await stack.projects.getById(projectId));
		expect(read.entity.id).toBe(projectId);
		expect(read.entity.name).toBe('Willow House');
		expect(read.entity.currency).toBe('EUR');
		expect(read.version.revision).toBe(1);
	});

	it('reads back the plan fields the floor summary shows', async () => {
		const { stack, planId, projectId } = await seed();
		const read = expectFound(await stack.plans.getById(planId));
		expect(read.entity.id).toBe(planId);
		expect(read.entity.projectId).toBe(projectId);
		expect(read.entity.name).toBe('Ground floor');
		expect(read.entity.background).toBeNull();
		expect(read.entity.calibration).toBeNull();
	});

	it('reads back the zone as one logical record: note fields plus sidecar geometry', async () => {
		const { stack, zoneId, planId, projectId } = await seed();
		const read = expectFound(await stack.zones.getById(zoneId));
		expect(read.entity.id).toBe(zoneId);
		expect(read.entity.planId).toBe(planId);
		expect(read.entity.projectId).toBe(projectId);
		expect(read.entity.name).toBe('Kitchen');
		expect(read.entity.zoneType).toBe('Room');
		expect(read.entity.status).toBe('Planned');
		expect(read.entity.geometry.points).toEqual([
			{ x: 0, y: 0 },
			{ x: 4200, y: 0 },
			{ x: 4200, y: 3600 },
			{ x: 0, y: 3600 },
		]);
		// Area is DERIVED, never stored: 4.2 m × 3.6 m in mm².
		expect(expectOk(read.entity.area())).toBe(15_120_000);
	});

	it('persists the zone note with the v1 keys the spec names, and nothing homeowner-facing', async () => {
		const { stack, zoneId } = await seed();
		const path = stack.index.getPath(zoneId as never);
		if (path === undefined) throw new Error('zone note not indexed');
		const frontmatter = parseFrontmatter(await stack.vault.read(stack.vault.getFileByPath(path) as never));
		expect(frontmatter['type']).toBe('renovation-zone');
		expect(frontmatter['schema-version']).toBe(1);
		expect(frontmatter['id']).toBe(zoneId);
		expect(frontmatter['zone-type']).toBe('Room');
		expect(frontmatter['name']).toBe('Kitchen');
		expect(Object.keys(frontmatter)).not.toContain('kind');
		expect(Object.keys(frontmatter)).not.toContain('room');
	});

	it('keeps a user-authored body across a plugin save', async () => {
		const { stack, zoneId, projectId, planId } = await seed();
		const path = stack.index.getPath(zoneId as never);
		if (path === undefined) throw new Error('zone note not indexed');
		const file = stack.vault.getFileByPath(path) as never;
		const before = await stack.vault.read(file);
		await stack.vault.modify(file, `${before}\nThe kitchen faces north.\n`);

		const read = expectFound(await stack.zones.getById(zoneId));
		expectOk(
			await stack.zones.save(
				makeZone({ id: zoneId, projectId, planId, name: 'Kitchen (renamed)', zoneType: 'Room', geometry: read.entity.geometry }),
				read.version,
			),
		);
		const after = await stack.vault.read(file);
		expect(after).toContain('The kitchen faces north.');
		expect(parseFrontmatter(after)['name']).toBe('Kitchen (renamed)');
	});
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/infrastructure/persistence/editorRoundTrip.test.ts`
Expected: PASS on all five. If `getFileByPath` or `parseFrontmatter`'s argument shape differs from the helper's actual signature, read `tests/helpers/vault.ts` and adjust the call — the assertions are the contract, the helper spelling is not. If the body case FAILS, that is a finding for the report (Task 4), not a reason to weaken the assertion: record it in the gap register as a defect and leave the test red-marked with `it.fails` plus a comment naming the report.

- [ ] **Step 3: Run the whole check**

Run: `npm run check`
Expected: green (the new file adds a test and no source).

- [ ] **Step 4: Commit**

```bash
git add tests/infrastructure/persistence/editorRoundTrip.test.ts
git commit -m "test(persistence): the editor's first-slice round trip, measured"
```

### Task 4: the consolidation report

**Files:**
- Create: `docs/development/consolidation/2026-09-editor-model-consolidation.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: the deferred-ADR list Task 25 links from the PBI.

- [ ] **Step 1: Measure the inventory from the tree, not from memory**

Run each and paste the answers into the report's tables:

```bash
git rev-parse --short HEAD
ls src/domain/project src/domain/plan src/domain/zone src/domain/asset src/domain/requirement
ls src/infrastructure/persistence/dto src/infrastructure/persistence/mappers src/infrastructure/obsidian/repositories
ls src/application/commands/zone src/application/commands/plan src/application/queries
grep -n "^\s*'\?[a-z-]*'\?:" src/infrastructure/persistence/dto/zoneFrontmatter.ts src/infrastructure/persistence/dto/planFrontmatter.ts src/infrastructure/persistence/dto/projectFrontmatter.ts
grep -n "domainNoteLink" -r src/
```

- [ ] **Step 2: Write the report**

Sections, each filled from Step 1's output (no placeholder may remain):

```markdown
# Editor model consolidation (WP0)

**Baseline:** `main` at `<sha from step 1>`, inspected 2026-09-02.
**Instrument:** `tests/infrastructure/persistence/editorRoundTrip.test.ts`.
**Decisions:** ADR-0016 (Room/Zone), ADR-0017 (Plan/Floor). Five ADRs deferred (§6).

## 1. Inventory
| Layer | Item | File | Editor role |
(one row per file listed in step 1: entity, value object, DTO, mapper, repository, query,
command, event — with a one-clause "editor role", e.g. "read by FindZonesByPlan → ZoneDto")

## 2. Mapping matrix
| Homeowner term | Read model (presentation) | Domain | Persisted key(s) | Classification |
| Renovation project | ProjectSummaryDto | Project | project note: type, id, name, status, currency | retain |
| Floor | FloorDto (ADR-0017) | Plan | plan note: type, id, project, name, background, layers; sidecar: calibration | adapt |
| Room | SpatialRecordDto kind=room (ADR-0016) | Zone (zoneType Room) | zone note: id, project, plan, name, zone-type, status; sidecar entry by id | adapt |
| Area | SpatialRecordDto kind=area | Zone (other types) | same | adapt |
| Existing state | — | — | — | gap, ADR-EPW deferred |
| Planned state | — (NOT ZoneStatus) | — | — | conflict recorded: ZoneStatus is progress |
| Work | — | — | — | gap |
| Material | RequirementInspectorDTO | Asset + Requirement | asset note, requirement note | partial equivalence |
| Cost | Requirement.estimatedCost | Requirement | requirement note | partial; never floor-aggregated here |
| Documents / photos / notes | — | — | — | gap |

## 3. Round-trip matrix
(one row per field the test asserts: field, canonical store, schema version, test case name)

## 4. Gap register
| # | Finding | Severity | Affected data | Classification |
| 1 | `Zone.domainNoteLink` exists on the entity, absent from v1 DTO and mapper | low | none today | intentional-until-used; decide with ADR-RL |
| 2 | Sidecar entries carry only id/type/points; no subtype/layer/state | low | all plans | extend later; ADR-SO |
| 3 | `ZoneStatus` (Planned/InProgress/Complete) is a progress axis | high if misused | all zones | never presented as Existing/Planned; ADR-EPW |
| 4 | Project note persists no budget/contingency/location | low | all projects | out of scope |
(add any finding Task 3 produced)

## 5. Compatibility decision
No schema version moves. Every fixture under `tests/vault/` and `tests/fixtures/` is
preserved unchanged. No migration step is registered. The migration-contract task is
discharged for this increment by this paragraph and by the round-trip instrument.

## 6. Deferred ADRs, with triggers
| ADR | Question | First consumer | Trigger |
| HI | Property → Building → Floor persistence | Navigate PBI | two buildings, or floor alignment (ADR-0017) |
| EPW | Existing / Planned / Work representation | Feature C | the first Existing or Planned record |
| SO | polygon-only sidecar → walls/openings | Feature B walls | the first non-polygon spatial object |
| RL | one relationship mechanism spatial ↔ vault records | Feature C/D | the first Work item or evidence link |
| SV | additive change at v1 vs version bump | first key that moves or changes meaning | see CLAUDE.md's "still empty BY A DECISION" |
```

- [ ] **Step 3: Self-check the report**

`grep -n "TBD\|TODO\|<sha" docs/development/consolidation/2026-09-editor-model-consolidation.md` must print nothing. Every file named in §1 must exist: `for f in $(grep -o 'src/[^ |`]*\.ts' <report>); do test -f "$f" || echo MISSING $f; done`.

- [ ] **Step 4: Commit**

```bash
git add docs/development/consolidation/2026-09-editor-model-consolidation.md
git commit -m "docs: WP0 consolidation report — inventory, mapping, round trip, deferred ADRs"
```

### Task 5: the rebase gate (orchestrator, not a subagent)

- [ ] **Step 1: Check whether the asset-designer branch has landed**

```bash
git fetch origin
git log --oneline origin/main | grep -c "asset designer\|Asset Designer\|designer's" 
git ls-tree origin/main --name-only src/presentation/editor/surface/ 2>/dev/null
```

Expected when landed: `EditorSurface.vue` is listed. If it is NOT listed: **STOP.** Report to the user that Wave 0 is complete and committed, that Wave 1 onward builds on files the asset-designer branch moves, and ask whether to wait, to branch from the asset-designer branch, or to proceed against `main` and absorb the conflict later. Do not proceed on your own.

- [ ] **Step 2: Merge main**

```bash
git merge origin/main
npm run check
```

Expected: no conflicts (Wave 0 touched no `src/` file the other branch touched) and a green check.

- [ ] **Step 3: Record the file-name substitution for Waves 2–3**

After the merge the gesture surface is `src/presentation/editor/surface/EditorSurface.vue` and `PlanCanvas.vue` is a thin host. Every later task that says "the gesture surface" means `EditorSurface.vue`. Confirm: `grep -n "function onKeyDown" src/presentation/editor/surface/EditorSurface.vue src/presentation/editor/PlanCanvas.vue` prints exactly one match and note which file. Also confirm `grep -n "cursorClass" src/presentation/editor/surface/EditorSurface.vue`.

- [ ] **Step 4: Commit the merge if it was not fast-forward** — `git log --oneline -1` shows a merge commit or the fast-forwarded head.

---

# Wave 1 — read models and stores

### Task 6: `getProject` on the editor's query services, and a hydrated project

**Files:**
- Modify: `src/presentation/read-models/planEditorQueries.ts`
- Modify: `src/presentation/stores/ProjectStore.ts` (the `hydrate` function, ~line 120)
- Modify: `src/plugin/composition-root.ts` (~line 424: `createPlanEditorQueries({...})` already spreads `guarded.queries`, which carries `getProject` — verify with `grep -n "getProject" src/plugin/guardedServices.ts`)
- Modify: `tests/helpers/planFixtures.ts` (`fakeQueries`), `tests/harness/planEditor.ts` (`harnessDeps().queries`)
- Test: `tests/presentation/stores/stores.test.ts` (add cases) and `tests/presentation/read-models/planEditorQueries.test.ts` (create if absent; check `ls tests/presentation/read-models`)

**Interfaces:**
- Produces: `PlanEditorQueryServices.getProject(projectId: string): Promise<Result<ProjectSummaryDto | null, RepositoryError>>`; `ProjectStore.project` is non-null once `status === 'ready'`.
- Consumes: `GetProject` (`src/application/queries/GetProject.ts`, input `{ projectId: ProjectId }`, answers `Result<Loaded<Project> | null, RepositoryError>`), `toProjectSummaryDto(project, libraryOverlap)` (`PlanDto.ts`).

- [ ] **Step 1: Write the failing store test**

In `tests/presentation/stores/stores.test.ts`, inside the existing project-store `describe` (read the file's mount pattern first — it creates a Pinia and calls `useProjectStore()`), add:

```ts
it('hydrates the project beside the plan, so the context bar can name it', async () => {
	const store = useProjectStore();
	await store.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
	expect(store.status).toBe('ready');
	expect(store.project?.id).toBe(FIXTURE_PLAN.projectId);
	expect(store.project?.name).toBe('Willow House');
});

it('fails the hydration when the project read fails, like a failed plan read', async () => {
	const store = useProjectStore();
	const queries = {
		...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
		getProject: () => Promise.resolve(err({ category: 'Persistence', code: 'project.read-failed', message: 'boom' } as const)),
	};
	await store.hydrate(queries, FIXTURE_PLAN.id);
	expect(store.status).toBe('failed');
	expect(store.error?.code).toBe('project.read-failed');
});

it('treats a project that no longer resolves as a missing plan', async () => {
	const store = useProjectStore();
	const queries = { ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getProject: () => Promise.resolve(ok(null)) };
	await store.hydrate(queries, FIXTURE_PLAN.id);
	expect(store.status).toBe('missing');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/presentation/stores/stores.test.ts`
Expected: FAIL — `getProject` is not a member, `project` stays `null`.

- [ ] **Step 3: Widen the query services**

In `planEditorQueries.ts`, add to `PlanEditorQueryServices`:

```ts
	/**
	 * The project a plan belongs to, for the context bar's breadcrumb and the floor summary.
	 * Same `Result` shape as `getPlan`: `ok(null)` is "no such project", `isErr` a failed read.
	 * `libraryOverlap` is `false` here — the editor draws no overlap marker and the flag is a
	 * fact about the project LIST's read, not about a plan's.
	 */
	getProject(projectId: string): Promise<Result<ProjectSummaryDto | null, RepositoryError>>;
```

Add `getProject: refuseUnrecovered,` to `unavailablePlanEditorQueries()`. Widen `createPlanEditorQueries`' parameter with `readonly getProject: Query<GetProjectInput, Result<Loaded<ProjectEntity> | null, RepositoryError>>;` (import `GetProjectInput` from `../../application/queries/GetProject`, `Project as ProjectEntity` from `../../domain/project/Project`, `ProjectId` from `../../domain/project/ProjectId`, `toProjectSummaryDto` and `ProjectSummaryDto` from `./PlanDto`), and implement:

```ts
		async getProject(projectId) {
			const found = await queries.getProject.execute({ projectId: projectId as ProjectId });
			if (isErr(found)) return found;
			return ok(found.value === null ? null : toProjectSummaryDto(found.value.entity, false));
		},
```

- [ ] **Step 4: Hydrate the project**

In `ProjectStore.hydrate`, after the `foundPlan.value === null` branch and before `findZonesByPlan`, insert:

```ts
		const foundProject = await queries.getProject(foundPlan.value.projectId);
		if (superseded()) return;
		if (isErr(foundProject)) {
			if (keepOnFailure && status.value === 'ready') {
				error.value = foundProject.error;
				stale.value = true;
				return;
			}
			return fail(foundProject.error);
		}
		if (foundProject.value === null) {
			// A plan whose project is gone is a plan nothing owns: the same dangling state as a
			// missing plan, drawn the same way. `GetPlan` cannot see this; only the project read can.
			plan.value = null;
			zones.value = new Map();
			unreadableZones.value = 0;
			status.value = 'missing';
			return;
		}
```

and at the success block set `project.value = foundProject.value;` beside `plan.value = foundPlan.value;`. Check that `fail()` and `reset()` already null `project` (line ~227 does).

- [ ] **Step 5: Widen the fixtures**

`tests/helpers/planFixtures.ts` — add a `FIXTURE_PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Willow House', status: 'Planning', currency: 'EUR', libraryOverlap: false }` (check `ProjectStatus` values with `grep -n "PROJECT_STATUSES\|ProjectStatus =" -A6 src/domain/project/*.ts` and use one that exists) and `getProject: () => Promise.resolve(ok(FIXTURE_PROJECT)),` in `fakeQueries`. `tests/harness/planEditor.ts` — add `HARNESS_PROJECT` the same way (`id: 'harness-project', name: 'Willow House'`) and `getProject: () => Promise.resolve(ok(structuredClone(HARNESS_PROJECT))),`.

- [ ] **Step 6: Build, then run the suites**

Run: `npm run build && npx vitest run tests/presentation/stores tests/presentation/editor/shell.test.ts tests/harness`
Expected: `vue-tsc` reports every other hand-written `PlanEditorQueryServices` literal in `tests/` that now lacks `getProject` — fix each by spreading `fakeQueries(...)` or adding the member; then green.

- [ ] **Step 7: Full check and commit**

```bash
npm run check
git add -A src/presentation/read-models/planEditorQueries.ts src/presentation/stores/ProjectStore.ts tests
git commit -m "feat(editor): the plan editor reads its project, so the shell can name it"
```

### Task 7: Room, Area and Floor read models

**Files:**
- Create: `src/presentation/read-models/spatialRecords.ts`
- Create: `src/presentation/read-models/roomOverview.ts`
- Test: `tests/presentation/read-models/spatialRecords.test.ts`, `tests/presentation/read-models/roomOverview.test.ts`

**Interfaces:**
- Consumes: `ZoneDto`, `PlanDto`, `ProjectSummaryDto` (`PlanDto.ts`); `area` (`src/core/geometry/operations.ts`, `area(polygon: Polygon): Result<number, GeometryError>`).
- Produces (exact, used by Tasks 16, 17, 20):

```ts
export type SpatialKind = 'room' | 'area';
export interface SpatialRecordDto { readonly kind: SpatialKind; readonly id: string; readonly planId: string; readonly name: string; readonly zoneType: string; readonly points: readonly Point[]; readonly areaMm2: number; }
export function toSpatialRecordDto(zone: ZoneDto): SpatialRecordDto;
export interface FloorDto { readonly id: string; readonly name: string; readonly projectId: string; readonly projectName: string; }
export function toFloorDto(plan: PlanDto, project: ProjectSummaryDto): FloorDto;
export type Aggregate<T> = { readonly state: 'available'; readonly value: T } | { readonly state: 'partial'; readonly value: T; readonly unreadable: number } | { readonly state: 'unavailable' };
export interface FloorSummaryDto { readonly floor: FloorDto; readonly roomCount: Aggregate<number>; readonly areaCount: Aggregate<number>; readonly totalAreaMm2: Aggregate<number>; readonly plannedChanges: Aggregate<number>; readonly estimatedCost: Aggregate<never>; readonly rooms: readonly SpatialRecordDto[]; readonly areas: readonly SpatialRecordDto[]; }
export function buildFloorSummary(input: { readonly plan: PlanDto; readonly project: ProjectSummaryDto; readonly zones: readonly ZoneDto[]; readonly unreadable: number }): FloorSummaryDto;
export const INSPECTOR_SECTIONS = ['existing', 'planned', 'work', 'costs', 'documents', 'photos', 'notes'] as const;
export type InspectorSection = (typeof INSPECTOR_SECTIONS)[number];
export interface RoomOverviewDto { readonly record: SpatialRecordDto; readonly floorName: string; readonly unavailableSections: readonly InspectorSection[]; }
export function buildRoomOverview(zone: ZoneDto, plan: PlanDto): RoomOverviewDto;
```

- [ ] **Step 1: Write the failing tests**

`tests/presentation/read-models/spatialRecords.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildFloorSummary, toFloorDto, toSpatialRecordDto } from '../../../src/presentation/read-models/spatialRecords';
import { FIXTURE_PLAN, FIXTURE_PROJECT, FIXTURE_ZONES } from '../../helpers/planFixtures';

const [kitchen, terrace] = FIXTURE_ZONES;

describe('toSpatialRecordDto', () => {
	it('keeps the ZoneId as the record id and calls a Room zone a room', () => {
		const record = toSpatialRecordDto(kitchen);
		expect(record.id).toBe(kitchen.id);
		expect(record.kind).toBe('room');
		expect(record.planId).toBe(kitchen.planId);
	});

	it('calls every other zone type an area', () => {
		expect(toSpatialRecordDto(terrace).kind).toBe('area');
		expect(toSpatialRecordDto({ ...terrace, zoneType: 'Custom' }).kind).toBe('area');
	});

	it('derives area from the points rather than reading a stored figure', () => {
		expect(toSpatialRecordDto(kitchen).areaMm2).toBe(12_000_000); // 4000 × 3000
	});

	it('answers 0 for a degenerate polygon rather than throwing', () => {
		expect(toSpatialRecordDto({ ...kitchen, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }).areaMm2).toBe(0);
	});
});

describe('toFloorDto', () => {
	it('is the plan under its homeowner name, beside its project', () => {
		const floor = toFloorDto(FIXTURE_PLAN, FIXTURE_PROJECT);
		expect(floor).toEqual({ id: FIXTURE_PLAN.id, name: FIXTURE_PLAN.name, projectId: FIXTURE_PROJECT.id, projectName: FIXTURE_PROJECT.name });
	});
});

describe('buildFloorSummary', () => {
	const input = { plan: FIXTURE_PLAN, project: FIXTURE_PROJECT, zones: FIXTURE_ZONES, unreadable: 0 };

	it('counts rooms and areas separately and sums their area', () => {
		const summary = buildFloorSummary(input);
		expect(summary.roomCount).toEqual({ state: 'available', value: 1 });
		expect(summary.areaCount).toEqual({ state: 'available', value: 1 });
		expect(summary.totalAreaMm2).toEqual({ state: 'available', value: 12_000_000 + 3_000_000 });
		expect(summary.rooms.map((r) => r.id)).toEqual([kitchen.id]);
		expect(summary.areas.map((a) => a.id)).toEqual([terrace.id]);
	});

	it('marks every count partial when some zones were unreadable, carrying the number', () => {
		const summary = buildFloorSummary({ ...input, unreadable: 2 });
		expect(summary.roomCount).toEqual({ state: 'partial', value: 1, unreadable: 2 });
		expect(summary.totalAreaMm2.state).toBe('partial');
	});

	it('never fabricates a planned-change count or a cost', () => {
		const summary = buildFloorSummary(input);
		expect(summary.plannedChanges).toEqual({ state: 'unavailable' });
		expect(summary.estimatedCost).toEqual({ state: 'unavailable' });
	});

	it('distinguishes a floor with no rooms from one whose rooms could not be read', () => {
		expect(buildFloorSummary({ ...input, zones: [], unreadable: 0 }).roomCount).toEqual({ state: 'available', value: 0 });
		expect(buildFloorSummary({ ...input, zones: [], unreadable: 3 }).roomCount).toEqual({ state: 'partial', value: 0, unreadable: 3 });
	});
});
```

`tests/presentation/read-models/roomOverview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { INSPECTOR_SECTIONS, buildRoomOverview } from '../../../src/presentation/read-models/roomOverview';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';

describe('buildRoomOverview', () => {
	it('carries the same id as the zone and the floor it sits on', () => {
		const overview = buildRoomOverview(FIXTURE_ZONES[0], FIXTURE_PLAN);
		expect(overview.record.id).toBe(FIXTURE_ZONES[0].id);
		expect(overview.floorName).toBe(FIXTURE_PLAN.name);
	});

	it('marks every future section unavailable in this increment — none is empty, none has a count', () => {
		const overview = buildRoomOverview(FIXTURE_ZONES[0], FIXTURE_PLAN);
		expect([...overview.unavailableSections]).toEqual([...INSPECTOR_SECTIONS]);
	});
});
```

- [ ] **Step 2: Run to see them fail** — `npx vitest run tests/presentation/read-models` → FAIL, modules missing.

- [ ] **Step 3: Implement `spatialRecords.ts`**

```ts
import type { Point } from '../../core/geometry/Point';
import { area } from '../../core/geometry/operations';
import type { PlanDto, ProjectSummaryDto, ZoneDto } from './PlanDto';

/**
 * The homeowner-facing projection of a zone (ADR-0016): a `Zone` typed `Room` is a Room,
 * every other type is an Area, and the id is the `ZoneId` unchanged. Area is DERIVED here
 * from the geometry the DTO already carries; it is never stored and never copied from a note.
 */
export type SpatialKind = 'room' | 'area';

export interface SpatialRecordDto {
	readonly kind: SpatialKind;
	readonly id: string;
	readonly planId: string;
	readonly name: string;
	readonly zoneType: string;
	/** World millimetres, straight from the `ZoneDto`. */
	readonly points: readonly Point[];
	readonly areaMm2: number;
}

export function toSpatialRecordDto(zone: ZoneDto): SpatialRecordDto {
	const measured = area({ points: zone.points });
	return {
		kind: zone.zoneType === 'Room' ? 'room' : 'area',
		id: zone.id,
		planId: zone.planId,
		name: zone.name,
		zoneType: zone.zoneType,
		points: zone.points,
		// A polygon Core refuses has no area; 0 is the honest figure and the canvas still draws
		// whatever points it has, which is `boundsOfZones`'s own rule for a degenerate zone.
		areaMm2: measured.ok ? measured.value : 0,
	};
}

/** The plan under its homeowner name (ADR-0017), beside the project that owns it. */
export interface FloorDto {
	readonly id: string;
	readonly name: string;
	readonly projectId: string;
	readonly projectName: string;
}

export function toFloorDto(plan: PlanDto, project: ProjectSummaryDto): FloorDto {
	return { id: plan.id, name: plan.name, projectId: project.id, projectName: project.name };
}

/**
 * A summary figure that says how much it knows. `partial` is a value over what was READ, with
 * the number of records that were not; `unavailable` is a capability this build does not have.
 * A component renders the three differently, and a `0` never stands in for either of the others.
 */
export type Aggregate<T> =
	| { readonly state: 'available'; readonly value: T }
	| { readonly state: 'partial'; readonly value: T; readonly unreadable: number }
	| { readonly state: 'unavailable' };

export interface FloorSummaryDto {
	readonly floor: FloorDto;
	readonly roomCount: Aggregate<number>;
	readonly areaCount: Aggregate<number>;
	readonly totalAreaMm2: Aggregate<number>;
	/** Always `unavailable` here: no Planned record exists (ADR-EPW deferred). */
	readonly plannedChanges: Aggregate<number>;
	/** Always `unavailable` here: no floor-level cost query exists, and the Inspector may not sum one. */
	readonly estimatedCost: Aggregate<never>;
	readonly rooms: readonly SpatialRecordDto[];
	readonly areas: readonly SpatialRecordDto[];
}

function counted(value: number, unreadable: number): Aggregate<number> {
	return unreadable > 0 ? { state: 'partial', value, unreadable } : { state: 'available', value };
}

export function buildFloorSummary(input: {
	readonly plan: PlanDto;
	readonly project: ProjectSummaryDto;
	readonly zones: readonly ZoneDto[];
	readonly unreadable: number;
}): FloorSummaryDto {
	const records = input.zones.map(toSpatialRecordDto);
	const rooms = records.filter((record) => record.kind === 'room');
	const areas = records.filter((record) => record.kind === 'area');
	const total = records.reduce((sum, record) => sum + record.areaMm2, 0);
	return {
		floor: toFloorDto(input.plan, input.project),
		roomCount: counted(rooms.length, input.unreadable),
		areaCount: counted(areas.length, input.unreadable),
		totalAreaMm2: counted(total, input.unreadable),
		plannedChanges: { state: 'unavailable' },
		estimatedCost: { state: 'unavailable' },
		rooms,
		areas,
	};
}
```

- [ ] **Step 4: Implement `roomOverview.ts`**

```ts
import type { PlanDto, ZoneDto } from './PlanDto';
import { toSpatialRecordDto, type SpatialRecordDto } from './spatialRecords';

/**
 * The Inspector sections the locked screens name and this build has no data for. A CLOSED
 * union rather than free text, so a section that gains a query is removed from
 * `buildRoomOverview`'s list in the same edit that builds it — and a typo is a compile error.
 * Requirements are not here: they have a query and a panel, so they are a supported section.
 */
export const INSPECTOR_SECTIONS = ['existing', 'planned', 'work', 'costs', 'documents', 'photos', 'notes'] as const;
export type InspectorSection = (typeof INSPECTOR_SECTIONS)[number];

export interface RoomOverviewDto {
	readonly record: SpatialRecordDto;
	readonly floorName: string;
	/** Which sections are UNAVAILABLE (no capability), as opposed to supported-and-empty. */
	readonly unavailableSections: readonly InspectorSection[];
}

export function buildRoomOverview(zone: ZoneDto, plan: PlanDto): RoomOverviewDto {
	return { record: toSpatialRecordDto(zone), floorName: plan.name, unavailableSections: INSPECTOR_SECTIONS };
}
```

- [ ] **Step 5: Run, check, commit**

```bash
npx vitest run tests/presentation/read-models
npm run check
git add src/presentation/read-models/spatialRecords.ts src/presentation/read-models/roomOverview.ts tests/presentation/read-models
git commit -m "feat(read-models): Room, Area and Floor projections over Zone and Plan (ADR-0016, ADR-0017)"
```

Note for the implementer: `npm run analyze` (fallow) reports a new file with no `src/` importer. Both modules gain importers in Wave 2 (Tasks 16, 17). If the gate is red on `unused-file` here, add the two paths to `.fallowrc.json`'s ignore list WITH a comment naming Task 16 and Task 17, and remove the entries in those tasks. Do not leave the entries behind.

### Task 8: layout mode and overlay state

**Files:**
- Create: `src/presentation/editor/shell/layoutMode.ts`
- Modify: `src/presentation/stores/WorkspaceStore.ts`
- Test: `tests/presentation/editor/shell/layoutMode.test.ts`, `tests/presentation/stores/stores.test.ts` (workspace `describe`)

**Interfaces:**
- Produces:

```ts
export type LayoutMode = 'full' | 'constrained' | 'unsupported';
export const FULL_MIN_PX = 900;
export const CONSTRAINED_MIN_PX = 400;
export function layoutModeFor(widthPx: number): LayoutMode;
// WorkspaceStore:
layoutMode: Ref<LayoutMode>;            // default 'full'
overlay: Ref<'none' | 'layers' | 'inspector'>;  // default 'none'
setLayoutMode(mode: LayoutMode): void;  // leaving 'constrained' closes any overlay
openOverlay(kind: 'layers' | 'inspector'): void;  // one at a time
closeOverlay(): void;
```

- [ ] **Step 1: Failing tests**

`tests/presentation/editor/shell/layoutMode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONSTRAINED_MIN_PX, FULL_MIN_PX, layoutModeFor } from '../../../../src/presentation/editor/shell/layoutMode';

describe('layoutModeFor', () => {
	it('is full at and above the full threshold', () => {
		expect(layoutModeFor(FULL_MIN_PX)).toBe('full');
		expect(layoutModeFor(1280)).toBe('full');
	});
	it('is constrained between the two thresholds — 460, a sidebar leaf, is constrained', () => {
		expect(layoutModeFor(FULL_MIN_PX - 1)).toBe('constrained');
		expect(layoutModeFor(460)).toBe('constrained');
		expect(layoutModeFor(CONSTRAINED_MIN_PX)).toBe('constrained');
	});
	it('is unsupported below the floor, including a zero-width pane before layout', () => {
		expect(layoutModeFor(CONSTRAINED_MIN_PX - 1)).toBe('unsupported');
		expect(layoutModeFor(0)).toBe('unsupported');
	});
});
```

In `stores.test.ts`'s workspace `describe`:

```ts
it('opens one overlay at a time and closes it when the layout leaves constrained', () => {
	const workspace = useWorkspaceStore();
	workspace.setLayoutMode('constrained');
	workspace.openOverlay('layers');
	expect(workspace.overlay).toBe('layers');
	workspace.openOverlay('inspector');
	expect(workspace.overlay).toBe('inspector');
	workspace.setLayoutMode('full');
	expect(workspace.overlay).toBe('none');
});

it('resets layout mode and overlay with everything else', () => {
	const workspace = useWorkspaceStore();
	workspace.setLayoutMode('constrained');
	workspace.openOverlay('layers');
	workspace.reset();
	expect(workspace.layoutMode).toBe('full');
	expect(workspace.overlay).toBe('none');
});
```

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

`layoutMode.ts`:

```ts
/**
 * Which shell layout a leaf width gets (M16). The two numbers are JUDGEMENTS checked by the
 * 460px and 1280px captures (`npm run harness-shot`), not measurements — 460 is the width an
 * Obsidian sidebar leaf actually has and must land in `constrained` with a usable canvas.
 * A 0 width is what a container reports before layout, and `unsupported` is the honest
 * answer to it: nothing is drawn until the observer reports a real size.
 */
export type LayoutMode = 'full' | 'constrained' | 'unsupported';

export const FULL_MIN_PX = 900;
export const CONSTRAINED_MIN_PX = 400;

export function layoutModeFor(widthPx: number): LayoutMode {
	if (widthPx >= FULL_MIN_PX) return 'full';
	if (widthPx >= CONSTRAINED_MIN_PX) return 'constrained';
	return 'unsupported';
}
```

`WorkspaceStore.ts` — add beside the existing refs:

```ts
	const layoutMode = ref<LayoutMode>('full');
	const overlay = ref<'none' | 'layers' | 'inspector'>('none');

	/** Leaving `constrained` closes the overlay: the panels it stood in for are back. */
	function setLayoutMode(mode: LayoutMode): void {
		layoutMode.value = mode;
		if (mode !== 'constrained') overlay.value = 'none';
	}

	/** One overlay at a time (M16): opening one closes the other. */
	function openOverlay(kind: 'layers' | 'inspector'): void {
		overlay.value = kind;
	}

	function closeOverlay(): void {
		overlay.value = 'none';
	}
```

Import `type LayoutMode` from `../editor/shell/layoutMode`, add `layoutMode.value = 'full'; overlay.value = 'none';` to `reset()`, and return the six new members.

- [ ] **Step 4: Run, check, commit**

```bash
npx vitest run tests/presentation/editor/shell/layoutMode.test.ts tests/presentation/stores
npm run check
git add src/presentation/editor/shell/layoutMode.ts src/presentation/stores/WorkspaceStore.ts tests
git commit -m "feat(shell): layout mode thresholds and one-at-a-time overlay state"
```

Fallow note as in Task 7: `layoutMode.ts` has a `src/` importer (`WorkspaceStore.ts`), so no ignore entry is needed; `setLayoutMode`/`openOverlay`/`closeOverlay` are store members fallow may report as unused until Task 20 — if it does, the `.fallowrc.json` entry names Task 20 and is removed there.

---

# Wave 2 — selection, the default tool, and the shell regions

Every task in this wave runs AFTER Task 5. "The gesture surface" means the file Task 5 recorded (`surface/EditorSurface.vue` when the asset-designer branch has landed, `PlanCanvas.vue` otherwise).

### Task 9: `hasDraft()` on every tool, and one Escape routine

**Files:**
- Modify: `src/presentation/editor/tools/editor-tool.ts` (the `EditorTool` interface)
- Modify: `src/presentation/editor/tools/select-tool.ts`, `draw-polygon-tool.ts`, `calibrate-tool.ts`
- Create: `src/presentation/editor/escapeRouting.ts`
- Modify: the gesture surface's `onKeyDown` Escape branch
- Test: `tests/presentation/editor/escapeRouting.test.ts`; every tool fake in `tests/` that `implements EditorTool` (find with `grep -rln "implements EditorTool\|: EditorTool = {" tests/`)

**Interfaces:**
- Produces:

```ts
// editor-tool.ts
/** Does this tool hold work a user would lose to `cancel()`? Escape asks before cancelling. */
hasDraft(): boolean;
// escapeRouting.ts
export type EscapeOutcome = 'swallowed-pan' | 'cancelled-draft' | 'returned-to-select' | 'cleared-selection' | 'nothing';
export interface EscapeDeps {
	readonly panning: boolean;
	readonly activeToolId: ToolId | null;
	readonly hasDraft: () => boolean;
	readonly cancelGesture: () => void;
	readonly setTool: (id: ToolId | null) => void;
	readonly hasSelection: boolean;
	readonly clearSelection: () => void;
}
export function routeEscape(deps: EscapeDeps): EscapeOutcome;
```

- [ ] **Step 1: Failing test for the routine**

```ts
import { describe, expect, it, vi } from 'vitest';
import { routeEscape, type EscapeDeps } from '../../../src/presentation/editor/escapeRouting';

function deps(overrides: Partial<EscapeDeps> = {}): EscapeDeps & { cancelGesture: ReturnType<typeof vi.fn>; setTool: ReturnType<typeof vi.fn>; clearSelection: ReturnType<typeof vi.fn> } {
	return {
		panning: false,
		activeToolId: 'select',
		hasDraft: () => false,
		cancelGesture: vi.fn(),
		setTool: vi.fn(),
		hasSelection: false,
		clearSelection: vi.fn(),
		...overrides,
	};
}

describe('routeEscape — one precedence for the whole canvas', () => {
	it('a running pan swallows Escape and touches nothing', () => {
		const d = deps({ panning: true, activeToolId: 'draw-polygon', hasDraft: () => true, hasSelection: true });
		expect(routeEscape(d)).toBe('swallowed-pan');
		expect(d.cancelGesture).not.toHaveBeenCalled();
		expect(d.clearSelection).not.toHaveBeenCalled();
	});
	it('a drawing tool WITH a draft cancels the draft and stays active', () => {
		const d = deps({ activeToolId: 'draw-polygon', hasDraft: () => true });
		expect(routeEscape(d)).toBe('cancelled-draft');
		expect(d.cancelGesture).toHaveBeenCalledOnce();
		expect(d.setTool).not.toHaveBeenCalled();
	});
	it('a drawing tool WITHOUT a draft returns to Select', () => {
		const d = deps({ activeToolId: 'draw-polygon' });
		expect(routeEscape(d)).toBe('returned-to-select');
		expect(d.setTool).toHaveBeenCalledWith('select');
	});
	it('Select with a selection clears it', () => {
		const d = deps({ hasSelection: true });
		expect(routeEscape(d)).toBe('cleared-selection');
		expect(d.clearSelection).toHaveBeenCalledOnce();
	});
	it('Select mid-drag cancels the drag before it would clear the selection', () => {
		const d = deps({ hasDraft: () => true, hasSelection: true });
		expect(routeEscape(d)).toBe('cancelled-draft');
		expect(d.clearSelection).not.toHaveBeenCalled();
	});
	it('Select with nothing selected does nothing', () => {
		expect(routeEscape(deps())).toBe('nothing');
	});
	it('camera mode (no tool) with a selection still clears it', () => {
		const d = deps({ activeToolId: null, hasSelection: true });
		expect(routeEscape(d)).toBe('cleared-selection');
	});
});
```

- [ ] **Step 2: Run — FAIL, module missing.**

- [ ] **Step 3: Implement**

`escapeRouting.ts`:

```ts
import type { ToolId } from './tools/editor-tool';

export type EscapeOutcome = 'swallowed-pan' | 'cancelled-draft' | 'returned-to-select' | 'cleared-selection' | 'nothing';

export interface EscapeDeps {
	readonly panning: boolean;
	readonly activeToolId: ToolId | null;
	readonly hasDraft: () => boolean;
	readonly cancelGesture: () => void;
	readonly setTool: (id: ToolId | null) => void;
	readonly hasSelection: boolean;
	readonly clearSelection: () => void;
}

/**
 * What Escape does on the canvas, decided ONCE (design spec §6.3). An open Add menu or overlay
 * is not here: the root owns those and handles the key before the canvas sees it.
 *
 * Order: a running pan swallows it (the camera does not rewind, and a tool's draft is the only
 * thing it could destroy); a tool holding a draft cancels the draft and stays put; a creation
 * tool with nothing drawn returns to Select; Select with a selection clears it; else nothing.
 * The draft test comes BEFORE the selection test so a drag in flight is abandoned rather than
 * a selection cleared under a hand still moving.
 */
export function routeEscape(deps: EscapeDeps): EscapeOutcome {
	if (deps.panning) return 'swallowed-pan';
	if (deps.hasDraft()) {
		deps.cancelGesture();
		return 'cancelled-draft';
	}
	if (deps.activeToolId !== null && deps.activeToolId !== 'select') {
		deps.setTool('select');
		return 'returned-to-select';
	}
	if (deps.hasSelection) {
		deps.clearSelection();
		return 'cleared-selection';
	}
	return 'nothing';
}
```

`editor-tool.ts` — add `hasDraft(): boolean;` to `EditorTool` with the docblock above. Then:

- `SelectTool.hasDraft(): boolean { return this.gesture !== null; }`
- `DrawPolygonTool.hasDraft(): boolean { return this.buffer.length > 0; }`
- `CalibrateTool.hasDraft(): boolean` — read the class's fields (`pointA`, `pendingCompletion`): `return this.pointA !== null || this.pendingCompletion !== null;` (adjust the names to what the file declares; the rule is "any placed point").

Run `npm run build`: every tool fake in `tests/` that implements `EditorTool` now fails to compile — add `hasDraft: () => false` (or the method) to each.

- [ ] **Step 4: Wire the gesture surface**

In the gesture surface's `onKeyDown`, replace the body of the `if (event.key === 'Escape')` branch's non-repeat path so that instead of calling `toolManager.cancelGesture()` directly it calls:

```ts
			routeEscape({
				panning: panPhase.value === 'panning',
				activeToolId: activeToolId.value,
				hasDraft: () => toolManager.activeToolHasDraft(),
				cancelGesture: () => toolManager.cancelGesture(),
				setTool: (id) => runtime.setTool(id),   // on EditorSurface, `setTool` arrives as a prop: add `setTool: (id: ToolId | null) => void` to its props and pass `runtime.setTool` from PlanCanvas.vue
				hasSelection: selection.selectedIds.length > 0,   // on EditorSurface, pass `hasSelection: () => boolean` as a prop from PlanCanvas.vue the way `framedBounds` is
				clearSelection: () => selection.clear(),
			});
```

Keep the existing `event.repeat` guard and `preventDefault()` exactly where they are. Add to `ToolManager`:

```ts
	/** Whether the active tool holds a draft; `false` with no tool. Escape's question. */
	activeToolHasDraft(): boolean {
		return this.activeTool?.hasDraft() ?? false;
	}
```

- [ ] **Step 5: Regression cases in the surface's own suite**

In `tests/presentation/editor/canvasKeyboardGestures.test.ts` (read its mount helpers first) add:

```ts
it('Escape with Select active and a zone selected clears the selection', async () => {
	const harness = await mountCanvas();
	useSelectionStore().select([FIXTURE_ZONES[0].id as never]);
	harness.canvasEl.focus();
	harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await settle();
	expect(useSelectionStore().selectedIds).toEqual([]);
});

it('Escape on an empty drawing tool returns to Select rather than clearing anything', async () => {
	const harness = await mountCanvas();
	useSelectionStore().select([FIXTURE_ZONES[0].id as never]);
	runtimeOf(harness).setTool('draw-polygon');
	harness.canvasEl.focus();
	harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await settle();
	expect(runtimeOf(harness).activeToolId.value).toBe('select');
	expect(useSelectionStore().selectedIds).toHaveLength(1);
});
```

(`runtimeOf` — whatever the file already uses to reach `EditorRuntime`; if nothing does, read the runtime off `useEditorStore().activeToolId` for the second assertion and call `setTool` through the toolbar-equivalent the harness offers. The existing "Escape mid-polygon keeps the buffer while panning" case must stay green.)

- [ ] **Step 6: Check and commit**

```bash
npm run check
git add -A src/presentation/editor tests
git commit -m "feat(editor): one Escape routine — pan, draft, tool, selection, in that order"
```

### Task 10: Select is the default, and a finished creation returns to it

**Files:**
- Modify: `src/presentation/editor/runtime.ts` (`buildRuntime`), `src/presentation/editor/tools/draw-polygon-tool.ts` (`DrawPolygonToolDeps`)
- Test: `tests/presentation/editor/runtime.test.ts`, `tests/presentation/editor/tools/drawPolygonTool.test.ts`

**Interfaces:**
- Produces: `DrawPolygonToolDeps.onCompleted: () => void` (REQUIRED; called after a successful close, after the new zone is selected). `EditorRuntime.returnToSelect(): void` (same as `setTool('select')`, named for the two callers that mean it).
- Consumes: `ProjectStore.status`.

- [ ] **Step 1: Failing tests**

`runtime.test.ts` (read how it builds a runtime — `provideEditorRuntime` inside a mounted component, or a helper):

```ts
it('activates Select the first time the plan becomes ready, and never on a later refresh', async () => {
	const { runtime, projectStore } = await mountRuntime();    // the file's existing helper
	expect(runtime.activeToolId.value).toBeNull();
	projectStore.status = 'ready';
	await nextTick();
	expect(runtime.activeToolId.value).toBe('select');
	runtime.setTool('draw-polygon');
	projectStore.status = 'ready';   // a post-command refresh keeps 'ready'; nothing moves
	await nextTick();
	expect(runtime.activeToolId.value).toBe('draw-polygon');
});
```

`drawPolygonTool.test.ts`:

```ts
it('reports completion after selecting the zone it drew, so the runtime can return to Select', async () => {
	const onCompleted = vi.fn();
	const { tool, context } = makeTool({ onCompleted });   // the file's builder; add the dep
	drawTriangle(tool, context);                            // the file's existing gesture helper
	await settle();
	expect(context.selection.selectedIds).toHaveLength(1);
	expect(onCompleted).toHaveBeenCalledOnce();
});
it('does not report completion for a refused close', async () => { /* drive the existing refused-close fixture and assert `onCompleted` was not called */ });
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

In `draw-polygon-tool.ts`, add to `DrawPolygonToolDeps`:

```ts
	/**
	 * Called once after a successful close, AFTER the new zone is selected. The runtime binds
	 * it to `returnToSelect`: creation is temporary (design spec §7.3), and a tool that stayed
	 * active would leave the next click placing a vertex the user did not mean.
	 */
	readonly onCompleted: () => void;
```

and in `closePolygon`, after `if (zoneId !== null) context.selection.select([zoneId]);` add `this.deps.onCompleted();`.

In `runtime.ts`:

```ts
	const returnToSelect = (): void => setTool('select');

	// Select is the safe default (M01): armed the FIRST time the plan is ready and left alone
	// on every later refresh, which keeps `status === 'ready'` and must not yank a tool the
	// user chose. `watch` on the status rather than on `hydrate`'s promise, because the root
	// owns hydrate and a second caller (`onPlanChanged`) already exists.
	watch(
		() => projectStore.status,
		(status, previous) => {
			if (status === 'ready' && previous !== 'ready') setTool('select');
		},
	);
```

Pass `onCompleted: returnToSelect` in `registerEditorTools`' `DrawPolygonTool` construction (thread `returnToSelect` in as a parameter or hoist `setTool` above the registration). Add `returnToSelect` to `EditorRuntime` and the returned object. Fix every `DrawPolygonToolDeps` literal in `tests/` (`npm run build` lists them) with `onCompleted: () => {}`.

- [ ] **Step 4: Check and commit**

```bash
npm run check
git add -A src/presentation/editor tests
git commit -m "feat(editor): Select is the default, and a finished polygon returns to it"
```

### Task 11: one selection resolver, and hover that predicts it

**Files:**
- Create: `src/presentation/editor/selection/resolveSelectionTarget.ts`
- Modify: `src/presentation/editor/tools/select-tool.ts` (delete private `hitTest`/`vertexAt`; `pointerMove` writes hover)
- Modify: the gesture surface (`cursorClass`) and `styles/editor-cursors.css`
- Test: `tests/presentation/editor/selection/resolveSelectionTarget.test.ts`, `tests/presentation/editor/tools/selectTool.test.ts` (existing file — find it with `ls tests/presentation/editor/tools`), `tests/presentation/editor/canvasNavigation.test.ts` (cursor class)

**Interfaces:**
- Produces:

```ts
export type SelectionTarget =
	| { readonly kind: 'handle'; readonly id: string; readonly vertexIndex: number }
	| { readonly kind: 'body'; readonly id: string }
	| null;
export function resolveSelectionTarget(input: {
	readonly candidates: readonly SpatialObjectCandidate[];  // bottom first, as ZoneLayer stacks them
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
}): SelectionTarget;
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';

const square = (id: string, x: number, y: number, size: number) => ({
	id,
	points: [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }],
});

describe('resolveSelectionTarget', () => {
	const below = square('below', 0, 0, 1000);
	const above = square('above', 500, 500, 1000);
	const base = { candidates: [below, above], selectedIds: [], handleToleranceWorld: 50 };

	it('picks the topmost body where two overlap', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 700, y: 700 } })).toEqual({ kind: 'body', id: 'above' });
	});
	it('picks the only body containing the point', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 100, y: 100 } })).toEqual({ kind: 'body', id: 'below' });
	});
	it('answers null over empty canvas', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 5000, y: 5000 } })).toBeNull();
	});
	it('a vertex handle of the SELECTED record beats every body', () => {
		expect(resolveSelectionTarget({ ...base, selectedIds: ['below'], worldPoint: { x: 1010, y: 1010 } })).toEqual({ kind: 'handle', id: 'below', vertexIndex: 2 });
	});
	it('a vertex of an UNSELECTED record is just a body hit', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 1010, y: 1010 } })).toEqual({ kind: 'body', id: 'above' });
	});
	it('resolves the same target regardless of the order the same candidates arrive in, once z-order is fixed', () => {
		const a = resolveSelectionTarget({ ...base, worldPoint: { x: 700, y: 700 } });
		const b = resolveSelectionTarget({ ...base, candidates: [below, above], worldPoint: { x: 700, y: 700 } });
		expect(a).toEqual(b);
	});
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```ts
import { contains, distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { SpatialObjectCandidate } from '../tools/select-tool';

export type SelectionTarget =
	| { readonly kind: 'handle'; readonly id: string; readonly vertexIndex: number }
	| { readonly kind: 'body'; readonly id: string }
	| null;

/**
 * The ONE answer to "what would a click here select" (design spec §6.1). Hover asks it to
 * predict, the click asks it to act, so the two cannot disagree. Priority: a vertex handle of
 * an already-selected record, then the topmost body containing the point, then nothing.
 * Candidates arrive bottom-first (the order `ZoneLayer` stacks them); the body scan walks them
 * top-first. Overlap cycling is not here yet, and this shape leaves room for it.
 */
export function resolveSelectionTarget(input: {
	readonly candidates: readonly SpatialObjectCandidate[];
	readonly selectedIds: readonly string[];
	readonly worldPoint: Point;
	readonly handleToleranceWorld: number;
}): SelectionTarget {
	for (const id of input.selectedIds) {
		const selected = input.candidates.find((candidate) => candidate.id === id);
		if (selected === undefined) continue;
		for (const [vertexIndex, point] of selected.points.entries()) {
			if (distance(point, input.worldPoint) <= input.handleToleranceWorld) {
				return { kind: 'handle', id, vertexIndex };
			}
		}
	}
	for (let index = input.candidates.length - 1; index >= 0; index -= 1) {
		const candidate = input.candidates[index];
		const inside = contains({ points: candidate.points }, input.worldPoint);
		if (inside.ok && inside.value) return { kind: 'body', id: candidate.id };
	}
	return null;
}
```

- [ ] **Step 4: Make `SelectTool` use it**

In `pointerDown`, replace the vertex-then-body sequence (the block around lines 139–175 that calls `vertexAt` and `hitTest`) with:

```ts
		const target = resolveSelectionTarget({
			candidates,
			selectedIds: context.selection.selectedIds.map(String),
			worldPoint: event.worldPoint,
			handleToleranceWorld: VERTEX_GRAB_RADIUS_PX * context.viewport.worldPerScreenPixel(),
		});
		if (target === null) {
			context.selection.clear();
			return;
		}
		const hit = candidates.find((candidate) => candidate.id === target.id);
		if (hit === undefined) return;
		if (target.kind === 'handle') { /* the existing vertex-gesture construction, with target.vertexIndex */ }
		else { /* the existing body-gesture construction */ }
```

Delete `hitTest` and `vertexAt`. Then in `pointerMove`, when `this.gesture === null` (no drag), write the hover:

```ts
		if (this.gesture === null) {
			const target = resolveSelectionTarget({ /* same input */ });
			context.renderState.hoveredObjectId = target === null ? null : target.id;
			return;
		}
```

and clear it in `deactivate()` and at the start of a gesture. Run the existing `selectTool.test.ts` — every case must stay green (the handle-beats-body and topmost cases already exist there in some form; if a case asserted the OLD order for an unselected zone's vertex, read it against the spec's priority and fix the case, not the resolver).

- [ ] **Step 5: Cursor**

In the gesture surface's `cursorClass`, after the pan phase test and before the precise-tools test, add: `if (activeToolId.value === 'select' && renderState.hoveredObjectId !== null) return 'rp-plan-canvas-target';` (`renderState` arrives the same way `toolManager` does on `EditorSurface`: add a `renderState: RenderState` prop and pass `runtime.renderState` from `PlanCanvas.vue`). In `styles/editor-cursors.css` add `.rp-plan-canvas-target { cursor: pointer; }` with a one-line comment. In `canvasNavigation.test.ts` (or `interactionLayer.test.ts`, whichever mounts the canvas with zones) add a case: set `runtime.renderState.hoveredObjectId = 'zone-kitchen'` with Select active, `await settle()`, assert `canvasEl.classList.contains('rp-plan-canvas-target')`; then start a middle-button pan and assert the pan class wins.

- [ ] **Step 6: Check and commit**

```bash
npm run check
git add -A src/presentation/editor styles/editor-cursors.css tests
git commit -m "feat(selection): one resolver for click and hover; the cursor says what a click would take"
```

### Task 12: hover outline, list framing, and retiring a gone selection

**Files:**
- Modify: `src/presentation/editor/layers/InteractionLayer.vue`
- Modify: `src/presentation/editor/runtime.ts`
- Test: `tests/presentation/editor/interactionLayer.test.ts`, `tests/presentation/editor/runtime.test.ts`

**Interfaces:**
- Produces: `EditorRuntime.selectAndFrame(id: string): void` — selects the id and fits the camera to that record's bounds through `EditorStore.fitTo`; a degenerate extent leaves the camera alone. The runtime retires ids that no longer resolve after a hydrate.
- Consumes: `boundsOfZones` (`viewport/zoneExtent.ts`), `EditorStore.fitTo(bounds, stage)`, and the stage size — read `EditorStore` for how the surface publishes the stage size (`grep -n "stageSize\|size" src/presentation/stores/EditorStore.ts`); if the store does not hold one, `selectAndFrame` takes it as a second parameter `stage: StageSize` and the list passes the surface's size through the same prop path `framedBounds` uses.

- [ ] **Step 1: Failing tests**

`interactionLayer.test.ts`:

```ts
it('draws a hover outline for the hovered zone and none for the selected one', async () => {
	const harness = await mountCanvasWithZones();      // the file's existing helper
	const runtime = runtimeOf(harness);
	runtime.renderState.hoveredObjectId = 'zone-terrace';
	await settle();
	expect(linesNamed(harness, 'hover-outline')).toHaveLength(1);
	useSelectionStore().select(['zone-terrace' as never]);
	await settle();
	expect(linesNamed(harness, 'hover-outline')).toHaveLength(0);   // selection outline replaces it
});
```

(`linesNamed` — find Konva nodes by `name`; the file already has a way of reading `VLine`s. Give the new line `name: 'hover-outline'`.)

`runtime.test.ts`:

```ts
it('selectAndFrame selects the id and moves the camera onto it', async () => {
	const { runtime, editor } = await mountRuntime();
	const before = editor.viewport;
	runtime.selectAndFrame('zone-kitchen');
	expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
	expect(editor.viewport).not.toEqual(before);
});
it('selectAndFrame on a degenerate record selects it and leaves the camera alone', ...);   // a zone whose points are all one point
it('a selected zone that disappears from the next hydrate is retired, not rebound', async () => {
	const { projectStore } = await mountRuntime();
	useSelectionStore().select(['zone-kitchen' as never]);
	await projectStore.hydrate(fakeQueries(FIXTURE_PLAN, [FIXTURE_ZONES[1]]), FIXTURE_PLAN.id);
	await nextTick();
	expect(useSelectionStore().selectedIds).toEqual([]);
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement the outline**

In `InteractionLayer.vue` add:

```ts
const hoverOutlineFlat = computed(() => {
	const id = runtime.renderState.hoveredObjectId;
	if (id === null || selectedIds.value.some((selected) => String(selected) === id)) return null;
	const zone = zones.value.get(id);
	if (zone === undefined) return null;
	return zone.points.flatMap((point) => { const at = toScreen(point); return [at.x, at.y]; });
});
```

and in the template, before the selection outline:

```vue
<VLine v-if="hoverOutlineFlat !== null" :config="{ name: 'hover-outline', points: hoverOutlineFlat, closed: true, stroke: props.tokens.selectionStroke, strokeWidth: 1, dash: [4, 4], listening: false }" />
```

(Use the token name the selection outline already uses for its stroke — `grep -n "stroke:" src/presentation/editor/layers/InteractionLayer.vue`. No new colour; a hover is the selection's stroke, thinner and dashed.)

- [ ] **Step 4: Implement `selectAndFrame` and the retirement watcher**

In `runtime.ts`:

```ts
	function selectAndFrame(id: string): void {
		selection.select([id as EntityId<string>]);
		const zone = projectStore.zones.get(id);
		if (zone === undefined) return;
		const bounds = boundsOfZones([zone]);
		if (bounds === null) return;   // a degenerate extent: the selection stands, the camera stays
		editor.fitTo(bounds, editor.stageSize);   // or the `stage` parameter, per Interfaces above
	}

	// A selected id the vault no longer holds is retired, never rebound by name or position
	// (design spec §6.5). Watched on the zones map, which every successful hydrate replaces.
	watch(
		() => projectStore.zones,
		(zones) => {
			const survivors = selection.selectedIds.filter((id) => zones.has(String(id)));
			if (survivors.length !== selection.selectedIds.length) selection.select(survivors);
		},
	);
```

Add `selectAndFrame` to `EditorRuntime` and the returned object.

- [ ] **Step 5: Check and commit**

```bash
npm run check
git add -A src/presentation/editor tests
git commit -m "feat(editor): hover outline, list framing, and a gone selection is retired"
```

### Task 13: the context bar and the floating primary actions replace the toolbar

**Files:**
- Create: `src/presentation/editor/shell/EditorContextBar.vue`, `src/presentation/editor/shell/FloatingPrimaryActions.vue`, `styles/editor-shell.css`
- Delete: `src/presentation/editor/shell/EditorToolbar.vue`
- Modify: `src/presentation/editor/PlanEditorRoot.vue` (mount the two), `styles/index.css` (import `editor-shell.css` after `editor-cursors.css`), `en.ts`, `de.ts`
- Modify tests: `tests/presentation/editor/shell.test.ts` ("the five regions" describe), `tests/presentation/editor/tools/calibrateWiring.test.ts`, `tests/helpers/planEditorRig.ts` (`toolbarButton`), `tests/build/buttonFocusRing.test.ts`, `buttonSpecificity.test.ts`, `focusReach.test.ts` (these read button classes from the SOURCE via `tests/helpers/buttonRules.ts`; they need new focus and specificity rules for the new classes, not new fixtures)
- Test: `tests/presentation/editor/shell/editorContextBar.test.ts`, `tests/presentation/editor/shell/floatingPrimaryActions.test.ts`

**Interfaces:**
- Produces: `FloatingPrimaryActions` emits `openAdd` (Task 18 wires the menu; until then the root ignores it). Classes `.rp-context-bar`, `.rp-context-bar__crumb`, `.rp-context-bar__button`, `.rp-primary-actions`, `.rp-primary-actions__button`.
- Strings (both locales): `editor.context-bar` ("Editor context"/"Editor-Kontext"), `editor.context.undo` ("Undo"/"Rückgängig"), `editor.context.redo` ("Redo"/"Wiederholen"), `editor.primary-actions` ("Primary actions"/"Hauptaktionen"), `editor.primary.select` ("Select"/"Auswählen"), `editor.primary.add` ("Add"/"Hinzufügen"). Delete `editor.toolbar`, `editor.toolbar.pan`, `.select`, `.draw-zone`, `.undo`, `.redo`, `.calibrate` from both locales.

- [ ] **Step 1: Failing component tests**

`editorContextBar.test.ts` (mount with the editor harness — `mountPlanEditorCanvas()` — because the bar reads `ProjectStore` and the runtime):

```ts
// @vitest-environment jsdom
it('names the project and the floor as a breadcrumb', async () => {
	const harness = await mountPlanEditorCanvas();
	const crumbs = harness.wrapper.findAll('.rp-context-bar__crumb').map((c) => c.text());
	expect(crumbs).toEqual(['Willow House', 'Ground floor']);
});
it('undo and redo are disabled with an empty history and carry their names', async () => {
	const harness = await mountPlanEditorCanvas();
	const undo = harness.wrapper.find('button[data-rp-action="undo"]');
	expect(undo.attributes('disabled')).toBeDefined();
	expect(undo.text()).toBe(t('en', 'editor.context.undo'));
});
it('has no toolbar any more', async () => {
	const harness = await mountPlanEditorCanvas();
	expect(harness.wrapper.find('.rp-editor-toolbar').exists()).toBe(false);
	expect(harness.wrapper.find('[role="toolbar"]').exists()).toBe(false);
});
```

`floatingPrimaryActions.test.ts`:

```ts
it('presses Select while the select tool is active and emits openAdd from Add', async () => {
	const harness = await mountPlanEditorCanvas();
	const select = harness.wrapper.find('button[data-rp-action="select"]');
	expect(select.attributes('aria-pressed')).toBe('true');   // Task 10 made it the default
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-polygon');
	await settle();
	expect(select.attributes('aria-pressed')).toBe('false');
	await select.trigger('click');
	expect(runtime.activeToolId.value).toBe('select');
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Write `EditorContextBar.vue`**

```vue
<script setup lang="ts">
/**
 * M00's context bar: where the user is (`Project › Floor`, text — ADR-0017 gives it two
 * segments and no tree) and the two history actions. No perspective switch: only Plan has
 * content, and a switch with two dead options is the control-that-does-nothing slice 14
 * refuses; the `<slot name="perspective" />` is where one lands when a second perspective has
 * something to show. Undo/redo dispatch through the same decorated dispatcher every other
 * dispatch in the leaf uses (`runtime.undo`/`redo`).
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';

const runtime = useEditorRuntime();
const { project, plan } = storeToRefs(useProjectStore());
const crumbs = computed(() => [project.value?.name ?? '', plan.value?.name ?? ''].filter((c) => c !== ''));
</script>

<template>
	<header
		class="rp-context-bar"
		:aria-label="tr('editor.context-bar')"
	>
		<nav
			class="rp-context-bar__crumbs"
			:aria-label="tr('editor.context-bar')"
		>
			<span
				v-for="(crumb, index) in crumbs"
				:key="index"
				class="rp-context-bar__crumb"
			>{{ crumb }}</span>
		</nav>
		<slot name="perspective" />
		<span class="rp-context-bar__spacer" />
		<button
			type="button"
			class="rp-context-bar__button"
			data-rp-action="undo"
			:disabled="!runtime.canUndo.value"
			@click="runtime.undo()"
		>
			{{ tr('editor.context.undo') }}
		</button>
		<button
			type="button"
			class="rp-context-bar__button"
			data-rp-action="redo"
			:disabled="!runtime.canRedo.value"
			@click="runtime.redo()"
		>
			{{ tr('editor.context.redo') }}
		</button>
	</header>
</template>
```

The `›` separator is CSS (`.rp-context-bar__crumb + .rp-context-bar__crumb::before { content: '›'; }`), so the crumb text stays clean for the test and for a screen reader.

- [ ] **Step 4: Write `FloatingPrimaryActions.vue`**

```vue
<script setup lang="ts">
/**
 * Select and Add, floating over the canvas (M01, component library §6). Select is the safe
 * state and says so with `aria-pressed`; Add opens the menu Task 18 mounts, through the ONE
 * `openAdd` event — the menu is the root's to own, because it has to close on Escape before
 * the canvas hears the key.
 */
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';

const runtime = useEditorRuntime();
const emit = defineEmits<{ openAdd: [] }>();
</script>

<template>
	<div
		class="rp-primary-actions"
		role="group"
		:aria-label="tr('editor.primary-actions')"
	>
		<button
			type="button"
			class="rp-primary-actions__button"
			data-rp-action="select"
			:aria-pressed="runtime.activeToolId.value === 'select'"
			@click="runtime.setTool('select')"
		>
			{{ tr('editor.primary.select') }}
		</button>
		<button
			type="button"
			class="rp-primary-actions__button"
			data-rp-action="add"
			aria-haspopup="menu"
			@click="emit('openAdd')"
		>
			{{ tr('editor.primary.add') }}
		</button>
	</div>
</template>
```

- [ ] **Step 5: Styles**

`styles/editor-shell.css` (new partial; header comment names the tasks that fill it; all values Obsidian variables):

```css
.rp-context-bar { display: flex; align-items: center; gap: var(--size-4-2); min-height: var(--size-4-8); padding: 0 var(--size-4-2); border-bottom: 1px solid var(--background-modifier-border); }
.rp-context-bar__crumbs { display: flex; align-items: center; gap: var(--size-4-1); font-size: var(--font-ui-small); color: var(--text-muted); min-width: 0; }
.rp-context-bar__crumb { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-context-bar__crumb:last-child { color: var(--text-normal); }
.rp-context-bar__crumb + .rp-context-bar__crumb::before { content: '›'; margin: 0 var(--size-4-1); color: var(--text-faint); }
.rp-context-bar__spacer { flex: 1; }
.rp-primary-actions { position: absolute; left: 50%; bottom: var(--size-4-4); transform: translateX(-50%); display: flex; gap: var(--size-4-1); padding: var(--size-4-1); border-radius: var(--radius-m); background-color: var(--background-secondary); border: 1px solid var(--background-modifier-border); box-shadow: var(--shadow-s); }
```

Copy the `.rp-editor-toolbar .rp-editor-tool-button` block's specificity and focus-ring approach from `styles/editor.css` for `.rp-context-bar .rp-context-bar__button` and `.rp-primary-actions .rp-primary-actions__button` (qualified with the container, `:focus-visible` ring kept, `aria-pressed="true"` state via `[aria-pressed="true"]`), then delete the toolbar rules from `editor.css`. Run `npx vitest run tests/build/buttonSpecificity.test.ts tests/build/buttonFocusRing.test.ts tests/build/focusReach.test.ts` — they read button classes from the Vue source and will name exactly what is missing.

- [ ] **Step 6: Wire the root, retire the toolbar**

In `PlanEditorRoot.vue`: replace `<EditorToolbar />` with `<EditorContextBar />`; inside `<PlanCanvas>`'s slot, beside the empty-state overlay, add `<FloatingPrimaryActions @open-add="() => {}" />` (Task 18 replaces the handler). Delete `EditorToolbar.vue`. Delete the seven `editor.toolbar*` keys from both locales, add the six new ones. Update `tests/helpers/planEditorRig.ts`'s `toolbarButton(harness, label)` to find `.rp-primary-actions__button` / `.rp-context-bar__button` by text and rename it `actionButton`; update its callers (`grep -rln "toolbarButton" tests`). `calibrateWiring.test.ts` reaches Calibrate through the toolbar today — Task 14 gives it a new door; in THIS task make its case reach the tool through `runtime.setTool('calibrate')` and leave a `// Task 14 routes this through the Set scale action` comment.

- [ ] **Step 7: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(shell): the context bar and floating Select/Add replace the toolbar"
```

### Task 14: the truthful layer catalogue, and Set scale

**Files:**
- Create: `src/presentation/editor/layers/layerCatalogue.ts`, `src/presentation/editor/shell/LayerList.vue`, `src/presentation/editor/shell/PropertyLayerPanel.vue`
- Delete: `src/presentation/editor/shell/LayersPanel.vue`
- Modify: `PlanEditorRoot.vue`, `en.ts`, `de.ts`, `tests/presentation/editor/shell.test.ts` ("the layers panel" describe), `tests/presentation/editor/tools/calibrateWiring.test.ts`
- Test: `tests/presentation/editor/layers/layerCatalogue.test.ts`, `tests/presentation/editor/shell/layerList.test.ts`

**Interfaces:**
- Produces:

```ts
export type LayerEntryState = 'available' | 'supported-empty';
export interface LayerAction { readonly labelKey: StringKey; readonly toolId: 'calibrate'; readonly enabled: boolean; readonly reasonKey: StringKey; }
export interface LayerEntry { readonly id: 'reference' | 'rooms'; readonly konvaLayer: KonvaLayerId; readonly labelKey: StringKey; readonly state: LayerEntryState; readonly reasonKey: StringKey | null; readonly action: LayerAction | null; }
export function layerCatalogue(plan: PlanDto | null): readonly LayerEntry[];
```

- Strings: `editor.layer.reference-plan` ("Reference plan"/"Referenzplan"), `editor.layer.reference-plan.none` ("No reference plan has been added to this floor."/"Diesem Geschoss wurde noch kein Referenzplan hinzugefügt."), `editor.layer.reference-plan.set-scale` ("Set scale"/"Maßstab festlegen"), `editor.layer.rooms` ("Rooms"/"Räume"), `editor.property-panel` ("Property and layers"/"Objekt und Ebenen" — NOTE: here "Objekt" would collide with the asset term; use "Grundstück und Ebenen"), `editor.floor` ("Floor"/"Geschoss"). Delete `editor.layer.background`, `.architecture`, `.zone`, `.construction`, `.asset`, `.annotation`, `.interaction` from both locales.

- [ ] **Step 1: Failing tests**

`layerCatalogue.test.ts`:

```ts
it('lists Reference plan then Rooms, in that order, and nothing else', () => {
	expect(layerCatalogue(FIXTURE_PLAN).map((e) => e.id)).toEqual(['reference', 'rooms']);
});
it('marks the reference plan supported-empty with a reason when the plan has no background, and disables Set scale', () => {
	const [reference] = layerCatalogue(FIXTURE_PLAN);
	expect(reference.state).toBe('supported-empty');
	expect(reference.reasonKey).toBe('editor.layer.reference-plan.none');
	expect(reference.action?.enabled).toBe(false);
});
it('offers Set scale when a background exists', () => {
	const [reference] = layerCatalogue({ ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } });
	expect(reference.state).toBe('available');
	expect(reference.action).toEqual({ labelKey: 'editor.layer.reference-plan.set-scale', toolId: 'calibrate', enabled: true, reasonKey: 'editor.layer.reference-plan.none' });
});
it('lists nothing for a null plan', () => { expect(layerCatalogue(null)).toEqual([]); });
```

`layerList.test.ts` (mount with the editor harness):

```ts
it('renders one checkbox per catalogue entry, labelled, and toggles the Konva layer it stands for', async () => {
	const harness = await mountPlanEditorCanvas();
	const boxes = harness.wrapper.findAll('.rp-layer-list input[type="checkbox"]');
	expect(boxes).toHaveLength(2);
	await boxes[1].setValue(false);
	expect(useWorkspaceStore().layerVisibility.zone).toBe(false);
});
it('renders the reference row disabled with its reason when there is no background, and the Set scale action disabled with the same reason', ...);
it('Set scale activates the calibrate tool when a background exists', async () => {
	const harness = await mountPlanEditorCanvas({ plan: { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } } });
	await harness.wrapper.find('button[data-rp-action="set-scale"]').trigger('click');
	expect(runtimeOf(harness).activeToolId.value).toBe('calibrate');
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `layerCatalogue.ts`**

```ts
import type { StringKey } from '../../i18n/locales/en';
import type { PlanDto } from '../../read-models/PlanDto';
import type { KonvaLayerId } from '../scene/KonvaLayers';

export type LayerEntryState = 'available' | 'supported-empty';

export interface LayerAction {
	readonly labelKey: StringKey;
	readonly toolId: 'calibrate';
	readonly enabled: boolean;
	readonly reasonKey: StringKey;
}

export interface LayerEntry {
	readonly id: 'reference' | 'rooms';
	readonly konvaLayer: KonvaLayerId;
	readonly labelKey: StringKey;
	readonly state: LayerEntryState;
	/** Why the row is `supported-empty`; `null` when it is available. */
	readonly reasonKey: StringKey | null;
	readonly action: LayerAction | null;
}

/**
 * The layers the user can honestly be offered (design spec §5.3): the Reference plan and the
 * Rooms. The four empty Konva layers and the interaction layer are not here — a row for a layer
 * with no records and no capability is a fake, and `WorkspaceStore` keeps them visible.
 * Set scale is the calibrate tool's ONLY door since the toolbar went; it sits on the thing
 * being calibrated and is disabled, with a reason, while there is nothing to calibrate against.
 */
export function layerCatalogue(plan: PlanDto | null): readonly LayerEntry[] {
	if (plan === null) return [];
	const hasReference = plan.background !== null;
	return [
		{
			id: 'reference',
			konvaLayer: 'background',
			labelKey: 'editor.layer.reference-plan',
			state: hasReference ? 'available' : 'supported-empty',
			reasonKey: hasReference ? null : 'editor.layer.reference-plan.none',
			action: {
				labelKey: 'editor.layer.reference-plan.set-scale',
				toolId: 'calibrate',
				enabled: hasReference,
				reasonKey: 'editor.layer.reference-plan.none',
			},
		},
		{ id: 'rooms', konvaLayer: 'zone', labelKey: 'editor.layer.rooms', state: 'available', reasonKey: null, action: null },
	];
}
```

- [ ] **Step 4: `LayerList.vue` and `PropertyLayerPanel.vue`**

`LayerList.vue` takes `entries: readonly LayerEntry[]` as a prop (so the overlay in Task 20 can reuse it) and reads `WorkspaceStore` for visibility; each row: a checkbox (`:disabled="entry.state === 'supported-empty'"`, `:aria-describedby` pointing at a `<span :id>` with the reason when there is one), a `<label for>`, and when `entry.action` is non-null a `<button type="button" data-rp-action="set-scale" :disabled="!entry.action.enabled" :aria-describedby=…>` that emits `activateTool(entry.action.toolId)`. Classes `.rp-layer-list`, `.rp-layer-list__row`, `.rp-layer-list__reason`, `.rp-layer-list__action`. Reuse the row CSS from `editor.css`'s `.rp-editor-layer-row` (rename in place).

`PropertyLayerPanel.vue`: the `<aside class="rp-editor-layers" :aria-label="tr('editor.property-panel')">` (keep the class so `shell.test.ts`'s region assertions and the CSS width survive), an `<h2>` with `tr('editor.floor')` and the plan name, then `<LayerList :entries="layerCatalogue(plan)" @activate-tool="runtime.setTool" />`.

- [ ] **Step 5: Retire `LayersPanel.vue`, update tests**

Root mounts `PropertyLayerPanel` where `LayersPanel` was. `shell.test.ts`'s "the layers panel" describe asserted seven checkboxes and their labels — rewrite to two rows with the new labels. `calibrateWiring.test.ts` reaches Calibrate through `set-scale` now (mount with a background). Delete the seven old keys from both locales.

- [ ] **Step 6: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(layers): a two-entry truthful catalogue, and Set scale on the reference plan"
```

### Task 15: the Inspector frame, the floor state and the room list

**Files:**
- Create: `src/presentation/editor/shell/EntityInspector.vue`, `FloorInspector.vue`, `RoomSummaryList.vue`, `styles/editor-inspector.css`
- Modify: `PlanEditorRoot.vue` (mount `EntityInspector` where `InspectorPanel` was; `InspectorPanel` becomes the routed body until Task 16 renames it), `styles/index.css`, `en.ts`, `de.ts`
- Test: `tests/presentation/editor/shell/floorInspector.test.ts`

**Interfaces:**
- Consumes: `buildFloorSummary` (Task 7), `runtime.selectAndFrame` (Task 12), `ProjectStore.project/plan/zones/unreadableZones`.
- Produces: classes `.rp-editor-inspector` (kept on the frame), `.rp-floor-inspector`, `.rp-floor-inspector__stat`, `.rp-floor-inspector__stat--partial`, `.rp-floor-inspector__stat--unavailable`, `.rp-room-list`, `.rp-room-list__row`; the frame's `role="status"` element `.rp-inspector-guidance`.
- Strings: `editor.inspector.floor.rooms` ("Rooms"/"Räume"), `editor.inspector.floor.areas` ("Areas"/"Flächen"), `editor.inspector.floor.total-area` ("Total area"/"Gesamtfläche"), `editor.inspector.floor.planned-changes` ("Planned changes"/"Geplante Änderungen"), `editor.inspector.floor.estimated-cost` ("Estimated cost"/"Geschätzte Kosten"), `editor.inspector.unavailable` ("Not available yet"/"Noch nicht verfügbar"), `editor.inspector.partial` ("{count} could not be read"/"{count} konnten nicht gelesen werden"), `editor.inspector.floor.guidance` ("Select a room on the canvas or from the list to see its details."/"Wählen Sie einen Raum auf der Zeichenfläche oder in der Liste aus, um Details zu sehen."), `editor.inspector.floor.no-rooms` ("This floor has no rooms yet."/"Dieses Geschoss hat noch keine Räume."). Delete `editor.inspector.empty`.

- [ ] **Step 1: Failing tests**

```ts
it('with nothing selected shows the floor summary: counts available, unbuilt aggregates unavailable, never zero', async () => {
	const harness = await mountPlanEditorCanvas();
	const floor = harness.wrapper.find('.rp-floor-inspector');
	expect(floor.find('[data-rp-stat="rooms"]').text()).toContain('1');
	expect(floor.find('[data-rp-stat="planned-changes"]').text()).toBe(t('en', 'editor.inspector.unavailable'));
	expect(floor.find('[data-rp-stat="estimated-cost"]').text()).not.toMatch(/\d/);
});
it('marks counts partial when zones were unreadable', async () => {
	const harness = await mountPlanEditorCanvas({ unreadableZones: 2 });
	expect(harness.wrapper.find('[data-rp-stat="rooms"]').classes()).toContain('rp-floor-inspector__stat--partial');
	expect(harness.wrapper.find('[data-rp-stat="rooms"]').text()).toContain('2');
});
it('lists every room and every area as a button, and a row selects and frames its record', async () => {
	const harness = await mountPlanEditorCanvas();
	const rows = harness.wrapper.findAll('.rp-room-list__row');
	expect(rows.map((r) => r.text())).toEqual(['Kitchen', 'Terrace']);
	await rows[0].trigger('click');
	expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
});
it('announces guidance once when the selection clears, and not on a refresh', async () => {
	const harness = await mountPlanEditorCanvas();
	useSelectionStore().select(['zone-kitchen' as never]);
	await settle();
	useSelectionStore().clear();
	await settle();
	expect(harness.wrapper.find('.rp-inspector-guidance').text()).toBe(t('en', 'editor.inspector.floor.guidance'));
	harness.changePlan();
	await settle();
	expect(harness.wrapper.find('.rp-inspector-guidance').text()).toBe('');
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

`EntityInspector.vue`:

```vue
<script setup lang="ts">
/**
 * The Inspector FRAME (component library §8): routes by selection to the floor state, the
 * room body or the multiple-selection text, and owns the one `role="status"` region that says
 * "select something" exactly once when a selection clears. Cleared on the next tick so a
 * refresh or a pointer move never re-announces it (design spec §6.6).
 */
import { nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useSelectionStore } from '../selection/selection-store';
import FloorInspector from './FloorInspector.vue';
import InspectorPanel from './InspectorPanel.vue';   // Task 16 renames this RoomInspector

const { selectedIds } = storeToRefs(useSelectionStore());
const guidance = ref('');
watch(selectedIds, async (ids, previous) => {
	if (ids.length === 0 && previous.length > 0) {
		guidance.value = tr('editor.inspector.floor.guidance');
		await nextTick();
		guidance.value = '';
	}
});
</script>

<template>
	<aside
		class="rp-editor-inspector"
		:aria-label="tr('editor.inspector')"
	>
		<p
			class="rp-inspector-guidance"
			role="status"
		>{{ guidance }}</p>
		<FloorInspector v-if="selectedIds.length === 0" />
		<p
			v-else-if="selectedIds.length > 1"
			class="rp-editor-inspector-empty"
		>{{ tr('editor.inspector.multiple') }}</p>
		<InspectorPanel v-else />
	</aside>
</template>
```

Note: the guidance test above asserts the text is present after `settle()` — `settle()` runs several ticks, so the text will already be cleared. Change the implementation to clear on a `setTimeout(…, 0)` AFTER `nextTick`, and the test to assert immediately after one `await nextTick()` following `clear()`; then a later `settle()` sees `''`. Whichever you pick, the pair "announced once, gone on the next unrelated change" is what the two assertions hold.

`FloorInspector.vue` computes `buildFloorSummary({ plan, project, zones: [...zones.values()], unreadable: unreadableZones })` from `ProjectStore` and renders a `<dl>` of five stats — each `<dd data-rp-stat="rooms|areas|total-area|planned-changes|estimated-cost" :class="…--partial | …--unavailable">` rendering `value` for `available`, `value` plus `tr('editor.inspector.partial', { count })` for `partial`, and `tr('editor.inspector.unavailable')` for `unavailable` (area through the existing `formatArea` from `InspectorPanel.vue` — move that function to `src/presentation/editor/shell/formatArea.ts` so both bodies import it) — then `<RoomSummaryList :records="summary.rooms" :heading="tr('editor.inspector.floor.rooms')" />` and the same for areas (rendered only when `areas.length > 0`; an empty rooms list shows `editor.inspector.floor.no-rooms`).

`RoomSummaryList.vue`: props `records: readonly SpatialRecordDto[]`, `heading: string`; renders `<h3>` and `<ul class="rp-room-list">` of `<li><button type="button" class="rp-room-list__row" :aria-pressed="isSelected(record.id)" @click="runtime.selectAndFrame(record.id)">{{ record.name }}</button></li>`.

`styles/editor-inspector.css`: move the `.rp-editor-inspector*` rules out of `editor.css` (it is at 353 lines and Task 16 adds more), add the stat and list rules (`--partial` gets a `::after` mark plus the count text; `--unavailable` is `var(--text-muted)` italic — a word AND a style, never colour alone). Import after `editor-shell.css`.

- [ ] **Step 4: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(inspector): the frame, the truthful floor summary, and a room list that selects and frames"
```

### Task 16: the Room Inspector, homeowner-question navigation and linked content

**Files:**
- Rename: `src/presentation/editor/shell/InspectorPanel.vue` → `RoomInspector.vue` (git mv), update `EntityInspector.vue`'s import
- Create: `src/presentation/editor/shell/HomeownerQuestionNav.vue`, `LinkedContentList.vue`
- Modify: `en.ts`, `de.ts`; every test that imports `InspectorPanel` (`grep -rln "InspectorPanel" tests src`)
- Test: `tests/presentation/editor/shell/roomInspector.test.ts`

**Interfaces:**
- Consumes: `buildRoomOverview` (Task 7), `INSPECTOR_SECTIONS`.
- Strings: `editor.zone-type.Room` ("Room"/"Raum"), `.Garden` ("Garden"/"Garten"), `.Terrace` ("Terrace"/"Terrasse"), `.Driveway` ("Driveway"/"Einfahrt"), `.Roof` ("Roof"/"Dach"), `.ConstructionArea` ("Construction area"/"Baubereich"), `.Custom` ("Other"/"Sonstiges"); `editor.inspector.floor-context` ("Floor"/"Geschoss"); `editor.inspector.question.existing` ("What's here"/"Was ist vorhanden"), `.planned` ("What will change"/"Was wird sich ändern"), `.work` ("What needs doing"/"Was ist zu tun"); `editor.inspector.linked.costs` ("Costs"/"Kosten"), `.documents` ("Documents"/"Dokumente"), `.photos` ("Photos"/"Fotos"), `.notes` ("Notes"/"Notizen").

- [ ] **Step 1: Failing tests**

```ts
it('heading, canvas selection and Inspector share one id; the type and floor are homeowner words', async () => {
	const harness = await mountPlanEditorCanvas();
	useSelectionStore().select(['zone-kitchen' as never]);
	await settle();
	const room = harness.wrapper.find('.rp-room-inspector');
	expect(room.attributes('data-rp-id')).toBe('zone-kitchen');
	expect(room.find('h2').text()).toBe('Kitchen');
	expect(room.text()).toContain(t('en', 'editor.zone-type.Room'));
	expect(room.text()).toContain('Ground floor');
});
it('renders the three homeowner questions in order, each unavailable, with no button and no count', async () => {
	const harness = await mountPlanEditorCanvas();
	useSelectionStore().select(['zone-kitchen' as never]);
	await settle();
	const nav = harness.wrapper.find('.rp-question-nav');
	expect(nav.findAll('li').map((li) => li.find('.rp-question-nav__label').text())).toEqual([
		t('en', 'editor.inspector.question.existing'), t('en', 'editor.inspector.question.planned'), t('en', 'editor.inspector.question.work'),
	]);
	expect(nav.findAll('button')).toHaveLength(0);
	expect(nav.findAll('a')).toHaveLength(0);
	expect(nav.text()).not.toMatch(/\d/);
});
it('lists costs, documents, photos and notes as unavailable rows without controls', ...);   // same shape on `.rp-linked-content`
it('keeps the Requirements panel and the Delete button', async () => { /* assert `.rp-editor-inspector-requirements` and `.rp-editor-inspector-delete` still exist */ });
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

`git mv InspectorPanel.vue RoomInspector.vue`. In it: compute `overview = computed(() => { const zone = dto.kind === 'zone' ? projectStore.zones.get(String(dto.id)) : undefined; return zone && plan ? buildRoomOverview(zone, plan) : null; })`; wrap the zone branch in `<div class="rp-room-inspector" :data-rp-id="dto.id">`; render `<h2 class="rp-editor-panel-title">{{ dto.name }}</h2>` then a `<dl>` with type (`tr(\`editor.zone-type.${overview.record.zoneType}\` as StringKey)` — build the key through a `Record<string, StringKey>` map like `ZoneRenderModel`'s `ZONE_TYPE_TOKENS` so a type nothing labels is a compile error, not a template string), floor (`overview.floorName`) and area; then the EXISTING requirements section untouched; then `<HomeownerQuestionNav :unavailable="overview.unavailableSections" />` and `<LinkedContentList :unavailable="overview.unavailableSections" />`; then the existing Delete button.

`HomeownerQuestionNav.vue`:

```vue
<script setup lang="ts">
/**
 * What's here / What will change / What needs doing (component library §8), in canonical
 * order. Every row is UNAVAILABLE in this increment and is rendered as text with a reason —
 * never a `<button>` or `<a>` that does nothing. A Feature that supplies a section removes it
 * from `INSPECTOR_SECTIONS`' unavailable list and gives its row a real control here.
 */
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { InspectorSection } from '../../read-models/roomOverview';

const ROWS: readonly { readonly section: InspectorSection; readonly labelKey: StringKey }[] = [
	{ section: 'existing', labelKey: 'editor.inspector.question.existing' },
	{ section: 'planned', labelKey: 'editor.inspector.question.planned' },
	{ section: 'work', labelKey: 'editor.inspector.question.work' },
];
defineProps<{ unavailable: readonly InspectorSection[] }>();
</script>

<template>
	<ul class="rp-question-nav">
		<li
			v-for="row in ROWS"
			:key="row.section"
			class="rp-question-nav__row"
			:class="{ 'rp-question-nav__row--unavailable': unavailable.includes(row.section) }"
		>
			<span class="rp-question-nav__label">{{ tr(row.labelKey) }}</span>
			<span
				v-if="unavailable.includes(row.section)"
				class="rp-question-nav__state"
			>{{ tr('editor.inspector.unavailable') }}</span>
		</li>
	</ul>
</template>
```

`LinkedContentList.vue` is the same shape over `costs`, `documents`, `photos`, `notes` with class `.rp-linked-content`. Styles into `editor-inspector.css`.

- [ ] **Step 4: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(inspector): the Room Inspector says what it knows and marks the rest unavailable"
```

---

# Wave 3 — Add, the task banner, the responsive shell, and warnings

### Task 17: the creation catalogue and the Add menu

**Files:**
- Create: `src/presentation/editor/add/creationCatalogue.ts`, `src/presentation/editor/add/AddMenu.vue`
- Modify: `PlanEditorRoot.vue` (owns `addMenuOpen`, mounts the menu, handles Escape before the canvas), `styles/editor-shell.css`, `en.ts`, `de.ts`
- Test: `tests/presentation/editor/add/creationCatalogue.test.ts`, `tests/presentation/editor/add/addMenu.test.ts`

**Interfaces:**
- Produces:

```ts
export type CreationEntryId = 'room' | 'wall' | 'door' | 'window' | 'area' | 'path' | 'fence' | 'item' | 'measurement' | 'note';
export type CreationGroup = 'structure' | 'property' | 'planning';
export interface CreationEntry {
	readonly id: CreationEntryId;
	readonly group: CreationGroup;
	readonly labelKey: StringKey;
	readonly descriptionKey: StringKey;
	readonly synonymKeys: readonly StringKey[];
	readonly availability: { readonly kind: 'available' } | { readonly kind: 'unsupported'; readonly reasonKey: StringKey };
	readonly activate: (runtime: Pick<EditorRuntime, 'setTool'>) => void;
}
export const CREATION_CATALOGUE: readonly CreationEntry[];
export function matchesQuery(entry: CreationEntry, query: string, language: Language): boolean;   // label, description or any synonym contains the query, case-folded
```

- Strings (both locales; German formal): `editor.add.menu` ("Add"/"Hinzufügen"), `editor.add.search` ("Search what to add"/"Suchen, was hinzugefügt werden soll"), `editor.add.group.structure` ("Structure"/"Struktur"), `.property` ("Property"/"Grundstück"), `.planning` ("Planning"/"Planung"); per entry `editor.add.<id>.label` and `editor.add.<id>.description` — Room "Room"/"Raum", "Fastest way to start"/"Der schnellste Einstieg"; Wall "Wall"/"Wand", "For precise layouts"/"Für präzise Grundrisse"; Door, Window, Area ("Area"/"Fläche"), Path ("Path"/"Weg"), Fence ("Fence"/"Zaun"), Item ("Item"/"Objekt"), Measurement ("Measurement"/"Messung"), Note ("Note"/"Notiz") with one-clause descriptions; `editor.add.room.synonyms` ("kitchen, bedroom, bathroom, living room"/"Küche, Schlafzimmer, Bad, Wohnzimmer"); `editor.add.unsupported.not-yet` ("Not available in this version yet."/"In dieser Version noch nicht verfügbar.").

- [ ] **Step 1: Failing tests**

`creationCatalogue.test.ts`:

```ts
it('offers exactly one available entry, Room, and it activates the draw tool', () => {
	const available = CREATION_CATALOGUE.filter((e) => e.availability.kind === 'available');
	expect(available.map((e) => e.id)).toEqual(['room']);
	const setTool = vi.fn();
	available[0].activate({ setTool });
	expect(setTool).toHaveBeenCalledWith('draw-polygon');
});
it('every unsupported entry carries a reason and throws if activated', () => {
	for (const entry of CREATION_CATALOGUE.filter((e) => e.availability.kind === 'unsupported')) {
		expect(entry.availability).toEqual({ kind: 'unsupported', reasonKey: 'editor.add.unsupported.not-yet' });
		expect(() => entry.activate({ setTool: vi.fn() })).toThrow();
	}
});
it('contains no internal vocabulary in either locale', () => {
	for (const entry of CREATION_CATALOGUE) for (const language of ['en', 'de'] as const) {
		const text = [t(language, entry.labelKey), t(language, entry.descriptionKey), ...entry.synonymKeys.map((k) => t(language, k))].join(' ');
		expect(text).not.toMatch(/zone|polygon|vertex|scene|calibrat/i);
	}
});
it('search matches a synonym', () => {
	const room = CREATION_CATALOGUE.find((e) => e.id === 'room')!;
	expect(matchesQuery(room, 'KITCH', 'en')).toBe(true);
	expect(matchesQuery(room, 'fence', 'en')).toBe(false);
});
it('groups appear in the locked order: structure, property, planning', () => {
	const groups = [...new Set(CREATION_CATALOGUE.map((e) => e.group))];
	expect(groups).toEqual(['structure', 'property', 'planning']);
});
```

`addMenu.test.ts` (editor harness; `openAdd = () => harness.wrapper.find('button[data-rp-action="add"]').trigger('click')`):

```ts
it('opens from Add, focuses Room, and closes on Escape with focus back on Add and nothing dispatched', async () => {
	const harness = await mountPlanEditorCanvas();
	await openAdd(harness); await settle();
	const menu = harness.wrapper.find('[role="menu"]');
	expect(menu.exists()).toBe(true);
	expect(document.activeElement?.getAttribute('data-rp-entry')).toBe('room');
	menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await settle();
	expect(harness.wrapper.find('[role="menu"]').exists()).toBe(false);
	expect(document.activeElement?.getAttribute('data-rp-action')).toBe('add');
	expect(runtimeOf(harness).activeToolId.value).toBe('select');
});
it('ArrowDown moves focus through enabled and disabled items alike; Enter on Room starts exactly one tool and closes', async () => { /* ArrowDown → 'wall' focused; Home → 'room'; Enter → menu gone, activeToolId 'draw-polygon' */ });
it('an unsupported item is aria-disabled with its reason and Enter on it changes nothing', ...);
it('typing filters by localized label and synonym', async () => { /* type "kitch" in the search input → only Room remains */ });
it('click outside closes without dispatch', ...);
it('Escape reaches the menu and never the canvas: a selected zone stays selected', async () => { /* select a zone, open menu, Escape → menu closed, selection unchanged */ });
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement the catalogue**

```ts
import type { StringKey } from '../../i18n/locales/en';
import { t, type Language } from '../../i18n/strings';   // check the exported names with `grep -n "^export" src/presentation/i18n/strings.ts`
import type { EditorRuntime } from '../runtime';

export type CreationEntryId = 'room' | 'wall' | 'door' | 'window' | 'area' | 'path' | 'fence' | 'item' | 'measurement' | 'note';
export type CreationGroup = 'structure' | 'property' | 'planning';

export interface CreationEntry {
	readonly id: CreationEntryId;
	readonly group: CreationGroup;
	readonly labelKey: StringKey;
	readonly descriptionKey: StringKey;
	readonly synonymKeys: readonly StringKey[];
	readonly availability: { readonly kind: 'available' } | { readonly kind: 'unsupported'; readonly reasonKey: StringKey };
	/** Only called for an available entry; an unsupported one THROWS so a menu that called it fails a test loudly. */
	readonly activate: (runtime: Pick<EditorRuntime, 'setTool'>) => void;
}

const NOT_YET = { kind: 'unsupported', reasonKey: 'editor.add.unsupported.not-yet' } as const;
const refuse = (id: CreationEntryId) => (): never => { throw new Error(`creation entry '${id}' is unsupported and must not be activated`); };

function unsupported(id: CreationEntryId, group: CreationGroup): CreationEntry {
	return {
		id, group,
		labelKey: `editor.add.${id}.label` as StringKey,
		descriptionKey: `editor.add.${id}.description` as StringKey,
		synonymKeys: [],
		availability: NOT_YET,
		activate: refuse(id),
	};
}

/**
 * M02's catalogue as DATA (design spec §7.1). Room is the one available entry and routes to the
 * existing draw tool, which already creates a Zone typed Room; everything else is unsupported
 * with a reason, so the menu can explain rather than offer a dead control. Order IS the locked
 * group order. The `as StringKey` casts above are the one place a key is built by interpolation;
 * `creationCatalogue.test.ts` resolves every key in both locales, which is what a template
 * string would otherwise escape.
 */
export const CREATION_CATALOGUE: readonly CreationEntry[] = [
	{
		id: 'room', group: 'structure',
		labelKey: 'editor.add.room.label', descriptionKey: 'editor.add.room.description',
		synonymKeys: ['editor.add.room.synonyms'],
		availability: { kind: 'available' },
		activate: (runtime) => runtime.setTool('draw-polygon'),
	},
	unsupported('wall', 'structure'), unsupported('door', 'structure'), unsupported('window', 'structure'),
	unsupported('area', 'property'), unsupported('path', 'property'), unsupported('fence', 'property'),
	unsupported('item', 'planning'), unsupported('measurement', 'planning'), unsupported('note', 'planning'),
];

export function matchesQuery(entry: CreationEntry, query: string, language: Language): boolean {
	const needle = query.trim().toLocaleLowerCase();
	if (needle === '') return true;
	const haystack = [entry.labelKey, entry.descriptionKey, ...entry.synonymKeys].map((key) => t(language, key).toLocaleLowerCase());
	return haystack.some((text) => text.includes(needle));
}
```

(If `t` is not the exported name or `Language` is not exported, read `strings.ts` and use what it exports; `tr` resolves the app language and cannot be asked for a specific one, which the test needs.)

- [ ] **Step 4: Implement `AddMenu.vue`**

Props: `anchor: HTMLElement | null` (the Add button, for focus return). Emits: `close`. Behaviour: on mount, focus the first available item (`room`); `role="menu"` with `aria-label="tr('editor.add.menu')"`; a search `<input type="search" :aria-label="tr('editor.add.search')">` above the groups; each group a `<div role="group" :aria-labelledby>` with `<h3>`; each item `<button role="menuitem" type="button" :data-rp-entry="entry.id" :tabindex="focusedId === entry.id ? 0 : -1" :aria-disabled="entry.availability.kind === 'unsupported'" :aria-describedby="reasonId(entry)">` showing label, description and — for unsupported — a `<span :id>` with the reason. Keys on the menu root with `@keydown.stop`: ArrowDown/ArrowUp move `focusedId` through the FILTERED list (wrapping), Home/End jump, Escape emits `close`, Enter/Space on the focused available item calls `entry.activate(runtime)` then emits `close`; on an unsupported item they do nothing. A `pointerdown` listener on `document` (registered in `onMounted`, removed in `onBeforeUnmount`) emits `close` when the target is outside the menu and outside `anchor`. `onBeforeUnmount` focuses `anchor`. Classes `.rp-add-menu`, `.rp-add-menu__search`, `.rp-add-menu__group`, `.rp-add-menu__item`, `.rp-add-menu__item--unsupported`, `.rp-add-menu__reason`; styles in `editor-shell.css` using `--background-primary`, `--background-modifier-border`, `--shadow-s`, `--radius-m`, `--background-modifier-hover` for the focused item.

In `PlanEditorRoot.vue`: `const addMenuOpen = ref(false); const addButton = ref<HTMLElement | null>(null);` — `FloatingPrimaryActions @open-add="addMenuOpen = true"` (give the component a `ref` to expose its Add button, or query it with `root.value?.querySelector('[data-rp-action="add"]')` at open time), and `<AddMenu v-if="addMenuOpen" :anchor="addButton" @close="addMenuOpen = false" />` rendered INSIDE the canvas overlay slot so it sits above the canvas and its `.stop` pointer wrapper keeps presses out of the camera.

- [ ] **Step 5: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(add): the homeowner creation catalogue and its menu; Room routes to the draw tool"
```

### Task 18: the temporary task banner

**Files:**
- Create: `src/presentation/editor/shell/TemporaryToolBanner.vue`
- Modify: `PlanEditorRoot.vue`, `styles/editor-shell.css`, `en.ts`, `de.ts`
- Test: `tests/presentation/editor/shell/temporaryToolBanner.test.ts`

**Interfaces:**
- Consumes: `runtime.activeToolId`, `routeEscape` (Task 9) via a new `EditorRuntime.cancelActiveTask(): void` that calls `routeEscape` with `panning: false` — add it to `runtime.ts` in this task, bound over the same deps the gesture surface passes.
- Strings: `editor.task.banner` ("Current task"/"Aktuelle Aufgabe"), `editor.task.draw-room.name` ("Adding a room"/"Raum hinzufügen"), `editor.task.draw-room.instruction` ("Click to place corners; click the first corner to finish."/"Klicken Sie, um Ecken zu setzen; klicken Sie auf die erste Ecke, um abzuschließen."), `editor.task.calibrate.name` ("Setting the scale"/"Maßstab festlegen"), `editor.task.calibrate.instruction` ("Click two points a known distance apart."/"Klicken Sie auf zwei Punkte mit bekanntem Abstand."), `editor.task.cancel` ("Cancel"/"Abbrechen").

- [ ] **Step 1: Failing tests**

```ts
it('is absent under Select and names the task under a creation tool', async () => {
	const harness = await mountPlanEditorCanvas();
	expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);
	runtimeOf(harness).setTool('draw-polygon'); await settle();
	expect(harness.wrapper.find('.rp-task-banner').text()).toContain(t('en', 'editor.task.draw-room.name'));
});
it('Cancel with an empty draft returns to Select; Cancel with a draft clears the draft and keeps the tool', async () => {
	const harness = await mountPlanEditorCanvas();
	const runtime = runtimeOf(harness);
	runtime.setTool('draw-polygon'); await settle();
	await harness.wrapper.find('.rp-task-banner button').trigger('click');
	expect(runtime.activeToolId.value).toBe('select');
	runtime.setTool('draw-polygon'); click(harness.canvasEl, 100, 100); await settle();   // one vertex placed
	await harness.wrapper.find('.rp-task-banner button').trigger('click');
	expect(runtime.activeToolId.value).toBe('draw-polygon');
	expect(runtime.renderState.polygonSketch).toBeNull();
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

`runtime.ts`: `const cancelActiveTask = (): void => { routeEscape({ panning: false, activeToolId: activeToolId.value, hasDraft: () => toolManager.activeToolHasDraft(), cancelGesture: () => toolManager.cancelGesture(), setTool, hasSelection: selection.selectedIds.length > 0, clearSelection: () => selection.clear() }); };` — add to `EditorRuntime` and the return.

`TemporaryToolBanner.vue`: a `TASKS: Readonly<Partial<Record<ToolId, { nameKey: StringKey; instructionKey: StringKey }>>>` table with `draw-polygon` and `calibrate`; `v-if` on the active tool having an entry; `<div class="rp-task-banner" role="status" :aria-label="tr('editor.task.banner')"><strong>{{ name }}</strong><span>{{ instruction }}</span><button type="button" @click="runtime.cancelActiveTask()">{{ tr('editor.task.cancel') }}</button></div>`. Mounted in the root's canvas overlay slot at the top edge. Styles: `.rp-task-banner` positioned `top: var(--size-4-2)`, centred, `--background-secondary`, border, shadow.

- [ ] **Step 4: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(shell): a visible banner for the active creation task, with Cancel"
```

### Task 19: the responsive shell — rail, overlay, drawer, unsupported width, `focusLeaf`

**Files:**
- Create: `src/presentation/editor/shell/ResponsiveEditorShell.vue`, `PanelRail.vue`, `OverlayPanel.vue`, `InspectorDrawer.vue`, `UnsupportedWidthNotice.vue`
- Modify: `PlanEditorRoot.vue` (composes the shell), `PlanEditorContext.ts` (`focusLeaf`), `PlanEditorView.ts` (`focusLeaf: () => { void this.app.workspace.revealLeaf(this.leaf); }`), `tests/helpers/editor.ts` (`focusedLeaf()` counter beside `closedLeaf()`), `tests/harness/planEditor.ts` and `tests/harness/fixture.ts` (context literals gain `focusLeaf`), `styles/editor-shell.css`, `styles/editor.css` (`.rp-editor-body` gets `[data-layout]` variants), `en.ts`, `de.ts`
- Test: `tests/presentation/editor/shell/responsiveShell.test.ts`

**Interfaces:**
- Consumes: `layoutModeFor`, `WorkspaceStore.setLayoutMode/openOverlay/closeOverlay/overlay/layoutMode` (Task 8), `installResizeObserver`/`resizeTo` (`tests/helpers/layout.ts`).
- Produces: `PlanEditorContext.focusLeaf(): void`. Root element carries `data-layout="full|constrained|unsupported"`. Classes `.rp-panel-rail`, `.rp-panel-rail__button`, `.rp-overlay-panel`, `.rp-inspector-drawer`, `.rp-unsupported-width`.
- Strings: `editor.rail.layers` ("Layers"/"Ebenen"), `editor.rail.details` ("Details"/"Details"), `editor.overlay.close` ("Close panel"/"Panel schließen"), `editor.unsupported-width.headline` ("This pane is too narrow to edit the floor plan"/"Dieser Bereich ist zu schmal, um den Grundriss zu bearbeiten"), `editor.unsupported-width.body` ("{floor} has {rooms} rooms. Widen the pane or focus this tab to edit."/"{floor} hat {rooms} Räume. Vergrößern Sie den Bereich oder fokussieren Sie diesen Tab, um zu bearbeiten."), `editor.unsupported-width.action` ("Focus this tab"/"Diesen Tab fokussieren").

- [ ] **Step 1: Failing tests**

```ts
it('moves from full to constrained without remounting the canvas', async () => {
	const harness = await mountPlanEditorCanvas();          // helper already calls resizeTo(root, 1280, 800) — read it
	const canvasBefore = harness.canvasEl;
	resizeTo(rootEl(harness), 460, 800); await settle();
	expect(rootEl(harness).dataset.layout).toBe('constrained');
	expect(harness.wrapper.find('.rp-editor-layers').exists()).toBe(false);
	expect(harness.wrapper.find('.rp-panel-rail').exists()).toBe(true);
	expect(harness.wrapper.find('.rp-plan-canvas').element).toBe(canvasBefore);   // same instance
});
it('keeps selection and viewport across the change', async () => { /* select, zoom, resize, assert both unchanged */ });
it('opens one overlay at a time from the rail, closes on Escape, and returns focus to the rail button', async () => {
	const harness = await mountPlanEditorCanvas();
	resizeTo(rootEl(harness), 460, 800); await settle();
	const layersButton = harness.wrapper.find('button[data-rp-rail="layers"]');
	await layersButton.trigger('click'); await settle();
	expect(harness.wrapper.find('.rp-overlay-panel .rp-layer-list').exists()).toBe(true);
	await harness.wrapper.find('button[data-rp-rail="details"]').trigger('click'); await settle();
	expect(harness.wrapper.find('.rp-overlay-panel').exists()).toBe(false);
	expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(true);
	harness.wrapper.find('.rp-inspector-drawer').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await settle();
	expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false);
	expect(document.activeElement?.getAttribute('data-rp-rail')).toBe('details');
});
it('below the floor width replaces the canvas with a summary and a Focus this tab action that asks the leaf', async () => {
	const harness = await mountPlanEditorCanvas();
	resizeTo(rootEl(harness), 320, 800); await settle();
	expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(false);
	expect(harness.wrapper.find('.rp-unsupported-width').text()).toContain('Ground floor');
	await harness.wrapper.find('.rp-unsupported-width button').trigger('click');
	expect(harness.focusedLeaf()).toBe(1);
	resizeTo(rootEl(harness), 1280, 800); await settle();
	expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
});
it('disconnects its observer on unmount', async () => { /* connectedObservers() before/after unmount */ });
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

`ResponsiveEditorShell.vue` — props: none; slots: `context-bar`, `panel`, `canvas`, `inspector`, `warnings`, `status`. Owns `const root = ref<HTMLElement|null>(null)` with a `ResizeObserver` (created in `onMounted`, `disconnect()` in `onBeforeUnmount`) whose callback reads `root.value.clientWidth` and calls `workspace.setLayoutMode(layoutModeFor(width))`. Template:

```vue
<div ref="root" class="rp-editor-shell" :data-layout="layoutMode">
	<slot name="context-bar" />
	<div class="rp-editor-body">
		<template v-if="layoutMode === 'full'">
			<slot v-if="layersPanelOpen" name="panel" />
			<slot name="canvas" />
			<slot v-if="inspectorPanelOpen" name="inspector" />
		</template>
		<template v-else-if="layoutMode === 'constrained'">
			<PanelRail />
			<slot name="canvas" />
			<OverlayPanel v-if="overlay === 'layers'" @close="closeOverlay('layers')"><slot name="panel" /></OverlayPanel>
			<InspectorDrawer v-else-if="overlay === 'inspector'" @close="closeOverlay('inspector')"><slot name="inspector" /></InspectorDrawer>
		</template>
		<UnsupportedWidthNotice v-else />
	</div>
	<slot name="warnings" />
	<slot name="status" />
</div>
```

**The canvas slot must render the same `<PlanCanvas>` vnode in `full` and `constrained`.** With two `<slot name="canvas" />` sites under `v-if`/`v-else-if`, Vue will REMOUNT it on the switch — the test above will fail, and that failure is the point. Render the canvas slot ONCE, outside the branches, and let CSS order the rail/panels around it: use `order` in the flex row (`.rp-panel-rail { order: 0 } .rp-plan-canvas { order: 1 } .rp-editor-layers { order: 0 } .rp-editor-inspector { order: 2 }`) so the template is

```vue
<div class="rp-editor-body">
	<slot v-if="layoutMode === 'full' && layersPanelOpen" name="panel" />
	<PanelRail v-if="layoutMode === 'constrained'" />
	<slot v-if="layoutMode !== 'unsupported'" name="canvas" />
	<slot v-if="layoutMode === 'full' && inspectorPanelOpen" name="inspector" />
	<OverlayPanel v-if="layoutMode === 'constrained' && overlay === 'layers'" …><slot name="panel" /></OverlayPanel>
	<InspectorDrawer v-if="layoutMode === 'constrained' && overlay === 'inspector'" …><slot name="inspector" /></InspectorDrawer>
	<UnsupportedWidthNotice v-if="layoutMode === 'unsupported'" />
</div>
```

`closeOverlay(kind)` calls `workspace.closeOverlay()` and then focuses `root.value?.querySelector<HTMLElement>(\`[data-rp-rail="${kind === 'layers' ? 'layers' : 'details'}"]\`)`.

`PanelRail.vue`: two `<button type="button" data-rp-rail="layers|details" :aria-expanded="overlay === …" @click="workspace.openOverlay(…)">` with `tr('editor.rail.layers')` / `tr('editor.rail.details')` — text labels, no icons.

`OverlayPanel.vue` / `InspectorDrawer.vue`: a positioned container (`position: absolute; inset: 0 auto 0 0` for the overlay, `inset: 0 0 0 auto` for the drawer, `width: min(17rem, 80%)`, `--background-secondary`, border, shadow), `@keydown.esc.stop="emit('close')"`, a labelled close button (`tr('editor.overlay.close')`), `tabindex="-1"` on the container and `focus()` it in `onMounted` so Escape is heard immediately. No focus trap (spec §5.5).

`UnsupportedWidthNotice.vue`: reads `ProjectStore.plan` and the room count via `buildFloorSummary` (Task 7); renders headline, body with `{floor}` and `{rooms}` params, and `<button type="button" @click="context.focusLeaf()">`.

`PlanEditorContext.ts`: add `focusLeaf(): void;` with a docblock mirroring `closeLeaf`'s. `PlanEditorView.mount`: `focusLeaf: () => { void this.app.workspace.revealLeaf(this.leaf); }`. `tests/helpers/editor.ts`: `let focusedLeaf = 0; … focusLeaf: () => { focusedLeaf += 1; }` and expose `focusedLeaf: () => focusedLeaf`. Harness context literals: `focusLeaf: () => {}`.

`PlanEditorRoot.vue`: replace the hand-written `.rp-editor-body` block with `<ResponsiveEditorShell>` and its six named slots; the warning notices stay where they are until Task 20.

- [ ] **Step 4: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(shell): full, constrained and unsupported layouts around one canvas instance"
```

### Task 20: keyed persistent warnings, and the status bar's scale state

**Files:**
- Create: `src/presentation/editor/shell/warnings.ts`, `PersistentWarningStrip.vue`
- Modify: `PlanEditorRoot.vue` (the four `<p class="rp-editor-notice">` become one `<PersistentWarningStrip :warnings="warnings" />`), `StatusBar.vue`, `styles/editor-status.css`, `en.ts`, `de.ts`, `tests/presentation/editor/unreadableZonesNotice.test.ts` (selectors), `tests/presentation/editor/shell.test.ts`
- Test: `tests/presentation/editor/shell/warnings.test.ts`, `tests/presentation/editor/shell/statusBar.test.ts`

**Interfaces:**
- Produces:

```ts
export type WarningId = 'stale' | 'unreadable-zones' | 'background-missing' | 'background-unreadable';
export interface EditorWarning { readonly id: WarningId; readonly messageKey: StringKey; readonly params?: Readonly<Record<string, string>>; }
export function editorWarnings(input: { readonly stale: boolean; readonly unreadableZones: number; readonly backgroundStatus: BackgroundStatus }): readonly EditorWarning[];   // fixed order: stale, unreadable-zones, background-*
```

- Strings: `editor.status.scale.calibrated` ("Scale set"/"Maßstab festgelegt"), `editor.status.scale.uncalibrated` ("Scale not set"/"Maßstab nicht festgelegt"), `editor.hint.pan` ("Hold Space or the middle button to pan"/"Leertaste oder mittlere Maustaste halten, um zu verschieben").

- [ ] **Step 1: Failing tests**

`warnings.test.ts`: an input with `stale: true, unreadableZones: 2, backgroundStatus: 'missing'` yields three warnings in the fixed order with ids `['stale','unreadable-zones','background-missing']` and the unreadable one carries `params: { count: '2' }`; `backgroundStatus: 'unreadable'` yields `background-unreadable` and never both background ids; all-clear yields `[]`.

`shell.test.ts`: mount with `unreadableZones: 1` and drive `stale` true (`useProjectStore().stale = true` — check the field is writable from a test as `unreadableZonesNotice.test.ts` does); assert TWO `.rp-warning-strip__item[role="status"]` elements exist with `data-rp-warning` attributes `stale` and `unreadable-zones`; set `stale = false`; assert exactly one remains and it is `unreadable-zones`.

`statusBar.test.ts`: uncalibrated fixture shows `editor.status.scale.uncalibrated`; a plan with a `calibration` shows `…calibrated`; under `layoutMode === 'constrained'` the pointer readout element is absent while zoom, scale and save state remain; the pan hint shows when `activeToolId === 'select'`.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

`warnings.ts` builds the array in the fixed order from the three inputs (message keys are the existing `editor.refresh-failed`, `editor.some-zones-unreadable`, `editor.background-missing`, `editor.background-failed`). `PersistentWarningStrip.vue` renders `<div class="rp-warning-strip"><p v-for="w in warnings" :key="w.id" class="rp-warning-strip__item" role="status" :data-rp-warning="w.id">{{ tr(w.messageKey, w.params) }}</p></div>` — `:key="w.id"` is what keeps one warning's identity when another arrives. Move the `.rp-editor-notice` rule to `.rp-warning-strip__item` in `editor.css`. In the root: `const warnings = computed(() => editorWarnings({ stale: staleAfterRefresh.value, unreadableZones: unreadableZones.value, backgroundStatus: backgroundStatus.value }));`.

`StatusBar.vue`: add `scaleText = computed(() => tr(plan.value?.calibration ? 'editor.status.scale.calibrated' : 'editor.status.scale.uncalibrated'))` in the measurements group; wrap the pointer readout in `v-if="layoutMode !== 'constrained'"` (read `layoutMode` from `WorkspaceStore`); show `editor.hint.pan` in the status group when `props.activeToolId === 'select'`, beside the existing constraint hint.

- [ ] **Step 4: Check and commit**

```bash
npm run check
git add -A src styles tests
git commit -m "feat(shell): warnings as a keyed collection; the status bar says whether the scale is set"
```

---

# Wave 4 — instruments and records

### Task 21: harness knobs and three fixed captures

**Files:**
- Modify: `tests/harness/page.ts`, `tests/harness/planEditor.ts` (`mountPlanEditorHarness` gains `{ select?: string; add?: boolean }` options read from the URL), `scripts/harness-shot.mjs` (`SHOTS`), `tests/harness/harness.test.ts` (the fixed-shot presence case)
- Test: `tests/harness/harness.test.ts`

**Interfaces:**
- `?view=plan-editor&select=harness-kitchen` mounts the editor and, once `ready`, calls `runtime.selectAndFrame('harness-kitchen')` — through the store the view's Vue tree provides (`mountPlanEditorHarness` can `await settleUntil(() => document.querySelector('.rp-room-list__row') !== null)` and then click the row whose text matches, which drives the REAL door rather than reaching into the runtime). `?view=plan-editor&add` clicks the Add button after ready.
- New `SHOTS` entries:

```js
{ name: 'plan-editor-selected', query: '?view=plan-editor&select=harness-kitchen&theme=light', selector: '.rp-room-inspector' },
{ name: 'plan-editor-add-menu', query: '?view=plan-editor&add&theme=light', selector: '.rp-add-menu' },
{ name: 'plan-editor-narrow', query: '?view=plan-editor&theme=light', selector: PLAN_EDITOR_VIEW, width: 460 },
```

- [ ] **Step 1: Failing test** — in `harness.test.ts`, extend the case that asserts the fixed shots exist to name the three new entries, and add a jsdom case that `mountPlanEditorHarness(document.body, { select: 'harness-kitchen' })` reaches `.rp-room-inspector[data-rp-id="harness-kitchen"]` (the same shape as the `?project=` case slice 21 added).

- [ ] **Step 2: Implement**, run `npm run check`, then:

```bash
npm run harness-shot
```

Open `harness-shots/plan-editor-light.png`, `plan-editor-selected.png`, `plan-editor-add-menu.png`, `plan-editor-narrow.png` with the Read tool and LOOK: the context bar reads `Willow House › Ground floor`; Select and Add float at the bottom centre; the floor summary shows counts and two "Not available yet" rows; the narrow shot shows a rail, a canvas wider than nothing, and no horizontal scrollbar; the menu shows three groups with Room first and the others dimmed with a reason. Record what you saw — and anything wrong — in the commit message. If Chromium is absent, follow `scripts/chromium.mjs`'s message (`RP_CHROMIUM_EXECUTABLE`), and if no browser can be named, say in the commit and in Task 24's CLAUDE.md section that the captures were NOT taken.

- [ ] **Step 3: Commit**

```bash
git add -A tests/harness scripts/harness-shot.mjs
git commit -m "harness: ?select and ?add knobs, three fixed plan-editor captures, read by eye"
```

### Task 22: accessibility cases

**Files:**
- Modify: `tests/harness/accessibility.test.ts`

- [ ] **Step 1: Add six cases** in the "axe against the mounted view" describe, each following the existing plan-editor case's shape (mount, assert the subject is PRESENT above `axe.run`, scan, expect no violations):

1. `full` layout with the context bar and floating actions: assert `.rp-context-bar` and `.rp-primary-actions` present.
2. Add menu open: click the Add button, `await settle()`, assert `[role="menu"]` present, scan.
3. `constrained` with the Layers overlay open: `resizeTo(root, 460, 800)`, click `[data-rp-rail="layers"]`, assert `.rp-overlay-panel` present, scan.
4. `constrained` with the Inspector drawer open and a room selected: assert `.rp-inspector-drawer .rp-room-inspector` present, scan.
5. Room Inspector in `full` with a selection: assert `.rp-question-nav` present and `.rp-question-nav button` ABSENT, scan.
6. `unsupported` width: `resizeTo(root, 320, 800)`, assert `.rp-unsupported-width button` present, scan.

- [ ] **Step 2: Run** `npx vitest run tests/harness/accessibility.test.ts`; fix every violation at its source (an `aria-describedby` pointing at a missing id, a `role="menu"` without an accessible name, a `<dl>` whose children are not `dt`/`dd`), never by widening `runOptions`.

- [ ] **Step 3: Commit** — `git commit -am "test(a11y): six scans over the new shell states"`.

### Task 23: manual test case, and the Canvas Navigation case

**Files:**
- Create: `docs/tests/cases/Open a floor and select a room.md` (frontmatter like `Navigate into a project and back.md`: `type: Test case`, `parent: "[[Smoke Test the Editor]]"`, next free `order`, `status: Ready`, sources M00, M01, M02, M16)
- Modify: `docs/tests/cases/Canvas Navigation.md` (the Pan button no longer exists; the step that pressed it now says pan is Space/middle-button only and reads the status hint)

- [ ] **Step 1: Write the case** with numbered steps and expected results, a Runs table with one empty row, and a "Why a human is the only instrument" section listing: whether Obsidian's own keymap fires behind the open Add menu (`Ctrl+P` on top of it), whether focus really returns to the rail button after the drawer closes in Electron, whether the leaf at real sidebar width lands in `constrained`, and whether `Focus this tab` reveals the leaf. Steps: 1 open a plan via the palette → Select pressed, nothing selected, floor summary visible; 2 hover Kitchen → outline and pointer cursor; 3 click Kitchen → Room Inspector shows Kitchen, type Room, Ground floor, area; question rows read Not available yet; 4 Escape → floor summary, guidance announced (screen reader on); 5 click Kitchen in the list → selected and framed; 6 Add → menu, Room focused, arrow keys, Escape; 7 Add → Room → banner, three clicks, close → Kitchen 2 selected, Select pressed; 8 drag the leaf to sidebar width → rail, canvas, selection kept; 9 open Layers overlay, Escape → focus on rail button; 10 narrow below 400px → summary and Focus this tab.

- [ ] **Step 2: Commit** — `git add docs/tests && git commit -m "docs(tests): the manual case for the editor's read path and selection"`.

### Task 24: statuses, CLAUDE.md, and the smoke suite

**Files:**
- Modify: `docs/requirements/Consolidate the current and target editor data models.md` (`status: Done`), `Open a floor plan in the Obsidian editor shell.md`, `View rooms in the Standard Plan View.md`, `Layers.md`, `Selection.md`, `Inspect a selected room.md`, `Start one creation task from Add.md` (`status: Active`, with a dated `## Amendments` section listing which acceptance criteria this increment met and which remain — the compact status bar's View menu, overlap cycling, the rest of the Add lifecycle's repeat option), `Editor foundation.md` (`status: Active`, `started: 2026-09-02`)
- Modify: every task under those PBIs that this increment closed (`status: Done`) — the list is spec §1's table; a task only partly done gets `Active` and a one-line amendment
- Modify: `docs/tests/suites/Smoke Test the Editor.md` (link the new case), `CLAUDE.md` (a section "**The plan editor foundation's first increment has landed: the read path and selection.**" placed after the currency-increment section, ~40 lines: what shipped, that Select is the default and the toolbar is gone, where Calibrate went, the layout thresholds and that they are judgements checked by capture, the seven-section unavailable rule, the deferred ADRs, and the rules that came out of the review rounds — written from what actually happened, not from this plan)

- [ ] **Step 1: Make the edits.** For each task marked Done, re-read its acceptance criteria against the code and name the test that holds each; a criterion no test holds is an amendment, not a tick.

- [ ] **Step 2: Commit** — `git add docs CLAUDE.md && git commit -m "docs: Editor foundation statuses, amendments, and CLAUDE.md's account of the increment"`.

### Task 25: finish

- [ ] **Step 1:** `npm run check` on the whole tree, serially if a `tests/build/` file times out (`npx vitest run --no-file-parallelism` is the diagnostic, not the remedy).
- [ ] **Step 2:** `npm run test:coverage` and compare the four figures against `vitest.config.ts`'s floors; if a rounded-down figure exceeds a floor, ratchet it per that file's own policy and commit.
- [ ] **Step 3:** `npm run build` and record `dist/main.js`'s size in CLAUDE.md's new section beside slice 19's figure.
- [ ] **Step 4:** Invoke `superpowers:finishing-a-development-branch`.

---

## Self-review (run by the plan's author before handing off)

**Spec coverage.** §2.1→T1, §2.2→T2, §2.3/§2.5→T4, §2.4→T4+T3, §3→T6+T7, §4→T8+T10+T11+T19 (`focusLeaf`), §5.1 every component→T13/T14/T15/T16/T18/T19/T20, §5.2→T13, §5.3→T14, §5.4/§5.5→T19, §5.6→T13 (slot, no switch), §5.7→T20, §6.1/§6.2→T11+T12, §6.3→T9, §6.4/§6.5→T12, §6.6→T15, §6.7→T16, §7→T17+T18+T10, §8→every task's string list, §9→wave order + T5, §10 harness/a11y/manual→T21/T22/T23, statuses and CLAUDE.md→T24. No section is without a task.

**Placeholder scan.** Every test body above is code or a one-line description of the exact assertion beside a code sibling in the same task; every string has both locales; the one open lookup (`Language`/`t` export names in T17, `stageSize` in T12, CalibrateTool field names in T9) is stated as a lookup with the command that answers it.

**Type consistency.** `SpatialRecordDto`/`buildFloorSummary`/`buildRoomOverview` (T7) are what T15, T16 and T19 import; `layoutModeFor`/`setLayoutMode`/`openOverlay`/`closeOverlay` (T8) are what T19 and T20 call; `hasDraft`/`routeEscape`/`activeToolHasDraft` (T9) are what T18's `cancelActiveTask` and the surface call; `selectAndFrame` (T12) is what T15's list and T21's knob call; `returnToSelect`/`onCompleted` (T10) match; `focusLeaf` (T19) is what T19's notice and the harness literals carry.

**Known cost stated up front.** Deleting the toolbar (T13) reddens `shell.test.ts`, `calibrateWiring.test.ts`, `planEditorRig.ts`'s `toolbarButton` and the three `tests/build/` button rules; T13 and T14 name each. The rebase gate (T5) is a hard stop, not a step to reason past.
