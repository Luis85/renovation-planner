/**
 * @vitest-environment jsdom
 *
 * `?section=schedule` (L-40): the schedule section's `open-diagnostics` button, which
 * `project-schedule-unreadable` and its `-narrow` twin photograph. Both wait on that button, so
 * a knob that stopped reaching the section would time them out rather than photograph the detail
 * state — but `harness-shot` runs outside `npm run check`, and these cases do not.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { installEditorEnvironment, settleUntil } from '../helpers/editor';
import { expectDefined } from '../helpers/domain';
import { mountHarness } from './mount';
import { tr } from '../../src/presentation/i18n/strings';

const SCHEDULE = '.rp-project-work';
const SCHEDULE_DIAGNOSTICS = `${SCHEDULE} [data-rp-action="open-diagnostics"]`;

/**
 * A fresh import of `page.ts` under a rewritten `location`, the route `harness.test.ts`'s
 * stylesheet case takes, so the URL parse is driven rather than bypassed. Its budget is that
 * case's: a whole-page import with cold transforms, which it measured past the 5s default.
 */
const PAGE_IMPORT_MS = 30_000;

afterEach(() => {
	document.body.replaceChildren();
	window.history.replaceState({}, '', '/');
});

it('draws the schedule section’s diagnostics button from a refused plan read, through page.ts', async () => {
	installEditorEnvironment();
	window.history.replaceState({}, '', '/?project=project-1&plans=3&plans-unreadable=2&section=schedule');
	vi.resetModules();

	await import('./page');
	await settleUntil(() => document.querySelector(SCHEDULE_DIAGNOSTICS) !== null, 'the schedule section’s diagnostics button');

	expect(document.querySelector(SCHEDULE)?.textContent).toContain(tr('view.project.some-plans-unreadable'));
}, PAGE_IMPORT_MS);

it('reaches the schedule section from the detail state’s Schedule button, with no button while every plan reads', async () => {
	const { view } = mountHarness(document.body, { projectId: 'project-1', plans: 3 });
	await flushPromises();
	const open = expectDefined(
		Array.from(view.contentEl.querySelectorAll('button')).find((button) => button.textContent?.trim() === tr('schedule.open')),
		'the Schedule button',
	);

	open.click();
	await settleUntil(() => view.contentEl.querySelector(`${SCHEDULE} .rp-project-work__rows`) !== null, 'the schedule section’s read');

	expect(view.contentEl.querySelector(SCHEDULE_DIAGNOSTICS)).toBeNull();
});
