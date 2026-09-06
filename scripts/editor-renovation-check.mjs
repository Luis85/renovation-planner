import { recordText, recordApply, recordShot as shot, recordRoom } from './editor-record-browser.mjs';
import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
const translated = (scenario, english, german) => scenario.name === 'german-constrained' ? german : english;
const form = '[data-rp-form="renovation"]';
const text = (page, name, value) => recordText(page, form, name, value);
const apply = page => recordApply(page, form, true);
async function proposalAndReview(page, scenario, out) {
	await activate(page, '[data-rp-action="plan-record"]'); await page.locator(form).waitFor();
	await text(page, 'description', translated(scenario, 'Repair and oil the boards', 'Dielen reparieren und ölen')); await apply(page);
	await activate(page, '[data-rp-mode="planned"]'); await activate(page, '[data-rp-action="work-record"]'); await page.locator(form).waitFor();
	await text(page, 'title', translated(scenario, 'Prepare the floor', 'Boden vorbereiten')); await text(page, 'order', '1'); await apply(page);
	await activate(page, '[data-rp-action="decision-record"]'); await page.locator(form).waitFor();
	await text(page, 'question', translated(scenario, 'Which oil finish?', 'Welches Öl?')); await apply(page);
	await shot(page, scenario, out, 'planned');
	await activate(page, '[data-rp-mode="work"]'); await shot(page, scenario, out, 'work');
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await activate(page, '[data-rp-perspective="review"]'); await panel(page, 'details');
	assert.equal(await page.locator('[data-rp-action="add"]').count(), 0); await shot(page, scenario, out, 'review');
	await activate(page, '[data-rp-action="review-note"]');
	await activate(page, '.rp-renovation-inspector ol button'); await page.locator(form).waitFor();
	await tabTo(page, `${form} [name="resolved"]`); await page.keyboard.press('Space'); await text(page, 'resolution', 'Hardwax oil'); await apply(page);
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await activate(page, '[data-rp-perspective="review"]'); await panel(page, 'details');
	assert.equal(await page.locator('.rp-renovation-inspector ol li').count(), 0); await shot(page, scenario, out, 'resolved');
}
async function checkReflow(page, scenario) {
	const field = `${form} [name="description"]`;
	await page.setViewportSize({ width: scenario.width === 460 ? 1280 : 460, height: 900 });
	assert.equal(await page.locator(field).evaluate(el => el === document.activeElement), true, 'reflow retains draft focus');
	await page.setViewportSize({ width: scenario.width, height: 900 });
	await page.locator(`.rp-editor-shell[data-layout="${scenario.width < 900 ? 'constrained' : 'full'}"]`).waitFor();
}
async function journey(page, scenario, out) {
	const tokens = await recordRoom(page, scenario, out, { preserveTheme, drawWalls, panel }); await activate(page, '[data-rp-mode="existing"]');
	await activate(page, '[data-rp-action="new-record"]'); await page.locator(form).waitFor();
	await text(page, 'description', translated(scenario, 'Worn timber boards', 'Abgenutzte Dielen'));
	await checkReflow(page, scenario);
	await apply(page); await panel(page, 'details');
	await page.locator('.rp-renovation-inspector').waitFor();
	await shot(page, scenario, out, 'existing');
	await proposalAndReview(page, scenario, out);
	return { theme: tokens, records: 'Existing + Planned + linked Work + resolved Decision', source: 'ordinary Room created with closed walls through keyboard; actual repositories over FakeVault', navigation: 'list, perspectives, Review issue to resolution', reflow: 'draft text and focus retained', review: 'scoped findings and generated note; no Add controls' };
}
await runAreaBrowserMatrix('renovation-workflow', '&reference', journey, '[data-rp-empty="floor-start"]');
