import { chooseAddEntry } from './editor-add-browser.mjs';
import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate } from './editor-area-browser.mjs';
import { recordRoom, recordText, recordShot } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';
const notes = page => page.evaluate(() => window.editorFidelity.savedNotes());
const frame = page => page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => { requestAnimationFrame(resolve); }); }));
const lengths = page => page.locator('[data-rp-room-edge] > [aria-hidden="true"]').allTextContents();
async function closeDetails(page, scenario) { if (scenario.width === 460) await page.keyboard.press('Escape'); }
async function openCurves(page) {
	await activate(page, '[data-rp-action="edit-curves"]');
	await page.waitForFunction(() => document.querySelector('[data-rp-form="edit-curves"] input[name="depth"]')?.readOnly === false);
}
async function curvedWall(page, scenario, out) {
	await activate(page, '[data-rp-action="add"]');
	await page.locator('[data-rp-entry="door"]').waitFor();
	await chooseAddEntry(page, 'door'); await panel(page, 'details'); await page.locator('.rp-structure-task').waitFor();
	await recordText(page, '.rp-structure-task', 'offset', '0.5'); await recordText(page, '.rp-structure-task', 'width', '0.8');
	await activate(page, '.rp-structure-task > button:last-child'); await page.locator('.rp-structure-task').waitFor({ state: 'hidden' });
	const structure = await page.evaluate(() => window.editorFidelity.groups().structure), id = structure.walls[0].id;
	await closeDetails(page, scenario); await panel(page, 'layers'); await activate(page, `[data-rp-id="${id}"]`);
	await closeDetails(page, scenario); await panel(page, 'details'); await openCurves(page);
	await recordText(page, '[data-rp-form="edit-curves"]', 'depth', '0.5'); await frame(page);
	await recordShot(page, scenario, out, 'curved-wall-and-opening-preview');
	await closeDetails(page, scenario); await activate(page, '.rp-task-banner__finish'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	const saved = await page.evaluate(() => window.editorFidelity.groups().structure);
	assert.equal(saved.walls[0].bulge, 0.25); assert.deepEqual(saved.openings, structure.openings);
	await recordShot(page, scenario, out, 'saved-curved-wall-and-opening');
}
async function rotateCurvePreview(page, scenario, out, id) {
	const before = await notes(page), measured = await lengths(page);
	const hover = await page.evaluate(value => window.editorFidelity.rotationHoverPoint(value), id);
	await page.mouse.move(hover.x, hover.y); await frame(page);
	const scene = await page.evaluate(value => window.editorFidelity.rotation(value), id), angle = 17 * Math.PI / 180;
	const x = scene.handle.x - scene.pivot.x, y = scene.handle.y - scene.pivot.y;
	await page.mouse.move(scene.handle.x, scene.handle.y); await page.mouse.down();
	await page.mouse.move(scene.pivot.x + x * Math.cos(angle) - y * Math.sin(angle), scene.pivot.y + x * Math.sin(angle) + y * Math.cos(angle), { steps: 6 }); await frame(page);
	assert.deepEqual(await lengths(page), measured); assert.deepEqual(await notes(page), before);
	await recordShot(page, scenario, out, 'rotating-curved-room-all-edges');
	await page.keyboard.press('Escape'); await page.mouse.up(); await frame(page); assert.deepEqual(await notes(page), before);
}
async function journey(page, scenario, out) {
	await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme });
	const id = await page.evaluate(() => window.editorFidelity.selection().ids[0]), before = await notes(page);
	await openCurves(page);
	await recordText(page, '[data-rp-form="edit-curves"]', 'depth', '0.5'); await frame(page);
	assert.equal(await page.locator('[data-rp-room-edge]').count(), 4); assert.deepEqual(await notes(page), before);
	await recordShot(page, scenario, out, 'precise-curve-preview');
	const accessibility = [await editorAccessibility(page, scenario, out, 'precise-curve-preview')];
	await closeDetails(page, scenario); await frame(page);
	const scene = await page.evaluate(value => window.editorFidelity.curves(value), id);
	assert.equal(scene.handles.length, 4); assert.ok(scene.points.length > 8, 'Room paint follows the curve');
	await recordShot(page, scenario, out, 'all-curved-edge-labels');
	await activate(page, '.rp-task-banner__cancel'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' }); assert.deepEqual(await notes(page), before);
	await panel(page, 'details'); await openCurves(page);
	await recordText(page, '[data-rp-form="edit-curves"]', 'radius', '2.5'); await closeDetails(page, scenario);
	await activate(page, '.rp-task-banner__finish'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	const saved = await page.evaluate(value => window.editorFidelity.groups().rooms.find(room => room.id === value), id);
	assert.ok(Math.abs(saved.bulges[0] - 0.5) < 1e-12); assert.equal(await page.locator('[data-rp-room-edge]').count(), 4);
	await recordShot(page, scenario, out, 'saved-curved-room');
	await page.waitForFunction(() => document.activeElement?.matches('.rp-plan-canvas'));
	await page.keyboard.press('Shift+2'); await frame(page); await recordShot(page, scenario, out, 'fit-curved-room-bounds');
	await rotateCurvePreview(page, scenario, out, id);
	await activate(page, '[data-rp-action="undo"]'); await page.waitForFunction(value => !window.editorFidelity.groups().rooms.find(room => room.id === value).bulges, id);
	await activate(page, '[data-rp-action="redo"]'); await page.waitForFunction(value => window.editorFidelity.groups().rooms.find(room => room.id === value).bulges?.[0] > 0, id);
	await panel(page, 'details'); await openCurves(page); await closeDetails(page, scenario); await frame(page);
	const handle = (await page.evaluate(value => window.editorFidelity.curves(value), id)).handles[1], persisted = await notes(page);
	await page.mouse.move(handle.x, handle.y); await page.mouse.down(); await page.mouse.move(handle.x + 35, handle.y, { steps: 6 });
	assert.deepEqual(await notes(page), persisted); await recordShot(page, scenario, out, 'pointer-bend-preview'); await page.mouse.up();
	await activate(page, '.rp-task-banner__cancel'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' }); assert.deepEqual(await notes(page), persisted);
	await curvedWall(page, scenario, out);
	return { accessibility, edgeLabels: 4, numericCurve: true, radiusPreserved: true, cancelNoWrite: true, pointerPreviewNoWrite: true, undoRedo: true, curvedWallOpening: true, storage: 'Production commands over FakeVault; no native-host claim' };
}
await runAreaBrowserMatrix('editor-curves', '&reference&planning&fidelity', journey, '[data-rp-empty="floor-start"]');
