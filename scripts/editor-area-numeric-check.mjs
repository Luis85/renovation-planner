import assert from 'node:assert/strict';
import { escapeAreaTool, runAreaBrowserMatrix } from './editor-area-browser.mjs';

// All navigation and editing after load uses real keyboard input, including focus movement.
async function tabTo(page, selector) {
	for (let count = 0; count < 150; count++) {
		if (await page.locator(selector).evaluateAll((els) => els.includes(document.activeElement))) return;
		await page.keyboard.press('Tab');
	}
	throw new Error(`Tab did not reach ${selector}`);
}
async function activate(page, selector) {
	await tabTo(page, selector);
	await page.keyboard.press('Enter');
}
async function pair(page, x, y) {
	await tabTo(page, '.rp-area-corners input[name="x"]');
	await page.keyboard.press('Control+A'); await page.keyboard.type(x);
	await page.keyboard.press('Tab');
	assert.equal(await page.locator('input[name="y"]').evaluate((el) => el === document.activeElement), true, 'x then y in tab order');
	await page.keyboard.press('Control+A'); await page.keyboard.type(y);
	await page.keyboard.press('Enter');
}
async function begin(page) {
	await activate(page, '[data-rp-action="add"]');
	await page.keyboard.press('Shift+Tab');
	assert.equal(await page.locator('.rp-add-menu__search').evaluate((el) => el === document.activeElement), true);
	const german = (await page.locator('[data-rp-entry="area"]').innerText()).includes('Fläche');
	await page.keyboard.type(german ? 'Terrasse' : 'garden');
	await page.keyboard.press('Enter');
	assert.equal(await page.locator('.rp-plan-canvas').evaluate((el) => el === document.activeElement), true);
	await activate(page, '.rp-area-corners summary');
	await page.keyboard.press('Tab');
	assert.equal(await page.locator('input[name="x"]').evaluate((el) => el === document.activeElement), true);
}
async function checkLayout(page, scenario, out) {
	const metrics = await page.locator('.renovation-plan-editor').evaluate((root) => ({ width: root.clientWidth, scroll: root.scrollWidth }));
	assert.ok(metrics.scroll <= metrics.width + 1, 'no editor overflow');
	for (const selector of ['.rp-task-banner', '.rp-area-corners__body', '.rp-task-banner__finish', '.rp-task-banner__cancel']) {
		const box = await page.locator(selector).boundingBox();
		assert.ok(box, `${selector} is visible`);
		assert.ok(box.x >= 0, `${selector} starts in view`);
		assert.ok(box.x + box.width <= scenario.width + 1, `${selector} fits horizontally`);
		assert.ok(box.y + box.height <= 900, `${selector} fits vertically`);
	}
	const body = await page.locator('.rp-area-corners__body').evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
	assert.ok(body.scroll <= body.width + 1, 'no coordinate form overflow');
	await page.screenshot({ path: `${out}/${scenario.name}.png` });
	return metrics;
}
async function journey(page, scenario, out) {
	const finish = page.locator('.rp-task-banner__finish');
	await page.waitForFunction(() => document.querySelectorAll('.rp-area-corners__list li').length === 4);
	await activate(page, '.rp-task-banner__cancel');
	await begin(page);
	await pair(page, 'bad', '');
	assert.equal(await page.locator('input[aria-invalid="true"]').count(), 2);
	assert.equal(await finish.getAttribute('aria-disabled'), 'true');
	await pair(page, '0', '0'); await pair(page, '4', '0'); await pair(page, '4', '0');
	assert.equal(await page.locator('.rp-area-corners__list li').count(), 2, 'duplicate refused');
	await pair(page, '4', '3');
	await activate(page, '[data-rp-corner="edit"]');
	await pair(page, '-1,25', '0');
	await pair(page, '-1.25', '3');
	await activate(page, '[data-rp-corner="remove"]');
	assert.equal(await page.locator('.rp-area-corners__list li').count(), 3);
	const geometryText = await page.locator('.rp-area-corners__list').innerText();
	await tabTo(page, 'input[name="x"]');
	await page.keyboard.type('unfinished'); await page.keyboard.press('Escape');
	assert.equal(await page.locator('input[name="x"]').inputValue(), 'unfinished', 'field Escape preserves input and outline');
	assert.equal(await finish.getAttribute('aria-disabled'), 'true');
	await activate(page, '[data-rp-corner="reset"]');
	assert.equal(await page.locator('.rp-area-corners__list').innerText(), geometryText);
	const metrics = await checkLayout(page, scenario, out);
	await activate(page, '.rp-task-banner__finish');
	await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	assert.equal(await page.locator('.rp-plan-canvas').evaluate((el) => el === document.activeElement), true);
	await activate(page, '[data-rp-action="undo"]');
	await page.waitForFunction(() => !document.querySelector('[data-rp-action="redo"]').disabled);
	await activate(page, '[data-rp-action="redo"]');
	await page.waitForFunction(() => document.querySelector('[data-rp-action="redo"]').disabled);
	await begin(page);
	await tabTo(page, '.rp-task-banner__repeat input'); await page.keyboard.press('Space');
	await pair(page, '0', '0'); await pair(page, '2', '0'); await pair(page, '2', '2');
	await activate(page, '.rp-task-banner__finish');
	await page.waitForFunction(() => document.querySelectorAll('.rp-area-corners__list li').length === 0);
	assert.equal(await page.locator('.rp-task-banner__repeat input').isChecked(), true, 'explicit repeat stays active');
	await pair(page, '1', '1');
	await tabTo(page, '[data-rp-corner="apply"]'); await page.keyboard.press('Escape');
	assert.equal(await page.locator('.rp-area-corners__list li').count(), 0, 'first Escape discards draft');
	await escapeAreaTool(page);
	return metrics;
}
async function pointerRegression(page) {
	await page.locator('[data-rp-action="add"]').click();
	await page.locator('[data-rp-entry="room"]').click();
	const canvas = await page.locator('.rp-plan-canvas').boundingBox();
	assert.ok(canvas);
	const left = canvas.x + canvas.width * 0.2, right = canvas.x + canvas.width * 0.65;
	const top = canvas.y + canvas.height * 0.65, bottom = canvas.y + canvas.height * 0.8;
	await page.mouse.move(left, top); await page.mouse.down();
	await page.mouse.move(right, bottom, { steps: 4 }); await page.mouse.up();
	assert.equal(await page.locator('.rp-task-banner__finish').getAttribute('aria-disabled'), 'false', 'Room drag remains valid');
	await page.locator('.rp-task-banner__finish').click();
	await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	await page.locator('[data-rp-action="add"]').click();
	await page.locator('[data-rp-entry="area"]').click();
	for (const [x, y] of [[left, top], [right, top], [right, bottom], [left, bottom]]) await page.mouse.click(x, y);
	assert.equal(await page.locator('.rp-area-corners__list li').count(), 4, 'mouse points share numeric list');
	await page.mouse.click(left, top);
	await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
}


await runAreaBrowserMatrix('area-numeric', '&area=numeric', async (page, scenario, out) => {
	const metrics = await journey(page, scenario, out);
	await pointerRegression(page);
	return { metrics, mouseRoomAndArea: 'passed', storage: 'ephemeral in-memory repositories' };
});
