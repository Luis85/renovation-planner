// @vitest-environment jsdom
/**
 * The zone layer paints ABOVE the architecture layer (SDD §17), so a walled room's 1 px outline
 * drew down the centre of every wall body and straight across its door cut. The outline is
 * hidden while the room's boundary walls still run along every edge, and only then: enclosure
 * is never resynchronised, so an edit can move a wall off the edge it was the boundary of.
 * Hidden rather than unmounted, because the group's child list keeps its shape.
 */
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { HARNESS_STRUCTURE, HARNESS_ZONES } from '../../harness/planEditor';
import type { Structure } from '../../../src/domain/spatial/Structure';

const rigs: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); });

/** The harness Kitchen (walled by `structure`) and Terrace (open), saved for real, then their outline nodes. */
async function outlines(structure: Structure) {
	const rig = await structureEditor(); rigs.push(rig);
	const room = (id: string) => makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', geometry: { points: [...expectDefined(HARNESS_ZONES.find(zone => zone.id === id), id).points] } });
	const kitchen = room('harness-kitchen'), terrace = room('harness-terrace');
	for (const zone of [kitchen, terrace]) expectOk(await rig.stack.zones.save(zone, 'absent'));
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	const boundaries = structure.boundaries.map(boundary => ({ ...boundary, roomId: kitchen.id }));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...structure, boundaries } }, read.version));
	await rig.runtime.refreshProjection(); await settle();
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.zone'), 'zone layer');
	// A zone group's children are fill, outline, name, area — `ZoneShape.vue`'s template order.
	const outline = (id: string) => expectDefined(layer.findOne<Konva.Group>(`.${id}`), id).getChildren()[1] as Konva.Line;
	return { kitchen: outline(kitchen.id), terrace: outline(terrace.id) };
}

it('hides, but keeps mounted, the outline of a room its boundary walls enclose; an open room keeps its own', async () => {
	const { kitchen, terrace } = await outlines(HARNESS_STRUCTURE);
	expect(kitchen.stroke()).toBeTruthy();
	expect(kitchen.visible()).toBe(false);
	expect(terrace.visible()).toBe(true);
});

it('shows the outline again once one boundary wall moves off its edge', async () => {
	const walls = HARNESS_STRUCTURE.walls.map(wall => wall.id === 'wall-harness-west' ? { ...wall, start: { x: -200, y: 3000 }, end: { x: -200, y: 0 } } : wall);
	const { kitchen } = await outlines({ ...HARNESS_STRUCTURE, walls });
	expect(kitchen.visible()).toBe(true);
});
