import { recordText, recordApply, recordShot, recordRoom } from './editor-record-browser.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
const form = '[data-rp-form="planning"]';
async function shot(page, scenario, out, state) {
 await recordShot(page, scenario, out, state);
 if (['materials', 'costs', 'photos'].includes(state)) await editorAccessibility(page, scenario, out, state);
}
const text = (page, name, value, scope = form) => recordText(page, scope, name, value);
async function choose(page, name, index) { await tabTo(page, `${form} select[name="${name}"]`); await page.keyboard.press('Home'); for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab'); }
const apply = (page, scope = form) => recordApply(page, scope, scope !== form);
async function work(page) {
 const recordForm = '[data-rp-form="renovation"]';
 await activate(page, '[data-rp-mode="existing"]'); await activate(page, '[data-rp-action="new-record"]'); await text(page, 'description', 'Timber floor', recordForm); await apply(page, recordForm);
 await activate(page, '[data-rp-action="plan-record"]'); await text(page, 'description', 'Repair and oil', recordForm); await apply(page, recordForm);
 await activate(page, '[data-rp-mode="planned"]'); await activate(page, '[data-rp-action="work-record"]'); await text(page, 'title', 'Floor finish', recordForm); await apply(page, recordForm);
}
async function materials(page, scenario, out) {
 await activate(page, '[data-rp-mode="materials"]'); await activate(page, '[data-rp-new-material]'); await choose(page, 'asset', 1); await choose(page, 'work', 1);
 await text(page, 'waste', '17'); await page.setViewportSize({ width: scenario.width === 460 ? 1280 : 460, height: 900 }); assert.equal(await page.locator(`${form} [name="waste"]`).evaluate(el => document.activeElement === el), true); assert.equal(await page.locator(`${form} [name="waste"]`).inputValue(), '17'); await page.setViewportSize({ width: scenario.width, height: 900 }); await text(page, 'waste', '10'); await text(page, 'lot', '2'); await text(page, 'minimum', '4'); await shot(page, scenario, out, 'material-draft'); await apply(page); await panel(page, 'details');
 await activate(page, '[data-rp-material-details]'); await activate(page, '.rp-planning-actions button:nth-child(2)'); await text(page, 'purchased', '2'); await text(page, 'reserved', '1'); await apply(page); await activate(page, '[data-rp-material-details]'); await shot(page, scenario, out, 'materials');
 await activate(page, '.rp-renovation-inspector > button:last-of-type');
 await activate(page, '[data-rp-new-material]'); await text(page, 'waste', '23'); await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' }); assert.equal(await page.locator('.rp-material-row').count(), 1);
}
async function costs(page, scenario, out) {
 await activate(page, '[data-rp-mode="costs"]'); await activate(page, '.rp-planning-actions button:first-child'); await text(page, 'title', 'Floor supply'); await activate(page, '[data-rp-add-fact]'); await text(page, 'amount', '500'); await text(page, 'fact-description', 'Order'); await activate(page, '[data-rp-add-fact]');
 await tabTo(page, `${form} fieldset:last-of-type select[name="stage"]`); await page.keyboard.press('End'); await page.keyboard.press('Tab');
 await text(page, 'amount', '200', `${form} fieldset:last-of-type`); await text(page, 'fact-description', 'Deposit', `${form} fieldset:last-of-type`); await choose(page, 'settles', 1); await shot(page, scenario, out, 'partial-payment'); await apply(page);
 const group = '.rp-cost-group', summary = '[data-rp-cost-work]';
 const totals = await page.locator('.rp-cost-totals').first().innerText();
 await activate(page, summary); assert.equal(await page.locator(group).evaluate(el => el.open), false);
 await activate(page, summary); assert.equal(await page.locator(group).evaluate(el => el.open), true);
 assert.equal(await page.locator(summary).getAttribute('aria-current'), 'true');
 assert.equal(await page.locator(summary).evaluate(el => el === document.activeElement), true);
 assert.equal(await page.locator('.rp-cost-totals').first().innerText(), totals);
 await shot(page, scenario, out, 'costs');
}
async function evidence(page, scenario, out) {
 await activate(page, '.rp-planning-actions button:last-child'); await activate(page, '[data-rp-new-evidence]'); await text(page, 'title', 'Invoice'); await text(page, 'path', 'scan.pdf'); await choose(page, 'phase', 1); await apply(page); await shot(page, scenario, out, 'documents');
 await activate(page, '.rp-planning-actions button:first-child');
 await activate(page, '[data-rp-mode="notes"]'); await activate(page, '[data-rp-new-evidence]'); await text(page, 'title', 'Hidden service route'); await activate(page, `${form} button[type="button"]`); await page.waitForFunction(() => document.querySelector('[name="path"]')?.value.includes('Evidence/Note-')); await choose(page, 'phase', 3); await tabTo(page, `${form} input[type="checkbox"]`); await page.keyboard.press('Space'); await apply(page); await shot(page, scenario, out, 'notes');
 if (scenario.width === 460) await page.keyboard.press('Escape');
 await activate(page, '[data-rp-action="undo"]'); await activate(page, '[data-rp-action="redo"]'); await panel(page, 'details');
 await activate(page, '[data-rp-mode="photos"]'); await activate(page, '[data-rp-new-evidence]'); await text(page, 'title', 'Floor before'); await text(page, 'path', 'scan.png'); await tabTo(page, `${form} input[type="checkbox"]`); await page.keyboard.press('Space'); await apply(page);
 await activate(page, '[data-rp-evidence-photo]'); await page.waitForFunction(() => [...document.querySelectorAll('.rp-evidence-gallery img')].some(image => image.complete && image.naturalWidth > 0)); await shot(page, scenario, out, 'photos');
 if (scenario.width === 460) await page.keyboard.press('Escape'); await activate(page, '[data-rp-perspective="review"]'); await panel(page, 'details'); assert.equal(await page.locator('[data-rp-action="add"]').count(), 0); await activate(page, '[data-rp-action="review-note"]'); await shot(page, scenario, out, 'review');
}
export async function journey(page, scenario, out) {
 const tokens = await recordRoom(page, scenario, out, { preserveTheme, drawWalls, panel });
 await work(page); await materials(page, scenario, out); await costs(page, scenario, out); await evidence(page, scenario, out);
 return { theme: tokens, storage: 'production application services and repositories over FakeVault', journey: 'Room → Existing → Planned → Work → Materials → allocations → Costs → partial payment → Evidence → Review', input: 'Tab, native select arrows, typing, Enter, Escape; no fill/focus shortcuts', reflow: 'material draft and native focus preserved', history: 'evidence undo/redo', scope: 'browser host file open is recorded, not a live Obsidian leaf' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAreaBrowserMatrix('materials-costs-evidence', '&reference&planning', journey, '[data-rp-empty="floor-start"]');
