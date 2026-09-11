# Plan Editor Copy and Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ctrl/Cmd+C copies the Plan Editor selection (Rooms/Areas, walls with their openings, elements, whole groups) into a clipboard shared by every floor; Ctrl/Cmd+V or the context menu pastes it onto the current floor as one undo step.

**Architecture:** A pure domain module captures a selection into a `SpatialClipboard` (positions relative to its centre) and places it (translate, re-mint ids, rewire references). An application `PasteCommand` composes the existing `ReversibleCreateZoneCommand` (one per room), `RenovationCommand` (walls, openings, boundaries, elements, element names) and `GroupGeometryCommand` (groups), undoing completed steps newest-first on failure. The plugin owns one Vue `shallowRef` clipboard handed to every leaf through `PlanEditorDeps`; a provide/inject composable in `PlanEditorRoot` wires the shortcut and the context menu.

**Tech Stack:** TypeScript, Vue 3 + Pinia, Vitest (node + jsdom), Obsidian plugin API.

**Spec:** `docs/superpowers/specs/2026-09-10-editor-copy-paste-design.md`

## Global Constraints

- Definition of done is `npm run check` (build + lint + coverage floors 99/99/99/98 + fallow). Between edits use `npm run check:fast -- <paths>`. Never run two gates at once.
- Layers: `domain/` imports only `core/` and `domain/`; `application/` imports no `presentation/`; `vue`, `pinia`, `konva`, `obsidian` are banned in `core/`, `domain/`, `application/`.
- Budgets (ESLint): `max-lines` 400 code lines per `src/` file and 450 per test file, `max-lines-per-function` 100, `complexity` 16, `max-params` 5, `max-depth` 4.
- `src/presentation/editor/runtime.ts` is AT its 400-line budget: add no line to it. Clipboard wiring is provided from `PlanEditorRoot.vue` instead.
- No UI literal: every label goes through `tr()` with a key present in BOTH `src/presentation/i18n/locales/en/input.ts` and `.../de/input.ts` (German uses formal address, sentence case in both).
- Icons: the context-menu tests fail on any icon the harness has no fixture for. Fixtures come only from Lucide revision `2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`. Downloading them needs the user's explicit permission.
- Coverage is `v8`: the right operand of every `??`, `&&`, `||`, both arms of every ternary and every `if` block must RUN in some test, suite-wide. After changing a file, read `coverage/coverage-final.json` for the CHANGED files: an untested arm is either tested or its guard removed. Optional fields are passed through (`bulges: room.bulges`), never spread conditionally.
- Write files with the editor tools, never PowerShell `Set-Content`/`Out-File` (BOM).
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Capture and place a clipboard (domain)

**Files:**
- Create: `src/domain/spatial/clipboard.ts`
- Test: `tests/domain/spatial/clipboard.test.ts`

**Interfaces:**
- Consumes: `groupPoints`, `groupPivot` (`src/domain/spatial/groupGeometry.ts`); types `Structure`, `SpatialElement`, `SpatialElementMetadata`, `SpatialGroup`, `Point`.
- Produces:
  - `interface ClipboardRoom { key: string; name: string; zoneType: string; points: readonly Point[]; bulges?: readonly number[] }`
  - `interface ClipboardStructure extends Structure { elements: readonly SpatialElement[] }`
  - `interface SpatialClipboard { rooms: readonly ClipboardRoom[]; structure: ClipboardStructure; names: readonly SpatialElementMetadata[]; groups: readonly SpatialGroup[] }`
  - `type ClipboardFloor = Omit<SpatialClipboard, 'structure'> & { readonly structure: Structure }`
  - `type ClipboardIdPrefix = 'wall' | 'opening' | 'element' | 'group'`
  - `interface PlacedStructure { structure: ClipboardStructure; names: readonly SpatialElementMetadata[]; groups: readonly SpatialGroup[] }`
  - `captureClipboard(floor: ClipboardFloor, selectedIds: readonly string[]): SpatialClipboard | null`
  - `placedRooms(clipboard: SpatialClipboard, target: Point): readonly ClipboardRoom[]`
  - `placedStructure(clipboard: SpatialClipboard, target: Point, roomIds: readonly string[], mintId: (prefix: ClipboardIdPrefix) => string): PlacedStructure`

- [ ] **Step 1: Write the failing test**

`tests/domain/spatial/clipboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { captureClipboard, placedRooms, placedStructure, type ClipboardFloor, type SpatialClipboard } from '../../../src/domain/spatial/clipboard';
import type { Wall } from '../../../src/domain/spatial/Structure';

const wall = (id: string, start: readonly [number, number], end: readonly [number, number], bulge?: number): Wall =>
	({ id, start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] }, height: 2400, thickness: 150, ...(bulge === undefined ? {} : { bulge }) });

const FLOOR: ClipboardFloor = {
	rooms: [
		{ key: 'zone-kitchen', name: 'Kitchen', zoneType: 'Room', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] },
		{ key: 'zone-garden', name: 'Garden', zoneType: 'Garden', points: [{ x: 6000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 2000 }], bulges: [0.3, 0, 0] },
	],
	structure: {
		walls: [wall('wall-a', [0, 0], [4000, 0]), wall('wall-b', [4000, 0], [4000, 3000]), wall('wall-c', [4000, 3000], [0, 3000]), wall('wall-d', [0, 3000], [0, 0]), wall('wall-lone', [6000, 4000], [8000, 4000], 0.25)],
		openings: [
			{ id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 },
			{ id: 'opening-window', kind: 'window', hostId: 'wall-a', offset: 2000, width: 1000, height: 1200, sill: 900 },
		],
		boundaries: [{ roomId: 'zone-kitchen', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }],
		elements: [
			{ id: 'element-stair', kind: 'stair', points: [{ x: 1000, y: 1000 }, { x: 1000, y: 2000 }], stair: { width: 900, treads: 12, direction: 'up' } },
			{ id: 'element-path', kind: 'path', points: [{ x: 6000, y: 5000 }, { x: 7000, y: 5000 }] },
		],
	},
	names: [{ id: 'element-stair', name: 'Stair' }, { id: 'element-path', name: 'Path' }],
	groups: [{ id: 'group-kitchen', name: 'Kitchen set', memberIds: ['zone-kitchen', 'wall-a'] }, { id: 'group-yard', name: 'Yard', memberIds: ['zone-garden', 'element-path'] }],
};

describe('capture', () => {
	it('brings a Room\'s boundary walls and every opening they host, centred on the copy\'s middle', () => {
		const copied = captureClipboard(FLOOR, ['zone-kitchen']);
		expect(copied?.rooms).toEqual([{ key: 'zone-kitchen', name: 'Kitchen', zoneType: 'Room', points: [{ x: -2000, y: -1500 }, { x: 2000, y: -1500 }, { x: 2000, y: 1500 }, { x: -2000, y: 1500 }] }]);
		expect(copied?.structure.walls.map(item => item.id)).toEqual(['wall-a', 'wall-b', 'wall-c', 'wall-d']);
		expect(copied?.structure.walls[0]).toMatchObject({ start: { x: -2000, y: -1500 }, end: { x: 2000, y: -1500 } });
		expect(copied?.structure.openings.map(item => item.id)).toEqual(['opening-door', 'opening-window']);
		expect(copied?.structure.boundaries).toEqual(FLOOR.structure.boundaries);
		expect(copied?.structure.elements).toEqual([]);
		expect(copied?.groups.map(group => group.id)).toEqual(['group-kitchen']);
	});

	it('brings an opening\'s host wall and that wall\'s other openings', () => {
		const copied = captureClipboard(FLOOR, ['opening-window']);
		expect(copied?.rooms).toEqual([]);
		expect(copied?.structure.walls).toEqual([wall('wall-a', [-2000, 0], [2000, 0])]);
		expect(copied?.structure.openings.map(item => item.id)).toEqual(['opening-door', 'opening-window']);
		expect(copied?.structure.boundaries).toEqual([]);
		expect(copied?.groups).toEqual([]);
	});

	it('keeps element names and stair options, and a group only when every member is copied', () => {
		const copied = captureClipboard(FLOOR, ['element-stair', 'zone-garden', 'element-path', 'wall-lone']);
		expect(copied?.structure.elements.map(item => [item.id, item.stair])).toEqual([['element-stair', { width: 900, treads: 12, direction: 'up' }], ['element-path', undefined]]);
		expect(copied?.names).toEqual(FLOOR.names);
		expect(copied?.groups.map(group => group.id)).toEqual(['group-yard']);
		expect(captureClipboard(FLOOR, ['zone-garden'])?.groups).toEqual([]);
	});

	it('answers null for nothing copyable, and copies walls from a floor that has no elements', () => {
		expect(captureClipboard(FLOOR, [])).toBeNull();
		expect(captureClipboard(FLOOR, ['zone-gone', 'group-kitchen'])).toBeNull();
		const bare = captureClipboard({ ...FLOOR, structure: { ...FLOOR.structure, elements: undefined } }, ['wall-lone']);
		expect(bare?.structure.elements).toEqual([]);
	});
});

describe('placement', () => {
	const copied = captureClipboard(FLOOR, ['zone-kitchen', 'element-stair']) as SpatialClipboard;
	let minted = 0;
	const mint = (prefix: string): string => `${prefix}-new-${++minted}`;

	it('centres the Rooms on the target', () => {
		expect(placedRooms(copied, { x: 10000, y: 10000 }).map(room => room.points)).toEqual([[{ x: 8000, y: 8500 }, { x: 12000, y: 8500 }, { x: 12000, y: 11500 }, { x: 8000, y: 11500 }]]);
	});

	it('re-mints every id and rewires every reference to the new ones', () => {
		const placed = placedStructure(copied, { x: 10000, y: 10000 }, ['zone-new'], mint);
		const { walls, openings, boundaries, elements } = placed.structure;
		expect(walls.every(item => item.id.startsWith('wall-new-'))).toBe(true);
		expect(walls[0]).toMatchObject({ start: { x: 8000, y: 8500 }, end: { x: 12000, y: 8500 } });
		expect(openings.map(item => item.hostId)).toEqual([walls[0].id, walls[0].id]);
		expect(openings.every(item => item.id.startsWith('opening-new-'))).toBe(true);
		expect(boundaries).toEqual([{ roomId: 'zone-new', wallIds: walls.map(item => item.id) }]);
		expect(elements).toEqual([{ id: expect.stringMatching(/^element-new-/), kind: 'stair', points: [{ x: 9000, y: 9500 }, { x: 9000, y: 10500 }], stair: { width: 900, treads: 12, direction: 'up' } }]);
		expect(placed.names).toEqual([{ id: elements[0].id, name: 'Stair' }]);
		expect(placed.groups).toEqual([{ id: expect.stringMatching(/^group-new-/), name: 'Kitchen set', memberIds: ['zone-new', walls[0].id] }]);
		expect(JSON.stringify(placed)).not.toMatch(/"(zone-kitchen|wall-[a-d]|opening-(door|window)|element-stair|group-kitchen)"/);
	});

	it('moves curved rooms and bulged walls without reshaping them', () => {
		const curved = captureClipboard(FLOOR, ['zone-garden', 'wall-lone']) as SpatialClipboard;
		const [atOrigin] = placedRooms(curved, { x: 0, y: 0 }), [shifted] = placedRooms(curved, { x: 100, y: -50 });
		expect(shifted.points).toEqual(atOrigin.points.map(point => ({ x: point.x + 100, y: point.y - 50 })));
		expect(shifted.bulges).toEqual([0.3, 0, 0]);
		expect(placedStructure(curved, { x: 0, y: 0 }, ['zone-new'], mint).structure.walls[0].bulge).toBe(0.25);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run check:fast -- tests/domain/spatial/clipboard.test.ts`
