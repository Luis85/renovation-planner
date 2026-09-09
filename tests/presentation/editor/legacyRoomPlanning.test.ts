// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeRequirement } from '../../helpers/entities';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await structureEditor(true); mounted.push(rig);
	const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
	const room = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Legacy room', zoneType: 'Room', geometry: { points } })).zone.entity;
	await rig.runtime.refreshProjection(); rig.selection.select([room.id]); await settle();
	return { ...rig, room, points };
}

it('admits Room planning on a legacy geometry document without explicit structure', async () => {
	const rig = await setup(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure).toBeUndefined();
	const before = [...rig.stack.vault.entries]; rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle();
	await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
	expect(rig.wrapper.find('[data-rp-form="planning"]').exists()).toBe(true);
	rig.dialogs.resolve('cancel'); await settle(); expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
});

it('counts and navigates an old Room-origin material without newer source metadata', async () => {
	const rig = await setup(), asset = expectDefined(expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'm2'), 'area asset').entity;
	const requirement = makeRequirement({ projectId: rig.plan.projectId, assetId: asset.id, origin: { kind: 'zone', zoneId: rig.room.id } });
	expect(requirement.source).toBeUndefined(); expectOk(await rig.stack.requirements.save(requirement, 'absent'));
	await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'overview'); await settle();
	const before = [...rig.stack.vault.entries], link = rig.wrapper.get<HTMLButtonElement>('[data-rp-linked="materials"]');
	expect(link.text()).toContain('1'); link.element.focus(); link.element.click(); await settle();
	expect(useRenovationSession(rig.pinia).mode).toBe('materials');
	expect(rig.wrapper.get(`[data-rp-record="${requirement.id}"]`).text()).toContain(asset.name);
	rig.runtime.renovation.focus(rig.room.id, 'materials', requirement.id); await settle();
	expect(rig.stage?.findOne('.material-source')?.getAttr('points')).toEqual(rig.points.flatMap(point => [point.x, point.y]));
	expect([...rig.stack.vault.entries]).toEqual(before);
});
