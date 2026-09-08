import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, enterPair, undoRedo } from './editor-area-browser.mjs';

async function dimensions(page, width, depth) {
	await enterPair(page, 'input[name="width"]', 'input[name="depth"]', width, depth);
	await page.keyboard.press('Tab');
	assert.equal(await page.locator('.rp-room-dimensions button[type="submit"]').evaluate(el => el === document.activeElement), true);
}
async function selectRoom(page) {
	const narrow = await page.locator('[data-rp-rail="layers"]').isVisible();
	if (narrow) await activate(page, '[data-rp-rail="layers"]');
	await activate(page, '.rp-room-list__row[data-rp-id="harness-kitchen"]');
	if (narrow) { await page.keyboard.press('Escape'); await activate(page, '[data-rp-rail="details"]'); }
	return narrow;
}
async function journey(page, scenario, out) {
	const narrow = await selectRoom(page);
	await activate(page, '[data-rp-action="resize-room"]');
	await page.locator('.rp-room-dimensions').waitFor();
	const before = [await page.locator('input[name="width"]').inputValue(), await page.locator('input[name="depth"]').inputValue()];
	assert.equal(await page.locator('input[name="width"]').evaluate(el => el === document.activeElement), true, 'first-field focus');
	await dimensions(page, 'bad', '0'); await page.keyboard.press('Enter');
	assert.equal(await page.locator('input[aria-invalid="true"]').count(), 2);
	assert.equal(await page.locator('input[name="width"]').evaluate(el => el === document.activeElement), true);
	await dimensions(page, '4,2', '3.5');
	await page.keyboard.press('Tab');
	assert.equal(await page.locator('.rp-dialog [data-rp-action="cancel"]').evaluate(el => el === document.activeElement), true, 'Apply then Cancel');
	await page.keyboard.press('Tab');
	assert.equal(await page.locator('input[name="width"]').evaluate(el => el === document.activeElement), true, 'native dialog focus trap');
	await page.keyboard.press('Space'); await page.keyboard.press('Backspace'); // native input edit, no canvas tool
	await dimensions(page, '4,2', '3.5');
	const metrics = await checkLayout(page, scenario, out);
	await page.keyboard.press('Escape');
	await page.locator('.rp-room-dimensions').waitFor({ state: 'hidden' });
	assert.equal(await page.locator('[data-rp-action="resize-room"]').evaluate(el => el === document.activeElement), true, 'cancel restores opener');
	await page.keyboard.press('Enter'); await page.locator('.rp-room-dimensions').waitFor();
	assert.equal(await page.locator('input[name="width"]').inputValue(), before[0], 'Cancel writes nothing');
	await dimensions(page, '4,2', '3.5'); await page.keyboard.press('Enter');
	await page.locator('.rp-room-dimensions').waitFor({ state: 'hidden' });
	assert.match(await page.locator('.rp-room-inspector').innerText(), /14[.,]7/);
	if (narrow) await page.keyboard.press('Escape');
	await undoRedo(page);
	if (narrow) await activate(page, '[data-rp-rail="details"]');
	await activate(page, '[data-rp-action="resize-room"]');
	await page.locator('.rp-room-dimensions').waitFor();
	assert.equal(await page.locator('input[name="width"]').inputValue(), '4.2');
	assert.equal(await page.locator('input[name="depth"]').inputValue(), '3.5');
	await reflow(page, narrow, scenario.width);
	return { metrics, before, after: ['4.2', '3.5'], reflow: 'draft and focus preserved', storage: 'ephemeral in-memory repositories' };
}
async function checkLayout(page, scenario, out) {
	const metrics = await page.locator('.rp-dialog').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
	assert.ok(metrics.scroll <= metrics.width + 1, 'dialog has no horizontal overflow');
	for (const selector of ['input[name="width"]', 'input[name="depth"]', '.rp-room-dimensions button[type="submit"]', '.rp-dialog [data-rp-action="cancel"]']) {
		const box = await page.locator(selector).boundingBox();
		assert.ok(box, `${selector} is visible`);
		assert.ok(box.x >= 0); assert.ok(box.x + box.width <= scenario.width + 1);
		assert.ok(box.y >= 0); assert.ok(box.y + box.height <= 900);
	}
	await page.screenshot({ path: `${out}/${scenario.name}.png` });
	return metrics;
}
async function reflow(page, narrow, originalWidth) {
	await dimensions(page, '5,1', '3.5');
	await page.setViewportSize({ width: narrow ? 1280 : 460, height: 900 });
	await page.waitForFunction(expected => !!document.querySelector('[data-rp-rail="details"]') === expected, !narrow);
	assert.equal(await page.locator('input[name="width"]').inputValue(), '5,1', 'draft survives layout change');
	await page.keyboard.press('Escape');
	await page.locator('.rp-room-dimensions').waitFor({ state: 'hidden' });
	assert.equal(await page.locator('.renovation-plan-editor').evaluate(root => root.contains(document.activeElement)), true, 'reflow cancellation restores editor focus');
	await page.setViewportSize({ width: originalWidth, height: 900 });
}
await runAreaBrowserMatrix('room-resize', '&resize=room', journey, '.rp-plan-canvas');
