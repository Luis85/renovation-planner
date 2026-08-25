/**
 * @vitest-environment jsdom
 *
 * Design slice 15's first real caller: the calibration gesture, which slice 7 built and
 * slice 8 shipped unreachable. Two dialogs and a command, in that order.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import KnownDistanceForm from '../../../../src/presentation/editor/shell/KnownDistanceForm.vue';
import { useDialogStore } from '../../../../src/presentation/dialogs/dialog-store';
import { t } from '../../../../src/presentation/i18n/strings';
import { ok } from '../../../../src/core/result/Result';
import type { CalibratePlanInput } from '../../../../src/application/commands/plan/ReversibleCalibratePlan';
import {
	unavailablePlanEditorCommands,
	type PlanEditorCommandServices,
} from '../../../../src/presentation/editor/planEditorCommands';
import { mountPlanEditor, settle, type EditorHarness } from '../../../helpers/editor';
import { click as clickOnCanvas, toolbarButton } from '../../../helpers/planEditorRig';

describe('KnownDistanceForm', () => {
	it('shows what was measured on the plan, so the user knows what they are naming', () => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 1234.5 } });

		expect(wrapper.text()).toContain('1235');
	});

	it('emits the millimetres the user typed', async () => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 100 } });

		await wrapper.find('input').setValue('2400');
		await wrapper.find('form').trigger('submit');

		const emitted = wrapper.emitted('submit');
		expect(emitted).toEqual([[2400]]);
		// `toEqual` does not check types (`'2400' == 2400` would pass it too, if the
		// component had forgotten to parse). The call-site guard `supplyKnownDistance`
		// makes on this same value is a `typeof` check, so the proof reads the same way.
		expect(typeof emitted?.[0]?.[0]).toBe('number');
	});

	/**
	 * The tool refuses a non-positive or non-finite distance anyway, so this is the SECOND
	 * of two checks rather than the only one — but a form that submits an empty string
	 * makes the user press a button that does nothing, which is a worse failure than a
	 * disabled control.
	 */
	it.each([
		['', 'empty'],
		['0', 'zero'],
		['-5', 'negative'],
		['abc', 'not a number'],
		['1e400', 'infinite'],
	])('refuses to submit %s (%s)', async (typed) => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 100 } });

		await wrapper.find('input').setValue(typed);
		await wrapper.find('form').trigger('submit');

		expect(wrapper.emitted('submit')).toBeUndefined();
	});
});

/** Presses a toolbar button by its label — Task 12's own `setToolByLabel`. */
function setToolByLabel(harness: EditorHarness, label: string): void {
	toolbarButton(harness, label).click();
}

/**
 * A down+up pair at one canvas point — the house spelling from `planEditorRig.ts`'s own
 * `click`, wrapped so a call site names the harness rather than reaching into it.
 */
function click(harness: EditorHarness, point: { x: number; y: number }): void {
	const canvas = harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	clickOnCanvas(canvas, point.x, point.y);
}

/**
 * The end-to-end wiring (Task 12): the tool registered in `ToolManager`, its toolbar row,
 * and the two dialogs it opens going through the mounted leaf's OWN `DialogHost`/store —
 * driven with a real click pair, never a bare `pointerdown`.
 */
describe('the calibrate tool in a mounted editor', () => {
	it('offers Calibrate in the toolbar', async () => {
		const harness = await mountPlanEditor();

		const labels = harness.wrapper.findAll('.rp-editor-tool-button').map((b) => b.text());

		expect(labels).toContain(t('en', 'editor.toolbar.calibrate'));
		harness.unmount();
	});

	/**
	 * Two clicks, each a real down+up pair on the primary button. A simulated stream has to
	 * obey the grammar of the device it stands in for — a bare `pointerdown` with no `up`
	 * is an input no mouse can produce, and a rig that spelled it that way already
	 * certified one gesture test against a state the tool never reaches.
	 */
	it('asks for a distance after two clicks and dispatches the calibration', async () => {
		const harness = await mountPlanEditor({ zones: [] });
		const store = useDialogStore(harness.pinia);
		setToolByLabel(harness, t('en', 'editor.toolbar.calibrate'));

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle();

		expect(store.current?.kind).toBe('form');
		expect(harness.wrapper.find('.rp-dialog input').exists()).toBe(true);

		harness.unmount();
	});

	/**
	 * The rest of the gesture: submitting the form resolves `supplyKnownDistance`, and the
	 * tool dispatches through `createCommand()` and `context.commandDispatcher.run` — the
	 * ONE decorated dispatcher every gesture in this leaf funnels through. Asserted against
	 * a real `PlanEditorCommandServices.calibratePlan` spy, so this is the input the
	 * command actually receives, not a stand-in for it.
	 */
	it('submits the distance and dispatches through the one command dispatcher', async () => {
		const calls: CalibratePlanInput[] = [];
		const commands: PlanEditorCommandServices = {
			...unavailablePlanEditorCommands(),
			calibratePlan: () => ({
				execute: (input) => {
					calls.push(input);
					return Promise.resolve(ok(undefined));
				},
				undo: () => Promise.resolve(ok(undefined)),
			}),
		};
		const harness = await mountPlanEditor({ zones: [], commands });
		setToolByLabel(harness, t('en', 'editor.toolbar.calibrate'));

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle();

		await harness.wrapper.find('.rp-dialog input').setValue('2400');
		await harness.wrapper.find('.rp-dialog form').trigger('submit');
		await settle();

		expect(calls).toHaveLength(1);
		expect(calls[0].knownDistance).toBe(2400);
		expect(harness.wrapper.find('.rp-dialog').exists()).toBe(false);

		harness.unmount();
	});

	/**
	 * The gate, driven through the real editor rather than the tool alone: a plan WITH
	 * zones gets the confirmation first, and declining it never reaches the distance form.
	 */
	it('confirms before recalibrating a plan that has zones, and stops on a decline', async () => {
		const harness = await mountPlanEditor(); // the default fixture has zones
		const store = useDialogStore(harness.pinia);
		setToolByLabel(harness, t('en', 'editor.toolbar.calibrate'));

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle();

		expect(store.current?.kind).toBe('confirm');

		await harness.wrapper.find('[data-rp-action="cancel"]').trigger('click');
		await settle();

		expect(store.current).toBeNull();
		harness.unmount();
	});
});
