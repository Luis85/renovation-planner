# Plan colours everywhere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every plan thing — each element kind, walls, openings and rooms — takes a preset or custom `#rrggbb` colour, one or many at a time, as one undo step.

**Architecture:** The colour lives on the geometry sidecar beside each family (schema 15). One pure `recoloredDocument` function sets it on the selected ids and the existing group-operations route (`createGroupOperations` → `GroupGeometryCommand`) writes it as one conditional sidecar write. Drawing reads it through three small functions (`itemColorRgb`, `itemColorTint`, `itemColorInk`).

**Tech Stack:** TypeScript, Vue 3 SFCs, vue-konva/Konva 10, zod 4, Vitest (node + jsdom), Obsidian plugin.

**Spec:** `docs/superpowers/specs/2026-09-15-plan-colors-everywhere-design.md`

## Global Constraints

- Names: the spec's `PlanColor` / `planColorAppearance` / `PlanColorControl` are implemented under the EXISTING `ItemColor` names (`ItemColor.ts`, `itemColorAppearance.ts`, `ItemColorControl.vue`, `ItemColorSwatch.vue`, CSS `rp-item-color*`, data attribute `data-rp-item-color`, i18n `editor.item-color.*`). No file is renamed. Task 12 records this in the spec.
- Colour value: a preset id (`slate`, `rose`, `amber`, `green`, `blue`, `violet`) or a lowercase `#rrggbb`. Absence means Default. `null`, `default`, uppercase hex, 3-digit hex, `rgb()` and named CSS colours are invalid.
- Tint = opaque blend `0.72 × background + 0.28 × colour`, rounded per channel; unparseable background → background unchanged.
- Room wash opacity: `0.18` at rest, `0.28` selected. Uncoloured rooms keep `0` / `0.12`.
- Selected strokes and text use `tokens.accent`; fills keep their tint or wash.
- Schema: 15 only when a hex colour exists or any wall/opening/room/non-`object`/non-`asset` element has a colour; preset colours on items keep writing 14.
- Colour writes are Plan-perspective only and go through group operations; picking the current colour writes nothing.
- The native picker (`<input type="color">`) commits on `change`, never `input`, and appears in Details only, never in the right-click menu.
- Layer bans (`eslint.config.mjs`): `domain/` and `application/` never import `vue`, `konva`, `obsidian`. Nothing writes to the vault outside `infrastructure/`.
- No literal colour in `styles/` (build-checked). No regex over SOURCE TEXT in tests (a regex over a runtime value is fine).
- Every user-visible string through `tr`; EN and DE locale files keep identical keys.
- Line budgets: `src/**` files ≤ 400 lines, functions ≤ 100; `tests/**` ≤ 450.
- Inner loop: `npm run check:fast -- <test paths>`; before each commit also `npx eslint <changed files>` (check:fast skips ESLint). CI runs `npm run check` on the pull request.
- Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` — this overrides any model name an implementer would otherwise write.
- TDD: every new test is run and watched FAILING before the code that passes it. If a test named "watch it fail" passes first, stop and report.

## File map

| File | Responsibility | Tasks |
| --- | --- | --- |
| `src/domain/spatial/ItemColor.ts` | value type and guards | 1 |
| `src/domain/spatial/SpatialElement.ts`, `Structure.ts`, `structureGeometry.ts` | colour on every element, wall, opening; validation | 1 |
| `src/presentation/editor/elements/itemColorAppearance.ts` | rgb / tint / ink | 1 |
| `src/infrastructure/persistence/dto/planGeometry.ts`, `migration/geometry/plan/plan-geometry.migrations.ts`, `obsidian/repositories/PlanGeometryStore.ts` | schema 15 | 2 |
| `src/domain/zone/Zone.ts`, `persistence/mappers/zoneMapper.ts`, `obsidian/repositories/{ObsidianPlanGeometrySidecar,ObsidianZoneRepository,zoneGeometryVersions,digest}.ts`, `application/ports/{PlanGeometrySidecar,ZoneRepository}.ts`, `presentation/read-models/PlanDto.ts` | room colour round-trip | 3 |
| `src/application/commands/spatial/{sameGeometryDocument,GroupGeometryCommand}.ts`, `presentation/editor/groups/groupSnapshot.ts` | history sees colour | 4 |
| `src/presentation/editor/groups/{itemColorActions,groupActions}.ts`, `elements/{elementActions,itemColorTargets}.ts`, `elements/ItemColor{Control,Swatch,Custom}.vue`, i18n | the action and the control | 5, 9, 10 |
| `src/presentation/editor/elements/{ElementShapes,ElementShape,StairShape,StructuralShape,DraftingShape,DirectionArrowShape}.vue`, `assetShapeConfig.ts` | elements draw colour | 6 |
| `src/presentation/editor/structure/{StructureLayer,OpeningSymbols}.vue` | walls/openings draw colour | 7 |
| `src/presentation/editor/layers/zone/{ZoneRenderModel.ts,ZoneShape.vue}` | room wash | 8 |
| `StructureInspector.vue`, `RoomInspector.vue`, `EntityInspector.vue` | mounts | 9, 10 |
| `tests/harness/referenceWorkspace.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` | `?colors` captures | 11 |
| ADR-0033, `docs/development/item-colors.md`, `docs/using-item-colors.md`, `CHANGELOG.md`, manual case | decisions and help | 12 |

Checkpoints: push and let CI go green after Task 5 (phase 1), Task 9 (phase 2) and Task 12 (phase 3 + docs).

---

### Task 1: The colour value accepts a custom hex on every element, wall and opening

**Files:**
- Modify: `src/domain/spatial/ItemColor.ts` (whole file)
- Modify: `src/domain/spatial/SpatialElement.ts:3,12-13,84`
- Modify: `src/domain/spatial/Structure.ts:6-27`
- Modify: `src/domain/spatial/structureGeometry.ts:71-75`
- Modify: `src/presentation/editor/elements/itemColorAppearance.ts` (whole file)
- Modify: `src/presentation/editor/elements/ElementShapes.vue:10,35`
- Modify: `src/presentation/editor/elements/assetShapeConfig.ts:7,19`
- Modify: `src/presentation/editor/elements/ItemColorSwatch.vue:3,6,7,10`
- Modify: `src/presentation/editor/elements/ItemColorControl.vue:3,14,17-19`
- Modify: `src/presentation/editor/elements/elementActions.ts:7,33-38,100-104`
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts:2,126-128`
- Replace: `tests/domain/spatial/itemColor.test.ts` (rewritten)
- Create: `tests/presentation/editor/itemColorAppearance.test.ts`
- Create: `tests/infrastructure/persistence/itemColorSchema.test.ts` (the DTO and equality cases moved out of the old domain test)

**Interfaces:**
- Produces (`ItemColor.ts`): `ITEM_COLORS` (preset tuple, unchanged), `type ItemColorPreset`, `type HexColor = \`#${string}\``, `type ItemColor = ItemColorPreset | HexColor`, `isItemColorPreset(v): v is ItemColorPreset`, `isHexColor(v): v is HexColor`, `isItemColor(v): v is ItemColor`. `itemColorKind` is DELETED.
- Produces (`Structure.ts`): `Wall.color?: ItemColor`, `Opening.color?: ItemColor`.
- Produces (`itemColorAppearance.ts`): `ITEM_COLOR_RGB: Record<ItemColorPreset, string>`, `itemColorRgb(color: ItemColor): string`, `itemColorTint(color: ItemColor | undefined, background: string): string`, `itemColorInk(color: ItemColor | undefined, fallback: string): string`. `itemColorFill` is DELETED.
- Produces: `validateStructure` refuses an invalid wall/opening colour with code `spatial.color-invalid`.

- [ ] **Step 1: Write the failing domain test** — replace `tests/domain/spatial/itemColor.test.ts` with:

```ts
import { expect, it } from 'vitest';
import { isHexColor, isItemColor, isItemColorPreset, ITEM_COLORS } from '../../../src/domain/spatial/ItemColor';
import { validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { validateStructure } from '../../../src/domain/spatial/structureGeometry';
import { WALL_LOOP } from '../../helpers/structure';

const item: SpatialElement = { id: 'element-item', kind: 'object', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }] };
const path: SpatialElement = { id: 'element-path', kind: 'path', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };

it('accepts the six presets and a lowercase #rrggbb, and nothing else', () => {
	expect(ITEM_COLORS.every(color => isItemColorPreset(color) && isItemColor(color))).toBe(true);
	expect(isHexColor('#3a7bd5')).toBe(true); expect(isItemColor('#3a7bd5')).toBe(true); expect(isItemColorPreset('#3a7bd5')).toBe(false);
	for (const invalid of ['#3A7BD5', '#fff', '3a7bd5', 'rgb(1, 2, 3)', 'red', 'default', '', null, undefined, 7]) expect(isItemColor(invalid)).toBe(false);
});

it('lets every element kind carry a valid colour and refuses an invalid one', () => {
	expect(validSpatialElement({ ...item, color: 'blue' })).toBe(true);
	expect(validSpatialElement({ ...path, color: '#3a7bd5' })).toBe(true);
	expect(validSpatialElement({ ...path, color: 'blue' })).toBe(true);
	expect(validSpatialElement({ ...item, color: '#3A7BD5' as never })).toBe(false);
	expect(validSpatialElement({ ...path, color: 'pink' as never })).toBe(false);
});

it('lets a wall and an opening carry a valid colour and refuses an invalid one', () => {
	const opening = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
	const colored = { ...WALL_LOOP, walls: WALL_LOOP.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall), openings: [{ ...opening, color: '#3a7bd5' as const }] };
	expect(validateStructure(colored, []).ok).toBe(true);
	const badWall = { ...colored, walls: colored.walls.map((wall, index) => index === 0 ? { ...wall, color: 'pink' as never } : wall) };
	expect(validateStructure(badWall, [])).toMatchObject({ ok: false, error: { code: 'spatial.color-invalid' } });
	const badOpening = { ...colored, openings: [{ ...opening, color: '#FFF' as never }] };
	expect(validateStructure(badOpening, [])).toMatchObject({ ok: false, error: { code: 'spatial.color-invalid' } });
});
```

- [ ] **Step 2: Write the failing appearance test** — create `tests/presentation/editor/itemColorAppearance.test.ts` (node environment; Konva imports in node today):

```ts
import { expect, it } from 'vitest';
import { itemColorInk, itemColorRgb, itemColorTint } from '../../../src/presentation/editor/elements/itemColorAppearance';
import { assetShapeConfig } from '../../../src/presentation/editor/elements/assetShapeConfig';
import { THEME_TOKENS, type ThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';

it('resolves a preset to its content sample and a hex to itself', () => {
	expect(itemColorRgb('blue')).toBe('#518cce');
	expect(itemColorRgb('#3a7bd5')).toBe('#3a7bd5');
});

it('tints presets and hex against light, dark and custom backgrounds, keeping Default and unparseable hosts', () => {
	expect(itemColorTint('blue', '#ffffff')).toBe('rgb(206, 223, 241)');
	expect(itemColorTint('blue', '#1e1e1e')).toBe('rgb(44, 61, 79)');
	expect(itemColorTint('blue', 'rgb(240, 230, 210)')).toBe('rgb(195, 205, 209)');
	expect(itemColorTint('#ff0000', '#ffffff')).toBe('rgb(255, 184, 184)');
	expect(itemColorTint('#ff0000', '#000000')).toBe('rgb(71, 0, 0)');
	expect(itemColorTint(undefined, '#abcdef')).toBe('#abcdef');
	expect(itemColorTint('blue', 'unparseable')).toBe('unparseable');
});

it('inks at full strength and falls back to the token while absent', () => {
	expect(itemColorInk('rose', 'token-zoneStroke')).toBe('#ce6682');
	expect(itemColorInk('#3a7bd5', 'token-zoneStroke')).toBe('#3a7bd5');
	expect(itemColorInk(undefined, 'token-zoneStroke')).toBe('token-zoneStroke');
});

it('colors a missing-asset placeholder while retaining its selected outline, dashed shape and label', () => {
	const tokens = Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, key === 'canvasBackground' ? '#ffffff' : '#222222'])) as ThemeTokens;
	const element = { id: 'element-asset', kind: 'asset' as const, points: [{ x: 1000, y: 1000 }, { x: 1100, y: 1000 }], assetId: 'missing', name: 'Armchair', color: 'blue' as const };
	const result = assetShapeConfig(element, () => null, { selected: true, hovered: false, tokens, zoom: 1 });
	expect(result.footprint.fill).toBe('rgb(206, 223, 241)'); expect(result.footprint.stroke).toBe(tokens.accent);
	expect(result.footprint.dash).toEqual([6, 4]); expect(result.label.text).toBe('Armchair'); expect(result.cross).not.toBeNull();
});
```

- [ ] **Step 3: Move the DTO and equality cases** — create `tests/infrastructure/persistence/itemColorSchema.test.ts` holding the old file's `includes placement color in document equality…` and `migrates old sidecars without inventing colors…` cases VERBATIM (copy them from `git show HEAD:tests/domain/spatial/itemColor.test.ts`, lines 1-46, keeping only the imports those two cases use). They must still pass unchanged: schema 14 still refuses a coloured `path`.

- [ ] **Step 4: Run and watch them fail**

Run: `npm run check:fast -- tests/domain/spatial/itemColor.test.ts tests/presentation/editor/itemColorAppearance.test.ts tests/infrastructure/persistence/itemColorSchema.test.ts`
Expected: FAIL — `isHexColor`/`itemColorTint` not exported; coloured path invalid.

- [ ] **Step 5: Implement the value** — replace `src/domain/spatial/ItemColor.ts`:

