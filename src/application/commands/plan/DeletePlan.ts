import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { PlanId } from '../../../domain/plan/PlanId';
import { planDeleted } from '../../../domain/plan/Plan.events';
import { namedReferenceError, referenceError } from '../../errors';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { loadPlan } from './loadPlan';

export interface DeletePlanInput {
	readonly planId: PlanId;
}

export type DeletePlanError = ReferenceError | RepositoryError;

/**
 * Delete one Plan and its note — design slice 21's detail state is the only caller.
 *
 * **It REFUSES while anything still points at the plan, and offers none of BR-DATA-004's other
 * three resolutions.** That rule asks a delete to report its referents and offer Cancel /
 * Remove references / Reassign / Delete anyway, and slice 10 built the engine that does it
 * (`application/reference/deleteResolution.ts`) — for referents that are REQUIREMENTS. A plan's
 * referents are Zones and detail Plans, which that engine's `ResolutionOps`, its
 * `SequenceMarker.entityKind` and its whole compensation path are not typed for. Widening it is
 * a slice; refusing is the arm BR-DATA-004 already blesses as the safe default and the one
 * `DeleteZoneCommand` takes when no resolution is supplied. So: an empty plan deletes, a
 * populated one says what holds it, and the sentence stops there rather than promising the
 * other three.
 *
 * **A refused note of EITHER kind blocks the delete too.** `refused` is a count of notes this
 * build could not read, and a listing that skipped one cannot say the plan is empty — deleting
 * on it would strand exactly the referents nothing could see. `ListReassignmentTargets` refuses
 * on the same count for the same reason: an incomplete read before a destructive write is a
 * silence, not a recovery.
 *
 * The detail-plan check costs a second listing and is not redundant with the zone one. A child
 * names `{ planId, zoneId }`, so it cannot be created under a plan with no zones — but deleting
 * that zone leaves the child behind (`DeleteZoneCommand`'s referents are requirements, not
 * plans), and the parent is then an empty plan with a child still pointing at it.
 */
export class DeletePlanCommand
	implements Command<DeletePlanInput, Result<{ planId: PlanId }, DeletePlanError>>
{
	constructor(
		private readonly plans: PlanRepository,
		private readonly zones: ZoneRepository,
		private readonly events: EventBus,
	) {}

	// ANNOTATED rather than inferred, for the reason `CreatePlanCommand` states: inference
	// produces a union of `Result`s, one arm per error type the body returns, which `isErr`
	// cannot narrow at a call site.
	async execute(input: DeletePlanInput): Promise<Result<{ planId: PlanId }, DeletePlanError>> {
		const loaded = await loadPlan(this.plans, input.planId);
		if (isErr(loaded)) return loaded;

		const zones = await this.zones.listByPlan(input.planId);
		if (isErr(zones)) return zones;
		if (zones.value.loaded.length > 0) {
			return err(
				namedReferenceError(
					'plan.rooms-exist',
					`Plan ${input.planId} still holds ${zones.value.loaded.length} zone(s).`,
					zones.value.loaded.map((zone) => zone.entity.name),
				),
			);
		}

		const siblings = await this.plans.listByProject(loaded.value.entity.projectId);
		if (isErr(siblings)) return siblings;
		// ONE refusal over BOTH listings' `refused` counts, checked after the zone names above so
		// a plan that plainly holds rooms says so rather than reporting the unreadable note
		// beside them. A skipped note of either kind is a referent nobody can see.
		if (zones.value.refused + siblings.value.refused > 0) {
			// `referenceError`, not the named one: its copy has no `{names}` hole to fill, because
			// a note that could not be READ has no name this build can offer.
			return err(
				referenceError(
					'plan.referents-unreadable',
					`Plan ${input.planId} has ${zones.value.refused + siblings.value.refused} zone or plan `
						+ `note(s) that could not be read, so it cannot be confirmed empty.`,
				),
			);
		}
		const children = siblings.value.loaded.filter(
			(plan) => plan.entity.parent?.planId === input.planId,
		);
		if (children.length > 0) {
			return err(
				namedReferenceError(
					'plan.detail-plans-exist',
					`Plan ${input.planId} is the parent of ${children.length} detail plan(s).`,
					children.map((plan) => plan.entity.name),
				),
			);
		}

		const deleted = await this.plans.delete(input.planId, loaded.value.version);
		if (isErr(deleted)) return deleted;

		await this.events.publish(
			planDeleted({ planId: input.planId, projectId: loaded.value.entity.projectId }),
		);
		return ok({ planId: input.planId });
	}
}
