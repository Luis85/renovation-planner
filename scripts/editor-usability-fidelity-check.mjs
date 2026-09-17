import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { closeInspectorDrawer, settled, tabTo, taskbarMetrics, usabilityHarness } from './editor-area-browser.mjs';

// Bounded visual evidence over the same production/FakeVault harness as harness-shot.
// Screenshots require separate human/agent inspection; passing geometry checks is not visual acceptance.
const phase = process.argv[2] ?? 'after';
assert.ok(['round1', 'after'].includes(phase));
const out = `docs/user-experience/editor-usability-increment/astra-ui-fidelity/${phase}`;
const { server, browser, base } = await usabilityHarness(out);
const records = [], errors = [], findings = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(120_000);
page.setDefaultNavigationTimeout(120_000);
page.on('pageerror', error => errors.push(error.message));
const route = theme => `${base}?view=plan-editor&bare&reference&planning&fidelity&theme=${theme}`;
async function shot(name) {
	if (process.argv.includes('--continue') && existsSync(`${out}/${name}.png`)) return;
	await settled(page);
	await page.screenshot({ path: `${out}/${name}.png` });
	records.push({ image: `${name}.png`, url: page.url(), viewport: page.viewportSize() });
}
async function panel() {
	const rail = page.locator('[data-rp-rail="details"]');
	if (await rail.isVisible() && await rail.getAttribute('aria-expanded') !== 'true') await rail.click();
}
async function draft(theme = 'light', german = false) {
	await page.goto(`${route(theme)}&room=4000x3000${german ? '&lang=de' : ''}`);
	await page.locator('.rp-task-banner__finish[aria-disabled="false"]').waitFor();
	await panel();
	await page.locator('.rp-new-room__name').fill(german ? 'Küche' : 'Kitchen');
}
async function create() {
	await page.locator('.rp-new-room__create').click();
	await page.locator('.rp-room-inspector').waitFor();
}
async function mode(value) {
	await page.locator(`[data-rp-perspective="${value}"]`).click();
	await settled(page);
}
async function taskbarBounds(width) {
	await page.setViewportSize({ width, height: 800 });
	await settled(page);
	await closeInspectorDrawer(page);
	await settled(page);
	// By ACCESSIBLE NAME here; the combined script asserts on the words a user reads instead. That
	// argument is the whole of what used to make two copies of this block.
	const measurement = await taskbarMetrics(page, 'aria-label');
	for (const { label, rect, unobscured } of measurement.buttons) {
		if (rect.left < measurement.canvas.left || rect.right > measurement.canvas.right) findings.push(`${width}: ${label} outside canvas`);
		if (rect.width < 44 || rect.height < 44) findings.push(`${width}: ${label} target below 44 × 44`);
		if (!unobscured) findings.push(`${width}: ${label} obscured`);
	}
	const modes = await page.locator('[data-rp-perspective]').evaluateAll(buttons => buttons.map(button => ({ label: button.textContent, right: button.getBoundingClientRect().right })));
	for (const button of modes) if (button.right > width) findings.push(`${width}: mode ${button.label} exceeds viewport`);
	records.push({ width, taskbar: measurement });
}
async function contrast(selector) {
	const result = await page.locator(selector).evaluate(el => {
		const style = getComputedStyle(el), canvas = document.createElement('canvas'), context = canvas.getContext('2d');
		canvas.width = canvas.height = 1;
		const luminance = color => {
			context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
			const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
				const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			});
			return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
		};
		const a = luminance(style.color), b = luminance(style.backgroundColor);
		return { color: style.color, background: style.backgroundColor, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
	});
	if (result.ratio < 4.5) findings.push(`${selector}: text contrast ${result.ratio}`);
	records.push({ selector, theme: await page.locator('body').getAttribute('class'), contrast: result });
}
try {
	await page.goto(route('light')); await page.locator('.rp-floor-start').waitFor(); await shot('01-plan-start');
	await mode('renovate'); await shot('09-renovate-default');
	await draft(); await shot('02-room-draft'); await create();
	await tabTo(page, '[data-rp-action="resize-room"]');
	assert.equal(await page.locator('[data-rp-action="resize-room"]').evaluate(el => el.matches(':focus-visible')), true);
	await shot('03-plan-selection'); await contrast('[data-rp-action="resize-room"]');
	const selected = await page.evaluate(() => window.editorFidelity.selection());
	const original = await page.evaluate(id => ({ notes: window.editorFidelity.savedNotes(), camera: window.editorFidelity.captions(id).camera }), selected.ids[0]);
	await mode('renovate'); await shot('04-renovate-selection');
	assert.deepEqual(await page.evaluate(() => window.editorFidelity.selection()), selected);
	assert.deepEqual(await page.evaluate(id => ({ notes: window.editorFidelity.savedNotes(), camera: window.editorFidelity.captions(id).camera }), selected.ids[0]), original);
	await contrast('.rp-renovation-overview-actions .mod-cta');
	await page.locator('[data-rp-mode="work"]').click(); await shot('05-renovate-work');
	await page.setViewportSize({ width: 460, height: 800 }); await panel(); await shot('06-narrow-work');
	await closeInspectorDrawer(page);
	for (const width of [1280, 1024, 900, 899, 640, 460, 400]) await taskbarBounds(width);
	await page.setViewportSize({ width: 460, height: 800 }); await shot('07-narrow-canvas');
	await draft('dark', true); await shot('08-de-dark-draft');
	await page.locator('.rp-new-room input[name="width"]').fill('0'); await page.locator('.rp-new-room input[name="depth"]').click();
	await page.locator('.rp-new-room [aria-invalid="true"]').waitFor(); await shot('10-de-invalid-draft');
	assert.equal(await page.locator('.rp-new-room__create').getAttribute('aria-disabled'), 'true');
	await page.locator('.rp-new-room input[name="width"]').fill('4'); await page.locator('.rp-new-room input[name="depth"]').click();
	await create(); await closeInspectorDrawer(page); await mode('renovate'); await taskbarBounds(460); await shot('11-de-renovate-canvas');
	await page.setViewportSize({ width: 1280, height: 800 });
	await draft('dark'); await create(); await shot('12-dark-plan'); await contrast('[data-rp-action="resize-room"]');
	await mode('renovate'); await shot('13-dark-renovate'); await contrast('.rp-renovation-overview-actions .mod-cta');
	await draft(); await create();
	await page.addStyleTag({ content: 'body { --interactive-accent: #7c246b; --text-accent: #7c246b; --background-primary: #fff8ed; --background-secondary: #efe3d3; }' });
	await page.evaluate(() => window.dispatchEvent(new Event('rp-harness-theme')));
	await shot('14-custom-plan'); await contrast('[data-rp-action="resize-room"]');
	await mode('renovate'); await shot('15-custom-renovate'); await contrast('.rp-renovation-overview-actions .mod-cta');
	assert.deepEqual(errors, []);
	await writeFile(`${out}/report.json`, JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), capturedAt: new Date().toISOString(), errors, findings, records }, null, 2));
	assert.deepEqual(findings, []);
} finally { await browser.close(); await server?.close(); }
console.log(`Evidence and checks saved to ${out}`);
