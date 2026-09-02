import type { Logger } from '../application/ports/Logger';
import type { GuardedAssetDesignServices } from './guardedServices';
import type { GuardedAssetPriceServices } from './guardedAssetPrice';
import type { Currency } from '../core/money/Money';
import type { CreateAssetInput } from '../application/commands/asset/CreateAsset';
import type { AppError } from '../core/errors/AppError';
import type { Result } from '../core/result/Result';
import type { Asset } from '../domain/asset/Asset';
import type { CreatePlanInput } from '../application/commands/plan/CreatePlan';
import type { CreateProjectInput } from '../application/commands/project/CreateProject';
import type { Command } from '../application/commands/Command';
import type {
	CreatePlanResult,
	CreateProjectResult,
	RenovationProjectCommandServices,
} from '../presentation/views/renovationProjectCommands';

/**
 * What `renovationProjectDeps` hands the view as its write side — pulled out of that function
 * for line budget alone, exactly as `renovationProjectOpenSeams.ts`'s two doors were and for the
 * identical reason: `composition-root.ts` sat at its 400-line cap, and CLAUDE.md's account of
 * `inspector-wiring.ts` is why the answer is an extraction rather than a second collapsed
 * literal.
 *
 * Nothing about the wiring moved. Every member is the GUARDED service the root composed, which
 * is what puts each of them inside the Error Boundary rather than beside it, and the bundle's
 * own fields are typed structurally precisely so a `guardCommand` wrapper can stand where the
 * class used to.
 *
 * The `persistence` parameter is spelled as the members this needs rather than as
 * `PersistenceServices`, so a caller cannot pass a bundle that merely happens to satisfy a
 * wider type and this module does not import the root's own shape back out of it.
 *
 * Design slice A10's two asset doors and the `defaultCurrency` prefill arrived on the asset
 * designer branch, which built this same object INLINE in `renovationProjectDeps`. The merge
 * kept the extraction and folded those three in here, so the bundle's membership is still
 * decided in one place. Only ONE door of `assetDesign` is handed over — the rest of that
 * bundle belongs to the designer view, and spreading it here would make this a second
 * spelling of it.
 */
export function renovationProjectCommandBundle(
	persistence: GuardedAssetPriceServices & {
		readonly createProject: Command<CreateProjectInput, CreateProjectResult>;
		readonly createPlan: Command<CreatePlanInput, CreatePlanResult>;
		readonly createAsset: Command<CreateAssetInput, Result<Asset, AppError>>;
		readonly assetDesign: GuardedAssetDesignServices['assetDesign'];
		readonly defaultCurrency: Currency;
	},
	logger: Logger,
): RenovationProjectCommandServices {
	return {
		createProject: persistence.createProject,
		createPlan: persistence.createPlan,
		setAssetPriceOverride: persistence.setAssetPriceOverride,
		clearAssetPriceOverride: persistence.clearAssetPriceOverride,
		createAsset: persistence.createAsset,
		setAssetFootprintFromDimensions: persistence.assetDesign.setFootprintFromDimensions,
		logger,
		defaultCurrency: persistence.defaultCurrency,
	};
}
