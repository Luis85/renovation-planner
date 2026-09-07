import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, tabTo, activate } from './editor-area-browser.mjs';
import { recordRoom, recordShot, recordText, recordApply } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';

// Supplement the legacy unavailable-services shell fixture with a connected Floor/Room.
async function journey(page, scenario, out) {
	const theme = await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme });
	const german = scenario.name === 'german-constrained', form = '[data-rp-form="renovation"]';
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await activate(page, '[data-rp-action="add"]'); await recordShot(page, scenario, out, 'M02-connected-add'); await page.keyboard.press('Escape');
	await panel(page, 'details');
	await activate(page, '[data-rp-mode="existing"]'); await activate(page, '[data-rp-action="new-record"]');
	await recordText(page, form, 'description', german ? 'Abgenutzte Dielen' : 'Worn timber boards'); await recordApply(page, form, true);
	await activate(page, '[data-rp-action="plan-record"]'); await recordText(page, form, 'description', german ? 'Dielen reparieren und ölen' : 'Repair and oil the boards'); await recordApply(page, form, true);
	await activate(page, '[data-rp-mode="planned"]'); await activate(page, '[data-rp-action="work-record"]'); await recordText(page, form, 'title', german ? 'Boden vorbereiten' : 'Prepare the floor'); await recordApply(page, form, true);
	await activate(page, '[data-rp-mode="overview"]'); await page.locator('.rp-transformation-summary').waitFor();
	await recordShot(page, scenario, out, 'M00-connected-room');
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await tabTo(page, '.rp-plan-canvas'); await page.keyboard.press('Escape');
	await panel(page, 'details'); await page.locator('.rp-floor-inspector').waitFor();
	await activate(page, '[data-rp-perspective="plan"]');
	await recordShot(page, scenario, out, 'M01-connected-floor');
	await activate(page, '[data-rp-perspective="renovate"]');
	await panel(page, 'layers'); await activate(page, '.rp-structure-list__row');
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await panel(page, 'details');
	await activate(page, '[data-rp-mode="existing"]'); await activate(page, '[data-rp-action="new-record"]');
	await recordText(page, form, 'description', german ? 'Vorhandener Wandputz' : 'Original wall plaster'); await recordApply(page, form, true);
	await activate(page, '[data-rp-action="plan-record"]'); await recordText(page, form, 'description', german ? 'Putz reparieren und streichen' : 'Repair and paint plaster'); await recordApply(page, form, true);
	await activate(page, '[data-rp-mode="overview"]'); await recordShot(page, scenario, out, 'M07-connected-wall');
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await panel(page, 'layers');
	await tabTo(page, '.rp-structure-list > ul > li:nth-child(2) > button'); await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await panel(page, 'details'); await page.locator('.rp-multi-selection').waitFor();
	if (await page.locator('.rp-batch-actions select').isVisible()) { await tabTo(page, '.rp-batch-actions select'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); }
	await recordShot(page, scenario, out, 'M11-connected-selection');
	await activate(page, '[data-rp-batch="work"]');
	const batch = '[data-rp-form="renovation-batch"]';
	await recordText(page, batch, 'batch-title', german ? 'Beide Wände vorbereiten' : 'Prepare both walls');
	await activate(page, `${batch} button[type="submit"]`); await recordShot(page, scenario, out, 'M11-shared-preview');
	await activate(page, `${batch} button[type="submit"]`); await page.locator(batch).waitFor({ state: 'hidden' });
	assert.equal(await page.locator('.rp-multi-selection').isVisible(), true);
	return { theme, storage: 'production commands and repositories over FakeVault', state: 'committed reference, wall loop, Room, Existing/Planned/Work; overview, Floor and shared Work preview/apply', selection: 'keyboard additive wall membership retained after one shared command' };
}
await runAreaBrowserMatrix('editor-visual-overview', '&reference&planning', journey, '[data-rp-empty="floor-start"]');
