// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { nextTick, ref } from 'vue';
import WallRotationForm from '../../../src/presentation/editor/structure/WallRotationForm.vue';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../src/core/result/Result';
import { defer } from '../../helpers/async';
import { injectedPersistenceError } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { settle } from '../../helpers/editor';

let wrapper: VueWrapper | undefined;
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.restoreAllMocks(); });
function setup(degrees = 90) {
	const busy = ref(false), blocked = ref(false), retired = ref(false);
	const dispatch = vi.fn<() => Promise<DispatchResult>>().mockResolvedValue(ok('wrote'));
	const retry = vi.fn<() => Promise<void>>().mockImplementation(() => { blocked.value = false; return Promise.resolve(); });
	const openSource = vi.fn<() => Promise<void>>().mockResolvedValue(undefined), preview = vi.fn<InstanceType<typeof WallRotationForm>['$props']['preview']>();
	wrapper = mount(WallRotationForm, { attachTo: document.body, global: { plugins: [createPinia()] }, props: {
		structure: { ...WALL_LOOP, boundaries: [{ roomId: 'unreadable-room', wallIds: ['wall-a'] }] },
		wallId: 'wall-a', degrees, busy, blocked, retired, roomNames: {}, dispatch, retry, openSource, preview,
	} });
	return { form: wrapper, busy, blocked, retired, dispatch, retry, openSource, preview };
}

it('shows invalid initial geometry without a false impact and retains an unreadable Room identity', async () => {
	const rig = setup(180);
	expect(rig.form.get('input').attributes('aria-invalid')).toBe('true');
	expect(rig.form.find('[role="status"]').exists()).toBe(false);
	await rig.form.trigger('submit'); expect(rig.dispatch).not.toHaveBeenCalled();
	await rig.form.get('input').setValue('90'); await rig.form.trigger('submit');
	expect(rig.form.text()).toContain('unreadable-room'); expect(rig.form.text()).toContain('3 walls change');
	expect(rig.dispatch).not.toHaveBeenCalled();
});

it('keeps a recoverable dispatcher exception editable and requires review before retry', async () => {
	const rig = setup(); rig.dispatch.mockRejectedValueOnce(new Error('write transport failed'));
	await rig.form.trigger('submit'); await settle();
	expect(rig.form.get('[role="alert"]').text()).not.toBe(''); expect(rig.busy.value).toBe(false);
	expect(rig.form.get('input').element).toHaveProperty('readOnly', false);
	await rig.form.get('input').setValue('45'); expect(rig.form.find('[role="alert"]').exists()).toBe(false);
	await rig.form.trigger('submit'); expect(rig.dispatch).toHaveBeenCalledTimes(1);
	await rig.form.trigger('submit'); await settle(); expect(rig.dispatch).toHaveBeenCalledTimes(2);
	expect(rig.form.emitted('submit')).toHaveLength(1);
});

it.each(['undo.superseded', 'test.injected-failure'])('keeps refusal semantics for %s without silently retrying', async code => {
	const rig = setup(); rig.dispatch.mockResolvedValueOnce(err({ ...injectedPersistenceError(), code }));
	await rig.form.trigger('submit'); await settle(); expect(rig.dispatch).toHaveBeenCalledTimes(1);
	expect(rig.form.get('[role="alert"]').text()).not.toBe(''); expect(rig.busy.value).toBe(false);
	expect(rig.form.get('input').element).toHaveProperty('readOnly', code === 'undo.superseded');
	await rig.form.trigger('submit'); await settle();
	expect(rig.dispatch).toHaveBeenCalledTimes(code === 'undo.superseded' ? 1 : 2);
});

it.each(['resolved', 'rejected'])('does not revive an unmounted wall form after dispatch %s', async outcome => {
	const rig = setup(), pending = defer<void>();
	rig.dispatch.mockImplementationOnce(async () => { await pending.promise; if (outcome === 'rejected') throw new Error('late transport failed'); return ok('wrote'); });
	await rig.form.trigger('submit'); expect(rig.busy.value).toBe(true);
	rig.form.unmount(); wrapper = undefined;
	pending.resolve();
	await settle(); expect(rig.form.emitted('submit')).toBeUndefined(); expect(rig.preview).toHaveBeenLastCalledWith(null);
	expect(rig.form.element.isConnected).toBe(false);
});

it('offers read-only recovery, restores owned focus and suppresses recovery after retirement', async () => {
	const rig = setup(); rig.blocked.value = true; await nextTick();
	const recovery = rig.form.get('.rp-draft-recovery');
	await recovery.findAll('button')[1].trigger('click'); expect(rig.openSource).toHaveBeenCalledOnce();
	recovery.findAll('button')[0].element.focus(); await recovery.findAll('button')[0].trigger('click'); await settle();
	expect(rig.retry).toHaveBeenCalledOnce(); expect(rig.form.find('.rp-draft-recovery').exists()).toBe(false);
	expect(document.activeElement).toBe(rig.form.get('input').element); expect(rig.dispatch).not.toHaveBeenCalled();
	rig.blocked.value = true; rig.retired.value = true; await nextTick();
	expect(rig.form.find('.rp-draft-recovery').exists()).toBe(false); expect(rig.form.get('input').element).toHaveProperty('readOnly', true);
});
