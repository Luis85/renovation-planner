// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { t } from '../../../../src/presentation/i18n/strings';
import { ok } from '../../../../src/core/result/Result';
import { NO_HIERARCHY } from '../../../../src/presentation/read-models/planHierarchy';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { unavailablePlanEditorCommands } from '../../../../src/presentation/editor/planEditorCommands';
import * as notices from '../../../../src/presentation/notices/notify';
import { mountPlanEditorCanvas, runtimeOf, settle, type CanvasHarness } from '../../../helpers/editor';
import { fakeQueries, FIXTURE_PLAN } from '../../../helpers/planFixtures';

/**
 * The Inspector FRAME (Task 15, component library §8): `EntityInspector.vue` routes by
 * selection to the floor state (`FloorInspector.vue`, over Task 7's `buildFloorSummary`), the
 * multiple-selection text, or the room body (`RoomInspector.vue`, `InspectorPanel.vue` through
 * Task 15) — driven through the REAL mounted Plan Editor over `FIXTURE_ZONES`
 * (`zone-kitchen`, a Room; `zone-terrace`, a Terrace), the same fixture `runtime.test.ts`'s
 * `selectAndFrame` cases already use.
 */

let harness: CanvasHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

const HOUSE = { name: 'House', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] };
/** A detail plan's fixture: a parent zone with an ancestry one plan deep, so `guideSource` has both name and plan. */
const detail = (parentZone: typeof HOUSE | null) => ({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, ancestry: [{ id: 'plan-site', name: 'Site plan', kind: 'floor' as const }], parentZone })) } });

describe('the floor state', () => {
	it('with nothing selected shows the floor summary: counts available, unbuilt aggregates unavailable, never zero', async () => {
		harness = await mountPlanEditorCanvas();
		const floor = harness.wrapper.find('.rp-floor-inspector');

		expect(floor.find('[data-rp-stat="rooms"]').text()).toContain('1');
		expect(floor.find('[data-rp-stat="planned-changes"]').text()).toBe('0');
		expect(floor.find('[data-rp-stat="estimated-cost"]').text()).not.toMatch(/\d/);
	});

	it('draws the reference action as the floor\'s one primary action, directly under its name', async () => {
		harness = await mountPlanEditorCanvas();
		const primary = harness.wrapper.get('.rp-floor-inspector > .rp-inspector-primary');
		expect(primary.find('[data-rp-action="reference"]').exists()).toBe(true);
		expect(primary.element.previousElementSibling?.tagName).toBe('H3');
	});

	it('marks counts partial when zones were unreadable', async () => {
		harness = await mountPlanEditorCanvas({ unreadableZones: 2 });

		expect(harness.wrapper.find('[data-rp-stat="rooms"]').classes()).toContain('rp-floor-inspector__stat--partial');
		expect(harness.wrapper.find('[data-rp-stat="rooms"]').text()).toContain('2');
	});

	it('lists every room and every area as a button, and a row selects and frames its record', async () => {
		harness = await mountPlanEditorCanvas();
		const rows = harness.wrapper.find('.rp-floor-inspector').findAll('.rp-room-list__row');

		expect(rows.map((row) => row.find('span').text())).toEqual(['Kitchen', 'Terrace']);

		await rows[0].trigger('click');

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
	});
});

/**
 * The shell-level `role="status"` guidance region (design spec §6.6, R15): announced once when
 * a selection CLEARS to nothing, retired shortly after so an unrelated refresh never
 * re-announces it. This case proves the FULL-layout half, with `EntityInspector` mounted
 * beside it; `responsiveShell.test.ts`'s constrained case proves the region keeps announcing
 * once `EntityInspector` is unmounted, which is the whole reason the watcher lives in
 * `SelectionGuidance.vue` rather than here.
 *
 * **The timing is the whole of what this case has to prove, so it is spelled out.**
 * `SelectionGuidance`'s watcher sets the guidance text SYNCHRONOUSLY on the clear and then
 * awaits one tick before arming a REAL `setTimeout(0)` to blank it — and `settle()` (this
 * suite's usual wait) itself waits out exactly such a timer, so asserting the text is present
 * after a `settle()` would already find it cleared. The first half is read after ONE
 * `nextTick()` instead, which is enough for Vue to have painted the watcher's synchronous
 * assignment and not enough for the timer to have fired; the second half is read after
 * `settle()`, which both drains that timer and proves `changePlan()` — an ordinary refresh
 * that leaves the (already empty) selection untouched — does not arm it again.
 */
describe('a detail plan in the floor state', () => {
	it('explains the dashed outline while the plan has no reference plan', async () => {
		harness = await mountPlanEditorCanvas(detail(HOUSE));
		await settle();
		expect(harness.wrapper.get('.rp-floor-inspector__guide').text()).toBe(t('en', 'editor.input.detail-plan-guide-explainer', { name: 'House', plan: 'Site plan' }));
	});

	it('drops the explanation once a reference plan is set', async () => {
		harness = await mountPlanEditorCanvas(detail(HOUSE));
		await settle();
		useProjectStore(harness.pinia).plan = { ...FIXTURE_PLAN, background: { path: 'Plans/g.png', kind: 'image' } };
		await settle();
		expect(harness.wrapper.find('.rp-floor-inspector__guide').exists()).toBe(false);
	});

	it('never explains a guide that is not drawn', async () => {
		harness = await mountPlanEditorCanvas(detail(null));
		await settle();
		expect(harness.wrapper.find('.rp-floor-inspector__guide').exists()).toBe(false);
	});
});

