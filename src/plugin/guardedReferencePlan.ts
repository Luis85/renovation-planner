import type { ReferencePlanServices } from '../application/commands/plan/ConfigurePlanReference';
import type { Logger } from '../application/ports/Logger';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

/** The argument-taking factory is guarded at both of its history doors. */
export function guardedReferencePlan(services: ReferencePlanServices, logger: Logger): ReferencePlanServices {
	const read = guardCommand({ execute: (id: Parameters<ReferencePlanServices['read']>[0]) => services.read(id) }, 'reference.read.failed', logger, VAULT_EXCEPTION_MAPPER);
	return {
		read: id => read.execute(id),
		command(baseline, input) {
			const command = services.command(baseline, input);
			const execute = guardCommand({ execute: () => command.execute() }, 'reference.execute.failed', logger, VAULT_EXCEPTION_MAPPER);
			const undo = guardCommand({ execute: () => command.undo() }, 'reference.undo.failed', logger, VAULT_EXCEPTION_MAPPER);
			return { execute: () => execute.execute(undefined), undo: () => undo.execute(undefined) };
		},
	};
}
