import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';

async function type(page, name, value, scope = '.rp-structure-task') {
	await tabTo(page, `${scope} input[name="${name}"]`);
	await page.keyboard.press('Control+A'); await page.keyboard.type(value);
}
async function add(page, kind) {
	await activate(page, '[data-rp-action="add"]');
	await page.locator('.rp-add-menu').waitFor();
	for (let i = 0; i < 15; i++) {
		if (await page.locator(`[data-rp-entry="${kind}"]`).evaluate(el => el === document.activeElement)) break;
		await page.keyboard.press('ArrowDown');
	}
	await page.keyboard.press('Enter'); await page.locator('.rp-structure-task').waitFor();
	await page.waitForFunction(() => document.querySelector('.rp-structure-task button')?.getAttribute('aria-disabled') === 'false');
}
async function reference(page) {
	const scope = '[data-rp-form="reference"]';
	await activate(page, '[data-rp-empty="floor-start"] [data-rp-action="reference"]');
	await page.locator(scope).waitFor(); await type(page, 'source', 'scan.png', scope);
	await activate(page, '[data-rp-action="load-reference"]'); await page.locator('.rp-reference-preview').waitFor();
	await activate(page, `${scope} button[type="submit"]`);
	for (const [name, value] of Object.entries({ ax: '100', ay: '100', bx: '1100', by: '100', length: '5' })) await type(page, name, value, scope);
	await activate(page, `${scope} button[type="submit"]`); await activate(page, `${scope} button[type="submit"]`);
	await page.locator(scope).waitFor({ state: 'hidden' });
}
async function panel(page, name) {
	if (await page.locator(`[data-rp-rail="${name}"]`).isVisible()) await activate(page, `[data-rp-rail="${name}"]`);
}
async function capture(page, scenario, out, name) {
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no page horizontal overflow');
	await page.screenshot({ path: `${out}/${scenario.name}-${name}.png` });
}
async function recalibrate(page, scenario, out) {
	await panel(page, 'layers'); await activate(page, '[data-rp-action="reference"]'); await page.locator('.rp-reference-preview').waitFor();
	const scope = '[data-rp-form="reference"]';
	await activate(page, `${scope} button[type="submit"]`); await type(page, 'length', '10', scope);
	await activate(page, `${scope} button[type="submit"]`); await activate(page, `${scope} button[type="submit"]`);
	await page.locator(`${scope} [role="alert"]`).waitFor();
	await tabTo(page, `${scope} input[name="consent"]`); await page.keyboard.press('Space');
	await capture(page, scenario, out, 'populated-reference');
	await activate(page, `${scope} button[type="submit"]`); await page.locator(scope).waitFor({ state: 'hidden' });
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await panel(page, 'details');
	assert.match(await page.locator('.rp-structure-inspector').innerText(), /10 m/);
	await activate(page, '[data-rp-action="undo"]');
	await page.waitForFunction(() => document.querySelector('.rp-structure-inspector')?.textContent.includes('5 m'));
}
async function drawWalls(page, scenario, out) {
	await reference(page); await add(page, 'wall');
	await type(page, 'x', 'invalid'); await activate(page, '.rp-structure-task button[type="submit"]');
	await page.locator('.rp-structure-task [role="alert"]').waitFor();
	await type(page, 'x', '0'); await page.keyboard.press('Space'); await page.keyboard.press('Backspace');
	assert.equal(await page.locator('.rp-structure-task input[name="x"]').inputValue(), '0');
	await page.setViewportSize({ width: scenario.width === 460 ? 1280 : 460, height: 900 });
	assert.equal(await page.locator('.rp-structure-task input[name="x"]').evaluate(el => el === document.activeElement), true, 'reflow retains input focus');
	await page.setViewportSize({ width: scenario.width, height: 900 });
	await activate(page, '.rp-structure-task button[type="submit"]');
	for (const [length, angle] of [['4','0'], ['3','90'], ['4','180']]) {
		await type(page, 'length', length); await type(page, 'angle', angle); await activate(page, '.rp-structure-task button[type="submit"]');
	}
	await activate(page, '.rp-structure-task .rp-dialog-actions button:last-child');
	await tabTo(page, '.rp-structure-task input[type="checkbox"]'); await page.keyboard.press('Space');
	await capture(page, scenario, out, 'closed-loop');
	await activate(page, '.rp-structure-task > button:last-child'); await page.locator('.rp-structure-task').waitFor({ state: 'hidden' });
	await panel(page, 'details'); await page.locator('.rp-structure-inspector').waitFor();
	await capture(page, scenario, out, 'wall-inspector');
	if (scenario.width === 460) await page.keyboard.press('Escape');
}
async function journey(page, scenario, out) {
	const tokens = await page.evaluate(() => Object.fromEntries(['--interactive-accent', '--text-accent', '--background-primary', '--background-secondary'].map(key => [key, getComputedStyle(document.body).getPropertyValue(key).trim()])));
	await page.addInitScript(theme => document.addEventListener('DOMContentLoaded', () => {
		for (const [key, value] of Object.entries(theme)) document.body.style.setProperty(key, value);
		window.dispatchEvent(new Event('rp-harness-theme'));
	}), tokens);
	await page.reload(); await page.locator('[data-rp-empty="floor-start"]').waitFor();
	assert.deepEqual(await page.evaluate(theme => Object.fromEntries(Object.keys(theme).map(key => [key, getComputedStyle(document.body).getPropertyValue(key).trim()])), tokens), tokens, 'theme survives fixture reload');
	if (scenario.accent) assert.equal(tokens['--interactive-accent'], '#7c246b');
	await drawWalls(page, scenario, out);
	for (const [kind, offset, width] of [['door','0.2','0.8'], ['window','1.3','0.8'], ['opening','2.5','0.8']]) {
		await add(page, kind); await type(page, 'offset', offset); await type(page, 'width', width);
		await activate(page, '.rp-structure-task > button:last-child'); await page.locator('.rp-structure-task').waitFor({ state: 'hidden' });
	}
	await panel(page, 'details'); await activate(page, '[data-rp-action="edit-structure"]'); await page.locator('.rp-dialog form').waitFor();
	await type(page, 'width', '1.2', '.rp-dialog'); await activate(page, '.rp-dialog form button[type="submit"]');
	await capture(page, scenario, out, 'opening-impact');
	await page.keyboard.press('Escape'); await page.locator('.rp-dialog').waitFor({ state: 'hidden' });
	await page.waitForFunction(() => document.activeElement === document.querySelector('[data-rp-action="edit-structure"]'));
	await activate(page, '[data-rp-action="edit-structure"]'); await page.locator('.rp-dialog form').waitFor();
	await type(page, 'width', '1.2', '.rp-dialog'); await activate(page, '.rp-dialog form button[type="submit"]'); await activate(page, '.rp-dialog form button[type="submit"]');
	await page.locator('.rp-dialog').waitFor({ state: 'hidden' });
	await activate(page, '.rp-structure-inspector summary'); await activate(page, '.rp-structure-inspector details button');
	await page.locator('.rp-dialog').waitFor(); await capture(page, scenario, out, 'delete-impact');
	await activate(page, '.rp-dialog [data-rp-action="confirm"]'); await page.locator('.rp-dialog').waitFor({ state: 'hidden' });
	await activate(page, '[data-rp-action="undo"]');
	await panel(page, 'layers');
	await page.waitForFunction(() => document.querySelectorAll('.rp-structure-list > ul > li ul button').length === 3);
	await activate(page, '.rp-structure-list > ul > li:first-child > button');
	if (scenario.width === 460) { await page.keyboard.press('Escape'); await panel(page, 'details'); }
	await activate(page, '[data-rp-action="edit-structure"]'); await page.locator('.rp-dialog form').waitFor();
	await type(page, 'length', '5', '.rp-dialog'); await activate(page, '.rp-dialog form button[type="submit"]');
	await capture(page, scenario, out, 'wall-impact'); await activate(page, '.rp-dialog form button[type="submit"]'); await page.locator('.rp-dialog').waitFor({ state: 'hidden' });
	await activate(page, '[data-rp-action="undo"]'); await activate(page, '[data-rp-action="redo"]');
	await capture(page, scenario, out, 'completed');
	await recalibrate(page, scenario, out);
	return { theme: tokens, reference: 'calibrated PNG; populated-floor recalibration requires consent and Undo restores measurements', creation: 'closed wall loop plus Room; door/window/opening', edits: 'numeric opening and connected wall with preview; cancel; undo/redo', deletion: 'confirmed opening removal and undo', reflow: 'native input focus retained', storage: 'real repositories over FakeVault' };
}
await runAreaBrowserMatrix('connected-walls', '&reference', journey, '[data-rp-empty="floor-start"]');
