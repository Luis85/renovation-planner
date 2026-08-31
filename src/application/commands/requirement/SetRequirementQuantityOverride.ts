import { Decimal } from 'decimal.js';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	DomainError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { effectiveValue } from '../../../core/derived/DerivedValue';
import type { Money } from '../../../core/money/Money';
import type { Quantity } from '../../../core/units/MeasurementUnit';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import type { EventBus } from '../../../core/events/EventBus';
import type { Requirement } from '../../../domain/requirement/Requirement';
import { costEstimateChanged } from '../../../domain/requirement/Requirement.events';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import { computeEstimatedCost } from '../../../domain/cost/costPipeline';
import type { Command } from '../Command';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { EntityVersion } from '../../ports/versioning';
import { loadRequirement } from './loadRequirement';

export interface SetRequirementQuantityOverrideInput {
	readonly requirementId: RequirementId;
	/** The user's figure in the requirement's unit; `null` clears — reset to calculated. */
	readonly quantity: number | null;
}

export type SetOverrideErrors =
	| DomainError
	| ReferenceError
	| RepositoryError;

/**
 * The whole write, shared verbatim by the reversible adapter (which calls it through this
 * same command instance): one read, one validation pass, one cost-pipeline run, one
 * conditional save. Returns what publishing needs alongside what saving produced —
 * `previousEffectiveCost` is read BEFORE the write because the saved entity has already
 * moved by the time a caller would compare.
 *
 * §52 applied to the quantity field: sets or clears `quantity.override` independently of
 * any cost override, then re-runs the Cost Pipeline against the new EFFECTIVE quantity so
 * `estimatedCost.calculated` stays correct even while a cost override may currently be
 * hiding it. Neither the calculated quantity nor `calculatedFrom` nor the recalculation
 * status is touched: an override is a user's answer beside a derived value, never a claim
 * about the derivation.
 */
async function applyQuantityOverride(
	requirements: RequirementRepository,
	input: SetRequirementQuantityOverrideInput,
): Promise<
	Result<
		{ requirement: Requirement; previousEffectiveCost: Money; version: EntityVersion },
		SetOverrideErrors
	>
> {
	const loaded = await loadRequirement(requirements, input.requirementId);
	if (!loaded.ok) return loaded;
	const current = loaded.value.entity;
	const previousEffectiveCost = effectiveValue(current.estimatedCost);

	let override: Quantity | null = null;
	if (input.quantity !== null) {
		const value = new Decimal(String(input.quantity));
		if (value.isNegative()) {
			return err({
				category: 'Domain',
				code: 'requirement.negative-quantity',
				message: `A requirement quantity cannot be negative; got ${value.toString()}.`,
			});
		}
		override = { value, unit: current.unit };
	}
	const updated = current.withQuantityOverride(override);
	if (isErr(updated)) {
		return err({ category: 'Domain', code: updated.error.code, message: updated.error.message });
	}

	// The pipeline stage an override edit owes the estimate: cost off the NEW effective.
	// `expectedCurrency` is the SAME `unitCost` this call also passes as `unitPrice` — not a
	// fresh read of the project's currency — because this re-prices against the snapshot
	// `calculatedFrom` already recorded rather than against a live Asset; the guard can only
	// ever agree with itself here, and the alternative (reading the project again) would be a
	// second answer to a currency this figure was already derived against.
	const cost = computeEstimatedCost({
		quantity: effectiveValue(updated.value.quantity),
		unitPrice: updated.value.calculatedFrom.unitCost,
		pricedPer: updated.value.calculatedFrom.assetUnit,
		expectedCurrency: updated.value.calculatedFrom.unitCost.currency,
	});
	if (!cost.ok) {
		return err({ category: 'Domain', code: cost.error.code, message: cost.error.message });
	}
	const repriced: Requirement = updated.value;
	const withCost = repriced.withCalculatedCost(cost.value.calculated);
	if (isErr(withCost)) {
		return err({ category: 'Domain', code: withCost.error.code, message: withCost.error.message });
	}

	const saved = await requirements.save(withCost.value, loaded.value.version);
	if (isErr(saved)) return err(saved.error);
	return ok({
		requirement: saved.value.entity,
		previousEffectiveCost,
		version: saved.value.version,
	});
}

/** Publishes only when the effective figure actually moved — an unchanged edit fires nothing. */
export async function publishIfEffectiveCostChanged(
	events: EventBus,
	requirement: Requirement,
	previous: Money,
): Promise<void> {
	const current = effectiveValue(requirement.estimatedCost);
	if (previous.amount === current.amount && previous.currency === current.currency) return;
	await events.publish(
		costEstimateChanged({
			costType: 'estimated',
			scope: { kind: 'requirement', id: requirement.id },
			currency: current.currency,
			previous,
			current,
		}),
	);
}

/**
 * What the reversible adapter dispatches through, structurally. The adapter names only
 * `executeWithVersion`, and naming the CLASS there made this command a NOMINAL dependency — which is
 * what kept it out of the Error Boundary, since a guarded service is a wrapper object and
 * never an instance. `Pick` is the same relaxation `DeleteZoneDeps.recalculate` already
 * makes of `RecalculateRequirementCommand`, and it is what lets the composition root hand
 * presentation a guarded facade carrying BOTH doors.
 */
export type SetRequirementQuantityOverrideDoor = Pick<
	SetRequirementQuantityOverrideCommand,
	'executeWithVersion'
>;

export class SetRequirementQuantityOverrideCommand
	implements
		Command<SetRequirementQuantityOverrideInput, Result<Requirement, SetOverrideErrors>>
{
	constructor(
		private readonly requirements: RequirementRepository,
		private readonly events: EventBus,
		private readonly locks: ReferenceLocks,
	) {}

	async execute(
		input: SetRequirementQuantityOverrideInput,
	): Promise<Result<Requirement, SetOverrideErrors>> {
		const applied = await this.executeWithVersion(input);
		if (!applied.ok) return applied;
		return ok(applied.value.requirement);
	}

	/** The adapter's door: the same write, plus what undo needs that publishing does not. */
	executeWithVersion(
		input: SetRequirementQuantityOverrideInput,
	): Promise<Result<{ requirement: Requirement; version: EntityVersion }, SetOverrideErrors>> {
		// The level-2 lock a delete resolution's compensation relies on — see
		// `SetRequirementCostOverrideCommand`'s header, which states the rule once for both.
		return this.locks.withLevel2(input.requirementId, () => this.write(input));
	}

	private async write(
		input: SetRequirementQuantityOverrideInput,
	): Promise<Result<{ requirement: Requirement; version: EntityVersion }, SetOverrideErrors>> {
		const applied = await applyQuantityOverride(this.requirements, input);
		if (!applied.ok) return applied;
		await publishIfEffectiveCostChanged(
			this.events,
			applied.value.requirement,
			applied.value.previousEffectiveCost,
		);
		return ok({ requirement: applied.value.requirement, version: applied.value.version });
	}
}
