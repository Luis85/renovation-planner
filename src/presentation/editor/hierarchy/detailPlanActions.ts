import { storeToRefs } from 'pinia';
import { inject } from 'vue';
import type { CreatePlanInput } from '../../../application/commands/plan/CreatePlan';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { useProjectStore } from '../../stores/ProjectStore';
import NewPlanForm from '../../views/NewPlanForm.vue';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../PlanEditorContext';
import type { CanvasMenuAction } from '../selection/useCanvasMenuActions';

/**
 * One zone's detail-plan menu entries (ADR-0028): Open for each plan that already details it, then
 * New detail plan — the menu's first group, so a linked plan is its first item. Nothing at all
 * when this composition cannot create or open a plan.
 *
 * `inject(PLAN_EDITOR_CONTEXT)` rather than `usePlanEditorContext()`: the rest of
 * `useCanvasMenuActions` is deliberately reachable with no `PlanEditorContext` provided at
 * all — `canvasContextMenuStandalone.test.ts` mounts `CanvasContextMenu` outside the editor
 * shell with only `EDITOR_RUNTIME` on offer, to drive its "no canvas ancestor" fallback — and
 * `usePlanEditorContext()`'s throw-on-missing contract exists for components that always sit
 * inside `PlanEditorRoot`, which this one does not. No context is one more shape of "this
 * composition cannot create or open a plan", the same as no `createPlan` command.
 */
export function useDetailPlanActions() {
	const context = inject(PLAN_EDITOR_CONTEXT), project = useProjectStore(), dialogs = useDialogStore(), store = usePlanHierarchyStore();
	const { hierarchy } = storeToRefs(store);

	async function create(ctx: PlanEditorContext, open: (id: string) => Promise<void>, zoneId: string, name: string): Promise<void> {
		const createPlan = ctx.commands.createPlan, plan = project.plan;
		if (createPlan === undefined || plan === null || dialogs.current !== null) return;
		let created = null as string | null;
		const result = await dialogs.openDialog({
			kind: 'form',
			title: tr('form.new-plan.title'),
			component: NewPlanForm,
			props: {
				projectId: plan.projectId,
				initialName: name,
				parent: { planId: plan.id as PlanId, zoneId: zoneId as ZoneId },
				logger: ctx.commands.logger,
				dispatch: async (input: CreatePlanInput) => {
					const saved = await createPlan.execute(input);
					if (saved.ok) created = saved.value.plan.entity.id;
					return saved;
				},
			},
		});
		if (result === 'cancel' || created === null) return;
		await store.load(ctx.queries, ctx.planId);
		await open(created);
	}

	return (zoneId: string, name: string, blocked: boolean): CanvasMenuAction[] => {
		if (context === undefined) return [];
		const open = context.navigation?.plan?.bind(context.navigation);
		if (context.commands.createPlan === undefined || open === undefined) return [];
		return [
			...hierarchy.value.detailPlans
				.filter((detail) => detail.parentZoneId === zoneId)
				.map((detail): CanvasMenuAction => ({ id: `detail-plan-open:${detail.id}`, label: 'editor.input.detail-plan-open', group: 'plans', icon: 'file-text', params: { name: detail.name }, run: () => open(detail.id) })),
			{ id: 'detail-plan-new', label: 'editor.input.detail-plan-new', group: 'plans', icon: 'circle-plus', disabled: blocked, run: () => create(context, open, zoneId, name) },
		];
	};
}
