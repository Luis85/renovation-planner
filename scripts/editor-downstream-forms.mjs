import assert from 'node:assert/strict';
import { activate, tabTo } from './editor-area-browser.mjs';
import { recordApply, recordText } from './editor-record-browser.mjs';

export async function activateReady(page, selector) {
	await page.waitForFunction(value => {
		const button = document.querySelector(value);
		return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
	}, selector);
	await activate(page, selector);
}

export async function chooseNative(page, selector, steps) {
	await tabTo(page, selector); await page.keyboard.press('Home');
	for (let index = 0; index < steps; index++) await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
}

export async function createNamedCatalogueEntry(page, opener, name) {
	await activateReady(page, opener); await page.locator('.rp-dialog-form input[name="name"]').waitFor();
	await recordText(page, '.rp-dialog-form', 'name', name);
	await recordApply(page, '.rp-dialog-form');
}

export async function createQuote(page, { title, amount, issued, description, supplier = 'Local craft' }, preview) {
	await activateReady(page, '.rp-project-quotes .rp-project-work__controls > button:nth-of-type(2)');
	const form = '.rp-quote-form'; await page.locator(form).waitFor();
	await recordText(page, form, 'title', title);
	const supplierOptions = await page.locator(`${form} select[name="supplier"] option`).allTextContents();
	const supplierIndex = supplierOptions.indexOf(supplier);
	assert.ok(supplierIndex > 0, 'the newly created Supplier is an actual selectable record');
	await chooseNative(page, `${form} select[name="supplier"]`, supplierIndex);
	await recordText(page, form, 'issued', issued);
	await recordText(page, form, 'valid-until', '2030-12-31');
	await chooseNative(page, `${form} select[name="quote-status"]`, 1);
	await recordText(page, form, 'item-description', description);
	await recordText(page, form, 'item-amount', amount);
	await recordText(page, form, 'item-currency', 'EUR');
	await activate(page, `${form} fieldset details:first-of-type > summary`);
	await tabTo(page, `${form} fieldset details:first-of-type input[type="checkbox"]`); await page.keyboard.press('Space');
	assert.equal(await page.locator(`${form} fieldset details:first-of-type input[type="checkbox"]`).isChecked(), true);
	await activate(page, `${form} button[type="submit"]`);
	await preview?.();
	await recordApply(page, form);
	await page.getByRole('columnheader').filter({ hasText: title }).waitFor();
}

export async function editorContextSnapshot(page) {
	return {
		selected: await page.locator('.rp-room-list__row[aria-pressed="true"]').getAttribute('data-rp-id'),
		width: await page.locator('[data-rp-dimension="width"]').boundingBox(),
		depth: await page.locator('[data-rp-dimension="depth"]').boundingBox(),
	};
}

export async function reviseReceivedQuote(page) {
	const original = '.rp-quote-comparison thead th:nth-child(2)';
	assert.equal(await page.locator(`${original} button`).count(), 1, 'received offers expose revision, without an edit action');
	await activate(page, `${original} button`);
	const form = '.rp-quote-form'; await page.locator(form).waitFor();
	assert.equal(await page.locator(`${form} [name="quote-status"]`).inputValue(), 'draft');
	await recordText(page, form, 'title', 'Revised floor offer');
	await recordText(page, form, 'item-amount', '610.00');
	await recordApply(page, form, true);
	await page.getByRole('columnheader').filter({ hasText: 'Revised floor offer' }).waitFor();
	assert.equal(await page.locator('.rp-quote-comparison thead th[scope="col"]').count(), 4, 'revision adds an offer while retaining both received originals');
	assert.match(await page.locator('.rp-quote-comparison').innerText(), /Floor offer A/);
	assert.match(await page.locator('.rp-quote-comparison').innerText(), /Floor offer B/);
}

export async function assertEditorContext(page, before) {
	// Reveal is asynchronous; let native ResizeObserver/layout delivery restore the pane first.
	await page.waitForFunction(expected => ['width', 'depth'].every(axis => {
		const element = document.querySelector(`[data-rp-dimension="${axis}"]`);
		const box = element?.getBoundingClientRect();
		return box && expected[axis] && ['x', 'y', 'width', 'height'].every(key => Math.abs(box[key] - expected[axis][key]) < 1);
	}), before);
	const after = await editorContextSnapshot(page);
	assert.equal(after.selected, before.selected, 'return retains the same spatial Room identity');
	for (const axis of ['width', 'depth']) {
		assert.ok(before[axis] && after[axis], 'selected Room keeps its dimension affordances');
		for (const value of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(after[axis][value] - before[axis][value]) < 1,
			`return retains Room camera projection (${axis} ${value})`);
	}
}
