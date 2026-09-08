import type { StructureServices } from '../application/commands/spatial/StructureCommand';
import type { Logger } from '../application/ports/Logger';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

/** Guard the argument-taking spatial factory and the sidecar read door. */
export function guardedStructure(services: StructureServices, logger: Logger): StructureServices {
	const read = guardCommand({ execute: (id: Parameters<StructureServices['read']>[0]) => services.read(id) }, 'spatial.read.failed', logger, VAULT_EXCEPTION_MAPPER);
	return {
		read: id => read.execute(id),
		roomHistory: () => services.roomHistory(),
		command(input) {
			const command = services.command(input);
			const execute = guardCommand({ execute: () => command.execute() }, 'spatial.execute.failed', logger, VAULT_EXCEPTION_MAPPER);
			const undo = guardCommand({ execute: () => command.undo() }, 'spatial.undo.failed', logger, VAULT_EXCEPTION_MAPPER);
			return { execute: () => execute.execute(undefined), undo: () => undo.execute(undefined) };
		},
	};
}
