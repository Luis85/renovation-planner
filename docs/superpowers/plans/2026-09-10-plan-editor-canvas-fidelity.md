# Plan Editor Canvas Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Plan editor's canvas draw walls, rooms and hover the way M01's mockup draws them: double-line walls with clean joints, rooms as name + area over a solid outline with a fill only on selection or hover, and a harness fixture that finally carries walls so the result can be photographed.

**Architecture:** Three Konva-layer components change their `config` objects and nothing else moves: `StructureLayer.vue` draws every wall twice (dark edge pass, then light body pass), `ZoneShape.vue` drops the status dash and caption and zeroes the resting fill, `InteractionLayer.vue` adds a hover fill beside its hover outline. One theme token (`wallFill`) joins `THEME_TOKENS`. The harness fixture in `tests/harness/planEditor.ts` gains a wall loop, a door and a window around the Kitchen.

**Tech Stack:** Vue 3 SFCs over vue-konva, Pinia, Vitest under jsdom with `@napi-rs/canvas`, the Playwright-driven `npm run harness-shot` for pictures.

**Spec:** `docs/superpowers/specs/2026-09-10-plan-editor-canvas-fidelity-design.md`

## Global Constraints

- No literal colour anywhere: every canvas colour is a `THEME_TOKENS` entry resolved from an Obsidian variable (SDD §84). The build's stylesheet check and the token resolver's fallback rule both refuse a literal.
- `npm run check:fast -- <paths>` between edits; `npm run check` ONCE before the final commit, never two gates at once (CLAUDE.md, Definition of done).
- The `.claude/settings.json` hook lints every edited file; treat its findings as tool errors to fix before moving on.
- Every user-visible string goes through `t`/`tr`; this plan adds none.
- Tests are watched RED before the source change lands, then GREEN after (CLAUDE.md, Testing).
- Commit messages: imperative subject, no `v` prefixes, `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer.
- Work on a branch off `main` at `8df88909` or later; `main` is not committed to directly.

---

## File map

| File | Change |
|---|---|
| `src/presentation/editor/theme/themeTokens.ts` | add `wallFill: '--background-secondary'` |
| `src/presentation/editor/structure/StructureLayer.vue` | two wall passes replace the single 0.65-opacity stroke |
| `src/presentation/editor/layers/zone/ZoneRenderModel.ts` | `StatusAppearance` loses `dash` |
| `src/presentation/editor/layers/zone/ZoneShape.vue` | solid outline, resting fill 0, status caption removed |
| `src/presentation/editor/layers/InteractionLayer.vue` | `hover-fill` line beside `hover-outline` |
| `tests/harness/planEditor.ts` | `HARNESS_STRUCTURE`, answered by `findZonesByPlan` |
| `tests/presentation/editor/renderModels.test.ts` | token + dash assertions |
| `tests/presentation/editor/structureLayerPasses.test.ts` | NEW: pass order, opacity, widths |
| `tests/presentation/editor/scene.test.ts` | opacity + status-caption cases |
| `tests/presentation/editor/interactionLayer.test.ts` | hover-fill case |
| `docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md` | one Layout line |
| `docs/development/agent-guide-increment-history.md` | one section |

---

### Task 1: Walls in two passes

**Files:**
- Modify: `src/presentation/editor/theme/themeTokens.ts` (the `THEME_TOKENS` const)
- Modify: `src/presentation/editor/structure/StructureLayer.vue` (template, the `v-for="wall in structure.walls"` block)
- Modify: `tests/presentation/editor/renderModels.test.ts` (inside `describe('resolving the theme')`)
- Create: `tests/presentation/editor/structureLayerPasses.test.ts`

**Interfaces:**
- Produces: `THEME_TOKENS.wallFill` (`'--background-secondary'`), so `ThemeTokens` gains a `wallFill: string` member every consumer receives. Konva nodes named `wall-edge` and `wall-body` in the `.architecture` layer, one of each per wall, edges all before bodies.
- Consumes: `tests/helpers/structureEditor.ts`'s `structureEditor()` rig (exposes `stage`, `geometry`, `plan`, `runtime`, `pinia`, `unmount`), `tests/helpers/structure.ts`'s `WALL_LOOP` (four 150 mm walls closing a 4000 × 3000 rectangle, ids `wall-a` … `wall-d`).

- [ ] **Step 1: Write the failing token assertion**

In `tests/presentation/editor/renderModels.test.ts`, inside `describe('resolving the theme', …)`, add before `it('reads every token from the Obsidian variable it names', …)`:

```ts
	/**
	 * The wall body is the one token that is a SURFACE rather than ink: it has to sit between
	 * two `--text-normal` edges and read as lighter than them in a light vault and lifted in a
	 * dark one, which is exactly what `--background-secondary` is for. Pinned by name because
	 * the walk below would pass with any variable at all.
	 */
	it('names the theme secondary surface for the wall body', () => {
		expect(THEME_TOKENS.wallFill).toBe('--background-secondary');
	});
