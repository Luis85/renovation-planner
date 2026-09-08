import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
import { recordApply, recordText } from './editor-record-browser.mjs';
import { editorContextSnapshot, assertEditorContext } from './editor-downstream-forms.mjs';
import { panel } from './editor-structure-check.mjs';
import { inspectorVisibility } from './editor-inspector-visibility.mjs';
import { editorAccessibility } from './editor-accessibility.mjs';

const form = '[data-rp-form="renovation"]';
const issueRows = '.rp-review-inspector > ol.rp-renovation-list > li';
const selectedReviewRoom = '.rp-review-rooms [data-rp-review-room][aria-pressed="true"]';

async function editableSubject(page) {
	await page.waitForFunction(() => {
		const button = document.querySelector('.rp-subject-row [data-rp-action="edit-record"]');
		return button && !button.disabled;
	});
}

async function addDecision(page, question, subjectId) {
	await editableSubject(page);
	await activate(page, '.rp-subject-row [data-rp-action="decision-record"]');
	await page.locator(form).waitFor();
	assert.equal(await page.locator(`${form} select`).inputValue(), subjectId, 'Decision belongs to the existing floor outcome');
	assert.equal(await page.locator(`${form} [name="resolved"]`).isChecked(), false);
	await recordText(page, form, 'question', question);
	await recordApply(page, form, true);
	const row = page.locator('.rp-renovation-inspector [data-rp-record]').filter({ hasText: question });
	await row.waitFor();
	const id = await row.getAttribute('data-rp-record');
	assert.ok(id, 'native Decision save exposes its persisted identity');
	return id;
}

async function assertIssues(page, roomId, questions, german) {
	await page.waitForFunction(selector => document.querySelectorAll(selector).length === 2, issueRows);
	assert.equal(await page.locator('.rp-review-rooms [data-rp-review-room]').count(), 4);
	assert.equal(await page.locator(selectedReviewRoom).getAttribute('data-rp-review-room'), roomId);
	assert.equal(await page.locator(`${selectedReviewRoom} .rp-review-room__status`).innerText(),
		german ? 'Punkte mit Handlungsbedarf: 2' : 'Items needing attention: 2');
	assert.deepEqual((await page.locator(`${issueRows} [data-rp-review-cause]`).allTextContents()).map(text => text.trim()).toSorted(), questions.toSorted());
	const allClear = german ? 'Im geprüften Umfang wurden keine Lücken gefunden.' : 'No gaps found within this review scope.';
	assert.equal((await page.locator('.rp-review-inspector').innerText()).includes(allClear), false);
	assert.equal(await page.locator('[data-rp-action="add"]').count(), 0);
	assert.equal(await page.locator('.rp-dialog').count(), 0);
}

async function returnToReview(page) {
	const tabs = page.locator('[data-rp-perspective="review"]').locator('..');
	const before = await tabs.boundingBox();
	await activate(page, '[data-rp-perspective="review"]');
	await page.waitForFunction(() => document.querySelector('[data-rp-perspective="review"]')?.getAttribute('aria-checked') === 'true');
	const after = await tabs.boundingBox();
	assert.ok(before && after && Math.abs(before.x - after.x) < 0.5 && Math.abs(before.y - after.y) < 0.5, 'perspective tabs retain their position on entering Review');
	await panel(page, 'details');
}

async function verifyRoomMarker(page, roomId, narrow, beforeReview) {
	if (narrow) await page.keyboard.press('Escape');
	await tabTo(page, '.rp-plan-canvas'); await page.keyboard.press('Escape');
	await page.locator('[data-rp-review-summary-room]').waitFor({ state: 'hidden' });
	const scene = await page.evaluate(id => window.editorFidelity.captions(id), roomId);
	assert.equal(scene.reviewMarkers.length, 1, 'two Decisions share one marked Room');
	const marker = scene.reviewMarkers[0]; assert.equal(marker.roomId, roomId);
	const notes = await page.evaluate(() => window.editorFidelity.savedNotes());
	await page.mouse.click(scene.origin.x + marker.bounds.x + marker.bounds.width / 2, scene.origin.y + marker.bounds.y + marker.bounds.height / 2);
	await page.locator(`[data-rp-review-summary-room="${roomId}"]`).waitFor();
	assert.equal(await page.locator('[data-rp-perspective="review"]').getAttribute('aria-checked'), 'true');
	assert.equal(await page.locator('.rp-dialog').count(), 0, 'Room marker selection opens the summary, not a source dialog');
	assert.equal(await page.locator(selectedReviewRoom).getAttribute('data-rp-review-room'), roomId);
	assert.equal(await page.locator(selectedReviewRoom).getAttribute('data-rp-review-number'), String(marker.number));
	const framed = await page.evaluate(id => window.editorFidelity.captions(id), roomId);
	assert.notDeepEqual(framed.camera, scene.camera, 'marker frames its Room through native pointer input');
	await activate(page, '.rp-review-inspector > button:not([data-rp-action])');
	await editableSubject(page);
	if (narrow) await page.keyboard.press('Escape');
	await assertEditorContext(page, beforeReview);
	assert.deepEqual(await page.evaluate(() => window.editorFidelity.savedNotes()), notes, 'Room marker selection and Back write no files');
	await returnToReview(page);
	return { roomId, number: marker.number, stayedInReview: true, cameraBefore: scene.camera, cameraFramed: framed.camera };
}

