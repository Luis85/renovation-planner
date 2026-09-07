import assert from 'node:assert/strict';
import { editorAccessibility as accessibility } from './editor-accessibility.mjs';
import { runAreaBrowserMatrix, activate } from './editor-area-browser.mjs';
import { recordRoom, recordShot, recordText } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';

const form = '[data-rp-form="element-create"]', inspector = '.rp-element-inspector';
async function addItem(page) {
	await activate(page, '[data-rp-action="add"]');
	await page.locator('.rp-add-menu').waitFor();
	let found = false;
	for (let count = 0; count < 15; count++) {
		if (await page.locator('[data-rp-entry="item"]').evaluate(el => el === document.activeElement)) { found = true; break; }
		await page.keyboard.press('ArrowDown');
	}
	assert.equal(found, true, 'Add menu keyboard reaches Item');
	await page.keyboard.press('Enter'); await page.locator(form).waitFor();
	await page.waitForFunction(() => !document.querySelector('[name="element-name"]').readOnly);
	await activate(page, '.rp-object-rectangle summary');
}
async function rectangle(page, name) {
	for (const [field, value] of Object.entries({ 'element-name': name, 'object-x': '1', 'object-y': '1', 'object-width': '1,2', 'object-depth': '0,6' })) await recordText(page, form, field, value);
}

async function journey(page, scenario, out) {
	const theme = await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme });
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await addItem(page);
	const name = scenario.name === 'german-constrained' ? 'Küchenschrank' : 'Kitchen cabinet';
	await rectangle(page, name);
	await recordText(page, form, 'object-width', '-');
	await activate(page, '[data-rp-action="apply-object-rectangle"]');
	const width = page.locator('[name="object-width"]');
	assert.equal(await width.getAttribute('aria-invalid'), 'true');
	assert.equal(await width.evaluate(el => el === document.activeElement), true);
	await page.setViewportSize({ width: 460, height: 720 });
	assert.equal(await width.inputValue(), '-');
	assert.equal(await width.evaluate(el => el === document.activeElement), true);
	await page.setViewportSize({ width: scenario.width, height: 900 });
	await recordShot(page, scenario, out, 'invalid-rectangle');
	const invalidAccessibility = await accessibility(page, scenario, out, 'invalid-rectangle');
	await recordText(page, form, 'object-width', '1,2'); await page.keyboard.press('Enter');
	assert.equal(await page.locator(`${form} ol > li`).count(), 4);
	assert.equal(await page.locator(form).isVisible(), true, 'Enter applies without also finishing');
	await recordShot(page, scenario, out, 'rectangle-preview');
	await activate(page, '[data-rp-action="finish-element"]'); await page.locator(form).waitFor({ state: 'hidden' });
	await panel(page, 'details'); await page.locator(inspector).waitFor();
	const overflow = await page.locator('.rp-editor-inspector').evaluate(el => el.scrollWidth - el.clientWidth);
	assert.ok(overflow <= 1, 'saved item Inspector has no nested horizontal overflow');
	const id = await page.locator(inspector).getAttribute('data-rp-id');
	assert.ok(id?.startsWith('element-')); assert.ok((await page.locator(inspector).innerText()).includes(name));
	await recordShot(page, scenario, out, 'saved-item');
	const savedAccessibility = await accessibility(page, scenario, out, 'saved-item');
	await activate(page, '[data-rp-action="edit-element"]');
	const edit = '[data-rp-form="outline-points"]'; await page.locator(edit).waitFor();
	await recordText(page, edit, 'name', `${name} 2`);
	await recordText(page, edit, '1.x', '2,5'); await recordText(page, edit, '2.x', '2,5');
	await activate(page, `${edit} button[type="submit"]`); await page.locator(edit).waitFor({ state: 'hidden' });
	assert.equal(await page.locator(inspector).getAttribute('data-rp-id'), id);
	assert.ok((await page.locator(inspector).innerText()).includes(`${name} 2`));
	await activate(page, '[data-rp-action="undo"]'); await page.waitForFunction(([selector, value]) => document.querySelector(`${selector} h3`)?.textContent === value, [inspector, name]);
	await activate(page, '[data-rp-action="redo"]'); await page.waitForFunction(([selector, value]) => document.querySelector(`${selector} h3`)?.textContent === value, [inspector, `${name} 2`]);
	await activate(page, '[data-rp-action="delete-element"]'); await page.locator('.rp-dialog').waitFor();
	assert.ok((await page.locator('.rp-dialog').innerText()).includes(`${name} 2`));
	await activate(page, '.rp-dialog [data-rp-action="confirm"]'); await page.locator('.rp-dialog').waitFor({ state: 'hidden' });
	await page.locator(inspector).waitFor({ state: 'hidden' });
	await activate(page, '[data-rp-action="undo"]');
	await panel(page, 'layers'); await activate(page, `[data-rp-id="${id}"]`);
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await panel(page, 'details'); await page.locator(inspector).waitFor();
	assert.equal(await page.locator(inspector).getAttribute('data-rp-id'), id);
	await recordShot(page, scenario, out, 'restored-item');
	return { theme, accessibility: [invalidAccessibility, savedAccessibility], storage: 'production commands and repositories over FakeVault', itemId: id, rectangle: 'invalid input, focus and reflow retained; Enter applied four corners', lifecycle: 'save, named outline edit, undo/redo, confirmed removal and undo', zoom: 'viewport reflow only; not browser zoom' };
}
await runAreaBrowserMatrix('editor-object', '&reference&planning', journey, '[data-rp-empty="floor-start"]');