```ts
/** Durable user appearance, independent of host chrome and asset-library definitions. Absence means Default. */
export const ITEM_COLORS = ['slate', 'rose', 'amber', 'green', 'blue', 'violet'] as const;
export type ItemColorPreset = typeof ITEM_COLORS[number];
/** A lowercase `#rrggbb` from the colour picker — the one custom form (plan colours design §1). */
export type HexColor = `#${string}`;
export type ItemColor = ItemColorPreset | HexColor;

export function isItemColorPreset(value: unknown): value is ItemColorPreset { return typeof value === 'string' && ITEM_COLORS.includes(value as ItemColorPreset); }
export function isHexColor(value: unknown): value is HexColor { return typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value); }
export function isItemColor(value: unknown): value is ItemColor { return isItemColorPreset(value) || isHexColor(value); }
```

`SpatialElement.ts`: import `{ isItemColor, type ItemColor }` only; the field comment becomes `/** User appearance on any kind (plan colours design §1). Absent means the host's default drawing. */`; line 84 becomes:

```ts
	if (element.color !== undefined && !isItemColor(element.color)) return false;
```

`Structure.ts`: add `import type { ItemColor } from './ItemColor';` and, as the first member of both `Wall` and `Opening`:

```ts
	/** User appearance (plan colours design §1); absent means the host's default drawing. */
	readonly color?: ItemColor;
```

`structureGeometry.ts`: import `isItemColor` from `./ItemColor`, add above `validateStructure`:

```ts
/** A wall's or opening's colour is a preset or a lowercase `#rrggbb`, or absent. */
function colorError(structure: Structure): ValidationError | null {
	return [...structure.walls, ...structure.openings].every(item => item.color === undefined || isItemColor(item.color)) ? null : spatialError('color-invalid');
}
```

and change the wall-error line inside `validateStructure` (no new branch, so its complexity is unchanged):

```ts
	const wallError = colorError(structure) ?? wallValidationError(structure.walls); if (wallError) return err(wallError);
```

- [ ] **Step 6: Implement the appearance functions** — replace `itemColorAppearance.ts`:

```ts
import Konva from 'konva';
import { isItemColorPreset, type ItemColor, type ItemColorPreset } from '../../../domain/spatial/ItemColor';

/** User content swatches, not interface tokens. A restrained tint preserves the host's outline/label contrast. */
export const ITEM_COLOR_RGB: Readonly<Record<ItemColorPreset, string>> = {
	slate: '#778899', rose: '#ce6682', amber: '#d69b32', green: '#54976d', blue: '#518cce', violet: '#956bc4',
};
/** A preset's content sample, or the custom hex itself. */
export function itemColorRgb(color: ItemColor): string { return isItemColorPreset(color) ? ITEM_COLOR_RGB[color] : color; }
const channel = (a: number, b: number) => Math.round(a * 0.72 + b * 0.28);
/** A filled area's colour: an opaque 28% blend over the resolved host background (plan colours design §2). */
export function itemColorTint(color: ItemColor | undefined, background: string): string {
	if (color === undefined) return background;
	const base = Konva.Util.colorToRGBA(background), tint = Konva.Util.getRGB(itemColorRgb(color));
	// Unparseable custom host colors keep a safe native fill; the saved value remains visible in Details.
	if (!base) return background;
	return `rgb(${channel(base.r, tint.r)}, ${channel(base.g, tint.g)}, ${channel(base.b, tint.b)})`;
}
/** A line's or text's colour at full strength; the theme token while absent. Callers put `accent` first while selected. */
export function itemColorInk(color: ItemColor | undefined, fallback: string): string {
	return color === undefined ? fallback : itemColorRgb(color);
}
```

- [ ] **Step 7: Update the consumers** (types only; behaviour for items is unchanged):
  - `ElementShapes.vue`: import `itemColorTint` instead of `itemColorFill`; line 35's fill becomes `fill: closed ? itemColorTint(element.color, tokens.canvasBackground) : undefined`.
  - `assetShapeConfig.ts`: import `itemColorTint`; line 19 becomes `const fill = itemColorTint(element.color, tokens.canvasBackground);`.
  - `ItemColorSwatch.vue`: `import type { ItemColorPreset } from '../../../domain/spatial/ItemColor';`, prop `color?: ItemColorPreset`; `pigment` unchanged (`ITEM_COLOR_RGB[props.color]`).
  - `ItemColorControl.vue`: import `ITEM_COLORS, type ItemColorPreset`; line 14's `itemColorKind(item.kind)` becomes `(item.kind === 'object' || item.kind === 'asset')`; `ItemColor` → `ItemColorPreset` on lines 17-19.
  - `elementActions.ts`: import `isItemColorPreset, type ItemColorPreset`; in `recolored` replace `!itemColorKind(element.kind)` with `(element.kind !== 'object' && element.kind !== 'asset')` and `ItemColor` with `ItemColorPreset`; in `setColor` use `ItemColorPreset` and `!isItemColorPreset(color)`. (Task 5 deletes both functions.)
  - `planGeometry.ts`: `import { ITEM_COLORS } from '../../../domain/spatial/ItemColor';`; the V14 refine becomes

```ts
	// Schema 14 colours plain items and placements only; schema 15 is where every family takes one.
	.refine(element => element.color === undefined || element.kind === 'object' || element.kind === 'asset', { message: 'Only an item or asset placement can carry a color.' });
```

- [ ] **Step 8: Run to green**

Run: `npm run check:fast -- tests/domain tests/presentation/editor/itemColorAppearance.test.ts tests/presentation/editor/itemColors.test.ts tests/infrastructure/persistence tests/presentation/editor/elements`
Expected: PASS. Then `npx eslint src/domain/spatial src/presentation/editor/elements src/infrastructure/persistence/dto/planGeometry.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/domain/spatial src/presentation/editor/elements src/infrastructure/persistence/dto/planGeometry.ts tests/domain/spatial/itemColor.test.ts tests/presentation/editor/itemColorAppearance.test.ts tests/infrastructure/persistence/itemColorSchema.test.ts
git commit -m "feat(colors): a custom hex colour on every element, wall and opening

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Sidecar schema 15

**Files:**
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts:1-3,93,131-132`
- Modify: `src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations.ts:43-45`
- Modify: `src/infrastructure/obsidian/repositories/PlanGeometryStore.ts:10,54-60,314`
- Modify: `tests/infrastructure/persistence/itemColorSchema.test.ts` (append)
- Create: `tests/infrastructure/obsidian/repositories/itemColorWrittenSchema.test.ts`

**Interfaces:**
- Consumes: `isItemColor`, `isItemColorPreset`, `type ItemColor` (Task 1).
- Produces: exported `PlanGeometrySchemaV15` and `SpatialObjectGeometrySchemaV15`; `SpatialObjectGeometryDTO = z.infer<typeof SpatialObjectGeometrySchemaV15>` (carries `color?: ItemColor`); `PlanGeometryDTO['schemaVersion']` includes `15`; DTO walls, openings, elements and objects carry `color?: ItemColor`.

- [ ] **Step 1: Write the failing schema tests** — append to `tests/infrastructure/persistence/itemColorSchema.test.ts` (it already declares `item`, `structure` and `old` from Task 1's move; add `PlanGeometrySchemaV15` to its `planGeometry` import):

```ts
it('parses schema 15 colours on every family and refuses malformed values', () => {
	const wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150, sideExtents: { a: 75, b: 75 }, color: 'rose' };
	const opening = { id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, color: '#3a7bd5' };
	const path = { id: 'element-path', kind: 'path', points: [{ x: 0, y: 0 }, { x: 900, y: 0 }], color: '#00ff00' };
	const room = { id: 'zone-a', type: 'polygon', points: [[0, 0], [100, 0], [100, 100]], color: 'amber' };
	const v15 = { schemaVersion: 15, planId: 'floor', revision: 0, unit: 'mm', calibration: null, objects: [room], structure: { walls: [wall], openings: [opening], boundaries: [], elements: [path] } };
	const parsed = PlanGeometrySchemaV15.parse(v15);
	expect([parsed.objects[0].color, parsed.structure?.walls[0].color, parsed.structure?.openings[0].color, parsed.structure?.elements?.[0].color]).toEqual(['amber', 'rose', '#3a7bd5', '#00ff00']);
	for (const bad of ['#00FF00', '#0f0', 'green-ish', null]) {
		expect(PlanGeometrySchemaV15.safeParse({ ...v15, structure: { ...v15.structure, elements: [{ ...path, color: bad }] } }).success).toBe(false);
	}
	const hexItem14 = { ...v15, schemaVersion: 14, objects: [], structure: { walls: [], openings: [], boundaries: [], elements: [{ ...item, color: '#00ff00' }] } };
	expect(PlanGeometrySchemaV14.safeParse(hexItem14).success).toBe(false);
});

it('migrates 14 to 15 without changing content, and a schema-14 reader refuses 15', () => {
	const runner = new MigrationRunner(); runner.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS);
	const colored14 = { ...old, schemaVersion: 14, structure: { ...structure, elements: [{ ...item, color: 'rose' }] } };
	expect(PlanGeometrySchemaV15.parse(runner.migrateToLatest('plan-geometry', colored14, 14)).structure?.elements?.[0].color).toBe('rose');
	const previous = new MigrationRunner(); previous.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 14));
	expect(() => previous.migrateToLatest('plan-geometry', { ...colored14, schemaVersion: 15 }, 15)).toThrow('newer than this build supports');
});
```

- [ ] **Step 2: Write the failing writer test** — create `tests/infrastructure/obsidian/repositories/itemColorWrittenSchema.test.ts`:

```ts
import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP_WITH_SIDES } from '../../../helpers/structure';
import { expectOk } from '../../../helpers/domain';
import type { Structure } from '../../../../src/domain/spatial/Structure';

const item = { id: 'element-item', kind: 'object' as const, points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }] };
const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
async function writtenVersion(structure: Structure) {
	const rig = await structureStack(), read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure }, read.version));
	return expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion;
}

it('keeps schema 14 for preset colours on items and writes 15 for a hex or a colour on any other family', async () => {
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [{ ...item, color: 'blue' }] })).toBe(14);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [{ ...item, color: '#3a7bd5' }] })).toBe(15);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [{ id: 'element-path', kind: 'path', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }], color: 'blue' }] })).toBe(15);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, walls: WALL_LOOP_WITH_SIDES.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall) })).toBe(15);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, openings: [{ ...door, color: 'green' }] })).toBe(15);
	expect(await writtenVersion({ ...WALL_LOOP_WITH_SIDES, elements: [item] })).toBeLessThan(14);
});
```

- [ ] **Step 3: Run and watch both fail**

Run: `npm run check:fast -- tests/infrastructure/persistence/itemColorSchema.test.ts tests/infrastructure/obsidian/repositories/itemColorWrittenSchema.test.ts`
Expected: FAIL — `PlanGeometrySchemaV15` is not exported; a wall colour is refused or written as 14.

- [ ] **Step 4: Add schema 15** — in `planGeometry.ts` change the import to `import { isItemColor, type ItemColor, ITEM_COLORS } from '../../../domain/spatial/ItemColor';`, delete the `export type SpatialObjectGeometryDTO` line under V10, and replace the last two lines (`PlanGeometrySchema` and `PlanGeometryDTO`) with:

```ts
/** Schema 15: a preset or a lowercase `#rrggbb` on every element kind, wall, opening and room entry (plan colours design §1). */
const ItemColorSchema = z.custom<ItemColor>(isItemColor, { message: 'A color is a preset id or a lowercase #rrggbb.' });
const SpatialElementSchemaV15 = SpatialElementShapeV12.extend({ color: ItemColorSchema.optional() })
	.refine(stairRule).refine(assetRule, ASSET_MESSAGE).refine(structuralRule, STRUCTURAL_MESSAGE).refine(draftingRule, DRAFTING_MESSAGE);
const WallSchemaV15 = StructureSchemaV7.shape.walls.element.extend({ sideExtents: WallSidesSchema.optional(), color: ItemColorSchema.optional() })
	.refine(wall => wall.sideExtents !== undefined, { message: 'A schema-13 wall needs both face extents.' });
