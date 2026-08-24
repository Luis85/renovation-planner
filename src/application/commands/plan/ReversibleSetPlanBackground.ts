import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { Plan } from '../../../domain/plan/Plan';
import { planError } from '../../../domain/plan/Plan.errors';
import type { PlanBackgroundRef } from '../../../domain/plan/PlanBackgroundRef';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { Loaded } from '../../ports/versioning';
import type {
	SetPlanBackgroundCommand,
	SetPlanBackgroundError,
	SetPlanBackgroundInput,
	SetPlanBackgroundOutcome,
} from './SetPlanBackground';

interface Snapshot {
	readonly plan: Loaded<Plan>;
	readonly previousBackground: PlanBackgroundRef | null;
}

/**
 * The undoable face of `SetPlanBackgroundCommand` — a **snapshot inverse**.
 *
 * Deliberately an ADAPTER around the command rather than a second command: the forward
 * write, its validation and its event have exactly one implementation, and this adds only
 * the memory of what was there before. `CommandHistory` itself is slice 6's; this class is
 * what that history will hold, and it is built here because the command it wraps is built
 * here.
 *
 * Three properties, each of which is the difference between an inverse and an overwrite:
 *
 * 1. **The snapshot is taken before the forward write**, by the command itself — after the
 *    write there is nothing left that remembers the old reference.
 * 2. **The restore is CONDITIONAL on the version the forward write produced**, which it
 *    presents to `save` rather than re-reading to find a current one. Re-reading would be
 *    the check-then-act this design exists to refuse: between the read and the write,
 *    another tab, a synced device or a hand edit could have changed the very field being
 *    restored. Presenting the old version instead means the repository refuses with
 *    `plan.revision-conflict` (another plugin writer) or `plan.external-modification` (a
 *    hand edit that left the revision alone) — two codes because the recoveries differ.
 * 3. **No event is re-emitted.** A background reference is one field on one note with
 *    nothing cascading off it, so there is no second party whose state has to be told.
 *
 * Obligation 3 of slice 6's contract — the compensated-sequence rule — does not apply:
 * this is a single-file write.
 */
export class ReversibleSetPlanBackgroundCommand {
	private snapshot: Snapshot | null = null;

	constructor(
		private readonly forward: SetPlanBackgroundCommand,
		private readonly plans: PlanRepository,
	) {}

	async execute(
		input: SetPlanBackgroundInput,
	): Promise<Result<SetPlanBackgroundOutcome, SetPlanBackgroundError>> {
		const result = await this.forward.execute(input);
		// No snapshot on a failed forward: nothing was written, so there is nothing to undo,
		// and recording one would let an `undo()` write a "restore" for a change that never
		// happened.
		if (isErr(result)) {
			return result;
		}
		this.snapshot = { plan: result.value.plan, previousBackground: result.value.previousBackground };
		return result;
	}

	// Nothing in `src/` calls this yet: `CommandHistory` is slice 6, and this adapter exists
	// so that a history has something to HOLD rather than something to write. Suppressed for
	// the reason `Zone.area()` is — deleting a declared capability because its caller is one
	// slice away is how the declaration rots — and the behaviour itself IS driven, by the
	// undo cases in `tests/application/commands/plan/setPlanBackground.test.ts`.
	// fallow-ignore-next-line unused-class-member
	async undo(): Promise<Result<Loaded<Plan>, SetPlanBackgroundError>> {
		const snapshot = this.snapshot;
		if (snapshot === null) {
			return err(planError('nothing-to-undo', 'This background change has no recorded previous state.'));
		}
		const restored = snapshot.plan.entity.withBackground(snapshot.previousBackground);
		if (isErr(restored)) {
			return restored;
		}
		const saved = await this.plans.save(restored.value, snapshot.plan.version);
		if (isErr(saved)) {
			return saved;
		}
		// Dropped once spent, so a second `undo()` refuses rather than writing the same
		// restore against a version that is now two writes stale. Redo is slice 6's, and it
		// re-runs `execute` from the input the history kept — it does not need this back.
		this.snapshot = null;
		return ok(saved.value);
	}
}
