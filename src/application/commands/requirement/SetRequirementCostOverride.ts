import { err, isErr, ok, type Result } from '../../../core/result/Result';

import { effectiveValue } from '../../../core/derived/DerivedValue';
import type { Money } from '../../../core/money/Money';
import type { EventBus } from '../../../core/events/EventBus';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { EntityVersion } from '../../ports/versioning';
import { publishIfEffectiveCostChanged, type SetOverrideErrors } from './SetRequirementQuantityOverride';

export interface SetRequirementCostOverrideInput {
	readonly requirementId: RequirementId;
	/** The negotiated figure; `null` clears — reset to calculated. */
	readonly cost: Money | null;
}

/**
 * §52 applied to the cost field: sets or clears `estimatedCost.override` directly — no
 * geometry or quantity involved, so `RequirementInvalidated` / `RequirementRecalculated`
 * do not fire for this path. Publishes `CostEstimateChanged` only when the effective cost
 * actually moved (an edit that writes the same figure fires nothing).
 */
export class SetRequirementCostOverrideCommand
	implements Command<SetRequirementCostOverrideInput, Result<Requirement, SetOverrideErrors>>
{
	constructor(
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
	) {}

	async execute(
		input: SetRequirementCostOverrideInput,
	): Promise<Result<Requirement, SetOverrideErrors>> {
		const applied = await this.executeWithVersion(input);
		if (!applied.ok) return applied;
		return ok(applied.value.requirement);
	}

	/** The adapter's door: the same write, plus the version undo presents. */
	async executeWithVersion(
		input: SetRequirementCostOverrideInput,
	): Promise<Result<{ requirement: Requirement; version: EntityVersion }, SetOverrideErrors>> {
		const loaded = await this.requirements.getById(input.requirementId);
		if (isErr(loaded)) return loaded;
		if (loaded.value === null) {
			return err(referenceError('requirement.not-found', `Requirement ${input.requirementId} not found.`));
		}
		const current = loaded.value.entity;
		const previousEffective = effectiveValue(current.estimatedCost);

		const updated = current.withCostOverride(input.cost ?? null);
		if (isErr(updated)) {
			return err({ category: 'Domain', code: updated.error.code, message: updated.error.message });
		}

		const saved = await this.requirements.save(updated.value, loaded.value.version);
		if (isErr(saved)) return saved;

		await publishIfEffectiveCostChanged(this.events, saved.value.entity, previousEffective);
		return ok({ requirement: saved.value.entity, version: saved.value.version });
	}
}
