import { ReversibleCreateZoneCommand } from '../../../application/commands/zone/reversible-create-zone-command';
import { ReversibleDeleteZoneCommand } from '../../../application/commands/zone/reversible-delete-zone-command';
import type { CreateZoneInput } from '../../../application/commands/zone/CreateZone';
import type { DeleteZoneInput } from '../../../application/commands/zone/DeleteZone';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { PlanEditorContext } from '../PlanEditorContext';

/** Shared existing Zone transaction for polygon tools and optional wall-loop Rooms. */
export function createZoneHistory(context: PlanEditorContext, ledger: WriteLedger, input: CreateZoneInput) {
	const commands = context.commands;
	return new ReversibleCreateZoneCommand(commands.createZone, commands.deleteZone, ledger, input,
		{ zones: commands.zones, events: commands.events, requirements: commands.requirementEdits.requirements, logger: commands.logger });
}

/**
 * The Zone delete the Inspector dispatches and a multi-item Delete composes. Slice 10's undo half: the
 * resolution may have deleted or repointed Requirements, and restoring the Zone alone would not be an
 * inverse of that — hence the Requirement port and locks beside the boundary history.
 */
export function deleteZoneHistory(context: PlanEditorContext, ledger: WriteLedger, input: DeleteZoneInput) {
	const commands = context.commands;
	return new ReversibleDeleteZoneCommand(commands.deleteZone, commands.zones, ledger, input, { boundary: commands.structure?.roomHistory(),
		requirements: commands.requirementEdits.requirements, locks: commands.requirementEdits.locks, logger: commands.logger, events: commands.events });
}
