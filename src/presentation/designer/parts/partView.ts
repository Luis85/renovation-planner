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
 * **Ids ARE recycled, so this is pruned.** `nextDetailId` and `nextGroupId` answer one above the
 * highest suffix still PRESENT: deleting the topmost graphic frees its id for the next one drawn, and
 * ungrouping the only group frees `group-1` for the next Group. An id this held for the old part would
 * then be born hidden, locked or collapsed — a new group folded away the moment it was made, hiding the
 * very rows just grouped (AD18-R17 Task 3's review). `prune` forgets every id the design no longer
 * has, and `DesignerPartsPanel` calls it on every read-back, because that panel is mounted whenever a
 * design is drawn and already derives the design's graphic and group ids for its rows.
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
	/** Forget every graphic and group id the design no longer has. A set it forgets nothing from is left as it is. */
	readonly prune: (graphics: ReadonlySet<string>, groups: ReadonlySet<string>) => void;
}

/** A NEW set on every write: `ref` compares by identity, so mutating the stored one updates no reader. */
function toggleIn(set: Ref<ReadonlySet<string>>, id: string): void {
	const next = new Set(set.value);
	if (!next.delete(id)) next.add(id);
	set.value = next;
}

/** Keep only the ids `present` names, writing a new set only when one went — so a read-back that changed nothing re-renders nothing. */
function keepIn(set: Ref<ReadonlySet<string>>, present: ReadonlySet<string>): void {
	const next = new Set([...set.value].filter((id) => present.has(id)));
	if (next.size !== set.value.size) set.value = next;
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
		prune: (graphics, groups) => {
			keepIn(hidden, graphics);
			keepIn(locked, graphics);
			keepIn(collapsed, groups);
		},
	};
}
