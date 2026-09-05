// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { t } from '../../../src/presentation/i18n/strings';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import {
	mountPlanEditorCanvas,
	runtimeOf,
	settle,
	type CanvasHarness,
	type EditorHarness,
} from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';
import { ZONE_A_DTO, actionButton, click, rig } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import EmptyState from '../../../src/presentation/components/EmptyState.vue';

/**
 * Design spec §2.9: every write control pauses while `runtime.writesBlocked` (a computed
 * over `ProjectStore.stale`) is true, and says why through ONE hidden sentence
 * (`runtime.pausedReasonId`) every paused control's `aria-describedby` names.
 *
 * `aria-disabled`, never `:disabled` — the add-room plan's own rule, restated here because
 * this is the task that applies it everywhere: a paused control stays focusable so its
 * reason can still be read.
 *
 * `zones: [ZONE_A_DTO]` rather than `FIXTURE_ZONES`: the brief's own snippet selects
 * `'zone-a'`, which is `planEditorRig.ts`'s fixture id and not one of `FIXTURE_ZONES`'s
 * (`zone-kitchen`/`zone-terrace`) — `defaultPlanEditorCommands` (which the snippet also
 * names) is not exported from `tests/helpers/editor.ts` either. Handing `mountPlanEditorCanvas`
 * a zones list containing `ZONE_A_DTO` reaches the same state through the harness's own
 * public surface: `zoneInspectorAnswering` resolves `'zone-a'` from whatever `zones` names.
 */
async function stalePane(select = false): Promise<CanvasHarness> {
	const harness = await mountPlanEditorCanvas({ zones: [ZONE_A_DTO] });
	if (select) useSelectionStore(harness.pinia).select(['zone-a' as never]);
	useProjectStore(harness.pinia).stale = true;
	await settle();
	return harness;
}

/** The text of the reason element a control's `aria-describedby` names — its LAST id, since
 * a control near the end of this task's chain names both a validity reason and the paused
 * one, and the paused sentence is always the one appended last. */
function reasonOf(harness: EditorHarness, el: ReturnType<EditorHarness['wrapper']['find']>): string {
	const describedBy = el.attributes('aria-describedby');
	if (describedBy === undefined) throw new Error('expected an aria-describedby');
	const id = describedBy.split(' ').at(-1) as string;
	return harness.wrapper.find(`#${id}`).text();
}

