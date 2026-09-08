// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { ok } from '../../../src/core/result/Result';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.changePlan(); await settle(); rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle();
	return rig;
}

describe('planning target and projection boundaries', () => {
	it('offers current and intended elements once and saves a material against its chosen intended target', async () => {
		const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
		const input = elementInput(baseline, { id: 'element-current', kind: 'path', name: 'Garden path', points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] });
		const spatial = expectDefined(input.spatial, 'spatial input'), structure = expectDefined(spatial.structure, 'current structure');
		const intended = { ...structure, elements: [...structure.elements ?? [], { id: 'element-intended', kind: 'path' as const, points: [{ x: 0, y: 1000 }, { x: 4000, y: 1000 }] }] };
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, {
			...input, intended, spatial: { ...spatial, metadata: [...spatial.metadata ?? [], { id: 'element-intended', name: 'New path' }] },
		}, rig.runtime.structureTask.ledger)));
		await rig.runtime.refreshProjection(); await settle();
		const geometry = expectOk(await rig.geometry.read(rig.plan.id));
		await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
		const form = rig.wrapper.get('[data-rp-form="planning"]'), targets = form.get('select[name="target"]');
		const values = targets.findAll('option').map(option => option.attributes('value'));
		expect(values.filter(value => value === 'element-current')).toHaveLength(1);
		expect(values.filter(value => value === 'element-intended')).toHaveLength(1);
		await targets.setValue('element-intended');
		const asset = expectDefined(expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'piece'), 'count material').entity;
		await form.get('[name="asset"]').setValue(asset.id);
		await form.get('[name="state"]').setValue('intended'); await form.get('[name="rule"]').setValue('manual');
		await form.get('[name="manual"]').setValue('3'); await form.trigger('submit'); await settle();
		expect(rig.dialogs.current).toBeNull();
		const requirement = expectOk(await rig.stack.requirements.listByZone(rig.room.id))[0].entity;
		expect(requirement.source).toMatchObject({ targetId: 'element-intended', state: 'intended', rule: 'manual', manual: '3' });
		expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(geometry.document);
	});
	it('refuses a new draft when a completed planning read disagrees with the displayed geometry, then hydrates without writing', async () => {
		const rig = await setup(), services = expectDefined(rig.deps.commands.planning, 'planning');
		const previous = expectOk(await services.read(rig.plan.id)), geometry = expectOk(await rig.geometry.read(rig.plan.id));
		const document = { ...geometry.document, objects: geometry.document.objects.map(item => ({ ...item, points: item.points.map(point => ({ x: point.x + 100, y: point.y })) })) };
		expectOk(await rig.geometry.write(rig.plan.id, document, geometry.version));
		const read = vi.spyOn(services, 'read').mockResolvedValueOnce(ok(previous));
		await rig.runtime.refreshProjection(); await settle();
		expect(rig.runtime.planning.loading.value).toBe(false); expect(rig.runtime.writesBlocked.value).toBe(false);
		expect(rig.runtime.planning.baseline.value?.geometry.document).toEqual(previous.geometry.document);
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
		expect(rig.dialogs.current).toBeNull(); expect(run).not.toHaveBeenCalled();
		expect(read).toHaveBeenCalledTimes(2); expect(rig.runtime.planning.baseline.value?.geometry.document).toEqual(document);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
		await rig.wrapper.get('[data-rp-new-material]').trigger('click'); await settle();
		expect(rig.wrapper.find('[data-rp-form="planning"]').exists()).toBe(true);
		rig.dialogs.resolve('cancel'); await settle(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