/** Additional native Decisions; original all-clear captures and generated note remain earlier evidence. */
export async function captureReviewIssues(page, scenario, out, shot) {
	const german = scenario.name === 'german-constrained', narrow = scenario.width === 460;
	const questions = german ? ['Welches Öl?', 'Welches Bodenmuster?'] : ['Which oil finish?', 'Which floor finish sample?'];
	const roomId = await page.locator(selectedReviewRoom).getAttribute('data-rp-review-room');
	assert.ok(roomId, 'the original Review retains a selected Kitchen');
	assert.equal(await page.locator(issueRows).count(), 0, 'additional Decisions start after the original all-clear state');
	await activate(page, '[data-rp-action="review-open-room"]');
	await activate(page, '[data-rp-mode="planned"]');
	assert.equal(await page.locator('.rp-subject-row').count(), 1);
	const subjectId = await page.locator('.rp-subject-row').getAttribute('data-rp-record');
	assert.ok(subjectId);
	const ids = [];
	for (const question of questions) ids.push(await addDecision(page, question, subjectId));
	assert.equal(new Set(ids).size, 2, 'two separate native Decision writes');
	await editableSubject(page);
	if (narrow) await page.keyboard.press('Escape');
	const beforeReview = await editorContextSnapshot(page);
	assert.equal(beforeReview.selected, roomId);
	await returnToReview(page);
	await assertIssues(page, roomId, questions, german);
	await page.setViewportSize({ width: scenario.width, height: 1000 });
	await page.locator(`.rp-editor-shell[data-layout="${narrow ? 'constrained' : 'full'}"]`).waitFor();
	await page.evaluate(() => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
	await assertIssues(page, roomId, questions, german);
	await shot(page, scenario, out, 'review-issues-design');
	const visibility = await inspectorVisibility(page, ['.rp-review-inspector > h3', '.rp-review-rooms',
		'.rp-review-summary .rp-transformation-summary', '[data-rp-action="review-open-room"]',
		`${issueRows}:nth-child(1)`, `${issueRows}:nth-child(2)`, '[data-rp-action="review-note"]'], narrow);
	await editorAccessibility(page, scenario, out, 'review-issues-design');
	await page.setViewportSize({ width: scenario.width, height: 900 });
	for (const [index, question] of questions.entries()) {
		const texts = await page.locator(`${issueRows} [data-rp-review-cause]`).allTextContents();
		const issueIndex = texts.findIndex(text => text.trim() === question);
		assert.ok(issueIndex >= 0);
		await activate(page, `${issueRows}:nth-child(${issueIndex + 1}) > button`);
		await page.locator(form).waitFor();
		assert.equal(await page.locator(`${form} [name="question"]`).inputValue(), question, 'Review opens the exact Decision');
		assert.equal(await page.locator(`${form} [name="resolved"]`).isChecked(), false);
		await activate(page, '.rp-dialog [data-rp-action="cancel"]');
		await page.locator(form).waitFor({ state: 'hidden' });
		await editableSubject(page);
		assert.equal((await page.locator(`[data-rp-record="${ids[index]}"]`).innerText()).includes(question), true, 'Cancel retains the saved Decision identity and question');
		if (narrow) await page.keyboard.press('Escape');
		await assertEditorContext(page, beforeReview);
		await returnToReview(page);
		await assertIssues(page, roomId, questions, german);
	}
	await activate(page, '.rp-review-inspector > button:not([data-rp-action])');
	await editableSubject(page);
	if (narrow) await page.keyboard.press('Escape');
	await assertEditorContext(page, beforeReview);
	await returnToReview(page);
	await assertIssues(page, roomId, questions, german);
	const marker = await verifyRoomMarker(page, roomId, narrow, beforeReview);
	await assertIssues(page, roomId, questions, german);
	return { decisions: ids, questions, roomId, visibility, marker, viewport: `${scenario.width} × 1000`,
		routes: 'both Review issues open their exact unresolved Decision; Cancel preserves Room and camera' };
}
