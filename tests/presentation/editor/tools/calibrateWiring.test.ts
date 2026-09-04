/**
 * @vitest-environment jsdom
 *
 * Design slice 15's first real caller: the calibration gesture, which slice 7 built and
 * slice 8 shipped unreachable. Two dialogs and a command, in that order.
 */
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { mount } from '@vue/test-utils';
import KnownDistanceForm from '../../../../src/presentation/editor/shell/KnownDistanceForm.vue';
import { useDialogStore } from '../../../../src/presentation/dialogs/dialog-store';
import { ok } from '../../../../src/core/result/Result';
import type { CalibratePlanInput } from '../../../../src/application/commands/plan/ReversibleCalibratePlan';
import {
	unavailablePlanEditorCommands,
	type PlanEditorCommandServices,
} from '../../../../src/presentation/editor/planEditorCommands';
import type { PlanDto } from '../../../../src/presentation/read-models/PlanDto';
import { mountPlanEditor, settle, type EditorHarness } from '../../../helpers/editor';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { actionButton, click as clickOnCanvas } from '../../../helpers/planEditorRig';

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

	/**
	 * **`aria-disabled`, never `:disabled` — `FormDialog`'s categorical invariant, and this
	 * button was its one violator inside a dialog.**
	 *
	 * It could not reproduce the focus defect that invariant exists for: `parsed` derives only
	 * from the input, so the button cannot go enabled→disabled while IT holds focus, and
	 * `FormDialog` renders Cancel unconditionally so the Tab trap is never emptied. It was a
	 * latent violation rather than a live one — which is exactly why nothing failed for it, and
	 * why an invariant with one known exception is a rule the next reader stops believing.
	 *
	 * Asserted on BOTH halves. The attribute alone would pass against a build that swapped it
	 * and lost the refusal; the emit alone would pass against the `:disabled` this replaced,
	 * since a disabled button submits nothing either. `onSubmit`'s own `parsed === null` guard
	 * is what makes the inoperative-but-focusable button inert.
	 */
	it('marks its submit inoperative rather than disabled, and submits nothing when pressed', async () => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 100 } });
		const button = wrapper.find('button[type="submit"]');

		expect(button.attributes('aria-disabled')).toBe('true');
		expect(button.attributes('disabled')).toBeUndefined();

		await button.trigger('click');
		await wrapper.find('form').trigger('submit');

		expect(wrapper.emitted('submit')).toBeUndefined();
	});
});

/**
 * Set scale, on the reference-plan row of the layer list (`LayerList.vue`), is Calibrate's
 * only door now — the toolbar that used to hold it is gone. The button is disabled without a
 * background (`layerCatalogue.test.ts` and `layerList.test.ts` own that gate), so every case
 * below that activates the tool mounts a plan carrying one.
 */
async function activateCalibrate(harness: EditorHarness): Promise<void> {
	await harness.wrapper.find('button[data-rp-action="set-scale"]').trigger('click');
}

/** A plan WITH a reference background, since Set scale refuses to activate without one. */
const PLAN_WITH_BACKGROUND: PlanDto = {
	...FIXTURE_PLAN,
	background: { path: 'Plans/g.png', kind: 'image' },
};

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
 * The refusal bundle with a RECORDING `calibratePlan` over it — three cases below need
 * exactly this, and each had its own copy. A fourth copy is how the four drift apart, and
 * what every case here actually asserts on is `calls`, so the recorder is the fixture rather
 * than incidental setup.
 */
function recordingCommands(): {
	readonly calls: CalibratePlanInput[];
	readonly commands: PlanEditorCommandServices;
} {
	const calls: CalibratePlanInput[] = [];
	return {
		calls,
		commands: {
			...unavailablePlanEditorCommands(),
			calibratePlan: () => ({
				execute: (input) => {
					calls.push(input);
					return Promise.resolve(ok('wrote'));
				},
				undo: () => Promise.resolve(ok('wrote')),
			}),
		},
	};
}

