import { err, isErr, ok, type Result } from '../../../core/result/Result';

import { effectiveValue } from '../../../core/derived/DerivedValue';
import type { Money } from '../../../core/money/Money';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import type { EventBus } from '../../../core/events/EventBus';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { Command } from '../Command';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { EntityVersion } from '../../ports/versioning';
import { publishIfEffectiveCostChanged, type SetOverrideErrors } from './SetRequirementQuantityOverride';
import { loadRequirement } from './loadRequirement';

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
/**
 * The level-2 lock every ORDINARY requirement write takes, so a delete resolution's own
 * compensation cannot be overtaken by one.
 *
 * The resolution takes level-2 locks over every requirement it will write and holds them
 * through its rollback (`deleteResolution.ts` step 1). A lock only excludes participants
 * that take it, though: with the override commands taking none, an override landing
 * between the resolution's forward write and its compensation bumps the revision the
 * compensation is about to present, and the restore is refused — the Vault is left
 * half-resolved by an edit that was itself perfectly legal.
 *
 * **What this does NOT cover, stated because the gap is deliberate.**
 * `RecalculateRequirementCommand` writes requirements too and takes no lock, and it cannot
 * be given one here: the resolution calls it INLINE while holding that requirement's
 * level-2 lock, and `ReferenceLocks` raises on a second acquisition within a level from a
 * holder — correctly, since the alternative is a deadlock against itself. Closing that half
 * means threading the resolution's own `LockSession` down into the recalculation, which is
 * a wider change than this slice's Definition of Done asks for. So a cascade recalculation
 * can still overtake a compensation; an override cannot.
 */
/**
 * What the reversible adapter dispatches through, structurally. The adapter names only
 * `executeWithVersion`, and naming the CLASS there made this command a NOMINAL dependency — which is
 * what kept it out of the Error Boundary, since a guarded service is a wrapper object and
 * never an instance. `Pick` is the same relaxation `DeleteZoneDeps.recalculate` already
 * makes of `RecalculateRequirementCommand`, and it is what lets the composition root hand
 * presentation a guarded facade carrying BOTH doors.
 */
export type SetRequirementCostOverrideDoor = Pick<
	SetRequirementCostOverrideCommand,
	'executeWithVersion'
>;

export class SetRequirementCostOverrideCommand
	implements Command<SetRequirementCostOverrideInput, Result<Requirement, SetOverrideErrors>>
{
	constructor(
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
		private readonly locks: ReferenceLocks,
	) {}

	async execute(
		input: SetRequirementCostOverrideInput,
	): Promise<Result<Requirement, SetOverrideErrors>> {
		const applied = await this.executeWithVersion(input);
		if (!applied.ok) return applied;
		return ok(applied.value.requirement);
	}

	/** The adapter's door: the same write, plus the version undo presents. */
	executeWithVersion(
		input: SetRequirementCostOverrideInput,
	): Promise<Result<{ requirement: Requirement; version: EntityVersion }, SetOverrideErrors>> {
		return this.locks.withLevel2(input.requirementId, () => this.write(input));
	}

	private async write(
		input: SetRequirementCostOverrideInput,
	): Promise<Result<{ requirement: Requirement; version: EntityVersion }, SetOverrideErrors>> {
		const loaded = await loadRequirement(this.requirements, input.requirementId);
		if (isErr(loaded)) return loaded;
		const current: Requirement = loaded.value.entity;
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
