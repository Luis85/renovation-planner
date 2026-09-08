import assert from 'node:assert/strict';
import { activate } from './editor-area-browser.mjs';
import { recordText } from './editor-record-browser.mjs';

/** An additional upright design state; the original rotation/crop/PDF journey is unchanged. */
export async function prepareReferenceFidelity(page) {
	const form = '[data-rp-form="reference"]';
	await activate(page, '.rp-floor-start [data-rp-action="reference"]'); await page.locator(form).waitFor();
	await recordText(page, form, 'source', 'scan.png'); await activate(page, '[data-rp-action="load-reference"]');
	await page.locator('.rp-reference-preview').waitFor();
	for (const [name, value] of Object.entries({ 'crop-x': '0', 'crop-width': '1640', rotation: '0' })) {
		assert.equal(await page.locator(`${form} input[name="${name}"]`).inputValue(), value);
	}
	await activate(page, `${form} button[type="submit"]`); await page.locator(`${form} input[name="ax"]`).waitFor();
	const measurements = { ax: '20', ay: '20', bx: '820', by: '20', length: '4.2' };
	for (const [name, value] of Object.entries(measurements)) await recordText(page, form, name, value);
	for (const [name, value] of Object.entries(measurements)) assert.equal(await page.locator(`${form} input[name="${name}"]`).inputValue(), value);
	assert.equal(await page.locator(`${form} [role="alert"]`).count(), 0);
	assert.equal(await page.locator('.rp-reference-preview').isVisible(), true);
}