describe('write controls while the floor is stale', () => {
	it('renders ONE paused-reason sentence, hidden, with the runtime’s id', async () => {
		const harness = await stalePane();

		const reasons = harness.wrapper.findAll(`#${runtimeOf(harness).pausedReasonId}`);
		expect(reasons).toHaveLength(1);
		expect(reasons[0].classes()).toContain('rp-visually-hidden');
		expect(reasons[0].text()).toBe(t('en', 'editor.paused.reason'));
	});

	it('Add menu entries are aria-disabled with the reason, and activating one does nothing', async () => {
		const harness = await stalePane();

		await harness.wrapper.find('button[data-rp-action="add"]').trigger('click');
		await settle();
		const room = harness.wrapper.find('[data-rp-entry="room"]');
		expect(room.attributes('aria-disabled')).toBe('true');
		expect(room.attributes('disabled')).toBeUndefined();
		expect(reasonOf(harness, room)).toBe(t('en', 'editor.paused.reason'));

		await room.trigger('click');
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('the Room Inspector’s Delete, assign and override fields are paused with the reason', async () => {
		const harness = await stalePane(true);

		for (const sel of [
			'.rp-editor-inspector-delete',
			'.rp-editor-requirement-assign button',
			'input[data-field="quantity"]',
			'input[data-field="cost"]',
		]) {
			const el = harness.wrapper.find(sel);
			// The override fields exist only with a requirement row, which this fixture has
			// none of — seeded separately below, against the real rig.
			if (!el.exists()) continue;
			expect(el.attributes('aria-disabled')).toBe('true');
			expect(el.attributes('disabled')).toBeUndefined();
			expect(reasonOf(harness, el)).toBe(t('en', 'editor.paused.reason'));
		}
	});

	it('Delete while paused opens no dialog', async () => {
		const harness = await stalePane(true);

		await harness.wrapper.find('.rp-editor-inspector-delete').trigger('click');
		await settle();

		expect(useDialogStore(harness.pinia).current).toBeNull();
	});

	it('Set scale is paused with the paused reason even when the plan HAS a background', async () => {
		const harness = await mountPlanEditorCanvas({
			plan: { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } },
		});
		useProjectStore(harness.pinia).stale = true;
		await settle();

		const set = harness.wrapper.find('button[data-rp-action="set-scale"]');
		expect(set.attributes('aria-disabled')).toBe('true');
		expect(reasonOf(harness, set)).toBe(t('en', 'editor.paused.reason'));
	});

	it('the no-rooms empty state action is paused', async () => {
		const harness = await mountPlanEditorCanvas({
			zones: [],
			plan: { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } },
		});
		useProjectStore(harness.pinia).stale = true;
		await settle();

		const action = harness.wrapper.find('.rp-empty-state__action');
		expect(action.attributes('aria-disabled')).toBe('true');

		await action.trigger('click');
		expect(runtimeOf(harness).activeToolId.value).toBe('select');

		// `EmptyState`'s own `@click` ternary already withholds the emit while
		// `actionDisabled`, so the click above never reaches `onEmptyStateAction`'s OWN guard
		// at all — its `if (runtime.writesBlocked.value) return;` is a second door, and this
		// is what drives it directly: `$emit` bypasses the child's click gate the way a
		// future caller of the same event could.
		await harness.wrapper.findComponent(EmptyState).vm.$emit('action');
		await settle();
		expect(runtimeOf(harness).activeToolId.value).toBe('select');
	});

	it('the new-room Create and the banner Finish are paused with BOTH reasons described', async () => {
		const harness = await stalePane();
		runtimeOf(harness).setTool('draw-room');
		await settle();

		for (const sel of ['button.rp-new-room__create', 'button.rp-task-banner__finish']) {
			const el = harness.wrapper.find(sel);
			expect(el.attributes('aria-disabled')).toBe('true');
			expect(el.attributes('aria-describedby')?.split(' ')).toContain(runtimeOf(harness).pausedReasonId);
		}
	});

	/**
	 * The case above asserts the ATTRIBUTES with an INCOMPLETE draft, where `canCreateRoom`
	 * is already false and the click never reaches `writesBlocked` at all (the `||` short-
	 * circuits on its first operand). A valid draft is what actually drives the NEW
	 * disjunct: with `canCreateRoom` true, only `writesBlocked` can still refuse the click.
	 */
	it('a VALID room draft still dispatches nothing while paused', async () => {
		const harness = await stalePane();
		runtimeOf(harness).setTool('draw-room');
		await settle();

		await harness.wrapper.find('input.rp-new-room__name').setValue('Kitchen');
		await harness.wrapper.find('input[name="width"]').setValue('4.2');
		await harness.wrapper.find('input[name="width"]').trigger('blur');
		await harness.wrapper.find('input[name="depth"]').setValue('3.8');
		await harness.wrapper.find('input[name="depth"]').trigger('blur');
		await settle();
		expect(runtimeOf(harness).canCreateRoom.value).toBe(true);

		const createRoom = vi.spyOn(runtimeOf(harness), 'createRoom');
		await harness.wrapper.find('button.rp-new-room__create').trigger('click');
		await harness.wrapper.find('button.rp-task-banner__finish').trigger('click');
		await settle();

		expect(createRoom).not.toHaveBeenCalled();
	});

	it('everything is live again when stale clears', async () => {
		const harness = await stalePane(true);
		useProjectStore(harness.pinia).stale = false;
		await settle();

		expect(harness.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBeUndefined();
		expect(harness.wrapper.findAll(`#${runtimeOf(harness).pausedReasonId}`)).toHaveLength(0);
	});

	/**
	 * The override fields the case above could not reach: a real requirement row, assigned
	 * through the real rig rather than through `mountPlanEditorCanvas`'s fakes, because
	 * `RequirementInspectorDTO` rows come from `GetRequirementsForZone` and nothing in
	 * `planFixtures.ts`'s `fakeQueries` answers one.
	 */
	it('the override fields and their Reset buttons are paused once a requirement row exists', async () => {
		const r = await rig(async ({ assets }) => {
			await assets.save(makeAsset({ name: 'Floor tiles', unit: 'm2', wasteFactorDefault: new Decimal('0.10') }), 'absent');
		});
		const areaAsset = expectOk(await r.assetsRepo.listAll()).loaded[0];

		actionButton(r.harness, 'Select').click();
		click(r.harness.canvasEl as HTMLElement, 300, 300);
		await settle();

		const select = r.harness.wrapper.find('#rp-assign-asset');
		await select.setValue(areaAsset.entity.id);
		await settle();
		const assignButton = r.harness.wrapper.findAll('button').find((button) => button.text() === 'Assign');
		if (assignButton === undefined) throw new Error('no Assign button');
		await assignButton.trigger('click');
		await settle();

		// An override, set BEFORE going stale, so Reset while paused has something to
		// discard if its guard is ever dropped.
		const qtyInput = r.harness.wrapper.find('input[data-field="quantity"]');
		await qtyInput.setValue('7');
		await qtyInput.trigger('blur');
		await settle();
		expect(r.harness.wrapper.text()).toContain('Overridden');
		const before = expectOk(await r.requirementsRepo.listByZone('zone-a' as never));

		useProjectStore(r.harness.pinia).stale = true;
		await settle();

		// Neither writes: a second Assign while paused creates no second requirement, and
		// Reset while paused leaves the override in place. `withStaleGate` (design spec §2.2,
		// wired into `wrappedDispatcher` well below this row) refuses either dispatch on its
		// own, so this asserts the OUTCOME two mechanisms both protect rather than
		// discriminating `assignSelected`'s and `resetQuantity`'s OWN early returns from that
		// deeper gate — the guards here exist to make the click a no-op rather than a refused
		// round-trip, which is what the mutation checks in the task report measure instead.
		await assignButton.trigger('click');
		await r.harness.wrapper.find('.rp-requirement-reset-quantity').trigger('click');
		await settle();
		const after = expectOk(await r.requirementsRepo.listByZone('zone-a' as never));
		expect(after).toHaveLength(1);
		expect(after[0].version.revision).toBe(before[0].version.revision);
		expect(r.harness.wrapper.text()).toContain('Overridden');

		for (const sel of [
			'input[data-field="quantity"]',
			'input[data-field="cost"]',
			'.rp-requirement-reset-quantity',
			'.rp-requirement-reset-cost',
		]) {
			const el = r.harness.wrapper.find(sel);
			if (!el.exists()) throw new Error(`expected ${sel} once a requirement row exists`);
			expect(el.attributes('aria-disabled')).toBe('true');
			expect(reasonOf(r.harness, el)).toBe(t('en', 'editor.paused.reason'));
		}
		// The input keeps its ORDINARY refusal channel too — paused is additive, not a second
		// disabled control that hides the field's own error state.
		expect(r.harness.wrapper.find('input[data-field="quantity"]').attributes('readonly')).toBeDefined();

		r.harness.unmount();
	});
});
