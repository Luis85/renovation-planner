// @vitest-environment jsdom
/**
 * Task 20's additions to the status bar: whether the plan's scale is set, the pointer
 * readout withdrawing under the constrained layout (M16), and the pan-override reminder
 * beside the angle-constraint hint this file's sibling case already covers.
 */
import { describe, expect, it } from 'vitest';
import { err } from '../../../../src/core/result/Result';
import { t } from '../../../../src/presentation/i18n/strings';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';
import { mountPlanEditor, mountPlanEditorCanvas, settle } from '../../../helpers/editor';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from '../../../helpers/planFixtures';
import { activateTool } from '../../../helpers/planEditorRig';

const CALIBRATION = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 1000, y: 0 },
	knownDistance: 1000,
	pixelsPerWorldUnit: 1,
};

describe('StatusBar', () => {
	it('says the scale is not set for an uncalibrated plan', async () => {
		const harness = await mountPlanEditorCanvas();

		expect(harness.wrapper.find('.rp-editor-scale').text()).toBe(t('en', 'editor.status.scale.uncalibrated'));
		harness.wrapper.unmount();
	});

	it('says the scale is set for a plan carrying a calibration', async () => {
		const harness = await mountPlanEditorCanvas({ plan: { ...FIXTURE_PLAN, calibration: CALIBRATION } });

		expect(harness.wrapper.find('.rp-editor-scale').text()).toBe(t('en', 'editor.status.scale.calibrated'));
		harness.wrapper.unmount();
	});

	it('withdraws the pointer readout under the constrained layout, and keeps zoom, scale and save state', async () => {
		const harness = await mountPlanEditorCanvas();
		useWorkspaceStore(harness.pinia).layoutMode = 'constrained';
		await settle();

		expect(harness.wrapper.find('.rp-editor-pointer').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-scale').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-editor-measurements').text()).toContain(t('en', 'editor.zoom'));
		expect(harness.wrapper.find('.rp-editor-save-state').exists()).toBe(true);
		harness.wrapper.unmount();
	});

	it('keeps the pointer readout in the full layout', async () => {
		const harness = await mountPlanEditorCanvas();

		expect(harness.wrapper.find('.rp-editor-pointer').exists()).toBe(true);
		harness.wrapper.unmount();
	});

	it('shows the pan hint under Select, and not under camera mode or a drawing tool', async () => {
		const harness = await mountPlanEditorCanvas();
		activateTool(harness, 'select');
		await settle();
		expect(harness.wrapper.find('.rp-editor-pan-hint').text()).toBe(t('en', 'editor.hint.pan'));

		activateTool(harness, null);
		await settle();
		expect(harness.wrapper.find('.rp-editor-pan-hint').exists()).toBe(false);

		activateTool(harness, 'draw-polygon');
		await settle();
		expect(harness.wrapper.find('.rp-editor-pan-hint').exists()).toBe(false);
		harness.wrapper.unmount();
	});
});

describe('the scale sentence is a fact about a LOADED plan', () => {
	it('is withheld while the read has not settled', async () => {
		const harness = await mountPlanEditor({
			queries: { ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getPlan: () => new Promise(() => {}) },
		});
		expect(harness.wrapper.find('.rp-editor-scale').exists()).toBe(false);
		harness.unmount();
	});

	it('is withheld for a plan that does not resolve', async () => {
		const harness = await mountPlanEditor({ plan: null });
		expect(harness.wrapper.find('.rp-editor-scale').exists()).toBe(false);
		harness.unmount();
	});

	it('is withheld after a failed read', async () => {
		const harness = await mountPlanEditor({
			queries: {
				...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
				getPlan: () => Promise.resolve(err({ category: 'Persistence', code: 'plan.read-failed', message: 'boom' } as const)),
			},
		});
		expect(harness.wrapper.find('.rp-editor-scale').exists()).toBe(false);
		harness.unmount();
	});
});
