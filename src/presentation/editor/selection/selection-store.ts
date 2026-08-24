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

	function select(ids: readonly EntityId<string>[]): void {
		selectedIds.value = [...ids];
	}

	function clear(): void {
		selectedIds.value = [];
	}

	function isSelected(id: EntityId<string>): boolean {
		return selectedIds.value.includes(id);
	}

	return { selectedIds, select, clear, isSelected };
});

/**
 * The store's own type, exported for a consumer outside the `useSelectionStore()` call
 * site — `EditorContext.selection` (design slice 6, Task 8). Declared here rather than
 * beside that consumer: "a type belongs with the code that PRODUCES it" (CLAUDE.md), and
 * this file is what produces it. It carries only domain IDs and Pinia's own store
 * machinery — no Konva node, ref, or shape type is reachable from it, since nothing in
 * this module imports `konva`/`vue-konva`, including a subpath of either
 * (`tests/presentation/editor/tools/editorContext.test.ts` checks that import absence at
 * this file, plus a required presence — the store's runtime keys stay exactly its four
 * declared members — rather than asserting the wider "or names anything from either",
 * which nothing here checks).
 */
export type SelectionStore = ReturnType<typeof useSelectionStore>;
