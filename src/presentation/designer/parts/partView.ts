import { ref, type Ref } from 'vue';

/**
 * One designer leaf's Parts-panel view preferences (AD09 item 3): which graphics are hidden, which
 * are locked against editing, and which group rows are collapsed.
 *
 * **Transient, leaf-local and never written.** This holds ids and nothing else — no shape, no
 * command, no port — which is the structural half of criterion 3: hiding a graphic while drawing
 * cannot take it out of the stored shape, so plan placement, the library mark and every quantity
 * derived from the asset go on reading exactly what they read before. Nothing here survives a
 * reopened leaf either, which is right: an editing aid is not output (C10).
 *
 * Per LEAF for `multiSelectionMode`'s reason — two designers on two assets must not share a hidden
 * set, and two panes on one asset are still two workspaces.
 *
 * Ids are never recycled (`nextDetailId` answers one above the HIGHEST suffix, not the count), so an
 * id left behind by a deleted graphic can never come to mean a different one; there is no pruning
 * here and none is owed.
 */
export interface PartView {
	/** Graphic ids the canvas does not draw. Isolation writes the same set, so the canvas asks ONE question. */
	readonly hidden: Ref<ReadonlySet<string>>;
	/** Graphic ids a canvas gesture may select but not move. */
	readonly locked: Ref<ReadonlySet<string>>;
	/** Group ids whose member rows are folded away. A group is EXPANDED by default, so an unknown id reads as expanded. */
	readonly collapsed: Ref<ReadonlySet<string>>;
	readonly toggleHidden: (id: string) => void;
	readonly toggleLocked: (id: string) => void;
	readonly toggleGroup: (groupId: string) => void;
	/** Hide every graphic but this one. REPLACES the hidden set, so two isolations in a row do not accumulate. */
	readonly isolate: (id: string, everyId: readonly string[]) => void;
	/** Unhide everything, locks untouched — a user who wanted to see the object did not ask to unlock it. */
	readonly showAll: () => void;
}

/** A NEW set on every write: `ref` compares by identity, so mutating the stored one updates no reader. */
function toggleIn(set: Ref<ReadonlySet<string>>, id: string): void {
	const next = new Set(set.value);
	if (!next.delete(id)) next.add(id);
	set.value = next;
}

export function createPartView(): PartView {
	const hidden = ref<ReadonlySet<string>>(new Set());
	const locked = ref<ReadonlySet<string>>(new Set());
	const collapsed = ref<ReadonlySet<string>>(new Set());
	return {
		hidden,
		locked,
		collapsed,
		toggleHidden: (id) => toggleIn(hidden, id),
		toggleLocked: (id) => toggleIn(locked, id),
		toggleGroup: (groupId) => toggleIn(collapsed, groupId),
		isolate: (id, everyId) => {
			hidden.value = new Set(everyId.filter((member) => member !== id));
		},
		showAll: () => {
			hidden.value = new Set();
		},
	};
}
