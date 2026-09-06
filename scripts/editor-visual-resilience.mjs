import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';
import { panel } from './editor-structure-check.mjs';

async function journey(page, scenario, out) {
	if (!await page.locator('[data-rp-action="rename-room"]').isVisible()) await panel(page, 'details');
	await activate(page, '[data-rp-action="rename-room"]');
	const name = 'Kitchen and dining room — garden extension with utility storage';
	const input = '[data-rp-form="room-name"] input[name="name"]';
	await tabTo(page, input); await page.keyboard.press('Control+A'); await page.keyboard.type(name);
	await page.setViewportSize({ width: 720, height: 450 });
	assert.equal(await page.locator(input).inputValue(), name);
	assert.equal(await page.locator(input).evaluate(el => el === document.activeElement), true);
	await page.screenshot({ path: `${out}/${scenario.name}-reflow-draft.png` });
	await activate(page, '[data-rp-form="room-name"] button[type="submit"]');
	await page.locator('[data-rp-form="room-name"]').waitFor({ state: 'hidden' });
	if (!await page.locator('.rp-room-inspector').isVisible()) await panel(page, 'details');
	assert.ok((await page.locator('.rp-room-inspector').innerText()).includes(name));
	await page.screenshot({ path: `${out}/${scenario.name}-reflow-saved.png` });
	await page.setViewportSize({ width: scenario.width, height: 900 });
	if (scenario.width !== 460) await page.locator('.rp-editor-body > .rp-editor-inspector').waitFor();
	await page.screenshot({ path: `${out}/${scenario.name}-long-name.png` });
	const metrics = await page.locator('.rp-editor-inspector').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth }));
	assert.ok(metrics.scrollWidth <= metrics.width + 1, 'long title remains within the inspector');
	assert.ok(metrics.documentWidth <= metrics.viewport, 'no page horizontal overflow');
	return { metrics, name, reflow: '720 × 450 CSS viewport represents the layout space of a 1440 × 900 leaf at 200%; actual browser zoom is not simulated', storage: 'production rename command over ephemeral repositories', focus: 'same native input retains draft and focus through reflow; submission persists title' };
}
await runAreaBrowserMatrix('editor-visual-resilience', '&rename=room&select=harness-kitchen', journey, '.rp-plan-canvas');
