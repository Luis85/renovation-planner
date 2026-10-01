/**
 * @vitest-environment jsdom
 *
 * The designer's **Reference** tab, scanned with the tab actually SELECTED — under the ceiling
 * `accessibility.test.ts`'s header states, with `runOptions` shared through `./axeOptions` rather
 * than a second copy of the rules this suite cannot honestly grade.
 *
 * **This file exists because every other accessibility file scans that panel and grades nothing in
 * it.** `DesignerInspector`'s `activeTab` defaults to `'object'` and the panels are `v-show`, so
 * the Reference panel carries `display: none` in every scan those files perform — and axe skips a
 * CSS-hidden subtree. No `accessibility*.test.ts` selects the tab. So AD18 item 7's `<ol>`/`<li>`/
 * `aria-current="step"`/visually-hidden markup — the most new ARIA the trace-checklist card added —
 * sat entirely outside the gate that caught the Plan Editor's three role-less `aria-label`s.
 *
 * **The second case is what stops this file from being the same mistake in a new place.** An
 * instrument that reaches nothing looks exactly like a clean tree, and a scan of a hidden subtree
 * reports zero violations however broken the markup is. So it plants a real violation on a
 * checklist row and asserts BOTH halves: the default Object tab does not see it — which is the gap
 * above, demonstrated rather than described — and selecting Reference does.
 *
 * Mounted through `designerRig`, the real designer, so what is graded is the markup a user gets.
 */
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';
import { t } from '../../src/presentation/i18n/strings';
import { toiletShape } from '../helpers/assetShapes';
import { settle } from '../helpers/editor';
import { designerRig } from '../helpers/designerRig';

/**
 * The Reference tab, found by its WORDS rather than by index. `designerInspectorTabs.test.ts` owns
 * the assertion that there are exactly two and which is which; this file only has to reach one,
 * and an index would go on reaching a tab silently if the order ever changed.
 */
function referenceTab(root: HTMLElement): HTMLButtonElement {
	const label = t('en', 'designer.inspector.tab.reference');
	const tab = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((candidate) => candidate.textContent?.trim() === label);
	if (tab === undefined) throw new Error(`no tab labelled ${label}`);
	return tab;
}

function panelOf(root: HTMLElement, tab: HTMLButtonElement): HTMLElement {
	const id = tab.getAttribute('aria-controls');
	const panel = id === null ? null : root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
	if (panel === null) throw new Error('the Reference tab controls no panel');
	return panel;
}

/**
 * An `aria-*` attribute that does not exist, which is what axe's `aria-valid-attr` reports as a
 * VIOLATION.
 *
 * **A dangling `aria-labelledby` was tried first and is refused here rather than silently
 * replaced.** Measured: with the panel shown, axe reported nothing for it — that rule
 * (`aria-valid-attr-value`) answers `incomplete` for a reference to a missing id, since the target
 * may be added later, and `incomplete` is not `violations`. A probe that lands in the wrong bucket
 * would have made this case red for a reason that has nothing to do with the gap it is about.
 */
const BOGUS_ARIA = 'aria-rp-not-a-real-attribute';

const violationTargets = (results: axe.AxeResults): string[] =>
	results.violations.flatMap((violation) => violation.nodes.flatMap((node) => node.html));

describe('the designer’s Reference tab', { timeout: HARNESS_SCAN_MS }, () => {
	/**
	 * Both states the panel has, because they are different markup and only one of them was ever
	 * the card's subject: with a sheet the facts block and the guide draw together, and with none
	 * the guide is the whole panel — the state that used to be empty.
	 */
	it.each([[true], [false]])('reports no violations with the guide visible (sheet: %s)', async (background) => {
		const rig = await designerRig({ shape: toiletShape(), background });
		try {
			const root: HTMLElement = rig.wrapper.element as HTMLElement;
			const tab = referenceTab(root);
			tab.click();
			await settle();

			// The scan is worthless if the panel is still hidden or empty, so both are asserted
			// before it rather than inferred from a clean result afterwards.
			const panel = panelOf(root, tab);
			expect(panel.style.display).not.toBe('none');
			expect(panel.querySelectorAll('.rp-designer-trace-step')).toHaveLength(5);
			expect(panel.querySelectorAll('[aria-current="step"]')).toHaveLength(1);

			const results = await axe.run(root, runOptions);

			expect(results.violations).toEqual([]);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **The instrument, checked against a planted defect — and the gap this file closes, shown.**
	 *
	 * One mount, one planted violation, two scans. The first is what every other
	 * `accessibility*.test.ts` performs: default tab, Reference panel at `display: none`, and axe
	 * reports NOTHING about markup that is plainly broken. The second selects the tab and the same
	 * defect is reported.
	 *
	 * So this case fails in both directions a future edit could break it: revert the tab selection
	 * and the second half goes red, and make the panels `v-if`-mounted-always or otherwise visible
	 * by default and the first half goes red with a reason to re-read this docblock.
	 */
	it('grades the checklist only once the tab is selected, and not before', async () => {
		const rig = await designerRig({ shape: toiletShape(), background: true });
		try {
			const root: HTMLElement = rig.wrapper.element as HTMLElement;
			const tab = referenceTab(root);
			const row = panelOf(root, tab).querySelector('.rp-designer-trace-step');
			if (row === null) throw new Error('the Reference panel drew no checklist to plant on');
			row.setAttribute(BOGUS_ARIA, 'true');

			const hidden = await axe.run(root, runOptions);
			expect(violationTargets(hidden).filter((html) => html.includes(BOGUS_ARIA))).toEqual([]);

			tab.click();
			await settle();
			// The probe has to still be there, or the second half would go red about a re-render
			// rather than about what axe can see.
			expect(row.hasAttribute(BOGUS_ARIA)).toBe(true);
			const shown = await axe.run(root, runOptions);

			expect(violationTargets(shown).filter((html) => html.includes(BOGUS_ARIA))).toHaveLength(1);
		} finally {
			rig.unmount();
		}
	});
});
