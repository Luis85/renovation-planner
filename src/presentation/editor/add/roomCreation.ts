import { ReversibleCreateZoneCommand } from '../../../application/commands/zone/reversible-create-zone-command';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanEditorCommandServices } from '../planEditorCommands';
import type { SelectionStore } from '../selection/selection-store';
import type { UndoableCommand } from '../tools/undoable-command';
import type { RoomDraftStore } from './room-draft-store';

export type RoomCreationOutcome = 'created' | 'invalid' | 'refused' | 'busy';

/**
 * `createRoomFromDraft`'s collaborators (design spec §5.2's ONE action). `commands` is
 * widened past `'createZone' | 'deleteZone' | 'zones'` alone: `ReversibleCreateZoneCommand`
 * takes a fifth `ReversibleCreateZoneDeps` argument the polygon path already builds from
 * `context.commands.events` / `.requirementEdits.requirements` / `.logger`
 * (`registerEditorTools.ts`), so this action needs exactly the same members — never the
 * whole `requirementEdits` bundle, which also carries the assign and override commands this
 * action never touches.
 */
export interface RoomCreationDeps {
	readonly planId: PlanId;
	readonly commands: Pick<PlanEditorCommandServices, 'createZone' | 'deleteZone' | 'zones' | 'events' | 'logger'> & {
		readonly requirementEdits: Pick<PlanEditorCommandServices['requirementEdits'], 'requirements'>;
	};
	readonly ledger: WriteLedger;
	/** The leaf's ONE dispatcher (`EditorRuntime.dispatcher`, wrapped) — never `command.execute()` directly. */
	readonly dispatcher: { run(command: UndoableCommand): Promise<DispatchResult> };
	readonly draft: RoomDraftStore;
	readonly selection: Pick<SelectionStore, 'select'>;
	/** The next counted name (`Room 2`, …), read again for the task `keepAdding` restarts. */
	readonly defaultName: () => string;
	readonly returnToSelect: () => void;
	readonly reportRejected: (error: AppError) => void;
}

/**
 * The one action a room draft dispatches through (design spec §5.2): validate, build a
 * `ReversibleCreateZoneCommand` from the draft's rectangle, dispatch it through the leaf's
 * one dispatcher, and either select what was drawn and restart the task (`keepAdding`) or
 * return to Select.
 *
 * `draft.submitting` is both the guard and the state a second call while the first is in
 * flight is dropped by (`'busy'`) — set synchronously before the one `await`, so two calls
 * issued in the same tick cannot both pass the guard.
 */
export async function createRoomFromDraft(deps: RoomCreationDeps): Promise<RoomCreationOutcome> {
	const { draft } = deps;
	if (draft.submitting) return 'busy';
	const geometry = draft.geometry;
	if (!draft.valid || geometry === null) return 'invalid';

	const command = new ReversibleCreateZoneCommand(
		deps.commands.createZone,
		deps.commands.deleteZone,
		deps.ledger,
		{ planId: deps.planId, name: draft.name.trim(), zoneType: 'Room', geometry },
		{
			zones: deps.commands.zones,
			events: deps.commands.events,
			requirements: deps.commands.requirementEdits.requirements,
			logger: deps.commands.logger,
		},
	);

	draft.setSubmitting(true);
	try {
		const result = await deps.dispatcher.run(command);
		if (!result.ok) {
			deps.reportRejected(result.error);
			return 'refused';
		}
	} finally {
		draft.setSubmitting(false);
	}

	// `null` here means the dispatcher resolved without ever calling `command.execute()` —
	// nothing was drawn to select, but the dispatch still succeeded.
	const createdId = command.createdZoneId;
	if (createdId !== null) deps.selection.select([createdId]);

	if (draft.keepAdding) {
		const keep = draft.keepAdding;
		draft.beginTask(deps.defaultName());
		draft.setKeepAdding(keep);
	} else {
		deps.returnToSelect();
	}
	return 'created';
}
