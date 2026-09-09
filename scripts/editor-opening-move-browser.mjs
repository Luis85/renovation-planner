import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
import { recordText, recordShot } from './editor-record-browser.mjs';
import { panel } from './editor-structure-check.mjs';

const frame = page => page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
const structure = page => page.evaluate(() => window.editorFidelity.groups().structure);
const notes = page => page.evaluate(() => window.editorFidelity.savedNotes());
const scene = (page, id) => page.evaluate(value => window.editorFidelity.curves(value), id);
const span = rendered => [rendered.points.slice(0, 2), rendered.points.slice(-2)];
function screenPoint(rendered, point) {
	const [a, b, c, d, e, f] = rendered.transform;
	return { x: rendered.origin.x + a * point.x + c * point.y + e, y: rendered.origin.y + b * point.x + d * point.y + f };
}
async function closePanel(page, scenario) { if (scenario.width === 460) await page.keyboard.press('Escape'); }
async function selectSpatial(page, scenario, id) {
	await closePanel(page, scenario); await panel(page, 'layers'); await activate(page, `.rp-structure-list [data-rp-id="${id}"]`);
	await closePanel(page, scenario); await panel(page, 'details');
}
async function addDoor(page, scenario) {
	await closePanel(page, scenario); await activate(page, '[data-rp-action="add"]'); await page.locator('.rp-add-menu').waitFor();
	for (let count = 0; count < 20; count++) {
		if (await page.locator('[data-rp-entry="door"]').evaluate(element => element === document.activeElement)) break;
		await page.keyboard.press('ArrowDown');
	}
	assert.equal(await page.locator('[data-rp-entry="door"]').evaluate(element => element === document.activeElement), true);
	await page.keyboard.press('Enter'); await panel(page, 'details'); await page.locator('.rp-structure-task').waitFor();
	await page.waitForFunction(() => document.querySelector('.rp-structure-task [name="offset"]')?.readOnly === false);
	await recordText(page, '.rp-structure-task', 'offset', '0.5'); await recordText(page, '.rp-structure-task', 'width', '0.8');
	await activate(page, '.rp-structure-task > button:last-child'); await page.locator('.rp-structure-task').waitFor({ state: 'hidden' });
}
async function readyToMove(page) {
	await page.locator('.rp-task-banner').waitFor();
	await page.waitForFunction(() => document.querySelector('.rp-task-banner span[role="status"]')?.textContent.trim() === '');
	assert.equal(await page.locator('.rp-plan-canvas').evaluate(element => element === document.activeElement), true);
}

