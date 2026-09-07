import assert from 'node:assert/strict';
import { tabTo } from './editor-area-browser.mjs';

/** A mounted opener may be hidden after reflow; membership alone does not prove focus return. */
export async function checkModalReflow(page, { action, form, field, narrow }) {
	await tabTo(page, field);
	const opener = await page.locator(action).elementHandle(), input = await page.locator(field).elementHandle();
	assert.ok(opener); assert.ok(input);
	const value = await page.locator(field).inputValue();
	await page.setViewportSize({ width: narrow ? 1280 : 460, height: 900 });
	await page.waitForFunction(expected => !!document.querySelector('[data-rp-rail="details"]') === expected, !narrow);
	assert.equal(await opener.evaluate((el, selector) => el === document.querySelector(selector), action), true, 'same native opener');
	assert.equal(await input.evaluate((el, selector) => el === document.querySelector(selector) && el === document.activeElement, field), true, 'same focused native draft');
	assert.equal(await page.locator(field).inputValue(), value);
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });
	const target = narrow ? action : '[data-rp-rail="details"]';
	await page.locator(target).waitFor({ state: 'visible' });
	await page.waitForFunction(selector => document.querySelector(selector) === document.activeElement, target);
	assert.equal(await page.locator(target).isVisible(), true, 'restored focus is visible');
}
