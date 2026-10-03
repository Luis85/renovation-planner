import { describe, expect } from 'vitest';
import { en } from '../../src/presentation/i18n/locales/en';
import { test } from './fixture';
import { logEvidence } from './diagnostics';
import { corruptSettings, reloadPlugin, removeBackgroundFiles, seedSampleProject, type Ui } from './planner';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Notices and save state.md`'s notice-queue steps, driven in the real host: 1
 * (the `info` tier goes on its own after ~6 s), 2 (a warning does not), 4 (the flex `gap` between
 * the label, the sentence and the `×`), 5 (hover holds the timer and the leave restarts the FULL
 * duration), 6 (Tab reaches the `×`, its ring shows, focus holds the timer, Enter dismisses), 8
 * (three on screen, the fourth held and promoted by a `×`), 9 (a repeat folds into `(×2)` in place)
 * and 11 (Obsidian's own body-click dismissal frees the slot, and a re-raise opens a fresh notice).
 *
 * **Timings are recorded in the PAGE**, by a `MutationObserver` stamping `performance.now()` when a
 * notice's element (`.rp-notice`, Obsidian's `messageEl`) appears and when it leaves the document,
 * and by `pointerenter`/`pointerleave` listeners on it — not by WebDriver round trips, which would add
 * their own latency to every bound. Each bound is a RANGE and the measured milliseconds go to the log.
 * `gone` is detachment, so it includes Obsidian's own hide animation; the upper bounds allow for it.
 *
 * **Steps 8 and 11 as written cannot be staged, and that is a finding.** Both say "run `Set plan
 * background` four times, changing nothing between", and step 9 says that same repeat folds into ONE
 * notice `(×2)` — so four presses draw one notice, never four. The cap needs four DISTINCT notices,
 * and a vault offers exactly four a command can raise with no gesture: `settings.unrecovered`
 * (the diagnostics report, with settings unreadable), `background.unsupported` (`Set plan
 * background`, with no PNG, JPEG or PDF), `plan.none` (`Open plan editor`, no plans) and `asset.none`
 * (`Open asset designer`, no assets). The first needs a `data.json` that will not parse, which also
 * empties the other two lists (no index, no asset queries); `Set plan background` only asks the
 * active Plan Editor leaf for a plan id, so one is opened with `setViewState`, as a restored layout
 * would. That is `fourNotices` below.
 *
 * The pointer is parked away from the notice area before every timed step: a pointer resting on a
 * notice holds it, which would turn a timing case into a hover case.
 *
 * Desktop legs: `Open plan editor`, `Set plan background` and `Open asset designer` are
 * `checkCallback`s that answer `false` on `Platform.isMobile`.
 *
 * Written from source and not yet run when committed: CI's E2E workflow is its first run.
 */
const desktop = mobileEmulation ? test.skip : test;

const PLAN_EDITOR = 'renovation-plan-editor';
const INFO_MS = 6000;
/** A notice that goes on its own leaves no earlier than its timer and well inside this. */
const BOUND = { min: INFO_MS - 100, max: INFO_MS + 3000 };
const SETTINGS = en['settings.unrecovered'];
const BACKGROUND = en['background.unsupported'];
const NO_PLANS = en['plan.none'];
const NO_ASSETS = en['asset.none'];

/** One notice as the page saw it, all times `performance.now()`. */
interface Seen {
	message: string;
	severity: string;
	label: string;
	shown: number;
	gone: number | null;
	entered: number | null;
	left: number | null;
}

/** Start the page-side log of every `.rp-notice` from now on. */
async function watchNotices(browser: NativeBrowser): Promise<void> {
	await browser.execute(() => {
		const seen: Seen[] = [];
		const tracked = new Map<Element, Seen>();
		const scan = (): void => {
			for (const element of document.querySelectorAll('.rp-notice')) {
				let entry = tracked.get(element);
				if (entry === undefined) {
					const made: Seen = { message: '', severity: '', label: '', shown: performance.now(), gone: null, entered: null, left: null };
					element.addEventListener('pointerenter', () => {
						made.entered ??= performance.now();
					});
					element.addEventListener('pointerleave', () => {
						made.left = performance.now();
					});
					tracked.set(element, made);
					seen.push(made);
					entry = made;
				}
				entry.message = element.querySelector('.rp-notice-message')?.textContent ?? '';
				entry.label = element.querySelector('.rp-notice-severity')?.textContent ?? '';
				entry.severity = [...element.classList].find((name) => /^rp-notice-(success|info|warning|error)$/u.test(name)) ?? '';
			}
			for (const [element, entry] of tracked) if (entry.gone === null && !element.isConnected) entry.gone = performance.now();
		};
		(window as unknown as { __rpNotices: Seen[] }).__rpNotices = seen;
		new MutationObserver(scan).observe(document.body, { subtree: true, childList: true, characterData: true });
		scan();
	});
}

const notices = (browser: NativeBrowser): Promise<Seen[]> => browser.execute(() => (window as unknown as { __rpNotices?: Seen[] }).__rpNotices ?? []);
const now = (browser: NativeBrowser): Promise<number> => browser.execute(() => performance.now());

/** The one logged notice whose sentence starts with `message`; refused when there is not exactly one. */
async function only(browser: NativeBrowser, message: string): Promise<Seen> {
	const found = (await notices(browser)).filter((entry) => entry.message.startsWith(message));
	expect(found.map((entry) => entry.message)).toHaveLength(1);
	return found[0];
}

/** Wait for the one notice `message` to be drawn, and answer it. */
async function shown(browser: NativeBrowser, message: string): Promise<Seen> {
	await expect.poll(async () => (await notices(browser)).filter((entry) => entry.message.startsWith(message)).length).toBe(1);
	return only(browser, message);
}

/** Wait for the notice `message` to leave the document, and answer it. */
async function gone(browser: NativeBrowser, message: string, timeout = 15_000): Promise<Seen> {
	await expect.poll(async () => (await only(browser, message)).gone, { timeout }).not.toBeNull();
	return only(browser, message);
}

/** The sentences of every notice in the document now, sorted. */
const onScreen = async (browser: NativeBrowser): Promise<string[]> =>
	(await notices(browser)).filter((entry) => entry.gone === null).map((entry) => entry.message).toSorted();

/** Hold until `ms` have passed since the notice was shown, measured in the page. */
async function holdUntil(browser: NativeBrowser, entry: Seen, ms: number): Promise<void> {
	const left = entry.shown + ms - (await now(browser));
	if (left > 0) await browser.pause(Math.ceil(left));
}

const mouse = (browser: NativeBrowser, x: number, y: number) =>
	browser.action('pointer', { parameters: { pointerType: 'mouse' } }).move({ x, y, duration: 0, origin: 'viewport' }).perform();

/** The pointer at a third of the way across the window, mid-height: on the workspace, clear of the notices in the top right. */
async function park(browser: NativeBrowser): Promise<void> {
	const { x, y } = await browser.execute(() => ({ x: Math.round(window.innerWidth / 3), y: Math.round(window.innerHeight / 2) }));
	await mouse(browser, x, y);
}

/** The pointer onto the middle of the notice `message`'s sentence, refused when anything else is drawn there. */
async function hover(browser: NativeBrowser, message: string): Promise<void> {
	const point = await browser.execute((text: string) => {
		const target = [...document.querySelectorAll('.rp-notice-message')].find((node) => node.textContent?.startsWith(text));
		const rect = target?.getBoundingClientRect();
		if (target === undefined || rect === undefined) return null;
		const x = Math.round(rect.left + rect.width / 2);
		const y = Math.round(rect.top + rect.height / 2);
		return { x, y, hit: target.closest('.rp-notice')?.contains(document.elementFromPoint(x, y)) ?? false };
	}, message);
	expect(point).toMatchObject({ hit: true });
	if (point !== null) await mouse(browser, point.x, point.y);
}

/** The notice whose sentence starts with `message`, by XPath, then `part` inside it. */
const noticePart = (browser: NativeBrowser, message: string, part: string) =>
	browser.$(
		`//*[contains(concat(" ",normalize-space(@class)," ")," rp-notice ")][.//*[contains(@class,"rp-notice-message") and starts-with(normalize-space(.),"${message}")]]//*[contains(concat(" ",normalize-space(@class)," ")," ${part} ")]`,
	);

