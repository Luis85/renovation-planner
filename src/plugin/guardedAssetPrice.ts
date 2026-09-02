import type { Result } from '../core/result/Result';
import type { Command } from '../application/commands/Command';
import type { Query } from '../application/queries/Query';
import type { Logger } from '../application/ports/Logger';
import type { RepositoryError } from '../application/ports/repositoryErrors';
import type { VaultExceptionMapper } from '../application/errors/exceptionMapper';
import { guardCommand, guardQuery } from '../application/errors/guardAgainstThrowing';
import type { ListProjectAssetPrices, AssetPriceRowDto } from '../application/queries/ListProjectAssetPrices';
import type {
	SetAssetPriceOverrideCommand,
	SetAssetPriceOverrideInput,
	SetAssetPriceOverrideResult,
	SetAssetPriceOverrideErrors,
} from '../application/commands/asset-price/SetAssetPriceOverride';
import type {
	ClearAssetPriceOverrideCommand,
	ClearAssetPriceOverrideInput,
	ClearAssetPriceOverrideResult,
	ClearAssetPriceOverrideErrors,
} from '../application/commands/asset-price/ClearAssetPriceOverride';
import type { ProjectId } from '../domain/project/ProjectId';

/**
 * The asset-price half of `guardedServices.ts`, moved out at the merge of the per-project
 * price override and the asset designer increments.
 *
 * **A budget bought back by reformatting is a budget that has already been spent**, which is
 * `runtime.ts`'s own recorded lesson and the reason this is an extraction rather than a
 * collapsed literal: both increments added a guarded bundle to that file and the merged tree
 * measured 427 counted lines against a 400 cap. The seam is the one the file already draws —
 * one guarded GROUP per bundle, composed and guarded in one place — so this module is a
 * whole group rather than whatever happened to fit.
 *
 * Nothing about the guarding moved. `VAULT_EXCEPTION_MAPPER` stays in `guardedServices.ts`
 * because it is the one instance every group shares, and it reaches this module the way it
 * reaches every other caller: as the `map` argument the composition root passes.
 */
/**
 * A project's own price for a shared catalogue Asset, guarded — the write pair and the read
 * side the price section renders. Held as its own interface rather than folded into
 * `GuardedSlice10Services`: the two commands and the query are composed directly at the root
 * (the repository they need was already there since Task 5, so nothing new is built beneath
 * them), and a bundle guarded together here is what keeps that composition and its guard in
 * one place, the same discipline every other guarded group in this file already keeps.
 */
export interface GuardedAssetPriceServices {
	readonly setAssetPriceOverride: Command<SetAssetPriceOverrideInput, Result<SetAssetPriceOverrideResult, SetAssetPriceOverrideErrors>>;
	readonly clearAssetPriceOverride: Command<ClearAssetPriceOverrideInput, Result<ClearAssetPriceOverrideResult, ClearAssetPriceOverrideErrors>>;
	readonly listProjectAssetPrices: Query<ProjectId, Result<AssetPriceRowDto[], RepositoryError>>;
}

/**
 * Wraps the three raw collaborators `composeGuarded` constructs beside its other one-off
 * commands — `guardCommand`/`guardQuery`, exactly as every neighbour in this file uses them,
 * each under its own event name so a fault names the door it crossed.
 */
export function guardAssetPriceServices(
	unguarded: {
		setAssetPriceOverride: SetAssetPriceOverrideCommand;
		clearAssetPriceOverride: ClearAssetPriceOverrideCommand;
		listProjectAssetPrices: ListProjectAssetPrices;
	},
	logger: Logger,
	map: VaultExceptionMapper,
): GuardedAssetPriceServices {
	return {
		setAssetPriceOverride: guardCommand(
			unguarded.setAssetPriceOverride,
			'command.setAssetPriceOverride.failed',
			logger,
			map,
		),
		clearAssetPriceOverride: guardCommand(
			unguarded.clearAssetPriceOverride,
			'command.clearAssetPriceOverride.failed',
			logger,
			map,
		),
		listProjectAssetPrices: guardQuery(
			unguarded.listProjectAssetPrices,
			'query.listProjectAssetPrices.failed',
			logger,
			map,
		),
	};
}
