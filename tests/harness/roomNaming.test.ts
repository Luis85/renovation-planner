// @vitest-environment jsdom
import { expectDefined } from '../helpers/domain';
import { describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';

// A mounted editor, several bounded settles and a full axe scan per case — the same shape
// `HARNESS_SCAN_MS`'s docblock (`./axeOptions`) derives the budget for; every settle keeps
// its own 4s named deadline, so this bounds only the SUM.
describe('Room naming harness', { timeout: HARNESS_SCAN_MS }, () => {
	it.each([1280, 460])('exposes an accessible real-command form at %i px', async width => {
		installCanvas(); installResizeObserver();
		const { leafEl, view } = mountPlanEditorHarness(document.body, { roomNaming: true, select: 'harness-kitchen' });
		resizeTo(sizedShellRoot(leafEl), width, 700);
		await settleUntil(() => leafEl.querySelector('.rp-plan-canvas') !== null, 'editor');
		if (width === 460) leafEl.querySelector<HTMLButtonElement>('[data-rp-rail="details"]')?.click();
		await settleUntil(() => leafEl.querySelector('[data-rp-action="rename-room"]') !== null, 'rename action');
		leafEl.querySelector<HTMLButtonElement>('[data-rp-action="rename-room"]')?.click();
		await settleUntil(() => leafEl.querySelector('[data-rp-form="room-name"]') !== null, 'name form');
		expect((await axe.run(leafEl, runOptions)).violations).toEqual([]);
		const name = expectDefined(leafEl.querySelector<HTMLInputElement>('input[name="name"]'), 'name');
		name.value = 'Dining room'; name.dispatchEvent(new Event('input', { bubbles: true }));
		leafEl.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await settleUntil(() => leafEl.querySelector('[data-rp-form="room-name"]') === null, 'saved name');
		expect(leafEl.querySelector('.rp-room-inspector')?.textContent).toContain('Dining room');
		await view.onClose();
	});
	it.each([1280, 460])('retains native controls through reflow from %i px and returns focus to a visible control', async width => {
		installCanvas(); installResizeObserver();
		const { leafEl, view } = mountPlanEditorHarness(document.body, { roomNaming: true, select: 'harness-kitchen' });
		resizeTo(sizedShellRoot(leafEl), width, 700);
		await settleUntil(() => leafEl.querySelector('.rp-plan-canvas') !== null, 'editor');
		if (width === 460) leafEl.querySelector<HTMLButtonElement>('[data-rp-rail="details"]')?.click();
		await settleUntil(() => leafEl.querySelector('[data-rp-action="rename-room"]') !== null, 'rename action');
		const opener = expectDefined(leafEl.querySelector<HTMLButtonElement>('[data-rp-action="rename-room"]'), 'opener');
		opener.focus(); opener.click();
		await settleUntil(() => leafEl.querySelector('[data-rp-form="room-name"]') !== null, 'form');
		const field = expectDefined(leafEl.querySelector<HTMLInputElement>('input[name="name"]'), 'name');
		field.value = 'Dining room'; field.dispatchEvent(new Event('input', { bubbles: true }));
		resizeTo(sizedShellRoot(leafEl), width === 460 ? 1280 : 460, 700);
		await settleUntil(() => leafEl.querySelector('.rp-editor-shell')?.getAttribute('data-layout') === (width === 460 ? 'full' : 'constrained'), 'reflow');
		expect(leafEl.querySelector('[data-rp-action="rename-room"]')).toBe(opener);
		expect(leafEl.querySelector('input[name="name"]')).toBe(field);
		expect(document.activeElement).toBe(field);
		expect(leafEl.querySelector('input[name="name"]')).toHaveProperty('value', 'Dining room');
		leafEl.querySelector<HTMLButtonElement>('.rp-dialog [data-rp-action="cancel"]')?.click();
		await settleUntil(() => leafEl.querySelector('[data-rp-form="room-name"]') === null, 'cancel');
		const target = width === 460 ? opener : leafEl.querySelector('[data-rp-rail="details"]');
		await settleUntil(() => document.activeElement === target, 'visible restored focus');
		expect(document.activeElement?.closest<HTMLElement>('[data-rp-shell-region]')?.style.display).not.toBe('none');
		await view.onClose();
	});

});
