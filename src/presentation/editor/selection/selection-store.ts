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