const OpeningSchemaV15 = StructureSchemaV5.shape.openings.element.extend({ color: ItemColorSchema.optional() });
const StructureSchemaV15 = StructureSchemaV14.extend({ walls: z.array(WallSchemaV15), openings: z.array(OpeningSchemaV15), elements: z.array(SpatialElementSchemaV15).optional() });
export const SpatialObjectGeometrySchemaV15 = SpatialObjectShapeV7.extend({ labelOffset: LabelOffsetSchema.optional(), color: ItemColorSchema.optional() }).refine(oneBulgePerEdge, BULGE_MESSAGE);
export type SpatialObjectGeometryDTO = z.infer<typeof SpatialObjectGeometrySchemaV15>;
export const PlanGeometrySchemaV15 = PlanGeometrySchemaV14.extend({ schemaVersion: z.literal(15), objects: z.array(SpatialObjectGeometrySchemaV15), structure: StructureSchemaV15.optional(), intended: StructureSchemaV15.optional() });
export const PlanGeometrySchema = z.union([PlanGeometrySchemaV1, PlanGeometrySchemaV2, PlanGeometrySchemaV3, PlanGeometrySchemaV4, PlanGeometrySchemaV5, PlanGeometrySchemaV6, PlanGeometrySchemaV7, PlanGeometrySchemaV8, PlanGeometrySchemaV9, PlanGeometrySchemaV10, PlanGeometrySchemaV11, PlanGeometrySchemaV12, PlanGeometrySchemaV13, PlanGeometrySchemaV14, PlanGeometrySchemaV15]);
export type PlanGeometryDTO = Omit<z.infer<typeof PlanGeometrySchemaV15>, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 };
```

Zod refuses `.extend` on a `.refine`d object: every extension above starts from an unrefined shape. Keep it that way if a line needs changing.

- [ ] **Step 5: Add the migration** — append to `PLAN_GEOMETRY_MIGRATIONS` after the 13→14 entry:

```ts
}, {
	fromVersion: 14, toVersion: 15,
	migrate: input => typeof input === 'object' && input !== null ? { ...input, schemaVersion: 15 } : input,
}];
```

- [ ] **Step 6: Choose 15 when written** — in `PlanGeometryStore.ts` import `PlanGeometrySchemaV15` instead of V14 and use it at the read's `safeParse`; import `isItemColorPreset` from `../../../domain/spatial/ItemColor`; replace `hasItemColor` with:

```ts
/** Colours need a reader that understands them: 14 for presets on items and placements, 15 for a hex or any other family (plan colours design §1). */
function colorSchema(dto: Pick<PlanGeometryDTO, 'objects' | 'structure' | 'intended'>): 14 | 15 | null {
	const structures = [dto.structure, dto.intended].filter((structure): structure is NonNullable<typeof structure> => structure !== undefined);
	const elements = structures.flatMap(structure => structure.elements ?? []).filter(element => element.color !== undefined);
	const others = [...dto.objects, ...structures.flatMap(structure => [...structure.walls, ...structure.openings])];
	if (others.some(item => item.color !== undefined) || elements.some(element => !isItemColorPreset(element.color) || (element.kind !== 'object' && element.kind !== 'asset'))) return 15;
	return elements.length ? 14 : null;
}
```

and in `writtenSchema` replace `if (hasItemColor(dto)) return 14;` with one line (no new branch, so fallow's complexity for `writtenSchema` is unchanged):

```ts
	const colored = colorSchema(dto); if (colored) return colored;
```

- [ ] **Step 7: Run to green** — `npm run check:fast -- tests/infrastructure tests/domain tests/application`. Expected PASS. A test elsewhere that pinned "latest is 14" is updated to 15 in this commit: grep `toVersion <= 13` and `schemaVersion).toBe(14)` under `tests/` and read each hit (`itemColors.test.ts`'s preset-on-item case legitimately stays 14). Then `npx eslint src/infrastructure`.

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure tests/infrastructure
git commit -m "feat(colors): geometry sidecar schema 15 stores a colour on every family

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: A room carries its colour through every save

**Files:**
- Modify: `src/domain/zone/Zone.ts` (props, fields, constructor, `create`, new `withColor`, `fields()`)
- Modify: `src/infrastructure/persistence/mappers/zoneMapper.ts:9-12,39-47,60-80`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar.ts:59-64,86-92`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts:23,264`
- Modify: `src/infrastructure/obsidian/repositories/zoneGeometryVersions.ts:13-24`
- Modify: `src/infrastructure/obsidian/repositories/digest.ts:7,128`
- Modify: `src/infrastructure/persistence/dto/planGeometry.ts:92` (drop `export` from V10)
- Modify: `src/application/ports/PlanGeometrySidecar.ts:16-22`
- Modify: `src/application/ports/ZoneRepository.ts:13-16,41`
- Modify: `src/presentation/read-models/PlanDto.ts:54-67,156-171`
- Modify: `tests/infrastructure/persistence/mappers/mappers.test.ts`, `tests/infrastructure/obsidian/repositories/digest.test.ts` (append)
- Create: `tests/infrastructure/obsidian/repositories/zoneColorPersistence.test.ts`

**Interfaces:**
- Consumes: `SpatialObjectGeometrySchemaV15` (Task 2); `type ItemColor`, `isItemColor` (Task 1).
- Produces: `Zone.color: ItemColor | null`; `CreateZoneProps.color?: ItemColor | null`; `Zone.withColor(color: ItemColor | null): Zone`; `SpatialObjectGeometry.color?: ItemColor`; `ZoneDto.color?: ItemColor`; `ZoneGeometryVersions.versionFor(geometry: CurvedPolygon & { readonly color?: ItemColor })`; `prepareGeometryVersions?(id, geometry: CurvedPolygon & { readonly labelOffset?: Vector; readonly color?: ItemColor })`.

- [ ] **Step 1: Write the failing tests.** Append to `mappers.test.ts`, beside `zone caption offset mapping` and reusing its imports:

```ts
describe('zone colour mapping', () => {
	it('writes color only while set, reads it back, and refuses an invalid one', () => {
		const zone = makeZoneEntity({ projectId: createProjectId(), planId: createPlanId() });
		expect('color' in zoneToGeometryEntry(zone)).toBe(false);
		expect(expectOkOf(zoneFromPersistence(zoneToPersistence(zone, 1), zoneToGeometryEntry(zone))).color).toBeNull();
		const colored = zone.withColor('#3a7bd5');
		expect(zoneToGeometryEntry(colored).color).toBe('#3a7bd5');
		expect(expectOkOf(zoneFromPersistence(zoneToPersistence(colored, 1), zoneToGeometryEntry(colored))).color).toBe('#3a7bd5');
		expect(zoneFromPersistence(zoneToPersistence(zone, 1), { ...zoneToGeometryEntry(zone), color: 'pink' as never }).ok).toBe(false);
	});
});
```

Append inside `digest.test.ts`'s `describe` that holds the zone case:

```ts
	it('changes a zone token with its colour and not for an uncoloured entry', () => {
		const entry = { id: 'zone-x', type: 'polygon' as const, points: [[0, 0], [10, 0], [10, 10]] as [number, number][] };
		const token = observeZone(base, entry);
		expect(observeZone(base, { ...entry, color: 'blue' as const })).not.toBe(token);
		expect(observeZone(base, { ...entry })).toBe(token);
	});
```

Create `tests/infrastructure/obsidian/repositories/zoneColorPersistence.test.ts`:

```ts
import { expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectFound, expectOk } from '../../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../../helpers/entities';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

it('keeps a room colour through rename, lock and a whole-document sidecar write', async () => {
	const stack = createRepositoryStack(), project = makeProject(), plan = makePlan({ projectId: project.id });
	expectOk(await stack.projects.save(project, 'absent')); expectOk(await stack.plans.save(plan, 'absent'));
	const zone = makeZone({ projectId: project.id, planId: plan.id, color: '#3a7bd5' });
	expectOk(await stack.zones.save(zone, 'absent'));
	const loaded = expectFound(await stack.zones.getById(zone.id));
	expect(loaded.entity.color).toBe('#3a7bd5');
	expectOk(await stack.zones.save(expectOk(loaded.entity.withName('Kitchen')).withLocked(true), loaded.version));
	expect(expectFound(await stack.zones.getById(zone.id)).entity.color).toBe('#3a7bd5');
	const sidecar = new ObsidianPlanGeometrySidecar(stack.store), read = expectOk(await sidecar.read(plan.id));
	expect(read.document.objects.find(object => object.id === zone.id)?.color).toBe('#3a7bd5');
	expectOk(await sidecar.write(plan.id, read.document, read.version));
	expect(expectFound(await stack.zones.getById(zone.id)).entity.color).toBe('#3a7bd5');
	expect(expectOk(await stack.store.read(plan.id)).dto.schemaVersion).toBe(15);
});
```

- [ ] **Step 2: Run and watch them fail** — `npm run check:fast -- tests/infrastructure/persistence/mappers/mappers.test.ts tests/infrastructure/obsidian/repositories/digest.test.ts tests/infrastructure/obsidian/repositories/zoneColorPersistence.test.ts`. Expected: FAIL (`withColor` missing; colour dropped on save).

- [ ] **Step 3: The zone entity** — in `Zone.ts` import `{ isItemColor, type ItemColor } from '../spatial/ItemColor'`. Add to `CreateZoneProps`:

```ts
	/** User appearance on the canvas (plan colours design §1). Absent or null is the host's default. */
	readonly color?: ItemColor | null;
```

Add `readonly color: ItemColor | null;` to `ZoneFields` and to the class, assign it in the constructor, return it from `fields()`, set `color: props.color ?? null` in `create`, and refuse a bad value in `create` directly after the status check:

```ts
		if (props.color != null && !isItemColor(props.color)) {
			return err(zoneError('unknown-color', `"${String(props.color)}" is not a color.`));
		}
```

Add after `withLabelOffset`:

```ts
	/** Recolour, or `null` for the host's default drawing; the type admits only a valid colour. */
	withColor(color: ItemColor | null): Zone {
		return new Zone({ ...this.fields(), color });
	}
```

- [ ] **Step 4: Every place a zone entry is built or read** — `grep "type: 'polygon'" src` lists the three builders; each gets the colour:
  - `zoneMapper.ts`: import `SpatialObjectGeometrySchemaV15` (drop V10); `zoneToGeometryEntry` adds `...(zone.color ? { color: zone.color } : {}),` after `labelOffset`; `zoneFromPersistence` parses with V15 and passes `color: entry.color ?? null,` to `Zone.create`.
  - `ObsidianPlanGeometrySidecar.ts`: in BOTH the `read` and the `write` object maps add `...(object.color ? { color: object.color } : {}),` after the `labelOffset` line.
  - `zoneGeometryVersions.ts`: widen the parameter to `CurvedPolygon & { readonly labelOffset?: Vector; readonly color?: ItemColor }`, add `...(geometry.color ? { color: geometry.color } : {})` to `entry`, and make `versionFor` carry the next colour:

```ts
	return ok({ zone: { entity: entity.value, version: zoneVersion(raw, entry) }, versionFor: next => {
		const changed = entity.value.withGeometry(next);
		return changed.ok ? ok(zoneVersion(raw, zoneToGeometryEntry(changed.value.withColor(next.color ?? null)))) : changed;
	} });
```

  - `ObsidianZoneRepository.ts`: import and use `SpatialObjectGeometrySchemaV15` in the pre-write check.
  - `digest.ts`: import `SpatialObjectGeometrySchemaV15`; `const ENTRY_KEYS = [...Object.keys(SpatialObjectGeometrySchemaV15.shape), 'dx', 'dy'];` (an absent key serialises identically, so no uncoloured zone's version changes).
  - `planGeometry.ts`: remove `export` from `SpatialObjectGeometrySchemaV10` — nothing imports it any more and fallow reports an unused export.
  - `PlanGeometrySidecar.ts`: `SpatialObjectGeometry` gains `/** User appearance (plan colours design §1); absent while Default. */ readonly color?: ItemColor;` with `import type { ItemColor } from '../../domain/spatial/ItemColor';`.
  - `ZoneRepository.ts`: `versionFor(geometry: CurvedPolygon & { readonly color?: ItemColor })`; `prepareGeometryVersions?(id: ZoneId, geometry: CurvedPolygon & { readonly labelOffset?: Vector; readonly color?: ItemColor })`.
  - `PlanDto.ts`: `ZoneDto` gains `/** User appearance (plan colours design §1); present only while set. */ readonly color?: ItemColor;`; `toZoneDto` adds `...(zone.color ? { color: zone.color } : {}),` after `labelOffset`.

- [ ] **Step 5: Run to green** — `npm run check:fast -- tests/infrastructure tests/domain tests/application tests/presentation/read-models`. Expected PASS. `npx eslint` on every changed file.

- [ ] **Step 6: Commit**

```bash
git add src/domain/zone src/infrastructure src/application/ports src/presentation/read-models tests/infrastructure
git commit -m "feat(colors): a room keeps its colour through rename, lock and sidecar writes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: History sees a colour change

**Files:**
- Modify: `src/application/commands/spatial/sameGeometryDocument.ts:13-15,25`
- Modify: `src/application/commands/spatial/GroupGeometryCommand.ts:37`
- Create: `tests/application/commands/itemColorGeometry.test.ts`

**Interfaces:**
- Consumes: `color` on walls, openings, objects and zones (Tasks 1–3).
- Produces: `sameGeometryDocument` compares `color` on walls, openings and objects; `GroupGeometryCommand` records a zone receipt for a colour-only change.