/** Fit and pan through native inputs so the tested position is clear of the taskbar at every width. */
async function exposePoint(page, id, point) {
	await tabTo(page, '.rp-plan-canvas'); await page.keyboard.press('Shift+1'); await frame(page);
	const canvas = await page.locator('.rp-plan-canvas').boundingBox(); assert.ok(canvas);
	const current = screenPoint(await scene(page, id), point), centre = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
	await page.keyboard.down('Space'); await page.mouse.move(centre.x, centre.y); await page.mouse.down();
	await page.mouse.move(centre.x + centre.x - current.x, centre.y + centre.y - current.y, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Space'); await frame(page);
	const exposed = screenPoint(await scene(page, id), point);
	assert.equal(await page.evaluate(p => { const hit = document.elementFromPoint(p.x, p.y); return !!hit?.closest('.rp-plan-canvas') && !hit.closest('.rp-task-banner, .rp-direct-actions'); }, exposed), true, 'opening click is on the exposed canvas');
	return exposed;
}
async function contextMove(page, id) {
	const rendered = await scene(page, id), [start, end] = span(rendered);
	const point = screenPoint(rendered, { x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2 });
	await page.mouse.click(point.x, point.y, { button: 'right' }); await page.locator('.rp-canvas-context-menu').waitFor();
	assert.deepEqual(await page.evaluate(() => window.editorFidelity.selection().ids), [id], 'context menu retains the single opening');
	const action = '[data-rp-context-action="move-opening"]';
	for (let count = 0; count < 12; count++) {
		if (await page.locator(action).evaluate(element => element === document.activeElement)) break;
		await page.keyboard.press('ArrowDown');
	}
	assert.equal(await page.locator(action).evaluate(element => element === document.activeElement), true);
	await page.keyboard.press('Enter'); await readyToMove(page);
}

/** Both admissions use native UI; the probe only reads renderer coordinates and persisted projections. */
export async function openingMoveAcceptance(page, scenario, out) {
	await activate(page, '[data-rp-perspective="plan"]'); await panel(page, 'details'); await addDoor(page, scenario);
	const original = await structure(page), opening = original.openings[0], wall = original.walls[0];
	assert.ok(opening && wall); assert.equal(opening.hostId, wall.id);
	assert.deepEqual(wall.start, { x: 0, y: 0 }); assert.deepEqual(wall.end, { x: 4000, y: 0 });
	await selectSpatial(page, scenario, wall.id); await activate(page, '[data-rp-action="edit-curves"]');
	await page.waitForFunction(() => document.querySelector('[data-rp-form="edit-curves"] [name="depth"]')?.readOnly === false);
	await recordText(page, '[data-rp-form="edit-curves"]', 'depth', '0.5'); await closePanel(page, scenario);
	await activate(page, '.rp-task-banner__finish'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	const curved = await structure(page); assert.equal(curved.walls[0].bulge, 0.25); assert.deepEqual(curved.openings, original.openings);
	await selectSpatial(page, scenario, opening.id); const idlePaint = span(await scene(page, opening.id));
	await activate(page, '[data-rp-action="move-opening"]'); await readyToMove(page);
	const before = await notes(page), point = { x: 2000, y: -500 }, cursor = await exposePoint(page, opening.id, point);
	await page.mouse.move(cursor.x, cursor.y); await frame(page);
	assert.notDeepEqual(span(await scene(page, opening.id)), idlePaint, 'native opening cut previews the move');
	assert.deepEqual(await notes(page), before); assert.deepEqual(await structure(page), curved);
	await recordShot(page, scenario, out, 'opening-inspector-move-preview');
	await page.keyboard.press('Escape'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' }); await frame(page);
	assert.deepEqual(await notes(page), before); assert.deepEqual(span(await scene(page, opening.id)), idlePaint);
	await contextMove(page, opening.id);
	const target = screenPoint(await scene(page, opening.id), point); await page.mouse.move(target.x, target.y); await frame(page);
	assert.deepEqual(await notes(page), before); await page.mouse.click(target.x, target.y);
	await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	const moved = await structure(page), actual = moved.openings[0];
	// Independent analytic expectation: a 4 m chord with 0.5 m sagitta has radius 4250 mm.
	const expectedOffset = 4250 * (4 * Math.atan(0.25)) / 2 - opening.width / 2;
	const pixelsPerWorldUnit = Math.hypot(...(await scene(page, opening.id)).transform.slice(0, 2)), toleranceMm = 2 / pixelsPerWorldUnit;
	assert.ok(Math.abs(actual.offset - expectedOffset) <= toleranceMm, 'clicked centre uses along-arc distance, within native pointer precision');
	assert.deepEqual({ ...actual, offset: opening.offset }, opening); assert.deepEqual({ ...moved, openings: curved.openings }, curved);
	assert.deepEqual(await page.evaluate(() => window.editorFidelity.selection().ids), [opening.id]);
	await recordShot(page, scenario, out, 'opening-context-move-committed');
	await activate(page, '[data-rp-action="undo"]'); await page.waitForFunction(value => window.editorFidelity.groups().structure.openings[0].offset === value, opening.offset);
	assert.deepEqual(await structure(page), curved);
	await activate(page, '[data-rp-action="redo"]'); await page.waitForFunction(value => window.editorFidelity.groups().structure.openings[0].offset === value, actual.offset);
	assert.deepEqual(await structure(page), moved);
	return { inspectorPreviewAndEscape: true, contextMenuAdmission: true, hostId: wall.id, worldClick: point, expectedOffset, actualOffset: actual.offset, toleranceMm, hostAndSwingPreserved: true, undoRedoExact: true };
}
