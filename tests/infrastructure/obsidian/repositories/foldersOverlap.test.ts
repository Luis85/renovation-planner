import { describe, expect, it } from 'vitest';
import { foldersOverlap } from '../../../../src/infrastructure/obsidian/repositories/foldersOverlap';

describe('foldersOverlap', () => {
	it('is true for the same folder', () => {
		expect(foldersOverlap('Renovation/Library', 'Renovation/Library')).toBe(true);
	});

	// BOTH directions, because either path can be the one that moves — §83's own wording.
	it('is true when the first contains the second', () => {
		expect(foldersOverlap('Renovation', 'Renovation/Library')).toBe(true);
	});

	it('is true when the second contains the first', () => {
		expect(foldersOverlap('Renovation/Library', 'Renovation')).toBe(true);
	});

	it('is false for siblings', () => {
		expect(foldersOverlap('Renovation/Library', 'Renovation/Kitchen refit')).toBe(false);
	});

	// The segment boundary is the whole point: a prefix is not containment.
	it('is false for a shared name prefix that is not a folder boundary', () => {
		expect(foldersOverlap('Renovation/Lib', 'Renovation/Library')).toBe(false);
	});

	it('normalises before comparing', () => {
		expect(foldersOverlap(' Renovation/Library/ ', 'Renovation/Library')).toBe(true);
	});

	// Over-refusing costs a rename; under-refusing costs every project's catalogue. On a
	// case-insensitive filesystem these two strings are ONE folder.
	it('refuses a case-folded overlap, because the directions are not symmetric', () => {
		expect(foldersOverlap('Renovation/library', 'Renovation/Library')).toBe(true);
		expect(foldersOverlap('renovation', 'Renovation/Kitchen refit')).toBe(true);
	});

	// The vault ROOT contains everything, which is what makes an empty library folder
	// unusable rather than merely odd.
	it('is true when either side is the vault root', () => {
		expect(foldersOverlap('', 'Renovation/Kitchen refit')).toBe(true);
	});
});