/**
 * Four distinct notices in quick succession, two persistent and two timed (see the header), with
 * `plan.none` third and `asset.none` fourth — so the fourth is the one held. Answers the shown three.
 */
async function fourNotices(browser: NativeBrowser, page: Parameters<typeof reloadPlugin>[0], ui: Ui): Promise<Seen[]> {
	await removeBackgroundFiles(browser);
	await corruptSettings(browser);
	await reloadPlugin(page);
	await browser.executeObsidian(async ({ app }, type) => {
		const leaf = app.workspace.getLeaf('tab');
		await leaf.setViewState({ type, state: { planId: 'plan-e2e-notices' }, active: true });
		app.workspace.setActiveLeaf(leaf, { focus: true });
	}, PLAN_EDITOR);
	await watchNotices(browser);
	await park(browser);
	await ui.command('set-plan-background');
	await ui.command('show-diagnostics-report');
	await ui.command('open-plan-editor');
	await ui.command('open-asset-designer');
	await expect.poll(() => onScreen(browser)).toEqual([BACKGROUND, NO_PLANS, SETTINGS].toSorted());
	// Held, not dropped and not drawn: nothing in the document carries the fourth sentence.
	expect((await notices(browser)).filter((entry) => entry.message === NO_ASSETS)).toEqual([]);
	return Promise.all([BACKGROUND, SETTINGS, NO_PLANS].map((message) => only(browser, message)));
}

