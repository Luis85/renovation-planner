import { describe, expect, it } from 'vitest';
import type { TFile as MockTFile } from 'obsidian';
import { createRepositoryStack } from './vault';

/**
 * `FakeVault`'s file stat, held to the one thing a real filesystem's is for.
 *
 * `noteIo.ts` reads `mtime` and `size` and nothing else, so `ctime` has no consumer in
 * `src/` today — which is exactly why it needs a case. The neighbouring paragraph in
 * `vault.ts` records what the `stat` field cost while it was permanently `{ mtime: 0,
 * size: 0 }`: "a field that type-checks and says nothing, which is worse than an absent
 * one because a reader believes it". A `ctime` returned as `0`, or as a synonym for the
 * mtime, is that same defect in the member slice 12's `*.test-d.ts` made the compiler
 * ask about — satisfying `FileStats` and telling the reader a falsehood.
 *
 * Both arms, because either alone passes against a wrong implementation: stamping `ctime`
 * on every write passes the first assertion, and never stamping it at all passes the
 * second.
 */
const statOf = async (path: string) => {
	const { vault } = createRepositoryStack();
	await vault.create(path, 'first');
	const created = (vault.getAbstractFileByPath(path) as MockTFile).stat;
	await vault.modify(vault.getAbstractFileByPath(path) as MockTFile, 'second, longer');
	const modified = (vault.getAbstractFileByPath(path) as MockTFile).stat;
	return { created, modified };
};

describe('the fake vault file stat', () => {
	it('stamps ctime at creation and leaves it there while mtime advances', async () => {
		const { created, modified } = await statOf('Note.md');

		expect(modified.ctime).toBe(created.ctime);
		expect(modified.mtime).toBeGreaterThan(created.mtime);
	});

	it('gives ctime a real value rather than the zero that says nothing', async () => {
		const { created } = await statOf('Note.md');

		expect(created.ctime).toBeGreaterThan(0);
		expect(created.ctime).toBe(created.mtime);
	});

	it('tracks size from the bytes actually held', async () => {
		const { created, modified } = await statOf('Note.md');

		expect(created.size).toBe('first'.length);
		expect(modified.size).toBe('second, longer'.length);
	});
	/**
	 * A recreated path is a NEW file, and gets a new creation time.
	 *
	 * `touch` stamps `ctime` only on a path's first write, so a record that outlived the
	 * delete handed the replacement its predecessor's creation time — measured before the
	 * fix, a fresh create reporting `ctime: 1` against `mtime: 2`: a file modified after it
	 * was created and before it existed. Asserted against the FIRST file's ctime rather than
	 * against zero, because a stat reset to zero would pass the latter and is its own lie.
	 */
	it('gives a recreated path a new creation time rather than the deleted file\'s', async () => {
		const { vault } = createRepositoryStack();
		await vault.create('Recreated.md', 'first');
		const first = (vault.getAbstractFileByPath('Recreated.md') as MockTFile).stat;

		await vault.delete(vault.getAbstractFileByPath('Recreated.md') as MockTFile);
		await vault.create('Recreated.md', 'second');
		const second = (vault.getAbstractFileByPath('Recreated.md') as MockTFile).stat;

		expect(second.ctime).toBeGreaterThan(first.ctime);
		expect(second.ctime).toBe(second.mtime);
	});
});
