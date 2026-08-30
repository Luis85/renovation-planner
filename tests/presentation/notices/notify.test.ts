/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import {
	activateNotices,
	disposeNotices,
	noticeOnlySinks,
	notify,
	notifyError,
	notifySuccess,
	notifyWarning,
} from '../../../src/presentation/notices/notify';
import type { AppError } from '../../../src/core/errors/AppError';
import { surfaceError } from '../../../src/presentation/errors/surfaceError';
import {
	surfaceFor,
	type ErrorSurface,
	type ToastSurface,
} from '../../../src/presentation/errors/errorSurfacePolicy';

/**
 * Narrows a routed surface to its toast member, so this file can call `notifyError` at all.
 *
 * A CAST would have been shorter and is refused on purpose: design slice 17's brand exists to
 * make the toast door unreachable without asking the policy, and a test that casts past it is
 * testing a door the production tree does not have.
 */
function expectToast(surface: ErrorSurface): ToastSurface {
	if (surface.kind !== 'toast') throw new Error(`expected a toast surface, got ${surface.kind}`);
	return surface;
}

// The host builds its markup with Obsidian's own `createSpan`/`createEl` globals, which the
// marketplace ruleset requires over `document.createElement`. jsdom has neither.
installObsidianDom();

// `.rp-notice` rather than `.notice`: the host keys every per-notice concern on `messageEl`,
// which is where the classes, the listeners and the liveness read all live now. Selecting the
// outer `.notice` here would still find one element per notice in this fake and would be
// selecting the element whose identity `notify.ts` deliberately stopped relying on.
const noticeEls = () => [...document.querySelectorAll<HTMLElement>('.rp-notice')];

