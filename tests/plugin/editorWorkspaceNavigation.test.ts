// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { editorWorkspaceNavigation } from '../../src/plugin/editorWorkspaceNavigation';
import { installObsidianDom } from '../helpers/dom';
import { FakeWorkspace } from '../helpers/workspace';
import { recorder, resetRecorder, lines } from '../helpers/logger';
import { activateNotices } from '../../src/presentation/notices/notify';
import { settle } from '../helpers/async';

installObsidianDom();
describe('editor host navigation composition', () => {
	it('reuses related leaves and preserves the originating editor and existing library state', async () => {
		const workspace = new FakeWorkspace();
		const editor = workspace.withOpen('renovation-plan-editor', { planId: 'plan-ground' });
		const library = workspace.withOpen('renovation-asset-library', { assetId: 'asset-tile', expanded: ['floor'] });
		const originalEditor = editor.state, originalLibrary = library.state;
		const navigation = editorWorkspaceNavigation(workspace as never, recorder);
		await navigation.project('project-house'); navigation.library(); await settle();
		expect(workspace.leaves).toHaveLength(3);
		expect(workspace.leaves.find(leaf => leaf.state?.type === 'renovation-project')?.state?.state).toMatchObject({ projectId: 'project-house' });
		expect(editor.state).toBe(originalEditor); expect(library.state).toBe(originalLibrary);
	});
	it('reports a failed project activation without rejecting or changing editor state', async () => {
		activateNotices(); resetRecorder();
		const navigation = editorWorkspaceNavigation({ getLeavesOfType: () => { throw new Error('offline'); } } as never, recorder);
		await expect(navigation.project('project-house')).resolves.toBeUndefined();
		expect(lines.some(line => line.event === 'plan-editor.open-project-failed')).toBe(true);
	});
});