Expected: FAIL — `Cannot find module '../../../src/domain/spatial/clipboard'` (and a matching `vue-tsc` error).

- [ ] **Step 3: Write minimal implementation**

`src/domain/spatial/clipboard.ts`:

```ts
import type { Point } from '../../core/geometry/Point';
import type { Structure } from './Structure';
import type { SpatialElement, SpatialElementMetadata } from './SpatialElement';
import type { SpatialGroup } from './SpatialGroup';
import { groupPivot, groupPoints } from './groupGeometry';

/** One Room or Area as copied: its outline and what names it, never anything linked to it. */
export interface ClipboardRoom {
	readonly key: string;
	readonly name: string;
	readonly zoneType: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
}
export interface ClipboardStructure extends Structure { readonly elements: readonly SpatialElement[] }

/**
 * A copied selection, positioned relative to its own bounding-box centre. Room `key`s and every
 * id inside `structure`, `names` and `groups` are the SOURCE floor's, kept only so references
 * inside the clipboard stay wired; `placedStructure` re-mints every one of them.
 */
export interface SpatialClipboard {
	readonly rooms: readonly ClipboardRoom[];
	readonly structure: ClipboardStructure;
	readonly names: readonly SpatialElementMetadata[];
	readonly groups: readonly SpatialGroup[];
}
/** A whole floor in the clipboard's own shape, which is what a copy is taken from. */
export type ClipboardFloor = Omit<SpatialClipboard, 'structure'> & { readonly structure: Structure };
export type ClipboardIdPrefix = 'wall' | 'opening' | 'element' | 'group';
export interface PlacedStructure {
	readonly structure: ClipboardStructure;
	readonly names: readonly SpatialElementMetadata[];
	readonly groups: readonly SpatialGroup[];
}

const moved = (point: Point, by: Point): Point => ({ x: point.x + by.x, y: point.y + by.y });
function translated(clipboard: SpatialClipboard, by: Point): SpatialClipboard {
	const { structure } = clipboard;
	return {
		...clipboard,
		rooms: clipboard.rooms.map(room => ({ ...room, points: room.points.map(point => moved(point, by)) })),
		structure: {
			...structure,
			walls: structure.walls.map(item => ({ ...item, start: moved(item.start, by), end: moved(item.end, by) })),
			elements: structure.elements.map(item => ({ ...item, points: item.points.map(point => moved(point, by)) })),
		},
	};
}

/**
 * The selection and what it cannot exist without, as the grouping rules already say: a Room
 * brings its boundary walls, an opening brings its host wall, and a wall brings every opening
 * it hosts. A group comes only when every member does. Nothing copyable answers `null`.
 */
export function captureClipboard(floor: ClipboardFloor, selectedIds: readonly string[]): SpatialClipboard | null {
	const selected = new Set(selectedIds), { structure } = floor;
	const rooms = floor.rooms.filter(room => selected.has(room.key)), roomKeys = new Set(rooms.map(room => room.key));
	const boundaries = structure.boundaries.filter(boundary => roomKeys.has(boundary.roomId));
	const hosts = structure.openings.filter(opening => selected.has(opening.id)).map(opening => opening.hostId);
	const wallIds = new Set([...selectedIds, ...boundaries.flatMap(boundary => boundary.wallIds), ...hosts]);
	const walls = structure.walls.filter(item => wallIds.has(item.id));
	const elements = structure.elements?.filter(item => selected.has(item.id)) ?? [];
	const members = new Set([...roomKeys, ...walls.map(item => item.id), ...elements.map(item => item.id)]);
	const copied: SpatialClipboard = {
		rooms,
		structure: { walls, openings: structure.openings.filter(opening => members.has(opening.hostId)), boundaries, elements },
		names: floor.names.filter(name => members.has(name.id)),
		groups: floor.groups.filter(group => group.memberIds.every(id => members.has(id))),
	};
	const objects = rooms.map(room => ({ id: room.key, points: room.points, bulges: room.bulges }));
	const pivot = groupPivot(groupPoints({ objects, structure: copied.structure }, [...members]));
	return pivot ? translated(copied, { x: -pivot.x, y: -pivot.y }) : null;
}

/** The Rooms and Areas of a paste, in clipboard order, centred on `target`. */
export function placedRooms(clipboard: SpatialClipboard, target: Point): readonly ClipboardRoom[] {
	return translated(clipboard, target).rooms;
}

/**
 * Everything but the Rooms, centred on `target`, under fresh ids with every reference rewired.
 * `roomIds[i]` is the zone the i-th clipboard room became — those ids are minted by the zone
 * writes, not here.
 */
export function placedStructure(clipboard: SpatialClipboard, target: Point, roomIds: readonly string[], mintId: (prefix: ClipboardIdPrefix) => string): PlacedStructure {
	const { structure } = translated(clipboard, target);
	const ids = new Map(clipboard.rooms.map((room, index) => [room.key, roomIds[index]]));
	const mint = (source: string, prefix: ClipboardIdPrefix): string => { const next = mintId(prefix); ids.set(source, next); return next; };
	const walls = structure.walls.map(item => ({ ...item, id: mint(item.id, 'wall') }));
	const elements = structure.elements.map(item => ({ ...item, id: mint(item.id, 'element') }));
	// Every reference inside a captured clipboard names something the clipboard holds.
	const id = (source: string): string => ids.get(source) as string;
	return {
		structure: {
			walls,
			openings: structure.openings.map(opening => ({ ...opening, id: mintId('opening'), hostId: id(opening.hostId) })),
			boundaries: structure.boundaries.map(boundary => ({ roomId: id(boundary.roomId), wallIds: boundary.wallIds.map(id) })),
			elements,
		},
		names: clipboard.names.map(name => ({ id: id(name.id), name: name.name })),
		groups: clipboard.groups.map(group => ({ ...group, id: mintId('group'), memberIds: group.memberIds.map(id) })),
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check:fast -- tests/domain/spatial/clipboard.test.ts`
Expected: PASS (7 tests). If the opening case reports a different pivot, print `groupPoints` for `wall-a` alone — a straight wall's extrema are its two endpoints; fix the implementation, not the expectation.

- [ ] **Step 5: Commit**

