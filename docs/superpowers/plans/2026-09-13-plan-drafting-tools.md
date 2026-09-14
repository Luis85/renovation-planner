# Plan Drafting Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a renovator draw an architect-style floor plan's drafting marks — dimension chains, section lines, view markers, hatched areas, text, boundary lines and grid points — from a Drafting submenu in the canvas right-click menu.

**Architecture:** Seven new `SpatialElementKind`s ride the existing element pipeline (one `ElementTool` class, the guarded renovation command, undo, move, clipboard, groups, removal). A `dimension` stores its tick points plus an `offset`; a `section` stores two points plus `flipped`. Lengths are derived by the pure `dimensionChain`. Drafting kinds are excluded from renovation targets and quantity sources through one predicate, `draftingKind`. The geometry sidecar gains schema 12. Rendering goes through one pure layout module (`draftingMarks.ts`) and one flat component (`DraftingShape.vue`).

**Tech Stack:** TypeScript, Vue 3 SFCs, vue-konva, zod, Vitest (node and jsdom), Obsidian API mock.

**Spec:** `docs/superpowers/specs/2026-09-13-plan-drafting-tools-design.md`

## Global Constraints

- `CLAUDE.md` is authoritative. Layer bans stay in force: `domain/` imports nothing from `presentation/`, `application/` or `infrastructure/`.
- Inner loop per task: `npm run check:fast -- <paths>`. `npm run check` runs in CI on the pull request, not locally.
- If `node_modules` in this worktree is empty, run `npm ci` once before the first test run.
- Tabs for indentation. The edit hook lints every file you write; answer its findings before moving on.
- Budgets: 400 lines per `src/` file, 100 lines per function, complexity 16. `tests/` files 450 lines.
- Every user-visible string goes through `tr`/`t` with an `en` key and a `de` key (`de` modules are `Record<keyof typeof …En, string>`). Sentence case.
- No literal colours. Canvas colours come from `ThemeTokens` (`accent`, `zoneStroke`, `zoneLabel`, `canvasBackground`).
- Kinds, verbatim: `dimension`, `section`, `view`, `hatch`, `text`, `boundary`, `grid`. Tool ids: `draw-dimension`, `draw-section`, `place-view`, `draw-hatch`, `place-text`, `draw-boundary`, `place-grid`.
- `offset` is finite with `abs ≤ 1e6` mm and belongs to `dimension` only; `flipped` is a boolean and belongs to `section` only.
- Default names: section `S-01`, `S-02`…; view `A-01`…; grid `1`, `2`…; text empty; dimension, hatch, boundary their kind label.
- Screen sizes: text 14 px, dimension text 11 px, grid circle radius 10 px, marker triangle 10 px, boundary dash `16 / 8` px, section dash `12 / 3 / 2 / 3` px.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. This overrides any model name an implementer would write for itself.

## File map

| File | Responsibility |
| --- | --- |
| `src/domain/spatial/SpatialElement.ts` | kinds, `offset`/`flipped`, `draftingKind`, `pointKind`, validation |
| `src/domain/spatial/dimensionChain.ts` (new) | projected feet and segment lengths; offset of a point |
| `src/domain/spatial/markNames.ts` (new) | next free `S-01` / `A-01` / `1` name |
| `src/domain/renovation/renovationTargets.ts`, `src/domain/requirement/RequirementSource.ts` | exclusions |
| `src/infrastructure/persistence/dto/planGeometry.ts`, `…/migration/geometry/plan/plan-geometry.migrations.ts`, `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts`, `src/application/commands/spatial/sameGeometryDocument.ts` | schema 12 |
| `src/presentation/editor/elements/elementDraft.ts`, `elementTask.ts`, `elementBaseline.ts` | tools, draft, gestures, `startAt` |
| `src/presentation/i18n/locales/{en,de}/drafting.ts` (new) | vocabulary |
| `src/presentation/editor/elements/draftingMarks.ts` (new), `DraftingShape.vue` (new) | layout and drawing; hit boxes |
| `src/presentation/editor/elements/DraftingDraftFields.vue` (new) | Offset field while placing a chain's line |
| `src/presentation/editor/elements/dimensionInput.ts` (new), `DimensionEditForm.vue` (new) | editing a chain's offset |
| `src/presentation/editor/selection/draftingMenuActions.ts` (new) | Drafting submenu and Flip direction |
| `src/plugin/editorIconRegistration.ts` | seven `rp-` icons |
| `tests/helpers/drafting.ts` (new) | one fixture per kind |
| `tests/harness/draftingWorkspace.ts` (new) | `?drafting` harness knob |

---

### Task 1: Domain facts for drafting marks

**Files:**
- Create: `src/domain/spatial/dimensionChain.ts`
- Create: `src/domain/spatial/markNames.ts`
- Modify: `src/domain/spatial/SpatialElement.ts`
- Modify: `src/domain/spatial/structureGeometry.ts` (`scaleStructure`)
- Modify: `src/domain/renovation/renovationTargets.ts` (`spatialIds`)
- Modify: `src/domain/requirement/RequirementSource.ts` (`measurement`)
- Test: `tests/domain/spatial/draftingMarks.test.ts`

**Interfaces:**
- Produces, from `SpatialElement.ts`:
  - `SpatialElementKind` gains `'dimension' | 'section' | 'view' | 'hatch' | 'text' | 'boundary' | 'grid'`.
  - `SpatialElement` gains `readonly offset?: number` and `readonly flipped?: boolean`.
  - `draftingKind(kind: string | undefined): boolean` — true for the seven.
  - `pointKind(kind: string | undefined): boolean` — true for `'text' | 'grid'`.
  - `outlineKind` is now true for `'object' | 'post' | 'hatch'`.
- Produces, from `dimensionChain.ts`:
  - `interface DimensionChain { readonly direction: Point; readonly normal: Point; readonly feet: readonly Point[]; readonly lengths: readonly number[] }`
  - `dimensionChain(points: readonly Point[], offset: number): DimensionChain | null`
  - `dimensionOffsetAt(points: readonly Point[], point: Point): number`
- Produces, from `markNames.ts`: `nextMarkName(kind: string, taken: readonly string[]): string | null`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/spatial/draftingMarks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { draftingKind, outlineKind, pointKind, validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { dimensionChain, dimensionOffsetAt } from '../../../src/domain/spatial/dimensionChain';
import { nextMarkName } from '../../../src/domain/spatial/markNames';
import { scaleStructure } from '../../../src/domain/spatial/structureGeometry';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { EMPTY_RENOVATION, type RenovationSubject } from '../../../src/domain/renovation/Renovation';
import { validateRenovationTargets } from '../../../src/domain/renovation/renovationTargets';
import { sourceMeasurement, type RequirementSource } from '../../../src/domain/requirement/RequirementSource';

const dimension: SpatialElement = { id: 'element-dimension', kind: 'dimension', offset: -500, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 1940, y: 300 }, { x: 4560, y: 0 }] };
const section: SpatialElement = { id: 'element-section', kind: 'section', flipped: false, points: [{ x: -500, y: 2000 }, { x: 5000, y: 2000 }] };
const view: SpatialElement = { id: 'element-view', kind: 'view', points: [{ x: -800, y: 1000 }, { x: -300, y: 1000 }] };
const hatch: SpatialElement = { id: 'element-hatch', kind: 'hatch', points: [{ x: 0, y: 5000 }, { x: 3000, y: 5000 }, { x: 3000, y: 7000 }, { x: 0, y: 7000 }] };
const text: SpatialElement = { id: 'element-text', kind: 'text', points: [{ x: 1500, y: 1500 }] };
const boundary: SpatialElement = { id: 'element-boundary', kind: 'boundary', points: [{ x: -2000, y: -1000 }, { x: 6000, y: -1500 }] };
const grid: SpatialElement = { id: 'element-grid', kind: 'grid', points: [{ x: 6500, y: 0 }] };
const path: SpatialElement = { id: 'element-path', kind: 'path', points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };

describe('drafting marks in the domain', () => {
	it('names the seven drafting kinds, the two one-point kinds, and a hatch as an outline', () => {
		expect([dimension, section, view, hatch, text, boundary, grid].every(item => draftingKind(item.kind))).toBe(true);
		expect(['object', 'path', 'measurement', 'post', 'beam', undefined].some(kind => draftingKind(kind))).toBe(false);
		expect(['text', 'grid'].every(kind => pointKind(kind))).toBe(true);
		expect(['dimension', 'view', undefined].some(kind => pointKind(kind))).toBe(false);
		expect(outlineKind('hatch')).toBe(true);
	});

	it('holds every drafting kind to its own points and fields, and every other kind to neither field', () => {
		for (const value of [dimension, section, view, hatch, text, boundary, grid]) expect(validSpatialElement(value), value.kind).toBe(true);
		const refused: SpatialElement[] = [
			{ ...dimension, offset: undefined }, { ...dimension, offset: Number.NaN }, { ...dimension, offset: 2e6 },
			{ ...dimension, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 0 }] },
			{ ...section, flipped: undefined }, { ...section, points: [...section.points, { x: 6000, y: 2000 }] },
			{ ...view, points: [...view.points, { x: 0, y: 1000 }] },
			{ ...hatch, points: hatch.points.slice(0, 2) },
			{ ...text, points: [] }, { ...text, points: [...text.points, { x: 0, y: 0 }] }, { ...grid, points: [...grid.points, { x: 0, y: 0 }] },
			{ ...boundary, points: boundary.points.slice(0, 1) },
			{ ...path, offset: 100 }, { ...path, flipped: true }, { ...text, offset: 10 },
		];
		for (const value of refused) expect(validSpatialElement(value), JSON.stringify(value)).toBe(false);
	});

	it('projects a chain onto its first-to-last line and measures every segment there', () => {
		expect(dimensionChain(dimension.points, -500)).toMatchObject({
			feet: [{ x: 0, y: -500 }, { x: 1190, y: -500 }, { x: 1940, y: -500 }, { x: 4560, y: -500 }],
			lengths: [1190, 750, 2620],
		});
		expect(dimensionChain([...dimension.points].reverse(), 500)?.lengths).toEqual([2620, 750, 1190]);
		expect(dimensionChain([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 400 }, { x: 3000, y: 0 }], 0)?.lengths).toEqual([1000, 0, 2000]);
		expect(dimensionChain([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 0 }], 0)).toBeNull();
		expect(dimensionChain([{ x: 0, y: 0 }], 0)).toBeNull();
	});

	it('reads a point\'s signed distance from the chain\'s line', () => {
		expect(dimensionOffsetAt(dimension.points, { x: 2000, y: -500 })).toBe(-500);
		expect(dimensionOffsetAt(dimension.points, { x: 2000, y: 800 })).toBe(800);
		expect(dimensionOffsetAt([{ x: 0, y: 0 }], { x: 2000, y: 800 })).toBe(0);
	});

	it('names the next free section, view and grid marker, and nothing for a kind named by its label', () => {
		expect(nextMarkName('section', [])).toBe('S-01');
		expect(nextMarkName('section', ['S-01', 'S-03'])).toBe('S-02');
		expect(nextMarkName('view', ['A-01'])).toBe('A-02');
		expect(nextMarkName('grid', ['1', ' 2 '])).toBe('3');
		expect(nextMarkName('dimension', [])).toBeNull();
	});

	it('scales a chain\'s offset with calibration and keeps a section\'s look side', () => {
		const scaled = scaleStructure({ ...EMPTY_STRUCTURE, elements: [dimension, section] }, 2);
		expect(scaled.elements?.[0]).toMatchObject({ offset: -1000, points: [{ x: 0, y: 0 }, { x: 2380, y: 0 }, { x: 3880, y: 600 }, { x: 9120, y: 0 }] });
		expect(scaled.elements?.[1]).toMatchObject({ flipped: false });
		expect(scaled.elements?.[1]).not.toHaveProperty('offset');
	});

	it('refuses a renovation record or a quantity on a drafting mark, and keeps both for a path', () => {
		const structure = { ...EMPTY_STRUCTURE, elements: [path, dimension] };
		const subject = (targetId: string): RenovationSubject => ({ id: 'detail-mark', targetId, kind: 'wall', existing: { description: 'Mark', condition: 'good' } });
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [subject(path.id)] }, { roomIds: [], structure }).ok).toBe(true);
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [subject(dimension.id)] }, { roomIds: [], structure })).toMatchObject({ ok: false, error: { code: 'renovation.source-missing' } });
		const source: RequirementSource = { planId: 'plan', targetId: path.id, workId: '', outcomeId: '', state: 'current', rule: 'count', manual: '', coverage: '1', lot: '', minimum: '' };
		const geometry = { objects: [], structure };
		expect(sourceMeasurement(source, 'room', geometry, 'piece').ok).toBe(true);
		expect(sourceMeasurement({ ...source, targetId: dimension.id }, 'room', geometry, 'piece').ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/domain/spatial/draftingMarks.test.ts`
Expected: FAIL. Type errors for the missing modules `dimensionChain` and `markNames`, for `draftingKind`/`pointKind` not exported, and for `'dimension'` not being a `SpatialElementKind`.

- [ ] **Step 3: Create `src/domain/spatial/dimensionChain.ts`**

```ts
import type { Point } from '../../core/geometry/Point';

/** A dimension chain laid out on its line (plan drafting tools design §3). */
export interface DimensionChain {
	/** Unit vector from the first point toward the last. */
	readonly direction: Point;
	/** Unit normal; a positive offset points this way. */
	readonly normal: Point;
	/** Each point's foot on the dimension line, in point order. */
	readonly feet: readonly Point[];
	/** The projected length between consecutive points, world mm; 0 where two project onto each other. */
	readonly lengths: readonly number[];
}

function frame(points: readonly Point[]): { origin: Point; direction: Point; normal: Point } | null {
	const origin = points[0], last = points.at(-1);
	if (!origin || !last || points.length < 2) return null;
	const length = Math.hypot(last.x - origin.x, last.y - origin.y);
	if (!(length > 0)) return null;
	const direction = { x: (last.x - origin.x) / length, y: (last.y - origin.y) / length };
	return { origin, direction, normal: { x: -direction.y, y: direction.x } };
}

/** The only source of a chain's lengths: every point projected onto the first-to-last line; nothing stores one. */
export function dimensionChain(points: readonly Point[], offset: number): DimensionChain | null {
	const axis = frame(points);
	if (!axis) return null;
	const { origin, direction, normal } = axis;
	const along = points.map(point => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y);
	const feet = along.map(value => ({ x: origin.x + direction.x * value + normal.x * offset, y: origin.y + direction.y * value + normal.y * offset }));
	return { direction, normal, feet, lengths: along.slice(1).map((value, index) => Math.abs(value - along[index])) };
}

/** A point's signed distance from the chain's first-to-last line: the offset a line placed there would have. */
export function dimensionOffsetAt(points: readonly Point[], point: Point): number {
	const axis = frame(points);
	return axis ? (point.x - axis.origin.x) * axis.normal.x + (point.y - axis.origin.y) * axis.normal.y : 0;
}
```

- [ ] **Step 4: Create `src/domain/spatial/markNames.ts`**

```ts
/** Which drafting kinds are named by a sequence, and how (plan drafting tools design §5). */
const SEQUENCES = new Map<string, { readonly prefix: string; readonly digits: number }>([
	['section', { prefix: 'S-', digits: 2 }],
	['view', { prefix: 'A-', digits: 2 }],
	['grid', { prefix: '', digits: 1 }],
]);

/** The lowest free sequence name for `kind` among `taken`, or null for a kind named by its label. */
export function nextMarkName(kind: string, taken: readonly string[]): string | null {
	const sequence = SEQUENCES.get(kind);
	if (!sequence) return null;
	const used = new Set(taken.map(name => name.trim()));
	for (let n = 1; ; n += 1) {
		const name = sequence.prefix + String(n).padStart(sequence.digits, '0');
		if (!used.has(name)) return name;
	}
}
```

- [ ] **Step 5: Extend `src/domain/spatial/SpatialElement.ts`**

Replace the kind union line:

```ts
export type SpatialElementKind = 'object' | 'path' | 'fence' | 'measurement' | 'stair' | 'arrow' | 'asset' | 'post' | 'beam'
	| 'dimension' | 'section' | 'view' | 'hatch' | 'text' | 'boundary' | 'grid';
```

In `interface SpatialElement`, add after `loadBearing`:

```ts
	/** A dimension chain's signed distance from its first-to-last line to its dimension line, world mm. Only a `'dimension'` carries one, and it always does. */
	readonly offset?: number;
	/** Which side a section line looks at. Only a `'section'` carries one, and it always does. */
	readonly flipped?: boolean;
```

Replace the `SPATIAL_ELEMENT_KINDS` line and `outlineKind`:

```ts
const SPATIAL_ELEMENT_KINDS: readonly SpatialElementKind[] = ['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset', 'post', 'beam', 'dimension', 'section', 'view', 'hatch', 'text', 'boundary', 'grid'];
const DRAFTING_KINDS: readonly string[] = ['dimension', 'section', 'view', 'hatch', 'text', 'boundary', 'grid'];

/** Drafting marks: drawn on the plan, never renovation targets or quantity sources (plan drafting tools design §3). */
export function draftingKind(kind: string | undefined): boolean { return kind !== undefined && DRAFTING_KINDS.includes(kind); }
/** Kinds stored as exactly one point. */
export function pointKind(kind: string | undefined): boolean { return kind === 'text' || kind === 'grid'; }
/** Kinds whose stored `points` are themselves a closed outline. */
export function outlineKind(kind: string | undefined): boolean { return kind === 'object' || kind === 'post' || kind === 'hatch'; }
```

Add below `validStructuralFields`:

```ts
/** `offset` belongs to a dimension chain and `flipped` to a section line; the one-point and two-point kinds hold exactly that many. */
function validDraftingFields(element: SpatialElement): boolean {
	if ((element.kind === 'dimension') !== (element.offset !== undefined)) return false;
	if ((element.kind === 'section') !== (typeof element.flipped === 'boolean')) return false;
	if (element.offset !== undefined && !(Number.isFinite(element.offset) && Math.abs(element.offset) <= 1e6)) return false;
	if (pointKind(element.kind)) return element.points.length === 1;
	if (element.kind === 'section' || element.kind === 'view') return element.points.length === 2;
	const first = element.points[0], last = element.points.at(-1);
	return element.kind !== 'dimension' || (!!first && !!last && (first.x !== last.x || first.y !== last.y));
}
```

In `validSpatialElement`, directly after `if (!validStructuralFields(element)) return false;` add:

```ts
	if (!validDraftingFields(element)) return false;
```

and directly before the final `return element.points.length >= 2 && …` line add:

```ts
	if (pointKind(element.kind)) return true;
```

- [ ] **Step 6: Scale the offset in `src/domain/spatial/structureGeometry.ts`**

In `scaleStructure`'s `elements` map, directly after the `...(element.width !== undefined ? { width: element.width * factor } : {}),` spread add:

```ts
...(element.offset !== undefined ? { offset: element.offset * factor } : {}),
```

- [ ] **Step 7: Exclude drafting marks from renovation targets and quantities**

`src/domain/renovation/renovationTargets.ts` — add `import { draftingKind } from '../spatial/SpatialElement';` and replace `spatialIds`:

```ts
/** Rooms, walls, openings and elements a record can name; a drafting mark is never one (plan drafting tools design §3). */
function spatialIds(structure: Structure = EMPTY_STRUCTURE, rooms: readonly string[]): Set<string> {
	const elements = (structure.elements ?? []).filter(item => !draftingKind(item.kind));
	return new Set([...rooms, ...structure.walls.map(item => item.id), ...structure.openings.map(item => item.id), ...elements.map(item => item.id)]);
}
```

`src/domain/requirement/RequirementSource.ts` — add `draftingKind` to the existing import from `'../spatial/SpatialElement'` and replace the last line of `measurement`:

```ts
 const element = structure.elements?.find(item => item.id === source.targetId);
 // A drafting mark measures nothing, so no rule may fall through to a wall or room reading for it.
 if (element && draftingKind(element.kind)) return null;
 return elementMeasurement(source, element) ?? wallMeasurement(source, structure) ?? roomMeasurement(source, roomId, geometry);
```

- [ ] **Step 8: Run the test and confirm it passes, then watch the exclusion fail without its guard**

Run: `npm run check:fast -- tests/domain/spatial/draftingMarks.test.ts tests/domain/spatial/structuralElement.test.ts tests/domain/elementQuantities.test.ts tests/domain/subjectMaterials.test.ts`
Expected: PASS.

Then delete the `if (element && draftingKind(element.kind)) return null;` line, re-run the first file, see the last case go red, and restore the line.

- [ ] **Step 9: Commit**

```bash
git add src/domain/spatial/SpatialElement.ts src/domain/spatial/dimensionChain.ts src/domain/spatial/markNames.ts src/domain/spatial/structureGeometry.ts src/domain/renovation/renovationTargets.ts src/domain/requirement/RequirementSource.ts tests/domain/spatial/draftingMarks.test.ts
git commit -m "Add drafting mark kinds, dimension chain geometry and sequence names to the domain

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 2: Geometry sidecar schema 12

**Files:**
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts`
- Modify: `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts`
- Modify: `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts` (import, `writtenSchema`, `readUnlocked`)
- Modify: `src/application/commands/spatial/sameGeometryDocument.ts`
- Modify: `tests/application/commands/structuralGeometry.test.ts` (schema import)
- Create: `tests/helpers/drafting.ts`
- Test: `tests/application/commands/draftingGeometry.test.ts`

**Interfaces:**
- Consumes: `draftingKind` (Task 1).
- Produces: `PlanGeometrySchemaV12` exported from `planGeometry.ts`; `PlanGeometrySchemaV11` stops being exported. `PlanGeometryDTO['schemaVersion']` includes `12`.
- Produces, from `tests/helpers/drafting.ts`: `DIMENSION_A`, `SECTION_A`, `VIEW_A`, `HATCH_A`, `TEXT_A`, `BOUNDARY_A`, `GRID_A` (each a `NamedSpatialElement`) and `DRAFTING_MARKS` (all seven, in that order).

- [ ] **Step 1: Create the shared fixtures `tests/helpers/drafting.ts`**

```ts
import type { NamedSpatialElement } from '../../src/domain/spatial/SpatialElement';

/** One drafting mark of each kind, apart from one another and from the editor rig's walls' own ids. */
export const DIMENSION_A: NamedSpatialElement = { id: 'element-dimension-a', kind: 'dimension', name: 'Front', offset: -600, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 1940, y: 0 }, { x: 4560, y: 0 }] };
export const SECTION_A: NamedSpatialElement = { id: 'element-section-a', kind: 'section', name: 'S-01', flipped: false, points: [{ x: -1000, y: 2000 }, { x: 6000, y: 2000 }] };
export const VIEW_A: NamedSpatialElement = { id: 'element-view-a', kind: 'view', name: 'A-01', points: [{ x: -1500, y: 1000 }, { x: -800, y: 1000 }] };
export const HATCH_A: NamedSpatialElement = { id: 'element-hatch-a', kind: 'hatch', name: 'Existing', points: [{ x: 0, y: 5000 }, { x: 3000, y: 5000 }, { x: 3000, y: 7000 }, { x: 0, y: 7000 }] };
export const TEXT_A: NamedSpatialElement = { id: 'element-text-a', kind: 'text', name: 'Wintergarten', points: [{ x: 1500, y: 1500 }] };
export const BOUNDARY_A: NamedSpatialElement = { id: 'element-boundary-a', kind: 'boundary', name: 'Plot line', points: [{ x: -2000, y: -1000 }, { x: 6000, y: -1500 }] };
export const GRID_A: NamedSpatialElement = { id: 'element-grid-a', kind: 'grid', name: '1', points: [{ x: 7000, y: 0 }] };
export const DRAFTING_MARKS: readonly NamedSpatialElement[] = [DIMENSION_A, SECTION_A, VIEW_A, HATCH_A, TEXT_A, BOUNDARY_A, GRID_A];
```

- [ ] **Step 2: Write the failing test**

Create `tests/application/commands/draftingGeometry.test.ts`:

```ts
import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
import { DIMENSION_A, DRAFTING_MARKS, HATCH_A, SECTION_A, TEXT_A } from '../../helpers/drafting';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { PlanGeometrySchemaV12 } from '../../../src/infrastructure/persistence/dto/planGeometry';

