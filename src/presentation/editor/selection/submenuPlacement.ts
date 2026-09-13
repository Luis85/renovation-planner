export interface Box { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

/**
 * Where a submenu opens, in viewport pixels: right of its parent item, flipped left where it would
 * cross the editor's right edge, clamped inside the editor vertically. Pure because jsdom measures
 * no layout; the component feeds it `getBoundingClientRect()`.
 */
export function submenuPlacement(parent: Box, submenu: { readonly width: number; readonly height: number }, host: Box, gap = 2): { left: number; top: number } {
	const right = parent.left + parent.width + gap;
	const left = right + submenu.width > host.left + host.width ? Math.max(host.left, parent.left - gap - submenu.width) : right;
	const top = Math.max(host.top, Math.min(parent.top, host.top + host.height - submenu.height));
	return { left, top };
}
