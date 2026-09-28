/**
 * @vitest-environment jsdom
 *
 * Tracker row L-37 and the owner's ruling "Add actionable notices": a notice whose sentence
 * tells the user to open the diagnostics report carries a button that opens it.
 *
 * **Which notices, derived rather than listed.** Every `en` string carrying the report sentence
 * is either drawn by a VIEW that already puts the report button beside it — the three keys in
 * `VIEW_SURFACES` — or is an error code a toast prints. The second set drives the cases below,
 * so a new code minted with that sentence arrives here red until `notify.ts` gives it the button.
 *
 * **What jsdom cannot see, said narrowly.** A native `<button>` turns Enter and Space into a
 * click in a browser; jsdom synthesizes no such click from a keydown, so keyboard activation is
 * asserted only as "it is a real `<button type="button">`", not driven. Whether the button is
 * reachable by Tab inside Obsidian's `.notice-container`, what it looks like, and what a screen
 * reader says are a real vault's questions (`docs/tests/cases/Notices and save state.md`).
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import {
	activateNotices,
	notifyError,
	notifyOperationFailure,
	notifyWarning,
} from '../../../src/presentation/notices/notify';
import { surfaceFor, type ToastSurface } from '../../../src/presentation/errors/errorSurfacePolicy';
import { propertyOf, show, stylesheetRules } from '../../helpers/selectors';
import { en, type StringKey } from '../../../src/presentation/i18n/locales/en';
import type { AppError } from '../../../src/core/errors/AppError';
import { expectDefined } from '../../helpers/domain';

installObsidianDom();

const SENTENCE = 'Open the diagnostics report';

/** Strips a view draws with its own report button beside the sentence — not toasts. */
const VIEW_SURFACES: ReadonlySet<string> = new Set([
	'editor.some-zones-unreadable',
	'view.project.some-plans-unreadable',
	'view.asset-library.some-unreadable',
]);

const POINTING = (Object.entries(en) as [StringKey, string][])
	.filter(([key, text]) => text.includes(SENTENCE) && !VIEW_SURFACES.has(key))
	.map(([key]) => key);

const refusal = (code: string): AppError => ({
	category: 'Persistence',
	code,
	message: 'developer English',
});

const noticeEls = () => [...document.querySelectorAll<HTMLElement>('.rp-notice')];
const actionsOf = (el: HTMLElement | undefined) => [
	...(el?.querySelectorAll<HTMLButtonElement>('.rp-notice-action') ?? []),
];

