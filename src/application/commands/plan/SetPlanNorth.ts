import { ok } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import { withPlanNorth } from '../../../domain/plan/Plan';
import { planNorthChanged } from '../../../domain/plan/Plan.events';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { EntityVersion } from '../../ports/versioning';
import type { DispatchResult } from '../DispatchOutcome';
import { loadPlan } from './loadPlan';
import { savePlan } from './savePlan';

export interface PlanNorthServices {
	command(planId: PlanId, north: number): { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };
}

/**
 * One north-arrow release, as one history item. `execute` writes the bearing over whatever the
 * plan holds now — a bearing is one whole value, so there is nothing of a peer's to merge — and
 * `undo` restores what the FIRST execute read, conditional on the version this command's own
 * write left: an undo over somebody else's later write refuses rather than clobbering it.
 */
class SetPlanNorth {
	private before: { readonly north: number | undefined } | null = null;
	private written: EntityVersion | null = null;

	constructor(private readonly plans: PlanRepository, private readonly events: EventBus, private readonly planId: PlanId, private readonly north: number) {}

	execute(): Promise<DispatchResult> { return this.write(false); }
	undo(): Promise<DispatchResult> { return this.write(true); }

	private async write(undo: boolean): Promise<DispatchResult> {
		if ((this.written !== null) !== undo) return ok('no-write');
		const loaded = await loadPlan(this.plans, this.planId);
		if (!loaded.ok) return loaded;
		this.before ??= { north: loaded.value.entity.north };
		const changed = withPlanNorth(loaded.value.entity, undo ? this.before.north : this.north);
		if (!changed.ok) return changed;
		const saved = await savePlan(this.plans, this.events, changed.value, this.written ?? loaded.value.version, planNorthChanged);
		if (!saved.ok) return saved;
		this.written = undo ? null : saved.value.version;
		return ok('wrote');
	}
}

export function planNorthServices(plans: PlanRepository, events: EventBus): PlanNorthServices {
	return { command: (planId, north) => new SetPlanNorth(plans, events, planId, north) };
}
