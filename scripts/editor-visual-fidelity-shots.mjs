import assert from 'node:assert/strict';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';

// Independent capture output; the existing journey scripts remain unchanged.
const phase = process.argv[2] ?? 'after';
assert.ok(['before', 'after'].includes(phase));
const out = `docs/user-experience/renovation-planner-editor-specs/implementation/evidence/editor-visual-fidelity/${phase}`;
await mkdir(out, { recursive: true });
for (const journey of ['materials-costs-evidence', 'renovation-workflow', 'reference-plan', 'editor-visual-resilience', 'editor-visual-overview', 'editor-object', 'planning-recovery', 'modal-busy-focus', 'editor-downstream']) {
	try { await cp(`harness-shots/${journey}`, `${out}/${journey}`, { recursive: true }); }
	catch (error) { if (phase === 'after' || error.code !== 'ENOENT') throw error; }
}
const server = await createServer({ configFile: 'vite.harness.config.ts', server: { host: '127.0.0.1', port: 0, open: false } });
await server.listen();
const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), headless: true });
const results = [];
const states = [
	{ name: 'M01-floor', query: '', ready: '.rp-floor-inspector' },
	{ name: 'M00-room', query: '&select=harness-kitchen', ready: '.rp-room-inspector' },
	{ name: 'M02-add', query: '&add', ready: '.rp-add-menu' },
	{ name: 'M03-room-draft', query: '&room=4200x3800', ready: '.rp-new-room' },
	{ name: 'M05-start', query: '&reference&planning', ready: '.rp-floor-start' },
	{ name: 'M11-multiple', query: '&select=harness-kitchen,harness-bath', ready: '.rp-multi-selection' },
	{ name: 'M15-stale', query: '&stale&select=harness-kitchen', ready: '[data-rp-warning="stale"]' },
];
try {
	for (const theme of ['light', 'dark']) {
		for (const state of states) {
			const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(`${server.resolvedUrls.local[0]}?view=plan-editor&bare&theme=${theme}${state.query}`);
			try { await page.locator(state.ready).waitFor(); }
			catch (error) { await page.screenshot({ path: `${out}/failed.png` }); console.log(await page.locator('body').innerText(), errors); throw error; }
			await page.evaluate(() => document.fonts.ready);
			if (state.name === 'M05-start') {
				const fits = await page.locator('.rp-floor-start').evaluate(el => {
					const card = el.getBoundingClientRect(), canvas = el.closest('.rp-plan-canvas').getBoundingClientRect();
					return card.bottom <= canvas.bottom && card.right <= canvas.right && card.left >= canvas.left;
				});
				assert.ok(fits, 'starting choices stay within the canvas');
			}
			await page.screenshot({ path: `${out}/${theme}-${state.name}.png` });
			const metrics = await page.locator('.rp-editor-shell').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight, scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
			assert.ok(metrics.scroll <= metrics.viewport, `${state.name} page overflow`);
			assert.deepEqual(errors, []);
			results.push({ state: state.name, theme, metrics, errors });
			await page.close();
		}
	}
	await writeFile(`${out}/shell-report.json`, JSON.stringify({ commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), viewport: '1440 × 1000, deviceScaleFactor 1', results }, null, 2));
} finally { await browser.close(); await server.close(); }
console.log(`Visual evidence: ${out}`);
