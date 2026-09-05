import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';

export async function escapeAreaTool(page) {
	await page.keyboard.press('Escape');
	await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	assert.equal(await page.locator('.rp-plan-canvas').evaluate((el) => el === document.activeElement), true);
}

/** Both Area journeys use the same browser, theme, viewport and error checks. */
export async function runAreaBrowserMatrix(directory, query, journey) {
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
			const errors = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.goto(`${server.resolvedUrls.local[0]}?view=plan-editor${query}${scenario.query}`);
			await page.locator('.rp-task-banner').waitFor();
			if (scenario.accent) {
				await page.addStyleTag({ content: 'body { --interactive-accent: #7c246b; --text-accent: #7c246b; --background-primary: #fff8ed; --background-secondary: #efe3d3; }' });
				await page.evaluate(() => window.dispatchEvent(new Event('rp-harness-theme')));
			}
			const evidence = await journey(page, scenario, out);
			assert.deepEqual(errors, []);
			results.push({ scenario: scenario.name, browser: browser.version(), ...evidence, keyboard: 'passed', pageErrors: errors });
			await page.close();
		}
		await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
		console.log(`Area browser checks passed (${results.length} scenarios). Artifacts: ${out}`);
	} finally {
		await browser?.close();
		await server.close();
	}
}
