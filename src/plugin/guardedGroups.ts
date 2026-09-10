import type { GroupGeometryServices } from '../application/commands/spatial/GroupGeometryCommand';
import type { Logger } from '../application/ports/Logger';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

export function guardedGroups(services: GroupGeometryServices, logger: Logger): GroupGeometryServices {
	const reader = guardCommand({ execute: (id: Parameters<GroupGeometryServices['read']>[0]) => services.read(id) }, 'group.read.failed', logger, VAULT_EXCEPTION_MAPPER);
	return { read: id => reader.execute(id), command: input => {
		const operation = services.command(input);
		const forward = guardCommand({ execute: () => operation.execute() }, 'group.execute.failed', logger, VAULT_EXCEPTION_MAPPER);
		const backward = guardCommand({ execute: () => operation.undo() }, 'group.undo.failed', logger, VAULT_EXCEPTION_MAPPER);
		return { execute: () => forward.execute(undefined), undo: () => backward.execute(undefined) };
	} };
}
