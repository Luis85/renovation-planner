import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';

// Real browser keyboard/layout checks of the visual fixture. Persistence is verified by
// areaCreation.e2e.test.ts; this fixture deliberately refuses writes, like the Room fixture.
const out = 'harness-shots/area-verification';
await mkdir(out, { recursive: true });
const server = await createServer({ configFile: 'vite.harness.config.ts', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
const results = [];
try {
	browser = await chromium.launch({ executablePath: await resolveChromiumExecutable(), headless: true });
	const url = server.resolvedUrls.local[0];
	for (const scenario of [
		{ name: 'light', query: '&theme=light', width: 1440 },
		{ name: 'dark', query: '', width: 1440 },
		{ name: 'custom-accent', query: '&theme=light', width: 1000, accent: true },
		{ name: 'german-constrained', query: '&lang=de', width: 460 },
	]) {
		const page = await browser.newPage({ viewport: { width: scenario.width, height: 900 } });
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto(`${url}?view=plan-editor&area${scenario.query}`);
		const finish = page.locator('.rp-task-banner__finish');
		await page.waitForFunction(() => document.querySelector('.rp-task-banner__finish')?.getAttribute('aria-disabled') === 'false');
		if (scenario.accent) {
			await page.addStyleTag({ content: 'body { --interactive-accent: #7c246b; --text-accent: #7c246b; --background-primary: #fff8ed; --background-secondary: #efe3d3; }' });
			await page.evaluate(() => window.dispatchEvent(new Event('rp-harness-theme')));
		}
		assert.equal(await finish.textContent().then((text) => text.trim()), scenario.name === 'german-constrained' ? 'Fläche erstellen' : 'Create area');
		const metrics = await page.locator('.renovation-plan-editor').evaluate((root) => ({
			width: root.clientWidth, scrollWidth: root.scrollWidth,
			controls: [...root.querySelectorAll('.rp-task-banner button, .rp-task-banner label')].map((el) => {
				const rect = el.getBoundingClientRect();
				return { text: el.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
			}),
		}));
		assert.ok(metrics.scrollWidth <= metrics.width + 1, 'editor has no horizontal overflow');
		for (const rect of metrics.controls) {
			assert.ok(rect.left >= 0 && rect.right <= scenario.width + 1 && rect.top >= 0 && rect.bottom < 900, 'task control stays visible');
		}
		await page.screenshot({ path: `${out}/${scenario.name}.png` });
		if (scenario.width === 460) {
			const details = page.locator('[data-rp-rail="details"]');
			await details.focus();
			await page.keyboard.press('Enter');
			await page.locator('.rp-inspector-drawer').waitFor();
			await page.keyboard.press('Escape');
			await page.locator('.rp-inspector-drawer').waitFor({ state: 'hidden' });
			assert.equal(await finish.getAttribute('aria-disabled'), 'false', 'drawer Escape preserves Area draft');
			assert.equal(await details.evaluate((el) => el === document.activeElement), true);
		}
		const repeat = page.locator('.rp-task-banner__repeat input');
		await repeat.focus();
		await page.keyboard.press('Space');
		assert.equal(await repeat.isChecked(), true);
		await page.keyboard.press('Enter'); // checkbox Enter must not finish the Area
		assert.equal(await finish.getAttribute('aria-disabled'), 'false');
		await page.keyboard.press('Escape'); // nearest draft
		assert.equal(await finish.getAttribute('aria-disabled'), 'true');
		await page.keyboard.press('Escape'); // empty tool, focus restored to canvas
		await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
		assert.equal(await page.locator('.rp-plan-canvas').evaluate((el) => el === document.activeElement), true);
		// Re-enter via real menu search and keyboard, then leave via Cancel.
		await page.locator('[data-rp-action="add"]').focus();
		await page.keyboard.press('Enter');
		await page.locator('.rp-add-menu__search').fill(scenario.name === 'german-constrained' ? 'Terrasse' : 'garden');
		await page.locator('[data-rp-entry="area"]').focus();
		await page.keyboard.press('Enter');
		await repeat.waitFor();
		assert.equal(await repeat.isChecked(), false);
		assert.equal(await page.locator('.rp-plan-canvas').evaluate((el) => el === document.activeElement), true);
		await page.locator('.rp-task-banner__cancel').focus();
		await page.keyboard.press('Enter');
		await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
		assert.deepEqual(errors, []);
		results.push({ scenario: scenario.name, browser: browser.version(), metrics, keyboard: 'passed', pageErrors: errors });
		await page.close();
	}
	await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
	console.log(`Area browser checks passed (${results.length} scenarios). Artifacts: ${out}`);
} finally {
	await browser?.close();
	await server.close();
}
