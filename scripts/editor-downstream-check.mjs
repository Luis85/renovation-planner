import assert from 'node:assert/strict';
import { activate, runAreaBrowserMatrix } from './editor-area-browser.mjs';
import { recordRoom, recordText, recordApply, recordShot } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';
import { captureInspectorDesign } from './editor-matching-views.mjs';
import { activateReady, assertEditorContext, chooseNative, createNamedCatalogueEntry, createQuote, createRoomCost, editorContextSnapshot, reviseReceivedQuote } from './editor-downstream-forms.mjs';

async function prepareWork(page, german) {
	const form = '[data-rp-form="renovation"]';
	await activate(page, '[data-rp-mode="existing"]'); await activate(page, '[data-rp-action="new-record"]');
	await recordText(page, form, 'description', german ? 'Abgenutzte Dielen' : 'Worn timber boards'); await recordApply(page, form, true);
	await activate(page, '[data-rp-action="plan-record"]');
	await recordText(page, form, 'description', german ? 'Dielen reparieren' : 'Repair the boards'); await recordApply(page, form, true);
	await activate(page, '[data-rp-mode="planned"]'); await activate(page, '[data-rp-action="work-record"]');
	await recordText(page, form, 'title', german ? 'Boden vorbereiten' : 'Prepare the floor'); await recordApply(page, form, true);
	await activate(page, '[data-rp-mode="work"]');
}

async function schedule(page, scenario, out) {
	const before = await editorContextSnapshot(page);
	await activateReady(page, '[data-rp-downstream="schedule"]'); await page.locator('.rp-project-work__rows > li').waitFor();
	assert.equal(await page.locator('.rp-plan-canvas').isVisible(), false, 'schedule opens outside the Inspector');
	await createNamedCatalogueEntry(page, '.rp-project-work__controls > button:nth-of-type(3)', 'Floor finishing');
	const originalRows = await page.locator('.rp-project-work__rows').innerText();
	await activateReady(page, '.rp-project-work__rows > li:first-child > button:first-of-type');
	const form = '[data-rp-form="renovation"]'; await page.locator(form).waitFor();
	await chooseNative(page, `${form} select[name="responsibility"]`, 2);
	await recordText(page, form, 'schedule-start', '2026-09-07');
	await recordText(page, form, 'schedule-end', '2026-09-09');
	await activate(page, `${form} button[type="submit"]`);
	await recordShot(page, scenario, out, 'schedule-preview');
	await editorAccessibility(page, scenario, out, 'schedule-preview', '.renovation-planner-view');
	await recordApply(page, form);
	assert.match(await page.locator('.rp-project-work__rows').innerText(), /Floor finishing/);
	assert.match(await page.locator('.rp-project-work__rows').innerText(), /2026-09-09/);
	const scheduledRows = await page.locator('.rp-project-work__rows').innerText();
	await activateReady(page, '.rp-project-work__controls > button:first-of-type');
	await page.waitForFunction(text => document.querySelector('.rp-project-work__rows')?.innerText === text, originalRows);
	await activateReady(page, '.rp-project-work__controls > button:nth-of-type(2)');
	await page.waitForFunction(text => document.querySelector('.rp-project-work__rows')?.innerText === text, scheduledRows);
	await recordShot(page, scenario, out, 'project-schedule');
	const accessibility = await editorAccessibility(page, scenario, out, 'project-schedule', '.renovation-planner-view');
	await activate(page, '.rp-project-work > header > button:last-of-type'); await page.locator('.rp-plan-canvas').waitFor();
	await assertEditorContext(page, before);
	await panel(page, 'details'); await activate(page, '[data-rp-mode="work"]');
	assert.match(await page.locator('.rp-renovation-inspector').innerText(), /Floor finishing/);
	await recordShot(page, scenario, out, 'room-work');
	await editorAccessibility(page, scenario, out, 'room-work');
	return accessibility;
}

async function quotes(page, scenario, out, matchingViews) {
	await activate(page, '[data-rp-mode="costs"]');
	await createRoomCost(page);
	await recordShot(page, scenario, out, 'room-costs');
	if (process.argv.includes('--design')) matchingViews.costs = await captureInspectorDesign(page, scenario, out, 'room-costs-design',
		{ selectors: ['.rp-renovation-inspector > h3', '.rp-cost-totals', '[data-rp-new-cost]'], topControl: '[data-rp-room-navigation]' });
	await editorAccessibility(page, scenario, out, 'room-costs');
	const before = await editorContextSnapshot(page);
	const costs = await page.locator('.rp-cost-totals').first().innerText();
	await activateReady(page, '[data-rp-downstream="quotes"]'); await page.locator('.rp-project-quotes').waitFor();
	assert.equal(await page.locator('.rp-plan-canvas').isVisible(), false, 'comparison opens outside the Inspector');
	await createNamedCatalogueEntry(page, '.rp-project-quotes .rp-project-work__controls > button:first-of-type', 'Local craft');
	await createQuote(page, { title: 'Floor offer A', amount: '640.00', issued: '2026-09-07', description: 'Prepare the floor' }, async () => {
		await recordShot(page, scenario, out, 'quote-preview');
		await editorAccessibility(page, scenario, out, 'quote-preview', '.renovation-planner-view');
	});
	await createNamedCatalogueEntry(page, '.rp-project-quotes .rp-project-work__controls > button:first-of-type', 'Nearby craft');
	await createQuote(page, { title: 'Floor offer B', amount: '700.00', issued: '2026-09-07', description: 'Prepare the floor', supplier: 'Nearby craft' });
	assert.equal(await page.locator('.rp-quote-comparison thead th[scope="col"]').count(), 3);
	assert.equal(await page.locator('.rp-quote-comparison tbody tr').count(), 1, 'both quotes share one real Work scope');
	assert.equal(await page.locator('.rp-quote-comparison tfoot td').count(), 2, 'supplier totals remain separate');
	assert.match(await page.locator('.rp-quote-comparison thead').innerText(), /Local craft/);
	assert.match(await page.locator('.rp-quote-comparison thead').innerText(), /Nearby craft/);
	await recordShot(page, scenario, out, 'quote-comparison');
	const accessibility = await editorAccessibility(page, scenario, out, 'quote-comparison', '.renovation-planner-view');
	await reviseReceivedQuote(page);
	await activate(page, '.rp-project-quotes > header > button:last-of-type'); await page.locator('.rp-plan-canvas').waitFor();
	await assertEditorContext(page, before);
	await panel(page, 'details');
	await activate(page, await page.locator('[data-rp-linked="costs"]').isVisible() ? '[data-rp-linked="costs"]' : '[data-rp-mode="costs"]');
	assert.equal(await page.locator('.rp-cost-totals').first().innerText(), costs, 'quote offers do not silently become spending facts');
	return accessibility;
}

async function journey(page, scenario, out) {
	const matchingViews = {};
	const theme = await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme });
	await prepareWork(page, scenario.name === 'german-constrained');
	const scheduleAccessibility = await schedule(page, scenario, out);
	const quoteAccessibility = await quotes(page, scenario, out, matchingViews);
	return { theme, scheduleAccessibility, quoteAccessibility, matchingViews,
		storage: 'production Work/Trade/Supplier/Quote services over the connected reference workspace vault',
		navigation: 'native editor and Project view-state paths; retained editor Room projection and selection',
		hostBoundary: 'browser workspace adapter; real Obsidian leaf/history/MetadataCache observations remain separate' };
}

await runAreaBrowserMatrix('editor-downstream', '&reference&planning&downstream&fidelity', journey, '[data-rp-empty="floor-start"]');
