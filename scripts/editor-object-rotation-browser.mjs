import assert from 'node:assert/strict';
import { activate } from './editor-area-browser.mjs';
import { panel } from './editor-structure-check.mjs';
import { recordShot } from './editor-record-browser.mjs';

const notes = page => page.evaluate(() => window.editorFidelity.savedNotes());
function persisted(entries, id) {
	const sidecar = entries.filter(([path]) => path.endsWith('.rpgeo')).map(([, value]) => JSON.parse(value)).find(value => value.structure?.elements?.some(item => item.id === id));
	assert.ok(sidecar, 'Object has persisted sidecar geometry');
	return sidecar.structure.elements.find(item => item.id === id).points;
}
async function scene(page, id, hover = false) {
	if (hover) { const point = await page.evaluate(value => window.editorFidelity.rotationHoverPoint(value), id); await page.mouse.move(point.x, point.y); }
	await page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
	return page.evaluate(value => window.editorFidelity.rotation(value), id);
}
function turn(view, degrees) {
	const x = view.handle.x - view.pivot.x, y = view.handle.y - view.pivot.y, radians = degrees * Math.PI / 180;
	return { x: view.pivot.x + x * Math.cos(radians) - y * Math.sin(radians), y: view.pivot.y + x * Math.sin(radians) + y * Math.cos(radians) };
}
async function waitPoints(page, id, points) {
	await page.waitForFunction(([targetId, expectedPoints]) => window.editorFidelity.savedNotes().filter(([path]) => path.endsWith('.rpgeo')).some(([, value]) => JSON.stringify(JSON.parse(value).structure?.elements?.find(item => item.id === targetId)?.points) === JSON.stringify(expectedPoints)), [id, points]);
}
/** Actual page.mouse coordinates originate in the painted Konva circle, never an injected world gesture. */
export async function verifyObjectRotationPointer(page, scenario, out, id) {
	if (scenario.width === 460) await page.keyboard.press('Escape');
	const before = await scene(page, id, true), originalNotes = await notes(page), original = persisted(originalNotes, id);
	assert.ok(before.control.width >= 44 && before.control.height >= 44, 'painted control contains a 44px rectangular target');
	assert.equal(before.label, null, 'the user-requested small arrow has no permanent text label');
	await page.mouse.move(before.handle.x, before.handle.y);
	const hovered = await scene(page, id); assert.match(hovered.instructions, scenario.query.includes('lang=de') ? /genauen Winkel/ : /precise angle/);
	await recordShot(page, scenario, out, 'arrow-hover');
	await page.mouse.down(); await page.mouse.move(before.handle.x + 3, before.handle.y); await page.mouse.up();
	const precise = '[data-rp-form="object-rotation"]'; await page.locator(precise).waitFor();
	assert.deepEqual(await notes(page), originalNotes, 'short arrow click opens precision without writes');
	await recordShot(page, scenario, out, 'arrow-click-precision');
	await page.keyboard.press('Escape'); await page.locator(precise).waitFor({ state: 'hidden' });
	await activate(page, '.rp-view-menu > summary'); await activate(page, '[data-rp-view="zoom-in"]'); await page.keyboard.press('Escape');
	const zoomed = await scene(page, id, true);
	const box = await page.locator('.rp-plan-canvas').boundingBox(); assert.ok(box);
	const x = box.x + box.width * 0.85, y = box.y + box.height - 35;
	assert.equal(await page.evaluate(point => !!document.elementFromPoint(point.x, point.y)?.closest('button, input, textarea, select, summary'), { x, y }), false);
	await page.mouse.move(x, y); await page.mouse.down({ button: 'middle' }); await page.mouse.move(x + 17, y - 13, { steps: 3 }); await page.mouse.up({ button: 'middle' });
	const moved = await scene(page, id, true); assert.notEqual(moved.camera.zoom, before.camera.zoom); assert.ok(moved.camera.x !== zoomed.camera.x || moved.camera.y !== zoomed.camera.y, 'middle-button input pans the camera'); assert.deepEqual(await notes(page), originalNotes);
	await page.keyboard.down('Shift'); await page.mouse.move(moved.handle.x, moved.handle.y); await page.mouse.down();
	const intermediate = turn(moved, 37), final = turn(moved, 58);
	await page.mouse.move(intermediate.x, intermediate.y, { steps: 3 }); await page.mouse.move(final.x, final.y);
	const preview = await scene(page, id); assert.equal(preview.angle, '+60°'); assert.match(preview.instructions, /15°/); assert.deepEqual(await notes(page), originalNotes, 'pointer preview writes no files');
	assert.equal(await page.locator('.rp-direct-actions').count(), 0, 'the direct-action popover does not cover rotation feedback');
	await recordShot(page, scenario, out, 'pointer-preview');
	await page.mouse.up(); await page.keyboard.up('Shift');
	const expected = Array.from({ length: preview.points.length / 2 }, (_, index) => ({ x: preview.points[index * 2], y: preview.points[index * 2 + 1] }));
	await waitPoints(page, id, expected); assert.notDeepEqual(expected, original);
	await page.locator('.rp-direct-actions').waitFor({ state: 'visible' });
	await activate(page, '[data-rp-action="undo"]'); await waitPoints(page, id, original);
	await activate(page, '[data-rp-action="redo"]'); await waitPoints(page, id, expected);
	await activate(page, '[data-rp-action="undo"]'); await waitPoints(page, id, original);
	const cancelling = await scene(page, id, true), cancellationNotes = await notes(page), destination = turn(cancelling, 32);
	await page.mouse.move(cancelling.handle.x, cancelling.handle.y); await page.mouse.down(); await page.mouse.move(destination.x, destination.y, { steps: 3 }); await page.keyboard.press('Escape'); await page.mouse.up();
	assert.deepEqual(await notes(page), cancellationNotes, 'Escape then pointer-up writes nothing');
	await page.locator('.rp-direct-actions').waitFor({ state: 'visible' });
	await recordShot(page, scenario, out, 'pointer-restored');
	if (scenario.width === 460) await panel(page, 'details');
	return { cameraBefore: before.camera, cameraAfter: moved.camera, edgeArrowTarget: before.control, arrowClickPrecisionNoWrite: true, snappedDegrees: 60, persistedMatchesPreview: true, undoRedoExact: true, escapeNoWrite: true };
}
