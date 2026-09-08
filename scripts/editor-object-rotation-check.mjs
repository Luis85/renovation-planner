import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate } from './editor-area-browser.mjs';
import { recordRoom, recordText, recordShot } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';

/** Supplemental journey: preserves the original nine final journeys and their provenance. */
async function journey(page, scenario, out) {
	await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme });
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await activate(page, '[data-rp-action="add"]');
	await page.locator('.rp-add-menu').waitFor();
	for (let n = 0; n < 15; n++) {
		if (await page.locator('[data-rp-entry="item"]').evaluate(el => el === document.activeElement)) break;
		await page.keyboard.press('ArrowDown');
	}
	await page.keyboard.press('Enter');
	const creation = '[data-rp-form="element-create"]';
	await page.locator(creation).waitFor();
	await page.waitForFunction(() => !document.querySelector('[name="element-name"]').readOnly);
	await activate(page, '.rp-object-rectangle summary');
	for (const [field, value] of Object.entries({ 'element-name': 'Rotation object', 'object-x': '1', 'object-y': '1', 'object-width': '1,2', 'object-depth': '0,6' })) await recordText(page, creation, field, value);
	await activate(page, '[data-rp-action="apply-object-rectangle"]');
	await activate(page, '[data-rp-action="finish-element"]'); await page.locator(creation).waitFor({ state: 'hidden' });
	await panel(page, 'details');
	const inspector = '.rp-element-inspector'; await page.locator(inspector).waitFor();
	await recordShot(page, scenario, out, 'selected-handle');
	await activate(page, `${inspector} [data-rp-action="rotate-object"]`);
	const form = '[data-rp-form="object-rotation"]'; await page.locator(form).waitFor();
	await recordText(page, form, 'angle', '27,25');
	await recordShot(page, scenario, out, 'numeric-preview');
	const a11y = await editorAccessibility(page, scenario, out, 'numeric-preview');
	await activate(page, `${form} button[type="submit"]`); await page.locator(form).waitFor({ state: 'hidden' });
	await activate(page, `${inspector} [data-rp-action="rotate-object-right"]`);
	await activate(page, `${inspector} [data-rp-action="rotate-object-left"]`);
	await activate(page, '[data-rp-action="undo"]'); await activate(page, '[data-rp-action="redo"]');
	await activate(page, `${inspector} [data-rp-action="rotate-object"]`); await page.locator(form).waitFor();
	await recordText(page, form, 'angle', 'invalid');
	assert.equal(await page.locator(`${form} [name="angle"]`).getAttribute('aria-invalid'), 'true');
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });
	await recordShot(page, scenario, out, 'completed');
	return { accessibility: [a11y], interaction: 'Keyboard numeric decimal comma, positive/negative quarter turn, Undo/Redo and invalid draft Escape', pointer: 'Covered separately by gesture/runtime tests; screenshot handle needs visual inspection', storage: 'Production commands/repositories over FakeVault; no native-host claim' };
}
await runAreaBrowserMatrix('editor-object-rotation', '&reference&planning', journey, '[data-rp-empty="floor-start"]');
