/**
 * AD18-R18's half of the library's view state: which layout draws the catalogue and which
 * category the sidebar filters it to. It lives in Obsidian's own view state beside §6.3's
 * `assetId` and `expanded`, and a change to it is never a navigation.
 *
 * `''` is "every category", the same sentinel `assetId` uses for "nothing selected".
 */
export type LibraryLayout = 'list' | 'grid';

export interface LibraryBrowse {
	readonly layout: LibraryLayout;
	readonly category: string;
}

/** List over every category: the library exactly as it drew before the Grid view existed. */
export const DEFAULT_BROWSE: LibraryBrowse = { layout: 'list', category: '' };

/**
 * Read leniently, as `expanded` is. How the catalogue is laid out is cosmetic, so a malformed
 * value falls back to the default rather than refusing the `assetId` beside it.
 */
export function browseFrom(record: Record<string, unknown>): LibraryBrowse {
	const category = record['category'];
	return {
		layout: record['layout'] === 'grid' ? 'grid' : 'list',
		category: typeof category === 'string' ? category : '',
	};
}

/**
 * Each key is written only when it leaves its default, as `projectDestinationState` leaves out
 * `section: 'details'`. A leaf that never switched layout or filtered keeps the state shape it
 * had before AD18-R18.
 */
export function browseState(browse: LibraryBrowse): Record<string, unknown> {
	return {
		...(browse.layout === 'grid' ? { layout: 'grid' } : {}),
		...(browse.category === '' ? {} : { category: browse.category }),
	};
}
