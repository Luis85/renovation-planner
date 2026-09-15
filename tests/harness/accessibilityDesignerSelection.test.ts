/**
 * @vitest-environment jsdom
 *
 * The asset designer with a detail selected — its inspector section, the refusal alert's home and
 * the mode control — scanned under the ceiling `accessibility.test.ts`'s header states;
 * `runOptions` is shared through `./axeOptions`. Mounted through `designerRig`, the real designer,
 * so the scan grades the markup a user gets rather than a fixture.
 */
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import { useWorkspaceStore } from '../../src/presentation/stores/WorkspaceStore';
import { toiletShape } from '../helpers/assetShapes';
import { settle, settleUntil } from '../helpers/editor';
import { designerRig } from '../helpers/designerRig';

/** A detail's section, and the facing's, whose angle field names its direction hint by `aria-describedby` (critique finding 25). */
describe('the designer with a part selected', { timeout: HARNESS_SCAN_MS }, () => {
	it.each([
		[{ kind: 'detail', id: 'detail-2' }, 'detail-name'],
		[{ kind: 'facing' }, 'angle'],
	] as const)('reports no violations with %o selected', async (selection, field) => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			useAssetDesignStore(rig.pinia).select(selection);
			await settle();

			expect(rig.wrapper.find(`.rp-designer-selection [name="${field}"]`).exists()).toBe(true);
			const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			rig.unmount();
		}
	});
});

/** After Delete hands focus to the inspector (spec Amendment 2): the focused `tabindex="-1"` landmark scans clean. */
it('reports no violations once Delete has handed focus to the inspector', { timeout: HARNESS_SCAN_MS }, async () => {
	const rig = await designerRig({ shape: toiletShape() });
	try {
		const store = useAssetDesignStore(rig.pinia);
		store.select({ kind: 'detail', id: 'detail-2' });
		await settle();
		const button = rig.wrapper.find('.rp-designer-selection [name="delete"]').element as HTMLButtonElement;
		button.focus();
		button.click();
		await settleUntil(() => store.selection === null, 'the delete to land');
		await settle();

		expect(document.activeElement).toBe(rig.wrapper.find('.rp-designer-inspector aside').element);
		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

		expect(results.violations).toEqual([]);
	} finally {
		rig.unmount();
	}
});

/** The View menu open and the grid readout drawn (snapping spec §5): a `<details>` inside the toolbar, and a status line. */
it('reports no violations with the View menu open and the grid shown', { timeout: HARNESS_SCAN_MS }, async () => {
	const rig = await designerRig({ shape: toiletShape() });
	try {
		(rig.wrapper.get('.rp-designer-tools .rp-view-menu').element as HTMLDetailsElement).open = true;
		useWorkspaceStore(rig.pinia).gridVisible = true;
		await settle();

		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

		expect(results.violations).toEqual([]);
	} finally {
		rig.unmount();
	}
});
