import { ReversibleCreateZoneCommand } from '../../../application/commands/zone/reversible-create-zone-command';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanEditorCommandServices } from '../planEditorCommands';
import type { ToolDispatcher } from '../report-failure';
import type { SelectionStore } from '../selection/selection-store';
import type { RoomDraftStore } from './room-draft-store';

export type RoomCreationOutcome = 'created' | 'invalid' | 'refused' | 'busy' | 'superseded';

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
	/**
	 * The leaf's ONE dispatcher — never `command.execute()` directly, and never the raw
	 * `wrapDispatcher` result either.
	 *
	 * `ToolDispatcher` rather than the structural `{ run(…) }` this used to be, and the
	 * difference is a shipped defect: `wrapDispatcher`'s object satisfies the structural type,
	 * so `runtime.ts` composed this action around it and the compiler said nothing, while
	 * every tool on the same leaf went through `mapDispatchFaults`. The brand's own docblock
	 * calls itself "one the compiler will not let a surface skip" — true only where the
	 * PARAMETER is typed with it, which is the self-declared shape `CLAUDE.md` warns about.
	 */
	readonly dispatcher: ToolDispatcher;
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
 *
 * **A THROWN fault is not caught here, and that is the contract rather than an omission.**
 * `dispatcher` is a `ToolDispatcher`, so its `run` is guaranteed to RESOLVE: a throw below it
 * has already been mapped by `mapDispatchFaults` into a failed `Result` carrying a stamped
 * `PersistenceError`, logged once with its raw cause under the leaf's own event name. That
 * `Result` is indistinguishable in shape from a refusal the command returned, which is
 * precisely what lets this function take one arm for both — `reportRejected` once, `'refused'`
 * back, the draft kept and the task still standing — exactly as the five tools do. A `catch`
 * here would be the second door `mapDispatchFaults` exists to remove.
 *
 * **Cancel stays live while a Create is in flight, and that is a decision.**
 * `cancelActiveTask` clears the draft and switches tools mid-dispatch; the write still lands
 * and the new Room is still selected, because the command was built from the rectangle as it
 * was when Create was pressed and nothing downstream reads the draft again. Disabling Cancel
 * for the length of a vault write would strand a user behind a fault they cannot escape,
 * which is the worse of the two — and a Cancel that could ABANDON the write is not on offer:
 * the dispatch is already past the point an undo entry exists to reverse.
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

	// The task this dispatch belongs to, read BEFORE the await. Everything below that touches
	// the draft is conditional on it still being the current one.
	const token = draft.taskToken;
	draft.setSubmitting(true);
	try {
		const result = await deps.dispatcher.run(command);
		if (!result.ok) {
			deps.reportRejected(result.error);
			return 'refused';
		}
	} finally {
		// Only for the task that opened it. Cancel-and-redraw runs `beginTask`, which sets
		// `submitting` false itself, so clearing it here unconditionally would release a
		// REPLACEMENT task's own in-flight guard and let a second dispatch of it through.
		if (draft.taskToken === token) draft.setSubmitting(false);
	}

	// `null` here means the dispatcher resolved without ever calling `command.execute()` —
	// nothing was drawn to select, but the dispatch still succeeded.
	const createdId = command.createdZoneId;
	if (createdId !== null) deps.selection.select([createdId]);

	/**
	 * The write landed; the TASK it was submitted from is gone. Cancel stays live during a
	 * dispatch by design (see the header), so the user can cancel, reactivate Room and draw
	 * again before this line runs — and every branch below reads or writes the draft, which is
	 * now somebody else's. Reading `draft.keepAdding` here meant obeying the REPLACEMENT
	 * task's checkbox: `beginTask` cleared the rectangle the user had just drawn, or
	 * `returnToSelect` ended a task they had just started.
	 *
	 * It returns AFTER selecting, not before, and that ordering is the behaviour rather than a
	 * detail: the room really was created and selecting it is what the header promises ("the
	 * write still lands and the new Room is still selected"). What is abandoned is only the
	 * task bookkeeping — the part that belongs to a task that no longer exists.
	 */
	if (draft.taskToken !== token) return 'superseded';

	if (draft.keepAdding) {
		// `beginTask` clears the checkbox along with everything else the task holds, so this
		// puts it back — deliberately, and unconditionally, because inside this branch the
		// user's choice IS `true`. It read `const keep = draft.keepAdding` for one increment,
		// which is a variable that can only ever hold the literal it is guarded by.
		draft.beginTask(deps.defaultName());
		draft.setKeepAdding(true);
	} else {
		deps.returnToSelect();
	}
	return 'created';
}
