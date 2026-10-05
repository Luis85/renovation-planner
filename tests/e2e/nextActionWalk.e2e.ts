import { describe, expect } from 'vitest';
import { en } from '../../src/presentation/i18n/locales/en';
import { test } from './fixture';
import { writeEvidence } from './diagnostics';
import { noticeMessages, setWindowSize } from './helpers';
import {
	dragCorner,
	outlineOf,
	readSidecar,
	recordSaveStates,
	rewriteOutline,
	saveLabel,
	saveStates,
	settleCamera,
	sidecarPath,
	type StoredPoint,
	type WorldPoint,
} from './canvas';
import { EDITOR, ENGLISH_GUIDE, expectGuide, openDetails, openPlan, seedKitchenRequirement, seedSampleProject, selectRoom, textOf, type Ui } from './planner';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * The session 21 Next action's vault walk, in English, driven in the real host:
 * `docs/tests/cases/Notices and save state.md` steps 15a (both halves) and 25 (the notice's
 * report button, from the keyboard), the getting-started guide (`open-help`,
 * `GettingStartedModal.ts`) with the sample project's fictional name, and the Rooms list's
 * keyboard (L-46, `RoomSummaryList.vue`), whose manual case is
 * `docs/tests/cases/Walk the room lists from the keyboard.md`.
 *
 * Copy is read from the `en` locale module, which is plain data and imports in this node
 * config; `strings.ts` and the guide's own module import `obsidian` and do not, so a guide
 * step is assembled from its `en` template and the labels the REAL controls render — by
 * `planner.ts`'s `expectGuide`, which `germanHost.e2e.ts` drives in German through the same walk.
 *
 * Written from source and not yet run when committed: every selector is the one the named
 * component draws, and CI's E2E workflow is its first run.
 */
const desktop = mobileEmulation ? test.skip : test;

type Page = Parameters<typeof rewriteOutline>[1];

/**
 * The sample Bathroom's corners reshaped into the case's three-corner room (step 15a(a)) and
 * into `zeroAreaDrag.test.ts`'s sliver, its apex on its own base (15a(b)). The base lies on
 * y = 3000, which the Kitchen's and the Garden's bottom corners share, so a corner dropped near
 * that line is pulled onto it exactly by the alignment snap (`snap-service.ts`, 8 px) — the zero
 * area the rule refuses, rather than a float residue it would accept. No other room's corner or
 * edge lies within that tolerance of the drop, so nothing but the alignment decides it.
 *
 * Every corner PRESSED sits off-centre: selecting from the list frames the room with 48 px of
 * padding (`EditorStore.fitTo`), which puts HTML over the stage there — the width label clamps
 * to the top centre (`RoomDimensionLabels.vue`), an edge's length sits at its midpoint, and the
 * primary actions float along the bottom. A press on any of them never reaches the stage, which
 * `dragCorner` refuses loudly rather than letting it read as a refusal. So the apex is up and to
 * the right, not at the bottom centre, and the sliver's middle corner is off its base's
 * midpoint, where `SLIVER_POINTS` puts it.
 */
const TRIANGLE: StoredPoint[] = [
	[4400, 3000],
	[6800, 3000],
	[6200, 1000],
];
const SLIVER: StoredPoint[] = [
	[4400, 3000],
	[6800, 3000],
	[6200, 3000],
];
const ON_THE_LINE: WorldPoint = { x: 5600, y: 3000 };
/** A drop that keeps an area: the control drag of 15a(a), and 15a(b)'s fixing drag. */
const OFF_THE_LINE: WorldPoint = { x: 6200, y: 2400 };
const SAVED = { state: 'rp-save-state-saved', text: en['save-state.saved'] };
const GEOMETRY = en['error.category.geometry'];
/** Notices step 25's bound on the Tab walk; the walk's real length is recorded, not asserted. */
const TAB_BOUND = 300;

const at = ([x, y]: StoredPoint): WorldPoint => ({ x, y });
const zoneNamed = async (ui: Ui, name: string): Promise<[string, Record<string, unknown>]> => {
	const found = Object.entries(await ui.notesOfType('renovation-zone')).filter(([, zone]) => zone.name === name);
	expect(found).toHaveLength(1);
	return found[0];
};

/**
 * The window these cases were first green at: the CI display's own 1280 x 1024, which the tiling
 * window manager gave Obsidian until main's `floating=on` rule left it at its default 1024 x 800.
 * There the editor leaf is narrower than `FULL_MIN_PX` (`layoutMode.ts`), so selecting a room opens
 * the Inspector as a drawer OVER the stage — on top of the very corners these cases press, which
 * `dragCorner` then refuses. At this size the shell is `full` and the Inspector sits beside the stage.
 * Electron sizes it (`setWindowSize` in `helpers.ts`).
 */
