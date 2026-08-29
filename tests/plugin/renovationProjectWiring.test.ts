/**
 * @vitest-environment jsdom
 *
 * What the composition root hands the Renovation Project view (design slice 14).
 *
 * Mirrors `planEditorWiring.test.ts`'s "the plan editor dependencies" block: the seam this
 * file guards is the same one slice 1 reserved in writing — every later slice adds a FIELD
 * here and a constructor parameter, never a second wiring point somewhere else in the
 * plugin.
 */
import { describe, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { createCompositionRoot, renovationProjectDeps } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { installObsidianDom } from '../helpers/dom';
import { lines, recorder, resetRecorder } from '../helpers/logger';
import { createRepositoryStack } from '../helpers/vault';
import { FakeLeaf, FakeWorkspace } from '../helpers/workspace';

installObsidianDom();

const vaultStack = () =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as never;

describe('the renovation project dependencies', () => {
	it('hands over a query service that answers the real project list when persistence is composed', async () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault);
		const result = await deps.queries.listProjects();

		// A fresh vault legitimately has none yet — `ok`, not a refusal, and nothing refused.
		expect(result).toEqual({ ok: true, value: { projects: [], unreadable: 0 } });
	});

	/**
	 * TOTAL rather than nullable. With settings unrecovered there is no repository, no
	 * index and no project list — the same reasoning `planEditorDeps` documents for the
	 * identical situation, and `settings.unrecovered` is the same `code` rather than a
	 * second one for the same fact.
	 */
	it('hands over refusing query services when settings were never recovered', async () => {
		const root = createCompositionRoot(null, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault);
		const result = await deps.queries.listProjects();

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe('settings.unrecovered');
	});

	/**
	 * Slice 16's write side: the SAME guarded `createProject` `persistence` already composed
	 * and exposes, not a second guard around it — reused by identity so a hostile input
	 * driven through either seam is driven through the one guard that exists.
	 */
	it('hands over the guarded createProject command when persistence is composed', () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault);

		expect(deps.commands.createProject).toBe(root.persistence?.createProject);
	});

	it('hands over a refusing createProject command when settings were never recovered', async () => {
		const root = createCompositionRoot(null, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault);
		const result = await deps.commands.createProject.execute({ name: 'Kitchen' });

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe('settings.unrecovered');
	});

	/**
	 * `openProject` reaches the workspace AND the vault it was constructed with, over the
	 * root's own index: this asserts the SEAM wires all three through, not `openProjectNote`'s
	 * own mechanism, which `openNote.test.ts` already covers directly — so a real note and a
	 * real (albeit fake) vault stand in for the roundabout of dispatching a create first.
	 */
	it('opens the note a project id resolves to when persistence is composed', async () => {
		const stack = createRepositoryStack();
		await stack.vault.create('Project.md', '---\nid: project-1\n---\n');
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		root.persistence?.index.upsert({ id: 'project-1' as never, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();

		const deps = renovationProjectDeps(root, workspace as never, stack.vault as never);
		await deps.openProject('project-1');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].opened[0]?.path).toBe('Project.md');
	});

	/**
	 * TOTAL rather than nullable, same as `queries` and `commands` above: with no index to
	 * resolve a path through, opening anything would be a guess, so this answers a no-op
	 * rather than reaching for a workspace that has nothing to open.
	 */
	it('opens nothing when settings were never recovered', async () => {
		const root = createCompositionRoot(null, recorder, vaultStack());
		const workspace = new FakeWorkspace();

		const deps = renovationProjectDeps(root, workspace as never, vaultStack().vault);
		await expect(deps.openProject('project-1')).resolves.toBeUndefined();

		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * Task 5's own review deferred this: `openProjectNote` has no `try`/`catch`, and
	 * `ProjectList`'s row click discards the promise this resolves to
	 * (`@open="(id) => void context.openProject(id)"`) — so a rejecting `openFile` (a real
	 * Obsidian I/O fault, not the "id resolves to nothing" case `openProjectNote` already
	 * handles by design) would otherwise be an unhandled rejection reaching nobody.
	 *
	 * The catch lives HERE, in the composed closure, rather than inside `openProjectNote`
	 * itself: that function is `infrastructure/`, which may not import `notifyFault` from
	 * `presentation/notices/notify` (the layer ban runs the other way), and `plugin/` is the
	 * one layer that may reach both at once — the same reason `renovationProjectDeps` is
	 * where `openProject` is composed in the first place.
	 */
	it('reports rather than rejecting when opening the note faults', async () => {
		resetRecorder();
		const stack = createRepositoryStack();
		await stack.vault.create('Project.md', '---\nid: project-1\n---\n');
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		root.persistence?.index.upsert({ id: 'project-1' as never, type: 'renovation-project', path: 'Project.md' });
		// `getLeavesOfType` answers none, which is the case this is about: no tab is already
		// showing the note, so the reuse path is skipped and the faulting `openFile` is reached.
		const workspace = {
			getLeavesOfType: () => [],
			getLeaf: () => ({ openFile: () => Promise.reject(new Error('disk exploded')) }),
		};

		const deps = renovationProjectDeps(root, workspace as never, stack.vault as never);

		await expect(deps.openProject('project-1')).resolves.toBeUndefined();
		expect(Notice.shown.at(-1)).toContain('Reading or writing the vault failed unexpectedly.');
		const logged = lines.find((line) => line.event === 'view.project.open-failed');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('disk exploded');
	});
});

describe('the registered view factory', () => {
	it('builds a RenovationProjectView for the persisted view type', async () => {
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();

		const built = plugin.views.get(RENOVATION_PROJECT_VIEW)?.(new FakeLeaf() as never);

		expect(built).toBeInstanceOf(RenovationProjectView);
	});

	/**
	 * Resolved PER CALL from the current root, never captured: `saveSettings` replaces the
	 * root, and a view built against the old one would read through query services pointed
	 * at the previous project folder.
	 */
	it('resolves its dependencies from the CURRENT root each time it is called', async () => {
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();
		const beforeFolder = plugin.root.settings?.projectFolder;

		await plugin.saveSettings({ ...DEFAULT_SETTINGS, projectFolder: 'Somewhere else' });

		expect(plugin.root.settings?.projectFolder).not.toBe(beforeFolder);
		const built = plugin.views.get(RENOVATION_PROJECT_VIEW)?.(new FakeLeaf() as never);
		expect(built).toBeInstanceOf(RenovationProjectView);
	});
});
