import assert from 'node:assert/strict';
import { checkModalReflow } from './editor-modal-reflow.mjs';
import { runAreaBrowserMatrix, activate, selectRoomForEditing, assertDialogFocusWrap, checkDialogLayout, tabTo } from './editor-area-browser.mjs';

const form = '[data-rp-form="room-name"]';
const field = `${form} input[name="name"]`;
const action = '[data-rp-action="rename-room"]';
async function enterName(page, text) {
	await tabTo(page, field);
	await page.keyboard.press('Control+A'); await page.keyboard.type(text);
}
async function open(page) { await activate(page, action); await page.locator(form).waitFor(); }
async function journey(page, scenario, out) {
	const narrow = await selectRoomForEditing(page); await open(page);
	assert.equal(await page.locator(field).evaluate(el => el === document.activeElement), true);
	const before = await page.locator(field).inputValue();
	await enterName(page, ` ${before} `); await page.keyboard.press('Enter');
	assert.equal(await page.locator(`${form} button`).getAttribute('aria-disabled'), 'true', 'normalized no-op');
	await enterName(page, '   '); await page.keyboard.press('Enter');
	await page.locator(`${field}[aria-invalid="true"]`).waitFor();
	assert.equal(await page.locator(field).evaluate(el => el === document.activeElement), true);
	await enterName(page, 'Dining room');
	await page.keyboard.press('Space'); await page.keyboard.press('Backspace');
	await page.keyboard.press('Home'); await page.keyboard.press('Delete');
	assert.equal(await page.locator(field).inputValue(), 'ining room', 'native deletion edits text only');
	await enterName(page, 'Dining room'); await page.keyboard.press('Tab');
	assert.equal(await page.locator(`${form} button`).evaluate(el => el === document.activeElement), true, 'Name then Apply');
	await assertDialogFocusWrap(page, field);
	const metrics = await checkDialogLayout(page, scenario, out, [field, `${form} button`, '.rp-dialog [data-rp-action="cancel"]']);
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });
	assert.equal(await page.locator(action).evaluate(el => el === document.activeElement), true);
	await open(page); assert.equal(await page.locator(field).inputValue(), before, 'Cancel writes nothing');
	await enterName(page, 'Dining room'); await page.keyboard.press('Enter'); await page.locator(form).waitFor({ state: 'hidden' });
	assert.match(await page.locator('.rp-room-inspector').innerText(), /Dining room/);
	await verifyHistory(page, narrow, before);
	await open(page); assert.equal(await page.locator(field).inputValue(), 'Dining room');
	await reflow(page, narrow);
	return { metrics, before, after: 'Dining room', reflow: 'draft and focus preserved', storage: 'ephemeral in-memory repositories' };
}
async function verifyHistory(page, narrow, before) {
	if (narrow) await page.keyboard.press('Escape');
	await activate(page, '[data-rp-action="undo"]');
	await page.waitForFunction(() => !document.querySelector('[data-rp-action="redo"]').disabled);
	await inspectUndo(page, narrow, before);
	await activate(page, '[data-rp-action="redo"]');
	await page.waitForFunction(() => !document.querySelector('[data-rp-action="undo"]').disabled);
	await selectRoomForEditing(page);
}
async function inspectUndo(page, narrow, before) {
	if (narrow) await activate(page, '[data-rp-rail="details"]');
	assert.ok((await page.locator('.rp-room-inspector').innerText()).includes(before));
	if (narrow) await page.keyboard.press('Escape');
}
async function reflow(page, narrow) {
	await enterName(page, 'Unsaved draft');
	await checkModalReflow(page, { action, form, field, narrow });
}
await runAreaBrowserMatrix('room-naming', '&rename=room', journey, '.rp-plan-canvas');
