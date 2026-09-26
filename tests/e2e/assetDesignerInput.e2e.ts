import { describe, expect } from 'vitest';
import { test } from './fixture';
import { createDesignerPage } from './designer';
import { createFollowupsPage } from './designerFollowups';
import { createParityPage } from './designerParity';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * Four clauses the gate could not reach because each needs an input or a measurement only the
 * real host makes: `Design an Asset.md` step 97's dedicated ContextMenu KEY (WebDriver has no key
 * code for it, so it is sent through Chrome DevTools' `Input.dispatchKeyEvent` over the driver's
 * `goog/cdp/execute` door — `sendCommandAndGetResult` — which enters the renderer's input pipeline
 * as a trusted key rather than as a script's `KeyboardEvent`); step 73's name read from Obsidian's
 * OWN hover tooltip; step 70's labels each keeping a point a click lands on; and `Calibrate a
 * sheet and reserve space.md` step 32's button reached by a real Tab.
 */
const desktop = mobileEmulation ? test.skip : test;

const ACTIVE = '.workspace-leaf.mod-active .workspace-leaf-content[data-type="renovation-asset-designer"]';

/** One press and release of the keyboard's dedicated ContextMenu key (Windows VK_APPS, 93), through CDP. */
async function pressContextMenuKey(browser: NativeBrowser): Promise<void> {
	const key = { key: 'ContextMenu', code: 'ContextMenu', windowsVirtualKeyCode: 93, nativeVirtualKeyCode: 93 };
	await browser.sendCommandAndGetResult('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
	await browser.sendCommandAndGetResult('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
}

/**
 * Every `keydown` the window sees from here on — at CAPTURE, with where it was aimed and whether the
 * browser made it, and back up at BUBBLE, which a key the designer claims never reaches — and every
 * `contextmenu`, which Chromium ALSO raises for this key and which is only recorded.
 */
const watchMenuEvents = (browser: NativeBrowser) =>
	browser.execute(() => {
		const holder = window as unknown as { rpKeys: string[]; rpMenus: string[] };
		holder.rpKeys = [];
		holder.rpMenus = [];
		window.addEventListener('keydown', (event) => holder.rpKeys.push(`capture:${event.key}:${(event.target as HTMLElement).className}:${String(event.isTrusted)}`), true);
		window.addEventListener('keydown', (event) => holder.rpKeys.push(`bubble:${event.key}`));
		window.addEventListener('contextmenu', (event) => holder.rpMenus.push(`${(event.target as HTMLElement).tagName}.${(event.target as HTMLElement).className}:${String(event.isTrusted)}`), true);
	});
const menuEvents = (browser: NativeBrowser) =>
	browser.execute(() => {
		const { rpKeys, rpMenus } = window as unknown as { rpKeys: string[]; rpMenus: string[] };
		return { rpKeys, rpMenus };
	});

describe('Design an Asset and Calibrate, the input and layout clauses only the real host settles', () => {
	// Design an Asset step 97, the real key's half.
	desktop('opens the right-click menu from the real ContextMenu key, delivered through the renderer as a trusted key', async ({
		native: { browser, page, ui },
	}) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		await designer.createToilet('Keyed toilet');
		const bowl = await designer.partCentre('detail-2');
		if (!bowl) throw new Error('No drawn bowl.');
		await parity.rightClick(bowl);
		await expect.poll(async () => (await parity.menuLines()).length).toBeGreaterThan(0);
		const rightClicked = await parity.menuLines();
		await browser.keys('Escape');
		await expect.poll(() => parity.menu().isExisting()).toBe(false);

		await watchMenuEvents(browser);
		await designer.focusCanvas();
		await pressContextMenuKey(browser);
		await expect.poll(parity.menuLines).toEqual(rightClicked);
		const { rpKeys, rpMenus } = await menuEvents(browser);
		console.log(`step 97 keys ${JSON.stringify(rpKeys)} contextmenu ${JSON.stringify(rpMenus)}`);
		// A trusted keydown on the focused canvas, claimed there: the designer's own key path opened
		// the menu. Chromium ALSO raises a trusted `contextmenu` for this key, aimed at the focused
		// element — measured with the key path broken, that event alone opened the same menu here,
		// because the point Chromium gives it happened to land on the selected bowl — so the menu
		// opening is not by itself evidence that the key reached the designer; this line is.
		expect(rpKeys).toEqual(['capture:ContextMenu:rp-plan-canvas:true']);
	});

	// Design an Asset step 73, the hover half.
	desktop('shows the library door\'s name in Obsidian\'s own hover tooltip at a sidebar width', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const parity = createParityPage(browser, designer);
		await designer.createToilet('Hovered toilet');
		await parity.setLeafWidth(460);
		const back = designer.designer().$('.rp-designer-open-library');
		const tooltips = () => browser.execute(() => [...document.querySelectorAll<HTMLElement>('body > .tooltip')].map((tip) => tip.textContent));
		expect(await tooltips()).toEqual([]);
		await back.moveTo();
		await expect.poll(tooltips).toEqual(['Back to library']);
		const [door, tip] = await browser.execute((sel) => {
			const button = document.querySelector(`${sel} .rp-designer-open-library`)?.getBoundingClientRect();
			const shown = document.querySelector('body > .tooltip')?.getBoundingClientRect();
			return [button?.toJSON() as DOMRect, shown?.toJSON() as DOMRect];
		}, ACTIVE);
		console.log(`step 73 door ${JSON.stringify(door)} tip ${JSON.stringify(tip)}`);
		// Drawn under the door it names, where Obsidian's default placement puts it.
		expect(tip.top).toBeGreaterThanOrEqual(door.bottom);
	});

	// Design an Asset step 70, the clickable half.
	desktop('leaves every number of the vanity\'s All dimensions frame a point a click lands on', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const f = createFollowupsPage(browser, designer);
		await designer.createAsset('Measured vanity');
		await designer.applyPreset('vanity');
		await f.allDimensions(true);
		await expect.poll(async () => (await f.dimensionNames()).length).toBe(26);
		await browser.pause(300);
		const unreachable = await browser.execute((sel) => {
			const root = document.querySelector(sel);
			const canvas = root?.querySelector('.rp-plan-canvas')?.getBoundingClientRect();
			return [...(root?.querySelectorAll<HTMLElement>('[data-rp-dimension]') ?? [])].flatMap((label) => {
				const name = label.dataset.rpDimension ?? '';
				const box = label.getBoundingClientRect();
				for (let x = box.left + 0.5; x < box.right; x += 1) {
					for (let y = box.top + 0.5; y < box.bottom; y += 1) {
						if ((document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-rp-dimension]')?.dataset.rpDimension === name) return [];
					}
				}
				return [`${name} ${JSON.stringify(box.toJSON())} canvas ${JSON.stringify(canvas?.toJSON())}`];
			});
		}, ACTIVE);
		console.log(`step 70 unreachable ${JSON.stringify(unreachable)}`);
		expect(unreachable).toEqual([]);
	});

	// Calibrate a sheet and reserve space step 32, the Tab half.
	desktop('reaches Mark clearance as reviewed with one Tab from the Inspector control before it', async ({ native: { browser, page, ui } }) => {
		const designer = createDesignerPage(browser, page, ui);
		const assetId = await designer.createAsset('Tabbed toilet');
		await designer.applyPreset('toilet');
		await designer.editDimensions(200, 350);
		await expect.poll(() => designer.readSidecar(assetId).shape?.clearanceNeedsReview).toBe(true);
		const button = designer.designer().$('button[data-rp-action="clearance-reviewed"]');
		await expect.poll(() => button.isDisplayed()).toBe(true);

		// The last focusable control before the button in the document — measured, the Clearance
		// block's Show clearance switch — focused by script, then one real Tab.
		const before = await browser.execute((sel) => {
			const inspector = document.querySelector(`${sel} .rp-designer-inspector`);
			const target = inspector?.querySelector('button[data-rp-action="clearance-reviewed"]');
			const controls = [...(inspector?.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, [tabindex]') ?? [])].filter(
				(el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0 && target !== null && target !== undefined && (el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
			);
			const last = controls.at(-1);
			last?.focus();
			return last ? `${last.tagName.toLowerCase()}:${last.getAttribute('name') ?? last.getAttribute('aria-label') ?? last.textContent?.trim() ?? ''}` : null;
		}, ACTIVE);
		expect(before).toBe('input:show-clearance');
		await browser.keys('Tab');
		expect(await button.isFocused()).toBe(true);
	});
});
