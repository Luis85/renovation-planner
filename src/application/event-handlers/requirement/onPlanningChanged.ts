import { Decimal } from 'decimal.js';
import type { ProjectIndex } from '../../ports/ProjectIndex';
import { changedSidecar } from '../../events/subscriptions';
import type { DomainEvent, EventBus } from '../../../core/events/EventBus';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { PlanGeometrySidecar } from '../../ports/PlanGeometrySidecar';
import { sourceMeasurement } from '../../../domain/requirement/RequirementSource';
import { toMeasuredQuantity } from '../../../domain/cost/quantityEngine';
import { runRecalculationCascade, type CascadeDeps } from './cascade';

/** Existing event bus + stale-first cascade. Metadata-only edits do not churn material versions. */
export function registerOnPlanningChanged(events: EventBus, deps: CascadeDeps & { plans: PlanRepository; geometry: PlanGeometrySidecar; index?: Pick<ProjectIndex, 'getIdsByType'> }) {
 async function refresh(id: string): Promise<void> {
		const plan = await deps.plans.getById(id as PlanId);
		if (!plan.ok || !plan.value) { deps.notify.cascadeAborted(id); return; }
		const listed = await deps.requirements.listByProject(plan.value.entity.projectId);
		const geometry = await deps.geometry.read(id as PlanId);
		if (!listed.ok || !geometry.ok || listed.value.refused) { deps.notify.cascadeAborted(id); return; }
		const changed = listed.value.loaded.filter(({ entity }) => {
			if (!entity.source || entity.source.planId !== id) return false;
			const raw = sourceMeasurement(entity.source, entity.origin.zoneId, geometry.value.document, entity.unit, entity.assetId);
			const measured = raw.ok ? toMeasuredQuantity(raw.value, entity.unit) : null;
			return !measured?.ok || !new Decimal(entity.calculatedFrom.zoneArea.value).eq(measured.value.value);
		});
		await runRecalculationCascade(deps, changed);
 }
 const subscriptions = ['PlanStructureChanged', 'PlanRenovationChanged', 'PlanCalibrated', 'GeometrySidecarChanged', 'ProjectIndexRebuilt'].map(type => events.subscribe(type, async event => {
  const ids = planningIds(event, deps.index);
  for (const id of ids) await refresh(id);
 }));
 return { dispose() { for (const subscription of subscriptions) subscription.dispose(); } };
}

function planningIds(event: DomainEvent, index?: Pick<ProjectIndex, 'getIdsByType'>): readonly string[] {
 if (event.type === 'ProjectIndexRebuilt') return index?.getIdsByType('renovation-plan') ?? [];
 if (event.type === 'GeometrySidecarChanged') {
  const payload = changedSidecar(event); return payload.entityType === 'renovation-plan' && payload.entityId ? [payload.entityId] : [];
 }
 const id = (event as { payload?: { planId?: string } }).payload?.planId;
 return id ? [id] : [];
}