```

- [ ] **Step 2: Write the failing pass test**

Create `tests/presentation/editor/structureLayerPasses.test.ts`:

```ts
// @vitest-environment jsdom
/**
 * A wall is drawn TWICE — a dark edge pass at `thickness + 2 / zoom`, then a light body pass
 * at `thickness` painted over it — and it is the ORDER across all walls that makes a clean
 * joint: wall B's body covers wall A's edge inside the corner they share. So the assertion
 * is over the whole layer's child order, not per wall. Watched red against the single
 * 0.65-opacity stroke this replaced: that version had no `wall-body` node at all, and its
 * one stroke carried the alpha that doubled at every corner.
 */
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

const rigs: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); });

async function loop() {
	const rig = await structureEditor(); rigs.push(rig);
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: WALL_LOOP }, read.version));
	await rig.runtime.refreshProjection(); await settle();
	const architecture = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	return { rig, edges: architecture.find<Konva.Line>('.wall-edge'), bodies: architecture.find<Konva.Line>('.wall-body'), lines: architecture.find<Konva.Line>('Line') };
}

it('draws every wall edge before any wall body, all opaque', async () => {
	const { edges, bodies, lines } = await loop();
	expect(edges).toHaveLength(WALL_LOOP.walls.length);
	expect(bodies).toHaveLength(WALL_LOOP.walls.length);
	const lastEdge = Math.max(...edges.map(node => lines.indexOf(node)));
	const firstBody = Math.min(...bodies.map(node => lines.indexOf(node)));
	expect(lastEdge).toBeLessThan(firstBody);
	for (const node of [...edges, ...bodies]) expect(node.opacity()).toBe(1);
});

it('gives the edge pass two screen pixels more than the body pass, at any zoom', async () => {
	const { rig, edges, bodies } = await loop();
	const editor = useEditorStore(rig.pinia);
	for (const zoom of [editor.viewport.zoom, editor.viewport.zoom * 2]) {
		editor.viewport = { ...editor.viewport, zoom }; await settle();
		for (const [index, edge] of edges.entries()) {
			expect(edge.strokeWidth() - bodies[index].strokeWidth()).toBeCloseTo(2 / zoom);
			expect(bodies[index].strokeWidth()).toBe(WALL_LOOP.walls[index].thickness);
			expect(edge.stroke()).not.toBe(bodies[index].stroke());
		}
	}
});
```

- [ ] **Step 3: Run both to verify they fail**

Run:
```bash
npm run check:fast -- tests/presentation/editor/structureLayerPasses.test.ts tests/presentation/editor/renderModels.test.ts
```
Expected: the token case FAILS with `expected undefined to be '--background-secondary'`; both pass cases FAIL (`expected [] to have a length of 4`; `vue-tsc` may also report `wallFill` missing — that is the same red).

- [ ] **Step 4: Add the token**

In `src/presentation/editor/theme/themeTokens.ts`, inside `THEME_TOKENS`, after `zoneCaption`:

```ts
	/** The light interior between a wall's two edge lines — a surface, not ink. */
	wallFill: '--background-secondary',