- [ ] **Step 1: Write the failing tests** — create `tests/application/commands/itemColorGeometry.test.ts` (the setup is `groupGeometry.test.ts`'s own, without the group):

```ts
import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';

const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
async function setup() {
	const rig = await structureStack();
	expectOk(await rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: { ...WALL_LOOP, openings: [door] }, ledger: rig.ledger, room: rig.room }).execute());
	const roomId = expectDefined(rig.room.createdZoneId, 'created Room') as ZoneId;
	return { ...rig, roomId, groups: groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events) };
}

it('sees a colour change on a wall, an opening and a room entry', () => {
	const room = { id: 'zone-a', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
	const document = { calibration: null, objects: [room], structure: { ...WALL_LOOP, openings: [door] } };
	const walls = WALL_LOOP.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall);
	expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, walls } })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, openings: [{ ...door, color: '#3a7bd5' as const }] } })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, objects: [{ ...room, color: 'amber' as const }] })).toBe(false);
	expect(sameGeometryDocument(document, { ...document, objects: [{ ...room }] })).toBe(true);
});

it('records a recoloured room, so the zone edits around it still undo in order', async () => {
	const rig = await setup();
	const move = async (dx: number) => {
		const room = expectFound(await rig.stack.zones.getById(rig.roomId));
		const points = room.entity.geometry.points.map(point => ({ x: point.x + dx, y: point.y }));
		const command = new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events), rig.ledger, rig.roomId, { points }, room.entity.geometry);
		expectOk(await command.execute()); return command;
	};
	const original = expectFound(await rig.stack.zones.getById(rig.roomId)).entity.geometry;
	const first = await move(20);
	const baseline = expectOk(await rig.groups.read(rig.plan.id));
	const objects = baseline.document.objects.map(object => object.id === rig.roomId ? { ...object, color: 'rose' as const } : object);
	const recolor = rig.groups.command({ planId: rig.plan.id, baseline, document: { ...baseline.document, objects }, ledger: rig.ledger });
	expectOk(await recolor.execute());
	expect(expectFound(await rig.stack.zones.getById(rig.roomId)).entity.color).toBe('rose');
	const later = await move(30);
	expect(expectFound(await rig.stack.zones.getById(rig.roomId)).entity.color).toBe('rose');
	expectOk(await later.undo()); expectOk(await recolor.undo()); expectOk(await first.undo());
	const restored = expectFound(await rig.stack.zones.getById(rig.roomId)).entity;
	expect(restored.color).toBeNull(); expect(restored.geometry).toEqual(original);
});
```

- [ ] **Step 2: Run and watch both fail** — `npm run check:fast -- tests/application/commands/itemColorGeometry.test.ts`. Expected: the equality case FAILS (colour ignored), and the history case FAILS on an `undo.superseded` in the undo chain (the recolour wrote a zone version the ledger never recorded). If the history case passes before Step 3, stop and report — the receipt change would then be unproven.

- [ ] **Step 3: Compare the colour** — in `sameGeometryDocument.ts` add `wall.color ?? null` as the last tuple member of each wall, `opening.color ?? null` after the swing tuple of each opening, and `object.color ?? null` after `offset(object.labelOffset)` in `content`. In `GroupGeometryCommand.ts` line 37 compare the colour too:

```ts
		if (!next || JSON.stringify({ points: object.points, bulges: object.bulges, color: object.color }) === JSON.stringify({ points: next.points, bulges: next.bulges, color: next.color })) continue;
```

- [ ] **Step 4: Run to green** — `npm run check:fast -- tests/application tests/infrastructure/obsidian/repositories`. Expected PASS. `npx eslint src/application/commands/spatial`.

- [ ] **Step 5: Commit**

```bash
git add src/application/commands/spatial tests/application/commands/itemColorGeometry.test.ts
git commit -m "feat(colors): undo and group writes see a colour change on walls, openings and rooms

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: One recolour action, and the custom picker for items

**Files:**
- Create: `src/presentation/editor/groups/recoloredDocument.ts`
- Modify: `src/presentation/editor/groups/groupActions.ts` (imports, new `setColor`, return object)
- Modify: `src/presentation/editor/groups/groupSnapshot.ts:20` (projection carries a room's colour)
- Modify: `src/presentation/editor/elements/elementActions.ts` (delete `recolored`, `setColor`, their imports and the `setColor` return key)
- Create: `src/presentation/editor/elements/itemColorTargets.ts`
- Create: `src/presentation/editor/elements/ItemColorCustom.vue`
- Modify: `src/presentation/editor/elements/ItemColorControl.vue` (script and template)
- Modify: `src/presentation/i18n/locales/en/itemColor.ts`, `src/presentation/i18n/locales/de/itemColor.ts`
- Modify: `styles/editor-item-color.css`
- Create: `tests/presentation/editor/groups/recoloredDocument.test.ts`
- Modify: `tests/presentation/editor/itemColors.test.ts` (route every call through `groupActions`, add three cases)

**Interfaces:**
- Consumes: Tasks 1–4; `createGroupOperations`' `capture(ids, single)` and `commit(snapshot, next)`; `snapshot.selectionIds`.
- Produces: `recoloredDocument(document: PlanGeometryDocument, ids: readonly string[], color: ItemColor | undefined): PlanGeometryDocument`; `runtime.groupActions.setColor(ids: readonly string[], color: ItemColor | undefined): Promise<void>`; `interface ColorTarget { readonly id: string; readonly color?: ItemColor }`; `interface ColorSources { readonly zones: ReadonlyMap<string, ColorTarget>; readonly structure: Structure }`; `colorTargets(sources: ColorSources, ids: readonly string[]): readonly ColorTarget[]`; `itemColorLabel(color: ItemColor | undefined): string`; `ItemColorCustom.vue` props `{ color?: ItemColor; disabled: boolean }`, emits `choose: [color: ItemColor]`. i18n keys `editor.item-color.custom`, `editor.item-color.custom-value` (`{value}`).

- [ ] **Step 1: Write the failing pure test** — `tests/presentation/editor/groups/recoloredDocument.test.ts`:

```ts
import { expect, it } from 'vitest';
import { recoloredDocument } from '../../../../src/presentation/editor/groups/recoloredDocument';
import { WALL_LOOP } from '../../../helpers/structure';

it('sets and removes one colour on exactly the named rooms, walls, openings and elements', () => {
	const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
	const path = { id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 900, y: 0 }], color: 'blue' as const };
	const room = { id: 'zone-a', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
	const document = { calibration: null, objects: [room], structure: { ...WALL_LOOP, openings: [door], elements: [path] }, intended: { ...WALL_LOOP } };
	const painted = recoloredDocument(document, ['zone-a', 'wall-a', 'element-path'], '#3a7bd5');
	expect(painted.objects[0].color).toBe('#3a7bd5');
	expect(painted.structure?.walls[0].color).toBe('#3a7bd5'); expect(painted.structure?.walls[1]).not.toHaveProperty('color');
	expect(painted.structure?.openings[0]).not.toHaveProperty('color');
	expect(painted.structure?.elements?.[0].color).toBe('#3a7bd5');
	expect(painted.intended).toBe(document.intended);
	const reset = recoloredDocument(painted, ['element-path', 'zone-a'], undefined);
	expect(reset.structure?.elements?.[0]).not.toHaveProperty('color'); expect(reset.objects[0]).not.toHaveProperty('color');
	expect(recoloredDocument(document, ['opening-door'], 'rose').structure?.openings[0].color).toBe('rose');
});
```

- [ ] **Step 2: Rewrite the editor test's calls and add the new cases** in `tests/presentation/editor/itemColors.test.ts`:
  - Every `rig.runtime.elementActions.setColor(id, color)` becomes `rig.runtime.groupActions.setColor([id], color)`; every `rig.runtime.elementActions.active` becomes `rig.runtime.groupActions.active`; the first case's spy is `vi.spyOn(rig.runtime.groupActions, 'setColor')` and expects `toHaveBeenCalledWith([item.id], 'blue')` / `toHaveBeenLastCalledWith([item.id], undefined)`.
  - The read race (`rejects a %s change during its asynchronous read…`) and the peer case (`keeps a peer color change…`) spy on the GROUP services instead: `const groups = expectDefined(rig.deps.commands.groups, 'group services');`, `const baseline = await groups.read(rig.plan.id)`, `vi.spyOn(groups, 'read').mockReturnValueOnce(waiting.promise)` and `vi.spyOn(groups, 'command')`. Import `expectDefined` from `../../helpers/domain`.
  - Replace `refuses groups/multiple selections without partially writing a member…` with:

```ts
it('recolours every selected member as one undo step and keeps the saved group', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { ...item, id: 'element-second', name: 'Second' }), rig.runtime.structureTask.ledger)));
	const grouped = expectOk(await rig.geometry.read(rig.plan.id));
	const groups = [{ id: 'group-cabinets', name: 'Cabinets', memberIds: [item.id, 'element-second'] }];
	expectOk(await rig.geometry.write(rig.plan.id, { ...grouped.document, groups }, grouped.version));
	await rig.runtime.refreshProjection();
	rig.selection.select([item.id, 'element-second'] as never); await settle();
	await rig.runtime.groupActions.setColor([item.id, 'element-second'], 'green');
	const colors = () => rig.project.structure.elements?.map(element => element.color);
	expect(colors()).toEqual(['green', 'green']);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual(groups);
	await rig.runtime.undo(); await settle(); expect(colors()).toEqual([undefined, undefined]);
});
```

  - Replace `does not recolor a path, room or wall at the action boundary` with:

```ts
it('recolours a path, a room and a wall at the action, and a wall without its hosted door', async () => {
	const rig = await setup({ id: 'element-path', kind: 'path', name: 'Path', points: item.points.slice(0, 2) });
	const wall = rig.project.structure.walls[0].id, room = rig.room.id;
	const read = expectOk(await rig.geometry.read(rig.plan.id)), current = read.document.structure;
	if (!current) throw new Error('Expected a structure');
	const door = { id: 'opening-door', kind: 'door' as const, hostId: wall, offset: 500, width: 800, height: 2100, sill: 0 };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...current, openings: [door] } }, read.version));
	await rig.runtime.refreshProjection();
	// The room goes second, so the wall's write proves the projection carries the room's colour (no stale refusal).
	for (const id of ['element-path', room, wall]) { rig.selection.select([id as never]); await settle(); await rig.runtime.groupActions.setColor([id], '#3a7bd5'); }
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(saved.structure?.elements?.find(element => element.id === 'element-path')?.color).toBe('#3a7bd5');
	expect(saved.objects.find(object => object.id === room)?.color).toBe('#3a7bd5');
	expect(saved.structure?.walls.find(candidate => candidate.id === wall)?.color).toBe('#3a7bd5');
	expect(saved.structure?.openings[0]).not.toHaveProperty('color');
	expect(rig.project.zones.get(room)?.color).toBe('#3a7bd5');
});
```

  - Add:

```ts
it('commits a custom colour from Details on change, never on input, and names the hex', async () => {
	const rig = await setup(), picker = rig.wrapper.get<HTMLInputElement>('.rp-element-inspector input[type="color"]');
	picker.element.value = '#3a7bd5'; await picker.trigger('input'); await settle();
	expect(colorOf(rig)).toBeUndefined();
	await picker.trigger('change'); await settleUntil(() => colorOf(rig) === '#3a7bd5', 'custom colour');
	expect(rig.wrapper.get('.rp-element-inspector .rp-item-color').text()).toContain('Color · #3a7bd5');
	expect(rig.wrapper.get('.rp-element-inspector input[type="color"]').attributes('aria-label')).toBe('Custom color #3a7bd5');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(15);
	await menu(rig); expect(rig.wrapper.find('.rp-canvas-context-menu input[type="color"]').exists()).toBe(false);
});
```

- [ ] **Step 3: Run and watch them fail** — `npm run check:fast -- tests/presentation/editor/groups/recoloredDocument.test.ts tests/presentation/editor/itemColors.test.ts`. Expected: FAIL (`recoloredDocument` missing; `groupActions.setColor` undefined).

- [ ] **Step 4: The pure recolour** — `src/presentation/editor/groups/recoloredDocument.ts`:

```ts
import type { PlanGeometryDocument } from '../../../application/ports/PlanGeometrySidecar';
import type { ItemColor } from '../../../domain/spatial/ItemColor';
import type { Structure } from '../../../domain/spatial/Structure';

/** Set one colour, or physically remove it for Default, on the named items only. */
function painted<T extends { readonly id: string; readonly color?: ItemColor }>(items: readonly T[], ids: ReadonlySet<string>, color: ItemColor | undefined): T[] {
	return items.map(item => {
		if (!ids.has(item.id)) return item;
		const { color: previous, ...plain } = item;
		void previous;
		return (color === undefined ? plain : { ...plain, color }) as T;
	});
}
/**
 * The current plan with one colour on exactly `ids` — a wall's hosted opening only when it is named
 * itself — and the proposed (intended) structure untouched (plan colours design §3).
 */
export function recoloredDocument(document: PlanGeometryDocument, ids: readonly string[], color: ItemColor | undefined): PlanGeometryDocument {
	const targets = new Set(ids), structure: Structure | undefined = document.structure;
	return { ...document, objects: painted(document.objects, targets, color),
		...(structure ? { structure: { ...structure, walls: painted(structure.walls, targets, color), openings: painted(structure.openings, targets, color),
			...(structure.elements ? { elements: painted(structure.elements, targets, color) } : {}) } } : {}) };
}
```

- [ ] **Step 5: The action and the projection** — in `groupActions.ts` add imports `import { isItemColor, type ItemColor } from '../../../domain/spatial/ItemColor';` and `import { recoloredDocument } from './recoloredDocument';`, add after `moveBy`:

```ts
	/** One colour on every id, as one conditional sidecar write and one undo step; Plan only (plan colours design §3). */
	async function setColor(ids: readonly string[], color: ItemColor | undefined): Promise<void> {
		if (session.perspective !== 'plan' || (color !== undefined && !isItemColor(color))) return;
		const snapshot = operations.capture(ids, ids.length === 1); if (!snapshot) return;
		await operations.commit(snapshot, recoloredDocument(snapshot.document, snapshot.selectionIds, color));
	}
```

and add `setColor` to the returned object (after `moveBy`). In `groupSnapshot.ts`'s `projectedGroupGeometry`, the object map adds `...(zone.color ? { color: zone.color } : {})` after `labelOffset` — without it every group operation on a coloured room is refused as stale. In `elementActions.ts` delete `recolored`, `setColor`, the `ItemColor` import and `setColor` from the return object; `grep -rn "elementActions.setColor\|elementActions, 'setColor'" src tests` must print nothing.

- [ ] **Step 6: The targets helper** — `src/presentation/editor/elements/itemColorTargets.ts`:

```ts
import { isItemColorPreset, type ItemColor } from '../../../domain/spatial/ItemColor';
import type { Structure } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';

