/**
 * The `role="menu"` keyboard contract both editor menus share — `CanvasContextMenu` and the
 * Property tree's `PropertyTreeMenu`: Escape and Tab close, ↑/↓ wrap around the items, Home/End
 * jump. ONE function rather than two copies, because the copies had already diverged (one
 * counted `menuitemradio`, the other did not) inside a single increment.
 *
 * `selector` names the items, since the two menus draw different roles. `close` is the caller's
 * own — the canvas menu restores focus to its opener on Escape AND Tab and its parent handles the
 * rest, so this function never decides where focus goes after closing.
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
	const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(selector)];
	const index = items.indexOf(document.activeElement as HTMLElement);
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
	items[next]?.focus();
}

/** True when a pointer landed outside `menu` — the test both menus close on; `null` (not mounted) counts as outside. */
export function pointerOutside(menu: HTMLElement | null, event: PointerEvent): boolean {
	return !menu?.contains(event.target as Node);
}
