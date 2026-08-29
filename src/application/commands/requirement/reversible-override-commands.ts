import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { DispatchOutcome } from '../DispatchOutcome';
import type { AppError } from '../../../core/errors/AppError';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { EntityVersion } from '../../ports/versioning';
import type {
	SetRequirementQuantityOverrideDoor,
	SetRequirementQuantityOverrideInput,
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
 */
abstract class ReversibleOverrideBase<TInput> {
	protected snapshot: Snapshot | undefined;

	constructor(
		private readonly requirements: RequirementRepository,
	) {}

	protected abstract run(input: TInput): Promise<
		Result<{ requirement: Requirement; version: EntityVersion }, AppError>
	>;

	async execute(input: TInput): Promise<Result<DispatchOutcome, AppError>> {
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

	async undo(): Promise<Result<DispatchOutcome, AppError>> {
		const captured = this.snapshot;
		if (!captured) {
			return err({ category: 'Domain', code: 'undo.before-execute', message: 'Nothing to undo yet.' });
		}
		// Whole-entity conditional restore; `null` overrides are VALUES inside the
		// snapshot, so "reset to calculated" undoes back to the typed figure.
		const saved = await this.requirements.save(captured.entity, captured.postVersion);
		if (isErr(saved)) return err(saved.error);
		this.snapshot = { ...captured, postVersion: saved.value.version };
		return ok('wrote');
	}

	protected abstract requirementIdOf(input: TInput): RequirementId;
}

export class ReversibleSetRequirementQuantityOverrideCommand extends ReversibleOverrideBase<SetRequirementQuantityOverrideInput> {
	constructor(
		private readonly setCommand: SetRequirementQuantityOverrideDoor,
		requirements: RequirementRepository,
	) {
		super(requirements);
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

export class ReversibleSetRequirementCostOverrideCommand extends ReversibleOverrideBase<SetRequirementCostOverrideInput> {
	constructor(
		private readonly setCommand: SetRequirementCostOverrideDoor,
		requirements: RequirementRepository,
	) {
		super(requirements);
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
