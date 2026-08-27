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
import { createCompositionRoot, renovationProjectDeps } from '../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { installObsidianDom } from '../helpers/dom';
import { recorder } from '../helpers/logger';
import { FakeLeaf } from '../helpers/workspace';

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

		const deps = renovationProjectDeps(root);
		const result = await deps.queries.listProjects();

		// A fresh vault legitimately has none yet — `ok([])`, not a refusal.
		expect(result).toEqual({ ok: true, value: [] });
	});

	/**
	 * TOTAL rather than nullable. With settings unrecovered there is no repository, no
	 * index and no project list — the same reasoning `planEditorDeps` documents for the
	 * identical situation, and `settings.unrecovered` is the same `code` rather than a
	 * second one for the same fact.
	 */
	it('hands over refusing query services when settings were never recovered', async () => {
		const root = createCompositionRoot(null, recorder, vaultStack());

		const deps = renovationProjectDeps(root);
		const result = await deps.queries.listProjects();

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe('settings.unrecovered');
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