async function widenWindow(browser: NativeBrowser): Promise<void> {
	await setWindowSize(browser, 1280, 1024);
	await expect.poll(() => browser.execute(() => window.innerWidth)).toBeGreaterThanOrEqual(1270);
}

/** The sample project with its Bathroom's outline replaced by hand, reopened with the Bathroom selected. */
async function seedBathroomOutline(browser: NativeBrowser, page: Page, ui: Ui, points: StoredPoint[]): Promise<string> {
	await widenWindow(browser);
	await seedSampleProject(browser, ui);
	const id = String((await zoneNamed(ui, en['sample.zone.bathroom']))[1].id);
	await rewriteOutline(browser, page, id, points);
	await openPlan(browser, ui, en['sample.plan.name']);
	await selectRoom(browser, en['sample.zone.bathroom']);
	// The Inspector docked beside the stage rather than drawn over it (`widenWindow`). The margin is
	// thin: at 1280 the leaf is about 936 px against `FULL_MIN_PX`'s 900, so ~36 px of headroom. A
	// red HERE reading `constrained` is the host's default sidebar width moving, not a product
	// defect: widen the window further (or collapse a sidebar) rather than loosening this pin.
	expect(await browser.$(EDITOR).$('.rp-editor-shell').getAttribute('data-layout')).toBe('full');
	// Selecting from the list frames the camera on the room; a point read mid-frame is wrong.
	await settleCamera(browser);
	await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
	return id;
}

/** A gesture that WRITES, whose saved corner is read back, with the recorder shown to see a save. */
async function expectWritten(browser: NativeBrowser, path: string, id: string, moved: (points: StoredPoint[]) => boolean): Promise<void> {
	await expect.poll(async () => moved(await outlineOf(browser, path, id))).toBe(true);
	await expect.poll(() => saveLabel(browser)).toEqual(SAVED);
	expect(await saveStates(browser)).toContain('rp-save-state-saving');
}

/**
 * The geometry notices on screen. Filtered to that one sentence because a seed's own confirmation
 * may still be fading out while the case runs, and it is not this step's subject.
 */
const geometryNotices = async (browser: NativeBrowser): Promise<string[]> =>
	(await noticeMessages(browser)).filter((sentence) => sentence === GEOMETRY);

/** Both halves' verdict: one geometry notice, never Save error, Saved at rest, the sidecar untouched. */
async function expectRefusedAtRest(browser: NativeBrowser, directory: string, sidecarBefore: string, path: string): Promise<void> {
	await expect.poll(() => geometryNotices(browser)).toEqual([GEOMETRY]);
	const states = await saveStates(browser);
	await writeEvidence(directory, 'save-states', states);
	expect(states).not.toContain('rp-save-state-save-error');
	expect(await saveLabel(browser)).toEqual(SAVED);
	expect(await readSidecar(browser, path)).toBe(sidecarBefore);
}

describe('Notices step 15a: a geometry refusal leaves Saved standing (ruling 37)', () => {
	desktop('(a) a corner dragged onto the line joining the other two is refused as a notice', async ({
		native: { browser, page, ui, directory },
	}) => {
		const id = await seedBathroomOutline(browser, page, ui, TRIANGLE);
		const path = await sidecarPath(browser);
		// The control: the same corner dropped where the room keeps an area MOVES, so a press
		// that missed the corner cannot pass below as a refusal.
		await recordSaveStates(browser);
		await dragCorner(browser, at(TRIANGLE[2]), OFF_THE_LINE);
		await expectWritten(browser, path, id, (points) => points[2][1] > 2000);
		expect(await geometryNotices(browser)).toEqual([]);

		const [, , apex] = await outlineOf(browser, path, id);
		const sidecar = await readSidecar(browser, path);
		await recordSaveStates(browser);
		await dragCorner(browser, at(apex), ON_THE_LINE);
		await expectRefusedAtRest(browser, directory, sidecar, path);
	});

	desktop('(b) the undo of a drag that fixed a room stored without an area is refused as a notice', async ({
		native: { browser, page, ui, directory },
	}) => {
		const id = await seedBathroomOutline(browser, page, ui, SLIVER);
		const path = await sidecarPath(browser);
		await recordSaveStates(browser);
		await dragCorner(browser, at(SLIVER[2]), OFF_THE_LINE);
		await expectWritten(browser, path, id, (points) => points[2][1] < 2700);
		expect(await geometryNotices(browser)).toEqual([]);

		const fixed = await readSidecar(browser, path);
		await recordSaveStates(browser);
		await browser.$(EDITOR).$('[data-rp-action="undo"]').click();
		await expectRefusedAtRest(browser, directory, fixed, path);
	});
});

