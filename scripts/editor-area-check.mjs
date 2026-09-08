import assert from 'node:assert/strict';
import { escapeAreaTool, runAreaBrowserMatrix } from './editor-area-browser.mjs';

async function checkTaskLayout(page, scenario, out) {
	const metrics = await page.locator('.renovation-plan-editor').evaluate((root) => ({
		width: root.clientWidth, scrollWidth: root.scrollWidth,
		controls: [...root.querySelectorAll('.rp-task-banner button, .rp-task-banner label')].map((el) => {
			const rect = el.getBoundingClientRect();
			return { text: el.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
		}),
	}));
	assert.ok(metrics.scrollWidth <= metrics.width + 1, 'editor has no horizontal overflow');
	for (const rect of metrics.controls) {
		assert.ok(rect.left >= 0, 'task control starts in view');
		assert.ok(rect.right <= scenario.width + 1, 'task control fits horizontally');
		assert.ok(rect.top >= 0, 'task control starts below the top');
		assert.ok(rect.bottom < 900, 'task control fits vertically');
	}
	await page.screenshot({ path: `${out}/${scenario.name}.png` });
	return metrics;
}

// Visual fixture deliberately refuses writes; the numeric matrix uses real memory repositories.
await runAreaBrowserMatrix('area-verification', '&area', async (page, scenario, out) => {
	const finish = page.locator('.rp-task-banner__finish');
	await page.waitForFunction(() => document.querySelector('.rp-task-banner__finish')?.getAttribute('aria-disabled') === 'false');
	assert.equal(await finish.textContent().then((text) => text.trim()), scenario.name === 'german-constrained' ? 'Fläche erstellen' : 'Create area');
	const metrics = await checkTaskLayout(page, scenario, out);
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
	await escapeAreaTool(page);
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
	return { metrics };
});