```bash
git add src/domain/spatial/clipboard.ts tests/domain/spatial/clipboard.test.ts
git commit -m "feat(domain): capture and place a spatial clipboard

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `PasteCommand` — one undo step over existing commands

**Files:**
- Create: `src/application/commands/spatial/PasteCommand.ts`
- Test: `tests/application/commands/pasteCommand.test.ts`

**Interfaces:**
- Consumes (Task 1): `SpatialClipboard`, `PlacedStructure`, `ClipboardIdPrefix`, `placedRooms`, `placedStructure`, `captureClipboard`.
- Consumes (existing): `RenovationServices`, `RenovationBaseline`, `RenovationInput` (`application/commands/renovation/RenovationCommand.ts`); `GroupGeometryServices` (`application/commands/spatial/GroupGeometryCommand.ts`); `CreateZoneInput` (`application/commands/zone/CreateZone.ts`); `WriteLedger`; `DispatchResult`, `markUncompensated`.
- Produces:
  - `interface PasteDeps { createRoom(input: CreateZoneInput): PasteStep & { readonly createdZoneId: ZoneId | null }; renovation: RenovationServices; groups: GroupGeometryServices; ledger: WriteLedger; mintId(prefix: ClipboardIdPrefix): string }`
  - `interface PasteInput { planId: PlanId; clipboard: SpatialClipboard; target: Point }`
  - `class PasteCommand { constructor(deps: PasteDeps, input: PasteInput); execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult>; get pastedIds(): readonly string[] }` — `pastedIds` is `[...roomIds, ...wallIds, ...openingIds, ...elementIds]` once `execute` has succeeded.

- [ ] **Step 1: Write the failing test**

`tests/application/commands/pasteCommand.test.ts`:

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { renovationStack } from '../../helpers/renovation';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { expectDefined, expectErr, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { renovationServices } from '../../../src/application/commands/renovation/RenovationCommand';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { PasteCommand, type PasteDeps } from '../../../src/application/commands/spatial/PasteCommand';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { ReversibleCreateZoneCommand } from '../../../src/application/commands/zone/reversible-create-zone-command';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import type { PlanGeometryDocument } from '../../../src/application/ports/PlanGeometrySidecar';
import type { EntityVersion } from '../../../src/application/ports/versioning';
import type { Point } from '../../../src/core/geometry/Point';
import { createEntityId } from '../../../src/core/identity/generateId';
import { err } from '../../../src/core/result/Result';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import { captureClipboard, type ClipboardFloor } from '../../../src/domain/spatial/clipboard';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';

afterEach(() => vi.restoreAllMocks());

const SOURCE: ClipboardFloor = {
	rooms: [{ key: 'zone-source', name: 'Kitchen', zoneType: 'Room', points: WALL_LOOP.walls.map(item => item.start) }],
	structure: {
		...WALL_LOOP,
		openings: [{ id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end', side: 'right', angle: 65 } }],
		boundaries: [{ roomId: 'zone-source', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }],
		elements: [{ id: 'element-arrow', kind: 'arrow', points: [{ x: 1000, y: 1000 }, { x: 2000, y: 1000 }] }],
	},
	names: [{ id: 'element-arrow', name: 'Entry' }],
	groups: [{ id: 'group-source', name: 'Kitchen set', memberIds: ['zone-source', 'wall-a'] }],
};
const CLIP = expectDefined(captureClipboard(SOURCE, ['zone-source', 'element-arrow']), 'clipboard');

/** A paste wired over a real stack — `renovationStack`'s floor (a Room, its walls) or `structureStack`'s empty one. */
function wire<T extends Awaited<ReturnType<typeof structureStack>>>(base: T) {
	const { stack, plan, geometry, ledger } = base;
	const create = new CreateZoneCommand(stack.zones, stack.plans, stack.events), remove = makeDeleteZoneCommand(stack.zones, stack.events, stack.requirements);
	const deps: PasteDeps = {
		createRoom: input => new ReversibleCreateZoneCommand(create, remove, ledger, input, { zones: stack.zones, requirements: stack.requirements, events: stack.events, logger: stack.logger }),
		renovation: renovationServices(stack.plans, geometry, stack.events), groups: groupGeometryServices(geometry, stack.zones, stack.events), ledger, mintId: prefix => createEntityId(prefix),
	};
	const paste = (target: Point = { x: 10000, y: 0 }) => new PasteCommand(deps, { planId: plan.id, clipboard: CLIP, target });
	async function floor() {
		const { document } = expectOk(await geometry.read(plan.id)), entity = expectFound(await stack.plans.getById(plan.id)).entity;
		return { structure: document.structure ?? EMPTY_STRUCTURE, groups: document.groups ?? [], names: entity.spatialElements ?? [], plan: entity,
			zones: expectOk(await stack.zones.listByPlan(plan.id)).loaded.map(zone => zone.entity) };
	}
	return { ...base, deps, paste, floor };
}
const rig = async () => wire(await renovationStack());
type Rig = Awaited<ReturnType<typeof rig>>;

/** Fails the sidecar writes, counted from now, that `failing` picks; the rest reach the real store. */
function failWrites(r: Rig, failing: (call: number) => boolean) {
	const write = r.geometry.write.bind(r.geometry);
	let calls = 0;
	vi.spyOn(r.geometry, 'write').mockImplementation((planId: PlanId, document: PlanGeometryDocument, expected?: EntityVersion) =>
		failing(++calls) ? Promise.resolve(err(injectedPersistenceError())) : write(planId, document, expected));
}

it('writes the rooms, walls, openings, elements, names and groups of a paste as one step under new ids', async () => {
	const r = await rig(), before = await r.floor(), command = r.paste();
	expectOk(await command.execute());
	const after = await r.floor();
	const room = expectDefined(after.zones.find(zone => zone.id === command.pastedIds[0]), 'pasted room');
	expect(room).toMatchObject({ name: 'Kitchen', zoneType: 'Room' });
	expect(room.geometry.points).toEqual([{ x: 8000, y: -1500 }, { x: 12000, y: -1500 }, { x: 12000, y: 1500 }, { x: 8000, y: 1500 }]);
	const walls = after.structure.walls.slice(before.structure.walls.length), openings = after.structure.openings.slice(before.structure.openings.length);
	const elements = after.structure.elements ?? [];
	expect(walls.map(item => item.start)).toEqual([{ x: 8000, y: -1500 }, { x: 12000, y: -1500 }, { x: 12000, y: 1500 }, { x: 8000, y: 1500 }]);
	expect(openings).toEqual([{ ...SOURCE.structure.openings[0], id: expect.stringMatching(/^opening-/), hostId: walls[0].id }]);
	expect(after.structure.boundaries.at(-1)).toEqual({ roomId: room.id, wallIds: walls.map(item => item.id) });
	expect(after.names).toEqual([{ id: elements[0].id, name: 'Entry' }]);
	expect(after.groups).toEqual([{ id: expect.stringMatching(/^group-/), name: 'Kitchen set', memberIds: [room.id, walls[0].id] }]);
	expect(command.pastedIds).toEqual([room.id, ...walls.map(item => item.id), openings[0].id, elements[0].id]);
	expect(JSON.stringify(after)).not.toMatch(/"(zone-source|opening-door|element-arrow|group-source)"/);
});

it('undoes the whole paste in one step and redoes it under the same ids', async () => {
	const r = await rig(), before = await r.floor(), command = r.paste();
	expectOk(await command.execute());
	const pasted = await r.floor();
	expectOk(await command.undo());
	const undone = await r.floor();
	expect(undone.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(undone.structure).toEqual(before.structure);
	expect(undone.groups).toEqual(before.groups);
	expect(undone.names).toEqual(before.names);
	expectOk(await command.execute());
	const redone = await r.floor();
	expect(redone.zones.map(zone => zone.id)).toEqual(pasted.zones.map(zone => zone.id));
	expect(redone.structure).toEqual(pasted.structure);
	expect(redone.groups).toEqual(pasted.groups);
	expect(redone.names).toEqual(pasted.names);
});

it('refuses a paste whose walls cross the floor\'s own, keeping none of the rooms it had written', async () => {
	const r = await rig(), before = await r.floor();
	expect(expectErr(await r.paste({ x: 2000, y: 1500 }).execute()).code).toBe('spatial.intersection');
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(after.structure).toEqual(before.structure);
});

it('undoes the structure and the rooms when the group write fails', async () => {
	const r = await rig(), before = await r.floor();
	failWrites(r, call => call === 2);
	const error = expectErr(await r.paste().execute());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(false);
	const after = await r.floor();
	expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
	expect(after.structure).toEqual(before.structure);
	expect(after.names).toEqual(before.names);
});

it('reports writes left behind when undoing a failed paste fails too', async () => {
	const r = await rig();
	failWrites(r, call => call >= 2);
	const error = expectErr(await r.paste().execute());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(true);
});

it('refuses the undo after an outside write and leaves the paste in place', async () => {
	const r = await rig(), command = r.paste();
	expectOk(await command.execute());
	const pasted = await r.floor();
	expectOk(await new CreateZoneCommand(r.stack.zones, r.stack.plans, r.stack.events).execute({ planId: r.plan.id, name: 'Hall', zoneType: 'Room', geometry: { points: [{ x: -5000, y: 0 }, { x: -4000, y: 0 }, { x: -4000, y: 1000 }] } }));
	expect(expectErr(await command.undo()).code).toBe('undo.superseded');
	const after = await r.floor();
	expect(after.structure).toEqual(pasted.structure);
	expect(after.groups).toEqual(pasted.groups);
});

it('re-applies what an undo had already taken back when a later step refuses', async () => {
	const r = await rig(), command = r.paste();
	expectOk(await command.execute());
	const pasted = await r.floor();
	failWrites(r, call => call === 2);
	const error = expectErr(await command.undo());
	expect(error.code).toBe('test.injected-failure');
	expect(leftWritesBehind(error)).toBe(false);
	const after = await r.floor();
	expect(after.groups).toEqual(pasted.groups);
	expect(after.structure).toEqual(pasted.structure);
	expect(after.zones.map(zone => zone.id)).toEqual(pasted.zones.map(zone => zone.id));
});

it('pastes onto a floor that already holds renovation, elements and groups, keeping all of them', async () => {
	const r = await rig(), baseline = expectOk(await r.read());
	expectOk(await r.renovation.command(baseline, { renovation: r.value, intended: baseline.geometry.document.intended }, r.ledger).execute());
	expectOk(await r.paste({ x: 10000, y: 0 }).execute());
	expectOk(await r.paste({ x: 20000, y: 0 }).execute());
	const after = await r.floor();
	expect(after.plan.renovation).toEqual(r.value);
	expect(after.structure.walls).toHaveLength(12);
	expect(after.structure.elements).toHaveLength(2);
	expect(after.names).toHaveLength(2);
	expect(after.groups).toHaveLength(2);
});

it('pastes onto a floor that has no structure yet', async () => {
	const r = wire(await structureStack());
	expectOk(await r.paste().execute());
	expect((await r.floor()).structure.walls).toHaveLength(4);
});

it('undoes the rooms already written when reading the floor for a later step fails', async () => {
	for (const failing of ['renovation', 'groups'] as const) {
		const r = await rig(), before = await r.floor();
		if (failing === 'renovation') vi.spyOn(r.deps.renovation, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
		else vi.spyOn(r.deps.groups, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(expectErr(await r.paste().execute()).code).toBe('test.injected-failure');
		const after = await r.floor();
		expect(after.zones.map(zone => zone.id)).toEqual(before.zones.map(zone => zone.id));
		expect(after.structure).toEqual(before.structure);
	}
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run check:fast -- tests/application/commands/pasteCommand.test.ts`
Expected: FAIL — `Cannot find module '../../../src/application/commands/spatial/PasteCommand'`.

