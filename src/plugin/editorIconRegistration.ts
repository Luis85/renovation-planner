import { addIcon, removeIcon } from 'obsidian';

/** Application-owned artwork, in Obsidian's 100-unit custom-icon coordinate system. */
const STAIR_ICON = '<path d="M12 88V64H36V40H60V16H88V88Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';

export function registerEditorIcons(): () => void {
	addIcon('rp-stairs', STAIR_ICON);
	return () => removeIcon('rp-stairs');
}
