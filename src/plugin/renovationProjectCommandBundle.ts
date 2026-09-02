import type { Logger } from '../application/ports/Logger';
import type { GuardedAssetPriceServices } from './guardedServices';
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
 * The `persistence` parameter is spelled as the four members this needs rather than as
 * `PersistenceServices`, so a caller cannot pass a bundle that merely happens to satisfy a
 * wider type and this module does not import the root's own shape back out of it.
 */
export function renovationProjectCommandBundle(
	persistence: GuardedAssetPriceServices & {
		readonly createProject: Command<CreateProjectInput, CreateProjectResult>;
		readonly createPlan: Command<CreatePlanInput, CreatePlanResult>;
	},
	logger: Logger,
): RenovationProjectCommandServices {
	return {
		createProject: persistence.createProject,
		createPlan: persistence.createPlan,
		setAssetPriceOverride: persistence.setAssetPriceOverride,
		clearAssetPriceOverride: persistence.clearAssetPriceOverride,
		logger,
	};
}
