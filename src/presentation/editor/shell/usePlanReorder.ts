import { computed, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanKind } from '../../../domain/plan/PlanKind';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useEditorRuntime } from '../runtime';
import { useRenovationSession } from '../renovation/renovationSession';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { reportDispatchFailure } from '../report-failure';
import { notifyFault } from '../../notices/notify';
import type { PropertyTreeNode } from '../../read-models/planHierarchy';
// The move arithmetic lives apart from this composable, and its docblock says what that costs
// when it does not: `tests/presentation/editor/shell/usePlanReorder.test.ts` is a node test.
import { plannedWrites } from './planOrderWrites';

/** Where a dragged row would land: beside `planId`, on the edge the pointer is nearer. */
export interface DropTarget { readonly planId: string; readonly edge: 'before' | 'after' }

function siblingsIn(tree: readonly PropertyTreeNode[], parentId: string | null): readonly PropertyTreeNode[] {
	if (parentId === null) return tree;
	for (const node of tree) {
		if (node.id === parentId) return node.children;
		const found = siblingsIn(node.children, parentId);
		if (found.length > 0) return found;
	}
	return [];
}

export function findNode(tree: readonly PropertyTreeNode[], id: string): PropertyTreeNode | undefined {
	for (const node of tree) {
		if (node.id === id) return node;
		const found = findNode(node.children, id);
		if (found) return found;
	}
	return undefined;
}

/**
 * The ONE door every reorder input goes through — the row menu, Alt+↑/↓ and a drop all call
 * `moveUp`/`moveDown`/`moveTo`, never `updatePlanDetails` directly (CLAUDE.md: one action,
 * every input); the Floor inspector's Kind select shares `setKind`. A move is one
 * `UpdatePlanDetails` per changed sibling, in sequence, stopping at the first refusal; not a
 * transaction, and `UpdatePlanDetails`'s docblock says why. After the writes — all of them, or
 * the ones before the refusal — the hierarchy is re-read from the vault rather than reordered
 * locally, so the tree shows what was actually saved, including a half-applied move.
 *
 * `available` is false with no command (the harness index mounts this panel with none) and in
 * review perspective: no menu, no drag, no Alt moves. `paused` is the stale-projection gate
 * (`runtime.writesBlocked`), kept apart because it draws differently — the menu still opens
 * with every entry greyed and titled `editor.stale-write-refused`, the canvas menu's own
 * convention, while drag and Alt+arrows do nothing.
 */
export function usePlanReorder() {
	const context = usePlanEditorContext(), runtime = useEditorRuntime(), session = useRenovationSession(), store = usePlanHierarchyStore();
	const { hierarchy } = storeToRefs(store);
	const command = context.commands.updatePlanDetails;
	const available = computed(() => command !== undefined && session.perspective !== 'review');
	const paused = computed(() => runtime.writesBlocked.value);
	/** A sequence is still writing — `write()` below drops the next input, and the row menu says so instead of dropping it silently. */
	const busy = computed(() => store.writing);

	/**
	 * Resolves to whether EVERY write landed — `false` when refused up front (no command, paused,
	 * or a sequence still in flight) or when one was rejected, which is reported here and nowhere
	 * else. A caller whose control shows the value it asked for (the Floor inspector's Kind
	 * select) needs that answer to put the control back: the re-read below refreshes the
	 * hierarchy, never `ProjectStore.plan`.
	 *
	 * ONE sequence at a time per leaf (`store.writing`, shared by every instance of this
	 * composable): a held Alt+↑ auto-repeats before the re-read lands, and each repeat would
	 * compute the same writes from the stale tree and dispatch them concurrently — the second
	 * sequence's `loadPlan` reading the pre-save version and failing the version check as a
	 * spurious stale-write notice. A press that arrives mid-sequence is DROPPED, not errored;
	 * the flag holds through the re-read so the next accepted press computes from the saved tree —
	 * and through any read that SUPERSEDED that re-read (`store.settled`), since latest-wins would
	 * otherwise return this sequence's own `load` with the older tree still on screen.
	 */
	async function write(writes: readonly { planId: string; kind?: PlanKind; order?: number }[]): Promise<boolean> {
		if (command === undefined || paused.value || store.writing) return false;
		if (writes.length === 0) return true;
		let landed = true;
		store.writing = true;
		try {
			for (const entry of writes) {
				const result = await command.execute({ ...entry, planId: entry.planId as PlanId });
				if (!result.ok) { reportDispatchFailure(result.error); landed = false; break; }
			}
			// The re-read is THIS sequence's own, so a read that throws is reported here — through the
			// door `PlanEditorRoot`'s `loadHierarchy` takes for the reads it starts — rather than left
			// to the `void reorder.moveUp(…)` a key press dispatches, which has no awaiter: that was an
			// unhandled rejection, `writing` never cleared, and the Kind select skipped its reset.
			try {
				await store.load(context.queries, context.planId);
			} catch (cause) {
				notifyFault(cause, context.commands.logger, 'editor.hierarchy.failed');
				landed = false;
			}
			await store.settled();
		} finally {
			store.writing = false;
		}
		return landed;
	}
	function siblingsOf(id: string): readonly PropertyTreeNode[] {
		const node = findNode(hierarchy.value.tree, id);
		return node ? siblingsIn(hierarchy.value.tree, node.parentId) : [];
	}
	/**
	 * A move re-reads the hierarchy, and Vue's keyed diff then MOVES the `li` in the DOM
	 * (`insertBefore`), which drops focus from a focused row to `body`. So the row that held focus
	 * before the writes is remembered, and once the tree has settled the MOVED row is focused —
	 * only when focus is now on `body`/`null`, which is what the drop leaves behind. A move
	 * is N sequential writes plus a re-read, and focus the user put anywhere else in that window
	 * is theirs: it is never pulled back. Scoped to the remembered row's own tree, since two
	 * leaves draw the same ids; with focus outside every tree at the start, nothing happens.
	 */
	async function moveTo(id: string, index: number): Promise<void> {
		const row = document.activeElement?.closest<HTMLElement>('[role="treeitem"]') ?? null;
		await write(plannedWrites(siblingsOf(id), id, index));
		await nextTick();
		const active = document.activeElement;
		if (row && (active === null || active === document.body)) {
			row.closest('[role="tree"]')?.querySelector<HTMLElement>(`[data-rp-plan-id="${id}"]`)?.focus();
		}
	}
	function moveBy(id: string, delta: number): Promise<void> {
		const index = siblingsOf(id).findIndex((node) => node.id === id);
		return index < 0 ? Promise.resolve() : moveTo(id, index + delta);
	}
	return {
		available,
		paused,
		busy,
		siblingsOf,
		moveUp: (id: string) => moveBy(id, -1),
		moveDown: (id: string) => moveBy(id, 1),
		moveTo,
		setKind: (id: string, kind: PlanKind) => write([{ planId: id, kind }]),
	};
}