/** Geometry only: names live in the plan note, never in the sidecar. */
const geometryOf = ({ name: _name, ...element }: SpatialElement & { readonly name: string }): SpatialElement => element;
const marks = DRAFTING_MARKS.map(geometryOf);

it('refuses the drafting refine at the schema itself: an offset or look side on the wrong kind, or missing from its own', () => {
	const document = { schemaVersion: 12 as const, planId: 'plan-a', revision: 0, unit: 'mm' as const, calibration: null, objects: [], structure: WALL_LOOP };
	const refused = [{ ...geometryOf(DIMENSION_A), offset: undefined }, { ...geometryOf(SECTION_A), flipped: undefined }, { ...geometryOf(TEXT_A), offset: 10 }, { ...geometryOf(HATCH_A), flipped: true }];
	for (const element of refused) expect(PlanGeometrySchemaV12.safeParse({ ...document, structure: { ...WALL_LOOP, elements: [element] } }).success, JSON.stringify(element)).toBe(false);
	expect(PlanGeometrySchemaV12.safeParse({ ...document, structure: { ...WALL_LOOP, elements: marks } }).success).toBe(true);
});

it('round-trips every drafting mark as schema 12, which a build that stops at 11 refuses', async () => {
	const rig = await structureStack();
	const document = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: marks } };
	expectOk(await rig.geometry.write(rig.plan.id, document, rig.baseline.version));
	expect(expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id)).document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(12);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 11));
	expect(() => older.migrateToLatest('plan-geometry', dto, 12)).toThrow('newer than this build supports');
	expect(expectDefined(PLAN_GEOMETRY_MIGRATIONS.find(step => step.toVersion === 12), 'schema 12 step').migrate({ schemaVersion: 11, revision: 3 })).toEqual({ schemaVersion: 12, revision: 3 });
});

it('keeps a sidecar without a drafting mark below schema 12, and treats offset and look side as geometry facts', async () => {
	const rig = await structureStack();
	const plain = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [{ id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] }] } };
	expectOk(await rig.geometry.write(rig.plan.id, plain, rig.baseline.version));
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBeLessThan(12);
	const dimension = geometryOf(DIMENSION_A), section = geometryOf(SECTION_A);
	const document = { ...plain, structure: { ...WALL_LOOP, elements: [dimension, section] } };
	expect(sameGeometryDocument(document, { ...document, structure: { ...WALL_LOOP, elements: [{ ...dimension, offset: -400 }, section] } })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...WALL_LOOP, elements: [dimension, { ...section, flipped: true }] } })).toBe(false);
});
```

If `_name` trips `@typescript-eslint/no-unused-vars` in the edit hook, write `geometryOf` as `(element) => { const { name, ...geometry } = element; return name === undefined ? element : geometry; }` instead.

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/application/commands/draftingGeometry.test.ts`
Expected: FAIL. `PlanGeometrySchemaV12` is not exported.

- [ ] **Step 4: Add schema 12 in `src/infrastructure/persistence/dto/planGeometry.ts`**

Replace the `structuralRule` line so it accepts any element shape (a v12 element has a wider `kind`):

```ts
const structuralRule = (element: { readonly kind: string; readonly width?: number; readonly loadBearing?: boolean }) => (element.kind === 'beam') === (element.width !== undefined)
```

Replace from `export const PlanGeometrySchemaV11 = …` to the end of the file with:

```ts
const PlanGeometrySchemaV11 = PlanGeometrySchemaV10.extend({ schemaVersion: z.literal(11), structure: StructureSchemaV11.optional(), intended: StructureSchemaV11.optional() });
/** Schema 12: drafting marks — dimension chains, section and view markers, hatches, text, boundary lines, grid points (plan drafting tools design §4). */
const SpatialElementShapeV12 = SpatialElementShapeV11.extend({
	kind: z.enum(['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset', 'post', 'beam', 'dimension', 'section', 'view', 'hatch', 'text', 'boundary', 'grid']),
	offset: z.number().min(-1e6).max(1e6).optional(), flipped: z.boolean().optional(),
});
const draftingRule = (element: { readonly kind: string; readonly offset?: number; readonly flipped?: boolean }) => (element.kind === 'dimension') === (element.offset !== undefined)
	&& (element.kind === 'section') === (element.flipped !== undefined);
const DRAFTING_MESSAGE = { message: 'A dimension chain, and only a dimension chain, has an offset; a section line, and only a section line, says which way it looks.' };
const SpatialElementSchemaV12 = SpatialElementShapeV12.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE).refine(draftingRule, DRAFTING_MESSAGE);
const StructureSchemaV12 = StructureSchemaV7.extend({ elements: z.array(SpatialElementSchemaV12).optional() });
export const PlanGeometrySchemaV12 = PlanGeometrySchemaV11.extend({ schemaVersion: z.literal(12), structure: StructureSchemaV12.optional(), intended: StructureSchemaV12.optional() });
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6, PlanGeometrySchemaV7, PlanGeometrySchemaV8, PlanGeometrySchemaV9, PlanGeometrySchemaV10, PlanGeometrySchemaV11, PlanGeometrySchemaV12]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV12>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 };
```

- [ ] **Step 5: Add the 11 → 12 migration**

In `plan-geometry.migrations.ts`, replace the final `}];` of the `10 → 11` entry with:

```ts
}, {
	fromVersion: 11, toVersion: 12,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 12 } : input,
}];
```

- [ ] **Step 6: Validate against 12 and write 12 when a drafting mark is present**

In `PlanGeometryStore.ts`:
- Change the import to `import { PlanGeometrySchema, PlanGeometrySchemaV12 } from '../../persistence/dto/planGeometry';` and add `import { draftingKind } from '../../../domain/spatial/SpatialElement';`.
- In `readUnlocked`, change `PlanGeometrySchemaV11.safeParse(migrated)` to `PlanGeometrySchemaV12.safeParse(migrated)`.
- Add above `writtenSchema`:

```ts
/** A drafting mark anywhere needs schema 12; an older build must refuse it rather than drop it. */
function hasDraftingElement(dto: Pick<PlanGeometryDTO, 'structure' | 'intended'>): boolean {
	return [dto.structure, dto.intended].some(structure => structure?.elements?.some(element => draftingKind(element.kind)) === true);
}
```

- Make `hasDraftingElement(dto)` the first line of `writtenSchema`:

```ts
	if (hasDraftingElement(dto)) return 12;
```

- [ ] **Step 7: Compare offset and look side in `sameGeometryDocument.ts`**

Replace `element.assetId ?? null, offset(element.labelOffset), element.width ?? null, element.loadBearing ?? null])] : null;` with:

```ts
				element.assetId ?? null, offset(element.labelOffset), element.width ?? null, element.loadBearing ?? null, element.offset ?? null, element.flipped ?? null])] : null;
```

- [ ] **Step 8: Point the structural schema test at schema 12**

In `tests/application/commands/structuralGeometry.test.ts` replace every `PlanGeometrySchemaV11` with `PlanGeometrySchemaV12` (import, docblock and the two `safeParse` calls), and in the first test change `schemaVersion: 11 as const` to `schemaVersion: 12 as const`. Leave `expect(dto.schemaVersion).toBe(11)` alone: a plan with posts and no drafting mark still writes 11.

- [ ] **Step 9: Run the tests**

Run: `npm run check:fast -- tests/application/commands/draftingGeometry.test.ts tests/application/commands/structuralGeometry.test.ts tests/infrastructure`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/infrastructure/persistence/dto/planGeometry.ts src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts src/infrastructure/obsidian/repositories/PlanGeometryStore.ts src/application/commands/spatial/sameGeometryDocument.ts tests/helpers/drafting.ts tests/application/commands/draftingGeometry.test.ts tests/application/commands/structuralGeometry.test.ts
git commit -m "Save drafting marks as plan geometry schema 12

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 3: Drafting tools, gestures and vocabulary

**Files:**
- Modify: `src/presentation/editor/tools/editor-tool.ts` (`ToolId`)
- Modify: `src/presentation/editor/elements/elementDraft.ts`
- Modify: `src/presentation/editor/elements/elementBaseline.ts` (`start`)
- Modify: `src/presentation/editor/elements/elementTask.ts`
- Modify: `src/presentation/editor/selection/useCanvasMenuActions.ts` (the `measure` item)
- Create: `src/presentation/i18n/locales/en/drafting.ts`, `src/presentation/i18n/locales/de/drafting.ts`
- Modify: `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts`
- Modify: `src/presentation/editor/shell/TemporaryToolBanner.vue` (`TASKS`)
- Modify: `src/presentation/editor/surface/cursor.ts` (`PRECISE_TOOLS`)
- Modify: `src/presentation/editor/shell/zoneTypeLabel.ts` (`LABELS`)
- Test: `tests/presentation/editor/draftingCreation.test.ts`

**Interfaces:**
- Consumes: `dimensionOffsetAt`, `nextMarkName` (Task 1).
- Produces, from `elementDraft.ts`:
  - `ElementToolId` gains the seven tool ids; `ELEMENT_TOOLS` maps each to its kind.
  - `ElementDraft` gains `offset: number` and `dimensionPhase: 'points' | 'offset'` (defaults `0`, `'points'`).
  - `maxDraftPoints(kind: ElementDraft['kind']): number | null` — `1` for text and grid, `2` for measurement, stair, beam, section, view, `null` otherwise.
  - `draftCursorPoints(draft: ElementDraft): Point[]` and `draftPreviewFields(draft: ElementDraft): Pick<SpatialElement, 'stair' | 'width' | 'loadBearing' | 'offset' | 'flipped'>` for previews.
