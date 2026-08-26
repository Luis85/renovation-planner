import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { EntityId } from '../../../core/identity/EntityId';

/**
 * Editor selection state, holding domain IDs only. No Konva node, ref, or shape is
 * reachable from this store. Mapping a selected domain ID to the Konva node it renders as
 * — for a Konva.Transformer to attach visual handles — is a rendering concern that lives
 * in slice 5's render-model lookup, not editor state.
 */
export const useSelectionStore = defineStore('editor-selection', () => {
	const selectedIds = ref<readonly EntityId<string>[]>([]);

	/**
	 * Selecting what is ALREADY selected is a no-op, down to the ref's identity.
	 *
	 * Without that test every assignment is a fresh array, so every watcher on this ref
	 * fires — and `SelectTool.pointerDown` calls `select([hit.id])` unconditionally on
	 * every click that lands on a zone, including the one that starts a drag on the zone
	 * already selected. Each of those re-ran the Inspector query: a note read plus a parse
	 * and a schema validation of the plan's whole geometry sidecar, to arrive at the answer
	 * already on screen.
	 */
	function select(ids: readonly EntityId<string>[]): void {
		const current = selectedIds.value;
		if (current.length === ids.length && current.every((id, index) => id === ids[index])) return;
		selectedIds.value = [...ids];
	}

	function clear(): void {
		if (selectedIds.value.length === 0) return;
		selectedIds.value = [];
	}

	function isSelected(id: EntityId<string>): boolean {
		return selectedIds.value.includes(id);
	}

	return { selectedIds, select, clear, isSelected };
});

/**
 * The contract `EditorContext.selection` hands a tool (design slice 6, Task 8) — exactly
 * the four members the spec's Interfaces & Contracts block declares, and nothing else.
 * Declared here rather than beside that consumer: "a type belongs with the code that
 * PRODUCES it" (CLAUDE.md), and this file is what produces it.
 *
 * **Deliberately NOT `ReturnType<typeof useSelectionStore>`.** That alias — what this
 * export used to be — carries Pinia's whole store machinery (`$patch`, `$state`,
 * `$subscribe`, `$onAction`, `$dispose`) into `EditorContext`, whose entire reason to
 * exist is being "the entire API a tool gets… and nothing else" (SDD §58): a tool could
 * call `context.selection.$dispose()` and take the store out from under every other tool
 * in the editor. `editorContext.test.ts`'s DoD 11 check cannot see that — it scans for
 * repository-shaped NAMES, and `$patch` is not one — so the narrowing is the fix, not a
 * wider matcher.
 *
 * The store still has to satisfy this interface, and nothing at runtime can check a type:
 * `tests/presentation/editor/type-safety.test-d.ts` (the one test file `tsconfig.json`
 * type-checks) passes a `useSelectionStore()` return value where a `SelectionStore` is
 * expected, so a store that drifted from this contract would fail `npm run build`.
 *
 * It carries only domain IDs — no Konva node, ref, or shape type is reachable from it,
 * since nothing in this module imports `konva`/`vue-konva`, including a subpath of either
 * (`tests/presentation/editor/tools/editorContext.test.ts` checks that import absence at
 * this file, plus a required presence — the store's runtime keys stay exactly its four
 * declared members — rather than asserting the wider "or names anything from either",
 * which nothing here checks).
 */
export interface SelectionStore {
	readonly selectedIds: readonly EntityId<string>[];
	select(ids: readonly EntityId<string>[]): void;
	clear(): void;
	isSelected(id: EntityId<string>): boolean;
}
