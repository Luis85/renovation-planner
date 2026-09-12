// @vitest-environment jsdom
/** ADR-0029: a moved room caption is drawn at its anchor plus its offset, and a live drag preview overrides it. */
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { labelAnchor } from '../../../src/presentation/editor/layers/zone/ZoneRenderModel';

const rigs: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); });

const square = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];

it('draws a moved room caption at its anchor plus its offset, and follows a live drag preview', async () => {
	const rig = await structureEditor(); rigs.push(rig);
	const zone = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', geometry: { points: square }, labelOffset: { dx: 600, dy: -400 } });
	expectOk(await rig.stack.zones.save(zone, 'absent'));
	await rig.runtime.refreshProjection(); await settle();
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.zone'), 'zone layer');
	// A zone group's children are fill, outline, name, area — `ZoneShape.vue`'s template order.
	const name = () => expectDefined(layer.findOne<Konva.Group>(`.${zone.id}`), zone.id).getChildren()[2] as Konva.Text;
	const anchor = labelAnchor(square);
	expect({ x: name().x(), y: name().y() }).toEqual({ x: anchor.x + 600, y: anchor.y - 400 });
	rig.runtime.renderState.labelPreview = { id: zone.id, offset: { dx: 0, dy: 0 } }; await settle();
	expect({ x: name().x(), y: name().y() }).toEqual(anchor);
	rig.runtime.renderState.labelPreview = null; await settle();
	expect(name().x()).toBe(anchor.x + 600);
});
