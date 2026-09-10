// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { editorWorkspaceNavigation } from '../../src/plugin/editorWorkspaceNavigation';
import { installObsidianDom } from '../helpers/dom';
import { FakeWorkspace } from '../helpers/workspace';
import { recorder, resetRecorder, lines } from '../helpers/logger';
import { activateNotices } from '../../src/presentation/notices/notify';
import { settle } from '../helpers/async';
import { expectDefined } from '../helpers/domain';

installObsidianDom();
describe('editor host navigation composition', () => {
 it('keeps the editor intact across Work and Quote routes, including a failed host state change', async () => {
  activateNotices(); resetRecorder();
  const workspace = new FakeWorkspace(), editor = workspace.withOpen('renovation-plan-editor', { planId: 'plan-ground' });
  const project = workspace.withOpen('renovation-project', { projectId: 'project-house' }), originalEditor = editor.state;
  const downstream = expectDefined(editorWorkspaceNavigation(workspace as never, recorder).downstream, 'downstream navigation');
  const origin = { planId: 'plan-ground', roomId: 'room-kitchen', workId: 'work-floor' };
  await downstream('project-house', { section: 'schedule', origin });
  expect(project.state?.state).toMatchObject({ projectId: 'project-house', section: 'schedule', origin });
  const originalProject = project.state, setState = vi.spyOn(project, 'setViewState').mockRejectedValueOnce(new Error('Host view unavailable'));
  try {
   await expect(downstream('project-house', { section: 'quotes', origin })).resolves.toBeUndefined();
   expect(project.state).toBe(originalProject); expect(editor.state).toBe(originalEditor);
   expect(lines.filter(line => line.event === 'plan-editor.open-project-failed')).toHaveLength(1);
   await downstream('project-house', { section: 'quotes', origin });
   expect(project.state?.state).toMatchObject({ projectId: 'project-house', section: 'quotes', origin });
   expect(editor.state).toBe(originalEditor); expect(workspace.leaves).toHaveLength(2);
  } finally { setState.mockRestore(); }
 });
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
	it('opens a sibling plan through the real revealPlanEditor, for the Property tree', async () => {
		const workspace = new FakeWorkspace();
		const navigation = editorWorkspaceNavigation(workspace as never, recorder);

		await expectDefined(navigation.plan, 'plan navigation')('plan-first');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0]?.state).toMatchObject({ type: 'renovation-plan-editor', state: { planId: 'plan-first' } });
	});
});
