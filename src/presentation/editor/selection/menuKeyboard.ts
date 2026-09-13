/**
 * The ↑/↓/Home/End step both editor menus share — `CanvasMenuList` (each level of the canvas
 * context menu) and the Property tree's `PropertyTreeMenu`: ↑/↓ wrap around `items`, Home/End
 * jump. ONE function rather than two copies, because the copies had already diverged (one
 * counted `menuitemradio`, the other did not) inside a single increment. Each caller collects its
 * own items — `CanvasMenuList` only its level's (`:scope >`), since a submenu nests inside it.
 */
export function focusStep(key: string, items: readonly HTMLElement[]): void {
	// With focus outside the items (index −1) ↓ goes to the first and ↑ to the LAST: ↑ counts from
	// index 0, so the wrap lands on n−1 rather than the n−2 that −1 −1 + n gave.
	const from = Math.max(items.indexOf(document.activeElement as HTMLElement), key === 'ArrowUp' ? 0 : -1);
	const next = key === 'Home' ? 0 : key === 'End' ? items.length - 1 : (from + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
	items[next]?.focus();
}

/**
 * `PropertyTreeMenu`'s whole `role="menu"` keyboard contract: Escape and Tab close, and the arrow
 * keys take `focusStep`. `CanvasMenuList` does not use this — its Escape, ←/→ and Enter step
 * between nested submenus — and handles those keys itself.
 *
 * `selector` names the items. `close` is the caller's own, so this function never decides where
 * focus goes after closing.
 *
 * The element the LISTENER is bound to is read from `currentTarget`, not from a ref: this runs
 * only as a native `@keydown` handler on the menu's own element, and the DOM sets `currentTarget`
 * to that element for every dispatch — a browser guarantee rather than a ref-timing assumption,
 * so no nullable read (an uncovered branch no test could reach honestly) is needed at all.
 */
export function menuNavigation(event: KeyboardEvent, selector: string, close: () => void): void {
	if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); return; }
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	event.preventDefault(); event.stopPropagation();
	focusStep(event.key, [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(selector)]);
}

/** True when a pointer landed outside `menu` — the test both menus close on; `null` (not mounted) counts as outside. */
export function pointerOutside(menu: HTMLElement | null, event: PointerEvent): boolean {
	return !menu?.contains(event.target as Node);
}
