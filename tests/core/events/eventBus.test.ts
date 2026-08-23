import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';

describe('EventBus', () => {
	it('delivers a published event to every subscriber of its type', async () => {
		const bus = createEventBus();
		const first = vi.fn<() => void>();
		const second = vi.fn<() => void>();
		bus.subscribe('zone-created', first);
		bus.subscribe('zone-created', second);
		await bus.publish({ type: 'zone-created' });
		expect(first).toHaveBeenCalledOnce();
		expect(second).toHaveBeenCalledOnce();
	});

	it('does not deliver to subscribers of other types', async () => {
		const bus = createEventBus();
		const handler = vi.fn<() => void>();
		bus.subscribe('zone-created', handler);
		await bus.publish({ type: 'zone-deleted' });
		expect(handler).not.toHaveBeenCalled();
	});

	it('stops delivery to a disposed subscriber only', async () => {
		const bus = createEventBus();
		const kept = vi.fn<() => void>();
		const dropped = vi.fn<() => void>();
		bus.subscribe('e', kept);
		const disposable = bus.subscribe('e', dropped);
		disposable.dispose();
		await bus.publish({ type: 'e' });
		expect(dropped).not.toHaveBeenCalled();
		expect(kept).toHaveBeenCalledOnce();
	});

	it('awaits asynchronous handlers before publish settles', async () => {
		const bus = createEventBus();
		let finished = false;
		bus.subscribe('slow', async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, 5);
			});
			finished = true;
		});
		await bus.publish({ type: 'slow' });
		expect(finished).toBe(true);
	});

	it('isolates a throwing sync handler: siblings run and publish does not reject', async () => {
		const onError = vi.fn<(error: unknown, event: { type: string }) => void>();
		const bus = createEventBus(onError);
		const after = vi.fn<() => void>();
		bus.subscribe('e', () => {
			throw new Error('handler blew up');
		});
		bus.subscribe('e', after);
		await expect(bus.publish({ type: 'e' })).resolves.toBeUndefined();
		expect(after).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledTimes(1);
	});

	it('isolates a rejecting async handler the same way', async () => {
		const onError = vi.fn<(error: unknown, event: { type: string }) => void>();
		const bus = createEventBus(onError);
		const after = vi.fn<() => void>();
		bus.subscribe('e', () => Promise.reject(new Error('async handler blew up')));
		bus.subscribe('e', after);
		await expect(bus.publish({ type: 'e' })).resolves.toBeUndefined();
		expect(after).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(expect.any(Error), { type: 'e' });
	});

	it('survives a handler failure when no onError was wired', async () => {
		const bus = createEventBus();
		bus.subscribe('e', () => {
			throw new Error('unobserved');
		});
		await expect(bus.publish({ type: 'e' })).resolves.toBeUndefined();
	});

	it('hands onError the failing event, not just the error', async () => {
		const onError = vi.fn<(error: unknown, event: { type: string }) => void>();
		const bus = createEventBus(onError);
		bus.subscribe('zone-geometry-changed', () => {
			throw new Error('boom');
		});
		await bus.publish({ type: 'zone-geometry-changed' });
		expect(onError).toHaveBeenCalledWith(
			expect.any(Error),
			{ type: 'zone-geometry-changed' },
		);
	});

	it('isolates a THROWING onError: publish still resolves and siblings still run', async () => {
		const bus = createEventBus(() => {
			throw new Error('the logger itself is broken');
		});
		const after = vi.fn<() => void>();
		bus.subscribe('e', () => {
			throw new Error('handler blew up');
		});
		bus.subscribe('e', after);
		await expect(bus.publish({ type: 'e' })).resolves.toBeUndefined();
		expect(after).toHaveBeenCalledOnce();
	});

	it('registers a handler subscribed twice under one type exactly once', async () => {
		const bus = createEventBus();
		const handler = vi.fn<() => void>();
		const first = bus.subscribe('e', handler);
		bus.subscribe('e', handler);
		first.dispose();
		await bus.publish({ type: 'e' });
		expect(handler).not.toHaveBeenCalled();
	});

	it('double-disposing is safe and cannot detach a later subscription of the same type', async () => {
		const bus = createEventBus();
		const first = vi.fn<() => void>();
		const second = vi.fn<() => void>();
		const disposable = bus.subscribe('e', first);
		disposable.dispose();
		bus.subscribe('e', second);
		disposable.dispose(); // stale: its set was already removed from the map
		await bus.publish({ type: 'e' });
		expect(second).toHaveBeenCalledOnce();
	});

	it('a subscriber added mid-dispatch does not receive the event in flight', async () => {
		const bus = createEventBus();
		const latecomer = vi.fn<() => void>();
		let published: Promise<void> | undefined;
		bus.subscribe('e', () => {
			published ??= bus.publish({ type: 'e' }).then(() => undefined);
			bus.subscribe('e', latecomer);
		});
		await bus.publish({ type: 'e' });
		await published;
		expect(latecomer).not.toHaveBeenCalled();
	});

	it('re-subscribing after disposal to the same type delivers again', async () => {
		const bus = createEventBus();
		const handler = vi.fn<() => void>();
		const disposable = bus.subscribe('e', handler);
		disposable.dispose();
		bus.subscribe('e', handler);
		await bus.publish({ type: 'e' });
		expect(handler).toHaveBeenCalledOnce();
	});
});