/**
 * The end-to-end wiring (Task 12): the tool registered in `ToolManager`, and the two dialogs
 * it opens going through the mounted leaf's OWN `DialogHost`/store — driven with a real click
 * pair, never a bare `pointerdown`.
 *
 * Every case below activates the tool through the layer list's Set scale button
 * (`activateCalibrate`), the door Task 14's layer catalogue gave it — the toolbar this tool
 * used to be reached through is gone since Task 13.
 */
describe('the calibrate tool in a mounted editor', () => {
	/**
	 * Two clicks, each a real down+up pair on the primary button. A simulated stream has to
	 * obey the grammar of the device it stands in for — a bare `pointerdown` with no `up`
	 * is an input no mouse can produce, and a rig that spelled it that way already
	 * certified one gesture test against a state the tool never reaches.
	 */
	it('asks for a distance after two clicks', async () => {
		const harness = await mountPlanEditor({ zones: [], plan: PLAN_WITH_BACKGROUND });
		const store = useDialogStore(harness.pinia);
		await activateCalibrate(harness);

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
	 *
	 * The two points are in the plan's CURRENT world units, not screen pixels — at the
	 * editor's default camera (`DEFAULT_VIEWPORT`, `zoom` 0.1, `pan` (-480,-480)),
	 * `screenToWorld` is `screen × 10 − 480` per axis. The clicks land at screen (0,0) and
	 * (100,0); a wiring that let screen coordinates through unconverted would produce
	 * `pointA: {x:0,y:0}` and `pointB: {x:100,y:0}` instead of the world points asserted
	 * below, so this case would fail exactly the way an unconverted wiring should.
	 */
	it('submits the distance and dispatches through the one command dispatcher', async () => {
		const { calls, commands } = recordingCommands();
		const harness = await mountPlanEditor({ zones: [], commands, plan: PLAN_WITH_BACKGROUND });
		await activateCalibrate(harness);

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle();

		await harness.wrapper.find('.rp-dialog input').setValue('2400');
		await harness.wrapper.find('.rp-dialog form').trigger('submit');
		await settle();

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual({
			planId: 'plan-ground',
			pointA: { x: -480, y: -480 },
			pointB: { x: 520, y: -480 },
			knownDistance: 2400,
		});
		expect(harness.wrapper.find('.rp-dialog').exists()).toBe(false);

		// Proves this ran through the WRAPPED dispatcher specifically: only
		// `wrappedDispatcher` moves the reactive undo/redo flags the toolbar reads, so a
		// dispatch that bypassed it would leave Undo disabled with nothing else erroring.
		expect(actionButton(harness, 'Undo').disabled).toBe(false);

		harness.unmount();
	});

	/**
	 * The gate, driven through the real editor rather than the tool alone: a plan WITH
	 * zones gets the confirmation first, and declining it never reaches the distance form.
	 * A recorder on `calibratePlan` turns "stops" into an assertion rather than an
	 * inference from "no second dialog opened" — a decline that went on to dispatch
	 * anyway would still leave `store.current` `null` afterward, so the recorder is what
	 * a silently-broken decline would actually be caught by.
	 */
	it('confirms before recalibrating a plan that has zones, and stops on a decline', async () => {
		const { calls, commands } = recordingCommands();
		// The default fixture has zones; Set scale also needs it to have a background.
		const harness = await mountPlanEditor({ commands, plan: PLAN_WITH_BACKGROUND });
		const store = useDialogStore(harness.pinia);
		await activateCalibrate(harness);

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle();

		expect(store.current?.kind).toBe('confirm');

		await harness.wrapper.find('[data-rp-action="cancel"]').trigger('click');
		await settle();

		expect(store.current).toBeNull();
		expect(calls).toHaveLength(0);
		harness.unmount();
	});

	/**
	 * The primary path for every plan that already has zones — the sample project
	 * included — and the one no other case here drives end to end: confirm, THEN answer
	 * the distance form, THEN dispatch. It is also the only case that opens two dialogs in
	 * sequence against the real `DialogHost`/store stacking guard (`DialogStackingError`),
	 * since `pointerUp` dispatches `complete()` with no `.catch` — a microtask-ordering
	 * mistake between resolving the confirmation and opening the distance form would throw
	 * there uncaught, and only a case that actually crosses both awaits can catch it.
	 */
	it('confirms, then asks for a distance, and dispatches the calibration once both are answered', async () => {
		const { calls, commands } = recordingCommands();
		// The default fixture has zones; Set scale also needs it to have a background.
		const harness = await mountPlanEditor({ commands, plan: PLAN_WITH_BACKGROUND });
		const store = useDialogStore(harness.pinia);
		await activateCalibrate(harness);

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle();

		expect(store.current?.kind).toBe('confirm');
		await harness.wrapper.find('[data-rp-action="confirm"]').trigger('click');
		await settle();

		expect(store.current?.kind).toBe('form');
		await harness.wrapper.find('.rp-dialog input').setValue('2400');
		await harness.wrapper.find('.rp-dialog form').trigger('submit');
		await settle();

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual({
			planId: 'plan-ground',
			pointA: { x: -480, y: -480 },
			pointB: { x: 520, y: -480 },
			knownDistance: 2400,
		});
		expect(store.current).toBeNull();
		harness.unmount();
	});

	/**
	 * The VISUAL half, asserted on the Konva layer rather than on `RenderState`, because the
	 * walkthrough finding was literally "nothing is drawn": a field the tool sets that no
	 * renderer reads would satisfy every tool test and still leave the user staring at two
	 * clicks and a dialog with no idea which points were picked.
	 *
	 * A plan with NO zones, so nothing else is on that layer — no selection outline, no
	 * handles — and the counts belong to the segment alone. It is asserted while the distance
	 * form is still open, which is the state the segment exists for.
	 */
	it('draws the measured segment on the interaction layer while the prompt is open', async () => {
		const harness = await mountPlanEditor({ zones: [], plan: PLAN_WITH_BACKGROUND });
		await activateCalibrate(harness);

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle();

		expect(useDialogStore(harness.pinia).current?.kind).toBe('form');
		const interaction = harness.stage?.findOne<Konva.Layer>('.interaction');
		// The spine as its own `Line`, and the bars and ticks together on the one `Shape` that
		// paints them — a node per mark is what made this gesture unusably slow, so the count
		// here is deliberately a pair of nodes and not a tally of marks. No circles at all: the
		// two endpoint dots this drew until the segment became a ruler said "vertex", which is
		// the one thing the marks are not. What the marks ARE for a given length belongs to
		// `interactionLayer.test.ts` and `rulerGeometry.test.ts`; what this wiring case owns is
		// that the segment is on the layer AT ALL while the prompt is open.
		expect(interaction?.find('Line')).toHaveLength(1);
		expect(interaction?.findOne('.measurement-marks')).toBeDefined();
		expect(interaction?.find('Circle')).toHaveLength(0);

		harness.unmount();
	});

	/**
	 * The load-bearing claim `runtime.ts`'s `CalibrateTool` registration makes in comment
	 * form: both dialogs go through the LEAF's own store, so a calibration gesture in one
	 * split pane cannot trap another. Two independent harnesses share nothing but the
	 * module-level Konva/pdf.js globals — each gets its own Pinia — so driving the gesture
	 * in the first must leave the second's dialog store untouched.
	 */
	it('opens the confirmation only in the leaf that raised it, never in a second split pane', async () => {
		// The default fixture has zones; Set scale also needs it to have a background.
		const first = await mountPlanEditor({ plan: PLAN_WITH_BACKGROUND });
		const second = await mountPlanEditor();
		const secondStore = useDialogStore(second.pinia);
		await activateCalibrate(first);

		click(first, { x: 0, y: 0 });
		click(first, { x: 100, y: 0 });
		await settle();

		expect(useDialogStore(first.pinia).current?.kind).toBe('confirm');
		expect(secondStore.current).toBeNull();

		first.unmount();
		second.unmount();
	});
});
