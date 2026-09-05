// @vitest-environment jsdom
/**
 * Task 20's additions to the status bar: whether the plan's scale is set, the pointer
 * readout withdrawing under the constrained layout (M16), and the pan-override reminder
 * beside the angle-constraint hint this file's sibling case already covers.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { err } from '../../../../src/core/result/Result';
import { t } from '../../../../src/presentation/i18n/strings';
import type { ToolId } from '../../../../src/presentation/editor/tools/editor-tool';
import StatusBar from '../../../../src/presentation/editor/shell/StatusBar.vue';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';
import { mountPlanEditor, mountPlanEditorCanvas, settle } from '../../../helpers/editor';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from '../../../helpers/planFixtures';
import { activateTool } from '../../../helpers/planEditorRig';

/**
 * `StatusBar` reads `useProjectStore().stale` directly rather than through the runtime, so
 * it stays mountable standalone — the same guarantee the harness index relies on. No
 * `PlanEditorContext` and no full `mountPlanEditor` rig are needed for this one prop.
 */
function mountStatusBar(props: { activeToolId?: ToolId | null } = {}) {
	return mount(StatusBar, { props });
}

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

/**
 * SDD companion §2.9: while `runtime.writesBlocked` holds, the status bar says so beside the
 * pan hint (§2.5's derived label is the save-state indicator's own share of the same fact).
 * Mounted standalone — no `PlanEditorContext` — because the store this reads is Pinia's, not
 * the runtime's.
 */
describe('the paused hint', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('shows the paused hint while the store is stale', async () => {
		const wrapper = mountStatusBar({ activeToolId: 'select' });
		useProjectStore().stale = true;
		await nextTick();
		expect(wrapper.find('.rp-editor-paused-hint').text()).toBe(t('en', 'editor.hint.paused'));
	});

	it('shows no paused hint while the store is not stale', () => {
		const wrapper = mountStatusBar({ activeToolId: 'select' });
		expect(wrapper.find('.rp-editor-paused-hint').exists()).toBe(false);
	});

	/**
	 * jsdom resolves no CSS, so an emitted class the stylesheet does not declare would pass
	 * every case above unnoticed — the same hole `saveStateIndicator.test.ts` closes for the
	 * save-state marks, here for the class this hint carries alone.
	 */
	it('declares a rule the emitted paused-hint class can actually reach', () => {
		const css = readFileSync('styles/editor-status.css', 'utf8');
		// The selector line itself, not merely the class name — the surrounding docblock
		// quotes the same name in backticks, which `toContain` would match with nothing
		// underneath it.
		expect(css).toContain('.rp-editor-paused-hint {');
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
