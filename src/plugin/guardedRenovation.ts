import type { RenovationServices } from '../application/commands/renovation/RenovationCommand';
import type { Logger } from '../application/ports/Logger';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

export function guardedRenovation(services: RenovationServices, logger: Logger): RenovationServices {
	const read = guardCommand({ execute: (id: Parameters<RenovationServices['read']>[0]) => services.read(id) }, 'renovation.read.failed', logger, VAULT_EXCEPTION_MAPPER);
	return {
		read: id => read.execute(id),
		command(baseline, input, ledger) {
			const command = services.command(baseline, input, ledger);
			const execute = guardCommand({ execute: () => command.execute() }, 'renovation.execute.failed', logger, VAULT_EXCEPTION_MAPPER);
			const undo = guardCommand({ execute: () => command.undo() }, 'renovation.undo.failed', logger, VAULT_EXCEPTION_MAPPER);
			return { execute: () => execute.execute(undefined), undo: () => undo.execute(undefined) };
		},
	};
}
