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
