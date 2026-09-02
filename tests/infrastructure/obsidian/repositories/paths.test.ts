/**
 * The two path helpers ADR-0014 adds, asked directly.
 *
 * Every other path in this module already has a caller-side test — `sidecarPathFor` is
 * driven through the plan repositories in eight files in this directory — and these two
 * have none yet, because the store that will call them is being written in the same task.
 * A path rule stated in a docblock and exercised only through whatever the first caller
 * happens to pass is a rule with one example, not a check.
 */
import { describe, expect, it } from 'vitest';
import {
	assetSidecarPathFor,
	libraryGeometryFolderFor,
	normalizeFolder,
} from '../../../../src/infrastructure/obsidian/repositories/paths';

describe('assetSidecarPathFor', () => {
	it('puts an asset sidecar in the library, a sibling of Assets/', () => {
		expect(assetSidecarPathFor('Renovation/Library', 'asset-01JABC')).toBe(
			'Renovation/Library/Geometry/asset-01JABC.rpgeo',
		);
	});

	it('normalises a library folder given with a trailing slash', () => {
		expect(assetSidecarPathFor('Renovation/Library/', 'asset-01JABC')).toBe(
			'Renovation/Library/Geometry/asset-01JABC.rpgeo',
		);
	});

	it('names the file by the full prefixed id, so note, sidecar and filename compare directly', () => {
		expect(assetSidecarPathFor('L', 'asset-01JABC')).toContain('asset-01JABC.rpgeo');
	});
});

describe('libraryGeometryFolderFor', () => {
	it('is the folder the sidecar path sits in, so one ensureFolder covers the write', () => {
		expect(libraryGeometryFolderFor('Renovation/Library')).toBe('Renovation/Library/Geometry');
	});

	/**
	 * `joinFolder` rather than a template literal, matching every other folder helper here —
	 * a folder deriving `''` would make `` `${''}/Geometry` `` into `/Geometry`, which
	 * Obsidian refuses.
	 *
	 * **The vault-ROOT case is deliberately not asserted, and that is a statement about the
	 * instrument rather than about the rule.** `folderFrom` accepts a stored `libraryFolder`
	 * of `'/'`, so the case is reachable — but this suite's `normalizePath` answers `''` for
	 * it while Obsidian's answers `'/'` (the divergence `migrateLibraryFolder` already names
	 * for the empty string, and the reason its own guard is asked of the RAW value). A case
	 * pinned here would be pinning the fake. `joinFolder` is what makes the rootless answer
	 * correct if it ever arrives; nothing here can watch it do so.
	 */
	it('keeps a nested library folder whole rather than flattening it', () => {
		expect(libraryGeometryFolderFor('Vault/Renovation/Library')).toBe(
			'Vault/Renovation/Library/Geometry',
		);
	});
});

/**
 * THE VAULT ROOT, which is a value `settingsFrom` will hand back from a hand-edited
 * `data.json` and which `joinFolder` already has an answer for — `''`, its one falsy case,
 * which is why it is a function rather than a template literal in five places.
 *
 * The hazard is that `normalizeFolder` might not PRODUCE that value. `joinFolder('/', c)`
 * is `'//' + c`, an invalid path: reads look somewhere no file is and report a designed
 * asset as shapeless, writes attempt a double slash.
 *
 * Whether real Obsidian's `normalizePath('/')` answers `'/'` or `''` cannot be settled from
 * this tree — the `obsidian` dependency is types-only, there is no implementation to read,
 * and this repository's own mock answers `''` while the behaviour is believed to fall back
 * to `'/'`. So this is deliberately NOT a test of `normalizePath`: `normalizeFolder`
 * collapses a root-only result itself, and is therefore correct under both readings rather
 * than resting on the one nobody here can check. Recorded rather than guessed, because a
 * fake that is kinder than the real thing in exactly the case that matters is this
 * repository's oldest recurring defect.
 */
describe('the vault root', () => {
	it('normalises every spelling of the root to the empty folder', () => {
		expect(normalizeFolder('/')).toBe('');
		expect(normalizeFolder('  /  ')).toBe('');
		expect(normalizeFolder('')).toBe('');
	});

	it('joins a child onto the root without a leading slash', () => {
		expect(libraryGeometryFolderFor('/')).toBe('Geometry');
		expect(assetSidecarPathFor('/', 'asset-01ABC')).toBe('Geometry/asset-01ABC.rpgeo');
	});

	it('leaves an ordinary folder alone, so the rule is about the root and not about slashes', () => {
		expect(normalizeFolder('Renovation/Library')).toBe('Renovation/Library');
		expect(libraryGeometryFolderFor('Renovation/Library')).toBe('Renovation/Library/Geometry');
	});
});
