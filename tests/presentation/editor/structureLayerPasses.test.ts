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
import { afterEach, beforeEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { WALL_LOOP } from '../../helpers/structure';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { postOutline } from '../../../src/domain/spatial/structuralElement';

// jsdom defines no Obsidian CSS variable, so `resolveThemeTokens` would give `--text-normal`
// (`zoneStroke`, the edge pass) and `--background-secondary` (`wallFill`, the body pass) the
// SAME fallback (the element's own `color`), and the stroke-inequality assertion below would
// stay red for a reason unrelated to the source change. Distinct sentinels make the two
// tokens distinct strings, the way `finalOverviewPresentation.test.ts` primes `--interactive-
// accent` before mounting.
beforeEach(() => {
	document.documentElement.style.setProperty('--text-normal', 'rgb(1, 1, 1)');
	document.documentElement.style.setProperty('--background-secondary', 'rgb(2, 2, 2)');
});
afterEach(() => {
	document.documentElement.style.removeProperty('--text-normal');
	document.documentElement.style.removeProperty('--background-secondary');
});

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
	expect(edges.length).toBeGreaterThan(0);
	expect(bodies).toHaveLength(edges.length);
	const lastEdge = Math.max(...edges.map(node => lines.indexOf(node)));
	const firstBody = Math.min(...bodies.map(node => lines.indexOf(node)));
	expect(lastEdge).toBeLessThan(firstBody);
	for (const node of [...edges, ...bodies]) expect(node.opacity()).toBe(1);
});

it('draws a closed wall loop as one closed mitred run, so no corner is two overlapping walls', async () => {
	const { edges, bodies } = await loop();
	expect(edges).toHaveLength(1);
	for (const node of [...edges, ...bodies]) {
		expect(node.closed()).toBe(true);
		expect(node.lineJoin()).toBe('miter');
		expect(node.points()).toEqual(WALL_LOOP.walls.flatMap(wall => [wall.start.x, wall.start.y]));
	}
});

it('gives the edge pass two screen pixels more than the body pass, at any zoom', async () => {
	const { rig, edges, bodies } = await loop();
	const editor = useEditorStore(rig.pinia);
	for (const zoom of [editor.viewport.zoom, editor.viewport.zoom * 2]) {
		editor.viewport = { ...editor.viewport, zoom }; await settle();
		for (const [index, edge] of edges.entries()) {
			expect(edge.strokeWidth() - bodies[index].strokeWidth()).toBeCloseTo(2 / zoom);
			expect(bodies[index].strokeWidth()).toBe(WALL_LOOP.walls[0].thickness);
			expect(edge.stroke()).not.toBe(bodies[index].stroke());
		}
	}
});

/**
 * A third pass, `wall-pattern`, joins the two above for a wall whose material has a plan
 * pattern (ADR-0031): drawn after every `wall-body`, filling the wall's own body polygon
 * rather than its centre-line. Pinned here too, beside the edge/body order this file already
 * owns, rather than only in `wallPatternPass.test.ts` — this file is the ORDER contract.
 */
it('draws the wall-pattern pass after every wall body, for a wall whose material has a pattern', async () => {
	const rig = await structureEditor(true); rigs.push(rig);
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: WALL_LOOP }, read.version));
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Brick', unit: 'm2', planPattern: 'brick' }), 'absent')).entity;
	const plan = expectDefined(expectOk(await rig.stack.plans.getById(rig.plan.id)), 'plan');
	const subjects = [{ id: 'pattern-wall', targetId: 'wall-a', kind: 'wall' as const, existing: { description: 'Brick', condition: 'good' as const, assetId: brick.id }, planned: null }];
	const renovated = expectOk(withPlanRenovation(plan.entity, { ...EMPTY_RENOVATION, subjects }));
	expectOk(await rig.stack.plans.save(renovated, plan.version));
	await rig.runtime.refreshProjection(); rig.changePlan(); await settle();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === brick.id) === true, 'catalogue read');
	const architecture = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	await settleUntil(() => architecture.find('.wall-pattern').length > 0, 'pattern pass drawn');
	const lines = architecture.find<Konva.Shape>('Line');
	const bodies = architecture.find('.wall-body').map(node => lines.indexOf(node as Konva.Shape));
	const patterns = architecture.find('.wall-pattern').map(node => lines.indexOf(node as Konva.Shape));
	expect(Math.min(...patterns)).toBeGreaterThan(Math.max(...bodies));
});

/**
 * Where an element draws relative to the wall paint passes is not covered above: reverting the
 * element-block move (either back to the top of the layer, or forward to the very end, after the
 * wall selection group / OpeningSymbols / the wall draft overlay) turns nothing here red. A
 * load-bearing post centred on a wall's centre line is the case that shows it — its 140mm
 * section sits entirely inside the wall's 150mm painted body, so it is only visible if it draws
 * AFTER the wall-body (and wall-pattern) passes; and the wall being selected has to stay above
 * the post, or a post standing at a wall's end would cover the endpoint handle a user needs to
 * drag the wall by.
 */
it('draws a post after the wall paint passes and before the selected wall’s endpoint handles', async () => {
	const rig = await structureEditor(); rigs.push(rig);
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	const elements = [{ id: 'element-post-a', kind: 'post' as const, loadBearing: true, points: postOutline({ x: 2000, y: 0 }, 140, 140) }];
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...WALL_LOOP, elements } }, read.version));
	await rig.runtime.refreshProjection(); await settle();
	rig.selection.select(['wall-a' as never]); await settle();
	const architecture = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	const shapes = architecture.find<Konva.Shape>('Shape');
	const bodies = architecture.find('.wall-body').map(node => shapes.indexOf(node as Konva.Shape));
	const patterns = architecture.find('.wall-pattern').map(node => shapes.indexOf(node as Konva.Shape));
	const posts = architecture.find('.post-outline').map(node => shapes.indexOf(node as Konva.Shape));
	const handles = shapes.filter(node => node.getClassName() === 'Circle').map(node => shapes.indexOf(node));
	expect(posts.length).toBeGreaterThan(0);
	expect(handles).toHaveLength(2);
	expect(Math.min(...posts)).toBeGreaterThan(Math.max(...bodies, ...patterns));
	expect(Math.max(...posts)).toBeLessThan(Math.min(...handles));
});
