/**
 * @vitest-environment jsdom
 *
 * `DesignerRuntime.showClearance`'s rule: a boundary the user asks for is never born invisible. The
 * switch is only drawn while a clearance exists, so every case here HIDES an existing one and then
 * makes a new one — a replacement, which is the case a watch for absent-to-present would never see.
 * Generate's own door is `designerClearanceHelper.test.ts`'s last `Show clearance off` case.
 *
 * Visibility is read off the Konva layer's own `visible()`, as that file reads it.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { t } from '../../../src/presentation/i18n/strings';
import { expectOk } from '../../helpers/domain';
import { editableShape } from '../../helpers/assetShapes';
import { selecting, tracePolygon, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

async function hiding(): Promise<DesignerRig> {
	const rig = await selecting(editableShape());
	await rig.wrapper.get('[name="show-clearance"]').setValue(false);
	await settle();
	return rig;
}

const layerVisible = (rig: DesignerRig) => rig.stage.findOne('.asset-clearance')?.visible();
const switchedOn = (rig: DesignerRig) => (rig.wrapper.get('[name="show-clearance"]').element as HTMLInputElement).checked;

async function applyPreset(rig: DesignerRig, id: string): Promise<void> {
	const preset = ASSET_PRESETS.find((candidate) => candidate.id === id);
	if (preset === undefined) throw new Error(`the catalogue has a ${id}`);
	vi.spyOn(useDialogStore(rig.pinia), 'openDialog').mockResolvedValue({ action: 'submit', values: expectOk(preset.build(defaultValues(preset))) } as never);
	await rig.wrapper.find('.rp-designer-start-preset').trigger('click');
	await settle();
}

// Well outside `editableShape()`'s 1000 x 600 footprint, so the trace is a new, larger boundary.
const RING: readonly Point[] = [
	{ x: -900, y: -700 },
	{ x: 900, y: -700 },
	{ x: 900, y: 700 },
	{ x: -900, y: 700 },
];

describe('a clearance made while Show clearance is off', () => {
	it('switches the layer on when Trace clearance is armed, and leaves it drawn once the trace commits', async () => {
		const rig = await hiding();
		try {
			expect(layerVisible(rig)).toBe(false);
			rig.toolbarButton(t('en', 'designer.toolbar.trace-clearance')).click();
			await settle();
			expect(rig.activeToolId()).toBe('trace-clearance');
			expect(layerVisible(rig)).toBe(true);

			tracePolygon(rig, RING);
			await settle();
			expect((await rig.document()).shape?.clearance?.points).toHaveLength(4);
			expect(layerVisible(rig)).toBe(true);
			expect(switchedOn(rig)).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	it('stays hidden when some other tool is armed', async () => {
		const rig = await hiding();
		try {
			rig.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
			await settle();
			expect(layerVisible(rig)).toBe(false);
		} finally {
			rig.unmount();
		}
	});

	it('switches the layer on when a preset that carries a clearance is applied', async () => {
		const rig = await hiding();
		try {
			await applyPreset(rig, 'toilet');
			expect((await rig.document()).shape?.clearance).not.toBeNull();
			expect(layerVisible(rig)).toBe(true);
			expect(switchedOn(rig)).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	it('changes nothing for a preset with no clearance, which has no boundary to show', async () => {
		const rig = await hiding();
		try {
			await applyPreset(rig, 'tree');
			expect((await rig.document()).shape?.clearance).toBeNull();
			expect(layerVisible(rig)).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});
