/**
 * @vitest-environment jsdom
 *
 * Task B6's gesture end to end, through the MOUNTED designer: the tool the toolbar registers,
 * the two dialogs it opens through this leaf's own `DialogHost`, and the bytes that land in the
 * asset's geometry sidecar.
 *
 * **`designerToolbar.test.ts` proves the button ACTIVATES the tool and nothing more.** That is
 * the slice-7 guard and it is satisfied by a tool wired to a command that writes nowhere — which
 * is exactly the state `CalibrateTool` shipped in for two whole slices. These cases drive the
 * clicks a hand makes, answer the dialog a user answers, and then read the sidecar the rig
 * really wrote, so a calibration that reaches no vault fails here.
 *
 * Geometry: `designerRig.click` names WORLD millimetres and derives the pixel through the live
 * camera, so a case never spells a screen coordinate. Two clicks 1000 mm apart called 2000 mm is
 * a `scaleCorrection` of 2 throughout.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import { footprintFromDimensions } from '../../../src/domain/asset/AssetShape';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { distance } from '../../../src/core/geometry/operations';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { click, designerRig, type DesignerRig } from '../../helpers/designerRig';

/** A traced outline still awaiting a scale — the state a calibration exists to convert. */
function pendingTrace(): AssetShape {
	return {
		footprint: expectOk(footprintFromDimensions(1000, 600)),
		footprintOrigin: 'traced',
		footprintPending: true,
		clearance: null,
		clearancePending: false,
		anchor: { x: 0, y: 0 },
		anchorPending: false,
		facing: 0,
	};
}

/** The two picks, as a hand makes them: a real down+up pair each, at world coordinates. */
function measure(rig: DesignerRig): Promise<void> {
	rig.toolbarButton(t('en', 'designer.toolbar.calibrate')).click();
	click(rig, { x: 0, y: 0 });
	click(rig, { x: 1000, y: 0 });
	return settle();
}

async function answerDistance(rig: DesignerRig, millimetres: string): Promise<void> {
	await rig.wrapper.find('.rp-dialog input').setValue(millimetres);
	await rig.wrapper.find('.rp-dialog form').trigger('submit');
	await settle();
}

describe('calibrating an asset from the designer', () => {
	/**
	 * The ordinary first calibration: a reference image, nothing traced on it yet. No
	 * confirmation is offered — there is no pending coordinate for the rescale to move, and an
	 * "are you sure" over nothing is the one that trains people to click through the ones that
	 * matter.
	 *
	 * The at-rest invariant is what this asserts on rather than the raw points, because it is
	 * the property the whole two-step rescale exists to establish: a build that stored the picks
	 * unconverted would hold a 1000-unit segment claiming 2000 mm.
	 */
	it('asks only for a distance, and writes a calibration that measures it', async () => {
		const rig = await designerRig();

		await measure(rig);
		expect(rig.wrapper.find('.rp-dialog input').exists()).toBe(true);
		await answerDistance(rig, '2000');

		const calibration = (await rig.document()).calibration;
		expect(calibration).not.toBeNull();
		expect(calibration && distance(calibration.pointA, calibration.pointB)).toBeCloseTo(2000, 6);
		rig.unmount();
	});

	/**
	 * With something pending, the rescale warning comes FIRST and the distance is only asked
	 * after it is accepted — and the outline really doubles in the vault, which is the half no
	 * dialog assertion can give.
	 */
	it('warns before rescaling a pending trace, then converts it', async () => {
		const rig = await designerRig({ shape: pendingTrace() });

		await measure(rig);
		expect(rig.wrapper.find('.rp-dialog-title').text())
			.toBe(t('en', 'designer.calibrate.recalibrate.title'));
		// Nothing has been asked about a distance yet: a user about to decline is never made to
		// type a measurement first.
		expect(rig.wrapper.find('.rp-dialog input').exists()).toBe(false);

		await rig.wrapper.find('.rp-dialog-button-danger').trigger('click');
		await settle();
		await answerDistance(rig, '2000');

		const shape = (await rig.document()).shape;
		expect(shape?.footprint.points[2]).toEqual({ x: 1000, y: 600 });   // doubled from 500 x 300
		expect(shape?.footprintPending).toBe(false);
		rig.unmount();
	});

	/**
	 * Declining writes nothing at all — the discriminator the two cases above cannot give
	 * between a dialog that is consulted and one that is merely shown.
	 */
	it('writes nothing when the rescale is declined', async () => {
		const rig = await designerRig({ shape: pendingTrace() });

		await measure(rig);
		const cancel = rig.wrapper.findAll('.rp-dialog-button').at(0);
		if (cancel === undefined) throw new Error('the confirmation offered no cancel');
		await cancel.trigger('click');
		await settle();

		const document = await rig.document();
		expect(document.calibration).toBeNull();
		expect(document.shape?.footprintPending).toBe(true);
		expect(rig.wrapper.find('.rp-dialog').exists()).toBe(false);
		rig.unmount();
	});
});
