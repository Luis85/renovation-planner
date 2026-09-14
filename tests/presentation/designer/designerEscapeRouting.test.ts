/**
 * @vitest-environment jsdom
 *
 * Escape on the asset designer's surface, which mounts the same `EditorSurface` the Plan Editor does
 * and so takes `routeEscape` unchanged.
 *
 * **Updated deliberately with the symbols spec's Decision 10.** While the designer registered no
 * `select` tool, `DesignerCanvas.vue`'s `escapeSetTool` substituted camera mode for the
 * `returned-to-select` arm, and these cases asserted that substitution. The designer now registers
 * `DesignerSelectTool` and keeps its selection in its own `assetDesignStore`, so the substitution is
 * gone and the cases assert the Plan Editor's order: an empty creation tool returns to Select, and
 * Select with a selection clears it.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { click, designerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';
import { settle } from '../../helpers/settle';

function key(canvas: HTMLElement, init: KeyboardEventInit): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

describe('Escape on the asset designer surface', () => {
	it('returns a creation tool with nothing drawn to Select', async () => {
		const rig = await designerRig();
		rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		expect(rig.activeToolId()).toBe('trace-footprint');

		key(rig.canvasEl, { key: 'Escape' });

		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	it('clears the designer’s selection under Select, and stays in Select', async () => {
		const rig = await designerRig({ shape: TOILET });
		rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
		await settle();
		click(rig, justInsideBottom(detailOutline('detail-2')));
		await settle();
		const store = useAssetDesignStore(rig.pinia);
		expect(store.selection).toEqual({ kind: 'detail', id: 'detail-2' });

		key(rig.canvasEl, { key: 'Escape' });

		expect(store.selection).toBeNull();
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});
});

/**
 * `DesignerCanvas.vue:113`'s `nudgeSelection` is the inert half of E8/Task 14: this surface's
 * own `selection` never holds anything (see that file's header), so `EditorSurface`'s arrow-key
 * routing still calls the prop — there is nothing here for it to move, and the case is that
 * calling it does nothing rather than throwing or writing.
 */
describe('an arrow key on the asset designer surface', () => {
	it('reaches the inert nudgeSelection without throwing or writing to the sidecar', async () => {
		const rig = await designerRig();
		const before = await rig.document();

		expect(() => key(rig.canvasEl, { key: 'ArrowRight' })).not.toThrow();
		await settle();

		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});
});
