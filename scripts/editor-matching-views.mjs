import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { activate, tabTo } from './editor-area-browser.mjs';
import { inspectorVisibility } from './editor-inspector-visibility.mjs';
import { recordShot } from './editor-record-browser.mjs';

async function settled(page) {
	await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => { requestAnimationFrame(() => { requestAnimationFrame(resolve); }); }); });
}
function context(page, roomId) {
	return page.evaluate(id => ({ scene: window.editorFidelity.captions(id), notes: window.editorFidelity.savedNotes(),
		selection: window.editorFidelity.selection() }), roomId);
}
async function sampleRoom(page) {
	assert.equal(await page.evaluate(() => ['captions', 'savedNotes', 'selection'].every(key => typeof window.editorFidelity?.[key] === 'function')), true, 'read-only fidelity adapter is installed');
	const selected = page.locator('.rp-room-list__row[aria-pressed="true"]').first();
	const isSelected = await selected.count() > 0;
	const roomId = await (isSelected ? selected : page.locator('.rp-room-list__row').first()).getAttribute('data-rp-id');
	assert.ok(roomId);
	if (isSelected) assert.ok(await page.evaluate(id => window.editorFidelity.selection().ids.includes(id), roomId), 'sample is the actual selected Room');
	return { roomId, role: isSelected ? 'selected-room' : 'floor/element viewport sample; selected entity IDs are recorded separately' };
}
function unchanged(before, after) {
	assert.deepEqual(after.notes, before.notes, 'matching view does not write vault data');
	assert.deepEqual(after.selection, before.selection, 'matching view retains spatial selection');
	assert.deepEqual(after.scene.points, before.scene.points);
	assert.deepEqual(after.scene.captions.map(({ text, fontSize }) => ({ text, fontSize })), before.scene.captions.map(({ text, fontSize }) => ({ text, fontSize })));
	for (const key of ['x', 'y', 'zoom']) assert.ok(Math.abs(after.scene.camera[key] - before.scene.camera[key]) < 0.01, 'restored viewport retains the camera');
}

/** Additional, attributed views; the original 900px journey screenshots remain untouched. */
export async function captureInspectorDesign(page, scenario, out, name, { selectors, topControl }) {
	const viewport = page.viewportSize(), sample = await sampleRoom(page);
	const before = await context(page, sample.roomId);
	await page.setViewportSize({ width: viewport.width, height: 1000 }); await settled(page);
	if (topControl) {
		await tabTo(page, topControl); await page.keyboard.press('Control+Home');
		const inspector = await page.locator('[data-rp-region="inspector"]').boundingBox(); assert.ok(inspector);
		await page.mouse.move(inspector.x + inspector.width * 0.8, inspector.y + 100);
		await page.mouse.wheel(0, -2000); await settled(page);
	}
	const bounds = await inspectorVisibility(page, selectors, scenario.width === 460);
	await recordShot(page, scenario, out, name);
	const captured = await context(page, sample.roomId);
	await page.setViewportSize(viewport); await settled(page);
	unchanged(before, await context(page, sample.roomId));
	const result = { viewport: { width: viewport.width, height: 1000 }, bounds, sample, selection: captured.selection,
		input: topControl ? `Native Tab to ${topControl}, Control+Home and wheel upward inside Inspector; no direct scroll/focus mutation` : 'Only viewport height changes; no scroll/focus reset',
		camera: captured.scene.camera, constrained: scenario.width === 460, vaultAndSelectionUnchanged: true };
	await writeFile(`${out}/${scenario.name}-${name}.json`, JSON.stringify(result, null, 2));
	return result;
}

const overviewViews = {
	room: { name: 'M00-room-design', selectors: ['.rp-renovation-inspector > h3', '.rp-transformation-summary', '.rp-linked-counts', '[data-rp-action="continue-renovation"]'] },
	floor: { name: 'M01-floor-design', selectors: ['.rp-floor-inspector > h3:first-of-type', '.rp-floor-planning-summary', '.rp-floor-inspector__guidance', '.rp-floor-inspector .rp-room-list:has(.rp-room-list__row--annotated)'] },
	wall: { name: 'M07-wall-design', selectors: ['.rp-structure-inspector > h3', '.rp-structure-inspector > .rp-editor-inspector-fields', '[data-rp-action="edit-structure"]'], topControl: '[data-rp-action="edit-structure"]' },
};
export async function captureOverviewMatching(page, scenario, out, state) {
	if (!process.argv.includes('--design')) return null;
	const view = overviewViews[state]; assert.ok(view);
	return { inspector: await captureInspectorDesign(page, scenario, out, view.name, view),
		constrained: state === 'room' ? await captureConstrainedCanvas(page, scenario, out) : null };
}

export async function captureConstrainedCanvas(page, scenario, out) {
	const viewport = page.viewportSize(), sample = await sampleRoom(page);
	const before = await context(page, sample.roomId);
	const hadDetails = await page.locator('.rp-inspector-drawer:visible').count(), hadLayers = await page.locator('.rp-overlay-panel:visible').count();
	const captureViewport = { width: scenario.width === 460 ? 460 : 880, height: 1000 };
	await page.setViewportSize(captureViewport); await settled(page);
	assert.equal(await page.locator('[data-rp-rail="details"]').isVisible(), true);
	const close = '.rp-inspector-drawer__close:visible, .rp-overlay-panel__close:visible';
	assert.ok(await page.locator(close).count() <= 1, 'at most one temporary panel opens');
	if (await page.locator(close).count()) await activate(page, close);
	await tabTo(page, '.rp-plan-canvas'); await settled(page);
	assert.equal(await page.locator('.rp-inspector-drawer:visible, .rp-overlay-panel:visible').count(), 0);
	for (const selector of ['[data-rp-action="select"]', '[data-rp-action="add"]']) assert.equal(await page.locator(selector).isVisible(), true);
	await recordShot(page, scenario, out, 'M16-closed-constrained');
	const captured = await context(page, sample.roomId);
	await page.setViewportSize(viewport); await settled(page);
	if (hadDetails) await activate(page, '[data-rp-rail="details"]');
	if (hadLayers) await activate(page, '[data-rp-rail="layers"]');
	await settled(page);
	unchanged(before, await context(page, sample.roomId));
	const result = { viewport: captureViewport, camera: captured.scene.camera, sample, selection: captured.selection,
		input: 'Resize, native panel Close when open, then Tab to canvas; original panel restored through its rail; no Fit or private camera change', vaultAndSelectionUnchanged: true };
	await writeFile(`${out}/${scenario.name}-M16-closed-constrained.json`, JSON.stringify(result, null, 2));
	return result;
}