export interface ColorTarget { readonly id: string; readonly color?: ItemColor }
export interface ColorSources { readonly zones: ReadonlyMap<string, ColorTarget>; readonly structure: Structure }
/** What the palette recolours for this selection: one selected item or placement, else nothing. */
export function colorTargets(sources: ColorSources, ids: readonly string[]): readonly ColorTarget[] {
	const element = ids.length === 1 ? sources.structure.elements?.find(item => item.id === ids[0]) : undefined;
	return element && (element.kind === 'object' || element.kind === 'asset') ? [element] : [];
}
/** The palette's value line: a preset's name, a custom hex as saved, or Default. */
export function itemColorLabel(color: ItemColor | undefined): string {
	if (color === undefined) return tr('editor.item-color.default');
	return isItemColorPreset(color) ? tr(`editor.item-color.${color}`) : color;
}
```

- [ ] **Step 7: The custom picker** — `src/presentation/editor/elements/ItemColorCustom.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { isHexColor, type ItemColor } from '../../../domain/spatial/ItemColor';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { itemColorRgb } from './itemColorAppearance';
const props = defineProps<{ color?: ItemColor; disabled: boolean }>();
const emit = defineEmits<{ choose: [color: ItemColor] }>();
const custom = computed(() => isHexColor(props.color));
/** The native input needs a `#rrggbb`: the saved colour's sample, or a neutral grey to start from. */
const value = computed(() => props.color === undefined ? '#808080' : itemColorRgb(props.color));
const label = computed(() => custom.value ? tr('editor.item-color.custom-value', { value: String(props.color) }) : tr('editor.item-color.custom'));
/** `change`, never `input`: a drag through the OS picker is one write (plan colours design §3). */
function change(event: Event): void {
	const next = (event.target as HTMLInputElement).value.toLowerCase();
	if (!props.disabled && isHexColor(next)) emit('choose', next);
}
</script>
<template>
	<span
		class="rp-item-color__custom"
		:title="disabled ? tr('editor.input.unavailable') : label"
	>
		<input
			type="color"
			data-rp-item-color="custom"
			:value="value"
			:aria-label="label"
			:aria-disabled="disabled"
			@change="change"
		>
		<HostIcon
			v-if="custom"
			class="rp-item-color__check"
			name="circle-check"
		/>
	</span>
</template>
```

(The lint hook runs ESLint on a `.vue`; follow whatever `vue/html-self-closing` says about the `<input>`.)

- [ ] **Step 8: The control** — `ItemColorControl.vue`'s script becomes:

```ts
import { computed } from 'vue';
import { ITEM_COLORS, type ItemColor, type ItemColorPreset } from '../../../domain/spatial/ItemColor';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import ItemColorSwatch from './ItemColorSwatch.vue';
import ItemColorCustom from './ItemColorCustom.vue';
import { colorTargets, itemColorLabel } from './itemColorTargets';

defineProps<{ menu?: boolean }>();
const emit = defineEmits<{ picked: [] }>();
const project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession(), runtime = useEditorRuntime();
const targets = computed(() => colorTargets(project, selection.selectedIds));
const visible = computed(() => session.perspective === 'plan' && targets.value.length > 0);
const disabled = computed(() => runtime.groupActions.blocked.value || runtime.groupActions.active.value);
const current = computed(() => targets.value[0]?.color);
const presets: readonly (ItemColorPreset | undefined)[] = [undefined, ...ITEM_COLORS];
function choose(color: ItemColor | undefined): void {
	if (!visible.value || disabled.value) return;
	void runtime.groupActions.setColor(targets.value.map(target => target.id), color);
	emit('picked');
}
```

keeping the existing `key` function unchanged. In the template: `:aria-busy="runtime.groupActions.active.value"`; the value line reads `{{ tr('editor.item-color.label') }} · {{ itemColorLabel(current) }}`; the swatch loop iterates `presets` with `:selected="current === color"`; after the loop, inside `.rp-item-color__choices`:

```vue
			<ItemColorCustom
				v-if="!menu"
				:color="current"
				:disabled="disabled"
				@choose="choose"
			/>
```

- [ ] **Step 9: Strings and styles** — `en/itemColor.ts` adds `'editor.item-color.custom': 'Custom color',` and `'editor.item-color.custom-value': 'Custom color {value}',`; `de/itemColor.ts` adds `'editor.item-color.custom': 'Eigene Farbe',` and `'editor.item-color.custom-value': 'Eigene Farbe {value}',`. `styles/editor-item-color.css` adds (host tokens only):

```css
.renovation-plan-editor .rp-item-color__custom { position: relative; display: flex; justify-content: center; align-items: center; width: 36px; min-width: 36px; height: 40px; border-radius: var(--radius-s); }
.renovation-plan-editor .rp-item-color__custom input[type='color'] { width: 24px; height: 20px; padding: 0; background: transparent; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s); cursor: pointer; }
.renovation-plan-editor .rp-item-color__custom input[type='color']:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
.renovation-plan-editor .rp-item-color__custom input[aria-disabled='true'] { opacity: var(--rp-item-color-disabled-opacity); cursor: not-allowed; }
```

and both 44 px rules (`@container (max-width: 899px)` and `@media (pointer: coarse)`) list `.renovation-plan-editor .rp-item-color__custom` beside the button selector.

- [ ] **Step 10: Run to green** — `npm run check:fast -- tests/presentation/editor tests/build/prototype-styles.test.ts tests/presentation/i18n`. Expected PASS. `npx eslint src/presentation/editor/groups src/presentation/editor/elements src/presentation/i18n`. `npm run build` (the stylesheet colour check runs there).

- [ ] **Step 11: Commit, push, open the pull request (phase 1 checkpoint)**

```bash
git add src/presentation styles tests/presentation
git commit -m "feat(colors): one undoable recolour action and a custom colour picker in Details

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin HEAD
```

Open the PR (title "Plan editor: colour every item, with a colour picker"; body lists the phases and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Continue with Task 6 only once CI's `verify` legs are green.

---

### Task 6: Every element kind draws its colour

**Files:**
- Modify: `src/presentation/editor/elements/ElementShapes.vue:10,32`
- Modify: `src/presentation/editor/elements/ElementShape.vue:31-46`
- Modify: `src/presentation/editor/elements/StairShape.vue:6,14`
- Modify: `src/presentation/editor/elements/DirectionArrowShape.vue:6-7`
- Modify: `src/presentation/editor/elements/StructuralShape.vue:9`
- Modify: `src/presentation/editor/elements/DraftingShape.vue:8-10,21`
- Create: `tests/presentation/editor/itemColorRendering.test.ts`

**Interfaces:**
- Consumes: `itemColorInk`, `itemColorTint` (Task 1).
- Produces: `StairShape` and `DirectionArrowShape` take an optional `color?: ItemColor` prop.

- [ ] **Step 1: Write the failing test** — `tests/presentation/editor/itemColorRendering.test.ts` (mounted standalone, the way `structuralShape.test.ts` mounts one shape):

```ts
// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { defineComponent, type PropType } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import Konva from 'konva';
import ElementShapes from '../../../src/presentation/editor/elements/ElementShapes.vue';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { postOutline } from '../../../src/domain/spatial/structuralElement';
import { THEME_TOKENS, type ThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { backingCanvas, installCanvas } from '../../helpers/canvas';
import { expectDefined } from '../../helpers/domain';

// Distinct per-token strings, with one real background so a tint is computable.
const tokens = { ...Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, 'token-' + key])), canvasBackground: '#ffffff' } as unknown as ThemeTokens;
const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });
function draw(elements: readonly NamedSpatialElement[], selectedIds: readonly string[] = []) {
	installCanvas();
	const host = defineComponent({
		components: { ElementShapes },
		props: { elements: { type: Array as PropType<readonly NamedSpatialElement[]>, required: true }, selectedIds: { type: Array as PropType<readonly string[]>, required: true } },
		setup: () => ({ tokens }),
		template: '<v-stage :config="{width:600,height:600}"><v-layer><ElementShapes :elements="elements" :selected-ids="selectedIds" :tokens="tokens" :zoom="1" /></v-layer></v-stage>',
	});
	mounted.push(mount(host, { props: { elements, selectedIds }, global: { plugins: [VueKonva] } }));
	return expectDefined(Konva.stages.at(-1), 'element stage');
}
const node = <T extends Konva.Node>(stage: Konva.Stage, selector: string): T => expectDefined(stage.findOne<T>(selector), selector);
const firstLine = (stage: Konva.Stage, group: string) => expectDefined(node<Konva.Group>(stage, group).findOne<Konva.Line>('Line'), group + ' line');
const line = [{ x: 0, y: 0 }, { x: 1000, y: 0 }];
const post = (color: 'green', loadBearing: boolean): NamedSpatialElement => ({ id: 'element-post', kind: 'post', name: 'Post', loadBearing, points: postOutline({ x: 1000, y: 1000 }, 140, 140), color });

it('tints closed fills and inks lines, keeping closed outlines on the theme token', () => {
	const stage = draw([
		{ id: 'element-item', kind: 'object', name: 'Item', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }], color: 'blue' },
		{ id: 'element-path', kind: 'path', name: 'Path', points: line, color: '#3a7bd5' },
		{ id: 'element-stair', kind: 'stair', name: 'Stair', points: line, stair: { width: 900, treads: 12, direction: 'up' }, color: 'blue' },
		{ id: 'element-arrow', kind: 'arrow', name: 'Arrow', points: line, color: 'rose' },
	]);
	expect(firstLine(stage, '.element-object').fill()).toBe('rgb(206, 223, 241)');
	expect(firstLine(stage, '.element-object').stroke()).toBe(tokens.zoneStroke);
	expect(firstLine(stage, '.element-path').stroke()).toBe('#3a7bd5');
	expect(node<Konva.Line>(stage, '.stair-outline').fill()).toBe('rgb(206, 223, 241)');
	expect(node<Konva.Line>(stage, '.stair-outline').stroke()).toBe(tokens.zoneStroke);
	expect(node<Konva.Arrow>(stage, '.direction-arrow').stroke()).toBe('#ce6682');
});

it('inks structural and drafting marks, fills a load-bearing post in its ink, and grounds a hatch on its tint', () => {
	const stage = draw([
		post('green', true),
		{ id: 'element-beam', kind: 'beam', name: 'Beam', loadBearing: false, width: 160, points: line, color: 'amber' },
		{ id: 'element-text', kind: 'text', name: 'Note', points: [{ x: 200, y: 200 }], color: 'violet' },
		{ id: 'element-hatch', kind: 'hatch', name: 'Hatch', points: [{ x: 0, y: 2000 }, { x: 900, y: 2000 }, { x: 900, y: 2600 }], color: 'rose' },
	]);
	expect(node<Konva.Line>(stage, '.post-outline').fill()).toBe('#54976d');
	expect(node<Konva.Line>(stage, '.post-outline').stroke()).toBe('#54976d');
	expect(node<Konva.Line>(stage, '.beam-edge').stroke()).toBe('#d69b32');
	expect(node<Konva.Text>(stage, '.drafting-text').fill()).toBe('#956bc4');
	const hatch = node<Konva.Line>(stage, '.drafting-hatch');
	expect(hatch.stroke()).toBe(tokens.zoneStroke);
	// (6, 1) lies 3.5 px from both stone diagonals, so it is pure ground: rose tinted over white.
	expect([...(backingCanvas(hatch.fillPatternImage() as HTMLCanvasElement)?.getContext('2d').getImageData(6, 1, 1, 1).data ?? [])]).toEqual([241, 212, 220, 255]);
});

it('gives way to the accent while selected, and keeps fills', () => {
	const stage = draw([{ id: 'element-path', kind: 'path', name: 'Path', points: line, color: '#3a7bd5' }, post('green', false)], ['element-path', 'element-post']);
	expect(firstLine(stage, '.element-path').stroke()).toBe(tokens.accent);
	expect(node<Konva.Line>(stage, '.post-outline').stroke()).toBe(tokens.accent);
	expect(node<Konva.Line>(stage, '.post-outline').fill()).toBe('#ffffff');
});
```

- [ ] **Step 2: Run and watch it fail** — `npm run check:fast -- tests/presentation/editor/itemColorRendering.test.ts`. Expected: FAIL on every ink and on the stair and hatch fills.

- [ ] **Step 3: Implement.**
  - `ElementShapes.vue`: import `itemColorInk` beside `itemColorTint`; line 32 becomes

```ts
	const zoom = props.zoom, tokens = props.tokens, ink = closed ? undefined : element.color, stroke = selected ? tokens.accent : itemColorInk(ink, tokens.zoneStroke), label = elementLabelLayout(element, zoom);
