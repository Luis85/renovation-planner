import { addIcon, removeIcon } from 'obsidian';

/** Application-owned artwork, in Obsidian's 100-unit custom-icon coordinate system. */
const STAIR_ICON = '<path d="M12 88V64H36V40H60V16H88V88Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
/** A column's plan symbol: its section with both diagonals. */
const POST_ICON = '<path d="M22 22H78V78H22Z M22 22L78 78 M78 22L22 78" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>';
/** A beam overhead: two dashed parallel edges. */
const BEAM_ICON = '<path d="M8 36H92 M8 64H92" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="14 10"/>';
/** A dimension chain: two extension lines, the line between them and its oblique ticks. */
const DIMENSION_ICON = '<path d="M14 24V76 M86 24V76 M8 50H92 M6 58L22 42 M78 58L94 42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';
/** A section line: dash-dot with a filled triangle at each end. */
const SECTION_ICON = '<path d="M8 62H26 M38 62H46 M58 62H66 M78 62H92" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M8 62L20 34L32 62Z M68 62L80 34L92 62Z" fill="currentColor"/>';
/** A view marker: a hollow triangle pointing the way it looks. */
const VIEW_ICON = '<path d="M50 16L86 80H14Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>';
/** A hatched area: a square crossed both ways. */
const HATCH_ICON = '<path d="M14 14H86V86H14Z M14 50L50 14 M14 86L86 14 M50 86L86 50 M14 50L50 86 M14 14L86 86 M50 14L86 50" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>';
/** A text: a capital T. */
const TEXT_ICON = '<path d="M18 20H82 M50 20V84 M36 84H64" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';
/** A boundary line: a dashed polyline. */
const BOUNDARY_ICON = '<path d="M8 66L36 42L64 58L92 30" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16 10"/>';
/** A grid point: a circle with its number. */
const GRID_ICON = '<circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="8"/><path d="M42 36L52 30V70" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
const ICONS: Readonly<Record<string, string>> = {
	'rp-stairs': STAIR_ICON, 'rp-post': POST_ICON, 'rp-beam': BEAM_ICON,
	'rp-dimension': DIMENSION_ICON, 'rp-section': SECTION_ICON, 'rp-view': VIEW_ICON, 'rp-hatch': HATCH_ICON, 'rp-text': TEXT_ICON, 'rp-boundary': BOUNDARY_ICON, 'rp-grid': GRID_ICON,
};

export function registerEditorIcons(): () => void {
	for (const [name, svg] of Object.entries(ICONS)) addIcon(name, svg);
	return () => { for (const name of Object.keys(ICONS)) removeIcon(name); };
}
