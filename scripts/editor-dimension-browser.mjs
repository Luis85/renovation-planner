import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
import { recordText, recordShot } from './editor-record-browser.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';

/** Native entry, recovery and Undo on the same connected Room used by M00. */
export async function verifyRoomDimension(page, scenario, out) {
	const form = '[data-rp-form="room-dimension"]', label = '[data-rp-dimension="width"]';
	const initial = await page.locator(label).innerText();
	await activate(page, label); await page.locator(`${form} input`).waitFor();
	assert.equal(await page.locator(`${form} input`).evaluate(el => el === document.activeElement), true, 'dimension input owns focus');
	await recordText(page, form, 'width', '0'); await page.keyboard.press('Enter');
	assert.equal(await page.locator(`${form} input`).getAttribute('aria-invalid'), 'true');
	const invalidAccessibility = await editorAccessibility(page, scenario, out, 'inline-invalid');
	await recordText(page, form, 'width', '4,200');
	await page.setViewportSize({ width: 720, height: 450 });
	assert.equal(await page.locator(`${form} input`).inputValue(), '4,200');
	assert.equal(await page.locator(`${form} input`).evaluate(el => el === document.activeElement), true, 'native field survives supported reflow');
	const actionsVisible = await page.locator(form).evaluate(element => {
		const bounds = element.getBoundingClientRect();
		return [...element.querySelectorAll('button')].every(button => { const rect = button.getBoundingClientRect(); return rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.bottom <= innerHeight; });
	});
	assert.equal(actionsVisible, true, 'Apply and Cancel stay inside the visible inline form at supported reflow');
	await recordShot(page, scenario, out, 'M00-inline-dimension-draft');
	await page.setViewportSize({ width: scenario.width, height: 900 });
	const writes = await page.evaluate(() => window.planningRecovery.snapshot().zoneWrites);
	await page.evaluate(() => window.planningRecovery.pauseWrites());
	await activate(page, `${form} button[type="submit"]`);
	await page.waitForFunction(() => window.planningRecovery.snapshot().waitingWrites === 1);
	await tabTo(page, `${form} input`); await page.keyboard.press('Escape');
	await page.keyboard.press('Control+A'); await page.keyboard.type('9');
	assert.equal(await page.locator(`${form} input`).inputValue(), '4,200', 'pending write protects raw text');
	await activate(page, '[data-rp-action="select"]');
	assert.equal(await page.locator(form).isVisible(), true, 'Select cannot discard a pending write');
	const pendingAccessibility = await editorAccessibility(page, scenario, out, 'inline-pending');
	await page.evaluate(() => window.planningRecovery.resumeWrites());
	await page.locator(form).waitFor({ state: 'hidden' });
	assert.equal(await page.evaluate(() => window.planningRecovery.snapshot().zoneWrites), writes + 1, 'exactly one Room write');
	assert.equal(await page.locator(label).innerText(), '4.2 m');
	await activate(page, '[data-rp-action="undo"]');
	await page.waitForFunction(expected => document.querySelector(expected.label)?.textContent.trim() === expected.initial, { label, initial });
	return { input: 'native decimal entry; invalid value announced', reflow: 'same focused input and visible Apply/Cancel at 720 × 450', pending: 'Escape, editing and Select retain one pending write', history: 'Apply then exact displayed dimension restored by Undo', accessibility: [invalidAccessibility, pendingAccessibility] };
}
