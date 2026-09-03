import { ref, type Ref } from 'vue';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { CommandHistory } from './command-history';
import type { RefreshedHistory } from './with-state-refresh';

/**
 * The ONE dispatcher a leaf hands out — tools, the shell's own action buttons and panels
 * alike — wrapped so the history-flag mirror hears about a tool gesture as well as an
 * Undo/Redo click. A dispatch that bypasses this object silently breaks the reactive
 * undo/redo flags and nothing errors.
 *
 * Two plain refs re-read from the history rather than an invalidation counter that two
 * computeds subscribed to with a `void revision.value` statement: that spelling put a line
 * with no visible effect above each `return`, and any tidy-up of it froze the Undo/Redo
 * buttons in whatever state they had at mount with nothing erroring.
 *
 * `finally`, not the resolved path: an unexpected technical fault can still leave the stacks
 * moved (SDD §65), and flags that stop tracking after one throw are wrong for the rest of
 * the leaf's life.
 *
 * Shared by both editing surfaces rather than copied into the second one: the rule above is a
 * property of `CommandHistory`'s three doors and of nothing either leaf knows about its own
 * subject, and two copies of a `finally` this subtle is how one of them loses it.
 */
export function wrapDispatcher(
	history: Pick<CommandHistory, 'canUndo' | 'canRedo'>,
	dispatcher: RefreshedHistory,
): {
	readonly dispatcher: RefreshedHistory;
	readonly canUndo: Ref<boolean>;
	readonly canRedo: Ref<boolean>;
} {
	const canUndo = ref(history.canUndo);
	const canRedo = ref(history.canRedo);
	async function stepping(operation: () => Promise<DispatchResult>): Promise<DispatchResult> {
		try {
			return await operation();
		} finally {
			canUndo.value = history.canUndo;
			canRedo.value = history.canRedo;
		}
	}
	return {
		dispatcher: {
			run: (command) => stepping(() => dispatcher.run(command)),
			undo: () => stepping(() => dispatcher.undo()),
			redo: () => stepping(() => dispatcher.redo()),
		},
		canUndo,
		canRedo,
	};
}
