import type { ValidationError } from '../../core/errors/AppError';
import { isNegative, type Money } from '../../core/money/Money';
import { err, ok, type Result } from '../../core/result/Result';
import type { ProjectId } from '../project/ProjectId';
import type { AssetId } from '../asset/AssetId';
import type { AssetPriceOverrideId } from './AssetPriceOverrideId';
import { assetPriceError } from './AssetPriceOverride.errors';

export interface CreateAssetPriceOverrideProps {
	readonly id: AssetPriceOverrideId;
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly unitCost: Money;
}

/**
 * One project's own price for one shared catalogue Asset (PRD §89, [[Asset library]]'s open
 * definition-of-done item). It replaces the Asset's `unitCost` as an INPUT to the cost
 * pipeline; it does not replace the Requirement's own `estimatedCost.override`, which
 * replaces the pipeline's OUTPUT. Neither can express the other's question.
 *
 * An ENTITY rather than a map on the Project note, and the reason is this codebase's shape:
 * every persisted thing here is one note with an `id`, a `revision` and a conditional write. A
 * map would give the whole collection one revision, so two concurrent price edits would be one
 * lost update — and `save` taking an `Expected` is checked BY THE TYPE, which a map field would
 * quietly satisfy while meaning something weaker.
 *
 * It carries no name. Like `Requirement`, it is a RELATIONSHIP rather than a thing with a name,
 * which is why its note is named by its own id (see `ObsidianAssetPriceOverrideRepository`).
 *
 * **Uniqueness is on the (projectId, assetId) PAIR and is not enforced here.** Ids are ULIDs,
 * so nothing structurally prevents two notes for one pair; the repository's lookup is by pair
 * and a duplicate is a diagnostic plus last-writer-wins. Deliberately not a refusal — the notes
 * are user-editable markdown, and refusing to read a project's prices because a user duplicated
 * a note is worse than reading one of them and saying so.
 */
export class AssetPriceOverride {
	readonly id: AssetPriceOverrideId;
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly unitCost: Money;

	private constructor(props: CreateAssetPriceOverrideProps) {
		this.id = props.id;
		this.projectId = props.projectId;
		this.assetId = props.assetId;
		this.unitCost = props.unitCost;
	}

	/**
	 * **The project's currency is deliberately NOT checked here**, and the reason is which
	 * entity owns the fact. `Project.create` can compare its own `budget` against its own
	 * `currency`; this entity would have to be TOLD the project's — and this constructor is on
	 * the hydration path, so enforcing it here refuses a stranded or hand-edited note at the
	 * READ, making a file the user can see on disk invisible to the plugin. The rule lives at
	 * `SetAssetPriceOverrideCommand`, where a user's intent arrives and where a refusal is
	 * something they can act on.
	 *
	 * What survives here is what this entity can own alone.
	 */
	static create(props: CreateAssetPriceOverrideProps): Result<AssetPriceOverride, ValidationError> {
		// Money itself is signed (ADR-010); a unit price is a FIELD that cannot go below zero,
		// so the guard lives here where the field enters — the split `Asset.create` makes too.
		if (isNegative(props.unitCost)) {
			return err(
				assetPriceError(
					'negative-unit-cost',
					`A unit cost cannot be negative; got ${props.unitCost.amount} ${props.unitCost.currency}.`,
				),
			);
		}
		return ok(new AssetPriceOverride(props));
	}

	/**
	 * Rebuilds through `create`, so an edit re-runs the refusal. `id` is identity.
	 *
	 * Still unconsumed in `src/` — all callers are in tests. `SetAssetPriceOverrideCommand`
	 * (Task 4) is what dispatches it. Suppressed rather than deleted: deleting it is how a
	 * declared capability rots.
	 */
	// fallow-ignore-next-line unused-class-member
	withUnitCost(unitCost: Money): Result<AssetPriceOverride, ValidationError> {
		return AssetPriceOverride.create({ id: this.id, projectId: this.projectId, assetId: this.assetId, unitCost });
	}
}
