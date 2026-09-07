import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
import { panel } from './editor-structure-check.mjs';
import { recordShot } from './editor-record-browser.mjs';

function separate(a, b) {
	return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
}
async function inspect(page, roomId) {
	await page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
	const scene = await page.evaluate(id => window.editorFidelity.captions(id), roomId);
	assert.equal(scene.captions.length, 3); assert.equal(scene.pins.length, 6); assert.equal(scene.controls.length, 2);
	for (const caption of scene.captions) {
		const box = caption.bounds;
		assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= scene.size.width && box.y + box.height <= scene.size.height,
			`caption stays inside the actual canvas: ${JSON.stringify({ caption, size: scene.size })}`);
		for (const obstacle of [...scene.controls, ...scene.pins.map(pin => pin.bounds)]) assert.ok(separate(box, obstacle),
			`actual caption clears native controls and pins: ${JSON.stringify({ caption, obstacle })}`);
	}
	return scene;
}
async function pan(page, dx, dy) {
	const box = await page.locator('.rp-plan-canvas').boundingBox(); assert.ok(box);
	const x = box.x + box.width * 0.85, y = box.y + (dy > 0 ? 30 : box.height - 30);
	assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('button, input, textarea, select, summary, .rp-primary-actions'), { x, y }), false, 'pan begins on canvas content rather than a floating control');
	await page.mouse.move(x, y); await page.mouse.down({ button: 'middle' });
	await page.mouse.move(x + dx, y + dy, { steps: 3 }); await page.mouse.up({ button: 'middle' });
}
async function inline(page, roomId, scenario, out, clamped) {
	await activate(page, '[data-rp-dimension="width"]');
	await page.locator('[data-rp-form="room-dimension"]').waitFor();
	if (clamped) assert.equal(await page.locator('.rp-dimension-anchor:has([data-rp-form="room-dimension"])').evaluate(element => element.style.top), '48px');
	const scene = await inspect(page, roomId);
	await recordShot(page, scenario, out, clamped ? 'caption-inline-clamped' : 'caption-inline');
	await page.keyboard.press('Escape'); await page.locator('[data-rp-form="room-dimension"]').waitFor({ state: 'hidden' });
	return scene;
}

/** Native pan and inline editing, including the actual top-clamped form, then restore the camera. */
export async function verifyCaptionControls(page, scenario, out, photoId) {
	const narrow = scenario.width === 460;
	if (narrow) await page.keyboard.press('Escape');
	const roomId = await page.locator('.rp-room-list__row[aria-pressed="true"]').getAttribute('data-rp-id'); assert.ok(roomId);
	const before = await inspect(page, roomId), notes = await page.evaluate(() => window.editorFidelity.savedNotes());
	await pan(page, 17, -13); const panned = await inspect(page, roomId);
	assert.notDeepEqual(panned.camera, before.camera, 'native middle-button input pans the real camera');
	const editing = await inline(page, roomId, scenario, out, false);
	let dy = 0;
	for (let step = 0; step < 10; step++) {
		const top = await page.locator('.rp-dimension-anchor:has([data-rp-dimension="width"])').evaluate(element => Number.parseFloat(element.style.top));
		if (top === 48) break;
		await pan(page, 0, -80); dy -= 80;
	}
	const clamped = await inline(page, roomId, scenario, out, true);
	await pan(page, -17, 13 - dy); const restored = await inspect(page, roomId);
	for (const scene of [panned, editing, clamped, restored]) {
		assert.deepEqual(scene.points, before.points); assert.deepEqual(scene.pins.map(pin => pin.position), before.pins.map(pin => pin.position));
		assert.deepEqual(scene.captions.map(({ text, fontSize }) => ({ text, fontSize })), before.captions.map(({ text, fontSize }) => ({ text, fontSize })));
	}
	assert.equal(restored.camera.zoom, before.camera.zoom);
	for (const axis of ['x', 'y']) assert.ok(Math.abs(restored.camera[axis] - before.camera[axis]) < 0.01, 'reverse native pan restores the camera');
	assert.deepEqual(await page.evaluate(() => window.editorFidelity.savedNotes()), notes, 'pan and cancelled dimensions do not write vault files');
	if (narrow) await panel(page, 'details');
	await tabTo(page, `.rp-renovation-list > [data-rp-record="${photoId}"] > button`);
	return { before, panned, editing, clamped, restored, vaultUnchanged: true };
}