/** "Break its frontmatter" the way `A note that cannot be read.md` step 2 does: a schema from a newer build. */
async function breakZoneNote(browser: NativeBrowser, ui: Ui, name: string): Promise<void> {
	const [path] = await zoneNamed(ui, name);
	await browser.executeObsidian(async ({ app }, file) => {
		const text = await app.vault.adapter.read(file);
		const broken = text.replace(/^schema-version: \d+$/mu, 'schema-version: 99');
		if (broken === text) throw new Error(`${file} declares no schema-version to break`);
		await app.vault.adapter.write(file, broken);
	}, path);
	await expect.poll(async () => (await ui.notesOfType('renovation-zone'))[path]?.['schema-version']).toBe(99);
}

/** The action button's two focus channels: Obsidian's button ring is a box-shadow, a reset one an outline. */
const ringOf = (browser: NativeBrowser): Promise<{ outline: string; shadow: string }> =>
	browser.execute(() => {
		const button = document.querySelector('.rp-notice-action');
		if (button === null) throw new Error('No notice carries a report button.');
		const style = getComputedStyle(button);
		return { outline: `${style.outlineStyle} ${style.outlineWidth}`, shadow: style.boxShadow };
	});

async function tabToReportButton(browser: NativeBrowser): Promise<number> {
	for (let presses = 1; presses <= TAB_BOUND; presses += 1) {
		await browser.keys('Tab');
		if (await browser.execute(() => document.activeElement?.classList.contains('rp-notice-action') === true)) return presses;
	}
	throw new Error(`Tab did not reach the notice's report button in ${String(TAB_BOUND)} presses`);
}

const reports = async (browser: NativeBrowser): Promise<number> => (await browser.$$('.rp-diagnostics')).length;

describe('Notices step 25: the report button, reached and pressed from the keyboard (L-37)', () => {
	desktop.for([
		{ name: 'Enter', key: 'Enter' },
		{ name: 'Space', key: ' ' },
	])('opens the diagnostics report once with $name, and closes the notice', async ({ name, key }, { native: { browser, ui, directory } }) => {
		await seedKitchenRequirement(browser, ui);
		await breakZoneNote(browser, ui, en['sample.zone.bathroom']);
		await browser.$(EDITOR).$('.rp-room-inspector .rp-editor-inspector-delete').click();
		const reassign = browser.$('[data-rp-action="reassign"]');
		await expect.poll(() => reassign.isDisplayed()).toBe(true);
		await reassign.click();

		const action = () => browser.$('.rp-notice-action');
		await expect.poll(() => action().isExisting()).toBe(true);
		// Read from the DOM: `getText` answers '' for a notice still sliding in (`noticeMessages`).
		expect(await noticeMessages(browser, '.notice-container .notice:has(.rp-notice-action)')).toEqual([en['zone.listing-incomplete']]);
		expect(await textOf(action())).toBe(en['command.show-diagnostics-report']);
		expect(await browser.$('.rp-notice:has(.rp-notice-action) .rp-notice-dismiss').isExisting()).toBe(true);

		const unfocused = await ringOf(browser);
		const presses = await tabToReportButton(browser);
		const focused = await ringOf(browser);
		await writeEvidence(directory, 'keyboard', { key: name, tabPresses: presses, unfocused, focused });
		// A ring the case can see: something drawn on focus that the button does not draw without it.
		expect(focused).not.toEqual(unfocused);
		expect(focused.outline.startsWith('none') && focused.shadow === 'none').toBe(false);

		expect(await reports(browser)).toBe(0);
		await browser.keys(key);
		await expect.poll(() => reports(browser)).toBe(1);
		// "Once": a second opening would arrive after the first, so it is waited for.
		await browser.pause(500);
		expect(await reports(browser)).toBe(1);
		await expect.poll(() => action().isExisting()).toBe(false);
	});
});

describe('the getting-started guide (BP-10, owner rulings 47 and 49)', () => {
	test('opens from the palette, and every control it quotes carries exactly that label', async ({ native: { browser, ui, directory } }) => {
		await expectGuide(browser, ui, directory, ENGLISH_GUIDE);
	});
});

