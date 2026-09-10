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
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

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
	expect(edges).toHaveLength(WALL_LOOP.walls.length);
	expect(bodies).toHaveLength(WALL_LOOP.walls.length);
	const lastEdge = Math.max(...edges.map(node => lines.indexOf(node)));
	const firstBody = Math.min(...bodies.map(node => lines.indexOf(node)));
	expect(lastEdge).toBeLessThan(firstBody);
	for (const node of [...edges, ...bodies]) expect(node.opacity()).toBe(1);
});

it('carries a corner wall body half its thickness past the corner, so the outer quadrant closes', async () => {
	const { bodies } = await loop();
	const [first] = WALL_LOOP.walls;
	expect(bodies[0].points().slice(0, 2)).toEqual([first.start.x - first.thickness / 2, first.start.y]);
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