- Produces, from `elementTask.ts`: `startAt(tool: ElementToolId, point: Point): Promise<void>` on the returned task; `measureFrom` is removed.
- Produces locale keys: `editor.add.<kind>.label` for the seven kinds, `editor.drafting.banner.<kind>`, `editor.drafting.menu`, `editor.drafting.text`, `editor.drafting.offset`, `editor.drafting.offset-invalid`, `editor.drafting.flip`, `editor.drafting.apply`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/draftingCreation.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import type { ElementToolId } from '../../../src/presentation/editor/elements/elementDraft';
import type { Point } from '../../../src/core/geometry/Point';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function mount(): Promise<Rig> { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
async function use(rig: Rig, tool: ElementToolId): Promise<void> {
	rig.runtime.setTool(tool);
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, `${tool} baseline`);
}
const saved = (rig: Rig, count: number) => settleUntil(() => (rig.project.structure.elements?.length ?? 0) === count, `${count} saved`);
const nameOf = (rig: Rig, id: string) => rig.project.plan?.spatialElements?.find(item => item.id === id)?.name;
function add(rig: Rig, ...points: Point[]): void { for (const point of points) rig.runtime.elementTask.addPoint(point); }

it('saves a section line on its second point as S-01 looking the default way, as schema 12, and names the next one S-02', async () => {
	const rig = await mount(); await use(rig, 'draw-section');
	expect(rig.runtime.elementTask.draft.name).toBe('S-01');
	add(rig, { x: 0, y: 2000 }, { x: 5000, y: 2000 });
	await saved(rig, 1);
	const section = expectDefined(rig.project.structure.elements?.[0], 'section');
	expect(section).toMatchObject({ kind: 'section', flipped: false, points: [{ x: 0, y: 2000 }, { x: 5000, y: 2000 }] });
	expect(nameOf(rig, section.id)).toBe('S-01');
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(12);
	await use(rig, 'draw-section');
	expect(rig.runtime.elementTask.draft.name).toBe('S-02');
});

it('saves a view marker on its second point as A-01', async () => {
	const rig = await mount(); await use(rig, 'place-view');
	add(rig, { x: -1500, y: 1000 }, { x: -800, y: 1000 });
	await saved(rig, 1);
	const view = expectDefined(rig.project.structure.elements?.[0], 'view');
	expect(view).toMatchObject({ kind: 'view', points: [{ x: -1500, y: 1000 }, { x: -800, y: 1000 }] });
	expect(nameOf(rig, view.id)).toBe('A-01');
});

it('saves a grid point at once, stays on, and names each next one', async () => {
	const rig = await mount(); await use(rig, 'place-grid');
	add(rig, { x: 6000, y: 0 }); await saved(rig, 1);
	expect(rig.runtime.activeToolId.value).toBe('place-grid');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading && rig.runtime.elementTask.draft.name === '2', 'next grid point');
	add(rig, { x: 6000, y: 4000 }); await saved(rig, 2);
	expect(rig.project.structure.elements?.map(item => nameOf(rig, item.id))).toEqual(['1', '2']);
	expect(rig.project.structure.elements?.[1].points).toEqual([{ x: 6000, y: 4000 }]);
});

it('places a text point without saving, moves it on a further point, and saves it once it has words', async () => {
	const rig = await mount(); await use(rig, 'place-text');
	const task = rig.runtime.elementTask;
	expect(task.draft.name).toBe('');
	add(rig, { x: 1000, y: 1000 }, { x: 1500, y: 1200 });
	expect(task.draft.points).toEqual([{ x: 1500, y: 1200 }]);
	expect(task.canFinish.value).toBe(false);
	await task.finish(); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	task.draft.name = 'Wintergarten';
	await task.finish(); await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'text', points: [{ x: 1500, y: 1200 }] });
});

it('ends a dimension chain\'s points on Finish, steps back on Undo point, and saves it where its line is clicked', async () => {
	const rig = await mount(); await use(rig, 'draw-dimension');
	const task = rig.runtime.elementTask;
	expect(task.draft.name).toBe('Dimension chain');
	add(rig, { x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 4560, y: 0 });
	await task.finish(); await settle();
	expect(task.draft.dimensionPhase).toBe('offset');
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	task.undoPoint();
	expect(task.draft.dimensionPhase).toBe('points');
	expect(task.draft.points).toHaveLength(3);
	await task.finish(); await settle();
	add(rig, { x: 2000, y: -499.6 });
	await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'dimension', offset: -500, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 4560, y: 0 }] });
});

it('saves a hatched area and a boundary line on Finish, and refuses a hatch outline that crosses itself', async () => {
	const rig = await mount(); await use(rig, 'draw-hatch');
	const task = rig.runtime.elementTask;
	add(rig, { x: 0, y: 5000 }, { x: 3000, y: 7000 }, { x: 3000, y: 5000 }, { x: 0, y: 7000 });
	await task.finish(); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	task.setPoints([{ x: 0, y: 5000 }, { x: 3000, y: 5000 }, { x: 3000, y: 7000 }, { x: 0, y: 7000 }]);
	await task.finish(); await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'hatch' });
	await use(rig, 'draw-boundary');
	add(rig, { x: -2000, y: -1000 }, { x: 2000, y: -1200 }, { x: 6000, y: -1500 });
	await task.finish(); await saved(rig, 2);
	expect(rig.project.structure.elements?.[1]).toMatchObject({ kind: 'boundary', points: [{ x: -2000, y: -1000 }, { x: 2000, y: -1200 }, { x: 6000, y: -1500 }] });
});

it('starts a tool at a point from outside its pointer, and not when another tool took over meanwhile', async () => {
	const rig = await mount();
	await rig.runtime.elementTask.startAt('place-grid', { x: 250, y: 750 });
	await saved(rig, 1);
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'grid', points: [{ x: 250, y: 750 }] });
	const starting = rig.runtime.elementTask.startAt('draw-section', { x: 0, y: 0 });
	rig.runtime.setTool('select');
	await starting; await settle();
	expect(rig.runtime.elementTask.draft.points).toEqual([]);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/draftingCreation.test.ts`
Expected: FAIL. Type errors: `'draw-section'` is not an `ElementToolId`, `startAt` and `dimensionPhase` do not exist.

- [ ] **Step 3: Add the tool ids to `ToolId` in `editor-tool.ts`**

After `| 'draw-beam'` add:

```ts
	| 'draw-dimension'
	| 'draw-section'
	| 'place-view'
	| 'draw-hatch'
	| 'place-text'
	| 'draw-boundary'
	| 'place-grid'
```

- [ ] **Step 4: Extend `elementDraft.ts`**

Add to the imports:

```ts
import { dimensionOffsetAt } from '../../../domain/spatial/dimensionChain';
```

Replace `ElementToolId` and `ELEMENT_TOOLS`:

```ts
export type ElementToolId = 'place-object' | 'draw-path' | 'draw-fence' | 'measure' | 'place-stair' | 'draw-arrow' | 'place-post' | 'draw-beam'
	| 'draw-dimension' | 'draw-section' | 'place-view' | 'draw-hatch' | 'place-text' | 'draw-boundary' | 'place-grid';
/** No tool here produces `'asset'` yet — placement lands through its own flow (plan editor asset placement design §2). */
export const ELEMENT_TOOLS: Readonly<Record<ElementToolId, Exclude<SpatialElementKind, 'asset'>>> = {
	'place-object': 'object', 'draw-path': 'path', 'draw-fence': 'fence', measure: 'measurement',
	'place-stair': 'stair', 'draw-arrow': 'arrow', 'place-post': 'post', 'draw-beam': 'beam',
	'draw-dimension': 'dimension', 'draw-section': 'section', 'place-view': 'view', 'draw-hatch': 'hatch',
	'place-text': 'text', 'draw-boundary': 'boundary', 'place-grid': 'grid',
};
```

In `interface ElementDraft`, after `beamWidth: number;` add:

```ts
	/** The next dimension chain's offset, world mm: set by the click that places its line, or typed. */
	offset: number;
	/** Whether a dimension chain is still taking points or is placing its line (plan drafting tools design §5). */
	dimensionPhase: 'points' | 'offset';
```

In `createElementDraft`, add `offset: 0, dimensionPhase: 'points',` after `beamWidth: DEFAULT_BEAM_WIDTH,`.

Add below `acceptsElementPoints`:

```ts
/** How many points a kind's draft holds at most: one for a text or grid point, two for the two-point kinds, unbounded otherwise. */
export function maxDraftPoints(kind: ElementDraft['kind']): number | null {
	if (kind === 'text' || kind === 'grid') return 1;
	return ['measurement', 'stair', 'beam', 'section', 'view'].includes(kind) ? 2 : null;
}
/** A new dimension chain carries the offset its line was placed at, and a new section line looks the default way (design §3). */
function draftingFields(draft: ElementDraft): Pick<SpatialElement, 'offset' | 'flipped'> {
	if (draft.kind === 'dimension') return { offset: draft.offset };
	return draft.kind === 'section' ? { flipped: false } : {};
}
/** The cursor point a preview appends: none once the kind has all its points, and none while a chain's line is being placed. */
export function draftCursorPoints(draft: ElementDraft): Point[] {
	if (!draft.cursor || (draft.kind === 'dimension' && draft.dimensionPhase === 'offset')) return [];
	return draft.points.length < (maxDraftPoints(draft.kind) ?? Number.POSITIVE_INFINITY) ? [draft.cursor] : [];
}
/** The kind-specific facts a preview draws with; a chain's line follows the pointer while it is being placed. */
export function draftPreviewFields(draft: ElementDraft): Pick<SpatialElement, 'stair' | 'width' | 'loadBearing' | 'offset' | 'flipped'> {
	if (draft.kind === 'stair') return { stair: draft.stair };
	if (draft.kind === 'beam') return { width: draft.beamWidth, loadBearing: true };
	if (draft.kind !== 'dimension') return draftingFields(draft);
	return { offset: draft.dimensionPhase === 'offset' && draft.cursor ? dimensionOffsetAt(draft.points, draft.cursor) : draft.offset };
}
```

In `draftElement`, add `...draftingFields(draft)` after `...structuralFields(draft)`.

- [ ] **Step 5: Name a new draft by its sequence in `elementBaseline.ts`**

Add `import { nextMarkName } from '../../../domain/spatial/markNames';` and replace `start`:

```ts
	/** The names already given to this plan's elements of `kind`, for the next free sequence name. */
	function takenNames(kind: string): string[] {
		const names = new Map(project.plan?.spatialElements?.map(item => [item.id, item.name]));
		return (project.structure.elements ?? []).filter(item => item.kind === kind).flatMap(item => names.get(item.id) ?? []);
	}
	function start(id: ElementToolId): void {
		stop(); draft.kind = ELEMENT_TOOLS[id];
		// A text's name IS its words, so it starts empty; section, view and grid marks count up; every other kind takes its label.
		draft.name = draft.kind === 'text' ? '' : nextMarkName(draft.kind, takenNames(draft.kind)) ?? tr(`editor.add.${draft.kind === 'object' ? 'item' : draft.kind}.label`);
		reading = readBaseline(generation);
	}
```

- [ ] **Step 6: The gestures in `elementTask.ts`**

Change the imports: add `maxDraftPoints` to the `./elementDraft` import, add `import { dimensionOffsetAt } from '../../../domain/spatial/dimensionChain';`, and change the `NamedSpatialElement` import to `import type { NamedSpatialElement, SpatialElementKind } from '../../../domain/spatial/SpatialElement';`.

Replace `addPoint` and `undoPoint`:

```ts
	function addPoint(point: Point): boolean {
		if (draft.kind === 'post') return placePost(point);
		if (draft.kind === 'dimension' && draft.dimensionPhase === 'offset') return placeDimensionLine(point);
		if (blocked.value || draft.pendingInput) return false;
		if (draft.kind === 'text' || draft.kind === 'grid') return placeSinglePoint(point);
		const limit = maxDraftPoints(draft.kind);
		if (limit !== null && draft.points.length >= limit) return false;
		const previous = draft.points[draft.points.length - 1];
		if (previous && previous.x === point.x && previous.y === point.y) return false;
		const added = setPoints([...draft.points, point]);
		if (added) draft.text = { x: '', y: '' };
		// A beam, a section line and a view marker are exactly their two points, so the second one saves them.
		if (added && ['beam', 'section', 'view'].includes(draft.kind) && draft.points.length === 2) void finish();
		return added;
	}
	/** A text or grid point is one point: a click places it, a further click moves it, and a grid point saves at once. */
	function placeSinglePoint(point: Point): boolean {
		if (!setPoints([point])) return false;
		draft.text = { x: '', y: '' };
		if (draft.kind === 'grid') void finish();
		return true;
	}
	/** A chain's line is placed by one click: its distance from the chain's line, in whole millimetres, is the offset, and the click saves it. */
	function placeDimensionLine(point: Point): boolean {
		if (blocked.value || draft.pendingInput) return false;
		draft.offset = Math.round(dimensionOffsetAt(draft.points, point));
		void finish();
		return true;
	}
```

```ts
	function undoPoint(): void {
		if (blocked.value || draft.pendingInput || draft.text.x || draft.text.y) return;
		// Placing a chain's line is a step of its own; undoing it keeps every point.
		if (draft.kind === 'dimension' && draft.dimensionPhase === 'offset') { draft.dimensionPhase = 'points'; return; }
		setPoints(draft.points.slice(0, -1));
	}
```

Add above `finish`:

```ts
	/** A chain's first Finish ends its points and starts placing its line; true when that is what this Finish did. */
	function advanceDimension(): boolean {
		if (draft.kind !== 'dimension' || draft.dimensionPhase !== 'points') return false;
		if (draftElement(draft)) draft.dimensionPhase = 'offset'; else draft.error = spatialError('element-invalid');
		return true;
	}
	/**
	 * Posts and grid points are set one after another, so the tool stays on: a post with the section last typed, a grid point with
	 * the next free name. `start` reads a fresh baseline; the dispatcher has already refreshed the projection it is compared against.
	 */
	function stayOn(kind: SpatialElementKind): boolean {
		if (kind !== 'post' && kind !== 'grid') return false;
		const post = { ...draft.post }; start(kind === 'post' ? 'place-post' : 'place-grid'); draft.post = post;
		return true;
	}
```

In `finish`, directly after `if (draft.text.x || draft.text.y || draft.pendingInput) { … }` add:

```ts
		if (advanceDimension()) return;
```

and replace the two lines

```ts
			// The post tool stays on for the next post along a wall, with the section last typed. `start` reads a
			// fresh baseline; the dispatcher has already refreshed the projection it is compared against.
			if (element.kind === 'post') { const post = { ...draft.post }; start('place-post'); draft.post = post; return; }
```

with

```ts
			if (stayOn(element.kind)) return;
```

Replace `measureFrom` with:

```ts
	/** Starts `tool` at `point` from outside its pointer — the canvas context menu — once its baseline is read, unless the tool changed meanwhile. */
	async function startAt(tool: ElementToolId, point: Point): Promise<void> {
		runtime.setTool(tool);
		if (runtime.activeToolId.value !== tool) return;
		const ticket = reads.ticket();
		await reads.ready();
		if (reads.current(ticket)) addPoint(point);
	}
