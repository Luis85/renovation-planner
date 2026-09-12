// @vitest-environment jsdom
/**
 * `?panels=` drives the REAL header buttons, the way every knob in this harness drives a control
 * rather than a store, so a capture of it proves the button works.
 */
import { describe, expect, it } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';

describe('the ?panels knob', () => {
	it.each([
		['collapsed', 2],
		['inspector', 1],
	] as const)('collapses %s through the header buttons', async (which, strips) => {
		installCanvas();
		installResizeObserver();
		const { leafEl: root, view } = mountPlanEditorHarness(document.body, { panels: which });
		resizeTo(sizedShellRoot(root), 1280, 900);
		await settleUntil(() => root.querySelectorAll('[data-rp-strip]').length === strips, `${strips} collapsed strip(s)`);
		expect(root.querySelector('[data-rp-strip="inspector"]')).not.toBeNull();
		await view.onClose();
	});
});
