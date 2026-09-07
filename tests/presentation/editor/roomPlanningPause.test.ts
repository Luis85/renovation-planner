// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, injectedPersistenceError } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { err } from '../../../src/core/result/Result';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

describe.each(['name', 'dimensions'] as const)('Room %s planning pause', kind => {
	it.each(['read-failed', 'unrecovered'] as const)('announces and enforces %s before opening and in a retained form', async reason => {
		const rig = await renovationEditor(true); mounted.push(rig); await rig.runtime.refreshProjection(); await settle();
		const action = kind === 'name' ? rig.runtime.renameRoom : rig.runtime.resizeRoom;
		const selector = kind === 'name' ? '[data-rp-form="room-name"]' : '.rp-room-dimensions';
		const fieldName = kind === 'name' ? 'name' : 'width', value = kind === 'name' ? 'Preserved room name' : '5.5';
		void action(rig.room.id); await settle();
		const form = rig.wrapper.get(selector), field = form.get<HTMLInputElement>(`[name="${fieldName}"]`);
		await field.setValue(value); field.element.focus();
		const services = expectDefined(rig.deps.commands.planning, 'planning');
		const read = vi.spyOn(services, 'read');
		if (reason === 'read-failed') { read.mockResolvedValue(err(injectedPersistenceError())); rig.changeCatalogue(); }
		else useSaveStateStore(rig.pinia).markUnrecovered();
		await settle();
		expect(rig.project.stale).toBe(false); expect(rig.runtime.writesBlocked.value).toBe(true);
		expect(rig.runtime.renameRoomBlocked.value).toBe(true); expect(rig.runtime.resizeRoomBlocked.value).toBe(true);
		expect(field.element.readOnly).toBe(true); expect(field.element.value).toBe(value); expect(document.activeElement).toBe(field.element);
		expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
		const bytes = [...rig.stack.vault.entries], dispatch = vi.spyOn(rig.runtime.dispatcher, 'run');
		await form.trigger('submit'); await settle(); expect(dispatch).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		rig.dialogs.resolve('cancel'); await settle();
		for (const name of ['rename-room', 'resize-room']) expect(rig.wrapper.get(`[data-rp-action="${name}"]`).attributes('aria-disabled')).toBe('true');
		void action(rig.room.id); await settle(); expect(rig.dialogs.current).toBeNull();
		read.mockRestore(); await rig.runtime.refreshProjection(); await settle();
		expect(rig.runtime.renameRoomBlocked.value).toBe(reason === 'unrecovered');
		expect(rig.runtime.resizeRoomBlocked.value).toBe(reason === 'unrecovered');
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