```

and in the `return { … }` replace `measureFrom` with `startAt`.

- [ ] **Step 7: Route Measure here through `startAt`**

In `useCanvasMenuActions.ts`, change `run: () => runtime.elementTask.measureFrom(opened())` to `run: () => runtime.elementTask.startAt('measure', opened())`.

- [ ] **Step 8: The vocabulary**

Create `src/presentation/i18n/locales/en/drafting.ts`:

```ts
export const draftingEn = {
	'editor.add.dimension.label': 'Dimension chain',
	'editor.add.section.label': 'Section line',
	'editor.add.view.label': 'View marker',
	'editor.add.hatch.label': 'Hatched area',
	'editor.add.text.label': 'Text',
	'editor.add.boundary.label': 'Boundary line',
	'editor.add.grid.label': 'Grid point',
	'editor.drafting.banner.dimension': 'Click the points to measure, choose Finish, then click where the dimension line goes.',
	'editor.drafting.banner.section': 'Click both ends of the section line.',
	'editor.drafting.banner.view': 'Click the marker, then the direction it looks.',
	'editor.drafting.banner.hatch': 'Click the corners of the area, then choose Finish.',
	'editor.drafting.banner.text': 'Click where the text goes, type it, then choose Finish.',
	'editor.drafting.banner.boundary': 'Click the points of the boundary line, then choose Finish.',
	'editor.drafting.banner.grid': 'Click to place a grid point. The tool stays on for the next one.',
	'editor.drafting.menu': 'Drafting',
	'editor.drafting.text': 'Text',
	'editor.drafting.offset': 'Offset (m)',
	'editor.drafting.offset-invalid': 'Enter the distance of the dimension line in metres.',
	'editor.drafting.flip': 'Flip direction',
	'editor.drafting.apply': 'Apply offset',
} as const;
```

Create `src/presentation/i18n/locales/de/drafting.ts`:

```ts
import type { draftingEn } from '../en/drafting';
export const draftingDe: Record<keyof typeof draftingEn, string> = {
	'editor.add.dimension.label': 'Maßkette',
	'editor.add.section.label': 'Schnittlinie',
	'editor.add.view.label': 'Ansichtspfeil',
	'editor.add.hatch.label': 'Schraffur',
	'editor.add.text.label': 'Text',
	'editor.add.boundary.label': 'Grenzlinie',
	'editor.add.grid.label': 'Achspunkt',
	'editor.drafting.banner.dimension': 'Die zu messenden Punkte anklicken, Fertig wählen und dann die Lage der Maßlinie anklicken.',
	'editor.drafting.banner.section': 'Beide Enden der Schnittlinie anklicken.',
	'editor.drafting.banner.view': 'Den Pfeil setzen, dann die Blickrichtung anklicken.',
	'editor.drafting.banner.hatch': 'Die Ecken der Fläche anklicken, dann Fertig wählen.',
	'editor.drafting.banner.text': 'Die Stelle anklicken, den Text eingeben, dann Fertig wählen.',
	'editor.drafting.banner.boundary': 'Die Punkte der Grenzlinie anklicken, dann Fertig wählen.',
	'editor.drafting.banner.grid': 'Klicken, um einen Achspunkt zu setzen. Das Werkzeug bleibt für den nächsten aktiv.',
	'editor.drafting.menu': 'Zeichnen',
	'editor.drafting.text': 'Text',
	'editor.drafting.offset': 'Abstand (m)',
	'editor.drafting.offset-invalid': 'Geben Sie den Abstand der Maßlinie in Metern ein.',
	'editor.drafting.flip': 'Richtung umkehren',
	'editor.drafting.apply': 'Abstand übernehmen',
};
```

In `en/editor.ts` add `import { draftingEn } from './drafting';` beside the other locale imports and `...draftingEn,` after `...structuralEn,`. In `de/editor.ts` add `import { draftingDe } from './drafting';` and `...draftingDe,` after `...structuralDe,`.

- [ ] **Step 9: Banner, cursor and kind labels**

`TemporaryToolBanner.vue`, in `TASKS` after the `'draw-beam'` entry:

```ts
	'draw-dimension': { nameKey: 'editor.add.dimension.label', instructionKey: 'editor.drafting.banner.dimension', finish: true },
	'draw-section': { nameKey: 'editor.add.section.label', instructionKey: 'editor.drafting.banner.section' },
	'place-view': { nameKey: 'editor.add.view.label', instructionKey: 'editor.drafting.banner.view' },
	'draw-hatch': { nameKey: 'editor.add.hatch.label', instructionKey: 'editor.drafting.banner.hatch', finish: true },
	'place-text': { nameKey: 'editor.add.text.label', instructionKey: 'editor.drafting.banner.text', finish: true },
	'draw-boundary': { nameKey: 'editor.add.boundary.label', instructionKey: 'editor.drafting.banner.boundary', finish: true },
	'place-grid': { nameKey: 'editor.add.grid.label', instructionKey: 'editor.drafting.banner.grid' },
```

`cursor.ts`, in `PRECISE_TOOLS` after `'draw-beam',`:

```ts
	'draw-dimension',
	'draw-section',
	'place-view',
	'draw-hatch',
	'place-text',
	'draw-boundary',
	'place-grid',
```

`zoneTypeLabel.ts`, in `LABELS` after `beam: 'editor.add.beam.label',`:

```ts
	dimension: 'editor.add.dimension.label',
	section: 'editor.add.section.label',
	view: 'editor.add.view.label',
	hatch: 'editor.add.hatch.label',
	text: 'editor.add.text.label',
	boundary: 'editor.add.boundary.label',
	grid: 'editor.add.grid.label',
```

- [ ] **Step 10: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/draftingCreation.test.ts tests/presentation/editor/structuralCreation.test.ts tests/presentation/editor/contextMenuActions.test.ts tests/presentation/i18n`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/presentation/editor/tools/editor-tool.ts src/presentation/editor/elements/elementDraft.ts src/presentation/editor/elements/elementBaseline.ts src/presentation/editor/elements/elementTask.ts src/presentation/editor/selection/useCanvasMenuActions.ts src/presentation/i18n/locales/en/drafting.ts src/presentation/i18n/locales/de/drafting.ts src/presentation/i18n/locales/en/editor.ts src/presentation/i18n/locales/de/editor.ts src/presentation/editor/shell/TemporaryToolBanner.vue src/presentation/editor/surface/cursor.ts src/presentation/editor/shell/zoneTypeLabel.ts tests/presentation/editor/draftingCreation.test.ts
git commit -m "Draw dimension chains, section and view markers, hatches, text, boundary lines and grid points

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 4: Drawing the marks

**Files:**
- Create: `src/presentation/editor/elements/draftingMarks.ts`
- Create: `src/presentation/editor/elements/DraftingShape.vue`
- Modify: `src/presentation/editor/elements/ElementShapes.vue`
- Modify: `src/presentation/editor/structure/StructureLayer.vue` (paint order, draft preview)
- Modify: `src/presentation/editor/labels/labelActions.ts` (`hitFor`)
- Test: `tests/presentation/editor/draftingMarks.test.ts`, `tests/presentation/editor/draftingCanvas.test.ts`

**Interfaces:**
- Consumes: `dimensionChain` (Task 1); `draftCursorPoints`, `draftPreviewFields` (Task 3); fixtures from `tests/helpers/drafting.ts` (Task 2).
- Produces, from `draftingMarks.ts`:
  - constants `DRAFTING_TEXT_PX = 14`, `DIMENSION_TEXT_PX = 11`, `GRID_RADIUS_PX = 10`, `MARKER_PX = 10`
  - `interface DraftLine { name; points: readonly number[]; strokeWidth: number; closed?: boolean; dash?: readonly number[]; fill?: 'solid' | 'pattern' }`
  - `interface DraftText { name; text; x; y; fontSize; width; offsetX; offsetY; rotation }`
  - `interface DraftCircle { name; x; y; radius; strokeWidth }`
  - `interface DraftMarks { lines: readonly DraftLine[]; texts: readonly DraftText[]; circles: readonly DraftCircle[] }`
  - `draftingMarks(element: NamedSpatialElement, zoom: number): DraftMarks` — world coordinates, sizes already divided by `zoom`, empty for a non-drafting kind.
- Konva node names the tests read: `drafting-dimension-line`, `drafting-dimension-extension`, `drafting-dimension-tick`, `drafting-dimension-text`, `drafting-section-line`, `drafting-section-arrow`, `drafting-section-label`, `drafting-view-arrow`, `drafting-view-label`, `drafting-hatch`, `drafting-text`, `drafting-boundary`, `drafting-grid`, `drafting-grid-label`.

- [ ] **Step 1: Write the failing layout test**

Create `tests/presentation/editor/draftingMarks.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DRAFTING_TEXT_PX, GRID_RADIUS_PX, draftingMarks } from '../../../src/presentation/editor/elements/draftingMarks';
import { createElementDraft, draftCursorPoints, draftPreviewFields } from '../../../src/presentation/editor/elements/elementDraft';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';
import { BOUNDARY_A, DIMENSION_A, GRID_A, HATCH_A, SECTION_A, TEXT_A, VIEW_A } from '../../helpers/drafting';

describe('drafting mark layout', () => {
	it('lays a dimension chain out as its line, one extension and tick per point, and one upright length per non-zero segment', () => {
		const marks = draftingMarks(DIMENSION_A, 1);
		expect(marks.lines.filter(line => line.name === 'drafting-dimension-line')).toEqual([expect.objectContaining({ points: [0, -600, 4560, -600] })]);
		expect(marks.lines.filter(line => line.name === 'drafting-dimension-extension')).toHaveLength(4);
		expect(marks.lines.filter(line => line.name === 'drafting-dimension-tick')).toHaveLength(4);
		expect(marks.texts.map(item => item.text)).toEqual([formatMetres(1190), formatMetres(750), formatMetres(2620)]);
		expect(marks.texts[0]).toMatchObject({ x: 595, y: -600, rotation: 0 });
		const zero = draftingMarks({ ...DIMENSION_A, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 400 }, { x: 3000, y: 0 }] }, 1);
		expect(zero.texts.map(item => item.text)).toEqual([formatMetres(1000), formatMetres(2000)]);
		expect(draftingMarks({ ...DIMENSION_A, points: [{ x: 0, y: 3000 }, { x: 0, y: 0 }] }, 1).texts[0].rotation).toBe(90);
	});

	it('draws a section line\'s arrows on its look side, and on the other side once flipped', () => {
		const apexY = (flipped: boolean) => draftingMarks({ ...SECTION_A, flipped }, 1).lines.filter(line => line.name === 'drafting-section-arrow').map(line => line.points[5]);
		expect(apexY(false)).toEqual([2010, 2010]);
		expect(apexY(true)).toEqual([1990, 1990]);
		const marks = draftingMarks(SECTION_A, 1);
		expect(marks.lines[0]).toMatchObject({ name: 'drafting-section-line', dash: [12, 3, 2, 3] });
		expect(marks.texts.map(item => item.text)).toEqual(['S-01', 'S-01']);
	});

	it('draws a view marker as a hollow triangle pointing where it looks, and every other mark by its kind', () => {
		const view = draftingMarks(VIEW_A, 1).lines[0];
		expect(view).toMatchObject({ name: 'drafting-view-arrow', closed: true });
		expect(view.fill).toBeUndefined();
		expect(view.points.slice(0, 2)).toEqual([-1490, 1000]);
		expect(draftingMarks(HATCH_A, 1).lines[0]).toMatchObject({ name: 'drafting-hatch', closed: true, fill: 'pattern' });
		expect(draftingMarks(BOUNDARY_A, 2).lines[0]).toMatchObject({ name: 'drafting-boundary', dash: [8, 4] });
		expect(draftingMarks(GRID_A, 2).circles).toEqual([expect.objectContaining({ x: 7000, y: 0, radius: GRID_RADIUS_PX / 2 })]);
		expect(draftingMarks(TEXT_A, 1).texts).toEqual([expect.objectContaining({ text: 'Wintergarten', x: 1500, y: 1500, fontSize: DRAFTING_TEXT_PX, offsetY: DRAFTING_TEXT_PX / 2 })]);
		expect(draftingMarks({ id: 'element-path', kind: 'path', name: 'Path', points: BOUNDARY_A.points }, 1)).toEqual({ lines: [], texts: [], circles: [] });
	});

	it('previews a chain\'s line at the pointer while it is placed, and appends no cursor point then or once a kind is full', () => {
		const draft = createElementDraft();
		Object.assign(draft, { kind: 'dimension', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }], cursor: { x: 2000, y: -800 }, offset: -100 });
		expect(draftCursorPoints(draft)).toEqual([{ x: 2000, y: -800 }]);
		expect(draftPreviewFields(draft)).toEqual({ offset: -100 });
		draft.dimensionPhase = 'offset';
		expect(draftCursorPoints(draft)).toEqual([]);
		expect(draftPreviewFields(draft)).toEqual({ offset: -800 });
		Object.assign(draft, { kind: 'section', dimensionPhase: 'points' });
		expect(draftCursorPoints(draft)).toEqual([]);
		expect(draftPreviewFields(draft)).toEqual({ flipped: false });
		Object.assign(draft, { kind: 'text', points: [{ x: 0, y: 0 }] });
		expect(draftCursorPoints(draft)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/draftingMarks.test.ts`
Expected: FAIL. Module `draftingMarks` does not exist.

- [ ] **Step 3: Create `src/presentation/editor/elements/draftingMarks.ts`**

```ts
import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement, SpatialElementKind } from '../../../domain/spatial/SpatialElement';
import { dimensionChain } from '../../../domain/spatial/dimensionChain';
import { formatMetres } from '../shell/formatLength';
import { measureLabelWidth } from '../labels/labelLayout';

/**
 * Where every drafting mark is drawn, in world millimetres, with its screen-constant sizes already divided by the zoom
 * (plan drafting tools design §6). Pure, so a test can ask what a mark IS; whether it reads as a plan is a capture.
 */
export const DRAFTING_TEXT_PX = 14;
export const DIMENSION_TEXT_PX = 11;
export const GRID_RADIUS_PX = 10;
export const MARKER_PX = 10;
const GRID_TEXT_PX = 12, TICK_PX = 5, EXTENSION_GAP_PX = 4, EXTENSION_OVERSHOOT_PX = 3, LABEL_GAP_PX = 4;

export interface DraftLine { readonly name: string; readonly points: readonly number[]; readonly strokeWidth: number; readonly closed?: boolean; readonly dash?: readonly number[]; readonly fill?: 'solid' | 'pattern' }
export interface DraftText { readonly name: string; readonly text: string; readonly x: number; readonly y: number; readonly fontSize: number; readonly width: number; readonly offsetX: number; readonly offsetY: number; readonly rotation: number }
export interface DraftCircle { readonly name: string; readonly x: number; readonly y: number; readonly radius: number; readonly strokeWidth: number }
export interface DraftMarks { readonly lines: readonly DraftLine[]; readonly texts: readonly DraftText[]; readonly circles: readonly DraftCircle[] }
const NONE: DraftMarks = { lines: [], texts: [], circles: [] };

const flat = (points: readonly Point[]): number[] => points.flatMap(point => [point.x, point.y]);
const step = (point: Point, by: Point, distance: number): Point => ({ x: point.x + by.x * distance, y: point.y + by.y * distance });
function unit(from: Point, to: Point): Point | null {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return length > 0 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : null;
}
/** One line of text centred on `at`: vertically centred with no `lift`, otherwise sitting `lift` above `at` in its own rotated frame. */
function text(name: string, words: string, at: Point, fontPx: number, zoom: number, rotation = 0, lift = 0): DraftText {
	const width = measureLabelWidth(words, fontPx) / zoom, fontSize = fontPx / zoom;
	return { name, text: words, x: at.x, y: at.y, fontSize, width, offsetX: width / 2, offsetY: lift > 0 ? fontSize + lift : fontSize / 2, rotation };
}
/** The line's bearing in degrees, turned half a revolution when it would read upside down. */
function uprightDegrees(direction: Point): number {
	const degrees = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
	if (degrees > 90) return degrees - 180;
	return degrees <= -90 ? degrees + 180 : degrees;
}

/** The dimension line, an extension line from every point to it, a 45° tick at every foot, and each non-zero segment's length over it. */
function dimensionMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	const chain = dimensionChain(element.points, element.offset ?? 0);
	if (!chain) return NONE;
	const { direction, normal, feet } = chain, px = 1 / zoom, reach = Math.SQRT1_2 * TICK_PX * px;
	const tick = { x: (direction.x + normal.x) * reach, y: (direction.y + normal.y) * reach };
	const along = (point: Point): number => point.x * direction.x + point.y * direction.y;
	const ordered = feet.toSorted((a, b) => along(a) - along(b));
	const extensions = element.points.map((point, index): DraftLine => {
		const foot = feet[index], side = Math.sign((foot.x - point.x) * normal.x + (foot.y - point.y) * normal.y) || 1;
		return { name: 'drafting-dimension-extension', points: flat([step(point, normal, side * EXTENSION_GAP_PX * px), step(foot, normal, side * EXTENSION_OVERSHOOT_PX * px)]), strokeWidth: px };
	});
	const ticks = feet.map((foot): DraftLine => ({ name: 'drafting-dimension-tick', points: flat([step(foot, tick, -1), step(foot, tick, 1)]), strokeWidth: 1.5 * px }));
	const rotation = uprightDegrees(direction);
	const texts = chain.lengths.flatMap((length, index) => length === 0 ? [] : [text('drafting-dimension-text', formatMetres(length),
		{ x: (feet[index].x + feet[index + 1].x) / 2, y: (feet[index].y + feet[index + 1].y) / 2 }, DIMENSION_TEXT_PX, zoom, rotation, LABEL_GAP_PX * px)]);
	return { lines: [{ name: 'drafting-dimension-line', points: flat([ordered[0], ordered[ordered.length - 1]]), strokeWidth: px }, ...extensions, ...ticks], texts, circles: [] };
}

/** A dash-dot cut line, a filled triangle at each end on the side it looks at, and its name beside each triangle. */
function sectionMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	if (element.points.length !== 2) return NONE;
	const [start, end] = element.points, direction = unit(start, end);
	if (!direction) return NONE;
	const px = 1 / zoom, size = MARKER_PX * px, look = element.flipped ? -1 : 1, normal = { x: -direction.y * look, y: direction.x * look };
	const arrow = (at: Point): DraftLine => ({ name: 'drafting-section-arrow', points: flat([step(at, direction, -size / 2), step(at, direction, size / 2), step(at, normal, size)]), closed: true, fill: 'solid', strokeWidth: px });
	const label = (at: Point): DraftText => text('drafting-section-label', element.name, step(at, normal, size + (LABEL_GAP_PX + DRAFTING_TEXT_PX / 2) * px), DRAFTING_TEXT_PX, zoom);
	return { lines: [{ name: 'drafting-section-line', points: flat([start, end]), dash: [12 * px, 3 * px, 2 * px, 3 * px], strokeWidth: px }, arrow(start), arrow(end)], texts: [label(start), label(end)], circles: [] };
}

/** A hollow triangle at the anchor pointing the way the view looks, and the marker's name behind it. */
function viewMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	if (element.points.length !== 2) return NONE;
	const [anchor, facing] = element.points, direction = unit(anchor, facing);
	if (!direction) return NONE;
	const px = 1 / zoom, size = MARKER_PX * px, normal = { x: -direction.y, y: direction.x }, base = step(anchor, direction, -size / 2);
	return {
		lines: [{ name: 'drafting-view-arrow', points: flat([step(anchor, direction, size), step(base, normal, size * 0.8), step(base, normal, -size * 0.8)]), closed: true, strokeWidth: 1.5 * px }],
		texts: [text('drafting-view-label', element.name, step(anchor, direction, -(size + (LABEL_GAP_PX + DRAFTING_TEXT_PX / 2) * px)), DRAFTING_TEXT_PX, zoom)],
		circles: [],
	};
}

const MARKS: Readonly<Partial<Record<SpatialElementKind, (element: NamedSpatialElement, zoom: number) => DraftMarks>>> = {
	dimension: dimensionMarks,
	section: sectionMarks,
	view: viewMarks,
	hatch: (element, zoom) => ({ lines: [{ name: 'drafting-hatch', points: flat(element.points), closed: true, fill: 'pattern', strokeWidth: 1 / zoom }], texts: [], circles: [] }),
	text: (element, zoom) => ({ lines: [], texts: element.points.slice(0, 1).map(point => text('drafting-text', element.name, point, DRAFTING_TEXT_PX, zoom)), circles: [] }),
	boundary: (element, zoom) => ({ lines: [{ name: 'drafting-boundary', points: flat(element.points), dash: [16 / zoom, 8 / zoom], strokeWidth: 1.5 / zoom }], texts: [], circles: [] }),
	grid: (element, zoom) => ({
		lines: [],
		texts: element.points.slice(0, 1).map(point => text('drafting-grid-label', element.name, point, GRID_TEXT_PX, zoom)),
		circles: element.points.slice(0, 1).map(point => ({ name: 'drafting-grid', x: point.x, y: point.y, radius: GRID_RADIUS_PX / zoom, strokeWidth: 1 / zoom })),
	}),
};

/** Every line, text and circle a drafting mark draws; nothing for any other kind. */
export function draftingMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	return MARKS[element.kind]?.(element, zoom) ?? NONE;
}
```