describe('Notices and save state, the notice queue (steps 1, 2, 4, 5, 6, 8, 9 and 11)', () => {
	desktop('step 1: the info notice reads Information and goes on its own after about six seconds', async ({ native: { browser, ui, directory } }) => {
		await watchNotices(browser);
		await park(browser);
		await ui.command('open-plan-editor');
		const raised = await shown(browser, NO_PLANS);
		expect({ severity: raised.severity, label: raised.label, message: raised.message }).toEqual({
			severity: 'rp-notice-info',
			label: en['notice.severity.info'],
			message: NO_PLANS,
		});
		const done = await gone(browser, NO_PLANS);
		const lived = Math.round((done.gone ?? 0) - done.shown);
		await logEvidence(directory, 'step-1-info-lifetime-ms', { lived, bound: BOUND });
		expect(lived).toBeGreaterThanOrEqual(BOUND.min);
		expect(lived).toBeLessThanOrEqual(BOUND.max);
	});

	desktop('steps 2, 4 and 9: a warning stays 20 s, its parts are spaced apart, and a repeat folds into (×2) in place', async ({ native: { browser, ui, directory } }) => {
		await removeBackgroundFiles(browser);
		await seedSampleProject(browser, ui);
		await ui.activate(PLAN_EDITOR);
		await watchNotices(browser);
		await park(browser);
		await ui.command('set-plan-background');
		const raised = await shown(browser, BACKGROUND);
		expect({ severity: raised.severity, label: raised.label }).toEqual({ severity: 'rp-notice-warning', label: en['notice.severity.warning'] });

		// Step 4: the label, the sentence and the `×` are three flex items with no whitespace between them.
		const parts = await browser.execute((text: string) => {
			const notice = [...document.querySelectorAll('.rp-notice')].find((node) => node.querySelector('.rp-notice-message')?.textContent?.startsWith(text));
			const rect = (selector: string) => {
				const box = notice?.querySelector(selector)?.getBoundingClientRect();
				return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null;
			};
			const word = notice?.querySelector('.rp-notice-severity > span:not(.rp-notice-mark)')?.getBoundingClientRect();
			return {
				label: rect('.rp-notice-severity'),
				mark: rect('.rp-notice-mark'),
				word: word ? { left: word.left, right: word.right } : null,
				message: rect('.rp-notice-message'),
				dismiss: rect('.rp-notice-dismiss'),
				read: notice instanceof HTMLElement ? notice.innerText : '',
			};
		}, BACKGROUND);
		await logEvidence(directory, 'step-4-parts', parts);
		const { label, mark, word, message, dismiss } = parts;
		if (label === null || mark === null || word === null || message === null || dismiss === null) throw new Error(`a notice part is not drawn: ${JSON.stringify(parts)}`);
		// The flex `gap` is `--size-4-2` (8 px by default); without it each pair touches.
		expect(message.left - label.right).toBeGreaterThanOrEqual(4);
		expect(dismiss.left - message.right).toBeGreaterThanOrEqual(4);
		// The `×` on the sentence's own row, to its right.
		expect(dismiss.top).toBeLessThan(message.bottom);
		// The mark inside the label, ahead of the word and hugging it (its own 0.4em margin).
		expect(mark.left).toBeGreaterThanOrEqual(label.left);
		expect(word.left - mark.right).toBeGreaterThan(0);
		expect(word.left - mark.right).toBeLessThan(message.left - label.right);

		// Step 2, bounded at 20 s rather than the row's minute: twice past any timer this queue has.
		await holdUntil(browser, raised, 20_000);
		const held = await only(browser, BACKGROUND);
		await logEvidence(directory, 'step-2-warning-held-ms', Math.round((await now(browser)) - held.shown));
		expect(held.gone).toBeNull();

		// Step 9: the same command again, and the SAME notice reads `(×2)`.
		await ui.command('set-plan-background');
		await expect.poll(async () => (await only(browser, BACKGROUND)).message).toBe(`${BACKGROUND} (×2)`);
		expect((await only(browser, BACKGROUND)).shown).toBe(raised.shown);
		expect(await onScreen(browser)).toEqual([`${BACKGROUND} (×2)`]);
	});

	desktop('step 5: hovering holds the info notice, and it goes a FULL six seconds after the pointer leaves', async ({ native: { browser, ui, directory } }) => {
		await watchNotices(browser);
		await park(browser);
		await ui.command('open-plan-editor');
		const raised = await shown(browser, NO_PLANS);
		// Hovered 1.5 s in, so a resume that kept the remainder would leave at most 4.5 s, not 6.
		await holdUntil(browser, raised, 1500);
		await hover(browser, NO_PLANS);
		await browser.pause(10_000);
		const held = await only(browser, NO_PLANS);
		expect(held.entered).not.toBeNull();
		expect(held.gone).toBeNull();
		await park(browser);
		await expect.poll(async () => (await only(browser, NO_PLANS)).left).not.toBeNull();
		const done = await gone(browser, NO_PLANS);
		const afterLeave = Math.round((done.gone ?? 0) - (done.left ?? 0));
		await logEvidence(directory, 'step-5-hover', { hoveredAtMs: Math.round((done.entered ?? 0) - done.shown), heldMs: Math.round((done.left ?? 0) - (done.entered ?? 0)), afterLeave, bound: BOUND });
		expect(afterLeave).toBeGreaterThanOrEqual(BOUND.min);
		expect(afterLeave).toBeLessThanOrEqual(BOUND.max);
	});

	desktop('step 6: Tab reaches the ×, its ring shows, focus holds the notice past its timer, and Enter dismisses it', async ({ native: { browser, ui, directory } }) => {
		// No note editor open: CodeMirror takes Tab as an indent, and the walk below starts beside the notice.
		await browser.executeObsidian(({ app }) => {
			for (const leaf of app.workspace.getLeavesOfType('markdown')) leaf.detach();
		});
		await watchNotices(browser);
		await park(browser);
		await ui.command('open-plan-editor');
		const raised = await shown(browser, NO_PLANS);
		const ring = () =>
			browser.execute(() => {
				const button = document.querySelector('.rp-notice-dismiss');
				if (button === null) return null;
				const style = getComputedStyle(button);
				return { focused: document.activeElement === button, outline: `${style.outlineStyle} ${style.outlineWidth}` };
			});
		const unfocused = await ring();
		// Focus the last tabbable element before the `×` in document order (or none, when there is
		// none), then ONE real Tab: the notice is timed, so a walk across the whole workspace would
		// outlast it. What that element is goes to the log.
		const before = await browser.execute(() => {
			const dismiss = document.querySelector('.rp-notice-dismiss');
			const tabbable = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter(
				(element) => element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getClientRects().length > 0,
			);
			const previous = dismiss === null ? undefined : tabbable.filter((element) => (element.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).at(-1);
			if (previous === undefined) (document.activeElement as HTMLElement | null)?.blur();
			else previous.focus();
			return previous ? previous.outerHTML.slice(0, 160) : null;
		});
		await browser.keys('Tab');
		const focused = await ring();
		const focusedAt = Math.round((await now(browser)) - raised.shown);
		await logEvidence(directory, 'step-6-focus', { before, focusedAtMs: focusedAt, unfocused, focused });
		expect(focused).toMatchObject({ focused: true });
		expect(focusedAt).toBeLessThan(INFO_MS - 1000);
		expect(focused?.outline.startsWith('none')).toBe(false);
		expect(focused?.outline).not.toBe(unfocused?.outline);

		// Held past its own timer by focus alone: the pointer is parked.
		await holdUntil(browser, raised, INFO_MS + 2000);
		expect((await only(browser, NO_PLANS)).gone).toBeNull();
		expect(await ring()).toMatchObject({ focused: true });
		await browser.keys('Enter');
		await gone(browser, NO_PLANS, 3000);
	});

	desktop('step 8: three distinct notices on screen, the fourth held, and the × on one promotes it', async ({ native: { browser, page, ui, directory } }) => {
		const [, , timed] = await fourNotices(browser, page, ui);
		await noticePart(browser, SETTINGS, 'rp-notice-dismiss').click();
		await expect.poll(() => onScreen(browser)).toEqual([BACKGROUND, NO_ASSETS, NO_PLANS].toSorted());
		const promoted = await only(browser, NO_ASSETS);
		// Promoted by the `×`, not by `plan.none`'s own timer freeing a slot six seconds in.
		const promotedAfter = Math.round(promoted.shown - timed.shown);
		await logEvidence(directory, 'step-8', { promotedAfterThirdMs: promotedAfter, log: await notices(browser) });
		expect(promotedAfter).toBeLessThan(INFO_MS - 500);
		expect(promoted.severity).toBe('rp-notice-info');
	});

	desktop('step 11: a click on a notice\'s body frees its slot at once, and the same message raised again opens fresh', async ({ native: { browser, page, ui, directory } }) => {
		const [, , timed] = await fourNotices(browser, page, ui);
		await noticePart(browser, SETTINGS, 'rp-notice-message').click();
		await gone(browser, SETTINGS);
		await expect.poll(() => onScreen(browser)).toEqual([BACKGROUND, NO_ASSETS, NO_PLANS].toSorted());
		const promotedAfter = Math.round((await only(browser, NO_ASSETS)).shown - timed.shown);
		expect(promotedAfter).toBeLessThan(INFO_MS - 500);

		// Re-raised with the cap full again, it is held — then drawn as a NEW notice, its count reset,
		// once a slot frees (here `plan.none`'s own timer).
		await ui.command('show-diagnostics-report');
		const fresh = async () => (await notices(browser)).filter((entry) => entry.message.startsWith(SETTINGS));
		await expect.poll(async () => (await fresh()).length, { timeout: 15_000 }).toBe(2);
		const [first, second] = await fresh();
		await logEvidence(directory, 'step-11', { promotedAfterThirdMs: promotedAfter, log: await notices(browser) });
		expect(first.gone).not.toBeNull();
		expect({ message: second.message, gone: second.gone }).toEqual({ message: SETTINGS, gone: null });
	});
});
