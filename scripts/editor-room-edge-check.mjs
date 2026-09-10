import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate } from './editor-area-browser.mjs';
import { recordRoom, recordText, recordShot } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';
const notes = page => page.evaluate(() => window.editorFidelity.savedNotes());
const lengths = async page => (await page.locator('[data-rp-room-edge] > [aria-hidden="true"], [data-rp-dimension]').allTextContents()).map(text => text.trim()).toSorted();
async function journey(page, scenario, out) {
	await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme });
	if (scenario.width === 460) await page.keyboard.press('Escape');
	const id = await page.evaluate(() => window.editorFidelity.selection().ids[0]);
	const before = await notes(page), original = await lengths(page); assert.equal(original.length, 4);
	await recordShot(page, scenario, out, 'rectangle-all-edges');
	const hover = await page.evaluate(value => window.editorFidelity.rotationHoverPoint(value), id); await page.mouse.move(hover.x, hover.y);
	await page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
	const scene = await page.evaluate(value => window.editorFidelity.rotation(value), id);
	const x = scene.handle.x - scene.pivot.x, y = scene.handle.y - scene.pivot.y, radians = 37 * Math.PI / 180;
	await page.mouse.move(scene.handle.x, scene.handle.y); await page.mouse.down();
	await page.mouse.move(scene.pivot.x + x * Math.cos(radians) - y * Math.sin(radians), scene.pivot.y + x * Math.sin(radians) + y * Math.cos(radians), { steps: 6 });
	await page.waitForFunction(() => document.querySelectorAll('[data-rp-room-edge]').length === 4);
	assert.deepEqual(await lengths(page), original); assert.deepEqual(await notes(page), before);
	await recordShot(page, scenario, out, 'rotating-all-edges');
	await page.keyboard.press('Escape'); await page.mouse.up(); assert.deepEqual(await notes(page), before);
	await activate(page, '[data-rp-action="add"]'); await activate(page, '[data-rp-entry="room"]');
	await page.locator('.rp-task-banner [data-rp-action="draw-free-room"]').waitFor();
	await recordShot(page, scenario, out, 'discover-free-form');
	await activate(page, '[data-rp-action="draw-free-room"]');
	await activate(page, '.rp-area-corners summary');
	for (const [cx, cy] of [['1', '1'], ['4', '1'], ['4', '2'], ['2', '2'], ['2', '4'], ['1', '4']]) {
		await recordText(page, '.rp-area-corners', 'x', cx); await recordText(page, '.rp-area-corners', 'y', cy);
		await activate(page, '[data-rp-corner="apply"]');
	}
	await page.locator('[data-rp-room-edge="4"]').waitFor();
	assert.equal(await page.locator('[data-rp-room-edge]').count(), 5); assert.deepEqual(await notes(page), before);
	await recordShot(page, scenario, out, 'free-form-draft-edges');
	await activate(page, '.rp-task-banner__finish'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	await page.waitForFunction(() => document.querySelectorAll('[data-rp-room-edge]').length === 6);
	await recordShot(page, scenario, out, 'concave-room-all-edges');
	const a11y = await editorAccessibility(page, scenario, out, 'concave-room-all-edges');
	return { accessibility: [a11y], measuredRectangleEdges: 4, rotatingLengthsUnchanged: true, rotationEscapeNoWrite: true, freeFormBannerRoute: true, concaveEdges: 6, storage: 'Production commands over FakeVault; no native-host claim' };
}
await runAreaBrowserMatrix('editor-room-edges', '&reference&planning&fidelity', journey, '[data-rp-empty="floor-start"]');