- [ ] **Step 4: Run the layout test**

Run: `npm run check:fast -- tests/presentation/editor/draftingMarks.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing canvas test**

Create `tests/presentation/editor/draftingCanvas.test.ts`:

```ts
// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { expectDefined } from '../../helpers/domain';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { DRAFTING_MARKS } from '../../helpers/drafting';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('draws every drafting mark, a chain\'s lengths, no separate name tag, and a hatch under the walls but every other mark over them', async () => {
	const rig = await editorWith(mounted, ...DRAFTING_MARKS);
	const texts = rig.stage.find<Konva.Text>('Text').map(node => node.text());
	expect(rig.stage.find<Konva.Text>('.drafting-dimension-text').map(node => node.text())).toEqual([formatMetres(1190), formatMetres(750), formatMetres(2620)]);
	expect(rig.stage.find('.drafting-dimension-tick')).toHaveLength(4);
	expect(rig.stage.find('.drafting-section-arrow')).toHaveLength(2);
	expect(texts.filter(value => value === 'S-01')).toHaveLength(2);
	expect(texts.filter(value => value === 'Wintergarten')).toHaveLength(1);
	expect(texts.some(value => ['Front', 'Plot line', 'Existing'].includes(value))).toBe(false);
	const dash = expectDefined(rig.stage.findOne<Konva.Line>('.drafting-boundary'), 'boundary').dash();
	expect(dash).toHaveLength(2); expect(dash[0] / dash[1]).toBeCloseTo(2);
	expect(expectDefined(rig.stage.findOne<Konva.Line>('.drafting-hatch'), 'hatch').fillPatternImage()).toBeTruthy();
	expect(rig.stage.find('.drafting-grid')).toHaveLength(1);
	const wallBody = expectDefined(rig.stage.find('.wall-body')[0], 'wall body').getAbsoluteZIndex();
	expect(expectDefined(rig.stage.findOne('.drafting-section-line'), 'section').getAbsoluteZIndex()).toBeGreaterThan(wallBody);
	expect(expectDefined(rig.stage.findOne('.drafting-hatch'), 'hatch').getAbsoluteZIndex()).toBeLessThan(wallBody);
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/draftingCanvas.test.ts`
Expected: FAIL. No `.drafting-dimension-text` nodes; the name tags `Front`, `Plot line` and `Existing` are drawn.

- [ ] **Step 7: Create `src/presentation/editor/elements/DraftingShape.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { ThemeTokens } from '../theme/themeTokens';
import { patternTile } from '../structure/patternTile';
import { draftingMarks } from './draftingMarks';
const props = defineProps<{ element: NamedSpatialElement; selected: boolean; tokens: ThemeTokens; zoom: number }>();
const stroke = computed(() => props.selected ? props.tokens.accent : props.tokens.zoneStroke);
/** The cross-hatch is the stone tile's two diagonals in theme colours (plan drafting tools design §6). */
const tile = computed(() => props.element.kind === 'hatch' ? patternTile('stone', props.tokens.zoneStroke, props.tokens.canvasBackground) : null);
function fillOf(fill: 'solid' | 'pattern' | undefined) {
	if (fill === 'solid') return { fill: stroke.value };
	return fill === 'pattern' && tile.value ? { fillPatternImage: tile.value, fillPatternRepeat: 'repeat', fillPatternScale: { x: 1 / props.zoom, y: 1 / props.zoom } } : {};
}
/** Configs only, in script: the template stays one flat loop per node type for fallow's template complexity budget. */
const marks = computed(() => {
	const drawn = draftingMarks(props.element, props.zoom), weight = props.selected ? 2 : 1;
	return {
		lines: drawn.lines.map(line => ({ name: line.name, points: line.points, closed: line.closed === true, dash: line.dash ?? [], stroke: stroke.value, strokeWidth: line.strokeWidth * weight, listening: false, ...fillOf(line.fill) })),
		circles: drawn.circles.map(circle => ({ ...circle, stroke: stroke.value, strokeWidth: circle.strokeWidth * weight, listening: false })),
		texts: drawn.texts.map(item => ({ ...item, fill: props.selected ? props.tokens.accent : props.tokens.zoneLabel, align: 'center', listening: false })),
	};
});
</script>
<template>
	<VGroup :config="{ name: 'drafting-shape', listening: false }">
		<VLine
			v-for="(line, index) in marks.lines"
			:key="'line-' + index"
			:config="line"
		/>
		<VCircle
			v-for="(circle, index) in marks.circles"
			:key="'circle-' + index"
			:config="circle"
		/>
		<VText
			v-for="(item, index) in marks.texts"
			:key="'text-' + index"
			:config="item"
		/>
	</VGroup>
</template>
```

- [ ] **Step 8: Route drafting kinds through it in `ElementShapes.vue`**

- Add imports: `import DraftingShape from './DraftingShape.vue';` and change `import { outlineKind } from '../../../domain/spatial/SpatialElement';` to `import { draftingKind, outlineKind } from '../../../domain/spatial/SpatialElement';`.
- In the `shapes` computed, add `drafting: draftingKind(element.kind),` beside `structural: …`, and replace the `label: { … }` entry with:

```ts
			// A drafting mark draws its own name where the name IS the mark, and shows none elsewhere (plan drafting tools design §6).
			label: draftingKind(element.kind) ? null : { ...label, fontSize: ELEMENT_LABEL_FONT_PX / zoom, fill: tokens.zoneLabel, listening: false } };
```

- In the template, directly before `<VLine v-else :config="shape.line" />`, add:

```vue
			<DraftingShape
				v-else-if="shape.drafting"
				:element="shape.element"
				:selected="shape.selected"
				:tokens="tokens"
				:zoom="zoom"
			/>
```

- [ ] **Step 9: Paint order and draft preview in `StructureLayer.vue`**

- Change `import { isElementTool } from '../elements/elementDraft';` to `import { draftCursorPoints, draftPreviewFields, isElementTool } from '../elements/elementDraft';` and add `import { draftingKind } from '../../../domain/spatial/SpatialElement';`.
- Replace the `isStructuralKind` docblock and line with:

```ts
/** Posts, beams and every drafting mark but a hatch draw above the wall paint (see the elements block below); every other kind, a hatch included, draws below it. */
const isStructuralKind = (kind: string): boolean => kind === 'post' || kind === 'beam' || (draftingKind(kind) && kind !== 'hatch');
```

- Replace the body of the `elementDraft` computed with:

```ts
	const draft = runtime.elementTask.draft;
	if (!isElementTool(runtime.activeToolId.value) || !draft.points.length) return [];
	return [{ id: 'element-preview', kind: draft.kind, name: draft.name, points: [...draft.points, ...draftCursorPoints(draft)], ...draftPreviewFields(draft) }];
```

- In the template comment above the second pair of `ElementShapes` (starting `Only posts and beams draw here`), change `Only posts and beams draw here` to `Only posts, beams and drafting marks other than a hatch draw here`.

- [ ] **Step 10: A drafting mark has no grabbable name tag in `labelActions.ts`**

Add `import { draftingKind } from '../../../domain/spatial/SpatialElement';` and in `hitFor` change `if (!element) return null;` to:

```ts
		if (!element || draftingKind(element.kind)) return null;
```

- [ ] **Step 11: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/draftingMarks.test.ts tests/presentation/editor/draftingCanvas.test.ts tests/presentation/editor/structuralCanvasGeometry.test.ts tests/presentation/editor/stairsArrows.test.ts tests/presentation/editor/draftingCreation.test.ts`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/presentation/editor/elements/draftingMarks.ts src/presentation/editor/elements/DraftingShape.vue src/presentation/editor/elements/ElementShapes.vue src/presentation/editor/structure/StructureLayer.vue src/presentation/editor/labels/labelActions.ts tests/presentation/editor/draftingMarks.test.ts tests/presentation/editor/draftingCanvas.test.ts
git commit -m "Draw drafting marks on the plan canvas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 5: Hitting, dragging and rotating the marks

**Files:**
- Modify: `src/presentation/editor/elements/draftingMarks.ts` (append hit polygons)
- Modify: `src/presentation/editor/structure/structureCandidates.ts`
- Modify: `src/presentation/editor/selection/canvasCandidates.ts`
- Modify: `src/presentation/editor/tools/registerEditorTools.ts` (`spatialObjects`)
- Modify: `src/presentation/editor/layers/InteractionLayer.vue` (`candidates`)
- Modify: `src/presentation/editor/tools/select-tool.ts` (`SpatialObjectCandidate`)
- Modify: `src/presentation/editor/elements/ElementMove.ts` (`hasPointHandles`, `start`)
- Modify: `src/presentation/editor/elements/rotationControl.ts` (`edgesOf`)
- Test: `tests/presentation/editor/draftingHitTesting.test.ts`

**Interfaces:**
- Consumes: `dimensionChain` (Task 1); `DRAFTING_TEXT_PX`, `GRID_RADIUS_PX`, `MARKER_PX` (Task 4).
- Produces, from `draftingMarks.ts`:
  - `interface DraftingHitContext { readonly zoom: number; readonly names: ReadonlyMap<string, string> }`
  - `draftingHitPoints(element: SpatialElement, context: DraftingHitContext): readonly Point[] | undefined`
- Produces: `structureCandidates(structure, shapeOf = NO_SHAPES, marks?: DraftingHitContext)` and `canvasCandidates(zones, structure, visible, shapeOf = NO_SHAPES, marks?: DraftingHitContext)`.
- Produces: `SpatialObjectCandidate` gains `readonly offset?: number` and `readonly flipped?: boolean`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/draftingHitTesting.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { pointerAt } from '../../helpers/tool-context';
import { BOUNDARY_A, DIMENSION_A, GRID_A, HATCH_A, SECTION_A, TEXT_A, VIEW_A } from '../../helpers/drafting';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { hasPointHandles } from '../../../src/presentation/editor/elements/ElementMove';
import { acceptsElementPoints } from '../../../src/presentation/editor/elements/elementDraft';
import { measureLabelWidth } from '../../../src/presentation/editor/labels/labelLayout';
import { DRAFTING_TEXT_PX } from '../../../src/presentation/editor/elements/draftingMarks';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('hits a text across its drawn words and a grid point across its circle, at the zoom they are drawn at', () => {
	const structure = { ...EMPTY_STRUCTURE, elements: [TEXT_A, GRID_A] }, names = new Map([[TEXT_A.id, TEXT_A.name], [GRID_A.id, GRID_A.name]]);
	const at = (zoom: number, x: number, y: number) => resolveSelectionTarget({ candidates: structureCandidates(structure, undefined, { zoom, names }), selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 8 / zoom });
	const half = measureLabelWidth(TEXT_A.name, DRAFTING_TEXT_PX) / 2;
	expect(at(1, 1500 + half - 1, 1500)).toEqual({ kind: 'body', id: TEXT_A.id });
	expect(at(2, 1500 + half - 1, 1500)).toBeNull();
	expect(at(1, 7009, 0)).toEqual({ kind: 'body', id: GRID_A.id });
	expect(at(1, 7012, 0)).toBeNull();
	expect(structureCandidates(structure)[0].hitPoints).toBeUndefined();
});

it('hits a chain between its points and its line, a view marker at its triangle, a section along its line, a boundary and a hatch', () => {
	const structure = { ...EMPTY_STRUCTURE, elements: [DIMENSION_A, VIEW_A, SECTION_A, HATCH_A, BOUNDARY_A] };
	const candidates = structureCandidates(structure, undefined, { zoom: 1, names: new Map() });
	const at = (x: number, y: number) => resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 8 });
	expect(at(2000, -300)).toEqual({ kind: 'body', id: DIMENSION_A.id });
	expect(at(2000, 300)).toBeNull();
	expect(at(-1500, 1005)).toEqual({ kind: 'body', id: VIEW_A.id });
	expect(at(3000, 2004)).toEqual({ kind: 'body', id: SECTION_A.id });
	expect(at(2000, -1250)).toEqual({ kind: 'body', id: BOUNDARY_A.id });
	expect(at(1500, 6000)).toEqual({ kind: 'body', id: HATCH_A.id });
});

it('gives drag handles to every drafting mark of more than one point, and refuses a hatch outline that crosses itself', () => {
	expect(['dimension', 'section', 'view', 'hatch', 'boundary'].every(kind => hasPointHandles(kind))).toBe(true);
	expect(['text', 'grid'].some(kind => hasPointHandles(kind))).toBe(false);
	expect(acceptsElementPoints(HATCH_A, [HATCH_A.points[0], HATCH_A.points[2], HATCH_A.points[1], HATCH_A.points[3]])).toBe(false);
});

it('keeps a dimension chain\'s offset when one of its points is dragged', async () => {
	const rig = await editorWith(mounted, DIMENSION_A);
	rig.selection.select([DIMENSION_A.id as never]); await settle();
	rig.runtime.toolManager.pointerDown(pointerAt(4560, 0)); rig.runtime.toolManager.pointerMove(pointerAt(4900, 150)); rig.runtime.toolManager.pointerUp(pointerAt(4900, 150));
	await settleUntil(() => rig.project.structure.elements?.[0].points[3].x !== 4560, 'dragged point saved');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'dimension', offset: -600 });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/draftingHitTesting.test.ts`
Expected: FAIL. `structureCandidates` takes two arguments; `hasPointHandles('dimension')` is false; the drag never saves (the gesture's element has no `offset`, so `acceptsElementPoints` refuses it).

- [ ] **Step 3: Append the hit polygons to `draftingMarks.ts`**

Change the `SpatialElement` import to `import type { NamedSpatialElement, SpatialElement, SpatialElementKind } from '../../../domain/spatial/SpatialElement';` and append:

```ts
/** What a screen-constant mark, or a chain's band, needs to be hit: the zoom it is drawn at and, for a text, its words. */
export interface DraftingHitContext { readonly zoom: number; readonly names: ReadonlyMap<string, string> }
const LINE_HIT_PX = 6;

