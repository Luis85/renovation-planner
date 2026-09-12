// @vitest-environment jsdom
/**
 * axe against the full layout's side panels (2026-09-12 side panels spec §4), over the real mounted
 * editor. Each case asserts its subject is on screen before scanning, because a scan of nothing
 * reports no violations too. What this cannot grade — contrast, the resize line's visibility, hit
 * size — is `./axeOptions`' header's list, and the captures' job.
 */
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';
import { mountPlanEditor, settle, type EditorHarness } from '../helpers/editor';

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('axe against the plan editor side panels', { timeout: HARNESS_SCAN_MS }, () => {
	it('reports no semantic violations with both panels collapsed to strips', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();
			await mounted.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
			await mounted.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').trigger('click');
			await settle();

			expect(mounted.wrapper.findAll('[data-rp-strip]')).toHaveLength(2);

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);
			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});

	it('reports no semantic violations with a resize handle focused', async () => {
		let mounted: EditorHarness | null = null;
		try {
			mounted = await mountPlanEditor();
			const handle = mounted.wrapper.get('[data-rp-resizer="inspector"]');
			(handle.element as HTMLElement).focus();
			await settle();

			expect(document.activeElement).toBe(handle.element);

			const results = await axe.run(mounted.wrapper.element as HTMLElement, runOptions);
			expect(results.violations).toEqual([]);
		} finally {
			mounted?.unmount();
		}
	});
});