- [ ] **Step 3: Write minimal implementation**

`src/application/commands/spatial/PasteCommand.ts`:

```ts
import type { AppError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import { err, ok, type Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { placedRooms, placedStructure, type ClipboardIdPrefix, type PlacedStructure, type SpatialClipboard } from '../../../domain/spatial/clipboard';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { ZoneType } from '../../../domain/zone/ZoneType';
import type { WriteLedger } from '../../editor/WriteLedger';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';
import type { RenovationBaseline, RenovationInput, RenovationServices } from '../renovation/RenovationCommand';
import type { CreateZoneInput } from '../zone/CreateZone';
import type { GroupGeometryServices } from './GroupGeometryCommand';

export interface PasteStep { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> }
export interface PasteDeps {
	createRoom(input: CreateZoneInput): PasteStep & { readonly createdZoneId: ZoneId | null };
	readonly renovation: RenovationServices;
	readonly groups: GroupGeometryServices;
	readonly ledger: WriteLedger;
	mintId(prefix: ClipboardIdPrefix): string;
}
export interface PasteInput { readonly planId: PlanId; readonly clipboard: SpatialClipboard; readonly target: Point }

/** The floor's own structure and element names, with the paste's appended; renovation and planned geometry untouched. */
function spatialInput(baseline: RenovationBaseline, placed: PlacedStructure): RenovationInput {
	const current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE, added = placed.structure;
	return {
		renovation: baseline.plan.entity.renovation ?? EMPTY_RENOVATION,
		intended: baseline.geometry.document.intended,
		spatial: {
			structure: { walls: [...current.walls, ...added.walls], openings: [...current.openings, ...added.openings],
				boundaries: [...current.boundaries, ...added.boundaries], elements: [...current.elements ?? [], ...added.elements] },
			metadata: [...baseline.plan.entity.spatialElements ?? [], ...placed.names],
		},
	};
}

/**
 * A paste as ONE undo step (design spec §5), composed of the commands that already own each
 * write rather than writing any file itself: a `ReversibleCreateZoneCommand` per Room, then one
 * `RenovationCommand` for walls, openings, boundaries, elements and their names, then one
 * `GroupGeometryCommand` for groups. Each later step reads the floor AFTER the earlier ones
 * wrote, and every step keeps its own snapshot, so redo restores the same ids.
 *
 * A step that refuses puts back the steps already taken in the same call, newest first, and
 * returns the refusal; if putting one back fails too, the refusal is marked uncompensated.
 */
export class PasteCommand {
	/** Set once the first `execute` has written everything; later ones are redos of `steps`. */
	private created = false;
	private steps: readonly PasteStep[] = [];
	private ids: readonly string[] = [];
	constructor(private readonly deps: PasteDeps, private readonly input: PasteInput) {}

	get pastedIds(): readonly string[] { return this.ids; }

	execute(): Promise<DispatchResult> { return this.created ? this.walk(this.steps, true) : this.first(); }
	undo(): Promise<DispatchResult> { return this.walk([...this.steps].reverse(), false); }

	private async first(): Promise<DispatchResult> {
		const { planId, clipboard, target } = this.input, done: PasteStep[] = [], roomIds: ZoneId[] = [];
		for (const room of placedRooms(clipboard, target)) {
			const step = this.deps.createRoom({ planId, name: room.name, zoneType: room.zoneType as ZoneType, geometry: { points: room.points, bulges: room.bulges } });
			const result = await step.execute();
			if (!result.ok) return this.restore(done, false, result.error);
			done.push(step); roomIds.push(step.createdZoneId as ZoneId);
		}
		const placed = placedStructure(clipboard, target, roomIds, prefix => this.deps.mintId(prefix));
		for (const next of [() => this.structureStep(placed), () => this.groupStep(placed)]) {
			const step = await next();
			const result = step.ok ? await step.value?.execute() ?? ok('no-write' as const) : step;
			if (!result.ok) return this.restore(done, false, result.error);
			if (step.ok && step.value) done.push(step.value);
		}
		this.steps = done; this.created = true;
		this.ids = [...roomIds, ...placed.structure.walls.map(item => item.id), ...placed.structure.openings.map(item => item.id), ...placed.structure.elements.map(item => item.id)];
		return ok('wrote');
	}

	private async structureStep(placed: PlacedStructure): Promise<Result<PasteStep | null, AppError>> {
		if (!placed.structure.walls.length && !placed.structure.elements.length) return ok(null);
		const baseline = await this.deps.renovation.read(this.input.planId);
		return baseline.ok ? ok(this.deps.renovation.command(baseline.value, spatialInput(baseline.value, placed), this.deps.ledger)) : baseline;
	}

	private async groupStep(placed: PlacedStructure): Promise<Result<PasteStep | null, AppError>> {
		if (!placed.groups.length) return ok(null);
		const baseline = await this.deps.groups.read(this.input.planId);
		if (!baseline.ok) return baseline;
		const document = { ...baseline.value.document, groups: [...baseline.value.document.groups ?? [], ...placed.groups] };
		return ok(this.deps.groups.command({ planId: this.input.planId, baseline: baseline.value, document, ledger: this.deps.ledger }));
	}

	private async walk(steps: readonly PasteStep[], forward: boolean): Promise<DispatchResult> {
		const moved: PasteStep[] = [];
		for (const step of steps) {
			const result = forward ? await step.execute() : await step.undo();
			if (!result.ok) return this.restore(moved, !forward, result.error);
			moved.push(step);
		}
		return ok('wrote');
	}

	private async restore(moved: readonly PasteStep[], forward: boolean, error: AppError): Promise<DispatchResult> {
		for (const step of [...moved].reverse()) {
			const back = forward ? await step.execute() : await step.undo();
			if (!back.ok) return err(markUncompensated(error));
		}
		return err(error);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check:fast -- tests/application/commands/pasteCommand.test.ts`
Expected: PASS (10 tests).

**The one unverified assumption of the spec (§5) lives in the second and seventh cases.** If "undoes the whole paste in one step and redoes it under the same ids" or "re-applies what an undo had already taken back" fails with `undo.superseded`, the ledger generation moved across the paste's OWN sequential writes. Do not loosen the test: print `ledger.generation(planId)` and `ledger.generation(\`renovation:${planId}\`)` before and after each step in `walk`, find the step whose write is not `record`ed, and stop to report it — the fix belongs in the sub-command's ledger bookkeeping and needs a decision.

If the structure step's `step.value?.execute() ?? ok(...)` line trips `complexity` or reads poorly to the linter, split the loop body into a private `run(step)` helper; behaviour must not change.

- [ ] **Step 5: Commit**