function box(centre: Point, halfWidth: number, halfHeight: number): Point[] {
	return [{ x: centre.x - halfWidth, y: centre.y - halfHeight }, { x: centre.x + halfWidth, y: centre.y - halfHeight },
		{ x: centre.x + halfWidth, y: centre.y + halfHeight }, { x: centre.x - halfWidth, y: centre.y + halfHeight }];
}
/** The band between a chain's points and its line, padded so a chain whose line lies on its own points is still hit. */
function dimensionBand(element: SpatialElement, zoom: number): Point[] | undefined {
	const chain = dimensionChain(element.points, element.offset ?? 0), origin = element.points[0];
	if (!chain || !origin) return undefined;
	const { direction, normal } = chain, pad = LINE_HIT_PX / zoom, offset = element.offset ?? 0;
	const along = element.points.map(point => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y);
	const across = element.points.map(point => (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y);
	const start = Math.min(...along) - pad, end = Math.max(...along) + pad, low = Math.min(offset, ...across) - pad, high = Math.max(offset, ...across) + pad;
	const at = (a: number, b: number): Point => ({ x: origin.x + direction.x * a + normal.x * b, y: origin.y + direction.y * a + normal.y * b });
	return [at(start, low), at(end, low), at(end, high), at(start, high)];
}
/** The world polygon a drafting mark is hit by at `context.zoom`; undefined where its stored points already answer (a line, an outline). */
export function draftingHitPoints(element: SpatialElement, context: DraftingHitContext): readonly Point[] | undefined {
	const point = element.points[0], zoom = context.zoom;
	if (element.kind === 'dimension') return dimensionBand(element, zoom);
	if (!point) return undefined;
	if (element.kind === 'grid') return box(point, GRID_RADIUS_PX / zoom, GRID_RADIUS_PX / zoom);
	if (element.kind === 'view') return box(point, MARKER_PX / zoom, MARKER_PX / zoom);
	if (element.kind !== 'text') return undefined;
	return box(point, measureLabelWidth(context.names.get(element.id) ?? '', DRAFTING_TEXT_PX) / zoom / 2, DRAFTING_TEXT_PX / zoom / 2);
}
```

- [ ] **Step 4: Thread the context through the candidates**

Replace `src/presentation/editor/structure/structureCandidates.ts` with:

```ts
import { openingPoints, wallLength, type Structure } from '../../../domain/spatial/Structure';
import { derivedFootprintKind, type SpatialElement } from '../../../domain/spatial/SpatialElement';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { elementFootprint, NO_SHAPES, type ShapeLookup } from '../elements/elementFootprint';
import { draftingHitPoints, type DraftingHitContext } from '../elements/draftingMarks';

/** A derived footprint, or a drafting mark's screen-size box when the caller knows the zoom it is drawn at. */
function hitPointsOf(element: SpatialElement, shapeOf: ShapeLookup, marks: DraftingHitContext | undefined) {
	if (derivedFootprintKind(element.kind)) return elementFootprint(element, shapeOf);
	return marks ? draftingHitPoints(element, marks) : undefined;
}
export function structureCandidates(structure: Structure, shapeOf: ShapeLookup = NO_SHAPES, marks?: DraftingHitContext): SpatialObjectCandidate[] {
	return [
		...(structure.elements ?? []).map(element => { const hitPoints = hitPointsOf(element, shapeOf, marks); return { ...element, ...(hitPoints ? { hitPoints } : {}) }; }),
		...structure.walls.map(wall => ({ id: wall.id, kind: 'wall' as const, points: [wall.start, wall.end], bulges: [wall.bulge ?? 0, 0], width: wall.thickness })),
		...structure.openings.map(opening => {
			const host = structure.walls.find(wall => wall.id === opening.hostId);
			const bulge = host ? Math.tan(Math.atan(host.bulge ?? 0) * opening.width / wallLength(host)) : 0;
			return { id: opening.id, kind: 'opening' as const, points: openingPoints(opening, structure.walls), bulges: [bulge, 0], width: host?.thickness };
		}),
	];
}
```

In `canvasCandidates.ts` add `import type { DraftingHitContext } from '../elements/draftingMarks';`, add a fifth parameter `marks?: DraftingHitContext` after `shapeOf: ShapeLookup = NO_SHAPES`, and pass it: `structureCandidates(structure, shapeOf, marks)`.

In `registerEditorTools.ts` add `import { useEditorStore } from '../../stores/EditorStore';`, add `const editor = useEditorStore();` below `const assetShapes = useAssetShapeStore();`, and replace the `spatialObjects` line with:

```ts
			spatialObjects: () => canvasCandidates(projectStore.zones.values(), projectStore.structure, workspace.layerVisibility, assetShapes.shapeOf,
				{ zoom: editor.viewport.zoom, names: new Map(projectStore.plan?.spatialElements?.map(item => [item.id, item.name])) }),
```

In `InteractionLayer.vue`, replace `...structureCandidates(preview?.structure ?? projectStore.structure, assetShapes.shapeOf).map(item => [item.id, item] as const)]);` with:

```ts
		...structureCandidates(preview?.structure ?? projectStore.structure, assetShapes.shapeOf, { zoom: editorStore.viewport.zoom, names: new Map(projectStore.plan?.spatialElements?.map(item => [item.id, item.name])) }).map(item => [item.id, item] as const)]);
```

- [ ] **Step 5: Handles, drag facts and rotation**

In `select-tool.ts`, add to `SpatialObjectCandidate` after `readonly loadBearing?: boolean;`:

```ts
	readonly offset?: number;
	readonly flipped?: boolean;
```

In `ElementMove.ts`, replace `hasPointHandles` and its docblock:

```ts
/** Elements whose individual points drag; a stair, a post, an asset, a text and a grid point move only as a body. */
export const hasPointHandles = (kind: string | undefined): boolean => ['arrow', 'path', 'fence', 'measurement', 'object', 'beam', 'dimension', 'section', 'view', 'hatch', 'boundary'].includes(kind ?? '');
```

and in `start`, replace the two lines from the `// A beam's width…` comment to the `this.gesture = …` assignment with:

```ts
		// A beam's width, a post's or beam's load-bearing flag, a chain's offset and a section's look side are required: without them `acceptsElementPoints` refuses every endpoint drag.
		const facts = { ...(hit.width === undefined ? {} : { width: hit.width }), ...(hit.loadBearing === undefined ? {} : { loadBearing: hit.loadBearing }),
			...(hit.offset === undefined ? {} : { offset: hit.offset }), ...(hit.flipped === undefined ? {} : { flipped: hit.flipped }) };
		this.gesture = { element: { id: hit.id, kind: hit.kind, points: hit.points, ...(hit.stair ? { stair: hit.stair } : {}), ...facts }, start: event.worldPoint, points: hit.points, vertexIndex, context };
```

In `rotationControl.ts`, in `edgesOf`, change `['room', 'area', 'object', 'post', 'group', 'stair']` to `['room', 'area', 'object', 'post', 'hatch', 'group', 'stair']`.

- [ ] **Step 6: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/draftingHitTesting.test.ts tests/presentation/editor/structuralCanvasGeometry.test.ts tests/presentation/editor/selection tests/presentation/editor/structuralInspector.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/elements/draftingMarks.ts src/presentation/editor/structure/structureCandidates.ts src/presentation/editor/selection/canvasCandidates.ts src/presentation/editor/tools/registerEditorTools.ts src/presentation/editor/layers/InteractionLayer.vue src/presentation/editor/tools/select-tool.ts src/presentation/editor/elements/ElementMove.ts src/presentation/editor/elements/rotationControl.ts tests/presentation/editor/draftingHitTesting.test.ts
git commit -m "Select, drag and rotate drafting marks where they are drawn

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The drafting task form

**Files:**
- Create: `src/presentation/editor/elements/DraftingDraftFields.vue`
- Modify: `src/presentation/editor/elements/ElementTaskForm.vue`
- Test: `tests/presentation/editor/draftingTaskForm.test.ts`

**Interfaces:**
- Consumes: `maxDraftPoints`, `draft.dimensionPhase`, `draft.offset` (Task 3); locale keys `editor.drafting.text`, `editor.drafting.offset`, `editor.drafting.offset-invalid` (Task 3).
- Produces: an input `name="dimension-offset"` while a chain's line is placed; the name input labelled **Text** for a text, focused once its point is placed.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/draftingTaskForm.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import type { ElementToolId } from '../../../src/presentation/editor/elements/elementDraft';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup(tool: ElementToolId): Promise<Rig> {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	rig.runtime.setTool(tool);
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, `${tool} baseline`);
	return rig;
}

it('labels a text\'s name field Text, hands it the keyboard once the point is placed, and saves the typed words', async () => {
	const rig = await setup('place-text');
	const field = rig.wrapper.get<HTMLInputElement>('[data-rp-form="element-create"] input[name="element-name"]');
	expect(field.element.closest('label')?.textContent).toContain('Text');
	rig.runtime.elementTask.addPoint({ x: 1500, y: 1500 }); await settle();
	expect(document.activeElement).toBe(field.element);
	await field.setValue('Wintergarten');
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'saved text');
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Wintergarten');
});

it('offers an Offset field only while a chain\'s line is placed, holds Finish on unreadable text, and saves the typed offset', async () => {
	const rig = await setup('draw-dimension'), task = rig.runtime.elementTask;
	task.addPoint({ x: 0, y: 0 }); task.addPoint({ x: 4000, y: 0 }); await settle();
	expect(rig.wrapper.find('input[name="dimension-offset"]').exists()).toBe(false);
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click'); await settle();
	const offset = rig.wrapper.get('input[name="dimension-offset"]');
	await offset.setValue('x');
	expect(offset.attributes('aria-invalid')).toBe('true');
	expect(task.canFinish.value).toBe(false);
	await offset.setValue('-0,8');
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'saved chain');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'dimension', offset: -800 });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/draftingTaskForm.test.ts`
Expected: FAIL. The label reads "Name", focus stays where it was, and no `dimension-offset` input exists.

- [ ] **Step 3: Create `src/presentation/editor/elements/DraftingDraftFields.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import FieldError from '../../components/FieldError.vue';
import type { EditorRuntime } from '../runtime';
import { formatMetres, parseCoordinateMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
const props = defineProps<{ task: EditorRuntime['elementTask'] }>();
const draft = props.task.draft;
const text = ref(formatMetres(draft.offset));
const invalid = computed(() => !parseCoordinateMetres(text.value).ok);
function input(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (props.task.blocked.value) { control.value = text.value; return; }
	text.value = control.value;
	const parsed = parseCoordinateMetres(control.value);
	// A typed offset replaces the pointer's until the pointer moves over the canvas again.
	if (parsed.ok) { draft.offset = parsed.mm; draft.cursor = null; }
	// An unreadable offset holds Finish and the placing click until it reads again.
	draft.pendingInput = !parsed.ok;
}
</script>
<template>
	<fieldset class="rp-stair-fields">
		<legend>{{ tr('editor.add.dimension.label') }}</legend>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="invalid ? tr('editor.drafting.offset-invalid') : null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr('editor.drafting.offset') }}
				<input
					:id="inputId"
					v-bind="aria"
					name="dimension-offset"
					type="text"
					inputmode="decimal"
					:value="text"
					:readonly="task.blocked.value"
					@input="input"
				>
			</label>
		</FieldError>
	</fieldset>
</template>
```

- [ ] **Step 4: Wire the form in `ElementTaskForm.vue`**

- Change `import { computed, nextTick, onBeforeUnmount, ref } from 'vue';` to `import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';`.
- Add `import DraftingDraftFields from './DraftingDraftFields.vue';` and `import { maxDraftPoints } from './elementDraft';`.
- Below `const taskRoot = ref<HTMLElement | null>(null);` add:

```ts
const nameInput = ref<HTMLInputElement | null>(null);
// A text's point is placed on the canvas and its words typed here, so placing the point hands the keyboard to the field.
watch(() => draft.kind === 'text' ? draft.points[0] : undefined, point => { if (point) void nextTick(() => nameInput.value?.focus()); });
```

- In `addBlocked`, replace `((draft.kind === 'measurement' || draft.kind === 'stair' || draft.kind === 'beam') && draft.points.length === 2)` with `(maxDraftPoints(draft.kind) === 2 && draft.points.length === 2)`.
- In the name `<label>`, replace `{{ tr('editor.room.name') }}` with `{{ tr(draft.kind === 'text' ? 'editor.drafting.text' : 'editor.room.name') }}`, and add `ref="nameInput"` to its `<input>` (after `:id="inputId"`).
- After the `<StructuralDraftFields … />` element add:

```vue
		<DraftingDraftFields
			v-if="draft.kind === 'dimension' && draft.dimensionPhase === 'offset'"
			:task="task"
		/>
```

- [ ] **Step 5: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/draftingTaskForm.test.ts tests/presentation/editor/structuralCreation.test.ts tests/presentation/editor/draftingCreation.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/elements/DraftingDraftFields.vue src/presentation/editor/elements/ElementTaskForm.vue tests/presentation/editor/draftingTaskForm.test.ts
git commit -m "Type a text's words and a dimension chain's offset in the task form

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 7: Inspector, Flip direction and the dimension edit form

**Files:**
- Create: `src/presentation/editor/elements/dimensionInput.ts`
- Create: `src/presentation/editor/elements/DimensionEditForm.vue`
- Modify: `src/presentation/editor/elements/elementActions.ts` (`setLoadBearing`, new `flip`)
- Modify: `src/presentation/editor/elements/elementEditPresentation.ts`
- Modify: `src/presentation/editor/elements/ElementInspector.vue`
- Test: `tests/presentation/editor/draftingInspector.test.ts`

**Interfaces:**
- Consumes: fixtures `DIMENSION_A`, `SECTION_A`, `TEXT_A`, `GRID_A`, `BOUNDARY_A`; `draftingKind`, `pointKind` (Task 1); locale keys `editor.drafting.flip`, `editor.drafting.offset`, `editor.drafting.offset-invalid`, `editor.drafting.apply` (Task 3).
- Produces, from `dimensionInput.ts`:
  - `interface DimensionText { name: string; offset: string }`
  - `interface DimensionEdit { readonly name: string; readonly points: readonly Point[]; readonly offset: number }`
  - `dimensionText(offset: number, name: string): DimensionText`
  - `dimensionEdit(points: readonly Point[], stored: number, text: DimensionText): { edit: DimensionEdit | null; invalid: boolean }`
- Produces: `runtime.elementActions.flip(id: string): Promise<void>` (Task 8's menu calls it).
- Produces: a form `data-rp-form="dimension-edit"` with input `name="dimension-offset"`; an inspector button `data-rp-action="flip-section"`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/draftingInspector.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { BOUNDARY_A, DIMENSION_A, GRID_A, SECTION_A, TEXT_A } from '../../helpers/drafting';
import { dimensionEdit, dimensionText } from '../../../src/presentation/editor/elements/dimensionInput';
import { elementLength } from '../../../src/domain/spatial/SpatialElement';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('proposes a new offset for unchanged points, keeps the stored millimetres behind an untouched field, and refuses unreadable text', () => {
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }];
	expect(dimensionEdit(points, -612.4, dimensionText(-612.4, 'Front')).edit).toEqual({ name: 'Front', points, offset: -612.4 });
	expect(dimensionEdit(points, -600, { name: 'Front', offset: '0,25' }).edit).toEqual({ name: 'Front', points, offset: 250 });
	expect(dimensionEdit(points, -600, { name: 'Front', offset: 'x' })).toEqual({ edit: null, invalid: true });
	expect(dimensionEdit(points, -600, { name: ' ', offset: '1' }).edit).toBeNull();
});

it('flips a section line from its Inspector through undoable history', async () => {
	const rig = await editorWith(mounted, SECTION_A);
	rig.selection.select([SECTION_A.id as never]); await settle();
	expect(rig.wrapper.get('.rp-element-inspector').text()).toContain('Section line');
	await rig.wrapper.get('[data-rp-action="flip-section"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.[0].flipped === true, 'flipped');
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements?.[0].flipped).toBe(false);
});

