// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { downstreamStack } from '../../helpers/downstream';
import { FakeLeaf, FakeWorkspace } from '../../helpers/workspace';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { planEditorDeps } from '../../../src/plugin/planEditorDeps';
import { createEditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { memoryDeviceStorage } from '../../helpers/deviceStorage';
import { PlanEditorView } from '../../../src/presentation/views/PlanEditorView';
import * as notices from '../../../src/presentation/notices/notify';
installEditorEnvironment();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function setup() {
 const rig = await downstreamStack(), workspace = new FakeWorkspace(), deps = planEditorDeps(rig.root, workspace as never, rig.stack.deps.vault, createEditorClipboard(), memoryDeviceStorage());
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
/**
 * AD13's asset hand-off is ONE-SHOT, and both doors it could leak through are asked about here.
 *
 * `getState` persists `this.origin` into Obsidian's workspace layout, so an `assetId` left in it
 * would arm the placement tool again on a restart weeks later; `rebind` unmounts and remounts with
 * `initialNavigation`, so one left in the FIELD would arm it again on a settings save. The
 * arrival's own refusal is the observable: `asset-01NOTHERE` is in no catalogue, so each arm of
 * the hand-off produces exactly one `editor.asset.unreadable` warning and a second arrival would
 * be a second one. `consumeAssetHandoff` is what makes both counts one.
 */
it('consumes a designer asset hand-off once, leaving neither the layout nor a rebind able to re-arm it', async () => {
 const { rig, view, deps, dispose } = await setup();
 try {
  const warn = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
  await view.setState({ planId: rig.plan.id, origin: { planId: rig.plan.id, assetId: 'asset-01NOTHERE' } }, {} as never);
  await view.onOpen(); sizedShellRoot(view.contentEl); await settle();
  expect(view.getState()).toEqual({ planId: rig.plan.id }); expect(warn).toHaveBeenCalledOnce();
  view.rebind(deps); sizedShellRoot(view.contentEl); await settle();
  expect(view.getState()).toEqual({ planId: rig.plan.id }); expect(warn).toHaveBeenCalledOnce();
  expect(view.contentEl.querySelector('canvas')).not.toBeNull();
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
