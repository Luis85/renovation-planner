import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { activate, tabTo } from './editor-area-browser.mjs';
import { recordText, recordShot } from './editor-record-browser.mjs';

const form = '[data-rp-form="reference"]', canvas = '.rp-reference-preview';
const frame = page => page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
const notes = page => page.evaluate(() => window.editorFidelity.savedNotes());
const coordinates = page => page.locator(`${form} input`).evaluateAll(inputs => Object.fromEntries(inputs.filter(input => ['ax', 'ay', 'bx', 'by'].includes(input.name)).map(input => [input.name, input.value])));
async function digest(page) { return createHash('sha256').update(await page.locator(canvas).evaluate(element => element.toDataURL())).digest('hex'); }

/** Measure painted pixels, excluding the CSS canvas background and any assumed component dimensions. */
function imageMetrics(page) {
	return page.locator(canvas).evaluate(element => {
		const rect = element.getBoundingClientRect(), pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
		const body = element.closest('.rp-dialog-body').getBoundingClientRect();
		let left = element.width, top = element.height, right = -1, bottom = -1;
		for (let y = 0; y < element.height; y++) for (let x = 0; x < element.width; x++) {
			if (!pixels[(y * element.width + x) * 4 + 3]) continue;
			left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
		}
		return { canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, intrinsic: { width: element.width, height: element.height },
			visible: { width: Math.max(0, Math.min(rect.right, body.right, innerWidth) - Math.max(rect.left, body.left, 0)), height: Math.max(0, Math.min(rect.bottom, body.bottom, innerHeight) - Math.max(rect.top, body.top, 0)) },
			painted: { width: (right - left + 1) * rect.width / element.width, height: (bottom - top + 1) * rect.height / element.height } };
	});
}

/** Run from the unmodified predecessor checkout to measure its actual CSS-rendered image. */
export async function referenceViewportBaseline(page, scenario, out) {
	await activate(page, '[data-rp-empty="floor-start"] [data-rp-action="reference"]');
	await recordText(page, form, 'source', 'scan.png'); await activate(page, '[data-rp-action="load-reference"]');
	await page.locator(canvas).waitFor();
	await activate(page, `${form} button[type="submit"]`);
	await page.locator(`${form} [name="ax"]`).waitFor();
	await page.locator(canvas).scrollIntoViewIfNeeded(); await frame(page);
	const measured = await imageMetrics(page);
	await recordShot(page, scenario, out, 'reference-legacy-scale');
	return measured;
}

