import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from './vault';

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
