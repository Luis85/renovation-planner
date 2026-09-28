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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { installObsidianDom } from '../../helpers/dom';
import {
	activateNotices,
	notifyOperationFailure,
	notifyWarning,
} from '../../../src/presentation/notices/notify';
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

	it('leaves every other notice without an action', () => {
		notifyWarning('careful');
		notifyOperationFailure(refusal('zone.save-failed'));

		expect(noticeEls()).toHaveLength(2);
		expect(noticeEls().flatMap((el) => actionsOf(el))).toHaveLength(0);
	});

	it('draws no button when activation was given no report to open', () => {
		activateNotices();
		const code = expectDefined(POINTING[0], 'a code naming the report');
		notifyOperationFailure(refusal(code));

		expect(noticeEls()[0]?.textContent).toContain(en[code]);
		expect(actionsOf(noticeEls()[0])).toHaveLength(0);
	});
});