```

- [ ] **Step 5: Replace the wall stroke with two passes**

In `src/presentation/editor/structure/StructureLayer.vue`, replace the whole `<VGroup v-for="wall in structure.walls" …>…</VGroup>` block (the one containing the `opacity: 0.65` line, the selection dash line and the handle circles) with:

```vue
		<!--
			A wall is drawn TWICE, and the two passes run over ALL walls rather than per wall.
			Pass 1 is every wall as a `zoneStroke` stroke at `thickness + 2 / zoom`; pass 2 is
			every wall as a `wallFill` stroke at `thickness`, painted over it. What is left
			visible of pass 1 is a 1 px dark line along each side, which is the double-line
			wall M01 draws — and inside a joint, wall B's body covers wall A's edge, so a mitred
			corner falls out with no union, no offset polygons and no T-joint cases. The
			previous single stroke at `opacity: 0.65` doubled its alpha wherever two walls
			overlapped, which drew a dark square at every corner. A free wall end keeps a 1 px
			dark cap from pass 1: the architectural convention for a wall end, intended.
			`OpeningSymbols` below cuts through both passes with a `canvasBackground` stroke
			at `thickness + 2 / zoom`, the same width as pass 1.
		-->
		<VLine
			v-for="wall in structure.walls"
			:key="'edge-' + wall.id"
			:config="{ name: 'wall-edge', points: wallPoints(wall), stroke: tokens.zoneStroke, strokeWidth: wall.thickness + 2 / zoom, lineCap: 'butt', lineJoin: 'miter' }"
		/>
		<VLine
			v-for="wall in structure.walls"
			:key="'body-' + wall.id"
			:config="{ name: 'wall-body', points: wallPoints(wall), stroke: tokens.wallFill, strokeWidth: wall.thickness, lineCap: 'butt', lineJoin: 'miter' }"
		/>
		<VGroup
			v-for="wall in structure.walls"
			:key="wall.id"
			:config="{ name: wall.id }"
		>
			<VLine
				v-if="selected(wall.id) || runtime.openingMove.hostId.value === wall.id"
				:config="{ points: wallPoints(wall), stroke: tokens.accent, strokeWidth: 2 / zoom, dash: [7 / zoom, 4 / zoom] }"
			/>
			<VCircle
				v-for="(point, index) in handles(wall)"
				:key="index"
				:config="{ x: point.x, y: point.y, radius: 5 / zoom, stroke: tokens.zoneStroke, strokeWidth: 1 / zoom, fill: tokens.canvasBackground }"
			/>
		</VGroup>
```

- [ ] **Step 6: Run the two files to verify they pass**

Run:
```bash
npm run check:fast -- tests/presentation/editor/structureLayerPasses.test.ts tests/presentation/editor/renderModels.test.ts
```
Expected: PASS, both files.

- [ ] **Step 7: Run the editor suites that read the architecture layer**

Run:
```bash
npm run check:fast -- tests/presentation/editor
```
Expected: PASS. If `finalOverviewPresentation.test.ts`'s "wall body" line or `renovateRoomManipulation.test.ts`'s handle count goes red, the layer's node order changed from what this task specifies; fix the template rather than the test.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/editor/theme/themeTokens.ts src/presentation/editor/structure/StructureLayer.vue tests/presentation/editor/renderModels.test.ts tests/presentation/editor/structureLayerPasses.test.ts
git commit -m "Draw walls as two opaque passes so joints stop doubling their alpha

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Rooms as name and area over a solid outline

**Files:**
- Modify: `src/presentation/editor/layers/zone/ZoneRenderModel.ts` (`StatusAppearance`, `STATUS_APPEARANCE`, `UNKNOWN_STATUS`, the docblock above them)
- Modify: `src/presentation/editor/layers/zone/ZoneShape.vue` (`fillConfig`, `outlineConfig`, `statusCaption`, `statusConfig`, the template)
- Modify: `tests/presentation/editor/renderModels.test.ts` (the two dash cases)
- Modify: `tests/presentation/editor/scene.test.ts` (`distinguishes zone status without relying on colour`, `emphasizes only selected room fill …`)

**Interfaces:**
- Produces: `StatusAppearance` is `{ readonly captionKey: StringKey }` only. `RoomInspector.vue` reads `captionKey` and is unaffected.
- Consumes: `zoneLines(stage)` from `tests/helpers/editor.ts` (every `Line` in the `.zone` layer), `FIXTURE_ZONES` (Kitchen `Planned`, Terrace `Complete`).

- [ ] **Step 1: Rewrite the two scene cases so they fail**

In `tests/presentation/editor/scene.test.ts`, replace the whole `it('distinguishes zone status without relying on colour', …)` case AND the docblock immediately above it with:

```ts
	/**
	 * Status does NOT draw on the canvas (decision of 2026-09-10, canvas fidelity spec): a
	 * room is its name and its area over a thin solid outline, the way M01 draws one, and
	 * status lives in the Inspector's room list where `RoomInspector` still reads
	 * `statusAppearance(...).captionKey`. §85's "not by colour alone" is met by there being
	 * no status channel on the canvas at all. Watched red against the dashed, captioned
	 * version: two dash patterns and two status strings.
	 */
	it('draws a room as name and area over a solid outline, with no status on the canvas', async () => {
		const harness = await mount();

		const outlines = zoneLines(harness.stage).filter((line) => line.stroke() && !line.fill());
		const texts = (harness.stage.findOne<Konva.Layer>('.zone')?.find('Text') ?? []).map((node) => (node as Konva.Text).text());

		expect(outlines).toHaveLength(2);
		for (const outline of outlines) expect(outline.dash() ?? []).toEqual([]);
		expect(texts).toContain('Kitchen');
		expect(texts).not.toContain(t('en', 'zone.status.planned'));
		expect(texts).not.toContain(t('en', 'zone.status.complete'));
	});
