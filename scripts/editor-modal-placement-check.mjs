import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate } from './editor-area-browser.mjs';
import { recordRoom, recordText, recordShot } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
import { referenceViewportAcceptance } from './editor-reference-viewport-browser.mjs';
import { openingMoveAcceptance } from './editor-opening-move-browser.mjs';

const form = '[data-rp-form="planning"]';
async function suggestions(page) {
	return page.locator(`${form} [name="path"]`).evaluate(input => [...document.getElementById(input.getAttribute('list')).querySelectorAll('option')].map(option => option.value));
}
async function photoAcceptance(page, scenario, out) {
	await activate(page, '[data-rp-perspective="renovate"]'); await panel(page, 'details');
	await activate(page, '[data-rp-mode="photos"]'); await activate(page, '[data-rp-new-evidence]'); await page.locator(form).waitFor();
	assert.equal(await page.locator('.rp-photo-details').evaluate(element => element.open), false);
	const visibleFields = await page.locator(`${form} input:visible`).evaluateAll(inputs => inputs.map(input => input.name || input.type));
	assert.deepEqual(visibleFields, ['path', 'file', 'title'], 'Photo Add initially exposes only image search/import and optional caption');
	assert.equal(await page.locator(`${form} [name="title"]`).inputValue(), '');
	assert.equal(await page.locator(`${form} [name="title"]`).evaluate(input => input.required), false);
	assert.equal(await page.locator(`${form} [data-rp-planning-apply]`).innerText(), scenario.name === 'german-constrained' ? 'Hinzufügen' : 'Add');
	const initial = await suggestions(page); assert.equal(initial.length, 20); assert.ok(initial.every(path => /\.png$/i.test(path)), 'non-image fixtures are excluded');
	assert.ok(await page.locator('.rp-dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
	await recordShot(page, scenario, out, 'photo-minimal-bounded-search');
	const start = Date.now(); await recordText(page, form, 'path', 'photo-modal-63');
	await page.waitForFunction(() => { const input = document.querySelector('[data-rp-form="planning"] [name="path"]'); const options = document.getElementById(input.getAttribute('list')).querySelectorAll('option'); return options.length === 1 && options[0].value === 'photo-modal-63.png'; });
	const queryMs = Date.now() - start; assert.deepEqual(await suggestions(page), ['photo-modal-63.png']);
	await recordText(page, form, 'path', 'photo-modal-63.png');
	const before = new Map(await page.evaluate(() => window.editorFidelity.savedNotes()));
	await activate(page, '[data-rp-planning-apply]'); await page.locator(form).waitFor({ state: 'hidden' });
	const photo = page.locator('[data-rp-evidence-photo]').filter({ hasText: 'photo-modal-63.png' }); await photo.waitFor();
	await activate(page, `[data-rp-evidence-photo="${await photo.getAttribute('data-rp-evidence-photo')}"]`);
	await page.waitForFunction(() => [...document.querySelectorAll('img.rp-evidence-thumbnail')].some(image => image.complete && image.naturalWidth > 0));
	const changed = (await page.evaluate(() => window.editorFidelity.savedNotes())).filter(([path, bytes]) => before.get(path) !== bytes);
	assert.ok(changed.some(([, bytes]) => bytes.includes('photo-modal-63.png')), 'the linked image is present in an actual saved note');
	await recordShot(page, scenario, out, 'photo-added-without-caption');
	return { fixtureImages: 64, fixtureNonImages: 256, initialSuggestionCount: initial.length, filteredSuggestionCount: 1, queryMs, visibleFields, metadataInitiallyCollapsed: true, blankCaptionSaved: true, changedPaths: changed.map(([path]) => path) };
}

/** Supplemental only: the original nine final journeys and eighteen comparisons are untouched. */
async function journey(page, scenario, out) {
	const reference = await referenceViewportAcceptance(page, scenario, out);
	await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme });
	const photo = await photoAcceptance(page, scenario, out);
	const opening = await openingMoveAcceptance(page, scenario, out);
	return { reference, photo, opening, storage: 'Production commands/repositories over FakeVault and explicit synthetic files', scope: 'Supplemental browser acceptance; native-host verification is separate' };
}
await runAreaBrowserMatrix('editor-modal-placement', '&reference&planning&fidelity&modal-placement-fixtures', journey, '[data-rp-empty="floor-start"]');