it('edits a dimension chain\'s offset and keeps its points', async () => {
	const rig = await editorWith(mounted, DIMENSION_A);
	rig.selection.select([DIMENSION_A.id as never]); await settle();
	const editing = rig.runtime.elementActions.edit(DIMENSION_A.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="dimension-edit"]');
	expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	await form.get('input[name="dimension-offset"]').setValue('-0,8');
	await form.trigger('submit'); await editing; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ offset: -800, points: DIMENSION_A.points });
});

it('shows no length line for a text or a grid point, a length for a boundary line, and no renovation entry for any of them', async () => {
	const rig = await editorWith(mounted, TEXT_A, GRID_A, BOUNDARY_A);
	for (const item of [TEXT_A, GRID_A]) {
		rig.selection.select([item.id as never]); await settle();
		const inspector = rig.wrapper.get('.rp-element-inspector');
		expect(inspector.findAll('.rp-inspector-subline')).toHaveLength(1);
		expect(inspector.find('.rp-structure-renovation-entry').exists()).toBe(false);
	}
	rig.selection.select([BOUNDARY_A.id as never]); await settle();
	const inspector = rig.wrapper.get('.rp-element-inspector');
	expect(inspector.text()).toContain(`${formatMetres(elementLength(BOUNDARY_A))} m`);
	expect(inspector.find('.rp-structure-renovation-entry').exists()).toBe(false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/draftingInspector.test.ts`
Expected: FAIL. Module `dimensionInput` does not exist.

- [ ] **Step 3: Create `src/presentation/editor/elements/dimensionInput.ts`**

```ts
import type { Point } from '../../../core/geometry/Point';
import { formatMetres, parseCoordinateMetres } from '../shell/formatLength';

export interface DimensionText { name: string; offset: string }
export interface DimensionEdit { readonly name: string; readonly points: readonly Point[]; readonly offset: number }

export function dimensionText(offset: number, name: string): DimensionText {
	return { name, offset: formatMetres(offset) };
}

/** What the dimension form proposes: a new offset for the unchanged points. A field still showing its stored value keeps the stored millimetres, never their rounded display. */
export function dimensionEdit(points: readonly Point[], stored: number, text: DimensionText): { edit: DimensionEdit | null; invalid: boolean } {
	const parsed = text.offset === formatMetres(stored) ? { ok: true as const, mm: stored } : parseCoordinateMetres(text.offset);
	const name = text.name.trim();
	return { edit: parsed.ok && name ? { name, points, offset: parsed.mm } : null, invalid: !parsed.ok };
}
```

- [ ] **Step 4: Create `src/presentation/editor/elements/DimensionEditForm.vue`**

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { err } from '../../../core/result/Result';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import GeometryFormHead from '../forms/GeometryFormHead.vue';
import FieldError from '../../components/FieldError.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { commitTextInput } from '../forms/commitTextInput';
import { dimensionEdit, dimensionText, type DimensionEdit, type DimensionText } from './dimensionInput';

const props = defineProps<{ offset: number; points: readonly Point[]; name: string; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>; latest: Readonly<Ref<string | null>>;
	inputBlocked: Readonly<Ref<boolean>>; logger: Logger; retry: () => Promise<void>; openSource: () => Promise<void>;
	dispatch: (value: DimensionEdit) => Promise<DispatchResult>; preview: (value: DimensionEdit | null) => void }>();
const emit = defineEmits<{ submit: [] }>();
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
let alive = true;
const form = useFormCommit({ initial: dimensionText(props.offset, props.name), logger: props.logger, errorMap: {}, toUserMessage: trError,
	dispatch: (value: DimensionText) => { const { edit } = dimensionEdit(props.points, props.offset, value); return edit ? props.dispatch(edit) : Promise.resolve(err(spatialError('element-invalid'))); } });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const parsed = computed(() => dimensionEdit(props.points, props.offset, form.values.value));
const paused = computed(() => props.inputBlocked.value || form.submitting.value);
const unchanged = computed(() => parsed.value.edit !== null && parsed.value.edit.name === props.name && parsed.value.edit.offset === props.offset);
const disabled = computed(() => props.blocked.value || paused.value || props.latest.value !== null || !parsed.value.edit || unchanged.value);
function input(field: keyof DimensionText, event: Event): void {
	commitTextInput(event, form.values.value[field], refuseInput, value => form.setField(field, value));
}
watchEffect(() => props.preview(parsed.value.edit));
onBeforeUnmount(() => { alive = false; props.preview(null); });
async function submit(): Promise<void> {
	if (disabled.value) { await focusFirstInvalidControl(); return; }
	if (await form.submit() && alive) emit('submit');
}
</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		data-rp-form="dimension-edit"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<GeometryFormHead
			:blocked="blocked.value"
			:busy="busy.value"
			:retry="retry"
			:open-source="openSource"
			:banner="form.banner.value"
			:latest="latest.value"
			:name="form.values.value.name"
			:readonly="paused"
			@name-input="input('name', $event)"
		/>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="parsed.invalid ? tr('editor.drafting.offset-invalid') : null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr('editor.drafting.offset') }}
				<input
					:id="inputId"
					v-bind="aria"
					name="dimension-offset"
					type="text"
					inputmode="decimal"
					:value="form.values.value.offset"
					:readonly="paused"
					@input="input('offset', $event)"
				>
			</label>
		</FieldError>
		<button
			type="submit"
			class="mod-cta"
			:aria-disabled="disabled"
		>
			{{ tr('editor.drafting.apply') }}
		</button>
	</form>
</template>
```

If `npm run check` later reports this file and `StructuralEditForm.vue` as a fallow clone family, extract the shared script lines into `src/presentation/editor/forms/useGeometryEditForm.ts` in the same pull request rather than suppressing the finding.

- [ ] **Step 5: Open it from `elementEditPresentation.ts`**

- Add `import DimensionEditForm from './DimensionEditForm.vue';` and `import type { DimensionEdit } from './dimensionInput';`.
- Change the `dispatch` parameter type to `(value: Pick<NamedSpatialElement, 'name' | 'points' | 'stair' | 'width' | 'offset'>) => Promise<DispatchResult>`.
- Directly before the final `return { component: markRaw(OutlinePointsForm), … }` add:

```ts
	if (element.kind === 'dimension' && element.offset !== undefined) return { component: markRaw(DimensionEditForm), props: {
		offset: element.offset,
		dispatch: (value: DimensionEdit) => dispatch(value),
		preview: (value: DimensionEdit | null) => preview(value ? { ...element, ...value } : null),
	} };
```

- [ ] **Step 6: Add `flip` to `elementActions.ts`**

Replace `setLoadBearing` (the docblock and the function) with:

```ts
	/** One owned fact changed in place — load-bearing, a section's look side — through the same guarded, undoable write as a move. */
	function rewrite(id: string, change: (element: NamedSpatialElement) => NamedSpatialElement | null): Promise<void> {
		return operate(id, async ({ baseline, element }) => {
			const next = change(element);
			if (!next || !context.commands.renovation) return;
			const result = await runtime.dispatcher.run(context.commands.renovation.command(baseline, elementInput(baseline, next), runtime.structureTask.ledger));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
	function setLoadBearing(id: string, loadBearing: boolean): Promise<void> {
		return rewrite(id, element => (element.kind === 'post' || element.kind === 'beam') && element.loadBearing !== loadBearing ? { ...element, loadBearing } : null);
	}
	/** Turns a section line to look at its other side (plan drafting tools design §7). */
	function flip(id: string): Promise<void> {
		return rewrite(id, element => element.kind === 'section' ? { ...element, flipped: element.flipped !== true } : null);
	}
```

and add `flip,` after `setLoadBearing,` in the returned object.

- [ ] **Step 7: The Inspector in `ElementInspector.vue`**

- Change `import { elementLength } from '../../../domain/spatial/SpatialElement';` to `import { draftingKind, elementLength, pointKind } from '../../../domain/spatial/SpatialElement';`.
- Change the length paragraph's `v-else` to `v-else-if="!pointKind(element.kind)"`.
- Change `<StructureRenovationEntry />` to `<StructureRenovationEntry v-if="!draftingKind(element.kind)" />`.
- Inside `<div class="rp-inspector-actions">`, before the `edit-element` button, add:

```vue
			<button
				v-if="element.kind === 'section' && session.perspective === 'plan'"
				type="button"
				class="rp-inspector-action"
				data-rp-action="flip-section"
				:aria-disabled="runtime.elementActions.blocked.value"
				@click="runtime.elementActions.flip(element.id)"
			>
				{{ tr('editor.drafting.flip') }}
			</button>
```

- [ ] **Step 8: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/draftingInspector.test.ts tests/presentation/editor/structuralInspector.test.ts tests/presentation/editor/structuralDeletion.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/editor/elements/dimensionInput.ts src/presentation/editor/elements/DimensionEditForm.vue src/presentation/editor/elements/elementActions.ts src/presentation/editor/elements/elementEditPresentation.ts src/presentation/editor/elements/ElementInspector.vue tests/presentation/editor/draftingInspector.test.ts
git commit -m "Flip a section line and edit a dimension chain's offset from the Inspector

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The Drafting submenu and its icons

**Files:**
- Create: `src/presentation/editor/selection/draftingMenuActions.ts`
- Modify: `src/presentation/editor/selection/useCanvasMenuActions.ts`
- Modify: `src/plugin/editorIconRegistration.ts`
- Modify: `tests/plugin/editorIconRegistration.test.ts`
- Modify: `tests/presentation/editor/contextMenuActions.test.ts` (two order expectations)
- Test: `tests/presentation/editor/draftingMenu.test.ts`

**Interfaces:**
- Consumes: `runtime.elementTask.startAt` (Task 3), `runtime.elementActions.flip` (Task 7), `draftingKind` (Task 1), locale keys `editor.drafting.menu`, `editor.drafting.flip`, `editor.add.<kind>.label` (Task 3).
- Produces, from `draftingMenuActions.ts`: `useDraftingMenuActions(opened: () => Point): { submenu(blocked: boolean): CanvasMenuSubmenu; flip(id: string, blocked: boolean): CanvasMenuAction[]; isMark(id: string): boolean }`.
- Produces menu ids: parent `drafting-menu`; children `draft-dimension`, `draft-section`, `draft-view`, `draft-hatch`, `draft-text`, `draft-boundary`, `draft-grid`; `flip-section`.
- Produces icons: `rp-dimension`, `rp-section`, `rp-view`, `rp-hatch`, `rp-text`, `rp-boundary`, `rp-grid`.

`useCanvasMenuActions` sits within a few lines of the 100-line function budget. Every change to it below edits an existing line; none adds one.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/draftingMenu.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { SECTION_A } from '../../helpers/drafting';
import { registerEditorIcons } from '../../../src/plugin/editorIconRegistration';

const mounted: EditorRig[] = [];
let unregister: () => void;
beforeEach(() => { unregister = registerEditorIcons(); });
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); unregister(); });

async function menu(rig: EditorRig): Promise<void> { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); }
async function close(rig: EditorRig): Promise<void> { await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' }); await settle(); }
const item = (rig: EditorRig, id: string) => rig.wrapper.get(`[data-rp-context-action="${id}"]`);
const has = (rig: EditorRig, id: string) => rig.wrapper.find(`[data-rp-context-action="${id}"]`).exists();

it('offers every drafting tool from the empty canvas with a known icon, and starts the chosen one at the menu\'s point', async () => {
	const rig = await editorWith(mounted);
	rig.selection.clear(); await menu(rig);
	await item(rig, 'drafting-menu').trigger('click'); await settle();
	expect(rig.wrapper.findAll('.rp-canvas-context-menu--nested [data-rp-context-action]').map(entry => entry.attributes('data-rp-context-action')))
		.toEqual(['draft-dimension', 'draft-section', 'draft-view', 'draft-hatch', 'draft-text', 'draft-boundary', 'draft-grid']);
	expect(rig.wrapper.find('.rp-canvas-context-menu--nested [data-icon-missing]').exists()).toBe(false);
	await item(rig, 'draft-grid').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'grid placed from the menu');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'grid' });
	expect(rig.runtime.activeToolId.value).toBe('place-grid');
});

it('offers the Drafting submenu with one item and with several selected, but not in Review', async () => {
	const rig = await editorWith(mounted);
	rig.selection.select(['wall-a' as never]); await menu(rig);
	expect(has(rig, 'drafting-menu')).toBe(true); expect(has(rig, 'add-menu')).toBe(true);
	await close(rig);
	rig.selection.select(['wall-a', 'wall-b'] as never[]); await menu(rig);
	expect(has(rig, 'drafting-menu')).toBe(true);
	await close(rig);
	await rig.runtime.renovation.perspective('review'); rig.selection.clear(); await menu(rig);
	expect(has(rig, 'drafting-menu')).toBe(false);
});

it('greys the Drafting submenu with its reason while the floor is stale', async () => {
	const rig = await editorWith(mounted);
	rig.project.stale = true; rig.selection.clear(); await menu(rig);
	expect(item(rig, 'drafting-menu').attributes('aria-disabled')).toBe('true');
	expect(item(rig, 'drafting-menu').attributes('title')).toBe('Editing is paused until the floor is re-read.');
});

it('flips a selected section line from its menu, and offers it no record creations', async () => {
	const rig = await editorWith(mounted, SECTION_A);
	rig.selection.select([SECTION_A.id as never]); await menu(rig);
	expect(has(rig, 'add-menu')).toBe(false);
	await item(rig, 'flip-section').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.[0].flipped === true, 'flipped from the menu');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run check:fast -- tests/presentation/editor/draftingMenu.test.ts`
Expected: FAIL. No `drafting-menu` item exists.

- [ ] **Step 3: Create `src/presentation/editor/selection/draftingMenuActions.ts`**

```ts
import { draftingKind } from '../../../domain/spatial/SpatialElement';
import type { Point } from '../../../core/geometry/Point';
import type { StringKey } from '../../i18n/locales/en';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorRuntime } from '../runtime';
import type { ElementToolId } from '../elements/elementDraft';
import type { CanvasMenuAction, CanvasMenuSubmenu } from './useCanvasMenuActions';

const DRAFTING_TOOLS: readonly { readonly id: string; readonly tool: ElementToolId; readonly label: StringKey; readonly icon: string }[] = [
	{ id: 'draft-dimension', tool: 'draw-dimension', label: 'editor.add.dimension.label', icon: 'rp-dimension' },
	{ id: 'draft-section', tool: 'draw-section', label: 'editor.add.section.label', icon: 'rp-section' },
	{ id: 'draft-view', tool: 'place-view', label: 'editor.add.view.label', icon: 'rp-view' },
	{ id: 'draft-hatch', tool: 'draw-hatch', label: 'editor.add.hatch.label', icon: 'rp-hatch' },
	{ id: 'draft-text', tool: 'place-text', label: 'editor.add.text.label', icon: 'rp-text' },
	{ id: 'draft-boundary', tool: 'draw-boundary', label: 'editor.add.boundary.label', icon: 'rp-boundary' },
	{ id: 'draft-grid', tool: 'place-grid', label: 'editor.add.grid.label', icon: 'rp-grid' },
];

/** Right-click › Drafting: every drafting tool, started at the point the menu opened, and a section line's Flip direction (plan drafting tools design §7). */
export function useDraftingMenuActions(opened: () => Point) {
	const runtime = useEditorRuntime(), project = useProjectStore();
	function submenu(blocked: boolean): CanvasMenuSubmenu {
		const disabled = blocked || !runtime.elementTask.available;
		return { id: 'drafting-menu', label: 'editor.drafting.menu', group: 'create', icon: 'pencil',
			children: DRAFTING_TOOLS.map(entry => ({ id: entry.id, label: entry.label, group: 'create', icon: entry.icon, disabled, run: () => runtime.elementTask.startAt(entry.tool, opened()) })) };
	}
	/** Whether `id` is a drafting mark, which carries no renovation records. */
	function isMark(id: string): boolean {
		return project.structure.elements?.some(item => item.id === id && draftingKind(item.kind)) === true;
	}
	function flip(id: string, blocked: boolean): CanvasMenuAction[] {
		if (!project.structure.elements?.some(item => item.id === id && item.kind === 'section')) return [];
		return [{ id: 'flip-section', label: 'editor.drafting.flip', group: 'edit', icon: 'rotate-cw', disabled: blocked || runtime.elementActions.active.value, run: () => runtime.elementActions.flip(id) }];
	}
	return { submenu, flip, isMark };
}
```

- [ ] **Step 4: Wire it into `useCanvasMenuActions.ts` without adding a line**

- Add `import { useDraftingMenuActions } from './draftingMenuActions';` to the imports.
- Change `const detailPlans = useDetailPlanActions(), records = useRecordMenuActions();` to:

```ts
	const detailPlans = useDetailPlanActions(), records = useRecordMenuActions(), drafting = useDraftingMenuActions(opened);
```

- In `addSubmenu`, change `const children = [...wallActions(id, blocked), ...records(id, blocked)];` to:

```ts
		const children = [...wallActions(id, blocked), ...(drafting.isMark(id) ? [] : records(id, blocked))];
