// @vitest-environment jsdom
import { expectDefined } from '../helpers/domain';
import { describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { runOptions } from './axeOptions';

describe('Room resizing harness', () => {
	it.each([1280, 460])('exposes an accessible real-command form at %i px', async width => {
		installCanvas(); installResizeObserver();
		const { leafEl, view } = mountPlanEditorHarness(document.body, { roomResize: true, select: 'harness-kitchen' });
		resizeTo(sizedShellRoot(leafEl), width, 700);
		await settleUntil(() => leafEl.querySelector('.rp-plan-canvas') !== null, 'editor');
		if (width === 460) leafEl.querySelector<HTMLButtonElement>('[data-rp-rail="details"]')?.click();
		await settleUntil(() => leafEl.querySelector('[data-rp-action="resize-room"]') !== null, 'resize action');
		leafEl.querySelector<HTMLButtonElement>('[data-rp-action="resize-room"]')?.click();
		await settleUntil(() => leafEl.querySelector('.rp-room-dimensions') !== null, 'dimensions form');
		expect((await axe.run(leafEl, runOptions)).violations).toEqual([]);
		const depth = expectDefined(leafEl.querySelector<HTMLInputElement>('input[name="depth"]'), 'depth');
		depth.value = '3.5'; depth.dispatchEvent(new Event('input', { bubbles: true }));
		leafEl.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await settleUntil(() => leafEl.querySelector('.rp-room-dimensions') === null, 'saved size');
		expect(leafEl.querySelector('.rp-room-inspector')?.textContent).toContain('14.7');
		await view.onClose();
	});
	it.each([1280, 460])('retains native controls through reflow from %i px and returns focus to a visible control', async width => {
		installCanvas(); installResizeObserver();
		const { leafEl, view } = mountPlanEditorHarness(document.body, { roomResize: true, select: 'harness-kitchen' });
		resizeTo(sizedShellRoot(leafEl), width, 700);
		await settleUntil(() => leafEl.querySelector('.rp-plan-canvas') !== null, 'editor');
		if (width === 460) leafEl.querySelector<HTMLButtonElement>('[data-rp-rail="details"]')?.click();
		await settleUntil(() => leafEl.querySelector('[data-rp-action="resize-room"]') !== null, 'resize action');
		const opener = expectDefined(leafEl.querySelector<HTMLButtonElement>('[data-rp-action="resize-room"]'), 'opener');
		opener.focus(); opener.click();
		await settleUntil(() => leafEl.querySelector('.rp-room-dimensions') !== null, 'form');
		const field = expectDefined(leafEl.querySelector<HTMLInputElement>('input[name="width"]'), 'width');
		field.value = '5,1'; field.dispatchEvent(new Event('input', { bubbles: true }));
		resizeTo(sizedShellRoot(leafEl), width === 460 ? 1280 : 460, 700);
		await settleUntil(() => leafEl.querySelector('.rp-editor-shell')?.getAttribute('data-layout') === (width === 460 ? 'full' : 'constrained'), 'reflow');
		expect(leafEl.querySelector('[data-rp-action="resize-room"]')).toBe(opener);
		expect(leafEl.querySelector('input[name="width"]')).toBe(field);
		expect(document.activeElement).toBe(field);
		expect(leafEl.querySelector('input[name="width"]')).toHaveProperty('value', '5,1');
		leafEl.querySelector<HTMLButtonElement>('.rp-dialog [data-rp-action="cancel"]')?.click();
		await settleUntil(() => leafEl.querySelector('.rp-room-dimensions') === null, 'cancel');
		const target = width === 460 ? opener : leafEl.querySelector('[data-rp-rail="details"]');
		await settleUntil(() => document.activeElement === target, 'visible restored focus');
		expect(document.activeElement?.closest<HTMLElement>('[data-rp-shell-region]')?.style.display).not.toBe('none');
		await view.onClose();
	});

});
