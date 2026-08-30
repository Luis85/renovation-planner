/**
 * @vitest-environment jsdom
 *
 * A tool refuses in TWO places, and design slice 17's first draft routed both as one.
 *
 * `SelectTool`, `DrawPolygonTool` and `CalibrateTool` each report a refusal it made ITSELF —
 * geometry `createPolygon` declines, two calibration clicks in one spot — and, separately, a
 * refusal a DISPATCHED command produced. Only the second has passed through
 * `withSaveStateTracking`, so only the second is already carried by the save indicator.
 *
 * Binding both to `autosave-write` sent every pre-dispatch refusal to a save-state sink that
 * is deliberately a no-op, and binding both to `explicit-operation` reinstates the
 * double-report the slice set out to close. The tools carry two doors now, and this file is
 * what watches the BINDING — the tool-level suites already prove each door is called from the
 * right line.
 *
 * Both cases here are reachable through the real UI. The `createPolygon` arms are not: the
 * draw tool's `closesPolygon` refuses below three vertices and a move preserves its count, so
 * those arms need a non-finite coordinate and are exercised at tool level instead
 * (`drawPolygonTool.test.ts`, `selectTool.test.ts`). Said here rather than left implied,
 * because a reader looking for them in this file should know why they are elsewhere.
 *
 * Reported by a review bot, which was right about the shape and named two tools whose arms
 * turned out to be the hard-to-reach ones.
 */
import { describe, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { click, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import { mountPlanEditor, settle } from '../../helpers/editor';
import { flushPromises } from '@vue/test-utils';
import { err } from '../../../src/core/result/Result';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();

function saveStateLabel(harness: Awaited<ReturnType<typeof rig>>['harness']): HTMLElement {
	const label = harness.wrapper.find('.rp-save-state-label');
	if (!label.exists()) throw new Error('expected the save-state indicator to be mounted');
	return label.element as HTMLElement;
}

describe('a refusal the dispatcher never saw', () => {
	it('reaches the user, because no indicator ran to carry it', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const { harness } = await rig();

		toolbarButton(harness, 'Calibrate').click();
		await settle();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		// Two clicks in the same place. `CalibrateTool.complete` refuses a zero-length
		// measurement before it prompts and before it dispatches, so no command is built and
		// `withSaveStateTracking` never runs.
		const before = Notice.shown.length;
		click(canvas, 400, 300);
		click(canvas, 400, 300);
		await settle();

		// The whole point: something was said. Silence is the regression this file exists for.
		expect(Notice.shown.length).toBe(before + 1);
		// **And it is an ERROR, which `docs/tests/cases/Notices and save state.md` step 21 now
		// depends on**: that step uses this gesture as its error source while three warnings
		// stand, and only an error preempts a warning. A `Calculation` refusal at an
		// `explicit-operation` origin is `toastLevel`'s default arm; if that ever became a
		// warning the manual step would silently stop exercising preemption.
		//
		// Read off the RENDERED element rather than `Notice.shown`, which records the raw
		// message the constructor was handed and knows nothing about severity — the host applies
		// `rp-notice-<severity>` when it builds the body.
		expect(document.querySelector('.rp-notice-error')).not.toBeNull();
		// And the indicator does NOT claim a write failed, because nothing was written — which
		// is the other half, and the one a "just toast everything" fix would break.
		expect(saveStateLabel(harness).classList.contains('rp-save-state-save-error')).toBe(false);

		harness.unmount();
	});
});

describe('a DISPATCHED refusal the indicator resolved neutral', () => {
	it('still reaches the user, because no badge was raised for it either', async () => {
		// **"Dispatched" does not mean "the indicator has it".** `withSaveStateTracking` asks
		// `affectsSaveState`, and a PRE-WRITE category resolves NEUTRAL — no badge, because
		// nothing was written. A door assuming every dispatched refusal was carried by the
		// indicator sent these to a save-state sink that is deliberately a no-op, and they
		// reached nobody. Calibration's `degenerate-scale` is the reachable case in production;
		// a refusing `moveObject` is the cheapest way to drive the same shape here.
		activateNotices();
		Notice.shown.length = 0;
		const harness = await mountPlanEditor({
			commands: {
				...unavailablePlanEditorCommands(),
				moveObject: {
					execute: () =>
						Promise.resolve(
							err({
								category: 'Calculation',
								code: 'calibration.degenerate-scale',
								message: 'the derived scale collapsed',
							}),
						),
				},
			} as never,
		});
		await flushPromises();

		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');
		const before = Notice.shown.length;

		// The same gesture `zoneEditing.test.ts` drives: down inside the zone selects AND begins
		// the drag, up ends it. SelectTool builds a reversible move, dispatches it, and the
		// command refuses.
		toolbarButton(harness, 'Select').click();
		await settle();
		pointer(canvas, 'pointerdown', 200, 200);
		pointer(canvas, 'pointermove', 230, 200);
		pointer(canvas, 'pointermove', 260, 200);
		pointer(canvas, 'pointerup', 260, 200);
		await settle();

		expect(Notice.shown.length).toBe(before + 1);
		expect(document.querySelector('.rp-notice-error')).not.toBeNull();

		harness.wrapper.unmount();
	});
});