/**
 * The Kind select (Property tree polish, Task 10): bound to `PlanDto.kind`, written through
 * `usePlanReorder().setKind` — the one `updatePlanDetails` door the tree's row menu also uses —
 * and absent without that command or in review perspective. While writes are paused it stays
 * focusable, carries §2.9's `aria-disabled` plus the shared reason, and a change dispatches
 * nothing: the harness's `execute` spy is what proves the refusal, since a disabled-looking
 * select still fires `change` in jsdom.
 */
const kindExecute = () => vi.fn<() => Promise<ReturnType<typeof ok<{ plan: { entity: typeof FIXTURE_PLAN; version: { revision: number } } }>>>>(() =>
	Promise.resolve(ok({ plan: { entity: { ...FIXTURE_PLAN, kind: 'room' as const }, version: { revision: 1 } } })));
const withKindCommand = (execute = kindExecute()) =>
	mountPlanEditorCanvas({ plan: { ...FIXTURE_PLAN, kind: 'room' }, commands: { ...unavailablePlanEditorCommands(), updatePlanDetails: { execute } } as never });

describe('the Kind select', () => {
	it('offers a Kind select bound to the plan and writes through updatePlanDetails', async () => {
		const execute = kindExecute();
		harness = await withKindCommand(execute);
		await settle();
		const select = harness.wrapper.get('select[data-rp-field="plan-kind"]');
		expect((select.element as HTMLSelectElement).value).toBe('room');
		expect(harness.wrapper.get(`label[for="${select.attributes('id')}"]`).text()).toBe(t('en', 'form.new-plan.kind'));
		await select.setValue('floor');
		await settle();
		expect(execute).toHaveBeenCalledWith({ planId: FIXTURE_PLAN.id, kind: 'floor' });
	});

	it('draws no Kind select without the command', async () => {
		harness = await mountPlanEditorCanvas({});
		await settle();
		expect(harness.wrapper.find('select[data-rp-field="plan-kind"]').exists()).toBe(false);
	});

	it('hides the Kind select in review perspective', async () => {
		harness = await withKindCommand();
		await settle();
		await runtimeOf(harness).renovation.perspective('review');
		await settle();
		expect(harness.wrapper.find('select[data-rp-field="plan-kind"]').exists()).toBe(false);
	});

	it('while writes are paused the select is aria-disabled with the reason, and a change dispatches nothing', async () => {
		const execute = kindExecute();
		harness = await withKindCommand(execute);
		await settle();
		useProjectStore(harness.pinia).stale = true;
		await settle();
		const select = harness.wrapper.get('select[data-rp-field="plan-kind"]');
		expect(select.attributes('aria-disabled')).toBe('true');
		expect(select.attributes('disabled')).toBeUndefined();
		expect(select.attributes('aria-describedby')?.split(' ')).toContain(runtimeOf(harness).pausedReasonId);
		await select.setValue('floor');
		await settle();
		expect(execute).not.toHaveBeenCalled();
		// The DOM value is put back too: the store's `kind` never moved, so `:value` alone re-patches nothing.
		expect((select.element as HTMLSelectElement).value).toBe('room');
	});

	it('a refused write is reported and the select goes back to the saved kind', async () => {
		const execute = vi.fn<() => Promise<{ ok: false; error: { category: string; code: string; message: string } }>>(() =>
			Promise.resolve({ ok: false, error: { category: 'Validation', code: 'plan.not-found', message: 'x' } }));
		const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		harness = await withKindCommand(execute as never);
		await settle();
		const select = harness.wrapper.get('select[data-rp-field="plan-kind"]');
		await select.setValue('floor');
		await settle();
		expect(execute).toHaveBeenCalledOnce();
		expect(notify).toHaveBeenCalledOnce();
		expect((select.element as HTMLSelectElement).value).toBe('room');
		notify.mockRestore();
	});
});

describe('the guidance region', () => {
	it('announces guidance once when the selection clears, and not on a refresh', async () => {
		harness = await mountPlanEditorCanvas();

		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		useSelectionStore().clear();
		await nextTick();

		expect(harness.wrapper.find('.rp-selection-guidance').text()).toBe(t('en', 'editor.inspector.floor.guidance'));
		// Announced, never drawn: a visible line here pushed the canvas down for one tick on every deselect.
		expect(harness.wrapper.find('.rp-selection-guidance').classes()).toContain('rp-visually-hidden');

		harness.changePlan();
		await settle();

		expect(harness.wrapper.find('.rp-selection-guidance').text()).toBe('');
	});
});
