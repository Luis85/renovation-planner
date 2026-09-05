// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, placeAt, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { runOptions } from './axeOptions';

describe('Area visual harness scenario', () => {
	it.each([1280, 460])('draws a valid temporary outline through Add at %i px', async (width) => {
		installCanvas();
		installResizeObserver();
		const { leafEl, view } = mountPlanEditorHarness(document.body, { area: true });
		resizeTo(sizedShellRoot(leafEl), width, 700);
		await settleUntil(() => leafEl.querySelector('.rp-plan-canvas') !== null, 'canvas');
		const canvas = leafEl.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
		placeAt(canvas, 0, 0, width, 700);
		resizeTo(canvas, width, 700);
		await settleUntil(() => leafEl.querySelector('.rp-task-banner__finish')?.getAttribute('aria-disabled') === 'false', 'valid Area outline');
		expect(leafEl.querySelector('.rp-add-menu')).toBeNull();
		expect(leafEl.querySelector<HTMLInputElement>('.rp-task-banner__repeat input')?.checked).toBe(false);
		expect(document.activeElement).toBe(canvas);
		expect((await axe.run(leafEl, runOptions)).violations).toEqual([]);
		await view.onClose();
	});
});
