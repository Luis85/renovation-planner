import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';
import { panel } from './editor-structure-check.mjs';

async function resize(page, width) {
	await page.setViewportSize({ width, height: 900 });
	await page.waitForFunction(mode => document.querySelector('.rp-editor-shell')?.dataset.layout === mode, width < 900 ? 'constrained' : 'full');
}

async function journey(page, scenario, out) {
	await resize(page, 1440);
	const selector = '.rp-new-room input[name="width"]';
	await tabTo(page, selector);
	await page.keyboard.press('Control+A'); await page.keyboard.type('-');
	await page.keyboard.press('Home'); await page.keyboard.press('Shift+ArrowRight');
	const input = await page.locator(selector).elementHandle(); assert.ok(input);
	const widths = [460, 1440, 720, 1000, 460];
	for (const width of widths) {
		await resize(page, width);
		assert.deepEqual(await input.evaluate(el => ({
			same: el === document.querySelector('.rp-new-room input[name="width"]'),
			connected: el.isConnected, focused: el === document.activeElement, value: el.value,
			selection: [el.selectionStart, el.selectionEnd], visible: el.getClientRects().length > 0,
		})), { same: true, connected: true, focused: true, value: '-', selection: [0, 1], visible: true });
		if (width < 900) assert.equal(await page.locator('[data-rp-rail="details"]').getAttribute('aria-expanded'), 'true');
	}
	const reflow = await page.locator('.rp-inspector-drawer').evaluate(el => [el, el.querySelector('.rp-editor-inspector')].map(node => ({
		region: node.className, width: node.clientWidth, scroll: node.scrollWidth, scrollLeft: node.scrollLeft,
		left: node.getBoundingClientRect().left, overflow: getComputedStyle(node).overflowX,
	})));
	for (const region of reflow) assert.ok(region.scroll <= region.width + 1, `Inspector horizontal overflow: ${JSON.stringify(region)}`);
	await page.screenshot({ path: `${out}/${scenario.name}-focused-draft.png` });
	await page.keyboard.press('Escape');
	assert.equal(await page.locator('[data-rp-rail="details"]').evaluate(el => el === document.activeElement), true);
	await panel(page, 'details');
	assert.equal(await input.evaluate(el => el === document.querySelector('.rp-new-room input[name="width"]')), true);
	await tabTo(page, '.rp-plan-canvas'); await resize(page, 1440);
	assert.equal(await page.locator('.rp-plan-canvas').evaluate(el => el === document.activeElement), true, 'growth does not steal focus from canvas');
	const checkbox = '[data-rp-region="layers"] input:not(:disabled)';
	await tabTo(page, checkbox);
	const layersInput = await page.locator(checkbox).first().elementHandle(); assert.ok(layersInput);
	await resize(page, 460);
	assert.equal(await page.locator('[data-rp-rail="layers"]').getAttribute('aria-expanded'), 'true');
	assert.equal(await layersInput.evaluate(el => el === document.activeElement), true);
	await page.screenshot({ path: `${out}/${scenario.name}-focused-layers.png` });
	await activate(page, '.rp-overlay-panel__close');
	assert.equal(await page.locator('[data-rp-rail="layers"]').evaluate(el => el === document.activeElement), true);
	await panel(page, 'details'); await tabTo(page, '.rp-inspector-drawer__close');
	await resize(page, 1440);
	assert.equal(await page.locator('[data-rp-region="inspector"]').evaluate(el => el === document.activeElement), true, 'removed close button hands focus to its region');
	const metrics = await page.locator('.rp-plan-canvas').boundingBox(); assert.ok(metrics.width > 500);
	await page.screenshot({ path: `${out}/${scenario.name}-full.png` });
	return { widths, reflow, inputIdentity: 'preserved', pendingText: '-', caretSelection: [0, 1], focusedRegionAutoOpen: ['inspector', 'layers'], focusReturn: 'Escape, Close and disappearing chrome passed', canvasWidth: metrics.width };
}

await runAreaBrowserMatrix('persistent-editor-shell', '&room=4200x3800', journey, '.rp-task-banner__finish[aria-disabled="false"]');
