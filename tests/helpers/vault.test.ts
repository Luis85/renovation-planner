import { describe, expect, it } from 'vitest';
import type { TFile } from 'obsidian';
import { createRepositoryStack, serializeFrontmatter } from './vault';

/**
 * I4: `FakeVault.trigger` and `eventListenerCount` had zero callers — `create`, `modify` and
 * `delete` fired no event, so the trash-then-delete-event ordering three production docblocks
 * reason about was driven by nothing. These mirror Obsidian's own `on('create' | 'modify' |
 * 'delete', callback: (file: TAbstractFile) => any)` shape (`obsidian.d.ts`), firing AFTER the
 * mutation each name is about.
 */
describe('FakeVault fires the event it mutates for', () => {
	it('reaches an on(\'modify\') listener once, and eventListenerCount returns to 0 after offref', async () => {
		const stack = createRepositoryStack();
		const file = await stack.vault.create('Note.md', 'one');

		const seen: unknown[] = [];
		const reference = stack.vault.on('modify', (modified) => seen.push(modified));
		expect(stack.vault.eventListenerCount).toBe(1);

		await stack.vault.modify(file, 'two');
		expect(seen).toEqual([file]);

		stack.vault.offref(reference);
		expect(stack.vault.eventListenerCount).toBe(0);
	});

	it('fires create once, with the created file', async () => {
		const stack = createRepositoryStack();
		const seen: unknown[] = [];
		stack.vault.on('create', (created) => seen.push(created));

		const file = await stack.vault.create('Note.md', 'one');

		expect(seen).toEqual([file]);
	});

	it('fires delete once, with the deleted file — never per descendant of a deleted folder', async () => {
		const stack = createRepositoryStack();
		await stack.vault.createFolder('Folder');
		await stack.vault.create('Folder/A.md', 'a');
		await stack.vault.create('Folder/B.md', 'b');
		const folder = stack.vault.getAbstractFileByPath('Folder');
		if (folder === null) throw new Error('missing fixture folder');

		const seen: unknown[] = [];
		stack.vault.on('delete', (deleted) => seen.push(deleted));

		await stack.vault.delete(folder);

		expect(seen).toEqual([folder]);
	});
});

/** Which paths the cache announced as parsed, in order. */
function changedPaths(stack: ReturnType<typeof createRepositoryStack>): string[] {
	const seen: string[] = [];
	stack.metadataCache.on('changed', (file: TFile) => seen.push(file.path));
	return seen;
}

/**
 * Review M-2 of owner ruling 76: `drainParseQueue`'s docblock makes three claims about the
 * `changed` it fires, and a docblock is evidence of intent only. One case per claim. The first
 * and third were watched red against their mutations (the `.md` filter dropped; the event fired
 * before the queue is cleared). The second pins an OUTCOME held twice: dropping the drain's own
 * existence check leaves it green, because `FakeVault.delete` takes the path out of
 * `pendingParse` before any drain can reach it.
 */
describe('the metadata cache fires changed once its parse queue drains', () => {
	it('fires for a note and never for a geometry sidecar written in the same drain', async () => {
		const stack = createRepositoryStack();
		const seen = changedPaths(stack);
		await stack.vault.create('Note.md', 'one');
		await stack.vault.create('Plan.rpgeo', '{}');

		stack.metadataCache.catchUp();

		expect(seen).toEqual(['Note.md']);
	});

	it('fires nothing for a note deleted before its parse', async () => {
		const stack = createRepositoryStack();
		const seen = changedPaths(stack);
		const file = await stack.vault.create('Gone.md', 'one');
		await stack.vault.delete(file);

		stack.metadataCache.catchUp();

		expect(seen).toEqual([]);
	});

	it('hands the listener a cache that already shows the parsed note', async () => {
		const stack = createRepositoryStack();
		const answers: unknown[] = [];
		stack.metadataCache.on('changed', (file: TFile, _text: string, cache: unknown) => {
			answers.push(stack.metadataCache.getFileCache(file), cache);
		});
		await stack.vault.create('Note.md', serializeFrontmatter({ name: 'Kitchen' }));
		expect(stack.metadataCache.getFileCache(stack.vault.getAbstractFileByPath('Note.md') as TFile)).toBeNull();

		stack.metadataCache.catchUp();

		expect(answers).toEqual([{ frontmatter: { name: 'Kitchen' } }, { frontmatter: { name: 'Kitchen' } }]);
	});
});
