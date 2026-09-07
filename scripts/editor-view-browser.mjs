import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
import { recordShot } from './editor-record-browser.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';

async function toggle(page, selector) {
	await tabTo(page, selector); await page.keyboard.press('Space');
}

export async function verifyEditorView(page, scenario, out) {
	const selected = await page.locator('.rp-room-list__row[aria-pressed="true"]').count();
	await activate(page, '.rp-view-menu > summary');
	const zoom = await page.locator('.rp-view-menu output').innerText();
	await activate(page, '[data-rp-view="zoom-in"]');
	await activate(page, '[data-rp-view="zoom-in"]');
	assert.notEqual(await page.locator('.rp-view-menu output').innerText(), zoom);
	await activate(page, '[data-rp-view="zoom-out"]');
	await activate(page, '[data-rp-view="zoom-out"]');
	assert.equal(await page.locator('.rp-view-menu output').innerText(), zoom);
	await toggle(page, '[data-rp-view="grid"]'); await page.locator('.rp-canvas-grid').waitFor();
	await toggle(page, '[data-rp-view="snap"]');
	assert.equal(await page.locator('[data-rp-view="snap"]').isChecked(), false);
	await recordShot(page, scenario, out, 'view-controls');
	await editorAccessibility(page, scenario, out, 'view-controls');
	const contained = await page.locator('.rp-view-menu__content').evaluate(element => {
		const rect = element.getBoundingClientRect();
		return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
	});
	assert.equal(contained, true, 'View remains within the pane at constrained widths');
	await toggle(page, '[data-rp-view="grid"]');
	await toggle(page, '[data-rp-view="snap"]');
	await activate(page, '[data-rp-view="floor"]');
	await page.keyboard.press('Escape');
	assert.equal(await page.locator('.rp-view-menu > summary').evaluate(element => element === document.activeElement), true);
	assert.equal(await page.locator('.rp-room-list__row[aria-pressed="true"]').count(), selected);
}
