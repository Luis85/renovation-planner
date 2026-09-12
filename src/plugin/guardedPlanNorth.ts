import type { PlanNorthServices } from '../application/commands/plan/SetPlanNorth';
import type { Logger } from '../application/ports/Logger';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

/** The argument-taking factory is guarded at both of its history doors, as `guardedReferencePlan` is. */
export function guardedPlanNorth(services: PlanNorthServices, logger: Logger): PlanNorthServices {
	return {
		command(planId, north) {
			const command = services.command(planId, north);
			const execute = guardCommand({ execute: () => command.execute() }, 'plan-north.execute.failed', logger, VAULT_EXCEPTION_MAPPER);
			const undo = guardCommand({ execute: () => command.undo() }, 'plan-north.undo.failed', logger, VAULT_EXCEPTION_MAPPER);
			return { execute: () => execute.execute(undefined), undo: () => undo.execute(undefined) };
		},
	};
}
