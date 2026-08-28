import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createNoticeQueue,
	type NoticeCallbacks,
	type NoticeHandle,
	type NoticeHost,
	type NoticeView,
} from '../../../src/presentation/notices/queue';

/**
 * A host that records rather than draws, so every rule in the queue is a node test. It
 * keeps each handle LIVE until something hides it, which is the property the queue reads to
 * decide whether a visible slot is free.
 */
function recordingHost() {
	const opened: { view: NoticeView; callbacks: NoticeCallbacks; handle: NoticeHandle }[] = [];
	const host: NoticeHost = {
		open(view, callbacks) {
			let live = true;
			let current = view;
			const handle: NoticeHandle = {
				update: (next) => {
					current = next;
				},
				hide: () => {
					live = false;
				},
				get live() {
					return live;
				},
			};
			opened.push({
				get view() {
					return current;
				},
				callbacks,
				handle,
			} as (typeof opened)[number]);
			return handle;
		},
	};
	return { host, opened, live: () => opened.filter((o) => o.handle.live) };
}

describe('the notice queue', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('opens a notice for a push', () => {
		const { host, opened } = recordingHost();
		createNoticeQueue(host).push('error', 'boom');
		expect(opened).toHaveLength(1);
		expect(opened[0]?.view).toMatchObject({ severity: 'error', message: 'boom', count: 1 });
	});

	it('folds an identical repeat into a count rather than a second notice', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('error', 'boom');
		queue.push('error', 'boom');
		expect(opened).toHaveLength(1);
		expect(opened[0]?.view.count).toBe(2);
	});

	it('treats the same message at a different severity as a different notice', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('warning', 'same');
		queue.push('error', 'same');
		expect(opened).toHaveLength(2);
	});

	it('shows at most three at once and holds the rest back', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('error', message);
		expect(opened).toHaveLength(3);
		expect(opened.map((o) => o.view.message)).toEqual(['a', 'b', 'c']);
	});

	it('promotes a held notice into a freed slot rather than dropping it', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('error', message);

		// Both halves, in the order the real host performs them: the element goes, THEN the
		// hint arrives. `dismissed` only sweeps and promotes, and `sweep` reads `handle.live` —
		// so a hint alone, with the handle still live, frees nothing and promotes nothing.
		opened[0]?.handle.hide();
		opened[0]?.callbacks.dismissed();

		expect(opened).toHaveLength(4);
		expect(opened[3]?.view.message).toBe('d');
	});

	it('hides everything it still holds on dispose', () => {
		const { host, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('error', 'a');
		queue.push('error', 'b');
		queue.dispose();
		expect(live()).toHaveLength(0);
	});
});
