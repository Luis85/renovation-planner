/**
 * @vitest-environment jsdom
 *
 * Step 9 of `Calibrate a sheet and reserve space`: once a calibration lands, EVERY pending line the
 * Reference tab drew is gone — the anchor's and the graphics' included — and so is the hint.
 *
 * `calibrateAsset.test.ts` asserts the anchor's coordinates rescale and never re-reads
 * `anchorPending` (a review mutation keeping that flag left 1845 tests green), and the e2e that
 * watches the lines disappear traces only a footprint and a clearance. So this drives the whole
 * chain on the mounted designer: the toolbar's Calibrate tool, the real dialogs, the real sidecar,
 * the refresh, and the lines `DesignerReferenceStatus` draws from what came back.
 */
import { describe, expect, it } from 'vitest';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { t } from '../../../src/presentation/i18n/strings';
import { editableShape } from '../../helpers/assetShapes';
import { click, designerRig, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

/** All four groups awaiting a scale: `editableShape`'s `detail-2` already is. */
const ALL_PENDING = () => editableShape({
	footprintOrigin: 'traced',
	footprintPending: true,
	clearancePending: true,
	anchor: { x: 40, y: 20 },
	anchorPending: true,
});

const LINES: readonly StringKey[] = [
	'designer.reference.pending.footprint',
	'designer.reference.pending.clearance',
	'designer.reference.pending.anchor',
	'designer.reference.pending.graphics',
];

async function openReferenceTab(rig: DesignerRig): Promise<void> {
	await rig.wrapper.get('[role="tab"][data-rp-tab="reference"]').trigger('click');
	await settle();
}

const reference = (rig: DesignerRig) => rig.wrapper.get('.rp-designer-reference');
const pendingLines = (rig: DesignerRig) => reference(rig).findAll('.rp-designer-unscaled').map((line) => line.text());
const hint = (rig: DesignerRig) => reference(rig).find('.rp-designer-field-hint');

/** `designerCalibration.test.ts`'s gesture: two picks 1000 mm apart, the rescale accepted, 2000 answered. */
async function calibrate(rig: DesignerRig): Promise<void> {
	rig.toolbarButton(t('en', 'designer.toolbar.calibrate')).click();
	click(rig, { x: 0, y: 0 });
	click(rig, { x: 1000, y: 0 });
	await settle();
	await rig.wrapper.get('.rp-dialog-button-danger').trigger('click');
	await settle();
	await rig.wrapper.get('.rp-dialog input').setValue('2000');
	await rig.wrapper.get('.rp-dialog form').trigger('submit');
	await settle();
}

describe('the Reference tab after a calibration lands', () => {
	it('drops every pending line, the anchor’s and the graphics’ with the outline’s, and the hint', async () => {
		const rig = await designerRig({ shape: ALL_PENDING() });
		try {
			await openReferenceTab(rig);
			expect(pendingLines(rig)).toEqual(LINES.map((key) => t('en', key)));
			expect(hint(rig).exists()).toBe(true);

			await calibrate(rig);

			// The write really happened, so an empty list below is not a panel that never re-read.
			expect((await rig.document()).calibration).not.toBeNull();
			expect(reference(rig).text()).toContain(t('en', 'designer.reference.scale.set'));
			expect(pendingLines(rig)).toEqual([]);
			expect(hint(rig).exists()).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});
