import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { resolveChromiumExecutable } from './chromium.mjs';

// Real Vue view with the named browser fixture; writes deliberately refuse in this harness.
const output = 'docs/user-experience/asset-library-delivery/captures';
mkdirSync(output, { recursive: true });
const server = await createServer({ configFile: 'vite.harness.config.ts', server: { port: 5197, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), headless: true });
const records = [];
const faults = [];
const page = await browser.newPage();
page.on('pageerror', (error) => faults.push(error.message));
await page.addInitScript(() => {
	document.addEventListener('DOMContentLoaded', () => {
		const style = document.createElement('style'); style.textContent = '.rp-harness-scheme { display: none !important; }'; document.head.append(style);
	});
});
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
async function open(width = 1440, height = 900, extra = '', language = 'en') {
	await page.setViewportSize({ width, height });
	await page.goto(`http://localhost:5197/?view=asset-library&asset=base-cabinet-600&lang=${language}&chromeless${extra}`);
	await page.locator('.rp-al-definition, .rp-empty-state').first().waitFor();
}
async function capture(name, state, extra = {}) {
	await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
	const metrics = await page.locator('.renovation-asset-library').evaluate((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
	records.push({ name, state, baselineCommit: commit, fixture: 'tests/harness/assetLibrary.ts', viewport: page.viewportSize(), metrics: { ...metrics, ...extra } });
}
async function measure() {
	return await page.evaluate(() => {
		// `.rp-al-row__number`, the DIGITS, and never `.rp-al-row__amount`, the cell around them.
		// That cell is a fixed `11ch` GRID TRACK, so its right edge is the same in every row by
		// construction and a spread taken from it reads 0 whatever the text does — measured on
		// PR #98 by reverting to the one-span layout and watching this number stay 0 through a
		// defect the picture plainly showed. An instrument that cannot go red is not evidence.
		//
		// Collapsed shelf categories keep their rows in the DOM (`display: none`), so an
		// unfiltered query mixes real amounts with (0,0,0,0) rects from hidden ones — filtered
		// to rows a reader can actually see (Task A6 review, browser-only finding).
		const edges = [...document.querySelectorAll('.rp-al-row__number')]
			.map((el) => el.getBoundingClientRect())
			.filter((rect) => rect.width > 0)
			.map((rect) => rect.right);
		const spread = edges.length ? Math.max(...edges) - Math.min(...edges) : null;
		const used = [...document.querySelectorAll('.rp-al-used__row')].map((el) => el.getBoundingClientRect().height);
		return { amountRightEdgeSpread: spread, usedInRowHeights: used };
	});
}
try {
	await open();
	await page.locator('.rp-al-search__input').fill('oak');
	await page.locator('.rp-al-search__clear').waitFor();
	await capture('AL02-clear-search', 'Clear control on a non-empty search field');
	await open(); await capture('AL06-usage', 'Usage above the definition, including project-specific price sources');
	await page.locator('.rp-al-shape-preview').scrollIntoViewIfNeeded(); await capture('AL07-shape', 'Actual footprint and derived dimensions');
	await page.locator('[data-field="supplier"]').fill('Northern timber supplier');
	await capture('AL04-draft', 'Unsaved definition draft');
	await page.locator('.rp-al-create').click(); await page.getByRole('dialog').waitFor();
	await capture('AL05-protection', 'Discard and continue / Keep editing');
	await page.keyboard.press('Escape');
	await page.locator('.rp-al-definition button[type="submit"]').click();
	await page.locator('.rp-al-definition [role="alert"]').waitFor();
	await capture('AL09-write-refusal', 'Composed settings refusal retains input');
	await open(); await page.locator('.rp-al-create').click(); await page.getByRole('dialog').waitFor();
	await capture('AL03-create', 'Deliberate price required; no automatic zero');
	await open(); await page.locator('.rp-al-action--delete').click(); await page.getByRole('dialog').waitFor();
	await capture('AL11-delete', 'Existing reference resolution, before any mutation');
	await page.goto('http://localhost:5197/?view=asset-library&assets=0&lang=en&chromeless');
	await page.locator('.rp-al-create').waitFor(); await page.getByText('No assets yet', { exact: true }).waitFor();
	await capture('AL08-empty', 'Empty fixture, not a failed read');
	for (const width of [1440, 720, 560, 460]) {
		await open(width, 650); await capture(`AL10-${width}-dark`, 'Selected asset, limited height', await measure());
	}
	// German at a width that DRAWS the shelf, which the 460 shot below cannot: that leaf hides
	// the shelves entirely, so until PR #98 no capture had measured a locale that writes the
	// currency AFTER the amount — the one arrangement where right-alignment does not align the
	// decimals on its own. This is the instrument for `.rp-al-row__currency`'s fixed-width box.
	await open(1440, 900, '&theme=light', 'de');
	await capture('AL10-1440-light-de', 'German: currency after the amount, mixed currencies', await measure());
	await open(460, 650, '&theme=light', 'de'); await capture('AL10-460-light-de', 'German in a narrow light leaf');
	await page.locator('.rp-al-inspector__back').click(); await capture('AL10-460-return', 'Return path preserves selection');
	await open(1440, 900, '&theme=light'); await capture('AL10-1440-light', 'English light theme');
	await page.addStyleTag({ content: 'body { --background-primary: #f1eee7; --background-secondary: #e7e1d4; --text-normal: #263a35; --text-muted: #53665f; --interactive-accent: #276e5e; }' });
	await capture('AL10-custom-palette', 'Custom CSS-variable palette; not an installed third-party theme');
} finally {
	writeFileSync(`${output}/manifest.json`, JSON.stringify({ commit, dirtyWorktree: true, browser: browser.version(), records, faults }, null, 2));
	await browser.close(); await server.close();
}
if (faults.length) throw new Error(faults.join('\n'));
console.log(`Captured ${records.length} Asset Library states in ${output}`);
