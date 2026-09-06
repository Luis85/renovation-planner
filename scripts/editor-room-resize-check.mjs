import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, selectRoomForEditing, assertDialogFocusWrap, checkDialogLayout, enterPair, undoRedo } from './editor-area-browser.mjs';

async function dimensions(page, width, depth) {
	await enterPair(page, 'input[name="width"]', 'input[name="depth"]', width, depth);
	await page.keyboard.press('Tab');
	assert.equal(await page.locator('.rp-room-dimensions button[type="submit"]').evaluate(el => el === document.activeElement), true);
}
async function journey(page, scenario, out) {
	const narrow = await selectRoomForEditing(page);
	await activate(page, '[data-rp-action="resize-room"]');
	await page.locator('.rp-room-dimensions').waitFor();
	const before = [await page.locator('input[name="width"]').inputValue(), await page.locator('input[name="depth"]').inputValue()];
	assert.equal(await page.locator('input[name="width"]').evaluate(el => el === document.activeElement), true, 'first-field focus');
	await dimensions(page, 'bad', '0'); await page.keyboard.press('Enter');
	assert.equal(await page.locator('input[aria-invalid="true"]').count(), 2);
	assert.equal(await page.locator('input[name="width"]').evaluate(el => el === document.activeElement), true);
	await dimensions(page, '4,2', '3.5');
	await assertDialogFocusWrap(page, 'input[name="width"]');
	await page.keyboard.press('Space'); await page.keyboard.press('Backspace'); // native input edit, no canvas tool
	await dimensions(page, '4,2', '3.5');
	const metrics = await checkDialogLayout(page, scenario, out, ['input[name="width"]', 'input[name="depth"]', '.rp-room-dimensions button[type="submit"]', '.rp-dialog [data-rp-action="cancel"]']);
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
