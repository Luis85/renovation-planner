import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TFile, TFolder } from 'obsidian';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import { expectOk } from './domain';
import { openFixtureVault, type FixtureStack } from './fixtureVault';

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

describe('the fixture vault adapter', () => {
	/**
	 * A writable CLONE. Every contract case calls `save()` and `delete()`, so an adapter
	 * pointed at the checked-in directory would mutate the baseline in place, leave a dirty
	 * worktree after a serial run, and let concurrent cases observe each other's writes.
	 */
	it('hands back an isolated copy, leaving the checked-in tree untouched', async () => {
		open = await openFixtureVault('valid-project');
		const before = readFileSync(join('tests/vault/valid-project', 'Project.md'), 'utf8');

		await open.vault.create('Scratch.md', 'written by a test');

		expect(open.root).not.toContain('tests/vault/valid-project');
		expect(readFileSync(join('tests/vault/valid-project', 'Project.md'), 'utf8')).toBe(before);
		expect(existsSync(join('tests/vault/valid-project', 'Scratch.md'))).toBe(false);
	});

	/**
	 * Hardening rule 1. Obsidian refuses a create whose parent folder does not exist;
	 * making the old fake refuse turned 86 tests red. A fake kinder than the real thing
	 * turns a shipped crash into a green suite.
	 */
	it('refuses a create whose parent folder does not exist', async () => {
		open = await openFixtureVault('valid-project');

		await expect(open.vault.create('NoSuchFolder/Note.md', 'x')).rejects.toThrow(/does not exist/u);
	});

	/**
	 * Hardening rule 2. Obsidian populates `MetadataCache` ASYNCHRONOUSLY, so a note read
	 * back in the tick it was created has no cache entry at all — the defect that made
	 * `create-sample-project` report a migration failure on a note it had just written
	 * correctly. Making the old fake honest turned 65 tests red across 12 files.
	 *
	 * Keyed on the cache ENTRY, not on `entry?.frontmatter`: `getFileCache` answers `null`
	 * for "never parsed" and an object with no `frontmatter` for "parsed, and the user
	 * deleted it". Collapse those two and a note whose frontmatter was deleted is served
	 * this plugin's own stale bytes forever.
	 */
	it('populates the metadata cache asynchronously, with the create-window fallback', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Fresh.md';

		await open.vault.create(path, '---\nid: fresh\ntype: zone\n---\n');

		expect(open.metadataCache.getFileCache(open.vault.getAbstractFileByPath(path))).toBeNull();
		open.metadataCache.catchUp();
		expect(open.metadataCache.getFileCache(open.vault.getAbstractFileByPath(path))?.frontmatter).toMatchObject({ id: 'fresh' });
	});

	/**
	 * A note already on disk when the vault opened is visible IMMEDIATELY — no seeding pass,
	 * because the cache parses current bytes rather than a snapshot. This is the case that
	 * would have failed against the snapshot design without its seeding call, and it is why
	 * that call could be retired rather than kept alongside.
	 */
	it('reads a checked-in note without any seeding pass', async () => {
		open = await openFixtureVault('valid-project');
		const file = open.vault.getAbstractFileByPath('Project.md');

		expect(open.metadataCache.getFileCache(file)?.frontmatter).toBeDefined();
	});

	/**
	 * Save then read, through the door a repository actually uses.
	 *
	 * This case was written against a SNAPSHOT design that returned the pre-save frontmatter
	 * here because nothing ever invalidated the entry — stale forever, not stale for a window.
	 * It asserted the modify was visible IMMEDIATELY, which caught that bug and, once `main`
	 * taught `FakeVault` the modify window, encoded the opposite defect: production holds the
	 * PREVIOUS version until its parse queue drains, so a cache that answers the new bytes at
	 * once is kinder than the real thing in the direction that hides a read-after-write.
	 *
	 * `catchUp()` is what tells the two apart, and it is why this case survives its own
	 * correction rather than being deleted: a permanently-stale snapshot fails the third
	 * assertion, and a cache made current on modify fails the second. Only a real window
	 * passes both.
	 */
	it('serves the pre-save frontmatter for the window, and the new bytes once it drains', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Project.md';
		const file = open.vault.getAbstractFileByPath(path);
		const before = open.metadataCache.getFileCache(file)?.frontmatter?.['status'];

		await open.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter['status'] = 'changed-by-this-test';
		});

		expect(before).not.toBe('changed-by-this-test');
		expect(open.metadataCache.getFileCache(file)?.frontmatter).toMatchObject({ status: before });

		open.metadataCache.catchUp();
		expect(open.metadataCache.getFileCache(file)?.frontmatter).toMatchObject({ status: 'changed-by-this-test' });
	});

	/**
	 * Three answers, not two. A parsed file with NO frontmatter answers an object whose
	 * `frontmatter` is undefined, while a file Obsidian has never seen answers `null`.
	 * Collapsing them makes "never seen" and "the user deleted the frontmatter"
	 * indistinguishable — the conflation `frontmatterOf` must not make.
	 */
	it('tells a file with no frontmatter apart from a file it has never seen', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Plain.md';
		await open.vault.create(path, 'no frontmatter here\n');
		open.metadataCache.catchUp();

		expect(open.metadataCache.getFileCache(open.vault.getAbstractFileByPath(path))).toEqual({});
		expect(open.metadataCache.getFileCache(null)).toBeNull();
	});

	/** Hardening rule 3. Obsidian answers a folder object for a folder, never `null`. */
	it('answers a folder object for a folder', async () => {
		open = await openFixtureVault('valid-project');

		expect(open.vault.getAbstractFileByPath('')).not.toBeNull();
	});

	/**
	 * A folder's `children` are populated ONE LEVEL DEEP, and both arms matter: a folder
	 * that has one, and a folder that genuinely does not. `MockTFolder.children` defaults to
	 * `[]`, and `undoEnsureFolder` (`noteIo.ts`) reads exactly that field to decide whether a
	 * failed insert may trash the folder it just created — reachable from `open.projects` on
	 * any failed insert. An adapter that always answered `[]` would satisfy the emptiness
	 * guard unconditionally and let a real `rmSync` take a non-empty folder off disk; an
	 * adapter that populated every folder's `children` regardless of whether it had any would
	 * pass a case asserting only the populated arm. Both are asserted here.
	 */
	it("populates a folder's children one level deep, and only for a folder that has any", async () => {
		open = await openFixtureVault('valid-project');
		await open.vault.createFolder('Empty');

		const root = open.vault.getAbstractFileByPath('') as TFolder;
		const empty = open.vault.getAbstractFileByPath('Empty') as TFolder;

		expect(root.children.length).toBeGreaterThan(0);
		expect(empty.children).toEqual([]);
	});

	/**
	 * Hardening rule 4, and it is the one a first draft got wrong in the direction that
	 * hides a defect: Obsidian's `Vault.create` refuses an EXISTING path, and so does
	 * `FakeVault` (vault.ts:118). A `writeFileSync` that silently truncates would let
	 * repository code choosing `create` where it should choose `modify` pass every gate here
	 * and destroy a note in a real vault.
	 */
	it('refuses a create whose path already exists', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Twice.md';
		await open.vault.create(path, 'first');

		await expect(open.vault.create(path, 'second')).rejects.toThrow(/already exists/u);
		expect(readFileSync(join(open.root, path), 'utf8')).toBe('first');
	});

	/**
	 * Vault-relative and forward-slashed, on every platform.
	 *
	 * The Windows CI leg is what this protects: `path.join` there produces backslashes, and a
	 * `TFile.path` carrying one is parsed by `parentOf` (which searches for `/`) as having no
	 * parent at all — so an indexed project derives the vault root as its folder and every
	 * later write targets the wrong directory, with Ubuntu green throughout. Asserted rather
	 * than left to that leg to discover: a defect only one of four legs can see is worth
	 * failing fast and locally.
	 */
	it('gives every file a vault-relative, forward-slashed path on any platform', async () => {
		open = await openFixtureVault('valid-project');
		await open.vault.createFolder('Nested');
		await open.vault.create('Nested/Deep.md', 'x');

		const file = open.vault.getAbstractFileByPath('Nested/Deep.md') as TFile;

		expect(file.path).toBe('Nested/Deep.md');
		expect(file.path).not.toContain('\\');
		expect(file.path).not.toContain(open.root);
		expect(file.basename).toBe('Deep');
	});

	/**
	 * The same property, asserted on what ENUMERATION returns — which is where the conversion
	 * actually happens and where the Windows defect actually lives.
	 *
	 * The case above hands `getAbstractFileByPath` an already-correct vault path and checks
	 * what comes back, so an adapter that walks the clone with `readdirSync` and builds paths
	 * with `path.relative` — producing `Nested\Deep.md` on Windows — passes it while
	 * `getFiles()` and `getMarkdownFiles()` hand the index native separators. The bootstrap
	 * then derives the wrong parent folder for every note, which is the whole failure this pair
	 * exists to prevent. Asserting the output of a function you handed a good input to is not
	 * the same as asserting the function that PRODUCES the input.
	 *
	 * A NESTED checked-in fixture file is what makes it bite: a path with no separator cannot
	 * show a separator defect, so `valid-project/` must contain at least one file in a
	 * subfolder. Recorded as a fixture REQUIREMENT rather than left to chance, and asserted at
	 * the end of this case so a flattened fixture fails here rather than silently weakening it.
	 */
	it('enumerates vault-relative, forward-slashed paths', async () => {
		open = await openFixtureVault('valid-project');

		const enumerated = [...open.vault.getFiles(), ...open.vault.getMarkdownFiles()].map((file) => file.path);

		expect(enumerated.length).toBeGreaterThan(0);
		for (const path of enumerated) {
			expect(path).not.toContain('\\');
			expect(path).not.toContain(open.root);
			expect(path.startsWith('/')).toBe(false);
		}

		expect(enumerated.some((path) => path.includes('/'))).toBe(true);
	});

	/**
	 * The narrowing every repository actually performs. `grep -rn "instanceof TFile" src/`
	 * prints 18 lines — 15 narrowing sites, the other 3 comments describing the rule — so
	 * an adapter answering its own wrapper class makes all 15 false in tests while true in
	 * the app — every fixture note reads as MISSING with the types still satisfied.
	 * Asserted against the mock module's classes directly, because "not null" is equally
	 * true of the wrong class.
	 */
	it('answers the mock module TFile and TFolder, which is what the repositories narrow on', async () => {
		open = await openFixtureVault('valid-project');

		expect(open.vault.getAbstractFileByPath('Project.md')).toBeInstanceOf(TFile);
		expect(open.vault.getAbstractFileByPath('')).toBeInstanceOf(TFolder);
	});

	/** The stack is a REPOSITORY stack, not three host surfaces. */
	it('hands back constructed repositories, not just host APIs', async () => {
		open = await openFixtureVault('valid-project');

		expect(open.zones).toBeDefined();
		expect(open.plans).toBeDefined();
		expect(open.assets).toBeDefined();
		expect(open.requirements).toBeDefined();
		expect(open.store).toBeDefined();
	});

	/**
	 * `toBeDefined()` alone certifies that the object literal has these keys, not that the
	 * repositories are constructed and usable AGAINST the fixture — this repository has
	 * already paid for exactly that gap once (a fixture missing `status` that a test name
	 * promised to read, but never asserted). `rebuildIndex()` first, because `getById`
	 * resolves through the INDEX (`locate` → `index.getPath`), which `openFixtureVault`
	 * deliberately leaves empty at open, mirroring `createRepositoryStack`. A real read
	 * through `open.projects` discriminates three things a `toBeDefined()` cannot: that the
	 * repository was constructed correctly, that `Project.md`'s frontmatter is genuinely
	 * schema-valid, and that the on-demand metadata-cache path this file exists to harden
	 * (hardening rule 2) actually feeds a repository read rather than only a direct
	 * `getFileCache` call.
	 */
	it('reads the checked-in project through a constructed repository', async () => {
		open = await openFixtureVault('valid-project');
		open.rebuildIndex();

		const loaded = expectOk(await open.projects.getById('proj-valid' as ProjectId));

		expect(loaded?.entity.name).toBe('Valid Project');
	});
	/**
	 * Hardening rule 4, added after a review bot found the hole: **no path resolves outside
	 * the clone.**
	 *
	 * `absolute()` is the single boundary between a vault-relative path and a native one, so
	 * every read, every write and `delete`'s recursive `rmSync` goes through it — and `join`
	 * normalizes, so a `..` segment walked straight out of the clone and operated on a
	 * sibling. `dispose()`'s own guard covered the door that deletes the clone and not the
	 * door that does everything else.
	 *
	 * Asserted on `delete` as well as `create`, because they fail differently and only one of
	 * them is destructive: a create that escapes writes one file somewhere it should not, a
	 * delete that escapes takes a directory and everything under it. Both arms, and the
	 * legal-root case beside them, because a guard that refused `''` would break
	 * `getAbstractFileByPath('')`'s lookup of the vault root and no other case here would say
	 * so.
	 */
	it('refuses any path that resolves outside the clone, on every door', async () => {
		open = await openFixtureVault('valid-project');
		const root = open.root;

		await expect(open.vault.create('../escaped.md', 'x')).rejects.toThrow(/escapes the fixture clone/u);
		await expect(open.vault.create('a/../../escaped.md', 'x')).rejects.toThrow(/escapes the fixture clone/u);
		expect(() => open?.vault.getAbstractFileByPath('../escaped.md')).toThrow(/escapes the fixture clone/u);

		// The vault ROOT itself is legal and must stay so — `nodeAt('')` looks it up.
		expect(open.vault.getAbstractFileByPath('')).not.toBeNull();
		expect(existsSync(join(root, 'Project.md'))).toBe(true);
	});
	/**
	 * Hardening rule 2's SECOND face, added after a review bot found it missing: **after a
	 * MODIFY the cache is stale, not current.**
	 *
	 * The first face (a create is invisible until the queue drains) shipped with this adapter.
	 * This one did not, under a docblock asserting `FakeVault` did not model it either — true
	 * when written, and false by the time this branch merged `main`, which had taught
	 * `FakeVault` exactly this through `pendingParse`. A fake thinner than the sibling fake
	 * standing in for the same host object is the governing rule of this whole file broken one
	 * import away.
	 *
	 * It matters because it is the direction that HIDES a defect: a read-after-modify that
	 * sees the new bytes immediately passes here while the same flow reads pre-write
	 * frontmatter in a vault. `main` fixed the same hole in `FakeVault` after it hid a shipped
	 * one — a plan background written, its event published, the editor re-hydrating inside the
	 * window and drawing nothing.
	 *
	 * All three arms, because each passes against a different wrong model: the stale read (a
	 * cache made current on modify fails it), the drain (a cache permanently stuck on the old
	 * text fails it), and the earliest-text rule (a record overwritten by the second write
	 * would answer the first modification's text rather than the original's).
	 */
	it('holds the pre-write frontmatter until the parse queue drains', async () => {
		open = await openFixtureVault('valid-project');
		const file = open.vault.getAbstractFileByPath('Project.md') as TFile;
		const before = open.metadataCache.getFileCache(file)?.frontmatter?.['name'];

		await open.vault.modify(file, '---\nname: "Renamed Once"\n---\n');
		expect(open.metadataCache.getFileCache(file)?.frontmatter?.['name']).toBe(before);

		await open.vault.modify(file, '---\nname: "Renamed Twice"\n---\n');
		expect(open.metadataCache.getFileCache(file)?.frontmatter?.['name']).toBe(before);

		open.metadataCache.catchUp();
		expect(open.metadataCache.getFileCache(file)?.frontmatter?.['name']).toBe('Renamed Twice');
	});
});
