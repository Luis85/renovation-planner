/**
 * @vitest-environment jsdom
 *
 * `LayerList` is the two-entry catalogue's own view: one checkbox per `LayerEntry`, and —
 * on the one entry that carries one — the Set scale action Calibrate's only door now.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../../helpers/editor';

describe('LayerList, mounted inside the editor', () => {
	it('renders one checkbox per catalogue entry, labelled, and toggles the Konva layer it stands for', async () => {
		const harness = await mountPlanEditorCanvas();

		const boxes = harness.wrapper.findAll('.rp-layer-list input[type="checkbox"]');
		expect(boxes).toHaveLength(2);

		await boxes[1].setValue(false);

		expect(useWorkspaceStore().layerVisibility.zone).toBe(false);
	});

	/**
	 * `FIXTURE_PLAN.background` is `null`, so the reference row is `supported-empty`: its
	 * checkbox is disabled, and `layerCatalogue`'s own formula answers Set scale's reason
	 * with the SAME KEY the row already carries ("no background" beats "paused" while there
	 * is nothing to calibrate against either way) — so Set scale points its `aria-describedby`
	 * at the row's OWN reason element rather than rendering a second span with identical
	 * text. A first capture of this panel found that second span duplicating the sentence
	 * under one row, read as a copy-paste error; this asserts the sentence appears ONCE.
	 */
	it('renders the reference row disabled with its reason when there is no background, and reuses that SAME element for Set scale rather than duplicating the sentence', async () => {
		const harness = await mountPlanEditorCanvas();

		const boxes = harness.wrapper.findAll('.rp-layer-list input[type="checkbox"]');
		const reference = boxes[0];
		expect(reference.attributes('disabled')).toBeDefined();

		const reasonId = reference.attributes('aria-describedby');
		expect(reasonId).toBeTruthy();
		expect(harness.wrapper.find(`#${reasonId}`).text()).toBe(t('en', 'editor.layer.reference-plan.none'));

		const action = harness.wrapper.find('button[data-rp-action="set-scale"]');
		expect(action.attributes('aria-disabled')).toBe('true');
		expect(action.attributes('disabled')).toBeUndefined();
		// The SAME id as the checkbox's own reason, not a second element carrying the
		// identical sentence: the accessible description is unchanged, and the visible text
		// no longer lives in two places.
		expect(action.attributes('aria-describedby')).toBe(reasonId);
		// Scoped to the panel itself: the whole mounted tree can carry the SAME sentence a
		// second time for an unrelated reason (design spec §2.9's shared hidden paused-reason
		// sentence lives elsewhere in the leaf and happens to translate identically for some
		// keys) — the finding is about what THIS component renders, not the whole document.
		const sentence = t('en', 'editor.layer.reference-plan.none');
		expect(harness.wrapper.find('.rp-layer-list').text().split(sentence).length - 1).toBe(1);

		// aria-disabled, never disabled: the click still fires, so the template's own guard
		// is what withholds it, not the browser refusing a disabled control.
		await action.trigger('click');
		expect(runtimeOf(harness).activeToolId.value).not.toBe('calibrate');
	});

	/**
	 * The two reasons DO differ once a background exists and writes are blocked — §2.9's
	 * `editor.paused.reason` against a row whose own reason is absent (`entry.reasonKey` is
	 * `null` once there IS a background) — so this is the one case the per-action span is
	 * actually FOR, and the sentence still appears exactly once, from that span alone.
	 */
	it('renders its OWN reason, once, when a background exists but writes are blocked', async () => {
		const harness = await mountPlanEditorCanvas({
			plan: { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } },
		});
		useProjectStore(harness.pinia).stale = true;
		await settle();

		const boxes = harness.wrapper.findAll('.rp-layer-list input[type="checkbox"]');
		// The checkbox itself carries no reason here — `entry.reasonKey` is null once a
		// background exists — so nothing under it duplicates the action's own sentence.
		expect(boxes[0].attributes('aria-describedby')).toBeUndefined();

		const action = harness.wrapper.find('button[data-rp-action="set-scale"]');
		expect(action.attributes('aria-disabled')).toBe('true');
		const actionReasonId = action.attributes('aria-describedby');
		expect(actionReasonId).toBeTruthy();
		expect(harness.wrapper.find(`#${actionReasonId}`).text()).toBe(t('en', 'editor.paused.reason'));

		// Scoped to the panel: the ROOT also renders this exact sentence, once, hidden,
		// pointed at by every paused control's `aria-describedby` across the whole leaf
		// (design spec §2.9) — a second, deliberate rendering outside this component, which a
		// whole-document count would wrongly read as the same duplication bug.
		const sentence = t('en', 'editor.paused.reason');
		expect(harness.wrapper.find('.rp-layer-list').text().split(sentence).length - 1).toBe(1);
	});

	it('Set scale activates the calibrate tool when a background exists', async () => {
		const harness = await mountPlanEditorCanvas({
			plan: { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } },
		});

		const action = harness.wrapper.find('button[data-rp-action="set-scale"]');
		expect(action.attributes('aria-disabled')).toBeUndefined();

		await action.trigger('click');

		expect(runtimeOf(harness).activeToolId.value).toBe('calibrate');
	});
});
