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
import { click, rig, toolbarButton } from '../../helpers/planEditorRig';
import { settle } from '../../helpers/editor';
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
		// And the indicator does NOT claim a write failed, because nothing was written — which
		// is the other half, and the one a "just toast everything" fix would break.
		expect(saveStateLabel(harness).classList.contains('rp-save-state-save-error')).toBe(false);

		harness.unmount();
	});
});
