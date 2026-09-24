/**
 * @vitest-environment jsdom
 *
 * The designer RESTS in Select (AD18-R20): a leaf opens with Select active and pressed, so a canvas
 * click selects rather than pans, and the new-asset empty state still draws under it. Nothing here
 * presses a tool first — that is the whole point, since every earlier selection case clicked Select
 * before it asked anything (`selecting`), which is how the camera-mode rest went unseen.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { settle } from '../../helpers/editor';
import { click, designerRig } from '../../helpers/designerRig';
import { TOILET } from '../../helpers/designerSelection';

describe('the tool a designer leaf opens in', () => {
	it('is Select, drawn pressed, with Pan not pressed', async () => {
		const rig = await designerRig({ shape: TOILET });
		try {
			expect(rig.activeToolId()).toBe('select');
			expect(rig.toolbarButton(t('en', 'designer.toolbar.select')).getAttribute('aria-pressed')).toBe('true');
			expect(rig.toolbarButton(t('en', 'designer.toolbar.pan')).getAttribute('aria-pressed')).toBe('false');
		} finally {
			rig.unmount();
		}
	});

	it('selects what the first canvas click lands on', async () => {
		const rig = await designerRig({ shape: TOILET });
		try {
			// Inside the footprint, right of the bowl and below the tank (`designerKeyboard.test.ts`'s point).
			click(rig, { x: TOILET.footprint.points[1].x - 15, y: 0 });
			await settle();
			expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'footprint' });
		} finally {
			rig.unmount();
		}
	});

	it('still draws the new-asset empty state over the canvas of a shapeless asset', async () => {
		const rig = await designerRig({ shape: null });
		try {
			expect(rig.activeToolId()).toBe('select');
			expect(rig.wrapper.find('.rp-designer-canvas .rp-empty-state').exists()).toBe(true);
		} finally {
			rig.unmount();
		}
	});
});
