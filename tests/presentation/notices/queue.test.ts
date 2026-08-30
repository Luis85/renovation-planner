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


	/**
	 * **Design slice 17's preemption, and the exposure it closes.**
	 *
	 * `AUTO_DISMISS_MS` gives `warning` and `error` no timer at all, so three standing warnings
	 * fill every visible slot and never leave. `severity.ts` recorded the consequence before
	 * anything depended on it: every later `notifyError` is queued invisibly AND unannounced,
	 * because `announce` rides `render` and `render` runs only for a notice actually shown.
	 * Slice 17's table routes a dozen categories to a toast, which is what turned that from a
	 * tolerable edge into a load-bearing policy.
	 *
	 * The remedy is the one that file pre-selected — "giving `error` priority over a held
	 * `warning` rather than raising `MAX_VISIBLE_NOTICES`, which only moves the number at which
	 * this starts".
	 */
	describe('an error arriving behind a full screen of warnings', () => {
		function threeStandingWarnings() {
			const recorder = recordingHost();
			const queue = createNoticeQueue(recorder.host);
			// Three distinct sentences, none of which dedups into another and none of which
			// expires. This is one command and one background cascade away in a real vault:
			// `background.unsupported`, `cascade.aborted`, `cascade.stale-marker-failed`.
			queue.push('warning', 'first');
			queue.push('warning', 'second');
			queue.push('warning', 'third');
			return { ...recorder, queue };
		}

		it('is shown, by taking a slot from a held warning', () => {
			const { queue, live } = threeStandingWarnings();
			expect(live()).toHaveLength(3);

			queue.push('error', 'the one that matters');

			expect(live().map((o) => o.view.message)).toContain('the one that matters');
			expect(live()).toHaveLength(3);
		});

		it('takes the NEWEST warning slot, not the oldest', () => {
			// The oldest has been on screen longest and is likeliest to have been read; the
			// newest is the one the user is least likely to have taken in already.
			const { queue, live } = threeStandingWarnings();

			queue.push('error', 'urgent');

			const shown = live().map((o) => o.view.message);
			expect(shown).toContain('first');
			expect(shown).not.toContain('third');
		});

		it('keeps the demoted warning rather than dropping it', () => {
			// Demotion is not dismissal. The warning goes back to the held set and is promoted
			// into the next freed slot, which is what the queue already guarantees for anything
			// that never got one.
			const { queue, live, opened } = threeStandingWarnings();
			queue.push('error', 'urgent');

			// Both halves, in the order the real host performs them: the element goes, THEN the
			// hint arrives. `dismissed` only sweeps and promotes, and `sweep` reads `handle.live`.
			const urgent = opened.find((o) => o.view.message === 'urgent');
			urgent?.handle.hide();
			urgent?.callbacks.dismissed();

			expect(live().map((o) => o.view.message)).toContain('third');
		});

		it('leaves a HOVERED warning alone and holds the error instead', () => {
			// The queue's pause contract outranks preemption: `paused` means the pointer is over
			// that notice or its dismiss control has focus, and taking it away mid-read — or
			// pulling a focused button out of the tab order — is worse than making the error
			// wait. With every visible warning paused there is no victim, so the error stays
			// held, which is exactly what the cap alone would have done.
			const { queue, live, opened } = threeStandingWarnings();
			for (const entry of opened) entry.callbacks.pause();

			queue.push('error', 'urgent');

			expect(live().map((o) => o.view.message)).toEqual(['first', 'second', 'third']);
		});

		it('never opens a warning it is about to demote for a held error', () => {
			// **An announcement is made at `open`, so opening-then-hiding is not free.**
			// `createObsidianHost.open` announces during its initial render, so a warning shown
			// for one synchronous instant and immediately demoted still reaches a screen reader —
			// a message a sighted user never had the chance to read. The fill loop must not hand
			// a slot to a warning while an error is waiting for one.
			const { host, opened, live } = recordingHost();
			const queue = createNoticeQueue(host);
			queue.push('error', 'e1');
			queue.push('error', 'e2');
			queue.push('error', 'e3');
			// Both held behind a full screen, the warning FIRST so a strict FIFO fill reaches it
			// before the error.
			queue.push('warning', 'held-warning');
			queue.push('error', 'held-error');
			expect(opened.map((o) => o.view.message)).toEqual(['e1', 'e2', 'e3']);

			// Free exactly one slot.
			opened[0]?.handle.hide();
			opened[0]?.callbacks.dismissed();

			// The freed slot goes to the held ERROR, and the warning is never constructed at all.
			expect(live().map((o) => o.view.message)).toEqual(['e2', 'e3', 'held-error']);
			expect(opened.map((o) => o.view.message)).not.toContain('held-warning');
		});

		it('preempts as soon as the interaction that protected a warning ends', () => {
			// **The hole the pause guard opened, and the reason it needs closing rather than
			// reverting.** Holding the error while every warning is being read is right; leaving
			// it held once the pointer moves away is not. A warning has no auto-dismiss timer, so
			// `arm` does nothing for it and `resume` alone would never retry — the error would
			// stay invisible AND unannounced until some unrelated push or dismissal happened to
			// run `promote` again.
			const { queue, live, opened } = threeStandingWarnings();
			for (const entry of opened) entry.callbacks.pause();
			queue.push('error', 'urgent');
			expect(live().map((o) => o.view.message)).toEqual(['first', 'second', 'third']);

			// The user moves the pointer off the newest warning.
			opened[2]?.callbacks.resume();

			expect(live().map((o) => o.view.message)).toContain('urgent');
			expect(live().map((o) => o.view.message)).not.toContain('third');
		});

		it('does not preempt for another WARNING', () => {
			// The narrowing, and it needs its own case: a rule letting any later notice preempt
			// would pass all three cases above while making the cap mean nothing.
			const { queue, live } = threeStandingWarnings();

			queue.push('warning', 'fourth');

			expect(live().map((o) => o.view.message)).toEqual(['first', 'second', 'third']);
		});

		it('does not preempt a screen that is already all errors', () => {
			const { host, live } = recordingHost();
			const queue = createNoticeQueue(host);
			queue.push('error', 'a');
			queue.push('error', 'b');
			queue.push('error', 'c');

			queue.push('error', 'd');

			// Nothing to take: an error may not evict another error, or the newest error would
			// silence the one before it and the cap would be a rotating window.
			expect(live().map((o) => o.view.message)).toEqual(['a', 'b', 'c']);
		});
	});

	it('opens a notice for a push', () => {
		const { host, opened } = recordingHost();
		createNoticeQueue(host).push('error', 'boom');
		expect(opened).toHaveLength(1);
		expect(opened[0]?.view).toMatchObject({ severity: 'error', message: 'boom', count: 1 });
	});

	// Every other case in this file pushes `error` or `warning`, both `null` in
	// `AUTO_DISMISS_MS` — so none of them ever arms a timer, and `beforeEach`'s
	// `vi.useFakeTimers()` controls nothing in them. This is the one case that actually
	// arms one, and it exists to prove the timer the queue schedules is the FAKE one vitest
	// installed rather than a real timer captured before the fake was ever in place — the
	// queue resolves `setTimeout` at call time for exactly this reason.
	it('arms an auto-dismiss timer that vitest\'s fake clock actually controls', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('success', 'saved');

		expect(vi.getTimerCount()).toBe(1);
		expect(opened[0]?.handle.live).toBe(true);

		vi.advanceTimersByTime(4000);

		expect(opened[0]?.handle.live).toBe(false);
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

	/**
	 * **Disposal is TERMINAL, and the entries stay reachable after it.** A host registers
	 * `pause`/`resume` on DOM listeners it never removes, so a pointer leaving a fading notice
	 * after `onunload` calls `resume` on an entry the queue has already let go. Before
	 * `dispose` cleared `handle`, `arm` had nothing to withhold on and armed a fresh
	 * auto-dismiss timer into a disposed plugin — the callback then calling `hide` on a notice
	 * nothing owns any more.
	 */
	it('stays inert when a host callback arrives after disposal', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('success', 'saved');
		queue.dispose();
		expect(vi.getTimerCount()).toBe(0);

		opened[0]?.callbacks.pause();
		opened[0]?.callbacks.resume();
		opened[0]?.callbacks.dismissed();

		expect(vi.getTimerCount()).toBe(0);
	});

	/**
	 * The other half of terminal, and the one `notify.ts` cannot supply: it drops its reference
	 * on `disposeNotices`, but a queue whose terminality lives in another module's variable has
	 * none of its own — and the fire-and-forget cascade and recovery pass both resolve after
	 * `onunload`, holding whatever reference they closed over.
	 */
	it('drops a push that arrives after disposal rather than opening a notice', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.dispose();
		queue.push('error', 'a fault that resolved after onunload');
		expect(opened).toHaveLength(0);
	});

	it('dismisses a success at its own deadline and not before', () => {
		const { host, live } = recordingHost();
		createNoticeQueue(host).push('success', 'saved');
		vi.advanceTimersByTime(3999);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(live()).toHaveLength(0);
	});

	it('gives an info longer than a success, since informational text runs longer', () => {
		const { host, live } = recordingHost();
		createNoticeQueue(host).push('info', 'indexing');
		vi.advanceTimersByTime(4000);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(2000);
		expect(live()).toHaveLength(0);
	});

	it('never times a warning or an error out', () => {
		const { host, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('warning', 'check this');
		queue.push('error', 'failed');
		vi.advanceTimersByTime(60_000);
		expect(live()).toHaveLength(2);
	});

	it('holds a notice open while it is hovered or its dismiss control is focused', () => {
		const { host, opened, live } = recordingHost();
		createNoticeQueue(host).push('success', 'saved');
		vi.advanceTimersByTime(3000);
		opened[0]?.callbacks.pause();
		vi.advanceTimersByTime(60_000);
		expect(live()).toHaveLength(1);
	});

	it('restarts a full duration on leaving, not the remainder', () => {
		const { host, opened, live } = recordingHost();
		createNoticeQueue(host).push('success', 'saved');
		vi.advanceTimersByTime(3000);
		opened[0]?.callbacks.pause();
		opened[0]?.callbacks.resume();
		vi.advanceTimersByTime(3999);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(live()).toHaveLength(0);
	});

	it('restarts the timer on a repeat, so a recurring message does not expire mid-burst', () => {
		const { host, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('success', 'saved');
		vi.advanceTimersByTime(3000);
		queue.push('success', 'saved');
		vi.advanceTimersByTime(3000);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(1000);
		expect(live()).toHaveLength(0);
	});

	it('does not restart the clock on a duplicate arriving while the user is interacting', () => {
		const { host, opened, live } = recordingHost();
		const queue = createNoticeQueue(host);
		queue.push('success', 'saved');

		opened[0]?.callbacks.pause();
		queue.push('success', 'saved');

		// The repeat must not have armed a new timer under a hovering user.
		vi.advanceTimersByTime(60_000);
		expect(live()).toHaveLength(1);
		expect(opened[0]?.view.count).toBe(2);

		opened[0]?.callbacks.resume();
		vi.advanceTimersByTime(4000);
		expect(live()).toHaveLength(0);
	});

	it('does not time out a held duplicate that has never been shown', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		// Three persistent notices fill every slot, so the success below is held, not shown.
		for (const message of ['a', 'b', 'c']) queue.push('error', message);
		queue.push('success', 'held');
		queue.push('success', 'held');
		expect(opened).toHaveLength(3);

		// Well past the success deadline: a held entry has no timer, so it is still queued.
		vi.advanceTimersByTime(60_000);
		// Both halves again — the element goes, THEN the hint arrives. A hint alone leaves
		// `handle.live` true, so `sweep` frees nothing. (The sibling case above had this right
		// and this one did not, which is what a fix applied to one instance of a pattern looks
		// like.)
		opened[0]?.handle.hide();
		opened[0]?.callbacks.dismissed();
		expect(opened.at(-1)?.view.message).toBe('held');
		expect(opened.at(-1)?.view.count).toBe(2);
	});

	it('promotes a held notice when a visible one times out', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('success', message);
		expect(opened).toHaveLength(3);
		vi.advanceTimersByTime(4000);
		expect(opened[3]?.view.message).toBe('d');
	});

	it('frees a slot when a notice was dismissed by something other than this queue', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd']) queue.push('error', message);
		expect(opened).toHaveLength(3);

		// Obsidian's own click-to-dismiss: the element goes and nothing tells us.
		opened[0]?.handle.hide();

		queue.push('error', 'e');
		expect(opened.map((o) => o.view.message)).toContain('d');
	});

	it('frees every externally dismissed slot at once, not merely the first', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c', 'd', 'e']) queue.push('error', message);
		expect(opened).toHaveLength(3);

		// Two dismissed externally. A sweep that splices the array it is iterating skips the
		// second, leaving it tracked as visible and promoting only one of the two held.
		opened[0]?.handle.hide();
		opened[1]?.handle.hide();
		opened[0]?.callbacks.dismissed();

		expect(opened.map((o) => o.view.message)).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('promotes on a DUPLICATE push too, not only on a new one', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c']) queue.push('error', message);
		queue.push('warning', 'held');
		expect(opened).toHaveLength(3);

		// Dismissed with no hint delivered, then the next push happens to be a repeat.
		opened[0]?.handle.hide();
		queue.push('error', 'b');

		expect(opened.at(-1)?.view.message).toBe('held');
	});

	it('does not wedge permanently when no dismissal hint ever arrives', () => {
		const { host, opened } = recordingHost();
		const queue = createNoticeQueue(host);
		for (const message of ['a', 'b', 'c']) queue.push('error', message);
		for (const entry of opened) entry.handle.hide();

		queue.push('error', 'after');
		expect(opened.at(-1)?.view.message).toBe('after');
	});
});
