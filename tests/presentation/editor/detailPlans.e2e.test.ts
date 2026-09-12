// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { t } from '../../../src/presentation/i18n/strings';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { fakeQueries, mountPlanEditor, mountPlanEditorCanvas, runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { err, ok } from '../../../src/core/result/Result';
import { CreatePlanCommand } from '../../../src/application/commands/plan/CreatePlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { NO_HIERARCHY, readPlanHierarchy } from '../../../src/presentation/read-models/planHierarchy';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';

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

const HYDRATION_FAULT: RepositoryError = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' };

/**
 * `planHierarchy.load` runs inside `hydrate()`, which `PlanEditorRoot` re-runs on every
 * `onPlanChanged` event of THIS plan. For a while it ran at mount and retry ONLY (D1), on the
 * argument that no zone gesture, background change or delete can change the hierarchy — and
 * then `PlanDetailsChanged` (ADR-0029) could: a kind or order written from another leaf's tree
 * menu IS a hierarchy fact, and the plan-change door hands its listener no event type to tell
 * the two apart. The harness's `changePlan` is that door.
 */
it('loads the hierarchy at mount, on a plan-change event, and on retry', async () => {
	let calls = 0;
	const hierarchy: NonNullable<PlanEditorQueryServices['hierarchy']> = () => {
		calls += 1;
		return Promise.resolve(ok(NO_HIERARCHY));
	};
	// The plan read fails and keeps failing, so the failure view's retry action stays offered
	// after being used once — the same shape `planEditorFailure.test.ts` drives.
	const getPlan = () => Promise.resolve(err(HYDRATION_FAULT));
	const harness = await mountPlanEditor({ queries: { ...fakeQueries(null), getPlan, hierarchy } });
	await flushPromises();
	expect(calls).toBe(1);

	harness.changePlan();
	await flushPromises();
	expect(calls).toBe(2);

	await harness.wrapper.get('.rp-view-failure__action').trigger('click');
	await flushPromises();
	expect(calls).toBe(3);

	harness.wrapper.unmount();
});

it('creates a detail plan named after the zone, opens it, and then lists it under that zone', async () => {
	const r = await rig();
	const house = expectOk(await r.workspace.deps.commands.createZone.execute({ planId: r.workspace.plan.id, name: 'House', zoneType: 'Custom', geometry: { points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] } })).zone.entity;
	await r.runtime.refreshProjection();
	r.selection.select([house.id]);
	await r.menu();
	await r.harness.wrapper.get('[data-rp-context-action="detail-plan-new"]').trigger('click');
	await settleUntil(() => r.dialogs.current !== null, 'new plan dialog');
	// `parentKind` is the opened plan's own kind, so the form's Kind select starts one step below it
	// (ADR-0029) — a room under this floor — and that default is what the command persists.
	expect(r.dialogs.current).toMatchObject({ kind: 'form', title: t('en', 'form.new-detail-plan.title', { name: 'House' }), props: { parentKind: HARNESS_PLAN.kind } });
	const form = r.harness.wrapper.get('.rp-dialog-form');
	expect((form.get('[data-field="name"]').element as HTMLInputElement).value).toBe('House');
	await form.trigger('submit');
	await settleUntil(() => r.opened.length === 1, 'detail plan opened');

	const created = expectFound(await r.stack.plans.getById(r.opened[0] as never)).entity;
	expect(created).toMatchObject({ name: 'House', kind: 'room', parent: { planId: HARNESS_PLAN.id, zoneId: house.id } });

	await r.menu();
	// The zone's linked plan is the menu's first item, with New detail plan beside it.
	expect(r.harness.wrapper.findAll('[data-rp-context-action]').slice(0, 2).map(item => item.attributes('data-rp-context-action'))).toEqual([`detail-plan-open:${created.id}`, 'detail-plan-new']);
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