```

Then in `it('emphasizes only selected room fill without rebuilding stored geometry', …)` change the three opacity expectations:

```ts
		expect(fills.map(line => line.opacity())).toEqual([0, 0]);
		useSelectionStore(harness.pinia).select(['zone-kitchen' as never]); await settle();
		expect(fills.map(line => line.opacity())).toEqual([0.12, 0]);
		for (const [index, line] of fills.entries()) expect(line.points()).toBe(points[index]);
		useSelectionStore(harness.pinia).clear(); await settle();
		expect(fills.map(line => line.opacity())).toEqual([0, 0]);
```

- [ ] **Step 2: Rewrite the render-model dash cases so they fail**

In `tests/presentation/editor/renderModels.test.ts`, delete `it('gives every status a distinct dash pattern', …)` together with the `§85` docblock above it, and change the unknown-status case to:

```ts
	it('answers for an unknown status too, with its own caption', () => {
		expect(statusAppearance('Demolished')).toEqual({ captionKey: 'zone.status.unknown' });
	});
```

- [ ] **Step 3: Run both files to verify they fail**

Run:
```bash
npm run check:fast -- tests/presentation/editor/scene.test.ts tests/presentation/editor/renderModels.test.ts
```
Expected: FAIL — the new scene case on `dash()` (`[6, 4]` is not `[]`) and on the status strings; the opacity case on `0.025`; the unknown-status case on the extra `dash` key.

- [ ] **Step 4: Drop `dash` from the render model**

In `src/presentation/editor/layers/zone/ZoneRenderModel.ts`, replace the docblock above `StatusAppearance` and the three declarations with:

```ts
/**
 * Status, as a caption key the INSPECTOR reads. It stopped drawing on the canvas on
 * 2026-09-10 (canvas fidelity spec): M01 draws a room as name and area over a wall, and
 * the room list beside it carries the status. §85's "status not encoded only by colour"
 * survives that by having no status channel on the canvas to encode.
 */
export interface StatusAppearance {
	readonly captionKey: StringKey;
}

const STATUS_APPEARANCE: Readonly<Record<string, StatusAppearance>> = {
	Planned: { captionKey: 'zone.status.planned' },
	InProgress: { captionKey: 'zone.status.in-progress' },
	Complete: { captionKey: 'zone.status.complete' },
};

const UNKNOWN_STATUS: StatusAppearance = { captionKey: 'zone.status.unknown' };
```

- [ ] **Step 5: Make the shape solid, quiet and two-line**

In `src/presentation/editor/layers/zone/ZoneShape.vue`:

Replace the `appearance`, `statusCaption`, `fillConfig`, `outlineConfig` and `statusConfig` computeds so the script's tail reads:

```ts
const fill = computed(() => props.tokens[zoneFillToken(props.model.zoneType)]);
const anchor = computed(() => labelAnchor(props.model.points, props.model.bulges));
```
(delete the `const appearance = computed(() => statusAppearance(props.model.status));` line and the `statusAppearance` import, keep `zoneFillToken` and `labelAnchor`), and further down:

```ts
const groupConfig = computed(() => ({ name: props.model.id, listening: false }));
// Invisible at rest and translucent when selected: M01 draws no resting fill, and the node
// stays MOUNTED at zero opacity because `ZoneLayer`'s paint order and `scene.test.ts`'s
// `flatPoints` identity case both rest on this group's child list keeping its shape.
const fillConfig = computed(() => ({ points: flatPoints.value, closed: true, fill: fill.value,
	opacity: props.selected ? 0.12 : 0, listening: false, perfectDrawEnabled: false }));
