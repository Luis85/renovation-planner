import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
import { recordApply, recordText } from './editor-record-browser.mjs';
import { chooseNative, editorContextSnapshot, assertEditorContext } from './editor-downstream-forms.mjs';
import { panel } from './editor-structure-check.mjs';

const form = '[data-rp-form="planning"]';
const entries = [
	['Ceiling inspection', 'Deckenprüfung', '2026-08-26', 0.18, 0.2],
	['Service route', 'Leitungsführung', '2026-08-27', 0.7, 0.22],
	['Wall opening', 'Wandöffnung', '2026-08-28', 0.52, 0.82],
	['Floor layers', 'Bodenaufbau', '2026-08-29', 0.42, 0.62],
	['Door threshold', 'Türschwelle', '2026-08-30', 0.86, 0.68],
	['Corner condition', 'Eckbereich', '2026-08-31', 0.1, 0.76],
];

async function pinCoordinate(page, label, value) {
	await tabTo(page, `${form} label:has-text("${label}") input`);
	await page.keyboard.press('Control+A'); await page.keyboard.type(String(value));
}

async function linkPhoto(page, entry, index, german) {
	const [english, translated, date, x, y] = entry, title = german ? translated : english;
	await activate(page, '[data-rp-new-evidence]'); await page.locator(form).waitFor();
	await recordText(page, form, 'title', title); await recordText(page, form, 'path', `gallery-${index + 1}.png`);
	await recordText(page, form, 'evidence-date', date);
	await chooseNative(page, `${form} select[name="phase"]`, 1);
	await chooseNative(page, `${form} select[name="work"]`, 1);
	await chooseNative(page, `${form} select[name="record"]`, 0);
	await tabTo(page, `${form} input[type="checkbox"]`); await page.keyboard.press('Space');
	await pinCoordinate(page, german ? 'Horizontaler Raumanteil (0–1)' : 'Horizontal room fraction (0–1)', x);
	await pinCoordinate(page, german ? 'Vertikaler Raumanteil (0–1)' : 'Vertical room fraction (0–1)', y);
	await recordApply(page, form);
	const photo = page.locator('[data-rp-evidence-photo]').filter({ hasText: title }); await photo.waitFor();
	return photo.getAttribute('data-rp-evidence-photo');
}

async function assertGallery(page, ids) {
	assert.equal(await page.locator('[data-rp-evidence-phase="during"]').getAttribute('aria-pressed'), 'true', 'selecting a filtered photo retains During');
	assert.deepEqual(await page.locator('[data-rp-evidence-photo]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-rp-evidence-photo'))), ids, 'selection and reflow retain the same six date-ordered photos');
}

async function galleryVisibility(page, ids, constrained) {
	const inspector = await page.locator('[data-rp-shell-region="inspector"]').boundingBox();
	assert.ok(inspector, 'Photos inspector is displayed');
	const selectors = ['.rp-renovation-inspector > h3', '.rp-evidence-filters', '[data-rp-new-evidence]',
		'.rp-evidence-gallery li:first-child', '.rp-evidence-gallery li:last-child', `.rp-renovation-list > [data-rp-record="${ids[2]}"]`];
	const boxes = {};
	for (const selector of selectors) {
		const box = await page.locator(selector).boundingBox(); assert.ok(box, `${selector} remains rendered`); boxes[selector] = box;
		if (!constrained) assert.ok(box.y >= inspector.y - 1 && box.y + box.height <= inspector.y + inspector.height + 1, `${selector} stays inside the visible Photos inspector`);
	}
	return boxes;
}

/** Six real relationship writes, using only synthetic file inputs; no editor-store seeding. */
export async function captureEvidenceGallery(page, scenario, out, shot) {
	const german = scenario.name === 'german-constrained';
	const selectedRoom = await page.locator('.rp-room-list__row[aria-pressed="true"]').getAttribute('data-rp-id');
	await page.evaluate(isGerman => window.editorFidelity.seedSurroundings(isGerman), german);
	await page.waitForFunction(() => document.querySelectorAll('.rp-room-list__row').length === 4);
	if (scenario.width === 460) await page.keyboard.press('Escape');
	await tabTo(page, '.rp-plan-canvas'); await page.keyboard.press('Shift+1');
	await panel(page, 'details');
	assert.equal(await page.locator('.rp-room-list__row[aria-pressed="true"]').getAttribute('data-rp-id'), selectedRoom, 'adding explicit surroundings retains the selected Room');
	const before = await editorContextSnapshot(page);
	await activate(page, '[data-rp-evidence-phase="during"]');
	const ids = [];
	for (const [index, entry] of [...entries.entries()].toReversed()) ids[index] = await linkPhoto(page, entry, index, german);
	assert.ok(ids.every(id => typeof id === 'string' && id.length > 0), 'every native save exposes its Evidence identity');
	assert.equal(new Set(ids).size, 6, 'six distinct persisted Evidence identities');
	assert.equal(await page.locator('[data-rp-evidence-photo]').count(), 6, 'During filters out the original Before photo');
	assert.equal(await page.locator('[data-rp-evidence-phase="during"]').getAttribute('aria-pressed'), 'true');
	assert.deepEqual(await page.locator('[data-rp-evidence-photo]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-rp-evidence-photo'))), ids, 'date order differs from creation order');
	await activate(page, `[data-rp-evidence-photo="${ids[2]}"]`);
	await assertGallery(page, ids);
	const selected = page.locator(`.rp-renovation-list > [data-rp-record="${ids[2]}"]`);
	assert.equal(await selected.locator('time').getAttribute('datetime'), '2026-08-28'); assert.match(await selected.innerText(), /Floor finish/);
	await assertEditorContext(page, before);
	await page.setViewportSize({ width: scenario.width, height: 1000 });
	await assertGallery(page, ids);
	await shot(page, scenario, out, 'photos-gallery');
	const visibility = await galleryVisibility(page, ids, scenario.width === 460);
	await page.setViewportSize({ width: scenario.width, height: 900 });
	await assertEditorContext(page, before);
	return { images: 6, phase: 'during', selectedId: ids[2], selectedDate: '2026-08-28', work: 'Floor finish', visibility,
		viewport: `${scenario.width} × 1000`, inputs: 'six explicit synthetic PNG files linked through native production forms' };
}