/** Where focus is, relative to one room list: a row's id, a lock's zone id, and whether it is inside. */
const focusIn = (browser: NativeBrowser, list: WebdriverIO.Element): Promise<{ row: string | null; lock: string | null; inList: boolean }> =>
	browser.execute((within: HTMLElement) => {
		const active = document.activeElement as HTMLElement | null;
		return { row: active?.dataset.rpId ?? null, lock: active?.dataset.rpLock ?? null, inList: active !== null && within.contains(active) };
	}, list);

/**
 * The seeded plan's Floor inspector Rooms list, entered by Tab from the focusable control just
 * before it in document order — whichever that is, recorded rather than assumed.
 */
async function tabIntoRooms(browser: NativeBrowser, ui: Ui): Promise<{ list: WebdriverIO.Element; ids: string[]; before: string | null }> {
	await seedSampleProject(browser, ui);
	await openDetails(browser);
	const list = await browser.$(EDITOR).$('[data-rp-region="inspector"]').$('.rp-room-list').getElement();
	await expect.poll(() => list.isDisplayed()).toBe(true);
	const ids = (await list.$$('.rp-room-list__row').map((row) => row.getAttribute('data-rp-id'))).map(String);
	expect(ids).toHaveLength(3);
	const before = await browser.execute((within: HTMLElement) => {
		const candidates = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter(
			(element) =>
				element.tabIndex >= 0 &&
				!element.hasAttribute('disabled') &&
				element.getClientRects().length > 0 &&
				!within.contains(element) &&
				(element.compareDocumentPosition(within) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		);
		const previous = candidates.at(-1);
		previous?.focus();
		return previous ? previous.outerHTML.slice(0, 160) : null;
	}, list);
	await browser.keys('Tab');
	return { list, ids, before };
}

describe('the Rooms list keyboard (L-46)', () => {
	desktop('is one Tab stop, the arrows move between rooms, and Shift+Tab returns to the same row', async ({ native: { browser, ui, directory } }) => {
		const { list, ids, before } = await tabIntoRooms(browser, ui);
		expect(await list.$$('.rp-room-list__row[tabindex="0"]').map((row) => row.getAttribute('data-rp-id'))).toEqual([ids[0]]);
		expect(await list.$$('[data-rp-lock]').map((lock) => lock.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1']);
		expect(await focusIn(browser, list)).toEqual({ row: ids[0], lock: null, inList: true });

		await browser.keys('ArrowDown');
		await browser.keys('ArrowDown');
		expect(await focusIn(browser, list)).toEqual({ row: ids[2], lock: null, inList: true });
		expect(await list.$$('.rp-room-list__row[tabindex="0"]').map((row) => row.getAttribute('data-rp-id'))).toEqual([ids[2]]);

		await browser.keys('Tab');
		const outside = await focusIn(browser, list);
		expect(outside.inList).toBe(false);
		await browser.keys(['Shift', 'Tab']);
		expect(await focusIn(browser, list)).toEqual({ row: ids[2], lock: null, inList: true });
		await writeEvidence(directory, 'rooms-keyboard', { before, ids, outside });
	});

	desktop('reaches a room\'s lock with ArrowRight, toggles it with Enter, and returns with ArrowLeft', async ({ native: { browser, ui } }) => {
		const { list, ids } = await tabIntoRooms(browser, ui);
		expect(await focusIn(browser, list)).toEqual({ row: ids[0], lock: null, inList: true });
		const lock = list.$(`[data-rp-lock="${ids[0]}"]`);
		// The lock's state is its accessible name and nothing else: AD18-R23 dropped `aria-pressed`
		// from `ZoneLockToggle.vue`, because "Unlock Kitchen, pressed" read the state twice, opposite ways.
		const name = String(Object.values(await ui.notesOfType('renovation-zone')).find((zone) => zone.id === ids[0])?.name);
		const named = (key: 'editor.input.lock' | 'editor.input.unlock'): string => en[key].replace('{name}', name);
		expect({ label: await lock.getAttribute('aria-label'), pressed: await lock.getAttribute('aria-pressed') }).toEqual({
			label: named('editor.input.lock'),
			pressed: null,
		});

		await browser.keys('ArrowRight');
		expect(await focusIn(browser, list)).toEqual({ row: null, lock: ids[0], inList: true });
		await browser.keys('Enter');
		await expect.poll(() => lock.getAttribute('aria-label')).toBe(named('editor.input.unlock'));
		await expect
			.poll(async () => Object.values(await ui.notesOfType('renovation-zone')).find((zone) => zone.id === ids[0])?.locked)
			.toBe(true);
		expect(await focusIn(browser, list)).toEqual({ row: null, lock: ids[0], inList: true });

		await browser.keys('ArrowLeft');
		expect(await focusIn(browser, list)).toEqual({ row: ids[0], lock: null, inList: true });
	});
});
