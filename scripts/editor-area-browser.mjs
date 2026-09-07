import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';
import { makeCaptureManifest, recordScreenshots } from './editor-capture-files.mjs';

/** Real keyboard navigation; no locator focus/fill shortcuts. */
export async function tabTo(page, selector) {
	for (let count = 0; count < 150; count++) {
		if (await page.locator(selector).evaluateAll(els => els.includes(document.activeElement))) return;
		await page.keyboard.press('Tab');
	}
	throw new Error(`Tab did not reach ${selector}`);
}
export async function activate(page, selector) {
	if (['[data-rp-action="rename-room"]', '[data-rp-action="edit-outline"]'].includes(selector)
		&& await page.locator('.rp-room-more-actions:not([open]) > summary').isVisible()) {
		await tabTo(page, '.rp-room-more-actions > summary');
		await page.keyboard.press('Enter');
	}
	if (selector.startsWith('[data-rp-mode=') && !await page.locator(selector).isVisible()) {
		await tabTo(page, '[data-rp-room-navigation]');
		await page.keyboard.press('Enter');
	}
	await tabTo(page, selector);
	await page.keyboard.press('Enter');
}
export async function selectRoomForEditing(page) {
	const narrow = await page.locator('[data-rp-rail="layers"]').isVisible();
	if (narrow) await activate(page, '[data-rp-rail="layers"]');
	await activate(page, '.rp-room-list__row[data-rp-id="harness-kitchen"]');
	if (narrow) { await page.keyboard.press('Escape'); await activate(page, '[data-rp-rail="details"]'); }
	return narrow;
}
export async function assertDialogFocusWrap(page, firstField) {
	await page.keyboard.press('Tab');
	assert.equal(await page.locator('.rp-dialog [data-rp-action="cancel"]').evaluate(el => el === document.activeElement), true, 'Apply then Cancel');
	await page.keyboard.press('Tab');
	assert.equal(await page.locator(firstField).evaluate(el => el === document.activeElement), true, 'dialog focus trap');
}
export async function checkDialogLayout(page, scenario, out, controls) {
	const metrics = await page.locator('.rp-dialog').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
	assert.ok(metrics.scroll <= metrics.width + 1, 'dialog has no horizontal overflow');
	for (const selector of controls) {
		const box = await page.locator(selector).boundingBox();
		assert.ok(box, `${selector} is visible`);
		assert.ok(box.x >= 0); assert.ok(box.x + box.width <= scenario.width + 1);
		assert.ok(box.y >= 0); assert.ok(box.y + box.height <= 900);
	}
	await page.screenshot({ path: `${out}/${scenario.name}.png` });
	return metrics;
}
export async function enterPair(page, firstSelector, secondSelector, first, second) {
	await tabTo(page, firstSelector);
	await page.keyboard.press('Control+A'); await page.keyboard.type(first);
	await page.keyboard.press('Tab');
	assert.equal(await page.locator(secondSelector).evaluate(el => el === document.activeElement), true, `Tab reaches ${secondSelector}`);
	await page.keyboard.press('Control+A'); await page.keyboard.type(second);
}
export async function undoRedo(page) {
	await activate(page, '[data-rp-action="undo"]');
	await page.waitForFunction(() => !document.querySelector('[data-rp-action="redo"]').disabled);
	await activate(page, '[data-rp-action="redo"]');
	await page.waitForFunction(() => document.querySelector('[data-rp-action="redo"]').disabled);
}

export async function escapeAreaTool(page) {
	await page.keyboard.press('Escape');
	await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	assert.equal(await page.locator('.rp-plan-canvas').evaluate((el) => el === document.activeElement), true);
}

/** The editor journeys share browser, theme, viewport and error checks. */
export async function runAreaBrowserMatrix(directory, query, journey, ready = '.rp-task-banner') {
	const started = Date.now(), images = new Set();
	const out = `harness-shots/${directory}`;
	await mkdir(out, { recursive: true });
	const server = await createServer({ configFile: 'vite.harness.config.ts', server: { host: '127.0.0.1', port: 0 } });
	await server.listen();
	let browser;
	const results = [];
	try {
		browser = await chromium.launch({ executablePath: await resolveChromiumExecutable(), headless: true });
		for (const scenario of [
			{ name: 'light', query: '&theme=light', width: 1440 },
			{ name: 'dark', query: '', width: 1440 },
			{ name: 'custom-accent', query: '&theme=light', width: 1000, accent: true },
			{ name: 'german-constrained', query: '&lang=de', width: 460 },
		]) {
			const page = await browser.newPage({ viewport: { width: scenario.width, height: 900 } });
			recordScreenshots(page, out, images);
			const errors = [];
			page.on('pageerror', (error) => errors.push(error.message));
			let evidence;
			try {
			await page.goto(`${server.resolvedUrls.local[0]}?view=plan-editor&bare${query}${scenario.query}`);
			await page.locator(ready).waitFor();
			if (scenario.accent) {
				await page.addStyleTag({ content: 'body { --interactive-accent: #7c246b; --text-accent: #7c246b; --background-primary: #fff8ed; --background-secondary: #efe3d3; }' });
				await page.evaluate(() => window.dispatchEvent(new Event('rp-harness-theme')));
			}
			evidence = await journey(page, scenario, out);
			assert.deepEqual(errors, []);
			}
			catch (cause) {
				await page.screenshot({ path: `${out}/${scenario.name}-failed.png` });
				await writeFile(`${out}/${scenario.name}-failed.txt`, await page.locator('body').innerText());
				await writeFile(`${out}/${scenario.name}-failed-errors.json`, JSON.stringify(errors, null, 2));
				await writeFile(`${out}/${scenario.name}-failed-focus.json`, JSON.stringify(await page.evaluate(() => ({
					activeElement: document.activeElement?.outerHTML,
					viewport: { width: innerWidth, height: innerHeight },
					referenceTargets: [...document.querySelectorAll('[data-rp-action="reference"], [data-rp-rail]')].map(element => ({
						html: element.outerHTML, visible: element.checkVisibility(),
					})),
				})), null, 2));
				throw cause;
			}
			results.push({ scenario: scenario.name, browser: browser.version(), ...evidence, keyboard: 'passed', pageErrors: errors });
			await page.close();
		}
		await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
		await writeFile(`${out}/capture-files.json`, JSON.stringify(await makeCaptureManifest(out, started, images), null, 2));
		console.log(`Editor browser checks passed (${results.length} scenarios). Artifacts: ${out}`);
	} finally {
		await browser?.close();
		await server.close();
	}
}
