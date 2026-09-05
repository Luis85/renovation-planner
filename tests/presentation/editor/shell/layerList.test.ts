/**
 * @vitest-environment jsdom
 *
 * `LayerList` is the two-entry catalogue's own view: one checkbox per `LayerEntry`, and —
 * on the one entry that carries one — the Set scale action Calibrate's only door now.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, runtimeOf } from '../../../helpers/editor';

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
	 * checkbox is disabled, and the Set scale action carries the SAME REASON but its OWN
	 * id now (design spec §2.9 gave Set scale a second reason — `editor.paused.reason` — that
	 * can differ from the checkbox's, so the two controls no longer share one span).
	 */
	it('renders the reference row disabled with its reason when there is no background, and the Set scale action aria-disabled with the same reason', async () => {
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
		const actionReasonId = action.attributes('aria-describedby');
		expect(actionReasonId).toBeTruthy();
		expect(actionReasonId).not.toBe(reasonId);
		expect(harness.wrapper.find(`#${actionReasonId}`).text()).toBe(t('en', 'editor.layer.reference-plan.none'));

		// aria-disabled, never disabled: the click still fires, so the template's own guard
		// is what withholds it, not the browser refusing a disabled control.
		await action.trigger('click');
		expect(runtimeOf(harness).activeToolId.value).not.toBe('calibrate');
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
