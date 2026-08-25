import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import { planBackgroundChanged } from '../../../domain/plan/Plan.events';
import { planError } from '../../../domain/plan/Plan.errors';
import { backgroundKindFor, type PlanBackgroundRef } from '../../../domain/plan/PlanBackgroundRef';
import { referenceError } from '../../errors';
import type { Command } from '../Command';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { VaultFileProbe } from '../../ports/VaultFileProbe';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { Loaded } from '../../ports/versioning';
import { loadPlan } from './loadPlan';
import { savePlan } from './savePlan';

export interface SetPlanBackgroundInput {
	readonly planId: PlanId;
	readonly background: PlanBackgroundRef;
}

/**
 * What the caller gets back, and what its inverse needs.
 *
 * `previousBackground` is the snapshot half of the snapshot inverse: taken from the entity
 * this command READ, before it wrote anything, because after the write there is nothing
 * left that remembers it. `null` is a real value here and not an absence — it is what the
 * FIRST import replaced, and restoring it is the case an inverse that treats `null` as
 * "nothing to do" gets wrong while passing every replace-an-existing-background test.
 */
export interface SetPlanBackgroundOutcome {
	readonly plan: Loaded<Plan>;
	readonly previousBackground: PlanBackgroundRef | null;
}

export type SetPlanBackgroundError = ReferenceError | RepositoryError;

/**
 * Point a Plan at the document it is drawn over (SDD §54–55, design slice 5).
 *
 * The only write in design slice 5, and it sits OUTSIDE the render pipeline rather than
 * weakening it: it sets an INPUT the pipeline reads, never something the pipeline
 * produces. No geometry is touched, so this is frontmatter only — one file, one write, no
 * sidecar entry, and therefore neither slice 4's per-plan geometry lock nor a compensating
 * sequence is involved.
 *
 * The referenced file is one already in the Vault and nothing is copied: a user who wants
 * a PDF in their vault puts it there, and Obsidian's own import affordances handle getting
 * it in. Importing from outside the Vault is deliberately out of scope for every slice —
 * it needs file-system access this plugin does not otherwise take.
 *
 * Ordering is not an accident. The file check runs BEFORE the plan is read, so the cheap
 * refusal never costs a vault read; the domain's own validation runs through
 * `withBackground`, so the rules a Plan is CONSTRUCTED under and the rules it is UPDATED
 * under are the same ones. Nothing is written on either failure.
 */
export class SetPlanBackgroundCommand
	implements Command<SetPlanBackgroundInput, Result<SetPlanBackgroundOutcome, SetPlanBackgroundError>>
{
	constructor(
		private readonly plans: PlanRepository,
		private readonly files: VaultFileProbe,
		private readonly events: EventBus,
	) {}

	// The return type is ANNOTATED, not inferred. Inference produces a union of `Result`s —
	// one arm per error type the body can return — which is not the same type as one
	// `Result` over a union of errors, and the difference only shows up in a caller: the
	// reversible adapter could neither narrow it with `isErr` nor pass it through.
	async execute(
		input: SetPlanBackgroundInput,
	): Promise<Result<SetPlanBackgroundOutcome, SetPlanBackgroundError>> {
		// A kind that does not match the path's own extension is refused here rather than
		// left to the domain: `PlanBackgroundRef.kind` is already narrowed to the two the
		// type allows, so this is the only place a `.dwg` — or a PDF labelled as an image —
		// can be caught, and both would otherwise reach `loadBackground` and fail at render.
		const kind = backgroundKindFor(input.background.path);
		if (kind === null || kind !== input.background.kind) {
			return err(
				planError(
					'unsupported-background',
					`"${input.background.path}" is not a supported ${input.background.kind} background.`,
				),
			);
		}
		if (!this.files.fileExists(input.background.path)) {
			return err(
				referenceError('plan.background-not-found', `No vault file at "${input.background.path}".`),
			);
		}

		const found = await loadPlan(this.plans, input.planId);
		if (isErr(found)) {
			return found;
		}

		const loaded = found.value;
		const previousBackground = loaded.entity.background;
		const updated = loaded.entity.withBackground(input.background);
		if (isErr(updated)) {
			return updated;
		}
		// Conditional on the version THIS read returned — the compare-and-write that makes a
		// second writer's edit a refusal rather than a silent overwrite — and one event, on
		// the success path only.
		const saved = await savePlan(this.plans, this.events, updated.value, loaded.version, planBackgroundChanged);
		if (isErr(saved)) {
			return saved;
		}
		return ok({ plan: saved.value, previousBackground });
	}
}
