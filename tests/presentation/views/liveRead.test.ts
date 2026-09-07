// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { useLiveRead, type LiveReadSource } from '../../../src/presentation/composables/live-read';
import type { AppError } from '../../../src/core/errors/AppError';
import { err, ok, type Result } from '../../../src/core/result/Result';
import { defer } from '../../helpers/async';
function harness(source?: LiveReadSource<string>) {
 let projection!: ReturnType<typeof useLiveRead<string>>;
 const wrapper = mount(defineComponent({ setup() { projection = useLiveRead(source); return () => h('p', projection.data.value ?? ''); } }));
 return { wrapper, projection };
}
describe('live Project projections', () => {
 it('keeps writes paused while an invalidated read drains into its newer held read', async () => {
  const first = defer<Result<string, AppError>>(), next = defer<Result<string, AppError>>();
  const read = vi.fn<LiveReadSource<string>['read']>().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
  const rig = harness({ read, onChanged: () => () => {} });
  try {
   await flushPromises(); const refresh = rig.projection.refresh();
   first.resolve(ok('obsolete')); await flushPromises();
   expect(read).toHaveBeenCalledTimes(2); expect(rig.projection.data.value).toBeNull(); expect(rig.projection.loading.value).toBe(true); expect(rig.projection.paused.value).toBe(true);
   next.resolve(ok('current')); await refresh;
   expect(rig.projection.data.value).toBe('current'); expect(rig.projection.paused.value).toBe(false);
  } finally { rig.wrapper.unmount(); }
 });
 it('retains last successful data after returned and thrown failures, and recovers by reading only', async () => {
  const failure: AppError = { category: 'Persistence', code: 'test.offline', message: 'Offline' };
  const read = vi.fn<LiveReadSource<string>['read']>().mockResolvedValueOnce(ok('last facts')).mockResolvedValueOnce(err(failure)).mockRejectedValueOnce(new Error('Host read failed')).mockResolvedValueOnce(ok('fresh facts'));
  const rig = harness({ read, onChanged: () => () => {} });
  try {
   await flushPromises(); await rig.projection.refresh(); expect(rig.projection.data.value).toBe('last facts'); expect(rig.projection.error.value).toEqual(failure); expect(rig.projection.paused.value).toBe(true);
   await rig.projection.refresh(); expect(rig.projection.error.value?.code).toBe('view.read-failed'); expect(rig.projection.data.value).toBe('last facts');
   await rig.projection.refresh(); expect(rig.projection.data.value).toBe('fresh facts'); expect(rig.projection.error.value).toBeNull(); expect(rig.projection.paused.value).toBe(false);
  } finally { rig.wrapper.unmount(); }
 });
 it('retires subscriptions and ignores late reads or captured refreshes after unmount', async () => {
  const held = defer<Result<string, AppError>>(), read = vi.fn<LiveReadSource<string>['read']>(() => held.promise), dispose = vi.fn<() => void>();
  const rig = harness({ read, onChanged: () => dispose }); await flushPromises();
  const refresh = rig.projection.refresh(); rig.wrapper.unmount(); held.resolve(ok('late')); await refresh; await flushPromises();
  expect(dispose).toHaveBeenCalledOnce(); expect(rig.projection.data.value).toBeNull(); await rig.projection.refresh(); expect(read).toHaveBeenCalledOnce();
 });
 it('keeps an unavailable service paused with the unrecovered-settings reason', async () => {
  const rig = harness();
  try { await flushPromises(); expect(rig.projection.error.value?.code).toBe('settings.unrecovered'); expect(rig.projection.paused.value).toBe(true); expect(rig.projection.loading.value).toBe(false); } finally { rig.wrapper.unmount(); }
 });
});