```

- In the returned `computed`, change `if (ids.length === 1) result.push(...singleActions(id, blocked), ...addSubmenu(id, blocked));` to:

```ts
		if (ids.length === 1) result.push(...singleActions(id, blocked), ...drafting.flip(id, blocked), ...addSubmenu(id, blocked));
```

- Change the `measure` push (edited in Task 3) to push the submenu after it in the same call:

```ts
		result.push({ id: 'measure', label: 'editor.input.measure-here', group: 'create', icon: 'ruler', disabled: blocked || !runtime.elementTask.available, run: () => runtime.elementTask.startAt('measure', opened()) }, drafting.submenu(blocked));
```

- In the docblock above `addSubmenu`, change `plus every target's record creations` to `plus every target's record creations but a drafting mark's`.

- [ ] **Step 5: Register the seven icons in `src/plugin/editorIconRegistration.ts`**

Replace the `ICONS` line with:

```ts
/** A dimension chain: two extension lines, the line between them and its oblique ticks. */
const DIMENSION_ICON = '<path d="M14 24V76 M86 24V76 M8 50H92 M6 58L22 42 M78 58L94 42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';
/** A section line: dash-dot with a filled triangle at each end. */
const SECTION_ICON = '<path d="M8 62H26 M38 62H46 M58 62H66 M78 62H92" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M8 62L20 34L32 62Z M68 62L80 34L92 62Z" fill="currentColor"/>';
/** A view marker: a hollow triangle pointing the way it looks. */
const VIEW_ICON = '<path d="M50 16L86 80H14Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>';
/** A hatched area: a square crossed both ways. */
const HATCH_ICON = '<path d="M14 14H86V86H14Z M14 50L50 14 M14 86L86 14 M50 86L86 50 M14 50L50 86 M14 14L86 86 M50 14L86 50" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>';
/** A text: a capital T. */
const TEXT_ICON = '<path d="M18 20H82 M50 20V84 M36 84H64" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';
/** A boundary line: a dashed polyline. */
const BOUNDARY_ICON = '<path d="M8 66L36 42L64 58L92 30" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16 10"/>';
/** A grid point: a circle with its number. */
const GRID_ICON = '<circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="8"/><path d="M42 36L52 30V70" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
const ICONS: Readonly<Record<string, string>> = {
	'rp-stairs': STAIR_ICON, 'rp-post': POST_ICON, 'rp-beam': BEAM_ICON,
	'rp-dimension': DIMENSION_ICON, 'rp-section': SECTION_ICON, 'rp-view': VIEW_ICON, 'rp-hatch': HATCH_ICON, 'rp-text': TEXT_ICON, 'rp-boundary': BOUNDARY_ICON, 'rp-grid': GRID_ICON,
};
```

- [ ] **Step 6: Update the two tests that pin what exists**

In `tests/plugin/editorIconRegistration.test.ts`:
- After the `rp-beam` expectation add `for (const name of ['rp-dimension', 'rp-section', 'rp-view', 'rp-hatch', 'rp-text', 'rp-boundary', 'rp-grid']) expect(add).toHaveBeenCalledWith(name, expect.stringContaining('stroke="currentColor"'));`.
- Change `expect(remove).toHaveBeenCalledTimes(3);` to `expect(remove).toHaveBeenCalledTimes(10);` and the name list in the last loop to `['rp-stairs', 'rp-post', 'rp-beam', 'rp-dimension', 'rp-section', 'rp-view', 'rp-hatch', 'rp-text', 'rp-boundary', 'rp-grid']`.

In `tests/presentation/editor/contextMenuActions.test.ts`:
- `expect(groupedIds(empty)).toEqual(['add', 'measure', '|', 'fit', 'pan']);` becomes `expect(groupedIds(empty)).toEqual(['add', 'measure', 'drafting-menu', '|', 'fit', 'pan']);`.
- `['rename', 'add-point', 'rotate', '|', 'add-menu', 'measure', '|', 'copy', '|', 'enclose', '|', 'fit', 'pan', '|', 'delete']` becomes `['rename', 'add-point', 'rotate', '|', 'add-menu', 'measure', 'drafting-menu', '|', 'copy', '|', 'enclose', '|', 'fit', 'pan', '|', 'delete']`.

Then grep for any other full-list pin of a top-level menu: `grep -rn "'measure', '|'" tests`. Update each hit the same way, inserting `'drafting-menu'` directly after `'measure'`.

- [ ] **Step 7: Run the tests**

Run: `npm run check:fast -- tests/presentation/editor/draftingMenu.test.ts tests/presentation/editor/contextMenuActions.test.ts tests/presentation/editor/contextMenuSubmenu.test.ts tests/presentation/editor/wallContextActions.test.ts tests/presentation/editor/clipboard.test.ts tests/plugin/editorIconRegistration.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/editor/selection/draftingMenuActions.ts src/presentation/editor/selection/useCanvasMenuActions.ts src/plugin/editorIconRegistration.ts tests/plugin/editorIconRegistration.test.ts tests/presentation/editor/contextMenuActions.test.ts tests/presentation/editor/draftingMenu.test.ts
git commit -m "Reach every drafting tool from a Drafting submenu in the canvas context menu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 9: Harness captures, manual case and changelog

**Files:**
- Create: `tests/harness/draftingWorkspace.ts`
- Modify: `tests/harness/referenceWorkspace.ts`
- Modify: `scripts/harness-shot.mjs` (`SHOTS`)
- Modify: `tests/build/harness-shot.test.ts` (the sorted name list and a knob pin)
- Create: `docs/tests/cases/Draw drafting marks.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: every earlier task; the `?drafting` URL knob is new here.
- Produces: `seedDraftingPlan(stack: ReturnType<typeof createRepositoryStack>, geometry: ObsidianPlanGeometrySidecar, planId: PlanId): Promise<void>`; shots `plan-editor-drafting`, `plan-editor-drafting-dark`, `plan-editor-drafting-narrow`.

- [ ] **Step 1: Write the failing pin**

In `tests/build/harness-shot.test.ts`, in the sorted shot-name list, insert after `'plan-editor-detail-narrow-de',`:

```ts
			'plan-editor-drafting',
			'plan-editor-drafting-dark',
			'plan-editor-drafting-narrow',
```

and directly after the `takes the structural shots through the ?structural knob` test add:

```ts
	it('takes the drafting shots through the ?drafting knob, one of them at a sidebar width', () => {
		for (const name of ['plan-editor-drafting', 'plan-editor-drafting-dark', 'plan-editor-drafting-narrow']) expect(planEditorQuery(name).has('drafting')).toBe(true);
		expect(planEditorQuery('plan-editor-drafting-dark').has('theme')).toBe(false);
		expect(shot('plan-editor-drafting-narrow').width).toBe(460);
	});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run check:fast -- tests/build/harness-shot.test.ts`
Expected: FAIL. The three names are not in `SHOTS`.

- [ ] **Step 3: Add the shots to `scripts/harness-shot.mjs`**

Directly after the `plan-editor-structural-narrow` entry add:

```js
	// Drafting marks around a walled floor: a dimension chain along its north wall, a section line across it, a view
	// marker, a hatched area to the south, a text, a boundary line and a grid point, from the `?drafting` knob.
	{ name: 'plan-editor-drafting', query: '?view=plan-editor&reference&planning&drafting&theme=light', selector: FLOOR_STATE },
	{ name: 'plan-editor-drafting-dark', query: '?view=plan-editor&reference&planning&drafting', selector: FLOOR_STATE },
	{ name: 'plan-editor-drafting-narrow', query: '?view=plan-editor&reference&planning&drafting&theme=light', selector: PLAN_CANVAS, width: 460 },
```

- [ ] **Step 4: Create `tests/harness/draftingWorkspace.ts`**

```ts
import type { createRepositoryStack } from '../helpers/vault';
import { expectDefined, expectOk } from '../helpers/domain';
import { withPlanSpatialElements } from '../../src/domain/plan/Plan';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { SpatialElement } from '../../src/domain/spatial/SpatialElement';
import type { ObsidianPlanGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

const wall = (id: string, start: { x: number; y: number }, end: { x: number; y: number }) => ({ id, start, end, height: 2500, thickness: 240 });
const WALLS = [
	wall('wall-harness-north', { x: 0, y: 0 }, { x: 6270, y: 0 }), wall('wall-harness-east', { x: 6270, y: 0 }, { x: 6270, y: 9520 }),
	wall('wall-harness-south', { x: 6270, y: 9520 }, { x: 0, y: 9520 }), wall('wall-harness-west', { x: 0, y: 9520 }, { x: 0, y: 0 }),
];
const MARKS: readonly (SpatialElement & { readonly name: string })[] = [
	{ id: 'element-harness-dimension', kind: 'dimension', name: 'North wall', offset: -900, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 1940, y: 0 }, { x: 4560, y: 0 }, { x: 5310, y: 0 }, { x: 6270, y: 0 }] },
	{ id: 'element-harness-section', kind: 'section', name: 'S-01', flipped: false, points: [{ x: -1500, y: 4700 }, { x: 7800, y: 4700 }] },
	{ id: 'element-harness-view', kind: 'view', name: 'A-01', points: [{ x: 3135, y: -2600 }, { x: 3135, y: -1800 }] },
	{ id: 'element-harness-hatch', kind: 'hatch', name: 'Existing', points: [{ x: 0, y: 9760 }, { x: 6270, y: 9760 }, { x: 6270, y: 12000 }, { x: 0, y: 12000 }] },
	{ id: 'element-harness-text', kind: 'text', name: 'Zwischenbau', points: [{ x: 3135, y: 3000 }] },
	{ id: 'element-harness-boundary', kind: 'boundary', name: 'Plot line', points: [{ x: -3000, y: -3500 }, { x: -2200, y: 13000 }] },
	{ id: 'element-harness-grid', kind: 'grid', name: '1', points: [{ x: 8800, y: -1200 }] },
];

/** The `?drafting` knob's plan: one drafting mark of each kind around a walled floor, written through the real sidecar and plan note. */
export async function seedDraftingPlan(stack: ReturnType<typeof createRepositoryStack>, geometry: ObsidianPlanGeometrySidecar, planId: PlanId): Promise<void> {
	const baseline = expectOk(await geometry.read(planId));
	const elements = MARKS.map(({ name: _name, ...element }) => element);
	expectOk(await geometry.write(planId, { ...baseline.document, structure: { walls: WALLS, openings: [], boundaries: [], elements } }, baseline.version));
	const loaded = expectDefined(expectOk(await stack.plans.getById(planId)), 'harness drafting plan');
	expectOk(await stack.plans.save(expectOk(withPlanSpatialElements(loaded.entity, MARKS.map(item => ({ id: item.id, name: item.name })))), loaded.version));
}
```

If `_name` trips `@typescript-eslint/no-unused-vars`, keep geometry and names in two parallel arrays instead (`MARKS` without `name`, and `NAMES` as a `readonly string[]` in the same order), as `referenceWorkspace.ts`'s structural block already does.

- [ ] **Step 5: Seed it from `tests/harness/referenceWorkspace.ts`**

Add `import { seedDraftingPlan } from './draftingWorkspace';` and, directly after the closing `}` of the `if (new URLSearchParams(location.search).has('structural')) { … }` block, add:

```ts
		if (new URLSearchParams(location.search).has('drafting')) await seedDraftingPlan(stack, geometry, plan.id);
```

- [ ] **Step 6: Run the pin and capture**

Run: `npm run check:fast -- tests/build/harness-shot.test.ts tests/harness`
Expected: PASS.

Run: `npm run harness-shot`
Expected: `harness-shots/plan-editor-drafting.png`, `-dark.png` and `-narrow.png` written. Open them and check each against the spec §6 table: chain ticks and upright lengths along the north wall, both section triangles below the line, the hatch under the south wall, the text centred, the grid circle with `1` inside, and no name tag beside the chain, hatch or boundary line. If the pinned Chromium is absent and `npx playwright install chromium` is not possible, set `RP_CHROMIUM_EXECUTABLE` and say in the PR that the captures are approximate.

- [ ] **Step 7: Write `docs/tests/cases/Draw drafting marks.md`**

```markdown
---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 98
sources:
  - Plan drafting tools design spec §5 (tools), §6 (rendering), §7 (submenu and editing)
status: Ready
---

# Draw drafting marks

The plan drafting tools increment: right-click › Drafting starts a dimension chain, section line, view marker,
hatched area, text, boundary line or grid point at the clicked spot. `docs/superpowers/specs/2026-09-13-plan-drafting-tools-design.md`
is the design and `docs/superpowers/plans/2026-09-13-plan-drafting-tools.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a floor with a room and
its walls drawn. **Create sample renovation project** seeds one.

## Why a human is the only instrument for three of these

Every write, refusal and menu entry below is driven in `tests/presentation/editor/draftingCreation.test.ts`,
`draftingTaskForm.test.ts`, `draftingInspector.test.ts` and `draftingMenu.test.ts`; the layout in
`draftingMarks.test.ts`. Outside all of it:

1. **Whether the marks read as an architect's plan on a themed vault.** jsdom draws nothing; the harness captures
   use Obsidian's default colours only.
2. **Whether the seven `rp-` icons render in the host's context menu.** They are registered artwork.
3. **Whether a chain's points land on a room's corners and a window's jambs under a real hand.**

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Right-click the empty canvas. Open Drafting. | Seven items with icons: Dimension chain, Section line, View marker, Hatched area, Text, Boundary line, Grid point. |
| 2 | Choose Dimension chain on a room's top-left corner. Click the next corners along the wall. Finish. Move the pointer above the wall and click. | Ticks on every point, a length over every segment, the line where you clicked. |
| 3 | Right-click across the floor, Drafting › Section line, click the other side. | A dash-dot line with filled triangles at both ends and `S-01` beside each. |
| 4 | Select the section. Choose Flip direction. Undo. | The triangles move to the other side of the line, then back. |
| 5 | Drafting › Text inside a room. Type `Wintergarten`. Finish. | The words centred where you clicked; the text field had the keyboard as soon as you clicked. |
| 6 | Drafting › Hatched area. Click four corners outside the floor. Finish. | A cross-hatched area, drawn under any wall it touches. |
| 7 | Drafting › Grid point twice more. | Circles numbered `1`, `2`, `3`; the tool stays on until Escape. |
| 8 | Select the dimension chain. Edit, set Offset to `-1`, apply. | The line moves one metre from the wall; the lengths do not change. |
| 9 | Reopen the plan's geometry sidecar in a text editor. | `"schemaVersion": 12`; the chain carries `"offset"`, the section `"flipped"`. |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row is an expectation derived from the spec and the suite. |

## Outcome

Written after the first walk.
```

- [ ] **Step 8: Link it from the smoke suite**

In `docs/tests/suites/Smoke Test the Editor.md`:
- Replace `[[Alignment guides while dragging]] and [[Draw posts and beams]] are outside that census too:` with `[[Alignment guides while dragging]], [[Draw posts and beams]] and [[Draw drafting marks]] are outside that census too:`.
- After the `[[Draw posts and beams]]` bullet (it ends `head of this file).`) add:

```markdown
- [[Draw drafting marks]] — the plan drafting tools increment: dimension chains, section and view
  markers, hatched areas, text, boundary lines and grid points from right-click › Drafting. What
  only a vault shows is whether the marks read as a plan on a themed vault, whether the host
  renders the seven registered `rp-` icons, and whether a chain's points land on a room's corners
  under a real hand. Its steps carry no `Reachable by` verdicts yet (see the head of this file).
```

- [ ] **Step 9: Add the changelog entry**

In `CHANGELOG.md`, under `## [Unreleased]` › `### Added`, insert as the first bullet:

```markdown
- Plan editor: draw an architect's drafting marks from right-click › Drafting — dimension chains with a length over every segment, section lines with a flippable look side, view markers, cross-hatched areas, text, boundary lines and numbered grid points. Each starts at the clicked spot, snaps like every other drawing tool, and is edited, moved, grouped and undone like any element; drafting marks carry no renovation records or quantities. Plan geometry holding a drafting mark is saved as schema 12, which older builds refuse.
```

- [ ] **Step 10: Run the docs and release checks**

Run: `npm run check:fast -- tests/build/harness-shot.test.ts tests/release`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add tests/harness/draftingWorkspace.ts tests/harness/referenceWorkspace.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts "docs/tests/cases/Draw drafting marks.md" "docs/tests/suites/Smoke Test the Editor.md" CHANGELOG.md
git commit -m "Capture drafting marks in the harness and write their manual case

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## After the last task

Push the branch and open a pull request; `npm run check` runs there on all four CI legs. Treat a red leg as the report to act on. The manual case stays recorded as not run until someone walks it in a vault.
