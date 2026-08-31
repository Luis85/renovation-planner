import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { isErr } from '../../../core/result/Result';
import type { RefreshedHistory } from '../tools/with-editor-state-refresh';
import type { useSaveStateStore } from './save-state-store';
import { affectsSaveState } from './affects-save-state';

export type SaveStateTracker = Pick<
	ReturnType<typeof useSaveStateStore>,
	'beginSaving' | 'resolveOk' | 'resolveErr' | 'resolveNeutral'
>;

/**
 * Drive the save indicator from the dispatcher slice 6 already defines, without changing
 * `CommandHistory` itself.
 *
 * **All three writing operations are wrapped, not just `run`.** `undo` and `redo` each
 * execute a command, and each performs a repository write — slice 8's reversible delete
 * writes a snapshot back through the repository on undo. A decorator covering `run` alone
 * would leave the indicator reading `saved` throughout an in-flight undo and, worse, after
 * an undo that failed with a `PersistenceError`. The rule the indicator exists to express is
 * "is this Plan's data safely written", and an undo is a write like any other.
 *
 * Transparent: every wrapped method returns exactly what the wrapped history resolved.
 * `canUndo`, `canRedo` and `clear` are not part of `RefreshedHistory` and write nothing, so
 * they have no save state to report.
 *
 * `RefreshedHistory` is slice 8's own alias for `Pick<CommandHistory, 'run' | 'undo' |
 * 'redo'>` and is IMPORTED rather than restated. The spec called this shape
 * `TrackedHistory`; two names for one type in sibling directories is the defect slice 8
 * recorded under "There is ONE `EditorContext`".
 */
export function withSaveStateTracking(
	history: RefreshedHistory,
	saveState: SaveStateTracker,
): RefreshedHistory {
	const track = async (operation: () => Promise<DispatchResult>): Promise<DispatchResult> => {
		saveState.beginSaving();
		try {
			const result = await operation();
			// **Three outcomes, and `ok` decides only two of them.** A success that wrote nothing
			// is neutral, exactly like a pre-write refusal: the store's rule is that only a write
			// which actually succeeded may clear a `save-error`, and inferring one from a resolved
			// `Result` is what broke it. Assigning an asset already assigned to the selected zone
			// is `ok` from a read, and it used to settle the indicator to `Saved` over data a real
			// persistence failure had left unwritten. The command reports which it was now
			// (`DispatchOutcome`); nothing here infers it.
			if (!isErr(result)) {
				if (result.value === 'no-write') saveState.resolveNeutral();
				else saveState.resolveOk();
			}
			// A refusal that never reached the repository wrote NOTHING, so it is neither a
			// failure to report nor evidence that anything was saved. Resolving it as `ok` would
			// let a validation refusal clear a `save-error` left by a real persistence failure.
			else if (affectsSaveState(result.error)) saveState.resolveErr();
			else saveState.resolveNeutral();
			return result;
		} catch (cause) {
			// **A THROWN fault settles the batch too, and forgetting this is worse than
			// misreporting.** SDD §65 reserves throws for technical faults and the dispatcher
			// propagates them — `withEditorStateRefresh` re-throws unchanged and `runtime.ts`'s
			// `reportFault` is what catches them. Decrementing only on resolution would leave
			// `pendingCount` permanently above zero: the indicator stuck on `saving` forever and
			// every later batch unsettleable, which is a DEAD indicator rather than a wrong one.
			//
			// `resolveErr` rather than `resolveOk` for the reason `affectsSaveState` defaults the
			// way it does: a fault says nothing about whether the write landed, and "we might not
			// have written your data" is the safe answer while nobody knows.
			//
			// Re-thrown UNCHANGED, because mapping and reporting it belongs to `reportFault`, and
			// a decorator that swallowed it would turn a fault into silence.
			saveState.resolveErr();
			throw cause;
		}
	};

	return {
		run: (command) => track(() => history.run(command)),
		undo: () => track(() => history.undo()),
		redo: () => track(() => history.redo()),
	};
}
