import { addIcon, removeIcon } from 'obsidian';

/** Application-owned artwork, in Obsidian's 100-unit custom-icon coordinate system. */
const STAIR_ICON = '<path d="M12 88V64H36V40H60V16H88V88Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
/** A column's plan symbol: its section with both diagonals. */
const POST_ICON = '<path d="M22 22H78V78H22Z M22 22L78 78 M78 22L22 78" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>';
/** A beam overhead: two dashed parallel edges. */
const BEAM_ICON = '<path d="M8 36H92 M8 64H92" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="14 10"/>';
const ICONS: Readonly<Record<string, string>> = { 'rp-stairs': STAIR_ICON, 'rp-post': POST_ICON, 'rp-beam': BEAM_ICON };

export function registerEditorIcons(): () => void {
	for (const [name, svg] of Object.entries(ICONS)) addIcon(name, svg);
	return () => { for (const name of Object.keys(ICONS)) removeIcon(name); };
}
