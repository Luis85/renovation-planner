// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import axe from 'axe-core';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { expectDefined } from '../helpers/domain';
import { runOptions } from './axeOptions';

const click = (root: HTMLElement, selector: string) => expectDefined(root.querySelector<HTMLButtonElement>(selector), selector).click();
async function type(root: HTMLElement, name: string, value: string): Promise<void> {
	const field = expectDefined(root.querySelector<HTMLInputElement>(`input[name="${name}"]`), name);
	field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
}
async function add(root: HTMLElement, kind: string): Promise<void> {
	click(root, '[data-rp-action="add"]'); await nextTick(); click(root, `[data-rp-entry="${kind}"]`);
	await settleUntil(() => root.querySelector('.rp-structure-task') !== null, 'structure task');
	await settleUntil(() => root.querySelector('.rp-structure-task button')?.getAttribute('aria-disabled') === 'false', 'loaded spatial baseline');
}
async function segment(root: HTMLElement, length: string, angle: string): Promise<void> {
	await type(root, 'length', length); await type(root, 'angle', angle); click(root, '.rp-structure-task button[type="submit"]'); await nextTick();
}
async function walls(root: HTMLElement, room = false): Promise<void> {
	await add(root, 'wall'); click(root, '.rp-structure-task button[type="submit"]'); await nextTick();
	await segment(root, '4', '0'); await segment(root, '3', '90'); await segment(root, '4', '180');
	click(root, '.rp-structure-task .rp-dialog-actions button:last-child'); await nextTick();
	if (room) { click(root, '.rp-structure-task input[type="checkbox"]'); await nextTick(); }
	click(root, '.rp-structure-task > button:last-child');
	await settleUntil(() => root.querySelector('.rp-structure-task') === null, 'finished wall chain');
}

describe('M04/M07 real editor structure journey', () => {
	it.each([1280, 460])('creates a loop and hosted opening, edits, cancels and undoes at %i px', async width => {
		installCanvas(); installResizeObserver();
		const { leafEl: root, view } = mountPlanEditorHarness(document.body, { reference: true });
		resizeTo(sizedShellRoot(root), width, 900);
		await settleUntil(() => root.querySelector('.rp-plan-canvas') !== null, 'editor');
		await walls(root, true);
		if (width === 460) { click(root, '[data-rp-rail="details"]'); await nextTick(); }
		await settleUntil(() => root.querySelector('.rp-structure-inspector') !== null, 'wall inspector');
		expect(root.querySelector('.rp-structure-inspector')?.textContent).toContain('Room 1');
		expect((await axe.run(root, runOptions)).violations).toEqual([]);
		if (width === 460) root.querySelector('.rp-structure-inspector')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await nextTick(); await add(root, 'door');
		await type(root, 'offset', '0.5');
		click(root, '.rp-structure-task > button:last-child');
		await settleUntil(() => root.querySelector('.rp-structure-task') === null, 'saved door');
		if (width === 460) { click(root, '[data-rp-rail="details"]'); await nextTick(); }
		click(root, '.rp-structure-inspector > button');
		await settleUntil(() => root.querySelector('.rp-dialog form') !== null, 'opening form');
		await type(root, 'width', '1.1'); click(root, '.rp-dialog form button[type="submit"]'); await nextTick();
		expect(root.querySelector('.rp-dialog form [role="status"]')?.textContent).toContain('opening remains on its host wall');
		click(root, '.rp-dialog [data-rp-action="cancel"]'); await nextTick();
		expect(root.querySelector('.rp-structure-inspector')?.textContent).toContain('0.9');
		await settleUntil(() => root.querySelector('.rp-structure-inspector > button')?.getAttribute('aria-disabled') === 'false', 'edit action ready');
		click(root, '.rp-structure-inspector > button'); await nextTick();
		await settleUntil(() => root.querySelector('.rp-dialog form') !== null, 'opening form again');
		await type(root, 'width', '1.1'); click(root, '.rp-dialog form button[type="submit"]'); await nextTick(); click(root, '.rp-dialog form button[type="submit"]');
		await settleUntil(() => root.querySelector('.rp-dialog') === null, 'applied opening');
		expect(root.querySelector('.rp-structure-inspector')?.textContent).toContain('1.1');
		click(root, '[data-rp-action="undo"]'); await settleUntil(() => root.querySelector('.rp-structure-inspector')?.textContent?.includes('0.9') === true, 'undo dimensions');
		click(root, '[data-rp-action="undo"]'); await settleUntil(() => root.querySelector('.rp-structure-inspector') === null, 'undo door');
		await view.onClose();
	});
	it('retains raw input, native editing keys and first-point draft across reflow; cancellation writes nothing', async () => {
		installCanvas(); installResizeObserver();
		const { leafEl: root, view } = mountPlanEditorHarness(document.body, { reference: true });
		resizeTo(sizedShellRoot(root), 1280, 900); await settleUntil(() => root.querySelector('.rp-plan-canvas') !== null, 'editor');
		await add(root, 'wall'); await type(root, 'x', 'invalid'); click(root, '.rp-structure-task button[type="submit"]'); await nextTick();
		expect(root.querySelector('.rp-structure-task [role="alert"]')).not.toBeNull();
		await type(root, 'x', '1.25'); const x = expectDefined(root.querySelector<HTMLInputElement>('input[name="x"]'), 'x'); x.focus();
		const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); x.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(false);
		resizeTo(sizedShellRoot(root), 460, 900); await nextTick();
		expect(root.querySelector('input[name="x"]')).toHaveProperty('value', '1.25'); expect(document.activeElement).toBe(x);
		click(root, '.rp-structure-task button[type="submit"]'); await nextTick();
		const length = expectDefined(root.querySelector<HTMLInputElement>('input[name="length"]'), 'length'); length.focus();
		for (const key of ['Backspace', 'Delete', ' ']) { const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); length.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); }
		click(root, '.rp-task-banner__cancel'); await nextTick();
		expect(root.querySelector('.rp-structure-task')).toBeNull(); expect(root.querySelector('.rp-structure-list')).toBeNull();
		await view.onClose();
	});
});