const regionEl = (role: 'status' | 'alert') =>
	document.querySelector<HTMLElement>(`.rp-notice-live-region[role="${role}"]`);

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

	/**
	 * **The degradation `SurfaceSinks.unrenderable` exists for, pinned as behaviour.**
	 *
	 * Every production caller of `noticeOnlySinks` today declares an origin whose surface it can
	 * actually draw, so this door is not reached by any of them — which is the design working,
	 * and also why it needs a case of its own rather than arriving as coverage from somewhere
	 * else. A notice-only site handed a `view-failure` has no room for it; the rule is that the
	 * failure still reaches the user, and the alternative this guards against is silence.
	 */
	it('degrades a surface it cannot draw to a notice rather than to silence', () => {
		const error: AppError = {
			category: 'Persistence',
			code: 'zone.save-failed',
			message: 'developer English',
		};

		surfaceError(error, { kind: 'view-hydration' }, noticeOnlySinks);

		expect(noticeEls()).toHaveLength(1);
		expect(noticeEls()[0]?.textContent).not.toContain('developer English');
	});

	it('renders a translated severity label beside the message, never colour alone', () => {
		notifyWarning('check the calibration');
		const el = noticeEls()[0];
		expect(el?.textContent).toContain('Warning');
		expect(el?.textContent).toContain('check the calibration');
	});

	/**
	 * **The live regions exist BEFORE any notice does, which is the whole mechanism.**
	 * `docs/components/Toast.md` refuses `role`/`aria-live` "on a container that appears", and a
	 * `Notice` is exactly that. So the pair is two elements `activateNotices` puts on
	 * `document.body`, empty, and a notice announces by writing into one of them. This case is
	 * what would fail if either went back onto the notice element: it asserts the regions are
	 * there and EMPTY with nothing pushed.
	 */
	it('opens two empty live regions at activation, before anything is pushed', () => {
		expect(regionEl('status')?.getAttribute('aria-live')).toBe('polite');
		expect(regionEl('alert')?.getAttribute('aria-live')).toBe('assertive');
		expect(regionEl('status')?.textContent).toBe('');
		expect(regionEl('alert')?.textContent).toBe('');

		// And the notice itself carries neither, because two elements claiming to be the live
		// region for one message is the announcement heard twice or not at all.
		notifySuccess('saved');
		expect(noticeEls()[0]?.getAttribute('role')).toBeNull();
		expect(noticeEls()[0]?.getAttribute('aria-live')).toBeNull();
	});

	it('announces a success politely and a warning assertively', () => {
		notifySuccess('saved');
		expect(regionEl('status')?.textContent).toContain('saved');
		expect(regionEl('alert')?.textContent).toBe('');

		notifyWarning('careful');
		expect(regionEl('alert')?.textContent).toContain('careful');
		// The severity word rides along: `role="alert"` carries urgency but not WHICH of the two
		// assertive severities this is, and SDD §85's status-not-colour-only rule has an audible
		// half.
		expect(regionEl('alert')?.textContent).toContain('Warning');
	});

	/**
	 * The queue folds an identical repeat into a `(×N)` suffix and calls `update` rather than
	 * opening a second notice — so the announcement has to ride `update` too, or a screen-reader
	 * user is told about the first occurrence and none of the rest.
	 */
	it('re-announces a repeat, because the count is information the sighted user gets', () => {
		notifyWarning('same');
		expect(regionEl('alert')?.textContent).not.toContain('×2');
		notifyWarning('same');
		expect(regionEl('alert')?.textContent).toContain('×2');
	});

	it('takes its live regions away with it on disposal', () => {
		expect(regionEl('status')).not.toBeNull();
		disposeNotices();
		expect(regionEl('status')).toBeNull();
		expect(regionEl('alert')).toBeNull();
	});

	// `activateNotices()`, NOT `disposeNotices()`. Disposal is terminal — it leaves the module
	// inert and a later push is dropped. Activation is the reset, and it must not accumulate a
	// second pair of regions on a body it did not clear.
	it('replaces its live regions on re-activation rather than stacking a second pair', () => {
		activateNotices();
		expect(document.querySelectorAll('.rp-notice-live-region')).toHaveLength(2);
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

	/**
	 * **Obsidian's own click-to-dismiss, at the timing that actually costs something.** An
	 * earlier version of this case removed the element BEFORE dispatching the click, which is
	 * the one ordering a real animated `Notice` never gives us: the element is still attached
	 * while it fades. Left attached, `isConnected` alone frees nothing — so the click listener
	 * latches, exactly as our own `×` does, because a clicked notice IS a dismissed notice.
	 */
	it('frees a slot when the notice is dismissed by Obsidian rather than by our button', () => {
		notifyWarning('a');
		notifyWarning('b');
		notifyWarning('c');
		notifyWarning('d');
		expect(noticeEls()).toHaveLength(3);

		noticeEls()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(noticeEls().some((el) => el.textContent?.includes('d'))).toBe(true);
	});

	/**
	 * **The defect the latch above actually costs, and it is not the slot.** `push` sweeps and
	 * then DEDUPS, so a repeat of a message whose notice the user has just clicked away — but
	 * whose element is still fading — used to find the dying entry, bump a count nobody would
	 * ever see, and open nothing. Lost outright rather than deferred, which is worse than the
	 * held slot the sweep was already written to survive. Driven at the worst timing: `hide()`
	 * is a no-op, so nothing detaches at all.
	 */
	it('opens a fresh notice for a repeat of a message the user just clicked away', () => {
		notifyWarning('the same words twice');
		for (const notice of Notice.constructed) notice.hide = () => undefined;
		noticeEls()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const constructedBefore = Notice.constructed.length;
		notifyWarning('the same words twice');
		expect(Notice.constructed.length).toBe(constructedBefore + 1);
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
		// Design slice 17 made the second parameter the door's lock: `ToastSurface` is branded,
		// so this call cannot be written without asking the policy first. Reaching for
		// `surfaceFor` here rather than casting a literal is the point — a cast would prove the
		// door still opens for anything, which is what the brand exists to stop.
		notifyError(error, expectToast(surfaceFor(error, { kind: 'explicit-operation' })));

		const text = noticeEls()[0]?.textContent ?? '';
		expect(text).not.toContain('developer English');
		// The real fallback: no exact key and no suffix match for this code, so the CATEGORY
		// sentence is what the user gets. Asserted verbatim, because that string is the whole
		// thing this case exists to prove reached the notice.
		expect(text).toContain('This data is not in the expected form.');
	});
});
