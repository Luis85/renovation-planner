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
