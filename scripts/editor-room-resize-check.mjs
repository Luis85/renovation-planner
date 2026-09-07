import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, selectRoomForEditing, assertDialogFocusWrap, checkDialogLayout, enterPair, undoRedo, tabTo } from './editor-area-browser.mjs';
import { checkModalReflow } from './editor-modal-reflow.mjs';

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
	await selectRoomForEditing(page);
	await activate(page, '[data-rp-action="resize-room"]');
	await page.locator('.rp-room-dimensions').waitFor();
	assert.equal(await page.locator('input[name="width"]').inputValue(), '4.2');
	assert.equal(await page.locator('input[name="depth"]').inputValue(), '3.5');
	await reflow(page, narrow, scenario.width);
	await extraReflow(page, narrow, scenario.width);
	await page.screenshot({ path: `${out}/${scenario.name}-modal-focus-return.png` });
	return { metrics, before, after: ['4.2', '3.5'], reflow: 'Room dimensions, outline and Area details retain native draft/opener and restore visible focus', storage: 'ephemeral in-memory repositories' };
}
async function reflow(page, narrow, originalWidth) {
	await dimensions(page, '5,1', '3.5');
	await checkModalReflow(page, { action: '[data-rp-action="resize-room"]', form: '.rp-room-dimensions', field: 'input[name="width"]', narrow });
	await page.setViewportSize({ width: originalWidth, height: 900 });
}
async function extraReflow(page, narrow, originalWidth) {
	await activate(page, '[data-rp-action="edit-outline"]'); await page.locator('[data-rp-form="outline-points"]').waitFor();
	await tabTo(page, 'input[name="0.x"]'); await page.keyboard.press('Control+A'); await page.keyboard.type('0,5');
	await checkModalReflow(page, { action: '[data-rp-action="edit-outline"]', form: '[data-rp-form="outline-points"]', field: 'input[name="0.x"]', narrow });
	await page.setViewportSize({ width: originalWidth, height: 900 });
	if (narrow) await activate(page, '[data-rp-rail="layers"]');
	await activate(page, '.rp-room-list__row[data-rp-id="harness-terrace"]');
	if (narrow) { await page.keyboard.press('Escape'); await activate(page, '[data-rp-rail="details"]'); }
	await activate(page, '[data-rp-action="area-details"]'); await page.locator('[data-rp-form="area-details"]').waitFor();
	await tabTo(page, 'input[name="name"]'); await page.keyboard.press('Control+A'); await page.keyboard.type('Unsaved terrace');
	await checkModalReflow(page, { action: '[data-rp-action="area-details"]', form: '[data-rp-form="area-details"]', field: 'input[name="name"]', narrow });
}
await runAreaBrowserMatrix('room-resize', '&resize=room', journey, '.rp-plan-canvas');
