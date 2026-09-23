/**
 * AD18-R18's two view-state keys, `layout` and `category`, parsed at the workspace-layout trust
 * boundary and written back with each key left out at its default. The existing `getState()` cases
 * assert `{ assetId, expanded }` exactly, and `projectDestinationState` drops `section: 'details'`
 * on the same terms.
 */
import { describe, expect, it } from 'vitest';
import { browseFrom, browseState, DEFAULT_BROWSE } from '../../../src/presentation/library/libraryBrowse';

describe('the browse half of the library view state', () => {
	it('reads a grid layout and a category', () => {
		expect(browseFrom({ layout: 'grid', category: 'furniture' })).toEqual({ layout: 'grid', category: 'furniture' });
	});

	it.each([
		['absent', {}],
		['an unknown layout and a non-string category', { layout: 'tiles', category: 7 }],
	])('falls back to the list over every category when the keys are %s', (_label, record) => {
		expect(browseFrom(record)).toEqual(DEFAULT_BROWSE);
	});

	it('writes nothing at the defaults, so a list over every category keeps the old state shape', () => {
		expect(browseState(DEFAULT_BROWSE)).toEqual({});
	});

	it('writes each key only when it leaves its default', () => {
		expect(browseState({ layout: 'grid', category: '' })).toEqual({ layout: 'grid' });
		expect(browseState({ layout: 'list', category: 'plant' })).toEqual({ category: 'plant' });
	});
});
