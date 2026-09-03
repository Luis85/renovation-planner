import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { EventBus } from '../../../core/events/EventBus';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import { assetPriceOverrideChanged } from '../../../domain/asset-price/AssetPriceOverride.events';
import type {
	AssetPriceOverrideRepository,
} from '../../ports/AssetPriceOverrideRepository';
import { winningDuplicate } from '../../ports/AssetPriceOverrideRepository';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import type { Command } from '../Command';
import { expectationMismatch, type PriceRowExpectation } from './priceRowExpectation';

export interface ClearAssetPriceOverrideInput {
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	/** Same field, same reason as `SetAssetPriceOverrideInput.expected`: clearing a pair that
	 *  has moved discards a price the user never saw. */
	readonly expected: PriceRowExpectation;
}

export interface ClearAssetPriceOverrideResult {
	readonly cleared: boolean;
}

export type ClearAssetPriceOverrideErrors = ValidationError | ReferenceError | RepositoryError;

export interface ClearAssetPriceOverrideDeps {
	readonly overrides: AssetPriceOverrideRepository;
	readonly events: EventBus;
	/** Serializes the check-then-act on the pair; see the header. */
	readonly locks: ReferenceLocks;
}

/**
 * Removing a project's own price, so the shared catalogue default applies again.
 *
 * **A pair with no override reports `cleared: false` and announces NOTHING.** Nothing moved,
 * so the cascade it would drive is pure cost — and an announcement for a no-op is exactly how
 * a subscriber comes to recalculate a project's whole requirement set because a user clicked
 * a control twice.
 *
 * **It clears the PAIR, not one note**, and that is the difference between this command and
 * `getForPair`. The read tolerates a duplicated pair and answers one of them, deliberately,
 * because these are user-editable markdown files. Clearing has to be stricter: deleting only
 * the note the read happened to return leaves the other one standing, so the next read still
 * finds an override — the user pressed "use the library price", was told it worked, saw the
 * cascade run, and still has their own price. `cleared: true` must mean the project has no
 * price for this asset.
 *
 * Locked on the pair for the same reason `SetAssetPriceOverrideCommand` is: list-then-delete
 * is check-then-act.
 */
export class ClearAssetPriceOverrideCommand
	implements Command<ClearAssetPriceOverrideInput, Result<ClearAssetPriceOverrideResult, ClearAssetPriceOverrideErrors>>
{
	constructor(private readonly deps: ClearAssetPriceOverrideDeps) {}

	async execute(
		input: ClearAssetPriceOverrideInput,
	): Promise<Result<ClearAssetPriceOverrideResult, ClearAssetPriceOverrideErrors>> {
		const release = await this.deps.locks.acquire([input.projectId, input.assetId], []);
		try {
			// **Filtered rather than `getForPair`, because every note for the pair has to go —
			// and `listByProject`, NOT `listByAsset`, because this command has the project.**
			//
			// An earlier draft read `listByAsset` and filtered by project, arguing list length:
			// "a shared asset is priced by few projects, where a project may hold many assets."
			// That is true and it is the wrong axis to optimise. `listByAsset` calls
			// `loadedEverywhere` — the index has no asset axis, so it cannot be narrowed and
			// hydrates every asset-price note in the VAULT. One malformed note in one unrelated
			// project therefore refuses the hydration, and "Use the library price" stops working
			// for every healthy pair everywhere. `listByProject` calls `loadedInProject`, so the
			// blast radius of a malformed note is the project that contains it.
			//
			// It still finds every DUPLICATE for the pair, which is what `getForPair` cannot do:
			// duplicates are two notes with the same (project, asset), both inside the project's
			// folder, so both are in this list.
			const listed = await this.deps.overrides.listByProject(input.projectId);
			if (isErr(listed)) return listed;
			const forPair = listed.value.filter((o) => o.entity.assetId === input.assetId);
			const winner = winningDuplicate(forPair);

			// The same question the set command asks, against the WINNER — the note the row was
			// rendered from. Clearing a pair that has moved is as much a lost update as
			// overwriting one: the user discards a price they never saw.
			const stale = expectationMismatch(input.expected, winner);
			if (stale) return err(stale);

			// `winningDuplicate` answers null exactly when `forPair` is empty — its reduce starts
			// at `null` and only ever moves off it by finding a candidate — so this doubles as
			// the pair's own "is there anything to clear" rather than a second question next to
			// a `forPair.length === 0` check. An earlier draft asked both, which left the
			// ternary below refusing a `null` `winningDuplicate(forPair)` could never actually
			// answer once this check had already passed: a branch no test could cover because
			// no input could reach it.
			if (winner === null) return ok({ cleared: false });

			// **The WINNER is deleted first, and the order is what makes the rule below true.**
			// `forPair` arrives in index order, so an earlier draft could delete a losing
			// duplicate, fail on the winner, and announce — a project-wide recalculation for an
			// effective price that had not moved at all, under a comment asserting the opposite.
			// Winner first makes `removed` mean what the next paragraph says it means.
			const ordered = [winner, ...forPair.filter((o) => o.entity.id !== winner.entity.id)];

			// **Any write that landed is announced, even when a later one fails.** The rule this
			// file states elsewhere — a failed write must not announce — is about a command that
			// wrote NOTHING. A partial clear has written: the winner is gone, so the effective
			// price has moved to the survivor, and the cascade and every open pane are looking at
			// a figure derived from a note that no longer exists. Returning the failure without
			// the event leaves them there indefinitely, which is worse than the refusal itself.
			let removed = false;
			for (const override of ordered) {
				const deleted = await this.deps.overrides.delete(override.entity.id, override.version);
				if (isErr(deleted)) {
					if (removed) await this.announce(input);
					// Reported rather than swallowed: a partial clear leaves a price in force,
					// and saying `cleared: true` over it is the lie this method exists to avoid.
					return deleted;
				}
				removed = true;
			}

			await this.announce(input);
			return ok({ cleared: true });
		} finally {
			release();
		}
	}

	private async announce(input: ClearAssetPriceOverrideInput): Promise<void> {
		await this.deps.events.publish(
			assetPriceOverrideChanged({ projectId: input.projectId, assetId: input.assetId }),
		);
	}
}