```

  - `ElementShape.vue`: add `:color="shape.element.color"` to `<StairShape>` and to `<DirectionArrowShape>`.
  - `StairShape.vue`: import `type ItemColor` and `itemColorTint`; props gain `color?: ItemColor`; add `const fill = computed(() => itemColorTint(props.color, props.tokens.canvasBackground));`; the outline config uses `fill` instead of `tokens.canvasBackground`.
  - `DirectionArrowShape.vue`: import `type ItemColor` and `itemColorInk`; props gain `color?: ItemColor`; `const stroke = computed(() => props.selected ? props.tokens.accent : itemColorInk(props.color, props.tokens.zoneStroke));` (its endpoint handles draw only while selected, so they stay accent).
  - `StructuralShape.vue`: import `itemColorInk`; `const stroke = computed(() => props.selected ? props.tokens.accent : itemColorInk(props.element.color, props.tokens.zoneStroke));` — the load-bearing fill already reads `stroke`, so solid still means load-bearing.
  - `DraftingShape.vue`: import `itemColorInk, itemColorTint`; replace lines 8-10 with

```ts
/** A hatch keeps its outline on the theme ink; every other mark draws in its colour (plan colours design §2). */
const ink = computed(() => props.element.kind === 'hatch' ? undefined : props.element.color);
const stroke = computed(() => props.selected ? props.tokens.accent : itemColorInk(ink.value, props.tokens.zoneStroke));
/** The cross-hatch is the stone tile's two diagonals in theme colours, on the mark's tint when it has one (plan drafting tools design §6). */
const tile = computed(() => props.element.kind === 'hatch' ? patternTile('stone', props.tokens.zoneStroke, itemColorTint(props.element.color, props.tokens.canvasBackground)) : null);
```

  and the texts' fill becomes `props.selected ? props.tokens.accent : itemColorInk(props.element.color, props.tokens.zoneLabel)`.

- [ ] **Step 4: Run to green** — `npm run check:fast -- tests/presentation/editor`. Expected PASS (the uncoloured pins in `structuralShape.test.ts`, `draftingMarks.test.ts` and `assetShapeConfig.test.ts` are unchanged). `npx eslint src/presentation/editor/elements`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/elements tests/presentation/editor/itemColorRendering.test.ts
git commit -m "feat(colors): every element kind draws its colour as a tint or an ink

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Walls and openings draw their colour

**Files:**
- Modify: `src/presentation/editor/structure/StructureLayer.vue:49-54,158-162` (and the per-wall pass sentence of the template comment)
- Modify: `src/presentation/editor/structure/OpeningSymbols.vue:15`
- Create: `tests/presentation/editor/structure/wallColorPass.test.ts`

**Interfaces:**
- Consumes: `itemColorTint`, `itemColorInk` (Task 1); `Wall.color`, `Opening.color`.
- Produces: per-wall nodes named `wall-pattern` (a patterned wall, its tile ground tinted) or `wall-color` (an unpatterned coloured wall, a solid tinted body). The chained edge/body passes are unchanged: the per-wall pass paints over them, exactly as the pattern pass already did.

- [ ] **Step 1: Write the failing test** — `tests/presentation/editor/structure/wallColorPass.test.ts`:

```ts
// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { expectDefined, expectOk } from '../../../helpers/domain';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => {
	for (const rig of mounted.splice(0)) rig.unmount();
	document.documentElement.style.removeProperty('--background-secondary');
});

it('paints a coloured wall body as a tint over the wall fill and inks a coloured opening, leaving the rest', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	document.documentElement.style.setProperty('--background-secondary', 'rgb(255, 255, 255)');
	rig.changeTheme(); await settle();
	const read = expectOk(await rig.geometry.read(rig.plan.id)), current = expectDefined(read.document.structure, 'structure');
	const walls = current.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall);
	const openings = [{ id: 'opening-door', kind: 'door' as const, hostId: walls[0].id, offset: 500, width: 800, height: 2100, sill: 0, color: 'blue' as const }];
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...current, walls, openings } }, read.version));
	await rig.runtime.refreshProjection();
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	await settleUntil(() => layer.find('.wall-color').length === 1, 'coloured wall pass');
	const painted = layer.findOne<Konva.Line>('.wall-color') as Konva.Line;
	expect(painted.fill()).toBe('rgb(241, 212, 220)');
	const lines = layer.find<Konva.Shape>('Line');
	expect(lines.indexOf(painted)).toBeGreaterThan(Math.max(...layer.find('.wall-body').map(item => lines.indexOf(item as Konva.Shape))));
	const door = expectDefined(layer.findOne<Konva.Group>('.opening-door'), 'door symbol');
	expect((door.getChildren()[1] as Konva.Line).stroke()).toBe('#518cce');
});
```

- [ ] **Step 2: Run and watch it fail** — `npm run check:fast -- tests/presentation/editor/structure/wallColorPass.test.ts`. Expected: FAIL — no `.wall-color` node; the frame stroke is the theme token.

- [ ] **Step 3: Implement the wall pass** — in `StructureLayer.vue` import `itemColorTint` from `../elements/itemColorAppearance` and replace the `tiles` and `patterned` computeds with:

```ts
/** A wall's own ground: its colour tinted over the wall fill, or the wall fill (plan colours design §2). */
const grounds = computed(() => new Map(structure.value.walls.map(wall => [wall.id, itemColorTint(wall.color, props.tokens.wallFill)])));
/** One tile per pattern AND ground, so a coloured patterned wall keeps its hatch on its own tint. */
const tiles = computed(() => {
	const cache = new Map<string, HTMLCanvasElement | null>();
	for (const wall of structure.value.walls) {
		const pattern = patterns.value.get(wall.id), ground = grounds.value.get(wall.id) ?? props.tokens.wallFill;
		if (pattern && !cache.has(`${pattern}|${ground}`)) cache.set(`${pattern}|${ground}`, patternTile(pattern, props.tokens.wallPattern, ground));
	}
	return cache;
});
const patterned = computed(() => structure.value.walls.flatMap(wall => {
	const pattern = patterns.value.get(wall.id), ground = grounds.value.get(wall.id) ?? props.tokens.wallFill;
	const tile = pattern ? tiles.value.get(`${pattern}|${ground}`) ?? null : null;
	if (!tile && wall.color === undefined) return [];
	const body = sideNetwork.value.bodies.find(item => item.id === wall.id)?.points ?? wallBodyPolygon(wall, 0.25 / props.zoom);
	const points = body.flatMap(point => [point.x, point.y]);
	return [tile
		? { id: wall.id, name: 'wall-pattern', points, paint: { fillPatternImage: tile, fillPatternRepeat: 'repeat', fillPatternScale: { x: 1 / props.zoom, y: 1 / props.zoom } } }
		: { id: wall.id, name: 'wall-color', points, paint: { fill: ground } }];
}));
```

and the per-wall `<VLine>` becomes:

```vue
		<VLine
			v-for="item in patterned"
			:key="item.name + '-' + item.id"
			:config="{ name: item.name, points: item.points, closed: true, listening: false, ...item.paint }"
		/>
```

In the template comment, the sentence starting "A third, per-WALL pass fills a patterned wall's body…" becomes: "A third, per-WALL pass fills a patterned wall's body with its material's hatch (ADR-0031) on the wall's own ground — its colour's tint when it has one — and an unpatterned coloured wall with that tint (ADR-0033). Per wall rather than per run, so the mitre wedge where two differently painted walls meet stays plain — the spec's named gap."

- [ ] **Step 4: Implement the opening ink** — `OpeningSymbols.vue`: import `itemColorInk`; line 15's `stroke` becomes `props.selectedIds.includes(opening.id) ? props.tokens.accent : itemColorInk(opening.color, props.tokens.zoneStroke)`. The cut keeps `canvasBackground`.

- [ ] **Step 5: Run to green** — `npm run check:fast -- tests/presentation/editor/structure tests/presentation/editor/structureLayerPasses.test.ts`. Expected PASS (`wallPatternPass.test.ts` still finds exactly one `.wall-pattern`). `npx eslint src/presentation/editor/structure`.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/structure tests/presentation/editor/structure/wallColorPass.test.ts
git commit -m "feat(colors): walls tint their body under the hatch and openings ink their symbol

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: A coloured room draws a translucent wash

**Files:**
- Modify: `src/presentation/editor/layers/zone/ZoneRenderModel.ts:22-55`
- Modify: `src/presentation/editor/layers/zone/ZoneShape.vue:37,75,115-119`
- Create: `tests/presentation/editor/zoneColorWash.test.ts`

**Interfaces:**
- Consumes: `ZoneDto.color` (Task 3), `itemColorRgb` (Task 1).
- Produces: `ZoneRenderModel.color?: ItemColor`.

- [ ] **Step 1: Write the failing test** — `tests/presentation/editor/zoneColorWash.test.ts`:

```ts
// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';

const rigs: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); });

it('washes a coloured room at rest and deepens it when selected, while an uncoloured room keeps no resting fill', async () => {
	const rig = await structureEditor(); rigs.push(rig);
	const colored = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, name: 'Kitchen', color: 'blue' });
	const plain = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, name: 'Hall', geometry: { points: [{ x: 5000, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 1000 }, { x: 5000, y: 1000 }] } });
	for (const zone of [colored, plain]) expectOk(await rig.stack.zones.save(zone, 'absent'));
	await rig.runtime.refreshProjection(); await settle();
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.zone'), 'zone layer');
	// A zone group's children are fill, outline, name, area, detail — `ZoneShape.vue`'s template order.
	const fill = (id: string) => expectDefined(layer.findOne<Konva.Group>(`.${id}`), id).getChildren()[0] as Konva.Line;
	expect(fill(colored.id).fill()).toBe('#518cce'); expect(fill(colored.id).opacity()).toBe(0.18);
	expect(fill(plain.id).opacity()).toBe(0);
	rig.selection.select([colored.id as never]); await settle();
	expect(fill(colored.id).opacity()).toBe(0.28);
});
```

- [ ] **Step 2: Run and watch it fail** — `npm run check:fast -- tests/presentation/editor/zoneColorWash.test.ts`. Expected: FAIL — the fill is the zone-type token at opacity 0.

- [ ] **Step 3: Implement** — `ZoneRenderModel.ts`: import `type ItemColor` from `../../../../domain/spatial/ItemColor`; the interface gains `/** User appearance (plan colours design §2): a wash at rest instead of M01's empty fill. */ readonly color?: ItemColor;`; `toZoneRenderModel` adds `...(zone.color ? { color: zone.color } : {}),` after `labelOffset`.

`ZoneShape.vue`: import `itemColorRgb` from `../../elements/itemColorAppearance`; line 75 becomes

```ts
const fill = computed(() => props.model.color === undefined ? props.tokens[zoneFillToken(props.model.zoneType)] : itemColorRgb(props.model.color));
```

and lines 115-119 become

```ts
// Invisible at rest and translucent when selected: M01 draws no resting fill. A coloured room keeps a
// light wash at rest so the colour is visible over an imported plan (plan colours design §2). The node
// stays MOUNTED at zero opacity because `ZoneLayer`'s paint order and `scene.test.ts`'s `flatPoints`
// identity case both rest on this group's child list keeping its shape.
const FILL_OPACITY = { plain: { rest: 0, selected: 0.12 }, colored: { rest: 0.18, selected: 0.28 } } as const;
const fillConfig = computed(() => ({ points: flatPoints.value, closed: true, fill: fill.value,
	opacity: FILL_OPACITY[props.model.color === undefined ? 'plain' : 'colored'][props.selected ? 'selected' : 'rest'], listening: false, perfectDrawEnabled: false }));
```

- [ ] **Step 4: Run to green** — `npm run check:fast -- tests/presentation/editor`. Expected PASS (`zoneOutlineEnclosure`, `zoneLayerOrder`, `scene` unchanged). `npx eslint src/presentation/editor/layers/zone`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/layers/zone tests/presentation/editor/zoneColorWash.test.ts
git commit -m "feat(colors): a coloured room draws a translucent wash at rest

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The palette for every family

**Files:**
- Modify: `src/presentation/editor/elements/itemColorTargets.ts` (`colorTargets`)
- Modify: `src/presentation/editor/structure/StructureInspector.vue` (import, mount after `<StructurePlanActions />`)
- Modify: `src/presentation/editor/shell/RoomInspector.vue` (import, mount directly after the facts `</dl>`)
- Create: `tests/presentation/editor/elements/itemColorTargets.test.ts`
- Modify: `tests/presentation/editor/itemColors.test.ts` (add one case)

**Interfaces:**
- Consumes: `ColorSources`, `ColorTarget`, `itemColorLabel` (Task 5).
- Produces: `colorTargets` answers one room, wall, opening or element of any kind for a single selected id.

- [ ] **Step 1: Write the failing tests** — `tests/presentation/editor/elements/itemColorTargets.test.ts`:

```ts
import { expect, it } from 'vitest';
import { colorTargets, itemColorLabel } from '../../../../src/presentation/editor/elements/itemColorTargets';
import { WALL_LOOP } from '../../../helpers/structure';

