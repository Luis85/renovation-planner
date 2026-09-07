import { afterEach, describe, expect, it, vi } from 'vitest';
import { defer } from '../../../helpers/async';
import type { WorkspaceLeaf } from 'obsidian';
import { FakeLeaf, FakeWorkspace } from '../../../helpers/workspace';
import { revealPlanEditor } from '../../../../src/infrastructure/obsidian/workspace/revealPlanEditor';
import { prepareEditorArrival } from '../../../../src/infrastructure/obsidian/workspace/editorArrivalQueue';
const TYPE = 'renovation-plan-editor';
const origin = { planId: 'plan-a', roomId: 'room-a', workId: 'work-a' };
const depsFor = (workspace: FakeWorkspace, reportFault = vi.fn<(cause: unknown) => void>()): Parameters<typeof revealPlanEditor>[0] => ({ workspace, reportFault }) as unknown as Parameters<typeof revealPlanEditor>[0];
const hostLeaf = (leaf: FakeLeaf): WorkspaceLeaf => leaf as unknown as WorkspaceLeaf;
afterEach(() => { vi.restoreAllMocks(); });
describe('contextual editor arrival', () => {
 it('joins a plain open and two identical contextual opens while the host constructs the Plan leaf', async () => {
  const workspace = new FakeWorkspace(), gate = defer<void>(), entered = defer<void>();
  const original = FakeLeaf.prototype.setViewState;
  const writes = vi.spyOn(FakeLeaf.prototype, 'setViewState').mockImplementationOnce(async function (this: FakeLeaf, state) { entered.resolve(); await gate.promise; await original.call(this, state); });
  const plain = revealPlanEditor(depsFor(workspace), TYPE, origin.planId);
  await entered.promise;
  const first = revealPlanEditor(depsFor(workspace), TYPE, origin.planId, origin);
  const repeated = revealPlanEditor(depsFor(workspace), TYPE, origin.planId, { ...origin });
  gate.resolve();
  expect(await Promise.all([plain, first, repeated])).toEqual(['opened', 'opened', 'opened']);
  expect(workspace.leaves).toHaveLength(1); expect(writes).toHaveBeenCalledTimes(2);
  expect(workspace.leaves[0].state?.state).toEqual({ planId: origin.planId, origin });
 });
 it('retains an existing leaf and applies only the latest queued source after an active arrival finishes', async () => {
  const workspace = new FakeWorkspace(), leaf = workspace.withOpen(TYPE, { planId: origin.planId, camera: 'retained' }), gate = defer<void>(), entered = defer<void>();
  const original = leaf.setViewState.bind(leaf);
  const writes = vi.spyOn(leaf, 'setViewState').mockImplementationOnce(async state => { entered.resolve(); await gate.promise; await original(state); });
  const first = revealPlanEditor(depsFor(workspace), TYPE, origin.planId, origin); await entered.promise;
  const next = revealPlanEditor(depsFor(workspace), TYPE, origin.planId, { ...origin, workId: 'work-b' });
  const last = revealPlanEditor(depsFor(workspace), TYPE, origin.planId, { ...origin, workId: 'work-c' });
  gate.resolve(); await Promise.all([first, next, last]);
  expect(workspace.leaves).toEqual([leaf]); expect(writes).toHaveBeenCalledTimes(2);
  expect(leaf.state?.state).toEqual({ planId: origin.planId, camera: 'retained', origin: { ...origin, workId: 'work-c' } });
 });
 it('discards an older issued arrival when its reveal completes after a newer source', async () => {
  const workspace = new FakeWorkspace(), leaf = workspace.withOpen(TYPE, { planId: origin.planId });
  const older = prepareEditorArrival(origin), newer = prepareEditorArrival({ ...origin, workId: 'work-b' }), fault = vi.fn<(cause: unknown) => void>();
  const writes = vi.spyOn(leaf, 'setViewState');
  await newer(hostLeaf(leaf), fault); await older(hostLeaf(leaf), fault);
  expect(writes).toHaveBeenCalledOnce(); expect(leaf.state?.state?.['origin']).toMatchObject({ workId: 'work-b' }); expect(fault).not.toHaveBeenCalled();
 });
 it('reports a failed contextual host action once and lets the same origin retry', async () => {
  const workspace = new FakeWorkspace(), leaf = workspace.withOpen(TYPE, { planId: origin.planId }), fault = vi.fn<(cause: unknown) => void>();
  vi.spyOn(leaf, 'setViewState').mockRejectedValueOnce(new Error('host navigation refused'));
  const deps = depsFor(workspace, fault);
  expect(await Promise.all([revealPlanEditor(deps, TYPE, origin.planId, origin), revealPlanEditor(deps, TYPE, origin.planId, origin)])).toEqual(['failed', 'failed']);
  expect(fault).toHaveBeenCalledOnce();
  expect(await revealPlanEditor(deps, TYPE, origin.planId, origin)).toBe('opened');
  expect(leaf.state?.state?.['origin']).toEqual(origin);
 });
});