const outlineConfig = computed(() => ({ points: flatPoints.value, closed: true, stroke: props.tokens.zoneStroke,
	strokeWidth: 1, strokeScaleEnabled: false, listening: false, perfectDrawEnabled: false }));
const nameConfig = computed(() => ({ ...captionLayout.value, offsetY: CAPTION_PX * 1.6,
	text: props.model.label, fontSize: CAPTION_PX + 2, fontStyle: 'bold', height: CAPTION_PX + 5, fill: props.tokens.zoneLabel }));
const areaConfig = computed(() => ({ ...captionLayout.value, offsetY: 0,
	text: formatArea(props.model.areaMm2), fontSize: CAPTION_PX, fill: props.tokens.zoneLabel }));
```

Remove the `import { tr } from '../../../i18n/strings';` line if `tr` is now unused (the hook will say so).

In the template, change the `v-memo` array to `[groupConfig, fillConfig, outlineConfig, nameConfig, areaConfig]`, delete the `<VText :config="statusConfig" />` line, and replace the HTML comment above the two `VLine`s with:

```vue
		<!--
			Two line nodes over one point array, rather than one node with both a fill and a
			stroke. Konva's `opacity` is per NODE, so a translucent fill on a single node would
			take the outline down with it — and the fill is translucent when selected and
			invisible otherwise, since a zone sits over an imported plan the user still needs
			to see through it and M01 draws no resting fill at all.
		-->
```

- [ ] **Step 6: Run the two files to verify they pass**

Run:
```bash
npm run check:fast -- tests/presentation/editor/scene.test.ts tests/presentation/editor/renderModels.test.ts
```
Expected: PASS.

- [ ] **Step 7: Run every suite that mounts the zone layer**

Run:
```bash
npm run check:fast -- tests/presentation tests/harness
```
Expected: PASS. A case that counted three `Text` nodes per zone or read `appearance.dash` is a case this task changed the contract of; update it to the two-caption, solid-outline shape rather than restoring the status node.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/editor/layers/zone/ZoneRenderModel.ts src/presentation/editor/layers/zone/ZoneShape.vue tests/presentation/editor/scene.test.ts tests/presentation/editor/renderModels.test.ts
git commit -m "Draw a room as name and area over a solid outline, status off the canvas

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Hover fill

**Files:**
- Modify: `src/presentation/editor/layers/InteractionLayer.vue` (template, beside the `hover-outline` `VLine`)
- Modify: `tests/presentation/editor/interactionLayer.test.ts` (inside `describe('the interaction layer hover outline')`)

**Interfaces:**
- Consumes: `hoverOutlineFlat` (flat screen-space points or `null`) and `hoverClosed` (boolean) already computed in the layer; `linesNamed(harness, name)` and `runtimeOf(harness)` in the test file.
- Produces: a `Konva.Line` named `hover-fill` while a CLOSED shape is hovered and not selected.

- [ ] **Step 1: Write the failing case**

In `tests/presentation/editor/interactionLayer.test.ts`, after `it('draws nothing for a hovered id the hydrated zones do not hold', …)` inside the same `describe`, add:

```ts
	/**
	 * Decision 1 of the canvas fidelity spec: a room's fill shows on selection OR hover. The
	 * fill node is separate from the outline because Konva opacity is per node, and it is
	 * drawn only for a CLOSED hover — an open polyline (a wall, a fence) has no interior.
	 */
	it('fills a hovered room faintly, and fills nothing for a hovered open shape', async () => {
		const harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness);

		runtime.renderState.hoveredObjectId = 'zone-terrace';
		await settle();
		const [fill] = linesNamed(harness, 'hover-fill');
		expect(fill).toBeDefined();
		expect(fill.closed()).toBe(true);
		expect(fill.opacity()).toBeCloseTo(0.06);
		expect(fill.stroke()).toBeFalsy();
		// The fill paints under the outline, so the outline stays crisp over it.
		const layer = fill.getLayer();
		const lines = layer?.find<Konva.Line>('Line') ?? [];
		expect(lines.indexOf(fill)).toBeLessThan(lines.indexOf(linesNamed(harness, 'hover-outline')[0]));

		useSelectionStore().select(['zone-terrace' as never]);
		await settle();
		expect(linesNamed(harness, 'hover-fill')).toHaveLength(0);

		harness.unmount();
	});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npm run check:fast -- tests/presentation/editor/interactionLayer.test.ts
