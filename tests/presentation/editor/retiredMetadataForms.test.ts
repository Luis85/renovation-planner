// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import RoomNameForm from '../../../src/presentation/editor/naming/RoomNameForm.vue';
import AreaDetailsForm from '../../../src/presentation/editor/metadata/AreaDetailsForm.vue';
import { defer, settle } from '../../helpers/async';
import { injectedPersistenceError } from '../../helpers/domain';
import { err } from '../../../src/core/result/Result';
import { recorder } from '../../helpers/logger';

it.each(['room', 'area'] as const)('does not restore focus into a retired %s metadata form after a failed save', async kind => {
	const pending = defer<void>(), busy = ref(false);
	const dispatch = vi.fn(async () => { await pending.promise; return err(injectedPersistenceError()); });
	const shared = { busy, blocked: ref(false), latest: ref<string | null>(null), dispatch, logger: recorder };
	const form = kind === 'room' ? mount(RoomNameForm, { attachTo: document.body, props: { ...shared, name: 'Original room' } })
		: mount(AreaDetailsForm, { attachTo: document.body, props: { ...shared, value: { name: 'Original area', zoneType: 'Garden' } } });
	const outside = document.createElement('button'); outside.textContent = 'Other leaf'; document.body.append(outside);
	try {
		await form.get('input[name="name"]').setValue('Retained new name'); await form.trigger('submit');
		expect(dispatch).toHaveBeenCalledOnce(); expect(busy.value).toBe(true);
		form.unmount(); outside.focus(); pending.resolve(); await settle();
		expect(document.activeElement).toBe(outside); expect(form.emitted('submit')).toBeUndefined(); expect(form.element.isConnected).toBe(false);
	} finally { pending.resolve(); if (form.element.isConnected) form.unmount(); outside.remove(); }
});
