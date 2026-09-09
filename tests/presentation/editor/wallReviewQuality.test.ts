// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createPinia } from 'pinia';
import WallRotationForm from '../../../src/presentation/editor/structure/WallRotationForm.vue';
import type { Structure } from '../../../src/domain/spatial/Structure';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../src/core/result/Result';
import { WALL_LOOP } from '../../helpers/structure';
import { defer } from '../../helpers/async';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();
const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });
function setup() {
	const busy = ref(false), blocked = ref(false), retired = ref(false);
	const dispatch = vi.fn<(next: Structure) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote'));
	const preview = vi.fn<(next: Structure | null) => void>(), retry = vi.fn<() => Promise<void>>().mockResolvedValue(undefined), openSource = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
	const wrapper = mount(WallRotationForm, { global: { plugins: [createPinia()] }, props: { structure: { ...WALL_LOOP, boundaries: [{ roomId: 'room-unavailable', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }] }, wallId: 'wall-a', degrees: 30, busy, blocked, retired, roomNames: {}, dispatch, preview, retry, openSource } });
	mounted.push(wrapper); return { wrapper, busy, blocked, retired, dispatch, preview, retry, openSource };
}

it('keeps a retired wall review visibly read-only and refuses queued input and Apply', async () => {
	const r = setup(); expect(r.wrapper.text()).toContain('room-unavailable');
	r.blocked.value = true; r.retired.value = true; await r.wrapper.vm.$nextTick();
	expect(r.wrapper.get('input').element).toHaveProperty('readOnly', true);
	await r.wrapper.get('input').setValue('45'); await r.wrapper.get('form').trigger('submit');
	expect(r.wrapper.get('input').element).toHaveProperty('value', '30'); expect(r.dispatch).not.toHaveBeenCalled();
	expect(r.wrapper.find('.rp-draft-recovery').exists()).toBe(false); expect(r.preview).toHaveBeenLastCalledWith(null);
});
it('keeps readback retry and source navigation available until wall-review retirement', async () => {
	const r = setup(); r.blocked.value = true; await r.wrapper.vm.$nextTick();
	const buttons = r.wrapper.findAll('.rp-draft-recovery button'); expect(buttons).toHaveLength(2);
	await buttons[0].trigger('click'); await buttons[1].trigger('click'); expect(r.retry).toHaveBeenCalledOnce(); expect(r.openSource).toHaveBeenCalledOnce();
	r.retired.value = true; await r.wrapper.vm.$nextTick(); expect(r.wrapper.find('.rp-draft-recovery').exists()).toBe(false);
});
it.each(['throw', 'refuse', 'superseded'] as const)('retains a wall review after %s and preserves the failed command outcome', async mode => {
	const r = setup();
	if (mode === 'throw') r.dispatch.mockRejectedValueOnce(new Error('Write failed'));
	else r.dispatch.mockResolvedValueOnce(err({ category: 'Persistence', code: mode === 'superseded' ? 'undo.superseded' : 'spatial.write-failed', message: 'Write refused.' }));
	await r.wrapper.get('form').trigger('submit'); await r.wrapper.vm.$nextTick();
	expect(r.wrapper.find('[role="alert"]').exists()).toBe(true); expect(r.wrapper.emitted('submit')).toBeUndefined(); expect(r.busy.value).toBe(false);
	expect(r.wrapper.get('input').element).toHaveProperty('value', '30');
	await r.wrapper.get('form').trigger('submit');
	expect(r.dispatch).toHaveBeenCalledTimes(mode === 'superseded' ? 1 : 2);
	expect(r.wrapper.emitted('submit')?.length ?? 0).toBe(mode === 'superseded' ? 0 : 1);
});
it.each(['resolve', 'reject'] as const)('ignores a late wall-review %s after disposal without submitting the retired dialog', async outcome => {
	const r = setup(), pending = defer<void>(); r.dispatch.mockReturnValueOnce(pending.promise.then(() => { if (outcome === 'reject') throw new Error('Late failure'); return ok('wrote'); }));
	await r.wrapper.get('form').trigger('submit'); r.wrapper.unmount(); mounted.pop();
	pending.resolve(); await flushPromises();
	expect(r.wrapper.emitted('submit')).toBeUndefined(); expect(r.busy.value).toBe(true);
	expect(r.preview).toHaveBeenLastCalledWith(null);
});
