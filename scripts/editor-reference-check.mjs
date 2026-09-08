import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, tabTo, undoRedo } from './editor-area-browser.mjs';

const form = '[data-rp-form="reference"]';
const field = name => `${form} input[name="${name}"]`;
async function type(page, name, text) {
	await tabTo(page, field(name));
	await page.keyboard.press('Control+A'); await page.keyboard.type(text);
}
async function next(page) { await activate(page, `${form} button[type="submit"]`); }
async function capture(page, scenario, out, step) {
	const metrics = await page.locator('.rp-dialog').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
	assert.ok(metrics.scroll <= metrics.width + 1, 'no horizontal dialog overflow');
	for (const control of await page.locator(`${form} input`).all()) {
		const box = await control.boundingBox();
		assert.ok(box && box.x >= 0 && box.x + box.width <= scenario.width + 1, `control ${await control.getAttribute('name')} fits horizontally: ${JSON.stringify(box)}`);
	}
	await page.screenshot({ path: `${out}/${scenario.name}-${step}.png` });
	return metrics;
}
async function checkStarts(page) {
	const start = '[data-rp-empty="floor-start"]';
	await activate(page, `${start} button:last-child`); await page.locator(start).waitFor({ state: 'hidden' });
	await page.waitForFunction(() => document.activeElement === document.querySelector('.rp-plan-canvas'));
	await page.reload(); await page.locator(start).waitFor();
	await activate(page, `${start} .rp-empty-state__action`); await page.locator('.rp-task-banner').waitFor();
	await page.waitForFunction(() => document.activeElement === document.querySelector('.rp-plan-canvas'));
	await page.keyboard.press('Escape'); await page.locator(start).waitFor();
}
async function journey(page, scenario, out) {
	const theme = await page.evaluate(() => Object.fromEntries(['--interactive-accent', '--text-accent', '--background-primary', '--background-secondary'].map(key => [key, getComputedStyle(document.body).getPropertyValue(key)])));
	await checkStarts(page);
	await page.evaluate(tokens => {
		for (const [key, value] of Object.entries(tokens)) document.body.style.setProperty(key, value);
		window.dispatchEvent(new Event('rp-harness-theme'));
	}, theme);
	if (scenario.accent) assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--interactive-accent').trim()), '#7c246b');
	await activate(page, '[data-rp-empty="floor-start"] [data-rp-action="reference"]'); await page.locator(form).waitFor();
	await type(page, 'source', 'scan.png'); await activate(page, '[data-rp-action="load-reference"]');
	await page.locator('.rp-reference-preview').waitFor();
	await type(page, 'crop-x', '100'); await type(page, 'crop-width', '2700'); await type(page, 'rotation', '90');
	const prepare = await capture(page, scenario, out, 'prepare');
	await next(page); await page.locator(field('ax')).waitFor();
	await next(page); await page.locator(`${form} [role="alert"]`).waitFor();
	for (const [name, value] of Object.entries({ ax: '400', ay: '1870', bx: '1400', by: '1870', length: '1' })) await type(page, name, value);
	await page.keyboard.press('Space'); await page.keyboard.press('Backspace');
	const measurement = await capture(page, scenario, out, 'measurement');
	await next(page); await page.locator(field('opacity')).waitFor();
	await tabTo(page, field('opacity')); await page.keyboard.press('ArrowLeft');
	assert.equal(await page.locator(field('locked')).isChecked(), true);
	assert.equal(await page.locator(field('visible')).isChecked(), true);
	const review = await capture(page, scenario, out, 'review');
	await next(page); await page.locator(form).waitFor({ state: 'hidden' });
	assert.equal(await page.locator('[data-rp-empty="floor-start"]').count(), 0);
	await undoRedo(page);
	await page.screenshot({ path: `${out}/${scenario.name}-committed.png` });
	await replaceAndCancel(page);
	await commitPdf(page);
	return { prepare, measurement, review, accent: theme['--interactive-accent'].trim(), replacement: 'PNG retained after PDF replacement cancellation', reflow: 'draft and focus preserved', pdf: 'committed page 1 and reopened; Undo restored PNG', storage: 'real repositories over FakeVault' };
}
async function replaceAndCancel(page) {
	const narrow = await page.locator('[data-rp-rail="layers"]').isVisible();
	if (narrow) await activate(page, '[data-rp-rail="layers"]');
	await activate(page, '[data-rp-action="reference"]'); await page.locator(form).waitFor();
	await page.locator('.rp-reference-preview').waitFor(); assert.equal(await page.locator(field('rotation')).inputValue(), '90');
	await type(page, 'source', 'scan.pdf'); await activate(page, '[data-rp-action="load-reference"]');
	await page.locator('.rp-reference-preview').waitFor();
	await type(page, 'page', '99'); await activate(page, '[data-rp-action="load-reference"]');
	await page.locator(`${form} [role="alert"]`).waitFor();
	await type(page, 'page', '1'); await activate(page, '[data-rp-action="load-reference"]'); await page.locator('.rp-reference-preview').waitFor();
	await type(page, 'rotation', '45');
	await page.setViewportSize({ width: narrow ? 1280 : 460, height: 900 });
	assert.equal(await page.locator(field('rotation')).inputValue(), '45');
	assert.equal(await page.locator(field('rotation')).evaluate(el => el === document.activeElement), true);
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });
	await page.waitForFunction(() => document.querySelector('.renovation-plan-editor').contains(document.activeElement));
	if (await page.locator('[data-rp-rail="layers"]').isVisible()) await activate(page, '[data-rp-rail="layers"]');
	await activate(page, '[data-rp-action="reference"]'); await page.locator('.rp-reference-preview').waitFor();
	assert.equal(await page.locator(field('source')).inputValue(), 'scan.png');
	assert.equal(await page.locator(field('rotation')).inputValue(), '90');
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });

}
async function commitPdf(page) {
	if (await page.locator('[data-rp-rail="layers"]').isVisible()) await activate(page, '[data-rp-rail="layers"]');
	await activate(page, '[data-rp-action="reference"]'); await page.locator('.rp-reference-preview').waitFor();
	await type(page, 'source', 'scan.pdf'); await activate(page, '[data-rp-action="load-reference"]'); await page.locator('.rp-reference-preview').waitFor();
	await next(page);
	for (const [name, value] of Object.entries({ ax: '100', ay: '100', bx: '300', by: '100', length: '2' })) await type(page, name, value);
	await next(page); await next(page); await page.locator(form).waitFor({ state: 'hidden' });
	await activate(page, '[data-rp-action="reference"]'); await page.locator('.rp-reference-preview').waitFor();
	assert.equal(await page.locator(field('source')).inputValue(), 'scan.pdf');
	assert.equal(await page.locator(field('page')).inputValue(), '1');
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });
	await activate(page, '[data-rp-action="undo"]');
	await activate(page, '[data-rp-action="reference"]'); await page.locator('.rp-reference-preview').waitFor();
	assert.equal(await page.locator(field('source')).inputValue(), 'scan.png');
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' });
}
await runAreaBrowserMatrix('reference-plan', '&reference', journey, '[data-rp-empty="floor-start"]');