```
Expected: FAIL with `expected undefined to be defined` on `fill`.

- [ ] **Step 3: Add the fill line**

In `src/presentation/editor/layers/InteractionLayer.vue`, immediately BEFORE the `<VLine v-if="hoverOutlineFlat !== null" … name: 'hover-outline' …>` node, add:

```vue
		<VLine
			v-if="hoverOutlineFlat !== null && hoverClosed"
			:config="{
				name: 'hover-fill',
				points: hoverOutlineFlat,
				closed: true,
				fill: props.tokens.accent,
				opacity: 0.06,
				listening: false,
			}"
		/>
```

- [ ] **Step 4: Run it to verify it passes**

Run:
```bash
npm run check:fast -- tests/presentation/editor/interactionLayer.test.ts tests/presentation/editor/scene.test.ts
```
Expected: PASS. If `scene.test.ts`'s "mounts the interaction layer present, drawing nothing inside its four reserved groups" reddens, the new node was placed inside a reserved group; it belongs as a direct child of the layer beside `hover-outline`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/layers/InteractionLayer.vue tests/presentation/editor/interactionLayer.test.ts
git commit -m "Fill a hovered room faintly beside its hover outline

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Walls in the harness fixture, and the pictures

**Files:**
- Modify: `tests/harness/planEditor.ts` (imports; after `HARNESS_ZONES`; the `findZonesByPlan` fake)
- Read: `harness-shots/plan-editor-light.png`, `plan-editor-dark.png`, `plan-editor-selected.png`, `plan-editor-multiple.png`, `plan-editor-multiple-dark.png`

**Interfaces:**
- Produces: `HARNESS_STRUCTURE: Structure` exported from `tests/harness/planEditor.ts`.
- Consumes: `Structure` from `src/domain/spatial/Structure`; the Kitchen zone `harness-kitchen` at `(0,0)–(4200,3000)`.

- [ ] **Step 1: Write the failing fixture assertion**

In `tests/harness/fixture.test.ts`, add at the end of the file's top-level `describe` (or as a new top-level `it` if the file has none):

```ts
/**
 * The fixture carried NO walls until 2026-09-10, so no capture ever drew a wall, a joint or
 * an opening while the wall stroke doubled its alpha at every corner in a real vault. A
 * fixture that cannot photograph a defect class is the harness's own version of a fake too
 * thin. Only the Kitchen is walled, so one frame shows a room with walls and one without.
 */
it('walls the Kitchen with a door and a window, and leaves the other rooms open', async () => {
	const read = await harnessDeps().queries.findZonesByPlan(HARNESS_PLAN.id);
	if (!read.ok) throw new Error('fixture zones refused');
	const structure = read.value.structure;
	expect(structure?.walls).toHaveLength(4);
	expect(structure?.openings.map(opening => opening.kind).sort()).toEqual(['door', 'window']);
	expect(structure?.boundaries).toEqual([{ roomId: 'harness-kitchen', wallIds: structure?.walls.map(wall => wall.id) }]);
	for (const wall of structure?.walls ?? []) expect(wall.thickness).toBe(240);
});
```

The file already imports `HARNESS_PLAN` and `harnessDeps` from `./planEditor`; no import changes.

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npm run check:fast -- tests/harness/fixture.test.ts
```
Expected: FAIL with `expected undefined to have a length of 4`.

- [ ] **Step 3: Add the structure and answer it**

In `tests/harness/planEditor.ts`, add to the imports:

```ts
import type { Structure } from '../../src/domain/spatial/Structure';
```

After the `HARNESS_ZONES` constant, add:

