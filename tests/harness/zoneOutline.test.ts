// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { mountPlanEditorHarness } from './planEditor';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, resizeTo } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';

/**
 * BP-04 slice A2's chosen-corner list, scanned by axe at both widths — the shape
 * `roomResize.test.ts` and `roomNaming.test.ts` already use, pointed at the one dialog no
 * accessibility case reached. That gap was disclosed as unclosable because "the zone-outline
 * dialog is opened by no production control"; the reason was wrong, not the fact. Neither
 * sibling needs a production control either: this drives the `?outline` knob, exactly as
 * `roomResize.test.ts` drives `?resize=room`.
 *
 * **Read the ceiling narrowly, and it is narrower than `./axeOptions`'s three.** That module
 * disables `color-contrast`, `color-contrast-enhanced` and `target-size` because jsdom has no
 * rendering engine to measure any of the three, and the scan is over `leafEl` — the plugin's
 * own subtree, not the document — so the page-wide landmark rules never apply. Measured on top
 * of that: 21 rule families actually return a verdict here, `aria-allowed-attr`,
 * `aria-required-attr`, `aria-valid-attr-value`, `aria-roles`, `button-name`, `label`, `list`
 * and `listitem` among them — and `aria-hidden-focus` is NOT one of them. An `aria-hidden` on
 * a row's own button comes back `incomplete` rather than as a violation, because axe cannot
 * decide focusability without a layout engine, so a green run here does not rule that out.
 *
 * So the scan is live rather than vacuous, and it was proved so rather than assumed:
 * `aria-pressed` on the row's role-less `<span>` turns both cases red with
 * `aria-allowed-attr`. It is still not an accessibility conformance claim, and nothing here
 * has been run in a vault or against a screen reader.
 *
 * It is also the only thing inside `npm run check` that drives `?outline` at all — the knob's
 * `Number.parseInt` arm, its `chosen > 0` arm and its three `settleUntil` messages otherwise
 * run only during `npm run harness-shot`, which is outside the gate by design.
 */
describe('Zone outline harness', { timeout: HARNESS_SCAN_MS }, () => {
	it.each([1280, 460])('exposes an accessible chosen-corner list at %i px', async width => {
		installCanvas(); installResizeObserver();
		const { leafEl, view } = mountPlanEditorHarness(document.body, { outline: '1', select: 'harness-terrace' });
		resizeTo(sizedShellRoot(leafEl), width, 700);
		// The PRESSED row button, not the list: the list is on screen the moment the dialog
		// opens, so waiting on it would scan an unchosen state under a name promising a chosen
		// one — the same distinction `harness-shot.mjs` pins for the captures.
		await settleUntil(() => leafEl.querySelector('[data-rp-corner="choose"][aria-pressed="true"]') !== null, 'the chosen corner');
		expect(leafEl.querySelectorAll('[data-rp-corner-list] li')).toHaveLength(5);
		expect(leafEl.querySelector('[data-rp-corner-status]')?.textContent).toContain('Corner 1');
		expect((await axe.run(leafEl, runOptions)).violations).toEqual([]);
		await view.onClose();
	});
});