const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0 };
const structure = { ...WALL_LOOP, openings: [door], elements: [{ id: 'element-path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 900, y: 0 }], color: 'blue' as const }] };
const zones = new Map([['zone-a', { id: 'zone-a', color: '#3a7bd5' as const }]]);

it('finds one room, wall, opening or element of any kind, and nothing for an id it cannot colour', () => {
	for (const id of ['zone-a', 'wall-a', 'opening-door', 'element-path']) expect(colorTargets({ zones, structure }, [id]).map(target => target.id)).toEqual([id]);
	expect(colorTargets({ zones, structure }, ['reference-x'])).toEqual([]);
	expect(colorTargets({ zones, structure }, [])).toEqual([]);
});

it('labels a preset by name, a hex as saved and absence as Default', () => {
	expect(itemColorLabel('blue')).toBe('Blue'); expect(itemColorLabel('#3a7bd5')).toBe('#3a7bd5'); expect(itemColorLabel(undefined)).toBe('Default');
});
```

Add to `tests/presentation/editor/itemColors.test.ts`:

```ts
it('offers the palette for a wall in its Details and for a room in its Details', async () => {
	const rig = await setup(), wall = rig.project.structure.walls[0].id;
	rig.selection.select([wall as never]); await settleUntil(() => rig.wrapper.find('.rp-structure-inspector .rp-item-color').exists(), 'wall palette');
	await rig.wrapper.get('.rp-structure-inspector [data-rp-item-color="rose"]').trigger('click');
	await settleUntil(() => rig.project.structure.walls[0].color === 'rose', 'rose wall');
	rig.selection.select([rig.room.id as never]); await settleUntil(() => rig.wrapper.find('.rp-room-inspector .rp-item-color').exists(), 'room palette');
	await rig.wrapper.get('.rp-room-inspector [data-rp-item-color="amber"]').trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.color === 'amber', 'amber room');
	expect(rig.wrapper.get('.rp-room-inspector .rp-item-color').text()).toContain('Color · Amber');
});
```

- [ ] **Step 2: Run and watch them fail** — `npm run check:fast -- tests/presentation/editor/elements/itemColorTargets.test.ts tests/presentation/editor/itemColors.test.ts`. Expected: FAIL (a wall, an opening, a path and a room answer no target; no palette in either inspector).

- [ ] **Step 3: Implement** — `colorTargets` becomes:

```ts
/** What the palette recolours for a single selection: the room, wall, opening or element it names, else nothing. */
export function colorTargets(sources: ColorSources, ids: readonly string[]): readonly ColorTarget[] {
	if (ids.length !== 1) return [];
	const { structure } = sources, id = ids[0];
	const target = sources.zones.get(id) ?? structure.walls.find(item => item.id === id) ?? structure.openings.find(item => item.id === id) ?? structure.elements?.find(item => item.id === id);
	return target ? [target] : [];
}
```

`StructureInspector.vue`: `import ItemColorControl from '../elements/ItemColorControl.vue';` and `<ItemColorControl />` on the line after `<StructurePlanActions />`. `RoomInspector.vue`: `import ItemColorControl from '../elements/ItemColorControl.vue';` and `<ItemColorControl />` directly after the facts `</dl>` (before `.rp-inspector-actions`), the same place `ElementInspector` draws it — beside the summary rather than inside More, so it stays discoverable. The control hides itself outside Plan.

- [ ] **Step 4: Run to green** — `npm run check:fast -- tests/presentation/editor tests/harness/accessibility.test.ts`. Expected PASS. `npx eslint src/presentation/editor/elements/itemColorTargets.ts src/presentation/editor/structure/StructureInspector.vue src/presentation/editor/shell/RoomInspector.vue`.

- [ ] **Step 5: Commit and push (phase 2 checkpoint)**

```bash
git add src/presentation/editor tests/presentation/editor
git commit -m "feat(colors): the palette colours walls, openings, rooms and every element kind

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

Continue with Task 10 once CI is green.

---

### Task 10: Several selected things — Mixed, one choice for all

**Files:**
- Modify: `src/presentation/editor/elements/itemColorTargets.ts` (`colorTargets`, new `sharedColor`, `itemColorLabel`)
- Modify: `src/presentation/editor/elements/ItemColorControl.vue` (`current`, custom prop)
- Modify: `src/presentation/editor/shell/EntityInspector.vue:115-118` (mount in the multi-selection `#actions`)
- Modify: `src/presentation/i18n/locales/en/itemColor.ts`, `src/presentation/i18n/locales/de/itemColor.ts`
- Modify: `tests/presentation/editor/elements/itemColorTargets.test.ts`, `tests/presentation/editor/itemColors.test.ts`

**Interfaces:**
- Consumes: Task 9's `colorTargets`.
- Produces: `colorTargets` answers every selected id or none; `sharedColor(targets: readonly ColorTarget[]): ItemColor | undefined | 'mixed'`; `itemColorLabel(color: ItemColor | undefined | 'mixed'): string`; i18n key `editor.item-color.mixed`.

- [ ] **Step 1: Write the failing tests.** In `itemColorTargets.test.ts` import `sharedColor` and add:

```ts
it('answers every selected id, or nothing when one cannot be coloured, and shares or mixes their colour', () => {
	const all = colorTargets({ zones, structure }, ['zone-a', 'wall-a', 'element-path']);
	expect(all.map(target => target.id)).toEqual(['zone-a', 'wall-a', 'element-path']);
	expect(colorTargets({ zones, structure }, ['wall-a', 'reference-x'])).toEqual([]);
	expect(sharedColor(all)).toBe('mixed');
	expect(sharedColor(colorTargets({ zones, structure }, ['wall-a', 'opening-door']))).toBeUndefined();
	expect(sharedColor([{ id: 'a', color: 'rose' }, { id: 'b', color: 'rose' }])).toBe('rose');
	expect(itemColorLabel('mixed')).toBe('Mixed');
});
```

In `itemColors.test.ts` add:

```ts
it('shows Mixed for an item, a wall and a room with different colours, and one choice sets all three as one undo step', async () => {
	const rig = await setup(), wall = rig.project.structure.walls[0].id;
	await rig.runtime.groupActions.setColor([item.id], 'blue');
	rig.selection.select([item.id, wall, rig.room.id] as never); await settleUntil(() => rig.wrapper.find('.rp-multi-selection .rp-item-color').exists(), 'multi palette');
	const palette = rig.wrapper.get('.rp-multi-selection .rp-item-color');
	expect(palette.text()).toContain('Color · Mixed');
	expect(palette.findAll('[aria-pressed="true"]')).toHaveLength(0);
	await palette.get('[data-rp-item-color="violet"]').trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.color === 'violet', 'violet selection');
	expect([colorOf(rig), rig.project.structure.walls[0].color]).toEqual(['violet', 'violet']);
	await rig.runtime.undo(); await settle();
	expect([colorOf(rig), rig.project.structure.walls[0].color, rig.project.zones.get(rig.room.id)?.color]).toEqual(['blue', undefined, undefined]);
	await menu(rig);
	expect(rig.wrapper.get('.rp-canvas-context-menu .rp-item-color').text()).toContain('Color · Mixed');
});
```

- [ ] **Step 2: Run and watch them fail** — `npm run check:fast -- tests/presentation/editor/elements/itemColorTargets.test.ts tests/presentation/editor/itemColors.test.ts`. Expected: FAIL (`sharedColor` missing; no multi-selection palette).

- [ ] **Step 3: Implement** — `itemColorTargets.ts`:

```ts
/** What the palette recolours: every selected room, wall, opening and element — or nothing, never a silent subset. */
export function colorTargets(sources: ColorSources, ids: readonly string[]): readonly ColorTarget[] {
	const { structure } = sources;
	const found = ids.map(id => sources.zones.get(id) ?? structure.walls.find(item => item.id === id) ?? structure.openings.find(item => item.id === id) ?? structure.elements?.find(item => item.id === id));
	return found.every((target): target is ColorTarget => target !== undefined) ? found : [];
}
/** The one colour every target shares — `undefined` is Default — or `'mixed'`. */
export function sharedColor(targets: readonly ColorTarget[]): ItemColor | undefined | 'mixed' {
	const first = targets[0]?.color;
	return targets.every(target => target.color === first) ? first : 'mixed';
}
/** The palette's value line: Mixed, a preset's name, a custom hex as saved, or Default. */
export function itemColorLabel(color: ItemColor | undefined | 'mixed'): string {
	if (color === 'mixed') return tr('editor.item-color.mixed');
	if (color === undefined) return tr('editor.item-color.default');
	return isItemColorPreset(color) ? tr(`editor.item-color.${color}`) : color;
}
```

`ItemColorControl.vue`: import `sharedColor`; `const current = computed(() => sharedColor(targets.value));`; the custom picker gets `:color="current === 'mixed' ? undefined : current"`. `EntityInspector.vue`: `import ItemColorControl from '../elements/ItemColorControl.vue';` and `<ItemColorControl />` as the first child of the `MultiSelectionInspector`'s `#actions` template. `en/itemColor.ts` adds `'editor.item-color.mixed': 'Mixed',`; `de/itemColor.ts` adds `'editor.item-color.mixed': 'Gemischt',`.

- [ ] **Step 4: Run to green** — `npm run check:fast -- tests/presentation tests/harness/accessibility.test.ts`. Expected PASS. `npx eslint src/presentation/editor/elements src/presentation/editor/shell/EntityInspector.vue src/presentation/i18n`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation tests/presentation
git commit -m "feat(colors): colour several selected things at once, with a Mixed state

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Harness captures of every family coloured

jsdom draws nothing, so whether a tint, ink or wash READS on a themed plan is only visible in a capture.

**Files:**
- Create: `tests/harness/colorsKnob.ts`
- Modify: `tests/harness/referenceWorkspace.ts:74` (one line)
- Modify: `scripts/harness-shot.mjs` (three `SHOTS` rows after the `plan-editor-drafting-narrow` row)
- Modify: `tests/build/harness-shot.test.ts` (three names in the pinned list)

**Interfaces:**
- Consumes: `Zone` colour (Task 3), schema 15 (Task 2), drawing (Tasks 6–8).
- Produces: the `?colors` knob and shots `plan-editor-colors`, `plan-editor-colors-dark`, `plan-editor-colors-narrow`.

- [ ] **Step 1: Pin the names first** — in `tests/build/harness-shot.test.ts`'s expected list insert, between `'plan-editor-canvas-floor',` and `'plan-editor-dark',`:

```ts
			'plan-editor-colors',
			'plan-editor-colors-dark',
			'plan-editor-colors-narrow',
```

Run `npm run check:fast -- tests/build/harness-shot.test.ts`; expected FAIL (the table lacks the three rows).

- [ ] **Step 2: The knob** — `tests/harness/colorsKnob.ts`, taking the same `stack` and `geometry` types as `seedDraftingPlan` in `tests/harness/draftingWorkspace.ts`:

```ts
import type { Plan } from '../../src/domain/plan/Plan';
import type { ItemColor } from '../../src/domain/spatial/ItemColor';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import type { ObsidianPlanGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { expectOk } from '../helpers/domain';
import { makeZone } from '../helpers/entities';
import type { createRepositoryStack } from '../helpers/vault';

type SeedStack = ReturnType<typeof createRepositoryStack>;
type SeedGeometry = ObsidianPlanGeometrySidecar;

const PALETTE: readonly ItemColor[] = ['blue', 'rose', 'amber', 'green', 'violet', '#3a7bd5'];

/**
 * `?colors`: every family carrying a colour over whatever `?drafting` seeded — a room wash, each wall and
 * opening, and each element in turn through the presets and one custom hex — so one capture shows tint, ink
 * and wash together (plan colours design §2). Written through the real repositories, schema 15 included.
 */
export async function seedColors(stack: SeedStack, geometry: SeedGeometry, plan: Plan): Promise<void> {
	const room = makeZone({ projectId: plan.projectId, planId: plan.id, name: 'Studio', color: 'green',
		geometry: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3000 }, { x: 0, y: 3000 }] } });
	expectOk(await stack.zones.save(room, 'absent'));
	const baseline = expectOk(await geometry.read(plan.id)), structure = baseline.document.structure ?? EMPTY_STRUCTURE;
	const paint = <T extends object>(items: readonly T[], offset: number) => items.map((item, index) => ({ ...item, color: PALETTE[(index + offset) % PALETTE.length] }));
	expectOk(await geometry.write(plan.id, { ...baseline.document, structure: { ...structure, walls: paint(structure.walls, 1), openings: paint(structure.openings, 2),
		...(structure.elements ? { elements: paint(structure.elements, 0) } : {}) } }, baseline.version));
}
```

(`SeedStack` / `SeedGeometry` stand for those two copied parameter types — write them as `type` aliases at the top of the file, e.g. `type SeedStack = Parameters<typeof seedDraftingPlan>[0]` importing `seedDraftingPlan` as a type-only import.) In `referenceWorkspace.ts`, directly after the `item` seed line, add:

```ts
		if (new URLSearchParams(location.search).has('colors')) await seedColors(stack, geometry, plan);
```

with `import { seedColors } from './colorsKnob';`.

- [ ] **Step 3: The shots** — in `scripts/harness-shot.mjs`, after the `plan-editor-drafting-narrow` row:

```js
	// Plan colours (2026-09-15): a room wash, tinted walls and fills, inked lines and drafting marks, from `?colors` over `?drafting`.
	{ name: 'plan-editor-colors', query: '?view=plan-editor&reference&planning&drafting&colors&theme=light', selector: FLOOR_STATE },
	{ name: 'plan-editor-colors-dark', query: '?view=plan-editor&reference&planning&drafting&colors', selector: FLOOR_STATE },
	{ name: 'plan-editor-colors-narrow', query: '?view=plan-editor&reference&planning&drafting&colors&theme=light', selector: PLAN_CANVAS, width: 460 },
```

- [ ] **Step 4: Run to green** — `npm run check:fast -- tests/build/harness-shot.test.ts tests/harness`. Expected PASS. `npx eslint tests/harness/colorsKnob.ts tests/harness/referenceWorkspace.ts`.

- [ ] **Step 5: Capture and look** — `npm run harness-shot` (needs the pinned Chromium; `RP_CHROMIUM_EXECUTABLE=/path/to/chrome` names another, and the output says so). Open `harness-shots/plan-editor-colors.png`, `-dark.png` and `-narrow.png` and check, writing each answer into the pull request description:
  1. The room wash is visible and the lines under it still read, in both schemes.
  2. Tinted walls differ from untinted ones and any hatch still shows on them.
  3. Every inked drafting mark and its text is legible in both schemes; name any preset that is not.
  4. At 460 px nothing overflows sideways.
  A capture is a picture of one fixture, not a proof: say which family the fixture did not contain (for example openings or posts, if `?drafting` seeds none).

- [ ] **Step 6: Commit**

```bash
git add tests/harness/colorsKnob.ts tests/harness/referenceWorkspace.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts
git commit -m "test(harness): a ?colors knob and captures of every family coloured

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Decisions, contract and help

**Files:**
- Create: `docs/development/adrs/0033-a-colour-is-user-content-on-every-plan-family.md`
- Modify: `docs/development/adrs/0031-construction-materials-and-plan-patterns.md` (Consequences, one bullet)
- Replace: `docs/development/item-colors.md`
- Replace: `docs/using-item-colors.md`
- Modify: `docs/superpowers/specs/2026-09-13-plan-drafting-tools-design.md:170` (one sentence)
- Modify: `docs/superpowers/specs/2026-09-15-plan-colors-everywhere-design.md` (naming note under `## 1.`)
- Modify: `CHANGELOG.md:16` (the unreleased item-colour bullet)
- Create: `docs/tests/cases/Colour plan items.md`

- [ ] **Step 1: ADR-0033** — create the file:

```markdown
---
adr: 33
title: A colour is user content on every plan family
status: Accepted
date: 2026-09-15
area: domain
---

# ADR-0033: A colour is user content on every plan family

## Context

Item colours gave plain items and placed assets six named presets on the plan's geometry sidecar (schema 14).
Renovators asked to colour everything they draw — paths, marks, posts, walls, openings and rooms — in any colour,
several things at once. ADR-0031 had refused custom colours for walls ("theme clashes"), and ADR-0021 gave the
sidecar coordinates only.

## Decision

- A colour is a preset id or a lowercase `#rrggbb`, optional on every element kind, wall, opening and room entry of
  the sidecar; absence is the host's default drawing. Written at schema 15; a plan whose only colours are presets on
  items and placements keeps writing 14.
- It is appearance the user chose — not plugin chrome and not a material. A wall's material stays a theme-drawn
  hatch; the wall's colour is the ground under it. Filled areas take an opaque 28% tint over the host background,
  lines and text the colour at full strength (the accent while selected), and a room a translucent wash (0.18 at
  rest, 0.28 selected) so an imported plan stays readable.
- A room's colour lives on its sidecar entry, not in its note, so recolouring any mix of rooms, walls, openings and
  elements is one conditional sidecar write and one undo step through group operations.
- The proposed (intended) structure is not recoloured by this action.

## Alternatives

- **Room colour in note frontmatter.** Visible to Bases, but a batch recolour becomes one note write per room plus
  a sidecar write, with partial-failure rollback and a second migration.
- **Presets only.** No theme clash, but not what renovators asked for; the presets remain the first choice.
- **Recolouring the material hatch's ink.** Loses the contrast the hatch was drawn for.

## Consequences

- Amends ADR-0031's refused "custom colours" alternative and ADR-0021's "the sidecar owns coordinates only": the
  sidecar also owns user appearance.
- Nothing enforces contrast for a custom colour used as ink; Default resets it.
- A plan holding a custom colour, or a colour on anything but an item or placement, is refused by an older build as
  newer (schema 15).
- A pasted room starts uncoloured: the clipboard copies a room's outline, not its sidecar appearance.

## Revisit when

Renovators need colour on the proposed structure on its own, a colour as a note property, or a contrast guarantee
for custom colours.
```

- [ ] **Step 2: ADR-0031** — append to its `## Consequences` list:

```markdown
- Amended by [ADR-0033](0033-a-colour-is-user-content-on-every-plan-family.md): a user colour on a wall is the ground
  under its hatch; the hatch itself stays in theme colours.
```

- [ ] **Step 3: The contract** — replace `docs/development/item-colors.md` with:

```markdown
# Plan colour contract

`ItemColor` (`src/domain/spatial/ItemColor.ts`) is a preset id — `slate`, `rose`, `amber`, `green`, `blue`,
`violet` — or a lowercase `#rrggbb`. Absence means Default; `null`, `default`, uppercase or 3-digit hex, other CSS
forms and unknown ids are invalid. It is optional on every `SpatialElement` kind, `Wall`, `Opening` and `Zone`.
The name keeps "item" because renovators call every plan thing an item. [ADR-0033](adrs/0033-a-colour-is-user-content-on-every-plan-family.md) records why.

## Persistence

The geometry sidecar owns it: `structure.elements[]`, `structure.walls[]`, `structure.openings[]` and the room's
`objects[]` entry. A room's note never carries it. `Zone.color` round-trips through `zoneMapper` exactly as
`labelOffset` does, so a rename, move or lock keeps it, and `observeZone` includes it, so a peer's recolour changes
the zone's version.

Schema 15 adds the field to every family; 14→15 changes only the discriminator. The writer picks 15 when any hex
colour exists or a wall, opening, room or non-item element carries a colour; presets on items and placements still
write 14, and a reset downgrades normally. Older readers refuse 15 rather than strip it. The proposed (intended)
structure can hold a colour carried through the proposal pipeline; nothing here recolours it.

## Commands and selection

`groupActions.setColor(ids, color)` is the one door. It captures the selection through group operations, sets or
physically removes `color` on exactly the selected ids with `recoloredDocument` — never a wall's hosted opening
unless it is selected too — and commits one conditional sidecar write through `GroupGeometryCommand`: one history
entry, the displayed-document stale check, busy and saving refusals, Plan only. The same colour writes nothing.
`sameGeometryDocument` compares the colour on every family, so undo refuses over a peer's recolour, and the
command records a zone receipt for a colour-only change, so the zone edits around it still undo.

`colorTargets` admits every selected room, wall, opening and element, or nothing when any id cannot be coloured —
never a silent subset. Values that differ read **Mixed**, with no swatch checked; any choice sets them all.

Copy/paste and item promotion carry an element's colour. A pasted room starts uncoloured.

## Rendering and accessibility

Preset samples: slate `#778899`, rose `#ce6682`, amber `#d69b32`, green `#54976d`, blue `#518cce`, violet `#956bc4`.
A filled area (item, placement and its solid details, stair outline, hatch-mark tile ground, wall body or its tile
ground) takes an opaque blend of 28% colour over the resolved host background; an unparseable host background keeps
the host fill. A line, mark or text (path, fence, measurement, arrow, beam, post and its load-bearing fill, dimension,
section, view, grid, boundary, text, opening frame, leaf and arc) takes the colour at full strength, and the accent
while selected. A room takes a translucent wash: opacity 0.18 at rest, 0.28 selected. Outlines of closed shapes,
labels, selection marks and handles keep host tokens. Nothing enforces contrast for a custom colour.

`ItemColorControl` renders Default and the presets as named pressed buttons in Details and `menuitemradio` buttons in
the context menu, with Left/Right between swatches and the menu's Up/Down/Home/End. Details adds a labelled native
colour input that commits on `change`, never `input`; the menu has none. It mounts in the element, structure, room and
multi-selection Details and in the context menu, and hides outside Plan.
```

- [ ] **Step 4: The help page** — replace `docs/using-item-colors.md` with:

```markdown
# Item colors / Objektfarben

## English

In **Plan**, select anything on the floor — an item, a placed asset, a path, a measurement, a stair, a post, a beam,
a drafting mark, a wall, a door or window, or a room — or several of them. Choose **Color** in the right-click menu,
or use the same swatches in **Details**. **Default** restores the normal drawing. Slate, Rose, Amber, Green, Blue and
Violet are appearance choices; they do not represent renovation status or materials. In Details, **Custom color**
opens your system's colour picker for any other colour.

Filled shapes and walls take a light tint of the colour, and a wall's material hatch stays on top of it. Lines,
marks and text are drawn in the colour itself, and in the selection colour while selected. A room gets a see-through
wash so a background plan stays readable.

With several things selected, one choice colours all of them as one undo step. If they have different colours, the
palette says **Mixed**. Undo and Redo include colour changes; copying an element keeps its colour, and a pasted room
starts without one. A custom colour is not checked for contrast — if something becomes hard to read, choose Default.

Colours are edited in Plan only, not in Renovate or Review. They do not change quantities, prices, room membership or
geometry. While an edit is saving or the displayed data is stale, the palette is unavailable; see
[Working with saved data](using-planning-recovery.md).

## Deutsch

Wähle in **Plan** etwas auf dem Grundriss aus — ein Objekt, ein platziertes Bibliothekselement, einen Weg, eine
Messung, eine Treppe, eine Stütze, einen Träger, eine Zeichenmarke, eine Wand, eine Tür oder ein Fenster oder einen
Raum — oder mehrere davon. Unter **Farbe** im Kontextmenü oder in **Details** stehen dieselben Farbfelder bereit.
**Standard** stellt die normale Darstellung wieder her. Schiefergrau, Rosé, Bernstein, Grün, Blau und Violett dienen nur
der Darstellung. In Details öffnet **Eigene Farbe** die Farbauswahl deines Systems für jede andere Farbe.

Flächen und Wände erhalten einen hellen Farbton, die Materialschraffur einer Wand bleibt darüber sichtbar. Linien,
Marken und Text erscheinen in der Farbe selbst, ausgewählt in der Auswahlfarbe. Ein Raum erhält eine durchscheinende
Tönung, damit ein Hintergrundplan lesbar bleibt.

Bei Mehrfachauswahl färbt eine Wahl alle in einem Rückgängig-Schritt. Haben sie verschiedene Farben, zeigt die Palette
**Gemischt**. Rückgängig und Wiederholen berücksichtigen Farbänderungen; kopierte Elemente behalten ihre Farbe, ein
eingefügter Raum hat keine. Eine eigene Farbe wird nicht auf Kontrast geprüft — wird etwas schwer lesbar, wähle Standard.

Farben sind nur in Plan bearbeitbar, nicht in Umbau oder Prüfung. Sie ändern keine Mengen, Preise, Raumzuordnung oder
Geometrie. Während des Speicherns oder bei veralteten Daten ist die Palette gesperrt.
```

- [ ] **Step 5: The two specs** — in the drafting design, append to the hatch row's cell (line 170): ` A colour, when set, is the tile's ground instead (ADR-0033).` In the plan-colours design, add directly under `## 1. Data and file format`:

```markdown
> **Names as implemented:** `PlanColor`, `planColorAppearance`, `PlanColorControl`/`PlanColorSwatch` and
> `createPlanColorActions` below shipped as `ItemColor`, `itemColorAppearance`, `ItemColorControl`/`ItemColorSwatch`/`ItemColorCustom`
> and `groupActions.setColor` + `recoloredDocument` — the existing names, since renovators call every plan thing an item.
> The room wash is node opacity rather than a `planColorWash` function, and a coloured wall is painted over its chained
> run rather than taken out of it. The Room Details palette sits beside the facts, not inside More.
```

- [ ] **Step 6: Changelog** — replace the unreleased item-colour bullet (line 16, `- Plan editor: assign one Item or placed asset a named preset color…`) with:

```markdown
- Plan editor: colour anything on a plan — items, placed assets, paths, measurements, stairs, posts, beams, drafting marks, walls, doors, windows and rooms — from its right-click menu or Details, one at a time or several at once as one undo step. Choose a named preset or, in Details, any custom colour from the system colour picker. Fills and walls take a light tint under their hatch, lines and text are drawn in the colour, and rooms get a see-through wash. Plan geometry holding a custom colour or a colour on anything but an item is saved as schema 15, which older builds refuse; preset colours on items still use schema 14.
```

- [ ] **Step 7: The manual case** — create `docs/tests/cases/Colour plan items.md`:

```markdown
---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 99
sources:
  - Plan colours everywhere design spec §2 (drawing), §3 (commands and UI)
status: Ready
---

# Colour plan items

Every plan thing takes a preset or custom colour, singly or several at once. `docs/superpowers/specs/2026-09-15-plan-colors-everywhere-design.md`
is the design and `docs/superpowers/plans/2026-09-15-plan-colors-everywhere.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a floor with a walled room,
a door, a path and a drafting text.

## Why a human is the only instrument for these

Every write, undo and refusal below is driven in `tests/presentation/editor/itemColors.test.ts`; drawing is asserted
node by node in `itemColorRendering.test.ts`, `wallColorPass.test.ts` and `zoneColorWash.test.ts`. Outside all of it:

1. **Whether the operating system's colour picker opens from Details inside Obsidian** and writes once on close.
2. **Whether tints, inks and the room wash read on a themed vault**, not only on the harness's default colours.

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Select the room. Details › Color › Blue. | A light blue wash over the room; the plan under it still reads. "Color · Blue". |
| 2 | Select a wall. Choose Rose. | The wall body turns light rose; its door symbol is unchanged. |
| 3 | Select the path. Details › Custom color; drag through several colours, then close the picker. | The path turns the final colour once; one Undo returns it to Default. "Color · #…" names the hex. |
| 4 | Right-click the drafting text. | The menu shows Default and six presets, and no custom picker. |
| 5 | Select the room, the wall and the path together. | Details and the menu read "Color · Mixed" with nothing checked. |
| 6 | Choose Green. Undo. | All three turn green; one Undo restores all three previous colours. |
| 7 | Switch to Renovate. | No palette anywhere; colours stay visible. |
| 8 | Switch theme between light and dark. | Every colour stays legible; name any that is not. |
| 9 | Open the plan's geometry sidecar in a text editor. | `"schemaVersion": 15`, with `"color"` on the room entry, the wall and the path. |

## Runs

| Date | Build | Result |
| --- | --- | --- |
| — | — | Not yet run in a vault. |
```

- [ ] **Step 8: Check and commit** — `npm run check:fast -- tests/build tests/release` (the changelog and docs checks). Then:

```bash
git add docs CHANGELOG.md
git commit -m "docs(colors): ADR-0033, the plan colour contract, help and a manual case

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

Wait for CI's full `npm run check` legs to go green on the pull request, and report any red leg with its output.

---

## Self-review record

- Spec §1 value, families, schema 15, both traps → Tasks 1, 2, 3, 4 (plus the projection trap found while planning, Task 5 Step 5).
- Spec §2 every row of the drawing table → Tasks 6, 7, 8; captures → Task 11.
- Spec §3 action, deleted `setColor` route, zone receipts, control, custom picker, Mixed, mounts, strings → Tasks 4, 5, 9, 10.
- Spec §4 tests → each task's Step 1; §5 decisions → Task 12; §6 phases → checkpoints after Tasks 5, 9 and 12.
- Known limits carried into the docs: no contrast enforcement; a pasted room starts uncoloured; the intended structure is not recoloured.
