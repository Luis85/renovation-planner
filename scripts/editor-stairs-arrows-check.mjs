import assert from 'node:assert/strict';
import { runAreaBrowserMatrix, activate, tabTo } from './editor-area-browser.mjs';
import { recordRoom, recordText, recordShot } from './editor-record-browser.mjs';
import { drawWalls, panel, preserveTheme } from './editor-structure-check.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';

const notes = page => page.evaluate(() => window.editorFidelity.savedNotes());
const frame = page => page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
async function scene(page, id = null) { await frame(page); return page.evaluate(value => window.editorFidelity.elements(value), id); }
const points = flat => Array.from({ length: flat.length / 2 }, (_, index) => ({ x: flat[index * 2], y: flat[index * 2 + 1] }));
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function centreline(outline) { const p = points(outline); assert.equal(p.length, 4); return [midpoint(p[0], p[3]), midpoint(p[1], p[2])]; }
function near(actual, expected) { assert.equal(actual.length, expected.length); actual.forEach((p, i) => { assert.ok(Math.abs(p.x - expected[i].x) < 1e-6); assert.ok(Math.abs(p.y - expected[i].y) < 1e-6); }); }
function constrained(p, step) { const degrees = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x) * 180 / Math.PI; assert.ok(Math.abs(degrees / step - Math.round(degrees / step)) < 1e-6, 'placed segment follows the Zone angle increment'); }
async function client(page, point) {
	const value = await scene(page), [a, b, c, d, e, f] = value.matrix;
	return { x: value.origin.x + a * point.x + c * point.y + e, y: value.origin.y + b * point.x + d * point.y + f };
}
async function moveTo(page, point) {
	const at = await client(page, point);
	assert.equal(await page.evaluate(p => { const target = document.elementFromPoint(p.x, p.y); return !!target?.closest('.rp-plan-canvas') && !target.closest('button, input, textarea, select, summary, [role="dialog"]'); }, at), true, 'native point is on unobstructed canvas');
	await page.mouse.move(at.x, at.y); await frame(page); return at;
}
async function place(page, point, shift = false) {
	if (shift) await page.keyboard.down('Shift');
	const at = await moveTo(page, point); await page.mouse.click(at.x, at.y);
	if (shift) await page.keyboard.up('Shift');
	await frame(page);
}
async function closeDetails(page, scenario) {
	if (scenario.width === 460 && await page.locator('[data-rp-rail="details"]').getAttribute('aria-expanded') === 'true') await page.keyboard.press('Escape');
}
async function fit(page, scenario, all = false) {
	await closeDetails(page, scenario); await tabTo(page, '.rp-plan-canvas'); await page.keyboard.press(all ? 'Shift+1' : 'Shift+2'); await frame(page);
}
async function hideReference(page, scenario) {
	await panel(page, 'layers');
	const checkbox = '.rp-layer-list__row:has([data-rp-action="set-scale"]) > input[type="checkbox"]';
	assert.equal(await page.locator(checkbox).count(), 1);
	if (await page.locator(checkbox).isChecked()) { await tabTo(page, checkbox); await page.keyboard.press('Space'); }
	assert.equal(await page.locator(checkbox).isChecked(), false);
	if (scenario.width === 460) await page.keyboard.press('Escape');
	assert.equal((await scene(page)).referenceVisible, false);
}
async function add(page, scenario, kind) {
	// Begin with Details open: constrained activation must close it itself.
	await panel(page, 'details'); await activate(page, '[data-rp-action="add"]'); await page.locator('.rp-add-menu').waitFor();
	assert.equal(await page.locator('[data-rp-entry]').count(), 13);
	assert.equal(await page.locator('.rp-add-menu [data-icon-missing]').count(), 0);
	const entry = page.locator(`[data-rp-entry="${kind}"]`);
	for (let index = 0; index < 20; index++) { if (await entry.evaluate(el => el === document.activeElement)) break; await page.keyboard.press('ArrowDown'); }
	assert.equal(await entry.evaluate(el => el === document.activeElement), true);
	await page.keyboard.press('Enter'); await page.locator('.rp-task-banner').waitFor();
	if (scenario.width === 460) assert.equal(await page.locator('[data-rp-rail="details"]').getAttribute('aria-expanded'), 'false', 'drawing leaves the canvas open');
	await page.waitForFunction(() => document.activeElement?.matches('.rp-plan-canvas'));
	await page.waitForFunction(() => document.querySelector('.rp-task-banner__cancel')?.getAttribute('aria-disabled') !== 'true');
}
async function shot(page, scenario, out, name) { await frame(page); assert.equal((await scene(page)).referenceVisible, false); await recordShot(page, scenario, out, name); }
async function finish(page, previousIds) {
	await activate(page, '.rp-task-banner__finish'); await page.locator('.rp-task-banner').waitFor({ state: 'hidden' });
	const ids = (await scene(page)).ids.filter(id => !previousIds.includes(id)); assert.equal(ids.length, 1);
	const saved = await scene(page, ids[0]); assert.equal(saved.stored.points.length >= 2, true);
	const sidecar = (await notes(page)).filter(([path]) => path.endsWith('.rpgeo')).map(([, value]) => JSON.parse(value)).find(value => value.structure?.elements?.some(item => item.id === ids[0]));
	assert.equal(sidecar?.schemaVersion, 8); return ids[0];
}
async function waitStored(page, id, expected) {
	await page.waitForFunction(([target, value]) => JSON.stringify(window.editorFidelity.elements(target).stored) === JSON.stringify(value), [id, expected]);
}
async function history(page, id, before, after) {
	await activate(page, '[data-rp-action="undo"]'); await waitStored(page, id, before);
	await activate(page, '[data-rp-action="redo"]'); await waitStored(page, id, after);
}
async function createStair(page, scenario, out) {
	const before = await scene(page), bytes = await notes(page); await add(page, scenario, 'stair');
	await place(page, { x: 800, y: 400 });
	await page.keyboard.down('Shift'); await moveTo(page, { x: 1250, y: 2300 });
	const preview = await scene(page, 'element-preview'); assert.equal(preview.stair.treads.length, 11); constrained(centreline(preview.stair.outline), preview.drawingStepDegrees);
	assert.deepEqual(await notes(page), bytes); await shot(page, scenario, out, 'stair-shift-preview');
	const end = await client(page, { x: 1250, y: 2300 }); await page.mouse.click(end.x, end.y); await page.keyboard.up('Shift');
	const id = await finish(page, before.ids), saved = await scene(page, id);
	assert.equal(saved.stored.points.length, 2); constrained(saved.stored.points, saved.drawingStepDegrees); assert.equal(saved.stair.direction.type, 'Arrow');
	await fit(page, scenario); await shot(page, scenario, out, 'stair-native-treads'); return id;
}
async function editStair(page, scenario, out, id) {
	const before = (await scene(page, id)).stored; await panel(page, 'details'); await activate(page, '[data-rp-action="edit-element"]');
	const form = '[data-rp-form="stair-edit"]'; await page.locator(form).waitFor();
	for (const [field, value] of Object.entries({ name: scenario.width === 460 ? 'Treppenlauf' : 'Main stairs', 'stair-width': '1,2', 'stair-run': '2,5', 'stair-treads': '10' })) await recordText(page, form, field, value);
	await tabTo(page, `${form} [name="stair-direction"]`); await page.keyboard.press('End'); await page.keyboard.press('Tab');
	assert.equal(await page.locator(`${form} [name="stair-direction"]`).inputValue(), 'down');
	assert.deepEqual((await scene(page, id)).stored, before); await shot(page, scenario, out, 'stair-numeric-preview');
	const a11y = await editorAccessibility(page, scenario, out, 'stair-numeric-preview');
	await activate(page, `${form} button[type="submit"]`); await page.locator(form).waitFor({ state: 'hidden' });
	const after = await scene(page, id); assert.deepEqual(after.stored.stair, { width: 1200, treads: 10, direction: 'down' }); assert.equal(after.stair.treads.length, 9);
	const direction = points(after.stair.direction.points), [start, end] = after.stored.points;
	assert.ok((direction[1].x - direction[0].x) * (end.x - start.x) + (direction[1].y - direction[0].y) * (end.y - start.y) < 0, 'native direction symbol points down the stored stair');
	assert.ok(Math.abs(Math.hypot(after.stored.points[1].x - after.stored.points[0].x, after.stored.points[1].y - after.stored.points[0].y) - 2500) < 1e-6);
	await history(page, id, before, after.stored); await fit(page, scenario); await shot(page, scenario, out, 'stair-edited-down'); return a11y;
}
async function rotateStair(page, scenario, out, id) {
	const before = (await scene(page, id)).stored, middle = midpoint(...before.points);
	await moveTo(page, middle);
	const control = await page.evaluate(value => window.editorFidelity.rotation(value), id), radians = 37 * Math.PI / 180;
	assert.ok(control.control.width >= 44 && control.control.height >= 44);
	const x = control.handle.x - control.pivot.x, y = control.handle.y - control.pivot.y;
	await page.mouse.move(control.handle.x, control.handle.y); await page.mouse.down();
	await page.mouse.move(control.pivot.x + x * Math.cos(radians) - y * Math.sin(radians), control.pivot.y + x * Math.sin(radians) + y * Math.cos(radians), { steps: 6 }); await frame(page);
	const preview = await scene(page, id); assert.deepEqual(preview.stored, before);
	const expected = centreline(preview.stair.outline); assert.notDeepEqual(expected, before.points); await shot(page, scenario, out, 'stair-pointer-rotation-preview');
	await page.mouse.up(); await page.waitForFunction(([target, old]) => JSON.stringify(window.editorFidelity.elements(target).stored.points) !== JSON.stringify(old), [id, before.points]);
	const after = (await scene(page, id)).stored; near(after.points, expected); assert.equal(after.points.length, 2); assert.deepEqual(after.stair, before.stair);
	near([midpoint(...after.points)], [middle]);
	await history(page, id, before, after); await shot(page, scenario, out, 'stair-rotation-restored');
}
async function createArrow(page, scenario, out) {
	await fit(page, scenario, true); const before = await scene(page), bytes = await notes(page); await add(page, scenario, 'arrow');
	await place(page, { x: 2600, y: 600 }); await place(page, { x: 3400, y: 900 }, true);
	await moveTo(page, { x: 3300, y: 2200 });
	const preview = await scene(page, 'element-preview'); assert.equal(preview.arrow.type, 'Arrow'); assert.ok(preview.arrow.headPixels >= 10); constrained(points(preview.arrow.points).slice(0, 2), preview.drawingStepDegrees);
	assert.deepEqual(await notes(page), bytes); await shot(page, scenario, out, 'arrow-polyline-preview');
	await place(page, { x: 3300, y: 2200 }); const id = await finish(page, before.ids);
	const saved = await scene(page, id); assert.equal(saved.stored.points.length, 3); assert.equal(saved.arrow.type, 'Arrow'); near(points(saved.arrow.points), saved.stored.points);
	await fit(page, scenario); await shot(page, scenario, out, 'arrow-native-head'); return id;
}
async function editArrow(page, scenario, out, id) {
	let before = (await scene(page, id)).stored; await panel(page, 'details'); await activate(page, '[data-rp-action="edit-element"]');
	const form = '[data-rp-form="outline-points"]'; await page.locator(form).waitFor();
	await recordText(page, form, '2.x', '3,1'); await recordText(page, form, '2.y', '2,4');
	await shot(page, scenario, out, 'arrow-numeric-preview'); await activate(page, `${form} button[type="submit"]`); await page.locator(form).waitFor({ state: 'hidden' });
	let after = (await scene(page, id)).stored; assert.deepEqual(after.points[2], { x: 3100, y: 2400 }); near(after.points.slice(0, 2), before.points.slice(0, 2)); await history(page, id, before, after);
	await fit(page, scenario); before = (await scene(page, id)).stored;
	const end = (await scene(page, id)).endpoints.at(-1), destination = await client(page, { x: 3000, y: 2300 }); assert.ok(end);
	await page.mouse.move(end.x, end.y); await page.mouse.down(); await page.mouse.move(destination.x, destination.y, { steps: 5 }); await page.mouse.up();
	await page.waitForFunction(([target, old]) => JSON.stringify(window.editorFidelity.elements(target).stored.points) !== JSON.stringify(old), [id, before.points]);
	const moved = await scene(page, id); after = moved.stored; near(after.points.slice(0, 2), before.points.slice(0, 2));
	assert.ok(Math.hypot(after.points[2].x - 3000, after.points[2].y - 2300) <= 2 / Math.hypot(moved.matrix[0], moved.matrix[1]), 'endpoint follows native pointer position within two screen pixels');
	await history(page, id, before, after);
	await panel(page, 'details'); before = after; await activate(page, '.rp-element-inspector [data-rp-action="rotate-object-right"]');
	await page.waitForFunction(([target, old]) => JSON.stringify(window.editorFidelity.elements(target).stored.points) !== JSON.stringify(old), [id, before.points]);
	after = (await scene(page, id)).stored; assert.equal(after.points.length, 3);
	near([{ x: after.points[1].x - after.points[0].x, y: after.points[1].y - after.points[0].y }], [{ x: -(before.points[1].y - before.points[0].y), y: before.points[1].x - before.points[0].x }]);
	await history(page, id, before, after);
	await fit(page, scenario); await shot(page, scenario, out, 'arrow-rotated-and-restored');
}
async function journey(page, scenario, out) {
	await recordRoom(page, scenario, out, { drawWalls, panel, preserveTheme }); await hideReference(page, scenario); await fit(page, scenario, true);
	const stairId = await createStair(page, scenario, out), a11y = await editStair(page, scenario, out, stairId); await rotateStair(page, scenario, out, stairId);
	const arrowId = await createArrow(page, scenario, out); await editArrow(page, scenario, out, arrowId);
	return { accessibility: [a11y], referenceHidden: true, pointerShiftCreation: true, numericEditing: true, pointerStairRotation: true, arrowEndpointEditing: true, undoRedoExact: true,
		constrainedCanvasFirst: scenario.width === 460, stair: await scene(page, stairId), arrow: await scene(page, arrowId),
		storage: 'Actual Chromium input and native Konva paint over production commands/repositories and FakeVault; installed Obsidian and visual acceptance remain separate' };
}
await runAreaBrowserMatrix('editor-stairs-arrows', '&reference&planning&fidelity', journey, '[data-rp-empty="floor-start"]');
