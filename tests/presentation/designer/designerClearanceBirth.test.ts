/**
 * @vitest-environment jsdom
 *
 * `DesignerRuntime.showClearance`'s read-back rule (AD18-R20's polish round): a clearance that comes
 * back through undo or redo, while `Show clearance` is off, is re-shown rather than born hidden. The
 * gestures that CREATE one each have their own door (`designerClearanceReveal.test.ts`); what these
 * cases drive is a clearance arriving with no gesture at all, only a read-back of a history step.
 * The external-refresh arm is `designerRuntimeReveal.test.ts`'s, where the answer can be chosen.
 *
 * Visibility is read off the Konva layer's own `visible()` and off the switch, as the sibling suite reads it.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { editableShape } from '../../helpers/assetShapes';
import { designerRig, tracePolygon, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

const layerVisible = (rig: DesignerRig) => rig.stage.findOne('.asset-clearance')?.visible();
const switchedOn = (rig: DesignerRig) => (rig.wrapper.get('[name="show-clearance"]').element as HTMLInputElement).checked;

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

async function hide(rig: DesignerRig): Promise<void> {
	await rig.wrapper.get('[name="show-clearance"]').setValue(false);
	await settle();
	expect(layerVisible(rig)).toBe(false);
}

const RING: readonly Point[] = [
	{ x: -900, y: -700 },
	{ x: 900, y: -700 },
	{ x: 900, y: 700 },
	{ x: -900, y: 700 },
];

describe('a clearance that returns through history while Show clearance is off', () => {
	it('is shown again when redo brings back a traced one', async () => {
		const rig = await designerRig({ shape: editableShape({ clearance: null }) });
		try {
			await press(rig, 'designer.toolbar.trace-clearance');
			tracePolygon(rig, RING);
			await settle();
			await hide(rig);

			await press(rig, 'designer.toolbar.undo');
			expect((await rig.document()).shape?.clearance).toBeNull();
			await press(rig, 'designer.toolbar.redo');

			expect((await rig.document()).shape?.clearance?.points).toHaveLength(4);
			expect(layerVisible(rig)).toBe(true);
			expect(switchedOn(rig)).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	it('is shown again when undo takes back its removal', async () => {
		const rig = await designerRig({ shape: editableShape() });
		try {
			await hide(rig);
			const row = rig.wrapper.element.querySelector('.rp-designer-part-row[name="clearance"]') as HTMLElement;
			row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			await settle();
			row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
			await settle();
			expect((await rig.document()).shape?.clearance).toBeNull();

			await press(rig, 'designer.toolbar.undo');

			expect((await rig.document()).shape?.clearance).not.toBeNull();
			expect(layerVisible(rig)).toBe(true);
			expect(switchedOn(rig)).toBe(true);
		} finally {
			rig.unmount();
		}
	});
});
