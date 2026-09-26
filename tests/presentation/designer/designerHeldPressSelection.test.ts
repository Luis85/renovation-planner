/**
 * @vitest-environment jsdom
 *
 * `Design an Asset.md` step 32b: a second drag pressed and held while the first drag's write is still in
 * flight changes NOTHING on screen until that write lands — no live preview, and no selection change. The
 * end-to-end case reads the bowl's position and width during the hold and never a selection indicator, and
 * `designerWriteChain.test.ts` asserts only where the composed gestures END.
 *
 * The held press lands where the bowl WILL be once the first write is read back, which on the design still
 * showing is empty canvas: a press acted on then would be a press on nothing, and a plain press on nothing
 * clears the selection. Nothing is settled between the first release and the reads below: that gap is the
 * subject.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { t } from '../../../src/presentation/i18n/strings';
import { settle } from '../../helpers/editor';
import { click, designerRig, drag, held, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

/** `designerWriteChain.test.ts`'s step: clear of every snap target the toilet has, so a body move lands exactly. */
const STEP = { x: 500, y: 300 };
const IN_BOWL = justInsideBottom(detailOutline('detail-2'));
const IN_MOVED_BOWL = { x: IN_BOWL.x + STEP.x, y: IN_BOWL.y + STEP.y };
const FURTHER = { x: IN_BOWL.x + 2 * STEP.x, y: IN_BOWL.y + 2 * STEP.y };

let live: DesignerRig | null = null;
afterEach(() => {
	live?.unmount();
	live = null;
});

/** The Parts rows drawn as selected, which is what the user sees of the selection beside the canvas. */
function pressedRows(rig: DesignerRig): (string | undefined)[] {
	return rig.wrapper.findAll('.rp-designer-part-row').filter((row) => row.attributes('aria-pressed') === 'true').map((row) => row.attributes('name'));
}

function bowlLeft(rig: DesignerRig): number | undefined {
	return useAssetDesignStore(rig.pinia).design?.shape?.details.find((detail) => detail.id === 'detail-2')?.outline.points[0]?.x;
}

describe('a drag pressed and held behind the last drag’s write', () => {
	it('changes neither the selection nor the drawing until that write lands, then carries on from it', async () => {
		const rig = await designerRig({ shape: TOILET });
		live = rig;
		rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
		await settle();
		click(rig, IN_BOWL);
		await settle();
		const store = useAssetDesignStore(rig.pinia);
		const committed = bowlLeft(rig);
		expect(pressedRows(rig)).toEqual(['detail:detail-2']);

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		// What the screen shows once the first drag is released: its own preview, held until its write lands.
		const released = { selection: store.selection, preview: store.preview };
		held(rig, 'pointerdown', IN_MOVED_BOWL, 1);
		held(rig, 'pointermove', FURTHER, 1);

		expect({ selection: store.selection, preview: store.preview }).toEqual(released);
		expect(store.preview).toBe(released.preview);
		expect(released.selection).toEqual({ kind: 'detail', id: 'detail-2' });
		await nextTick();
		// Still inside the window — the first write has not been read back — and the rows drawn from it agree.
		expect(bowlLeft(rig)).toBe(committed);
		expect(pressedRows(rig)).toEqual(['detail:detail-2']);

		await settle();
		held(rig, 'pointerup', FURTHER, 0);
		await settle();
		expect(store.selection).toEqual({ kind: 'detail', id: 'detail-2' });
		expect(pressedRows(rig)).toEqual(['detail:detail-2']);
		expect(bowlLeft(rig)).toBeCloseTo((committed as number) + 2 * STEP.x, 6);
	});
});
