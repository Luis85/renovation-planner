import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';
import { panel } from './editor-structure-check.mjs';
import { recordText } from './editor-record-browser.mjs';

async function pendingSave(page, { form, choice, preview }, scenario, out) {
 const submit = `${form} button[type="submit"]`;
 if (preview) await activate(page, submit);
 await page.evaluate(() => window.planningRecovery.pauseWrites());
 await activate(page, submit);
 await page.waitForFunction(() => window.planningRecovery.snapshot().waitingWrites === 1);
 assert.equal(await page.locator(submit).evaluate(el => document.activeElement === el), true, 'Apply retains native focus while writing');
 await tabTo(page, choice);
 const value = await page.locator(choice).inputValue();
 await page.keyboard.press('ArrowDown');
 assert.equal(await page.locator(choice).inputValue(), value, 'busy native choice restores draft value');
 assert.equal(await page.locator(choice).evaluate(el => document.activeElement === el && !el.disabled), true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator(form).isVisible(), true, 'pending write keeps dialog open');
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('.rp-dialog').evaluate(el => el.contains(document.activeElement)), true, 'Tab remains in dialog');
 await page.screenshot({ path: `${out}/${scenario.name}-${preview ? 'renovation' : 'planning'}-pending.png` });
 await page.evaluate(() => window.planningRecovery.resumeWrites());
 await page.locator(form).waitFor({ state: 'hidden' });
 return { retainedApplyFocus: true, choiceRestored: value, busyEscapeAndTab: true };
}

await runAreaBrowserMatrix('modal-busy-focus', '&reference&planning&recovery', async (page, scenario, out) => {
 const fixture = await page.evaluate(() => window.planningRecovery.seedLarge());
 await panel(page, 'layers'); await activate(page, `.rp-room-list__row[data-rp-id="${fixture.firstRoom}"]`);
 if (scenario.width === 460) await page.keyboard.press('Escape');
 await panel(page, 'details'); await activate(page, '[data-rp-perspective="renovate"]'); await panel(page, 'details');
 await activate(page, '[data-rp-mode="existing"]'); await activate(page, '[data-rp-action="new-record"]');
 const renovation = '[data-rp-form="renovation"]';
 await recordText(page, renovation, 'description', 'Retain the existing finish');
 const existing = await pendingSave(page, { form: renovation, choice: `${renovation} select >> nth=0`, preview: true }, scenario, out);
 await activate(page, '[data-rp-mode="materials"]'); await activate(page, '[data-rp-new-material]');
 const planning = '[data-rp-form="planning"]';
 await tabTo(page, `${planning} [name="asset"]`); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
 const material = await pendingSave(page, { form: planning, choice: `${planning} [name="asset"]`, preview: false }, scenario, out);
 return { existing, material, counts: await page.evaluate(() => window.planningRecovery.snapshot()), scope: 'Native Chromium keyboard with production repositories held at the pending write boundary; no live Obsidian acceptance.' };
}, '[data-rp-empty="floor-start"]');
