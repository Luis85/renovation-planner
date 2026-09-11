// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { mountPlanEditorCanvas, runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { CreatePlanCommand } from '../../../src/application/commands/plan/CreatePlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { readPlanHierarchy } from '../../../src/presentation/read-models/planHierarchy';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';

const unmounts: (() => void)[] = [];
afterEach(() => { for (const unmount of unmounts.splice(0)) unmount(); });

async function rig() {
	const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN);
	await workspace.ready;
	const { stack } = workspace, opened: string[] = [];
	const hierarchy = (planId: string) => readPlanHierarchy({ getPlan: new GetPlan(stack.plans), listPlans: new ListPlansByProject(stack.plans), findZonesByPlan: new FindZonesByPlan(stack.zones) }, planId);
	const harness = await mountPlanEditorCanvas({
		plan: HARNESS_PLAN,
		vault: workspace.deps.vault,
		queries: { ...workspace.deps.queries, hierarchy },
		commands: { ...workspace.deps.commands, createPlan: new CreatePlanCommand(stack.plans, stack.projects, stack.zones, stack.events) },
		navigation: { project: () => Promise.resolve(), library: () => undefined, plan: (id) => { opened.push(id); return Promise.resolve(); } },
	});
	unmounts.push(() => harness.unmount());
	const runtime = runtimeOf(harness), selection = useSelectionStore(harness.pinia), dialogs = useDialogStore(harness.pinia);
	const menu = async () => { harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); };
	return { workspace, stack, harness, runtime, selection, dialogs, opened, menu };
}

it('creates a detail plan named after the zone, opens it, and then lists it under that zone', async () => {
	const r = await rig();
	const house = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'House', zoneType: 'Custom', geometry: { points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([house.id]);
	await r.menu();
	await r.harness.wrapper.get('[data-rp-context-action="detail-plan-new"]').trigger('click');
	await settleUntil(() => r.dialogs.current !== null, 'new plan dialog');
	const form = r.harness.wrapper.get('.rp-dialog-form');
	expect((form.get('[data-field="name"]').element as HTMLInputElement).value).toBe('House');
	await form.trigger('submit');
	await settleUntil(() => r.opened.length === 1, 'detail plan opened');

	const created = expectFound(await r.stack.plans.getById(r.opened[0] as never)).entity;
	expect(created).toMatchObject({ name: 'House', parent: { planId: HARNESS_PLAN.id, zoneId: house.id } });

	await r.menu();
	await r.harness.wrapper.get(`[data-rp-context-action="detail-plan-open:${created.id}"]`).trigger('click');
	await settle();
	expect(r.opened).toEqual([created.id, created.id]);
});

/**
 * Findings round 2, item 5: `useDetailPlanActions.create`'s `if (saved.ok)` false arm — a
 * `createPlan` refusal, the only UI path the three parent refusal codes take — had no case.
 * Deleting the zone between opening the dialog and submitting is what makes the real command
 * answer `plan.parent-zone-not-found`, the same refusal a stale menu (opened before another
 * leaf deleted the zone) would produce.
 */
it('creates nothing and stays open showing the refusal when the create command refuses', async () => {
	const r = await rig();
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
	const house = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'House', zoneType: 'Custom', geometry: { points } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([house.id]);
	const before = expectOk(await r.stack.plans.listByProject(r.workspace.plan.projectId)).loaded.length;
	await r.menu();
	await r.harness.wrapper.get('[data-rp-context-action="detail-plan-new"]').trigger('click');
	await settleUntil(() => r.dialogs.current !== null, 'new plan dialog');

	// The zone the dialog was opened for is gone by the time it submits — a stale menu, or
	// another leaf's delete racing this one — so the real command's own `refuseParent` check
	// answers `plan.parent-zone-not-found` rather than anything this test fabricates.
	expectOk(await r.workspace.deps.commands.deleteZone.execute({ zoneId: house.id }));

	const form = r.harness.wrapper.get('.rp-dialog-form');
	await form.trigger('submit');
	await settle();

	expect(r.dialogs.current).not.toBeNull();
	expect(r.harness.wrapper.find('.rp-dialog-form').exists()).toBe(true);
	expect(r.harness.wrapper.find('.rp-form-banner').exists()).toBe(true);
	expect(expectOk(await r.stack.plans.listByProject(r.workspace.plan.projectId)).loaded).toHaveLength(before);
	expect(r.opened).toEqual([]);
});

it('offers no detail-plan action for a multi-selection', async () => {
	const r = await rig();
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
	const a = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'A', zoneType: 'Custom', geometry: { points } })).zone.entity;
	const b = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'B', zoneType: 'Custom', geometry: { points } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([a.id, b.id]);
	await r.menu();
	expect(r.harness.wrapper.find('[data-rp-context-action="detail-plan-new"]').exists()).toBe(false);
});

