import { ref, type Ref } from 'vue';

/**
 * One tab stop for a list of any length, with the arrows moving inside it (design spec §7).
 *
 * **Roving exists to bound an UNBOUNDED set, and that is the whole of when to reach for it.** A
 * vault of thirty projects must not cost thirty tabs to walk past; every other control on this
 * surface is a small bounded set with no such problem, so none of them is in a roving group.
 *
 * **The rows stay ordinary `<button>`s.** A `role="listbox"` was considered and refused: a
 * listbox option may not contain its own controls, and the row's facts and warning are content
 * a listbox would flatten into one string. Roving `tabindex` over buttons gets the same
 * navigation with none of that cost — Enter activation stays the browser's own.
 *
 * `onKeydown` answers whether it CONSUMED the key, so a caller can fall through to its own
 * handling for everything else — the printable-character seeding, on this surface — rather
 * than this module having to know about it.
 */
/**
 * Exported by NAME rather than left as a `ReturnType<typeof useRovingFocus>` at the call sites:
 * `ProjectList` passes a controller as a parameter (two groups, one handler), and an exported
 * signature naming a type its own module does not export is the `private-type-leak` `fallow`
 * reports as an `error` here.
 */
export interface RovingFocus {
	activeIndex: Ref<number>;
	onKeydown: (event: KeyboardEvent) => boolean;
	syncFromFocus: (event: FocusEvent) => void;
	reconcile: (ids: readonly string[]) => void;
	focusFirst: () => void;
}

/** The id a row's roving key is drawn from — `data-project-id`, which every row carries. */
function keyOf(element: HTMLElement | undefined): string | null {
	return element?.dataset.projectId ?? null;
}

export function useRovingFocus(container: Ref<HTMLElement | null>, selector: string): RovingFocus {
	const activeIndex = ref(0);
	/**
	 * WHICH ROW the index means, so a filtered list can put the tab stop back on it. A plain
	 * local rather than a `ref`: nothing renders it, and making it reactive would re-run the
	 * consumers that read `activeIndex`.
	 */
	let activeKey: string | null = null;

	function members(): HTMLElement[] {
		const root = container.value;
		return root === null ? [] : Array.from(root.querySelectorAll<HTMLElement>(selector));
	}

	function focusAt(index: number): void {
		const all = members();
		// CLAMPED rather than wrapped. ArrowUp at the top of a thirty-row list jumping to the
		// bottom reads as the pane having scrolled somewhere the user did not ask to go.
		const next = Math.max(0, Math.min(index, all.length - 1));
		activeIndex.value = next;
		activeKey = keyOf(all[next]);
		all[next]?.focus();
	}

	return {
		activeIndex,

		/**
		 * **The index follows the FOCUS, and without this it followed only its own arrows.**
		 * `activeIndex` was written by `focusAt` and `reconcile` alone, so a row focused any other
		 * way — a click, a Tab into the middle of the list, a programmatic focus — left it
		 * pointing at the previously active row. Two things broke together: an arrow then moved
		 * relative to that stale row, and the `tabindex="0"` stayed on the wrong row, so
		 * shift-tabbing back into the list returned to the wrong place.
		 *
		 * ONE listener on the CONTAINER (`@focusin`), not one per row: `focusin` bubbles, a
		 * per-row binding is a list that goes stale at the next row kind, and this one call site
		 * covers every path focus can arrive by — the arrows included, where it is a harmless
		 * write of the value `focusAt` just set.
		 */
		syncFromFocus(event: FocusEvent): void {
			const all = members();
			const index = all.indexOf(event.target as HTMLElement);
			if (index === -1) return;
			activeIndex.value = index;
			activeKey = keyOf(all[index]);
		},

		onKeydown(event: KeyboardEvent): boolean {
			// A modified arrow belongs to the host — Obsidian binds several — so only the bare
			// key moves focus here.
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
			if (event.key === 'ArrowDown') {
				focusAt(activeIndex.value + 1);
				return true;
			}
			if (event.key === 'ArrowUp') {
				focusAt(activeIndex.value - 1);
				return true;
			}
			return false;
		},

		/**
		 * Keep the tab stop on the SAME ROW when the list changes under it — which is what the
		 * filter does on every keystroke.
		 *
		 * An index-only clamp is not enough, and the case it misses is ordinary rather than
		 * exotic: with `[A, B, C]` and B active at index 1, a query matching only `[B, C]`
		 * leaves 1 in range, so nothing is clamped and **C** silently becomes the tab stop while
		 * B is the row the user was on. Tabbing back into the results then lands past the row
		 * they left. Clamping still matters for the shorter case — an index past the end leaves
		 * the group with NO member carrying `tabindex="0"`, so it stops being Tab-reachable at
		 * all — so this does both: follow the id when it survived, clamp when it did not.
		 *
		 * `ids` rather than a length, and rather than reading the DOM: this runs from a
		 * `watch` on the filtered list, BEFORE Vue has patched the rows, so `members()` would
		 * still answer the old ones.
		 */
		reconcile(ids: readonly string[]): void {
			const surviving = activeKey === null ? -1 : ids.indexOf(activeKey);
			if (surviving !== -1) {
				activeIndex.value = surviving;
				return;
			}
			activeIndex.value = Math.min(Math.max(activeIndex.value, 0), Math.max(0, ids.length - 1));
			activeKey = ids[activeIndex.value] ?? null;
		},

		focusFirst(): void {
			focusAt(0);
		},
	};
}