```ts
/**
 * The Kitchen's four walls, a door in the south wall and a window in the north one. Present
 * since 2026-09-10 because the fixture had NO walls before it, so no capture ever drew a
 * joint or an opening — and the wall stroke's alpha had been doubling at every corner in a
 * real vault while every gate stayed green. Terrace and Garden stay open on purpose: the
 * same frame then photographs a room with walls and a room whose outline is its own.
 *
 * Wall order follows the zone's vertex order (north, east, south, west), so the loop reads
 * the way `harness-kitchen`'s polygon does. Opening offsets run from each wall's `start`.
 */
export const HARNESS_STRUCTURE: Structure = {
	walls: [
		{ id: 'harness-wall-north', start: { x: 0, y: 0 }, end: { x: 4200, y: 0 }, thickness: 240, height: 2600 },
		{ id: 'harness-wall-east', start: { x: 4200, y: 0 }, end: { x: 4200, y: 3000 }, thickness: 240, height: 2600 },
		{ id: 'harness-wall-south', start: { x: 4200, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 240, height: 2600 },
		{ id: 'harness-wall-west', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 240, height: 2600 },
	],
	openings: [
		{ id: 'harness-door', kind: 'door', hostId: 'harness-wall-south', offset: 1500, width: 900, height: 2100, sill: 0, swing: { hinge: 'start', side: 'left', angle: 90 } },
		{ id: 'harness-window', kind: 'window', hostId: 'harness-wall-north', offset: 1500, width: 1200, height: 1200, sill: 900 },
	],
	boundaries: [{ roomId: 'harness-kitchen', wallIds: ['harness-wall-north', 'harness-wall-east', 'harness-wall-south', 'harness-wall-west'] }],
};
```

Change the `findZonesByPlan` fake to:

```ts
			findZonesByPlan: () =>
				Promise.resolve(ok({ zones: structuredClone(HARNESS_ZONES), unreadable: 0, structure: structuredClone(HARNESS_STRUCTURE) })),
```

- [ ] **Step 4: Run the harness and bare-fixture suites**

Run:
```bash
npm run check:fast -- tests/harness tests/presentation/editor/editorWorkspaceNavigation.test.ts tests/presentation/editor/planningRecovery.test.ts tests/presentation/editor/renovationSummaryLoading.test.ts tests/presentation/editor/spatialRefreshRecovery.test.ts tests/presentation/editor/referenceWorkflow.e2e.test.ts tests/presentation/views/mobileDesktopOnly.test.ts
```
Expected: PASS. Those five editor files and the view file are every consumer of the bare `harnessDeps()`; `structureEditor` goes through `referenceWorkspace`, which reads structure from the geometry sidecar and is untouched. A case that asserted "no walls yet" text against the bare fixture has changed contract; update its expectation, do not strip the fixture.

- [ ] **Step 5: Capture**

Run:
```bash
npm run harness-shot
```
Expected: exits 0, writes `harness-shots/*.png`. If it refuses for a missing pinned Chromium, set `RP_CHROMIUM_EXECUTABLE` to a named browser as `scripts/chromium.mjs` documents and re-run; the capture then prints that it is not the pinned build, and the reading below is approximate.

- [ ] **Step 6: Read the pictures**

Open each of `harness-shots/plan-editor-light.png`, `plan-editor-dark.png`, `plan-editor-selected.png`, `plan-editor-multiple.png` and `plan-editor-multiple-dark.png` with the Read tool and confirm, per picture:

1. The Kitchen has a double-line wall on all four sides with NO dark square at any corner.
2. The door and the window each cut cleanly through both the edge and body passes; the door shows a leaf and an arc.
3. Bathroom, Terrace and Garden show a thin solid outline and no dash.
4. No "Planned" / "In progress" / "Complete" caption under any room; name and area only.
5. `plan-editor-selected`: the Kitchen carries a faint blue fill; no other room does. `plan-editor-light`: no room carries a fill.
6. Dark scheme: the wall body reads LIGHTER than the canvas, not darker.

Record any deviation as a defect in the same task and fix it before committing; the fixture and the picture land together.

- [ ] **Step 7: Commit**

```bash
git add tests/harness/planEditor.ts tests/harness/fixture.test.ts
git commit -m "Wall the harness Kitchen so the capture can photograph a joint and a door

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Records and the gate

**Files:**
- Modify: `docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md` (the `## Layout` list)
- Modify: `docs/development/agent-guide-increment-history.md` (append)

