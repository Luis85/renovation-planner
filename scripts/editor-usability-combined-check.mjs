import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { resolveChromiumExecutable } from './chromium.mjs';
import { tabTo } from './editor-area-browser.mjs';

const out = 'docs/user-experience/editor-usability-increment/astra-ui-fidelity/combined';
const base = process.env.RP_HARNESS_URL ?? 'http://127.0.0.1:5181/';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), headless: true });
const results = [], errors = [];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function stable(page) {
	await page.evaluate(() => document.fonts.ready);
	await page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => { requestAnimationFrame(resolve); }); }));
}
async function closePanel(page) {
	const close = page.locator('.rp-inspector-drawer__close');
	if (await close.isVisible()) { await close.click(); await close.waitFor({ state: 'hidden' }); }
}
function snapshot(page) {
	return page.evaluate(() => {
		const selection = window.editorFidelity.selection();
		return { selection, notes: window.editorFidelity.savedNotes(), camera: window.editorFidelity.captions(selection.ids[0]).camera };
	});
}
async function measure(page, name) {
	await stable(page);
	const metrics = await page.locator('.rp-direct-actions').evaluate(popover => {
		const canvas = popover.closest('.rp-plan-canvas').getBoundingClientRect();
		const taskbar = document.querySelector('.rp-primary-actions').getBoundingClientRect();
		const box = popover.getBoundingClientRect(), button = popover.querySelector('[data-rp-canvas-detail]'), rect = button.getBoundingClientRect();
		const expanded = popover.querySelector('.rp-direct-actions__details');
		return { popover: box.toJSON(), taskbar: taskbar.toJSON(), canvas: canvas.toJSON(), gap: taskbar.top - box.bottom,
			expanded: expanded?.getBoundingClientRect().toJSON() ?? null,
			focused: button === document.activeElement, focusVisible: button.matches(':focus-visible'),
			unobscured: button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
	});
	assert.ok(metrics.gap >= 15, `${name}: popover has the intended 16px taskbar gap (1px rounding tolerance)`);
	assert.ok(metrics.popover.top >= metrics.canvas.top && metrics.popover.right <= metrics.canvas.right, `${name}: popover remains within canvas`);
	assert.equal(metrics.unobscured, true, `${name}: opener is unobscured`);
	assert.equal(metrics.focused, true, `${name}: opener retains keyboard focus`);
	assert.equal(metrics.focusVisible, true, `${name}: keyboard ring is painted`);
	if (metrics.expanded) assert.ok(metrics.expanded.top >= metrics.canvas.top && metrics.expanded.bottom <= metrics.taskbar.top, `${name}: expanded menu also fits`);
	await page.screenshot({ path: `${out}/${name}.png` });
	return metrics;
}
try {
	for (const language of ['en', 'de']) {
		const page = await browser.newPage({ viewport: { width: language === 'en' ? 1280 : 460, height: 800 } });
		page.setDefaultTimeout(120_000); page.setDefaultNavigationTimeout(120_000);
		page.on('pageerror', error => errors.push(error.message));
		await page.goto(`${base}?view=plan-editor&bare&reference&planning&fidelity&room=4000x3000&lang=${language}&theme=${language === 'en' ? 'light' : 'dark'}`);
		await page.locator('.rp-task-banner__finish[aria-disabled="false"]').waitFor();
		const details = page.locator('[data-rp-rail="details"]');
		if (await details.isVisible()) await details.click();
		await page.locator('.rp-new-room__name').fill(language === 'en' ? 'Kitchen' : 'Küche');
		await page.locator('.rp-new-room__create').click(); await page.locator('.rp-room-inspector').waitFor();
		await closePanel(page); await page.locator('[data-rp-perspective="renovate"]').click();
		await page.setViewportSize({ width: 460, height: 800 }); await stable(page); await closePanel(page);
		await page.locator('[data-rp-canvas-detail]').waitFor();
		const before = await snapshot(page);
		await tabTo(page, '[data-rp-canvas-detail]');
		const collapsed = await measure(page, `${language}-collapsed`);
		await page.keyboard.press('Enter'); await page.locator('.rp-direct-actions__details').waitFor();
		const expanded = await measure(page, `${language}-expanded`);
		await page.keyboard.press('Escape'); await page.locator('.rp-direct-actions__details').waitFor({ state: 'hidden' });
		assert.equal(await page.locator('[data-rp-canvas-detail]').evaluate(el => el === document.activeElement), true);
		assert.deepEqual(await snapshot(page), before, `${language}: focus/expand/Escape never write or change camera/selection`);
		results.push({ language, viewport: page.viewportSize(), collapsed, expanded, preservedStateHash: hash(before), noWriteCameraOrSelectionChange: true, escapeRestoresOpener: true });
		await page.close();
	}
	assert.deepEqual(errors, []);
	await writeFile(`${out}/report.json`, JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), capturedAt: new Date().toISOString(), errors, results }, null, 2));
} finally { await browser.close(); }
console.log('Combined EN/DE popover clearance, keyboard focus and no-write checks passed.');
