import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage, DESIGNER, type DesignerPage, type ObsidianPage } from './designer';
import { createParityPage, type ParityPage } from './designerParity';
import type { PlannerPage } from './helpers';
import { allLeaves, designerPicture } from './recovery';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * `docs/tests/cases/Design an Asset.md`, the chord rows whose remaining clause is what the HOST
 * does with a key the designer leaves alone or swallows: Ctrl+G with the selection cleared
 * (step 96), Ctrl+Z on a focused Line dropdown and Corner radius slider (step 118), and Ctrl+Z
 * once the history is spent (step 121).
 *
 * "An Obsidian binding fires" is read as the host RUNNING a command: `recordCommands` wraps its
 * command doors, which the Ctrl+G case proves against `graph:open`. In 1.13.7 a matched hotkey
 * on a first press runs its command — `onTrigger` calls `executeCommand`, which calls
 * `checkCallback(false)` without a `checkCallback(true)` first (read from the 1.13.7 `app.js`) —
 * so a binding that exists for a chord is a binding that fires. Measured with a fresh profile: no
 * command's effective hotkeys include Mod+Z, Mod+Y or Mod+Shift+Z, so for 118 and 121 the host
 * has nothing to fire; each case pins that list too, read after the chord.
 */
const desktop = mobileEmulation ? test.skip : test;

/** The chords a host binding could claim for undo and redo, as the hotkey manager spells them. */
const HISTORY_CHORDS = ['Mod+Z', 'Mod+Y', 'Mod+Shift+Z'];
/** How long a chord that should do nothing is given to do something anyway. */
const SETTLE_MS = 600;

interface Walk { designer: DesignerPage; parity: ParityPage; assetId: string }

/** The toilet fixture, with the parity page's instruments over it. */
async function walk(browser: NativeBrowser, page: ObsidianPage, ui: PlannerPage, name: string): Promise<Walk> {
	const designer = createDesignerPage(browser, page, ui);
	return { designer, parity: createParityPage(browser, designer), assetId: await designer.createToilet(name) };
}

/** Focus a control of the active designer by script — a click would open a dropdown's native list. */
async function focusControl(browser: NativeBrowser, { designer }: Walk, selector: string): Promise<void> {
	const control = designer.designer().$(selector);
	await expect.poll(() => control.isDisplayed()).toBe(true);
	await browser.execute((element: HTMLElement) => {
		element.focus();
	}, await control.getElement());
	expect(await control.isFocused()).toBe(true);
}

/**
 * One Ctrl+Z on whatever holds focus, and everything the host could have done with it: no command
 * run, no leaf opened or closed, no write — and the chord as the two `window` listeners saw it.
 */
async function expectHostIdle(browser: NativeBrowser, { designer, parity, assetId }: Walk, seen: string[]): Promise<void> {
	const revision = designer.readSidecar(assetId).revision;
	const leaves = await allLeaves(browser);
	await browser.keys(['Control', 'z']);
	await browser.pause(SETTLE_MS);
	expect(await parity.commandsRun()).toEqual([]);
	expect(await allLeaves(browser)).toEqual(leaves);
	expect(await parity.chords()).toEqual(seen);
	expect(designer.readSidecar(assetId).revision).toBe(revision);
}

/** Left to the page by everyone: un-prevented at capture, and back up at bubble. */
const UNCLAIMED = ['capture:Ctrl+Z', 'bubble:Ctrl+Z'];

describe('Design an Asset, what the host does with a chord the designer leaves or swallows', () => {
	// Step 96, the cleared-selection variant.
	desktop('leaves a Ctrl+G with nothing selected to the host, which opens its graph view', async ({ native: { browser, page, ui } }) => {
		const { designer, parity, assetId } = await walk(browser, page, ui, 'Cleared toilet');
		await parity.watchChords();
		await parity.recordCommands();
		await designer.focusCanvas();
		await browser.keys('Escape');
		await expect.poll(async () => (await designerPicture(browser)).pressed).toEqual([]);
		const revision = designer.readSidecar(assetId).revision;

		// Under the default binding: nothing in the designer, and the host's own command runs.
		await designer.focusCanvas();
		await parity.pressCtrlG();
		expect(await parity.commandsRun()).toEqual(['graph:open']);
		await expect.poll(parity.graphLeaves).toBe(1);
		expect(await parity.chords()).toEqual(['capture:Ctrl+G:prevented']);
		expect(designer.readSidecar(assetId).revision).toBe(revision);

		// With that binding taken away no host command answers Ctrl+G, and the designer does not
		// claim the chord either: un-prevented at capture, and back up at bubble.
		await ui.activate(DESIGNER);
		await parity.unbindHotkey('graph:open');
		expect((await designerPicture(browser)).pressed).toEqual([]);
		await designer.focusCanvas();
		await parity.pressCtrlG();
		expect(await parity.chords()).toEqual(['capture:Ctrl+G', 'bubble:Ctrl+G']);
		expect(await parity.commandsRun()).toEqual([]);
		expect(designer.readSidecar(assetId).revision).toBe(revision);
		expect(await parity.graphLeaves()).toBe(1);
	});

	// Step 118, whether a host binding also answers either focused control.
	desktop('runs no host command for a Ctrl+Z on the Line dropdown or the Corner radius slider', async ({ native: { browser, page, ui } }) => {
		const fixture = await walk(browser, page, ui, 'Bound box');
		const { designer, parity, assetId } = fixture;
		// Drawn and left selected, which is what puts both controls in the Inspector.
		await parity.drawBox('Draw rounded rectangle', [0.35, 0.55], [0.5, 0.7]);
		await parity.settle(assetId, 2);
		await parity.watchChords('z');
		await parity.recordCommands();

		await designer.designer().$('//details[.//select[@name="detail-line"]]/summary').click();
		await focusControl(browser, fixture, 'select[name="detail-line"]');
		await expectHostIdle(browser, fixture, UNCLAIMED);
		await focusControl(browser, fixture, 'input[name="corner-radius-slider"]');
		await expectHostIdle(browser, fixture, UNCLAIMED);

		// What the host would have had to bind, read last so a binding that DID fire is reported by
		// the run record above rather than by this list.
		expect(await parity.boundTo(HISTORY_CHORDS)).toEqual([]);
	});

	// Step 121, whether a host binding answers the Ctrl+Z the designer swallows once history is spent.
	desktop('runs no host command for a Ctrl+Z once nothing is left to undo, which the designer still swallows', async ({
		native: { browser, page, ui },
	}) => {
		const fixture = await walk(browser, page, ui, 'Spent toilet');
		const { designer, parity, assetId } = fixture;
		await designer.nudgeTo(assetId, 2);
		// Undo until the toolbar's own Undo dims: the nudge, then the preset.
		for (let press = 0; press < 5 && !(await designer.undoDisabled()); press += 1) {
			const before = designer.readSidecar(assetId).revision;
			await designer.focusCanvas();
			await browser.keys(['Control', 'z']);
			await expect.poll(() => designer.readSidecar(assetId).revision).toBe(before + 1);
		}
		await expect.poll(designer.undoDisabled).toBe(true);
		await parity.watchChords('z');
		await parity.recordCommands();

		await designer.focusCanvas();
		// Claimed on the canvas (step 121's first clause, pinned in the suite): seen un-prevented at
		// capture, and never back up at bubble.
		await expectHostIdle(browser, fixture, ['capture:Ctrl+Z']);
		expect(await parity.boundTo(HISTORY_CHORDS)).toEqual([]);
	});
});