- [ ] **Step 1: Amend M01**

In `M01-standard-plan-view.md`, under `## Layout`, after the line `- Inspector shows floor name, room count, total area, planned-change count, estimated cost, and a room list.` add:

```md
- Room status is shown in the Inspector room list, not on the canvas: a room draws as its name and area over a thin solid outline, with a faint fill only while selected or hovered (decision of 2026-09-10, `docs/superpowers/specs/2026-09-10-plan-editor-canvas-fidelity-design.md`).
```

- [ ] **Step 2: Record the increment**

Append to `docs/development/agent-guide-increment-history.md`:

```md
## The canvas fidelity pass, 2026-09-10

`docs/superpowers/specs/2026-09-10-plan-editor-canvas-fidelity-design.md`. A screenshot of a
drawn wall loop in a vault, set beside M01's mockup, read as a diagram rather than a floor plan,
and the reason no gate had said so is the durable part: **the harness fixture carried no walls**,
so `plan-editor-*` had never drawn a wall, a joint or an opening. A fixture that cannot photograph
a defect class is the harness's own version of a fake too thin. `HARNESS_STRUCTURE` walls the
Kitchen now, with a door and a window, and only the Kitchen — one frame shows a walled room and
an open one.

What the screenshot showed. The single wall stroke at `opacity: 0.65` doubled its alpha wherever
two walls overlapped, so every corner carried a dark square that read as a joint symbol and was
not one. The fix is two opaque passes over ALL walls — a `--text-normal` edge at
`thickness + 2 / zoom`, then a `--background-secondary` body at `thickness` painted over it —
rather than a per-wall change, because it is the ORDER across walls that makes a joint: wall B's
body covers wall A's edge inside the corner. A polygon union was the alternative and is refused
in `StructureLayer.vue`'s template comment: exact, and a few hundred lines of offset-and-union
geometry with T-joint and curved-wall cases, for a picture the two passes already draw.
`tests/presentation/editor/structureLayerPasses.test.ts` pins the order, the opacity and the
2 px difference, watched red against the single stroke.

Rooms lost their status channel on the canvas: the per-status dash, the zone-type tint at rest
and the third caption line. M01 draws a room as name and area over a wall, with status in the
Inspector list, and `RoomInspector` still reads `statusAppearance(...).captionKey` there. §85's
"not by colour alone" holds by there being nothing on the canvas to encode. The fill node stays
mounted at zero opacity, because `ZoneLayer`'s paint order and `scene.test.ts`'s `flatPoints`
identity case both rest on the group's child list keeping its shape; a hover fill at 0.06 joined
the hover outline in `InteractionLayer.vue` for closed shapes only.

Out of scope and said so in the spec: the mockup's furniture and sanitary symbols, wall hatching,
the navy label colour, and a second fixture mirroring M01's four-room floor.
```

- [ ] **Step 3: Run the full gate once**

Run:
```bash
npm run check
```
Expected: build, lint, coverage-thresholded tests and fallow all green. If coverage dips below a floor, read `coverage/coverage-final.json` for the four changed `src/` files and cover the arm it names; if `tests/build/` ESLint boots time out, re-run once with `--no-file-parallelism` before treating it as red (CLAUDE.md, The linter in the edit loop).

- [ ] **Step 4: Commit**

```bash
git add docs/user-experience/renovation-planner-editor-specs/screens/M01-standard-plan-view.md docs/development/agent-guide-increment-history.md
git commit -m "Record the canvas fidelity pass and M01's status-in-inspector decision

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage.** §1 walls → Task 1. §2 rooms → Task 2. §3 hover → Task 3. §4 fixture and the read captures → Task 4. Testing list: scene opacities (T2), render-model dash (T2), pass test (T1), token (T1), hover (T3), captures read (T4 step 6), `npm run check` (T5). Records → T5.
- **Placeholders.** None; every step carries its code or its command.
- **Type consistency.** `wallFill` is declared in T1 and consumed only there. `StatusAppearance` loses `dash` in T2 and its only remaining reader is `captionKey`. Node names `wall-edge` / `wall-body` / `hover-fill` are the same in template and test. `HARNESS_STRUCTURE` field names match `Structure`, `Wall`, `Opening`, `OpeningSwing` and `RoomBoundary` in `src/domain/spatial/Structure.ts`.
