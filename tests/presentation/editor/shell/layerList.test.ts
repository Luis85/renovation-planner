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
	 * checkbox is disabled, and both it and the Set scale action point at the same reason.
	 */
	it('renders the reference row disabled with its reason when there is no background, and the Set scale action disabled with the same reason', async () => {
		const harness = await mountPlanEditorCanvas();

		const boxes = harness.wrapper.findAll('.rp-layer-list input[type="checkbox"]');
		const reference = boxes[0];
		expect(reference.attributes('disabled')).toBeDefined();

		const reasonId = reference.attributes('aria-describedby');
		expect(reasonId).toBeTruthy();
		expect(harness.wrapper.find(`#${reasonId}`).text()).toBe(t('en', 'editor.layer.reference-plan.none'));

		const action = harness.wrapper.find('button[data-rp-action="set-scale"]');
		expect(action.attributes('disabled')).toBeDefined();
		expect(action.attributes('aria-describedby')).toBe(reasonId);
	});

	it('Set scale activates the calibrate tool when a background exists', async () => {
		const harness = await mountPlanEditorCanvas({
			plan: { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } },
		});

		const action = harness.wrapper.find('button[data-rp-action="set-scale"]');
		expect(action.attributes('disabled')).toBeUndefined();

		await action.trigger('click');

		expect(runtimeOf(harness).activeToolId.value).toBe('calibrate');
	});
});
