/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import {
	activateNotices,
	disposeNotices,
	notify,
	notifyError,
	notifySuccess,
	notifyWarning,
} from '../../../src/presentation/notices/notify';
import type { AppError } from '../../../src/core/errors/AppError';

// The host builds its markup with Obsidian's own `createSpan`/`createEl` globals, which the
// marketplace ruleset requires over `document.createElement`. jsdom has neither.
installObsidianDom();

const noticeEls = () => [...document.querySelectorAll<HTMLElement>('.notice')];

describe('the notice door', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
		Notice.shown.length = 0;
		Notice.constructed.length = 0;
		// The queue is inert until something activates it, exactly as in production. A suite
		// that relied on it being live by default would be testing a module the plugin never
		// uses in that state.
		activateNotices();
	});

	it('renders a translated severity label beside the message, never colour alone', () => {
		notifyWarning('check the calibration');
		const el = noticeEls()[0];
		expect(el?.textContent).toContain('Warning');
		expect(el?.textContent).toContain('check the calibration');
	});

	it('marks a success politely and an error assertively', () => {
		notifySuccess('saved');
		expect(noticeEls()[0]?.getAttribute('role')).toBe('status');
		expect(noticeEls()[0]?.getAttribute('aria-live')).toBe('polite');

		// `activateNotices()`, NOT `disposeNotices()`. Disposal is terminal — it leaves the
		// module inert and the warning below would be dropped, giving `undefined` for both
		// assertions. Activation is the reset: it disposes what is there and builds a fresh
		// queue, which is exactly what a second half of a test needs.
		activateNotices();
		document.body.innerHTML = '';
		notifyWarning('careful');
		expect(noticeEls()[0]?.getAttribute('role')).toBe('alert');
		expect(noticeEls()[0]?.getAttribute('aria-live')).toBe('assertive');
	});

	it('carries a real focusable dismiss control, not a click handler on a div', () => {
		notifyWarning('careful');
		const button = noticeEls()[0]?.querySelector('button');
		expect(button).not.toBeNull();
		expect(button?.getAttribute('aria-label')).toBe('Dismiss');
	});

	it('dismisses when that control is pressed', () => {
		notifyWarning('careful');
		noticeEls()[0]?.querySelector('button')?.click();
		expect(noticeEls()).toHaveLength(0);
	});

	it('keeps the timer paused while the dismiss button holds focus after the pointer leaves', () => {
		notifySuccess('saved');
		const el = noticeEls()[0];
		const button = el?.querySelector('button');

		el?.dispatchEvent(new Event('pointerenter'));
		button?.dispatchEvent(new FocusEvent('focus'));
		el?.dispatchEvent(new Event('pointerleave'));

		// Hover is gone but focus is not: the notice must still be here.
		vi.advanceTimersByTime(60_000);
		expect(noticeEls()).toHaveLength(1);

		button?.dispatchEvent(new FocusEvent('blur'));
		vi.advanceTimersByTime(4000);
		expect(noticeEls()).toHaveLength(0);
	});

	/**
	 * **The fake detaches inside `hide()`; Obsidian's animated `Notice` may not.** If its element
	 * leaves after a transition, `containerEl.isConnected` is still true when the sweep our own
	 * click triggers runs, the slot is never freed, and the held fourth notice waits for some
	 * later push — the manual case's "dismiss one with its ×, the fourth appears" step failing
	 * for a reason unrelated to anything else it tests. Driven here by making `hide()` a no-op on
	 * every constructed notice, which is the WORST case of that timing: without the latch in
	 * `notify.ts` this case leaves 'd' unshown.
	 */
	it('frees the slot on OUR dismiss even where hide() leaves the element attached', () => {
		notifyWarning('a');
		notifyWarning('b');
		notifyWarning('c');
		notifyWarning('d');
		expect(noticeEls()).toHaveLength(3);

		for (const notice of Notice.constructed) notice.hide = () => undefined;
		noticeEls()[0]?.querySelector('button')?.click();

		expect(noticeEls().some((el) => el.textContent?.includes('d'))).toBe(true);
	});

	it('frees a slot when the notice is dismissed by Obsidian rather than by our button', () => {
		notifyWarning('a');
		notifyWarning('b');
		notifyWarning('c');
		notifyWarning('d');
		expect(noticeEls()).toHaveLength(3);

		// Obsidian's own click-to-dismiss: the element goes, and the click is our only prompt.
		const first = noticeEls()[0];
		first?.remove();
		first?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(noticeEls().some((el) => el.textContent?.includes('d'))).toBe(true);
	});

	it('shows a repeat count rather than a second notice', () => {
		notifyWarning('same');
		notifyWarning('same');
		expect(noticeEls()).toHaveLength(1);
		expect(noticeEls()[0]?.textContent).toContain('2');
	});

	it('constructs every notice with duration 0, because the timer is ours', () => {
		notifySuccess('saved');
		// The ARGUMENT, not the outcome. Advancing the clock and watching the element go proves
		// only that the queue's own timer ran — the fake implements no timer of Obsidian's, so
		// `new Notice(text)` with a default duration would leave that assertion green while real
		// Obsidian ran a second, unpausable timer underneath the hover rule.
		expect(Notice.constructed.at(-1)?.duration).toBe(0);
	});

	it('still lets the queue time it out, which is the other half of owning the timer', () => {
		notifySuccess('saved');
		expect(noticeEls()).toHaveLength(1);
		vi.advanceTimersByTime(4000);
		expect(noticeEls()).toHaveLength(0);
	});

	it('sends a plain notify at info severity', () => {
		notify('indexing');
		expect(noticeEls()[0]?.textContent).toContain('Information');
	});

	it('disposal takes the screen down and stays TERMINAL, dropping a later push', () => {
		notifyWarning('careful');
		expect(noticeEls()).toHaveLength(1);

		disposeNotices();
		expect(noticeEls()).toHaveLength(0);

		// The half that matters, and the reason `disposeNotices` does not rebuild the queue:
		// the cascade and the recovery pass both run fire-and-forget, so a promise CAN resolve
		// after `onunload`. Against a recreated queue this line would attach a live notice to a
		// vault with no plugin left to remove it. Dropped is the right answer — a toast reports
		// something that already happened, and there is no surface left to report it to.
		const constructedBefore = Notice.constructed.length;
		const late: AppError = {
			category: 'Persistence',
			code: 'vault.unexpected-failure',
			message: 'a fault that resolved after onunload',
		};
		notifyError(late);
		expect(noticeEls()).toHaveLength(0);
		expect(Notice.constructed).toHaveLength(constructedBefore);
	});

	it('resolves an AppError through the locale table rather than printing its message', () => {
		// TITLE case and no `unknown` cast. An earlier draft used `'validation'` cast through
		// `unknown`, and the test passed while proving nothing: `toUserMessage` falls back to
		// `CATEGORY_KEYS[error.category]`, that record is keyed by the real union, so a
		// lowercase category resolved to `undefined` and the notice body was EMPTY. Then
		// `toContain('Error')` passed off the severity label rather than the message, and
		// `not.toContain('developer English')` passed against nothing at all.
		const error: AppError = {
			category: 'Validation',
			code: 'zone.name-required',
			message: 'developer English that must not reach a user',
		};
		notifyError(error);

		const text = noticeEls()[0]?.textContent ?? '';
		expect(text).not.toContain('developer English');
		// The real fallback: no exact key and no suffix match for this code, so the CATEGORY
		// sentence is what the user gets. Asserted verbatim, because that string is the whole
		// thing this case exists to prove reached the notice.
		expect(text).toContain('This data is not in the expected form.');
	});
});
