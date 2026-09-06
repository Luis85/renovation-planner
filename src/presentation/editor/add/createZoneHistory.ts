import { ReversibleCreateZoneCommand } from '../../../application/commands/zone/reversible-create-zone-command';
import type { CreateZoneInput } from '../../../application/commands/zone/CreateZone';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { PlanEditorContext } from '../PlanEditorContext';

/** Shared existing Zone transaction for polygon tools and optional wall-loop Rooms. */
export function createZoneHistory(context: PlanEditorContext, ledger: WriteLedger, input: CreateZoneInput) {
	const commands = context.commands;
	return new ReversibleCreateZoneCommand(commands.createZone, commands.deleteZone, ledger, input,
		{ zones: commands.zones, events: commands.events, requirements: commands.requirementEdits.requirements, logger: commands.logger });
}