```bash
git add src/application/commands/spatial/PasteCommand.ts tests/application/commands/pasteCommand.test.ts
git commit -m "feat(application): paste a clipboard as one undoable command

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: One clipboard for every Plan Editor leaf

**Files:**
- Create: `src/presentation/editor/clipboard/editorClipboard.ts`
- Modify: `src/presentation/editor/PlanEditorContext.ts` (interface `PlanEditorContext`)
- Modify: `src/presentation/views/PlanEditorView.ts` (interface `PlanEditorDeps`; the `context` literal in `mount`)
- Modify: `src/plugin/planEditorDeps.ts` (`planEditorDeps` signature and returned object)
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (a field; `planEditorViewDeps()`)
- Modify (fixtures the compiler will list): `tests/helpers/editor.ts`, `tests/harness/planEditor.ts`, `tests/presentation/views/planEditorView.test.ts`, `tests/presentation/views/planEditorReopen.test.ts`, `tests/harness/downstreamWorkspace.ts`, `tests/plugin/guardCategory.test.ts`, `tests/plugin/guardedGroups.test.ts`, `tests/plugin/guardWiring.test.ts`, `tests/plugin/persistence-wiring.test.ts`, `tests/plugin/planEditorWiring.test.ts`, `tests/helpers/structureEditor.ts`, `tests/helpers/renovationEditor.ts`
- Test: `tests/plugin/editorClipboard.test.ts`

**Interfaces:**
- Consumes (Task 1): `SpatialClipboard`.
- Produces:
  - `type EditorClipboard = ShallowRef<SpatialClipboard | null>`; `createEditorClipboard(): EditorClipboard`
  - `PlanEditorContext.clipboard: EditorClipboard` and `PlanEditorDeps.clipboard: EditorClipboard` (both required)
  - `planEditorDeps(root, workspace, vault, clipboard: EditorClipboard): PlanEditorDeps`
  - Test helpers: `EditorHarnessOptions.clipboard?: EditorClipboard`; `structureEditor(planning?, navigation?, clipboard?)`; `renovationEditor(planning?, navigation?, clipboard?)`

- [ ] **Step 1: Write the failing test**

`tests/plugin/editorClipboard.test.ts`:

```ts
/** @vitest-environment jsdom */
import { expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { PLAN_EDITOR_VIEW, type PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { loadedPlugin } from '../helpers/plugin';
import { FakeLeaf } from '../helpers/workspace';
import { installEditorEnvironment } from '../helpers/editor';

installEditorEnvironment();

/**
 * Design spec §3: each leaf mounts its own Vue app and Pinia, so Copy on one floor and Paste on
 * another only meet if the PLUGIN hands every leaf the same holder. A per-leaf default would
 * compile, draw and paste within a floor — and silently never cross one.
 */
it('hands every Plan Editor leaf the same clipboard', async () => {
	const { plugin } = await loadedPlugin(DEFAULT_SETTINGS);
	const factory = plugin.views.get(PLAN_EDITOR_VIEW);
	const clipboardOf = (view: unknown) => (view as { deps: PlanEditorDeps }).deps.clipboard;
	const first = factory?.(new FakeLeaf() as never), second = factory?.(new FakeLeaf() as never);
	expect(clipboardOf(first)).toBeDefined();
	expect(clipboardOf(second)).toBe(clipboardOf(first));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run check:fast -- tests/plugin/editorClipboard.test.ts`
Expected: FAIL — `vue-tsc` reports `Property 'clipboard' does not exist on type 'PlanEditorDeps'`, and the case fails on `toBeDefined`.

- [ ] **Step 3: Write minimal implementation**

`src/presentation/editor/clipboard/editorClipboard.ts`:

```ts
import { shallowRef, type ShallowRef } from 'vue';
import type { SpatialClipboard } from '../../../domain/spatial/clipboard';

/**
 * What Copy last took, shared by every Plan Editor leaf (design spec §3). Each leaf mounts its
 * own Vue app and Pinia, so this cannot be a store: the plugin makes ONE and hands it to every
 * leaf through `PlanEditorDeps`. A ref rather than a plain holder because Vue's reactivity is not
 * scoped to an app — a Copy in one leaf re-evaluates the Paste item of another leaf's menu.
 * Held in memory only, so an Obsidian reload empties it.
 */
export type EditorClipboard = ShallowRef<SpatialClipboard | null>;

export function createEditorClipboard(): EditorClipboard {
	return shallowRef(null);
}
```

In `src/presentation/editor/PlanEditorContext.ts`, add the import and the member (after `vault`):

```ts
import type { EditorClipboard } from './clipboard/editorClipboard';
```

```ts
	readonly vault: BackgroundVault;
	/** The clipboard every leaf shares — see `editorClipboard.ts`. */
	readonly clipboard: EditorClipboard;
```

In `src/presentation/views/PlanEditorView.ts`, add the import, the `PlanEditorDeps` member directly after `readonly vault: BackgroundVault;`, and the context entry directly after `vault: this.deps.vault,` in `mount`:

```ts
import type { EditorClipboard } from '../editor/clipboard/editorClipboard';
```

```ts
	/**
	 * The ONE clipboard the plugin holds for every Plan Editor leaf. Required, so a composition
	 * that forgets it does not compile rather than giving each leaf a private clipboard.
	 */
	readonly clipboard: EditorClipboard;
```

```ts
			clipboard: this.deps.clipboard,
```

In `src/plugin/planEditorDeps.ts`, add the import, the parameter and the returned member (directly after `navigation: …,`):

```ts
import type { EditorClipboard } from '../presentation/editor/clipboard/editorClipboard';
```

```ts
export function planEditorDeps(
	root: CompositionRoot,
	workspace: Workspace,
	vault: Vault,
	clipboard: EditorClipboard,
): PlanEditorDeps {
	const persistence = root.persistence;
	return {
		navigation: editorWorkspaceNavigation(workspace, root.logger),
		clipboard,
```

In `src/plugin/RenovationPlannerPlugin.ts`, add the import beside the other `presentation/` imports, a field beside `private readonly ledger = new InMemoryDiagnosticsLedger();`, and pass it in `planEditorViewDeps`:

```ts
import { createEditorClipboard } from '../presentation/editor/clipboard/editorClipboard';
```

```ts
	/** One clipboard for every Plan Editor leaf, surviving the settings-save rebind. */
	private readonly editorClipboard = createEditorClipboard();
```

```ts
	private planEditorViewDeps(): PlanEditorDeps {
		return planEditorDeps(this.root, this.app.workspace, this.app.vault, this.editorClipboard);
	}
```

Fixtures. In `tests/helpers/editor.ts` add the import, an option on `EditorHarnessOptions`, and the context entry after `vault: options.vault ?? emptyBackgroundVault(),`:

```ts
import { createEditorClipboard, type EditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
```

```ts
	/** The clipboard this leaf shares; two mounts given one holder are two floors of one plugin. */
	readonly clipboard?: EditorClipboard;
```

```ts
		clipboard: options.clipboard ?? createEditorClipboard(),
```

`tests/helpers/structureEditor.ts` — thread it through:

```ts
import type { EditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
```

```ts
export async function structureEditor(planning = false, navigation?: PlanEditorContext['navigation'], clipboard?: EditorClipboard) {
	const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN, planning);
	await workspace.ready;
	const harness = await mountPlanEditorCanvas({ navigation, clipboard, plan: HARNESS_PLAN, queries: workspace.deps.queries, commands: workspace.deps.commands, vault: workspace.deps.vault });
```

`tests/helpers/renovationEditor.ts`:

```ts
import type { EditorClipboard } from '../../src/presentation/editor/clipboard/editorClipboard';
```

```ts
export async function renovationEditor(planning = false, navigation?: PlanEditorContext['navigation'], clipboard?: EditorClipboard) {
	const rig = await structureEditor(planning, navigation, clipboard);
```

`tests/harness/planEditor.ts` (`harnessDeps`), `tests/presentation/views/planEditorView.test.ts` (`deps`) and `tests/presentation/views/planEditorReopen.test.ts` (`reopenDeps`): add `import { createEditorClipboard } from '<relative>/src/presentation/editor/clipboard/editorClipboard';` and the member `clipboard: createEditorClipboard(),` to the returned `PlanEditorDeps` literal. Every `planEditorDeps(root, workspace, vault)` call under `tests/` gains `createEditorClipboard()` as a fourth argument, with the same import.

Then run `npx vue-tsc --noEmit` and repeat the two fixture edits above for every remaining `Property 'clipboard' is missing` or `Expected 4 arguments` it reports, until it reports none.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run check:fast -- tests/plugin tests/presentation/views`
Expected: PASS, including `hands every Plan Editor leaf the same clipboard`. Watch it fail once: temporarily change `planEditorViewDeps` to pass `createEditorClipboard()` instead of `this.editorClipboard`, re-run the one file, see `toBe` fail, restore.

Then confirm the budget: `npx eslint src/plugin/RenovationPlannerPlugin.ts src/plugin/planEditorDeps.ts src/presentation/views/PlanEditorView.ts` reports no `max-lines`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/clipboard/editorClipboard.ts src/presentation/editor/PlanEditorContext.ts src/presentation/views/PlanEditorView.ts src/plugin/planEditorDeps.ts src/plugin/RenovationPlannerPlugin.ts tests
git commit -m "feat(plugin): share one editor clipboard across every Plan Editor leaf

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Copy and Paste in the editor — shortcut, context menu, copy, icons

**Files:**
- Create: `src/presentation/editor/clipboard/clipboardActions.ts`
- Modify: `src/presentation/editor/viewport/Viewport.ts` (add `stageCentreWorld`)
- Modify: `src/presentation/editor/surface/historyShortcut.ts`
- Modify: `src/presentation/editor/PlanEditorRoot.vue` (provide the actions; `onRootKeydown`)
- Modify: `src/presentation/editor/selection/useCanvasMenuActions.ts`
- Modify: `src/presentation/editor/selection/CanvasContextMenu.vue` (remember where the menu opened)
- Modify: `src/presentation/i18n/locales/en/input.ts`, `src/presentation/i18n/locales/de/input.ts`
- Modify: `tests/presentation/editor/contextMenuActions.test.ts` (Review now also offers Copy)
- Create: `tests/fixtures/editor-icons/copy.svg`, `tests/fixtures/editor-icons/clipboard-paste.svg`
- Modify: `tests/helpers/editorIconNodes.ts`, `tests/fixtures/editor-icons/README.md`
- Test: `tests/presentation/editor/clipboard.test.ts`, `tests/presentation/editor/viewport.test.ts`

**Interfaces:**
- Consumes (Task 1): `captureClipboard`, `SpatialClipboard`. (Task 2): `PasteCommand`. (Task 3): `PlanEditorContext.clipboard`, `createEditorClipboard`, `renovationEditor(planning, navigation, clipboard)`, `EditorHarnessOptions.clipboard`.
- Consumes (existing): `createZoneHistory(context, ledger, input)` (`editor/add/createZoneHistory.ts`); `EditorRuntime['dispatcher' | 'writesBlocked' | 'structureTask']`; `useRenovationSession().perspective`; `notifyOperationFailure`, `notifyFault`.
- Produces:
  - `stageCentreWorld(size: { readonly width: number; readonly height: number }, viewport: Viewport): Point`
  - `type ClipboardActions = { canCopy: ComputedRef<boolean>; canPaste: ComputedRef<boolean>; pending: ComputedRef<boolean>; copy(): boolean; paste(target?: Point): Promise<void> }`
  - `provideClipboardActions(context, runtime): ClipboardActions`; `useClipboardActions(): ClipboardActions | null`
  - `editorClipboardShortcut(event: KeyboardEvent, actions: Pick<ClipboardActions, 'copy' | 'paste' | 'canPaste'>, state: { modal: boolean }): boolean`
  - `useCanvasMenuActions(add: () => void, opened: () => Point)`
  - Locale keys `editor.input.copy`, `editor.input.paste`; menu action ids `copy` (group `object`), `paste` (group `create`).

- [ ] **Step 0: Ask before downloading the two icon fixtures**

The context-menu suite (`contextMenuActions.test.ts`, the two `data-icon-missing` loops at its end) fails for any menu icon without a harness fixture. Ask the user in chat, and wait for a yes:

> Task 4 needs two icon fixtures from Lucide at the pinned revision `2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`: `icons/copy.svg` and `icons/clipboard-paste.svg` from `raw.githubusercontent.com/lucide-icons/lucide/…` (each under 1 KB, ISC licence already vendored in `tests/fixtures/editor-icons/LICENSE`). OK to download them into `tests/fixtures/editor-icons/`?

On yes:

```bash
curl -fsSL -o tests/fixtures/editor-icons/copy.svg https://raw.githubusercontent.com/lucide-icons/lucide/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860/icons/copy.svg
```

```bash
curl -fsSL -o tests/fixtures/editor-icons/clipboard-paste.svg https://raw.githubusercontent.com/lucide-icons/lucide/2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860/icons/clipboard-paste.svg
```

Print the node entries mechanically:

```bash
node -e "for (const name of ['copy','clipboard-paste']) { const svg = require('fs').readFileSync('tests/fixtures/editor-icons/' + name + '.svg', 'utf8'); const nodes = [...svg.matchAll(/<(path|rect|circle|line|polyline|polygon|ellipse)\s([^>]*?)\/?>/g)].map(([, tag, attrs]) => ({ tag, attributes: Object.fromEntries([...attrs.matchAll(/([\w-]+)=\"([^\"]*)\"/g)].map(([, k, v]) => [k, v])) })); console.log('  ' + JSON.stringify(name) + ': ' + JSON.stringify(nodes) + ','); }"
```

Paste the two printed lines into the object in `tests/helpers/editorIconNodes.ts` (anywhere inside the literal, each on its own line, same two-space indent). Append to `tests/fixtures/editor-icons/README.md`:

```markdown
`copy.svg` and `clipboard-paste.svg` (the canvas context menu's Copy and Paste) were taken from the
same pinned revision; whether the installed host catalogue answers `clipboard-paste` is not
verified here.
```

If the user says no, stop and report: the task cannot pass `contextMenuActions.test.ts` without them.

- [ ] **Step 1: Write the failing tests**

Append to `tests/presentation/editor/viewport.test.ts` (add `stageCentreWorld` to its existing `import { … } from` the Viewport module):

```ts
it('answers the world point under the centre of a stage', () => {
	expect(stageCentreWorld({ width: 800, height: 600 }, { pan: { x: 100, y: -50 }, zoom: 2 })).toEqual({ x: 300, y: 100 });
});
```

In `tests/presentation/editor/contextMenuActions.test.ts`, in the first case, the Review assertion made AFTER `rig.selection.select([rig.room.id]); await menu(rig);` becomes:

```ts
	expect(rig.wrapper.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'))).toEqual(['fit', 'copy']);
```

and the Escape line after it targets the same `fit` item it does today. The earlier Review assertion (selection cleared) stays `['fit']`.

Create `tests/presentation/editor/clipboard.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { mountPlanEditorCanvas, settle, settleUntil } from '../../helpers/editor';
import { Notice } from '../../helpers/obsidian-mock';
import { expectDefined } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { createEditorClipboard, type EditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { screenPoint, screenToWorld, stageCentreWorld, STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';
import { groupPivot } from '../../../src/domain/spatial/groupGeometry';
import type { Point } from '../../../src/core/geometry/Point';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const cleanups: (() => void)[] = [];
beforeEach(() => { activateNotices(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

async function setup(clipboard?: EditorClipboard): Promise<Rig> {
	const rig = await renovationEditor(true, undefined, clipboard);
	cleanups.push(rig.unmount); rig.changePlan(); await settle();
	return rig;
}
function key(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}
function pointAt(rig: Rig, world: Point): void {
	const editor = useEditorStore(rig.pinia);
	editor.setPointer(worldToScreen(world, editor.viewport, STAGE_PIXELS));
}
const added = (rig: Rig, before: ReadonlySet<string>) => [...rig.project.zones.values()].filter(zone => !before.has(zone.id));
function expectCentred(points: readonly Point[], at: Point): void {
	const centre = expectDefined(groupPivot(points), 'centre');
	expect(centre.x).toBeCloseTo(at.x); expect(centre.y).toBeCloseTo(at.y);
}
const menuIds = (rig: Rig) => rig.wrapper.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'));
async function keyboardMenu(rig: Rig): Promise<void> {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
}

it('copies with Ctrl+C and pastes under the pointer with Ctrl+V, as one undo step that selects the result', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys()), walls = rig.project.structure.walls.length;
	rig.selection.select([rig.room.id, ...WALL_LOOP.walls.map(item => item.id)] as never);
	expect(key(rig.canvasEl, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(true);
	pointAt(rig, { x: 20000, y: 20000 });
	expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(true);
	await settleUntil(() => added(rig, before).length === 1, 'the pasted room');
	const [pasted] = added(rig, before);
	expectCentred(pasted.points, { x: 20000, y: 20000 });
	expect(rig.project.structure.walls).toHaveLength(walls + 4);
	expect(rig.selection.selectedIds).toEqual([pasted.id, ...rig.project.structure.walls.slice(walls).map(item => item.id)]);
	key(rig.canvasEl, { key: 'z', metaKey: true });
	await settleUntil(() => rig.project.zones.size === before.size, 'the undone paste');
	expect(rig.project.structure.walls).toHaveLength(walls);
});

it('pastes at the view centre when the pointer is off the canvas', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	editor.setPointer(null);
	key(rig.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => added(rig, before).length === 1, 'the pasted room');
	expectCentred(added(rig, before)[0].points, stageCentreWorld(editor.stageSize, editor.viewport));
});

it('offers Copy for a selection and Paste once something is copied, pasting where the menu was opened', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); await keyboardMenu(rig);
	expect(menuIds(rig)).toContain('copy'); expect(menuIds(rig)).not.toContain('paste');
	await rig.wrapper.get('[data-rp-context-action="copy"]').trigger('click'); await settle();
	const opened = screenToWorld(screenPoint(700, 50), editor.viewport, STAGE_PIXELS);
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 700, clientY: 50 })); await settle();
	expect(menuIds(rig)).toContain('paste');
	editor.setPointer(null);
	await rig.wrapper.get('[data-rp-context-action="paste"]').trigger('click');
	await settleUntil(() => added(rig, before).length === 1, 'the pasted room');
	expectCentred(added(rig, before)[0].points, opened);
});

it('pastes nothing when the floor goes stale between the menu opening and the click', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	await keyboardMenu(rig);
	const paste = rig.wrapper.get('[data-rp-context-action="paste"]');
	expect(paste.attributes('aria-disabled')).toBeUndefined();
	rig.project.stale = true;
	await paste.trigger('click'); await settle();
	expect(rig.project.zones.size).toBe(before.size);
});

it('leaves fields, dialogs, chords, empty clipboards, stale floors and Review alone', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys());
	const button = rig.wrapper.get('[data-rp-action="select"]').element as HTMLElement;
	expect(key(button, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.selection.clear();
	expect(key(button, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.selection.select([rig.room.id]);
	for (const chord of [{ key: 'c', ctrlKey: true, shiftKey: true }, { key: 'c', ctrlKey: true, altKey: true }, { key: 'c', ctrlKey: true, isComposing: true }, { key: 'c' }, { key: 'x', ctrlKey: true }]) {
		expect(key(button, chord).defaultPrevented).toBe(false);
	}
	expect(key(button, { key: 'C', metaKey: true }).defaultPrevented).toBe(true);
	rig.project.stale = true;
	expect(key(button, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.project.stale = false;
	await rig.runtime.renovation.perspective('review');
	expect(key(button, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(true);
	expect(key(button, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	await rig.runtime.renovation.perspective('plan');
	expect(key(button, { key: 'v', ctrlKey: true, repeat: true }).defaultPrevented).toBe(true);
	const pending = rig.dialogs.openDialog({ kind: 'confirm', title: 'Confirm', message: 'Example' }); await settle();
	expect(key(button, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.dialogs.resolve('cancel'); await pending;
	rig.runtime.setTool('draw-room'); await settle();
	expect(key(rig.wrapper.get('.rp-new-room input').element as HTMLElement, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	await settle();
	expect(rig.project.zones.size).toBe(before.size);
});

it('notifies a refused paste and a faulted one without changing the floor', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys()), walls = rig.project.structure.walls.length;
	rig.selection.select([rig.room.id, ...WALL_LOOP.walls.map(item => item.id)] as never); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	const shown = Notice.shown.length;
	pointAt(rig, { x: 2000, y: 1500 });
	key(rig.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => Notice.shown.length === shown + 1, 'the refusal notice'); await settle();
	expect(rig.project.zones.size).toBe(before.size);
	expect(rig.project.structure.walls).toHaveLength(walls);
	vi.spyOn(rig.runtime.dispatcher, 'run').mockRejectedValueOnce(new Error('vault gone'));
	pointAt(rig, { x: 20000, y: 20000 });
	key(rig.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => Notice.shown.length === shown + 2, 'the fault notice');
	expect(rig.project.zones.size).toBe(before.size);
});

it('offers no paste on a floor missing the structure or the group services', async () => {
	for (const missing of ['renovation', 'groups'] as const) {
		const clipboard = createEditorClipboard(), source = await setup(clipboard);
		source.selection.select([source.room.id]); key(source.canvasEl, { key: 'c', ctrlKey: true });
		const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN); await workspace.ready;
		const commands = missing === 'renovation' ? { ...workspace.deps.commands, renovation: undefined } : { ...workspace.deps.commands, groups: undefined };
		const target = await mountPlanEditorCanvas({ plan: HARNESS_PLAN, queries: workspace.deps.queries, commands, vault: workspace.deps.vault, clipboard });
		cleanups.push(target.unmount);
		expect(key(target.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	}
});

it('pastes on one floor what was copied on another', async () => {
	const clipboard = createEditorClipboard(), source = await setup(clipboard), target = await setup(clipboard);
	const sourceZones = source.project.zones.size, before = new Set(target.project.zones.keys());
	source.selection.select([source.room.id]); key(source.canvasEl, { key: 'c', ctrlKey: true });
	pointAt(target, { x: 20000, y: 20000 });
	key(target.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => added(target, before).length === 1, 'the room pasted onto the other floor');
	expect(added(target, before)[0].name).toBe('Studio');
	expect(source.project.zones.size).toBe(sourceZones);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run check:fast -- tests/presentation/editor/clipboard.test.ts tests/presentation/editor/viewport.test.ts tests/presentation/editor/contextMenuActions.test.ts`
Expected: FAIL — `stageCentreWorld` is not exported; the clipboard cases never see `defaultPrevented`; the Review menu is still `['fit']`.

- [ ] **Step 3: Write the implementation**

`src/presentation/editor/viewport/Viewport.ts` — add after `screenToWorld`:

```ts
/** The world point under the middle of a stage — where a gesture with no pointer lands. */
export function stageCentreWorld(size: { readonly width: number; readonly height: number }, viewport: Viewport): Point {
	return screenToWorld(screenPoint(size.width / 2, size.height / 2), viewport, STAGE_PIXELS);
}
```

`src/presentation/editor/clipboard/clipboardActions.ts`:

```ts
import { computed, inject, provide, type InjectionKey } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { EntityId } from '../../../core/identity/EntityId';
import { createEntityId } from '../../../core/identity/generateId';
import type { PlanId } from '../../../domain/plan/PlanId';
import { captureClipboard, type SpatialClipboard } from '../../../domain/spatial/clipboard';
import { PasteCommand } from '../../../application/commands/spatial/PasteCommand';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { stageCentreWorld } from '../viewport/Viewport';
import { createZoneHistory } from '../add/createZoneHistory';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';

type ClipboardRuntime = Pick<EditorRuntime, 'dispatcher' | 'writesBlocked' | 'structureTask'>;

/** Copy and Paste for ONE leaf, over the clipboard every leaf shares (design spec §6). */
function createClipboardActions(context: PlanEditorContext, runtime: ClipboardRuntime) {
	const project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), session = useRenovationSession();
	const copied = computed(() => captureClipboard({
		rooms: [...project.zones.values()].map(zone => ({ key: zone.id, name: zone.name, zoneType: zone.zoneType, points: zone.points, bulges: zone.bulges })),
		structure: project.structure, names: project.plan?.spatialElements ?? [], groups: project.groups,
	}, selection.selectedIds));
	/** Everything a paste needs, or `null` whenever one would be refused — Review and a stale floor included. */
	const ready = computed(() => {
		const clipboard = context.clipboard.value, { renovation, groups } = context.commands;
		return clipboard && renovation && groups && !runtime.writesBlocked.value && session.perspective !== 'review' ? { clipboard, renovation, groups } : null;
	});
	function copy(): boolean {
		// Plain data, never the store's reactive proxies: the clipboard outlives this leaf.
		if (copied.value) context.clipboard.value = JSON.parse(JSON.stringify(copied.value)) as SpatialClipboard;
		return copied.value !== null;
	}
	async function paste(target: Point = editor.pointerWorld ?? stageCentreWorld(editor.stageSize, editor.viewport)): Promise<void> {
		const value = ready.value;
		if (!value) return;
		const ledger = runtime.structureTask.ledger;
		const command = new PasteCommand({ createRoom: input => createZoneHistory(context, ledger, input), renovation: value.renovation, groups: value.groups, ledger, mintId: prefix => createEntityId(prefix) },
			{ planId: context.planId as PlanId, clipboard: value.clipboard, target });
		try {
			const result = await runtime.dispatcher.run(command);
			if (result.ok) selection.select(command.pastedIds.map(id => id as EntityId<string>));
			else notifyOperationFailure(result.error);
		} catch (cause) { notifyFault(cause, context.commands.logger, 'editor.clipboard.paste-failed'); }
	}
	return { canCopy: computed(() => copied.value !== null), canPaste: computed(() => ready.value !== null), pending: computed(() => context.clipboard.value !== null), copy, paste };
}

export type ClipboardActions = ReturnType<typeof createClipboardActions>;
const KEY: InjectionKey<ClipboardActions> = Symbol('renovation-planner:editor-clipboard');

/** Provided by `PlanEditorRoot` rather than added to `EditorRuntime`, whose file is at its line budget. */
export function provideClipboardActions(context: PlanEditorContext, runtime: ClipboardRuntime): ClipboardActions {
	const actions = createClipboardActions(context, runtime);
	provide(KEY, actions);
	return actions;
}

/** `null` outside a mounted editor: the context menu mounted on its own has no clipboard to offer. */
export function useClipboardActions(): ClipboardActions | null {
	return inject(KEY, null);
}
```

`src/presentation/editor/surface/historyShortcut.ts` — whole file:

```ts
import type { EditorRuntime } from '../runtime';
import type { ClipboardActions } from '../clipboard/clipboardActions';

const EDITING = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

/** A dialog, an event something nearer already handled, or a focused field owns its own editing keys. */
function ownedElsewhere(event: KeyboardEvent, modal: boolean): boolean {
	return modal || event.defaultPrevented || (event.target instanceof HTMLElement && event.target.closest(EDITING) !== null);
}
function historyAction(event: KeyboardEvent): 'undo' | 'redo' | null {
	if (event.altKey || event.isComposing || (!event.ctrlKey && !event.metaKey)) return null;
	const key = event.key.toLowerCase();
	return key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === 'y' && !event.shiftKey ? 'redo' : null;
}
function clipboardAction(event: KeyboardEvent): 'copy' | 'paste' | null {
	if (event.altKey || event.shiftKey || event.isComposing || (!event.ctrlKey && !event.metaKey)) return null;
	const key = event.key.toLowerCase();
	return key === 'c' ? 'copy' : key === 'v' ? 'paste' : null;
}
/** Native text history and modal shortcuts remain owned by their focused surface. */
export function editorHistoryShortcut(event: KeyboardEvent, runtime: Pick<EditorRuntime, 'undo' | 'redo' | 'canUndo' | 'canRedo' | 'writesBlocked'>, state: { modal: boolean; gesture: boolean }): boolean {
	if (ownedElsewhere(event, state.modal)) return false;
	const action = historyAction(event);
	if (!action) return false;
	event.preventDefault(); event.stopPropagation();
	if (!state.gesture && !event.repeat && !runtime.writesBlocked.value && (action === 'undo' ? runtime.canUndo.value : runtime.canRedo.value)) void runtime[action]();
	return true;
}
/**
 * Copy and Paste of the canvas selection. Copy claims the chord only when there was something to
 * copy and Paste only when it could write, so a chord that does nothing here stays the host's.
 * An OS autorepeat of Paste is claimed and ignored rather than pasting once per repeat.
 */
export function editorClipboardShortcut(event: KeyboardEvent, actions: Pick<ClipboardActions, 'copy' | 'paste' | 'canPaste'>, state: { modal: boolean }): boolean {
	if (ownedElsewhere(event, state.modal)) return false;
	const action = clipboardAction(event);
	if (action === null || (action === 'copy' ? !actions.copy() : !actions.canPaste.value)) return false;
	event.preventDefault(); event.stopPropagation();
	if (action === 'paste' && !event.repeat) void actions.paste();
	return true;
}
```

`src/presentation/editor/PlanEditorRoot.vue` — imports (replace the `editorHistoryShortcut` import line and add one):

```ts
import { editorClipboardShortcut, editorHistoryShortcut } from './surface/historyShortcut';
import { provideClipboardActions } from './clipboard/clipboardActions';
```

directly after `const runtime = provideEditorRuntime(context);`:

```ts
const clipboard = provideClipboardActions(context, runtime);
```

and `onRootKeydown`'s first line becomes two:

```ts
function onRootKeydown(event: KeyboardEvent): void {
	const state = { modal: dialogs.current !== null, gesture: runtime.toolManager.gestureInFlight || editor.dragState !== null };
	if (editorHistoryShortcut(event, runtime, state) || editorClipboardShortcut(event, clipboard, state)) return;
	if (!addMenuOpen.value || event.key !== 'Escape') return;
```

`src/presentation/editor/selection/useCanvasMenuActions.ts` — add imports:

```ts
import type { Point } from '../../../core/geometry/Point';
import { useClipboardActions } from '../clipboard/clipboardActions';
```

change the signature and add the composable beside the others:

```ts
export function useCanvasMenuActions(add: () => void, opened: () => Point) {
	const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore();
	const moveOpening = useOpeningMoveAction(), clipboard = useClipboardActions();
```

and in the returned `computed`, replace the two lines from `const result …` through `if (!ids.length) result.push({ id: 'add', … });` with:

```ts
		const result: CanvasMenuAction[] = [{ id: 'fit', label: ids.length ? 'editor.view.fit-selection' : 'editor.view.fit-floor', group: 'view', icon: 'maximize', disabled: frame(ids.length === 0) === null, run: () => fit(ids.length === 0) }];
		if (clipboard && ids.length) result.push({ id: 'copy', label: 'editor.input.copy', group: 'object', icon: 'copy', disabled: !clipboard.canCopy.value, run: () => { clipboard.copy(); } });
		if (review) return result;
		result.push(panning ? { id: 'select', label: 'editor.primary.select', group: 'mode', icon: 'mouse-pointer-2', run: () => runtime.setTool('select') } : { id: 'pan', label: 'editor.input.pan', group: 'mode', icon: 'hand', run: () => runtime.setTool('pan') });
		if (!ids.length) result.push({ id: 'add', label: 'editor.primary.add', group: 'create', icon: 'plus', disabled: blocked, run: add });
		if (clipboard?.pending.value) result.push({ id: 'paste', label: 'editor.input.paste', group: 'create', icon: 'clipboard-paste', disabled: !clipboard.canPaste.value, run: () => clipboard.paste(opened()) });
```

`src/presentation/editor/selection/CanvasContextMenu.vue` — add `import type { Point } from '../../../core/geometry/Point';`, replace `const actions = useCanvasMenuActions(() => emit('openAdd'));` with:

```ts
/** Where the menu was opened, in world millimetres — where its Paste lands (design spec §4). */
let openedAt: Point = { x: 0, y: 0 };
const actions = useCanvasMenuActions(() => emit('openAdd'), () => openedAt);
```

and in `show`, directly after the line that computes `x` and `y`:

```ts
	openedAt = screenToWorld(screenPoint(x, y), editor.viewport, STAGE_PIXELS);
```

`src/presentation/i18n/locales/en/input.ts` — add after `'editor.input.rotate': 'Rotate',`:

```ts
	'editor.input.copy': 'Copy',
	'editor.input.paste': 'Paste',
```

`src/presentation/i18n/locales/de/input.ts` — add after `'editor.input.rotate': 'Drehen',`:

```ts
	'editor.input.copy': 'Kopieren',
	'editor.input.paste': 'Einfügen',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run check:fast -- tests/presentation/editor tests/presentation/i18n`
Expected: PASS, including every case in `clipboard.test.ts`, the updated Review assertion and both `data-icon-missing` loops.

Watch the invariant fail once: in `editorClipboardShortcut` temporarily drop `ownedElsewhere(…)`; `leaves fields, dialogs, …` must go red on the dialog or the field assertion; restore. Then in `useCanvasMenuActions`, move the `paste` push above `if (review) return result;`; the first `contextMenuActions` case must go red; restore.

Then check budgets and coverage for the changed files:

```bash
npx eslint src/presentation/editor/PlanEditorRoot.vue src/presentation/editor/selection/CanvasContextMenu.vue src/presentation/editor/selection/useCanvasMenuActions.ts src/presentation/editor/surface/historyShortcut.ts src/presentation/editor/clipboard/clipboardActions.ts
```

Expected: no findings.

- [ ] **Step 5: Commit**

```bash
git add src/presentation tests/presentation tests/fixtures/editor-icons tests/helpers/editorIconNodes.ts
git commit -m "feat(editor): copy and paste the selection by shortcut and context menu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Manual case and the full gate

**Files:**
- Create: `docs/tests/cases/Copy and paste across floors.md`
- Modify: `docs/superpowers/specs/2026-09-10-editor-copy-paste-design.md` (status line)

**Interfaces:**
- Consumes: everything above. Produces: nothing code depends on.

- [ ] **Step 1: Write the manual case**

Read `docs/tests/cases/Add a room.md` first and copy its frontmatter keys and section headings exactly; the body below is the content to put under them.

```markdown
# Copy and paste across floors

What no suite here can see: Obsidian's own handling of Ctrl/Cmd+C and Ctrl/Cmd+V inside a
Plan Editor leaf, the native menu icons `copy` and `clipboard-paste` in the installed host, and
a paste written into a real vault across two floors.

## Preconditions

- `npm run test-build`, then open this repository as a vault with the plugin enabled.
- One project with two floors. On the ground floor: a Room drawn with its walls ("room" ticked
  on the wall tool), a door on one of those walls, and one object element.

## Steps

1. Ground floor: select the Room, the object and the door. Press Ctrl+C (Cmd+C on macOS).
   **Expect:** nothing visible changes; no notice.
2. Open the first floor in a second tab. Point at an empty spot and press Ctrl+V.
   **Expect:** the Room, its walls, the door and the object appear centred under the pointer,
   selected. The Room keeps its name. The Zones folder holds a second note with that name
   (suffixed with its id).
3. Press Ctrl+Z once. **Expect:** everything pasted in step 2 disappears, and its Zone note is gone.
4. Press Ctrl+Y. **Expect:** it all returns.
5. Right-click an empty spot on the first floor. **Expect:** Paste is listed with a paste icon;
   choosing it pastes centred where you right-clicked.
6. Point at the Room pasted in step 2 and press Ctrl+V again.
   **Expect:** a notice says the walls would cross existing walls; nothing is added.
7. Click into the Inspector's name field and press Ctrl+V. **Expect:** Obsidian pastes text into
   the field; the canvas does not paste.
8. Switch to Review. Right-click the canvas. **Expect:** Copy is listed, Paste is not.
9. Close and reopen the first floor. **Expect:** what steps 4 and 5 wrote is still there.

## Runs

| Date | Build | Result | Notes |
| --- | --- | --- | --- |
| — | — | not run | Written with the increment; unrun until walked in a vault. |
```

- [ ] **Step 2: Mark the spec implemented**

In `docs/superpowers/specs/2026-09-10-editor-copy-paste-design.md` replace the `**Status:**` line with:

```markdown
**Status:** implemented by `docs/superpowers/plans/2026-09-10-editor-copy-paste.md`; the manual
case `docs/tests/cases/Copy and paste across floors.md` has not been run in a vault.
```

and replace the `- **Runtime.**` bullet of §6 with:

```markdown
- **Actions.** `clipboard/clipboardActions.ts` holds `copy()` and `paste(target?)`, provided by
  `PlanEditorRoot` and injected by the context menu — not members of `EditorRuntime`, because
  `runtime.ts` is at its line budget. Both the shortcut and the menu call these — one action,
  every input.
```

- [ ] **Step 3: Run the full gate**

Run: `npm run check`
Expected: build, lint, test:coverage (floors 99/99/99/98) and fallow all pass.

If coverage fails, open `coverage/coverage-final.json` for `src/domain/spatial/clipboard.ts`, `src/application/commands/spatial/PasteCommand.ts`, `src/presentation/editor/clipboard/clipboardActions.ts`, `src/presentation/editor/surface/historyShortcut.ts` and `src/presentation/editor/selection/useCanvasMenuActions.ts`, list each arm with a zero count, and add the case that reaches it — or remove the guard if no input can reach it. If fallow reports an unused export, delete the export rather than suppressing it.

- [ ] **Step 4: Commit**

```bash
git add "docs/tests/cases/Copy and paste across floors.md" docs/superpowers/specs/2026-09-10-editor-copy-paste-design.md
git commit -m "docs: add the copy and paste manual case

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
