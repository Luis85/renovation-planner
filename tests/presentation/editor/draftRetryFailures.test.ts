// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, injectedPersistenceError } from '../../helpers/domain';
import { defer, settle } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup(kind: 'planning' | 'renovation') {
	const rig = await renovationEditor(true); mounted.push(rig);
	await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(rig.room.id, 'materials'); await settle();
	if (kind === 'planning') await rig.wrapper.get('[data-rp-new-material]').trigger('click');
	else void rig.runtime.renovation.edit('existing', rig.room.id);
	await settle();
	const field = rig.wrapper.get<HTMLInputElement | HTMLTextAreaElement>(kind === 'planning' ? '[name="waste"]' : '[name="description"]');
	await field.setValue(kind === 'planning' ? '17,5' : 'Retained boards');
	const services = expectDefined(rig.deps.commands.planning, 'planning');
	const read = vi.spyOn(services, 'read').mockResolvedValue(err(injectedPersistenceError()));
	rig.changeCatalogue(); await settle();
	const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
	return { ...rig, read, report, field };
}

describe.each(['planning', 'renovation'] as const)('%s draft retry failures', kind => {
	it.each(['inspector', 'requirements'] as const)('reports a rejected %s query once, retains the draft and permits another read-only retry', async source => {
		const rig = await setup(kind), fault = new Error('retry query fault');
		const previous = rig.runtime.inspectorDto.value, bytes = [...rig.stack.vault.entries], text = rig.field.element.value;
		if (source === 'inspector') vi.spyOn(rig.deps.commands.zoneInspector, 'execute').mockRejectedValueOnce(fault);
		else vi.spyOn(rig.deps.queries, 'getRequirementsForZone').mockRejectedValueOnce(fault);
		await rig.wrapper.get('.rp-draft-recovery button').trigger('click'); await settle();
		expect(rig.report).toHaveBeenCalledExactlyOnceWith(fault, rig.deps.commands.logger, 'editor.refresh.failed');
		expect(rig.runtime.inspectorDto.value).toBe(previous); expect(rig.field.element.value).toBe(text);
		expect(rig.wrapper.get('.rp-draft-recovery button').attributes('aria-disabled')).toBe('false');
		expect([...rig.stack.vault.entries]).toEqual(bytes);
		rig.read.mockRestore(); await rig.wrapper.get('.rp-draft-recovery button').trigger('click'); await settle();
		expect(rig.wrapper.find('.rp-draft-recovery').exists()).toBe(false); expect(rig.field.element.value).toBe(text);
		expect(rig.runtime.writesBlocked.value).toBe(false); expect(rig.report).toHaveBeenCalledOnce();
		rig.dialogs.resolve('cancel'); await settle(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('does not report a pending retry failure into a retired leaf', async () => {
		const rig = await setup(kind), pending = defer<void>();
		const query = vi.spyOn(rig.deps.commands.zoneInspector, 'execute').mockReturnValueOnce(pending.promise.then(() => { throw new Error('retired retry'); }));
		await rig.wrapper.get('.rp-draft-recovery button').trigger('click'); await settle(); expect(query).toHaveBeenCalledOnce();
		rig.unmount(); pending.resolve(undefined); await settle();
		expect(rig.report).not.toHaveBeenCalled();
	});
});
