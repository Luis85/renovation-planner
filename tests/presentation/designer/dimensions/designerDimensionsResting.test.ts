/**
 * @vitest-environment jsdom
 *
 * AD18-R21's two narrowings of the RESTING dimensions, at the mounted surface: the overall pair
 * alone while the footprint draws under 240 px across, and no label over a handle of the selected
 * part. The rules are `restingLabels.test.ts`'s, in node; this file holds the WIRING — that the
 * component asks them at the live camera, with the handles `DesignerCanvas` actually draws.
 *
 * The rig's camera is `DEFAULT_VIEWPORT` (`camera: 'default'`) — zoom 0.1, pan (-480, -480) — so
 * `screen = (world + 480) / 10` and `editableShape()`'s 1000 mm footprint draws 100 px across,
 * under the threshold. jsdom lays nothing out; every pixel here is one the template writes.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { DEFAULT_VIEWPORT } from '../../../../src/presentation/editor/viewport/Viewport';
import { editableShape } from '../../../helpers/assetShapes';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';

const designer = (): Promise<DesignerRig> => designerRig({ shape: editableShape(), camera: 'default' });

/** Every drawn label's figure name, in DOM order. */
const names = (rig: DesignerRig): string[] => rig.wrapper.findAll('.rp-designer-dimensions .rp-designer-dimension__value')
	.map((button) => (button.element as HTMLElement).dataset['rpDimension'] ?? '');

/** Where one label's wrapper is drawn, as the template wrote it. */
function drawnAt(rig: DesignerRig, name: string): [string, string] {
	const style = rig.wrapper.get(`.rp-designer-dimensions [data-rp-dimension="${name}"]`).element.parentElement?.style;
	return [style?.left ?? '', style?.top ?? ''];
}

describe('the resting dimensions while the drawing is small', () => {
	it('rests the overall pair alone under 240 px, every figure past it, and all of them under All dimensions', async () => {
		const rig = await designer();
		try {
			const editor = useEditorStore(rig.pinia);
			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();
			// 100 px across.
			expect(names(rig)).toEqual(['overall-width', 'overall-depth']);

			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);
			await settle();
			expect(names(rig)).toContain('detail-detail-1-offset-left');
			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(false);
			await settle();

			// 250 px across: zoomed in past the threshold, the part's figures come back.
			editor.viewport = { ...DEFAULT_VIEWPORT, zoom: 0.25 };
			await settle();
			expect(names(rig)).toContain('detail-detail-1-offset-left');

			// 200 px across, and they go again.
			editor.viewport = { ...DEFAULT_VIEWPORT, zoom: 0.2 };
			await settle();
			expect(names(rig)).toEqual(['overall-width', 'overall-depth']);
		} finally {
			rig.unmount();
		}
	});
});

describe('a resting label and the handles the canvas draws', () => {
	/**
	 * With the FOOTPRINT selected, its top-middle box handle is where the overall width anchors at
	 * this camera, (0, -300) at (48, 18) — the top edge is too near the ruler for the label to stand
	 * outside it. Under Select, the tool the designer rests in and the one that draws handles, the
	 * label moves off it; in camera mode no handle is drawn, so nothing moves it.
	 */
	it('moves a label off a drawn handle under Select, and leaves it in camera mode', async () => {
		const rig = await designer();
		try {
			expect(drawnAt(rig, 'overall-width')).toEqual(['48px', '18px']);

			useAssetDesignStore(rig.pinia).select({ kind: 'footprint' });
			await settle();
			expect(rig.activeToolId()).toBe('select');
			expect(drawnAt(rig, 'overall-width')).not.toEqual(['48px', '18px']);

			rig.toolbarButton(t('en', 'designer.toolbar.pan')).click();
			await settle();
			expect(rig.activeToolId()).toBeNull();
			// Still selected, so it is the TOOL that took the handles away and not the selection.
			expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'footprint' });
			expect(drawnAt(rig, 'overall-width')).toEqual(['48px', '18px']);
		} finally {
			rig.unmount();
		}
	});
});
