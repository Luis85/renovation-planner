import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { closeInspectorDrawer, settled, tabTo, taskbarMetrics, usabilityHarness } from './editor-area-browser.mjs';

// Confirmation of the user's removal of selected-item Add detail. The Details rail owns navigation.
const out = 'docs/user-experience/editor-usability-increment/astra-main-refresh/selection-details';
const { server, browser, base } = await usabilityHarness(out);
const results = [], errors = [];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function snapshot(page) {
	return page.evaluate(() => {
		const selection = window.editorFidelity.selection();
		return { selection, notes: window.editorFidelity.savedNotes(), camera: window.editorFidelity.captions(selection.ids[0]).camera };
	});
}
async function measure(page, name) {
	await settled(page);
	assert.equal(await page.locator('[data-rp-canvas-detail], [data-rp-canvas-detail-mode], .rp-direct-actions').count(), 0, 'selected-item Add detail is removed');
	// This script names a button by the words a user reads; the fidelity script names it by its
	// accessible name. That argument is the whole of what used to make two copies of this block.
	const metrics = await taskbarMetrics(page, 'text');
	for (const button of metrics.buttons) {
		assert.ok(button.rect.left >= metrics.canvas.left && button.rect.right <= metrics.canvas.right);
		assert.ok(button.rect.width >= 44 && button.rect.height >= 44);
		assert.equal(button.unobscured, true, `${name}: ${button.label} is unobscured`);
	}
	await page.screenshot({ path: `${out}/${name}.png` });
	return metrics;
}
try {
	for (const language of ['en', 'de']) {
		const page = await browser.newPage({ viewport: { width: language === 'en' ? 1280 : 460, height: 800 } });
		page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(120_000);
		page.on('pageerror', error => errors.push(error.message));
		await page.goto(`${base}?view=plan-editor&bare&reference&planning&fidelity&room=4000x3000&lang=${language}&theme=${language === 'en' ? 'light' : 'dark'}`);
		await page.locator('.rp-task-banner__finish[aria-disabled="false"]').waitFor();
		const details = page.locator('[data-rp-rail="details"]');
		if (await details.isVisible()) await details.click();
		await page.locator('.rp-new-room__name').fill(language === 'en' ? 'Kitchen' : 'Küche');
		await page.locator('.rp-new-room__create').click(); await page.locator('.rp-room-inspector').waitFor();
		await closeInspectorDrawer(page);
		const before = await snapshot(page), plan = await measure(page, `${language}-plan-selection`);
		await page.setViewportSize({ width: 460, height: 800 }); await settled(page); await closeInspectorDrawer(page); await settled(page);
		const narrow = await measure(page, `${language}-narrow-plan`);
		await page.locator('[data-rp-perspective="renovate"]').click();
		await page.locator('[data-rp-perspective="renovate"][aria-checked="true"]').waitFor();
		const renovate = await measure(page, `${language}-narrow-renovate`);
		await tabTo(page, '[data-rp-rail="details"]'); await page.keyboard.press('Enter');
		await page.locator('.rp-inspector-drawer').waitFor(); await settled(page);
		assert.equal(await page.locator('.rp-inspector-drawer').evaluate(el => el.contains(document.activeElement)), true, 'Details takes keyboard focus');
		await page.screenshot({ path: `${out}/${language}-details-focused.png` });
		await tabTo(page, '[data-rp-mode="existing"]'); await page.keyboard.press('Enter');
		await tabTo(page, '[data-rp-action="new-record"]'); await page.keyboard.press('Enter');
		await page.locator('[data-rp-form="renovation"]').waitFor(); await page.keyboard.press('Escape');
		await page.locator('[data-rp-form="renovation"]').waitFor({ state: 'hidden' });
		assert.deepEqual(await snapshot(page), before, 'Details navigation and canceled creation preserve camera, selection and notes');
		results.push({ language, plan, narrow, renovate, keyboardDetailsAndCreation: true, preservedStateHash: hash(before) });
		await page.close();
	}
	assert.deepEqual(errors, []);
	await writeFile(`${out}/report.json`, JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), capturedAt: new Date().toISOString(), errors, results }, null, 2));
} finally { await browser.close(); await server?.close(); }
console.log('EN/DE selection, responsive taskbar and keyboard Details checks passed.');
