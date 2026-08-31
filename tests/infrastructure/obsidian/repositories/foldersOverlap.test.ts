import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ObsidianModule from 'obsidian';
import { foldersOverlap } from '../../../../src/infrastructure/obsidian/repositories/foldersOverlap';

/** The guard, re-imported against a `normalizePath` that answers `'/'` for the vault root. */
async function guardUnderRootAsSlash(): Promise<typeof foldersOverlap> {
	vi.resetModules();
	vi.doMock('obsidian', async () => {
		const actual = await vi.importActual<typeof ObsidianModule>('obsidian');
		return { ...actual, normalizePath: (path: string) => actual.normalizePath(path) || '/' };
	});
	const loaded = (await import(
		'../../../../src/infrastructure/obsidian/repositories/foldersOverlap'
	)) as { foldersOverlap: typeof foldersOverlap };
	return loaded.foldersOverlap;
}

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
		expect(foldersOverlap('Renovation/Kitchen refit', '')).toBe(true);
	});

	// The SECOND spelling of the same folder. Which one `normalizePath` hands back for the
	// root is undocumented and cannot be asked from here, so the guard has to accept both.
	it('is true when either side is the vault root spelled as a slash', () => {
		expect(foldersOverlap('/', 'Renovation/Kitchen refit')).toBe(true);
		expect(foldersOverlap('Renovation/Kitchen refit', '/')).toBe(true);
	});

	it('is true for the vault root against itself under either spelling', () => {
		expect(foldersOverlap('/', '')).toBe(true);
		expect(foldersOverlap('', '/')).toBe(true);
	});
});

/**
 * The reading this repository cannot verify, driven as behaviour rather than argued.
 *
 * `normalizePath` is `@public` with no documented answer for the empty input; the mock in
 * `tests/helpers/obsidian-mock.ts` strips leading and trailing slashes and answers `''`,
 * and a real vault may answer `'/'`. Under that second reading a project whose `Project.md`
 * sits at the vault root — which `projectFolderOf` really produces, from a user dragging
 * that note there — folds to `'/'`, and a guard that recognises the root as `''` alone
 * answers `false` for it: §83 stops protecting the one case that costs every project's
 * catalogue.
 *
 * This does NOT assert that Obsidian behaves this way. It asserts that the guard holds
 * either way, which is the only claim available from here.
 */
describe('foldersOverlap, against a normalizePath that answers "/" for the vault root', () => {
	afterEach(() => {
		vi.doUnmock('obsidian');
		vi.resetModules();
	});

	it('still treats the vault root as containing every folder', async () => {
		const guard = await guardUnderRootAsSlash();
		expect(guard('', 'Renovation/Kitchen refit')).toBe(true);
		expect(guard('Renovation/Kitchen refit', '')).toBe(true);
		expect(guard('/', 'Renovation/Kitchen refit')).toBe(true);
	});

	it('still leaves ordinary siblings alone', async () => {
		const guard = await guardUnderRootAsSlash();
		expect(guard('Renovation/Library', 'Renovation/Kitchen refit')).toBe(false);
	});
});