/** Real point picks, camera navigation and cancellation, with no write or Vue-state injection. */
export async function referenceViewportAcceptance(page, scenario, out) {
	const before = await notes(page);
	await activate(page, '[data-rp-empty="floor-start"] [data-rp-action="reference"]'); await page.locator(form).waitFor();
	await recordText(page, form, 'source', 'scan.png'); await activate(page, '[data-rp-action="load-reference"]');
	await page.locator(canvas).waitFor(); await tabTo(page, canvas); await frame(page);
	const source = { width: Number(await page.locator(`${form} [name="crop-width"]`).inputValue()), height: Number(await page.locator(`${form} [name="crop-height"]`).inputValue()) };
	const measured = await imageMetrics(page), oldScale = Math.min(380 / source.width, 200 / source.height);
	const paintedAreaRatio = measured.painted.width * measured.painted.height / (source.width * source.height * oldScale ** 2);
	const legacy = JSON.parse(await readFile(new URL('../docs/user-experience/renovation-planner-editor-specs/implementation/evidence/reference-scale-20260909/legacy/report.json', import.meta.url), 'utf8')).find(entry => entry.scenario === scenario.name);
	assert.ok(legacy, 'matching measured predecessor scenario exists');
	const actualPaintedAreaRatio = measured.painted.width * measured.painted.height / (legacy.painted.width * legacy.painted.height);
	assert.ok(actualPaintedAreaRatio >= 1.75, 'painted image is substantially larger than the actual CSS-rendered predecessor');
	assert.ok(measured.canvas.width >= (scenario.width === 460 ? 300 : 600), 'reference canvas uses the available modal width');
	assert.ok(measured.canvas.height >= 340, 'reference canvas retains the enlarged minimum height');
	assert.ok(measured.visible.width >= measured.canvas.width - 2 && measured.visible.height >= measured.canvas.height - 2, 'the enlarged preview is visible within the modal scroll viewport');
	assert.ok(paintedAreaRatio >= 1.75, 'actual painted image is substantially larger than the legacy 400×220 fit');
	assert.ok(await page.locator('.rp-dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'reference dialog has no horizontal overflow');
	await activate(page, `${form} button[type="submit"]`); await page.locator(`${form} [name="ax"]`).waitFor();
	await tabTo(page, canvas); await frame(page);
	const fit = await page.locator(canvas).evaluate((element, image) => {
		const rect = element.getBoundingClientRect(), scale = Math.min((element.clientWidth - 20) / image.width, (element.clientHeight - 20) / image.height);
		return { x: rect.x, y: rect.y, sx: rect.width / element.clientWidth, sy: rect.height / element.clientHeight, scale,
			x0: (element.clientWidth - image.width * scale) / 2, y0: (element.clientHeight - image.height * scale) / 2 };
	}, source);
	const expected = [{ x: source.width * 0.3, y: source.height * 0.4 }, { x: source.width * 0.7, y: source.height * 0.4 }];
	for (const point of expected) await page.mouse.click(fit.x + (fit.x0 + point.x * fit.scale) * fit.sx, fit.y + (fit.y0 + point.y * fit.scale) * fit.sy);
	await frame(page); const picked = await coordinates(page), tolerance = 2 / fit.scale;
	for (const [name, value] of Object.entries({ ax: expected[0].x, ay: expected[0].y, bx: expected[1].x, by: expected[1].y })) assert.ok(Math.abs(Number(picked[name]) - value) <= tolerance, `${name} is a source-pixel coordinate within native click precision`);
	await recordText(page, form, 'length', '3'); await tabTo(page, canvas); await frame(page);
	const baselinePaint = await digest(page); await recordShot(page, scenario, out, 'reference-large-scale');
	await activate(page, '[data-rp-reference-view="zoom-in"]'); await frame(page);
	assert.equal(await page.locator('.rp-reference-viewport__tools output').innerText(), '125%');
	const zoomed = await digest(page); assert.notEqual(zoomed, baselinePaint); assert.deepEqual(await coordinates(page), picked);
	await activate(page, '[data-rp-reference-view="pan"]'); await tabTo(page, canvas);
	const box = await page.locator(canvas).boundingBox(); assert.ok(box);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 56, box.y + box.height / 2 + 28, { steps: 5 }); await page.mouse.up(); await frame(page);
	assert.notEqual(await digest(page), zoomed); assert.deepEqual(await coordinates(page), picked);
	await recordShot(page, scenario, out, 'reference-pan-zoom');
	await activate(page, '[data-rp-reference-view="pan"]'); await activate(page, '[data-rp-reference-view="fit"]'); await frame(page);
	assert.equal(await page.locator('.rp-reference-viewport__tools output').innerText(), '100%');
	assert.equal(await digest(page), baselinePaint, 'Fit restores the same image and pixel-anchored A/B paint');
	assert.deepEqual(await coordinates(page), picked); assert.deepEqual(await notes(page), before);
	await tabTo(page, canvas); await page.keyboard.press('+'); await page.keyboard.press('ArrowRight'); await frame(page);
	assert.notEqual(await digest(page), baselinePaint); assert.deepEqual(await coordinates(page), picked);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -80); await frame(page);
	assert.deepEqual(await coordinates(page), picked);
	await page.keyboard.press('f'); await frame(page); assert.equal(await digest(page), baselinePaint);
	await activate(page, '[data-rp-reference-view="zoom-out"]'); await frame(page);
	assert.equal(await page.locator('.rp-reference-viewport__tools output').innerText(), '80%');
	await activate(page, '[data-rp-reference-view="fit"]'); await frame(page); assert.equal(await digest(page), baselinePaint);
	await activate(page, `${form} button[type="submit"]`); await page.locator(`${form} [name="opacity"]`).waitFor();
	assert.deepEqual(await notes(page), before, 'Apply scale only advances to Review');
	await activate(page, '[data-rp-reference-action="back"]'); assert.deepEqual(await coordinates(page), picked);
	await page.keyboard.press('Escape'); await page.locator(form).waitFor({ state: 'hidden' }); assert.deepEqual(await notes(page), before);
	await activate(page, '[data-rp-empty="floor-start"] [data-rp-action="reference"]');
	await recordText(page, form, 'source', 'scan.png'); await activate(page, '[data-rp-action="load-reference"]'); await page.locator(canvas).waitFor();
	await activate(page, `${form} button[type="submit"]`);
	// Exact source coordinates give an independently calculable 700 px / 3500 mm
	// fixture and avoid comparing decimal strings after an inexact inverse transform.
	const savedPoints = { ax: '400', ay: '400', bx: '1100', by: '400' };
	for (const [name, value] of Object.entries({ ...savedPoints, length: '3,5' })) await recordText(page, form, name, value);
	await recordShot(page, scenario, out, 'reference-known-length');
	await activate(page, `${form} button[type="submit"]`); await page.locator(`${form} [name="opacity"]`).waitFor();
	assert.deepEqual(await notes(page), before);
	await tabTo(page, `${form} [name="opacity"]`);
	await recordShot(page, scenario, out, 'reference-scale-review');
	await activate(page, `${form} button[type="submit"]`); await page.locator(form).waitFor({ state: 'hidden' });
	const committed = await notes(page);
	const geometries = committed.filter(([path]) => path.endsWith('.rpgeo')).map(([path, bytes]) => ({ path, document: JSON.parse(bytes) })).filter(entry => entry.document.calibration);
	assert.equal(geometries.length, 1);
	const calibration = geometries[0].document.calibration;
	const expectedPixelsPerMillimetre = 700 / 3500;
	assert.equal(calibration.knownDistance, 3500);
	assert.ok(Math.abs(calibration.pixelsPerWorldUnit - expectedPixelsPerMillimetre) < 1e-12, 'source-pixel distance / entered millimetres is saved');
	if (await page.locator('[data-rp-rail="layers"]').isVisible()) await activate(page, '[data-rp-rail="layers"]');
	await activate(page, '[data-rp-action="reference"]'); await page.locator(canvas).waitFor();
	await activate(page, `${form} button[type="submit"]`);
	assert.deepEqual(await coordinates(page), savedPoints, 'reopening restores source coordinates');
	assert.equal(await page.locator(`${form} [name="length"]`).inputValue(), '3.5');
	await activate(page, '[data-rp-reference-view="zoom-in"]'); await tabTo(page, canvas); await page.keyboard.press('ArrowLeft');
	await recordText(page, form, 'length', '9');
	await activate(page, `${form} button[type="submit"]`); await page.locator(`${form} [name="opacity"]`).waitFor();
	assert.deepEqual(await notes(page), committed);
	await activate(page, '.rp-dialog [data-rp-action="cancel"]'); await page.locator(form).waitFor({ state: 'hidden' });
	assert.deepEqual(await notes(page), committed, 'Cancel retains all previously saved bytes');
	return { ...measured, source, paintedAreaRatio, legacyPainted: legacy.painted, actualPaintedAreaRatio, sourceCoordinates: picked, pointerToleranceInSourcePixels: tolerance, zoomAndPanChangedPaint: true, fitRestoredPaint: true, navigationAndCancelNoWrite: true, calibration, expectedPixelsPerMillimetre, committedPath: geometries[0].path, decimalCommaAndReopen: true, savedReferenceCancelNoWrite: true };
}
