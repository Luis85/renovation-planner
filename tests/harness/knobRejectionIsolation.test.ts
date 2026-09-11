// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { sizedShellRoot } from '../helpers/editor';

/**
 * Proves the fix for F1 item 3 (the general shape behind the old M11 flake): a fire-and-forget
 * knob that genuinely fails must fail the case that started it, not escape as a process-level
 * unhandled rejection naming no test.
 *
 * `selectMultipleOnceReady` (`./multiSelectionKnob.ts`) throws "No selection row for <id>" when
 * an id it is asked to select is not on the canvas — a REAL knob failure, reached through the
 * real `?select` comma form every M11 case already uses, not a stand-in built for this test.
 */
describe('a fire-and-forget knob failure', () => {
	it('replays through view.onClose as this case failure, never as an unhandled rejection', async () => {
		installCanvas();
		installResizeObserver();

		const escaped: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => escaped.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);

		try {
			const { leafEl, view } = mountPlanEditorHarness(document.body, {
				select: 'does-not-exist,harness-kitchen',
			});
			resizeTo(sizedShellRoot(leafEl), 1280, 900);

			await expect(view.onClose()).rejects.toThrow('No selection row for does-not-exist');
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}

		// Not redundant with the assertion above: before the fix `onClose` never looked at the
		// knob, so it resolved fine and this SAME rejection escaped later, off the process,
		// naming no test. This is what actually tells "replayed" apart from "leaked".
		expect(escaped).toEqual([]);
	});
});
