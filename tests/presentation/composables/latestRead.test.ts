import { describe, expect, it, vi } from 'vitest';
import { createLatestRead } from '../../../src/presentation/composables/latest-read';
import { defer } from '../../helpers/async';

describe('coalesced projection reads', () => {
	it('continues with the latest queued read after an obsolete read rejects', async () => {
		const old = defer<void>(), publish = vi.fn<(value: number) => void>();
		const read = vi.fn<() => Promise<number>>().mockReturnValueOnce(old.promise.then(() => { throw new Error('obsolete'); })).mockResolvedValue(2);
		const queue = createLatestRead(read, publish), first = queue.refresh(); await Promise.resolve();
		const second = queue.refresh(); old.resolve(undefined); await Promise.all([first, second]);
		expect(read).toHaveBeenCalledTimes(2); expect(publish.mock.calls).toEqual([[2]]);
	});
	it('settles disposal without publishing or retrying a subsequently rejected read', async () => {
		const pending = defer<void>(), publish = vi.fn<(value: number) => void>();
		const read = vi.fn<() => Promise<number>>(() => pending.promise.then(() => { throw new Error('closed'); }));
		const queue = createLatestRead(read, publish), request = queue.refresh(); await Promise.resolve();
		queue.dispose(); await request; pending.resolve(undefined); await Promise.resolve(); await Promise.resolve();
		expect(read).toHaveBeenCalledOnce(); expect(publish).not.toHaveBeenCalled();
	});
 it('coalesces a same-turn burst and keeps one latest follow-up for invalidations during a read', async () => {
  const old = defer<number>(), latest = defer<number>(), publish = vi.fn<(value: number) => void>();
  const read = vi.fn<() => Promise<number>>().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const queue = createLatestRead<number>(read, publish);
  const requests = Array.from({ length: 100 }, () => queue.refresh());
  await Promise.resolve(); expect(read).toHaveBeenCalledTimes(1);
  requests.push(...Array.from({ length: 100 }, () => queue.refresh()));
  old.resolve(1); await Promise.resolve(); await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(2); expect(publish).not.toHaveBeenCalled();
  latest.resolve(2); await Promise.all(requests);
  expect(publish.mock.calls).toEqual([[2]]);
 });
 it('releases waiters on disposal and never publishes a late response or starts more work', async () => {
  const pending = defer<number>(), read = vi.fn<() => Promise<number>>(() => pending.promise), publish = vi.fn<(value: number) => void>();
  const queue = createLatestRead(read, publish), request = queue.refresh();
  await Promise.resolve(); queue.dispose(); await request;
  await queue.refresh(); pending.resolve(1); await Promise.resolve();
  expect(read).toHaveBeenCalledOnce(); expect(publish).not.toHaveBeenCalled();
 });
 it('does not start a queued read after immediate disposal', async () => {
  const read = vi.fn<() => Promise<number>>(() => Promise.resolve(1)), publish = vi.fn<(value: number) => void>(), queue = createLatestRead(read, publish);
  const request = queue.refresh(); queue.dispose(); await request; await Promise.resolve();
  expect(read).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
 });
 it('recovers after a rejected read and after a failed publication', async () => {
  const fault = new Error('offline'), read = vi.fn<() => Promise<number>>().mockRejectedValueOnce(fault).mockResolvedValue(3);
  const publish = vi.fn<(value: number) => void>().mockImplementationOnce(() => { throw fault; });
  const queue = createLatestRead<number>(read, publish);
  await expect(queue.refresh()).rejects.toBe(fault);
  await expect(queue.refresh()).rejects.toBe(fault);
  await queue.refresh(); expect(read).toHaveBeenCalledTimes(3);
  expect(publish).toHaveBeenCalledTimes(2);
 });
 it('honours a reentrant invalidation during publication', async () => {
  let request: Promise<void> | undefined;
  let value = 0;
  const read = vi.fn<() => Promise<number>>(() => Promise.resolve(++value));
  const queue = createLatestRead(read, published => { if (published === 1) request = queue.refresh(); });
  await queue.refresh(); await request; expect(read).toHaveBeenCalledTimes(2);
 });
});
