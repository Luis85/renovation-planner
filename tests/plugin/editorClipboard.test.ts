/** @vitest-environment jsdom */
import { expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { PLAN_EDITOR_VIEW, type PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { loadedPlugin } from '../helpers/plugin';
import { FakeLeaf } from '../helpers/workspace';
import { installEditorEnvironment } from '../helpers/editor';
import { expectDefined } from '../helpers/domain';

installEditorEnvironment();

const clipboardOf = (view: unknown) => (view as { deps: PlanEditorDeps }).deps.clipboard;

/**
 * Design spec §3: each leaf mounts its own Vue app and Pinia, so Copy on one floor and Paste on
 * another only meet if the PLUGIN hands every leaf the same holder. A per-leaf default would
 * compile, draw and paste within a floor — and silently never cross one.
 */
it('hands every Plan Editor leaf the same clipboard', async () => {
	const { plugin } = await loadedPlugin(DEFAULT_SETTINGS);
	const factory = expectDefined(plugin.views.get(PLAN_EDITOR_VIEW), 'the Plan Editor view factory');
	const first = factory(new FakeLeaf() as never), second = factory(new FakeLeaf() as never);
	expect(clipboardOf(first)).toBeDefined();
	expect(clipboardOf(second)).toBe(clipboardOf(first));
});
