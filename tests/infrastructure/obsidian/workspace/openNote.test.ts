/**
 * Opening a project's own note (Task 5's seam).
 *
 * The path comes from the Project Index, never from a convention: since ADR-0013 a
 * project's folder is wherever its `Project.md` currently sits, so the only honest lookup
 * is the one the index answers.
 */
import { describe, expect, it } from 'vitest';
import { openProjectNote } from '../../../../src/infrastructure/obsidian/workspace/openNote';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { createRepositoryStack } from '../../../helpers/vault';
import { FakeWorkspace } from '../../../helpers/workspace';
import type { EntityId } from '../../../../src/core/identity/EntityId';

const PROJECT_ID = 'project-1' as EntityId<string>;

describe('opening a project note', () => {
	it('opens the file the index resolves the id to', async () => {
		const { vault } = createRepositoryStack();
		await vault.create('Project.md', '---\nid: project-1\n---\n');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();

		await openProjectNote({ workspace: workspace as never, vault: vault as never, index }, PROJECT_ID);

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].opened).toHaveLength(1);
		expect(workspace.leaves[0].opened[0]?.path).toBe('Project.md');
	});

	/**
	 * The only way to hold an id the index does not resolve is a note deleted since the list
	 * was read — see the module's own docblock for why that is silent rather than notified.
	 */
	it('opens nothing for an id the index does not resolve', async () => {
		const { vault } = createRepositoryStack();
		const index = new InMemoryProjectIndex();
		const workspace = new FakeWorkspace();

		await openProjectNote({ workspace: workspace as never, vault: vault as never, index }, PROJECT_ID);

		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * The index maps an id to a path Obsidian resolves as a FOLDER, not a note — a state the
	 * index itself should never produce for a project id, but the guard is what stops a
	 * `TFolder` from being handed to `openFile`, which expects a `TFile`.
	 */
	it('opens nothing for a path that resolves to a folder rather than a file', async () => {
		const { vault } = createRepositoryStack();
		await vault.createFolder('SomeFolder');
		const index = new InMemoryProjectIndex();
		index.upsert({ id: PROJECT_ID, type: 'renovation-project', path: 'SomeFolder' });
		const workspace = new FakeWorkspace();

		await openProjectNote({ workspace: workspace as never, vault: vault as never, index }, PROJECT_ID);

		expect(workspace.leaves).toHaveLength(0);
	});
});