describe('a notice that points at the diagnostics report', () => {
	const openReport = vi.fn<() => void>();

	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
		Notice.constructed.length = 0;
		openReport.mockClear();
		activateNotices(openReport);
	});

	// The instrument first: a filter that matched nothing would make every case below vacuous.
	it('finds the toast codes that name the report', () => {
		expect(POINTING).toEqual(
			expect.arrayContaining(['zone.listing-incomplete', 'asset.listing-incomplete']),
		);
	});

	it.each(POINTING)('%s carries one button that opens the report and dismisses', (code) => {
		notifyOperationFailure(refusal(code));

		const el = noticeEls()[0];
		expect(el?.textContent).toContain(en[code]);
		const actions = actionsOf(el);
		expect(actions).toHaveLength(1);
		const [button] = actions;
		expect(button?.tagName).toBe('BUTTON');
		expect(button?.type).toBe('button');
		// Visible text IS the accessible name — no `aria-label` to drift from it.
		expect(button?.textContent).toBe(en['command.show-diagnostics-report']);
		expect(button?.hasAttribute('aria-label')).toBe(false);

		// The notice is already gone when the report opens, so the report is not drawn beneath a
		// notice still asking the user to open it.
		let noticesWhenOpened = -1;
		openReport.mockImplementationOnce(() => {
			noticesWhenOpened = noticeEls().length;
		});
		button?.click();

		// Once, although the click also bubbles to the notice's own dismissal listener.
		expect(openReport).toHaveBeenCalledTimes(1);
		expect(noticesWhenOpened).toBe(0);
		expect(noticeEls()).toHaveLength(0);
	});

	it('folds a repeat into one notice that still carries one button', () => {
		const code = expectDefined(POINTING[0], 'a code naming the report');
		notifyOperationFailure(refusal(code));
		notifyOperationFailure(refusal(code));

		expect(noticeEls()).toHaveLength(1);
		expect(noticeEls()[0]?.textContent).toContain('(×2)');
		actionsOf(noticeEls()[0])[0]?.click();
		expect(openReport).toHaveBeenCalledTimes(1);
	});

	it('leaves a bare-message notice without an action', () => {
		notifyWarning('careful');
		expect(actionsOf(noticeEls()[0])).toHaveLength(0);
	});

	/**
	 * **Over-inclusion, not only omission.** Every `en` key is raised as an error code, and the
	 * button must appear exactly for the keys whose sentence names the report — so a code added
	 * to `POINTS_AT_REPORT` whose sentence does not say to open the report goes red here too.
	 */
	it('gives the button to exactly the codes whose sentence names the report', () => {
		const wrong = (Object.keys(en) as StringKey[]).filter((code) => {
			activateNotices(openReport);
			document.body.querySelectorAll('.notice-container').forEach((el) => {
				el.remove();
			});
			notifyOperationFailure(refusal(code));
			return (actionsOf(noticeEls()[0]).length === 1) !== POINTING.includes(code);
		});

		expect(wrong, 'POINTS_AT_REPORT in notify.ts disagrees with the en table for these codes').toEqual([]);
	});

	/**
	 * The action holds its notice while focused, exactly as `×` does. Every shipped action rides
	 * an UNTIMED severity, so the hold is observed through the other thing a pause protects: a
	 * newer error takes a slot from the newest warning that is NOT paused. A Persistence failure
	 * from a background cascade routes to a warning, which is how a warning carries the action.
	 */
	it('holds its notice while the action has focus', () => {
		notifyWarning('first');
		notifyWarning('second');
		const code = expectDefined(POINTING[0], 'a code naming the report');
		const background = refusal(code);
		notifyError(background, surfaceFor(background, { kind: 'background-cascade' }) as ToastSurface);
		const actionable = expectDefined(noticeEls().at(-1), 'the actionable warning');
		expect(actionable.classList.contains('rp-notice-warning')).toBe(true);

		actionsOf(actionable)[0]?.dispatchEvent(new FocusEvent('focus'));
		notifyOperationFailure(refusal('zone.save-failed'));

		expect(actionable.isConnected).toBe(true);
		expect(noticeEls().map((el) => el.textContent)).not.toContainEqual(expect.stringContaining('second'));
	});

	it('draws no button when activation was given no report to open', () => {
		activateNotices();
		const code = expectDefined(POINTING[0], 'a code naming the report');
		notifyOperationFailure(refusal(code));

		expect(noticeEls()[0]?.textContent).toContain(en[code]);
		expect(actionsOf(noticeEls()[0])).toHaveLength(0);
	});
});

/**
 * **The layout a phone needs, pinned as RULES because nothing here measures layout.** Obsidian's
 * `button` is `white-space: nowrap`, so the action cannot shrink; on one unwrapping row it
 * squeezed the message to one word per line at phone width (`styles/notices.css` carries the
 * pinned-Chromium measurement). A notice carrying an action wraps, and the message keeps a
 * basis wide enough to push the buttons onto their own row. jsdom lays nothing out and the
 * harness cannot draw a notice, so this asserts the declarations exist — not that they work.
 */
describe('a notice carrying an action on a narrow screen', () => {
	const rules = stylesheetRules(readFileSync('styles/notices.css', 'utf8'));
	const declared = (selector: string, property: string): unknown[] =>
		rules
			.filter((rule) => rule.condition === '' && rule.selectors.map(show).includes(selector))
			.flatMap((rule) => rule.declarations.filter((d) => propertyOf(d) === property).map((d) => d.value));

	it('wraps its row', () => {
		expect(declared('.rp-notice-body:has(.rp-notice-action)', 'flex-wrap')).toEqual(['wrap']);
	});

	it('keeps the message a basis that sends the buttons to their own row', () => {
		// Compared against how the parser reads the same value, never against a retyped object.
		const [reference] = stylesheetRules('.reference { flex: 1 1 60%; }');
		expect(declared('.rp-notice-body:has(.rp-notice-action) .rp-notice-message', 'flex')).toEqual(
			reference?.declarations.map((d) => d.value),
		);
	});
});