it('creates nothing and navigates nowhere when the new-plan dialog is cancelled', async () => {
	const r = await rig();
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
	const house = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'House', zoneType: 'Custom', geometry: { points } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([house.id]);
	const before = expectOk(await r.stack.plans.listByProject(r.workspace.plan.projectId)).loaded.length;
	await r.menu();
	await r.harness.wrapper.get('[data-rp-context-action="detail-plan-new"]').trigger('click');
	await settleUntil(() => r.dialogs.current !== null, 'new plan dialog');
	r.dialogs.resolve('cancel');
	await settle();
	expect(r.dialogs.current).toBeNull();
	expect(expectOk(await r.stack.plans.listByProject(r.workspace.plan.projectId)).loaded).toHaveLength(before);
	expect(r.opened).toEqual([]);
});

it('opens only one dialog and creates only one plan when New is invoked twice before the menu closes', async () => {
	// The menu closes on click (`CanvasContextMenu.run`: `close()` then a fire-and-forgotten
	// `action.run()`), so re-driving the guard through the menu itself needs both clicks
	// dispatched before Vue's own reactivity has flushed that close — the same "two
	// activations in one tick" shape CLAUDE.md names for the leaf-creating doors. Firing both
	// `trigger('click')` calls before awaiting either does that: `create()`'s synchronous
	// prelude (through `dialogs.openDialog`'s synchronous `current.value = descriptor`) has
	// already run by the time the second dispatch reaches the same still-mounted button.
	const r = await rig();
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
	const house = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'House', zoneType: 'Custom', geometry: { points } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([house.id]);
	const before = expectOk(await r.stack.plans.listByProject(r.workspace.plan.projectId)).loaded.length;
	await r.menu();
	const button = r.harness.wrapper.get('[data-rp-context-action="detail-plan-new"]');
	await Promise.all([button.trigger('click'), button.trigger('click')]);
	await settleUntil(() => r.dialogs.current !== null, 'new plan dialog');
	r.dialogs.resolve('cancel');
	await settle();
	expect(r.dialogs.current).toBeNull();
	expect(expectOk(await r.stack.plans.listByProject(r.workspace.plan.projectId)).loaded).toHaveLength(before);
	expect(r.opened).toEqual([]);
});

it('disables New like its sibling zone actions when writes are blocked, and offers no detail-plan action in review perspective', async () => {
	const r = await rig();
	const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
	const house = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'House', zoneType: 'Custom', geometry: { points } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([house.id]);
	const project = useProjectStore(r.harness.pinia);
	project.stale = true;
	await r.menu();
	const newEntry = r.harness.wrapper.get('[data-rp-context-action="detail-plan-new"]');
	expect(newEntry.attributes('aria-disabled')).toBe('true');
	expect(newEntry.attributes('title')).toBe(r.harness.wrapper.get('[data-rp-context-action="delete"]').attributes('title'));
	await newEntry.trigger('keydown', { key: 'Escape' });
	project.stale = false;

	await r.runtime.renovation.perspective('review');
	r.selection.select([house.id]);
	await r.menu();
	expect(r.harness.wrapper.find('[data-rp-context-action="detail-plan-new"]').exists()).toBe(false);
});
