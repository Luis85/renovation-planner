import type { DispatchResult } from '../DispatchOutcome';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import { effectiveValue } from '../../../core/derived/DerivedValue';
import type { EventBus } from '../../../core/events/EventBus';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { EntityVersion } from '../../ports/versioning';
import {
	publishIfEffectiveCostChanged,
	type SetRequirementQuantityOverrideDoor,
	type SetRequirementQuantityOverrideInput,
} from './SetRequirementQuantityOverride';
import type {
	SetRequirementCostOverrideDoor,
	SetRequirementCostOverrideInput,
} from './SetRequirementCostOverride';

/**
 * Structurally the presentation layer's `UndoableCommand` — application code may not name
 * that interface (the layer ban); satisfying it structurally is what lets
 * `CommandHistory.run()` hold it without importing downward.
 */

type Snapshot = { readonly entity: Requirement; readonly postVersion: EntityVersion };

/**
 * Shared mechanics of the two override adapters. Declared as a PAIR of small subclasses
 * rather than one generic the UI picks by type argument: they differ in what `T` is and
 * which command runs, and a shared adapter told how to read and write the field would be
 * more machinery than the two small classes it replaces.
 *
 * What each captures on its FIRST execute is the WHOLE pre-edit requirement, restored on
 * undo — not just the override field, because the quantity command also re-runs the Cost
 * Pipeline and a field-only restore would leave `estimatedCost.calculated` derived from a
 * quantity that no longer exists. The restore is CONDITIONAL: it presents the version its
 * own execute() produced inside the repository's compare-and-swap, so another tab's edit
 * between execute and undo refuses the undo instead of being clobbered by it — and the
 * command stays on the history's stack (slice 6), nothing lost.
 *
 * Redo re-applies the recorded INPUT through the same command instance rather than
 * re-reading what undo just wrote — a snapshot-on-every-execute adapter drifts on the
 * second undo/redo round while looking right on the first.
 *
 * `undo()` restores through the repository port, past the command whose `execute()`
 * already announces its own write — so it was silent on the one figure the read model
 * cares about most: the effective cost. It reads the live requirement's effective cost
 * BEFORE the restore write, then hands both figures to `publishIfEffectiveCostChanged`
 * after the write succeeds — the same helper `SetRequirementQuantityOverrideCommand.write`
 * calls for its own forward write, so an unmoved figure (a cost override undone back to a
 * value equal to what was already calculated) is truthfully silent rather than a gap.
 */
// Internal by construction: the two exported adapters below are its only subclasses, and
// `export`ing it to clear the leak traded those two findings for an `unused-exports` one —
// measured by making the change and re-running `npm run analyze`, not predicted. So the
// report contradicts itself here rather than contradicting a design rule, and the two
// suppressions live on the subclasses, which is where the leak is REPORTED.
abstract class ReversibleOverrideBase<TInput> {
	protected snapshot: Snapshot | undefined;

	constructor(
		private readonly requirements: RequirementRepository,
		/**
		 * Both `run()` calls above dispatch through the plain `SetRequirement*OverrideCommand`
		 * instance, which already announces its OWN write — this bus is for the restore
		 * `undo()` performs straight through the repository port, past that command, exactly
		 * the way `ReversibleAssignAssetCommand.events` exists for its own two silent halves.
		 */
		private readonly events: EventBus,
	) {}

	protected abstract run(input: TInput): Promise<
		Result<{ requirement: Requirement; version: EntityVersion }, AppError>
	>;

	async execute(input: TInput): Promise<DispatchResult> {
		if (!this.snapshot) {
			const before = await this.requirements.getById(this.requirementIdOf(input));
			if (isErr(before)) return err(before.error);
			if (before.value === null) {
				return err({
					category: 'Reference',
					code: 'requirement.not-found',
					message: 'Nothing to override.',
				});
			}
			const ran = await this.run(input);
			if (!ran.ok) return ran;
			// Captured ONCE, after the first successful write — redo reuses it.
			this.snapshot = { entity: before.value.entity, postVersion: ran.value.version };
			return ok('wrote');
		}
		const ran = await this.run(input);
		if (!ran.ok) return ran;
		this.snapshot = { ...this.snapshot, postVersion: ran.value.version };
		return ok('wrote');
	}

	async undo(): Promise<DispatchResult> {
		const captured = this.snapshot;
		if (!captured) {
			return err({ category: 'Domain', code: 'undo.before-execute', message: 'Nothing to undo yet.' });
		}
		// `previous` lives in the LIVE requirement, read before the restore write moves
		// it — the snapshot's own `entity` is the value the restore is about to WRITE, not
		// the one undo is moving away from. Falling back to the snapshot's own figure when
		// the live read comes back empty costs nothing real: the restore below re-presents
		// `captured.postVersion` against a repository that no longer holds this id, which
		// `isErr(saved)` catches before this fallback value is ever published.
		const live = await this.requirements.getById(captured.entity.id);
		if (isErr(live)) return err(live.error);
		const previous = live.value === null
			? effectiveValue(captured.entity.estimatedCost)
			: effectiveValue(live.value.entity.estimatedCost);
		// Whole-entity conditional restore; `null` overrides are VALUES inside the
		// snapshot, so "reset to calculated" undoes back to the typed figure.
		const saved = await this.requirements.save(captured.entity, captured.postVersion);
		if (isErr(saved)) return err(saved.error);
		this.snapshot = { ...captured, postVersion: saved.value.version };
		await publishIfEffectiveCostChanged(this.events, saved.value.entity, previous);
		return ok('wrote');
	}

	protected abstract requirementIdOf(input: TInput): RequirementId;
}

// fallow-ignore-next-line private-type-leak
export class ReversibleSetRequirementQuantityOverrideCommand extends ReversibleOverrideBase<SetRequirementQuantityOverrideInput> {
	constructor(
		private readonly setCommand: SetRequirementQuantityOverrideDoor,
		requirements: RequirementRepository,
		events: EventBus,
	) {
		super(requirements, events);
	}

	protected run(
		input: SetRequirementQuantityOverrideInput,
	): Promise<Result<{ requirement: Requirement; version: EntityVersion }, AppError>> {
		return this.setCommand.executeWithVersion(input);
	}

	protected requirementIdOf(input: SetRequirementQuantityOverrideInput): RequirementId {
		return input.requirementId;
	}
}

// fallow-ignore-next-line private-type-leak
export class ReversibleSetRequirementCostOverrideCommand extends ReversibleOverrideBase<SetRequirementCostOverrideInput> {
	constructor(
		private readonly setCommand: SetRequirementCostOverrideDoor,
		requirements: RequirementRepository,
		events: EventBus,
	) {
		super(requirements, events);
	}

	protected run(
		input: SetRequirementCostOverrideInput,
	): Promise<Result<{ requirement: Requirement; version: EntityVersion }, AppError>> {
		return this.setCommand.executeWithVersion(input);
	}

	protected requirementIdOf(input: SetRequirementCostOverrideInput): RequirementId {
		return input.requirementId;
	}
}
