/**
 * @vitest-environment jsdom
 *
 * AD18 item 5's `Add` rail, scanned under the ceiling `accessibility.test.ts`'s header states;
 * `runOptions` is shared through `./axeOptions`. Mounted through `designerRig`, the real designer,
 * so the scan grades the markup a user gets rather than a fixture.
 *
 * **Why a file of its own when every other designer scan already covers this markup.** They scan
 * `rig.wrapper.element`, so the rail is inside all of them and a violation in it would redden one —
 * but every one of those cases stays green if the rail is never drawn at all, because none of them
 * asserts it is there. That is the half this file adds: the controls are FOUND first, then graded.
 *
 * Read the word "accessibility" no wider than `accessibility.test.ts`'s header allows, and note
 * that the three things this scan cannot say are missing for TWO different reasons rather than one.
 * Colour contrast and hit-target size are axe RULES, turned off in `runOptions` because jsdom has
 * no rendering engine to measure either (`LAYOUT_DEPENDENT_RULES` names exactly `color-contrast`,
 * `color-contrast-enhanced` and `target-size`). Whether a focus indicator is VISIBLE is not on that
 * list and never could be: axe has no rule for it, so no configuration here could enable it and
 * none disabled it. `accessibility.test.ts`'s header says "does NOT verify" for that reason, which
 * is the shape a claim takes when the mechanism is absent rather than switched off. None of the
 * three is verified anywhere in this repository. Task 3 gives the rail's tiles a visible label
 * under the icon (`styles/designer-add.css`), but each button's accessible name is still its
 * explicit `aria-label` rather than the visible text — the two are the same string
 * (`DesignerToolButton`'s WCAG 2.5.3 pairing), so which one axe would compute from is not a
 * distinction this scan needs to make; the attribute is checkable here, and how the glyph and the
 * label beside it READ is not.
 */
import axe from 'axe-core';
import { expect, it } from 'vitest';
import { HARNESS_SCAN_MS, runOptions } from './axeOptions';
import { t } from '../../src/presentation/i18n/strings';
import { DESIGNER_TOOL_LABELS } from '../../src/presentation/designer/tools/registerDesignerTools';
import { toiletShape } from '../helpers/assetShapes';
import { designerRig } from '../helpers/designerRig';

it('reports no violations for the Add rail stacked above the Parts panel', { timeout: HARNESS_SCAN_MS }, async () => {
	// A shape, so the Parts panel below the rail draws real rows rather than its empty line: the
	// two panels sharing one column is what AD18-R5 built, and the scan should see both of them.
	const rig = await designerRig({ shape: toiletShape() });
	try {
		const shapes = rig.wrapper.findAll('.rp-designer-add-shapes button');

		// Found before graded — see the header. The named door is asserted by its accessible name
		// rather than by its class, because the name is what the scan below is about.
		expect(shapes.length).toBeGreaterThan(0);
		expect(shapes.map((button) => button.attributes('aria-label'))).toContain(t('en', DESIGNER_TOOL_LABELS['draw-rect']));
		expect(rig.wrapper.find('.rp-designer-add .rp-designer-start-preset').exists()).toBe(true);

		/**
		 * AD08-R1 blesses the Parts panel as C05's overlap alternative *"reachable without a
		 * modifier"*, and its roving tabindex is what makes that one tab stop rather than one per
		 * part. The `Add` section sits directly above it now, so the thing to check is that the
		 * panel below still has exactly ONE — a second stop would mean the rail had reached into
		 * it, and an interactive rail above a roving list is precisely where that could happen.
		 */
		const stops = rig.wrapper.findAll('.rp-designer-part-list [tabindex="0"]');

		expect(stops).toHaveLength(1);

		const results = await axe.run(rig.wrapper.element as HTMLElement, runOptions);

		expect(results.violations).toEqual([]);
	} finally {
		rig.unmount();
	}
});
