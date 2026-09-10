// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { downstreamStack } from '../../helpers/downstream';
import { FakeLeaf, FakeWorkspace } from '../../helpers/workspace';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { planEditorDeps } from '../../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { PlanEditorView } from '../../../src/presentation/views/PlanEditorView';
import * as notices from '../../../src/presentation/notices/notify';
installEditorEnvironment();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function setup() {
 const rig = await downstreamStack(), workspace = new FakeWorkspace(), deps = planEditorDeps(rig.root, workspace as never, rig.stack.deps.vault, createEditorClipboard());
 const view = new PlanEditorView(new FakeLeaf() as never, deps); document.body.append(view.containerEl);
 const origin = { planId: rig.plan.id, roomId: rig.roomId, workId: 'work-sand' };
 return { rig, view, deps, origin, dispose: async () => { await view.onClose(); rig.dispose(); } };
}
it('restores and serializes the real Work origin through the host view and reuses its mounted canvas for a same-floor return', async () => {
 const { rig, view, origin, dispose } = await setup();
 try {
  await view.setState({ planId: rig.plan.id, origin }, {} as never); await view.onOpen(); sizedShellRoot(view.contentEl); await settle();
  expect(view.getState()).toEqual({ planId: rig.plan.id, origin }); expect(view.contentEl.querySelector('[data-rp-record="work-sand"]')).not.toBeNull();
  const canvas = view.contentEl.querySelector('canvas'), shell = view.contentEl.firstElementChild, bytes = [...rig.stack.vault.entries];
  expect(canvas).not.toBeNull(); const result = { history: true }; await view.setState({ planId: rig.plan.id, origin }, result); await settle();
  expect(result.history).toBe(true); expect(view.contentEl.querySelector('canvas')).toBe(canvas); expect(view.contentEl.firstElementChild).toBe(shell);
  expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { await dispose(); }
});
it('refuses a peer-deleted return target without changing host history, the previous origin or the current canvas', async () => {
 const { rig, view, origin, dispose } = await setup();
 try {
  await view.setState({ planId: rig.plan.id, origin }, {} as never); await view.onOpen(); sizedShellRoot(view.contentEl); await settle();
  const canvas = view.contentEl.querySelector('canvas'), bytes = [...rig.stack.vault.entries], warn = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
  const result = { history: true }; await view.setState({ planId: rig.plan.id, origin: { ...origin, workId: 'removed-work' } }, result); await settle();
  expect(result.history).toBe(false); expect(view.getState()).toEqual({ planId: rig.plan.id, origin }); expect(warn).toHaveBeenCalledOnce();
  expect(view.contentEl.querySelector('canvas')).toBe(canvas); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { await dispose(); }
});
it('accepts a dependency rebind before a Plan is selected and discards a foreign-floor origin from restored host state', async () => {
 const { rig, view, deps, origin, dispose } = await setup();
 try {
  view.rebind(deps); await view.onOpen(); expect(view.getState()).toEqual({ planId: '' }); expect(view.contentEl.querySelector('canvas')).toBeNull();
  await view.setState({ planId: rig.plan.id, origin: { ...origin, planId: 'foreign-floor' } }, {} as never); sizedShellRoot(view.contentEl); await settle();
  expect(view.getState()).toEqual({ planId: rig.plan.id }); expect(view.contentEl.querySelector('canvas')).not.toBeNull();
 } finally { await dispose(); }
});
