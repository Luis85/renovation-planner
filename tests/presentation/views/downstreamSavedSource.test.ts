// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { downstreamView } from '../../helpers/downstreamView';
import { expectDefined, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { FakeLeaf, FakeWorkspace } from '../../helpers/workspace';
import { planEditorOpenNote } from '../../../src/plugin/renovationProjectOpenSeams';
import { createSupplier, type SupplierId } from '../../../src/domain/supplier/Supplier';
import { downstreamFloor } from '../../helpers/downstreamFloor';
import { err } from '../../../src/core/result/Result';
import { tr } from '../../../src/presentation/i18n/strings';
import * as notices from '../../../src/presentation/notices/notify';
import { defer } from '../../helpers/async';
installObsidianDom();
type DownstreamView = Awaited<ReturnType<typeof downstreamView>>;
const mounted = new Set<DownstreamView>();
function closeView(view: DownstreamView): void { if (mounted.delete(view)) view.dispose(); }
afterEach(() => { for (const view of mounted) closeView(view); vi.restoreAllMocks(); document.body.replaceChildren(); });
const offline = { category: 'Persistence' as const, code: 'test.saved-readback', message: 'Saved source cannot be refreshed' };
function sourceWorkspace(rig: Awaited<ReturnType<typeof downstreamStack>>, view: Awaited<ReturnType<typeof downstreamView>>) {
 mounted.add(view);
 const workspace = new FakeWorkspace();
 Object.assign(view.context, { openRecord: planEditorOpenNote(workspace as never, rig.stack.deps.vault, rig.persistence.index, rig.stack.logger) });
 return workspace;
}
async function failedQuoteReadback() {
 const rig = await downstreamStack();
 const supplier = expectOk(createSupplier('source-supplier' as SupplierId, 'Source craft'));
 expectOk(await rig.persistence.suppliers.save(supplier, 'absent'));
 const view = await downstreamView(rig, 'quotes'), workspace = sourceWorkspace(rig, view);
 await view.button(tr('quote.add')).trigger('click'); await flushPromises();
 const form = view.wrapper.get('.rp-quote-form');
 for (const [name, value] of [['title', 'Saved new offer'], ['issued', '2026-09-07'], ['item-description', 'Preparation'], ['item-amount', '700.005']]) await form.get('input[name="' + name + '"]').setValue(value);
 await form.get('select[name="supplier"]').setValue(supplier.id);
 await form.trigger('submit'); await flushPromises();
 const read = vi.spyOn(view.quotes, 'read').mockResolvedValue(err(offline)), writes = vi.spyOn(rig.persistence.quotes, 'save');
 await form.trigger('submit'); await flushPromises();
 const saved = expectDefined(expectOk(await rig.persistence.quotes.listByProject(rig.plan.projectId)).loaded[0], 'landed quote');
 return { rig, view, workspace, read, writes, saved };
}
it('opens the newly saved Quote source after read-back fails even when retained comparison has no offer, then retries without another write', async () => {
 const { rig, view, workspace, read, writes, saved } = await failedQuoteReadback();
 try {
  expect(writes).toHaveBeenCalledOnce(); expect(view.wrapper.text()).toContain(tr('save-state.saved-refresh-needed'));
  expect(view.wrapper.findAll('.rp-quote-comparison thead button')).toHaveLength(0);
  const bytes = [...rig.stack.vault.entries];
  await view.wrapper.get('[data-rp-recovery-source]').trigger('click'); await flushPromises();
  expect(workspace.leaves.flatMap(leaf => leaf.opened.map(file => file.path))).toEqual([rig.persistence.index.getPath(saved.entity.id)]);
  expect([...rig.stack.vault.entries]).toEqual(bytes); expect(writes).toHaveBeenCalledOnce();
  read.mockRestore(); const retry = view.button(tr('view.project.resume-retry')); (retry.element as HTMLButtonElement).focus(); await retry.trigger('click'); await flushPromises();
  expect(document.activeElement).toBe(view.wrapper.get('.rp-project-detail__back').element);
  expect(writes).toHaveBeenCalledOnce(); expect(view.wrapper.find('[data-rp-recovery-source]').exists()).toBe(false); expect(view.wrapper.text()).toContain('Saved new offer');
 } finally { closeView(view); }
});
it('reports a saved Quote source deleted by a peer without recreating it or retrying the write', async () => {
 const { rig, view, workspace, writes, saved } = await failedQuoteReadback();
 try {
  const path = expectDefined(rig.persistence.index.getPath(saved.entity.id), 'saved quote path'); rig.stack.vault.entries.delete(path);
  const bytes = [...rig.stack.vault.entries], warn = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
  await view.wrapper.get('[data-rp-recovery-source]').trigger('click'); await flushPromises();
  expect(warn).toHaveBeenCalledExactlyOnceWith(tr('project.source-note-missing')); expect(workspace.leaves).toHaveLength(0);
  expect(writes).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { closeView(view); }
});
it('coalesces source opens and retires their completion after the Project view closes', async () => {
 const { rig, view, workspace, writes } = await failedQuoteReadback(), entered = defer<void>(), held = defer<void>();
 try {
  const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
  const original = FakeLeaf.prototype.openFile;
  vi.spyOn(FakeLeaf.prototype, 'openFile').mockImplementation(async function (this: FakeLeaf, file) { await original.call(this, file); entered.resolve(); await held.promise; });
  const source = view.wrapper.get('[data-rp-recovery-source]');
  await source.trigger('click'); await entered.promise; await source.trigger('click'); await flushPromises();
  expect(workspace.leaves).toHaveLength(1); expect(source.attributes('aria-disabled')).toBe('true');
  const bytes = [...rig.stack.vault.entries]; closeView(view); held.resolve(); await flushPromises();
  expect(report).not.toHaveBeenCalled(); expect(writes).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { held.resolve(); closeView(view); }
});
it('opens the floor of the actual Work history operation when Undo moves between floors and read-back fails', async () => {
 const rig = await downstreamStack();
 const { plan: other } = await downstreamFloor(rig);
 const view = await downstreamView(rig, 'schedule'), workspace = sourceWorkspace(rig, view);
 try {
  for (const id of ['work-sand', 'work-upper']) {
   await view.wrapper.get('[data-work-id="' + id + '"] button').trigger('click'); await flushPromises();
   const form = view.wrapper.get('[data-rp-form="renovation"]'); await form.get('input[name="schedule-start"]').setValue('2026-09-08');
   await form.trigger('submit'); await flushPromises(); await form.trigger('submit'); await flushPromises();
  }
  const writes = vi.spyOn(rig.persistence.plans, 'save');
  for (const planId of [other.id, rig.plan.id]) {
   const read = vi.spyOn(view.work, 'read').mockResolvedValue(err(offline));
   await view.button(tr('editor.context.undo')).trigger('click'); await flushPromises();
   expect(view.wrapper.text()).toContain(tr('save-state.saved-refresh-needed'));
   const count = writes.mock.calls.length, bytes = [...rig.stack.vault.entries];
   await view.wrapper.get('[data-rp-recovery-source]').trigger('click'); await flushPromises();
   expect(workspace.leaves.at(-1)?.opened[0]?.path).toBe(rig.persistence.index.getPath(planId));
   expect(writes).toHaveBeenCalledTimes(count); expect([...rig.stack.vault.entries]).toEqual(bytes);
   read.mockRestore(); await view.button(tr('view.project.resume-retry')).trigger('click'); await flushPromises(); expect(writes).toHaveBeenCalledTimes(count);
  }
 } finally { closeView(view); }
});

it('returns keyboard focus to a persistent Project control when successful Retry removes the stale warning', async () => {
 const { view, read, writes } = await failedQuoteReadback();
 try {
  const retry = view.button(tr('view.project.resume-retry')); (retry.element as HTMLButtonElement).focus();
  read.mockRestore(); await retry.trigger('click'); await flushPromises();
  expect(view.wrapper.text()).not.toContain(tr('save-state.saved-refresh-needed'));
  expect(document.activeElement).toBe(view.wrapper.get('.rp-project-detail__back').element);
  expect(writes).toHaveBeenCalledOnce();
 } finally { closeView(view); }
});

it('reports a real source-opening failure once and permits a later open without replaying the saved Quote', async () => {
 const { rig, view, workspace, writes, saved } = await failedQuoteReadback();
 try {
  const failure = new Error('Host cannot reveal source'), report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
  vi.spyOn(FakeLeaf.prototype, 'openFile').mockRejectedValueOnce(failure); const bytes = [...rig.stack.vault.entries];
  const source = view.wrapper.get('[data-rp-recovery-source]'); await source.trigger('click'); await flushPromises();
  expect(report).toHaveBeenCalledExactlyOnceWith(failure, rig.stack.logger, 'plan-editor.open-note-failed'); expect(source.attributes('aria-disabled')).toBe('false');
  await source.trigger('click'); await flushPromises(); expect(workspace.leaves.at(-1)?.opened[0]?.path).toBe(rig.persistence.index.getPath(saved.entity.id));
  expect(report).toHaveBeenCalledOnce(); expect(writes).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { closeView(view); }
});
it('keeps the saved source action inert while Retry is reading and retires it after the actual source is recovered', async () => {
 const { view, workspace, read, writes } = await failedQuoteReadback(), entered = defer<void>(), held = defer<void>();
 try {
  read.mockRestore(); const original = view.quotes.read.bind(view.quotes);
  vi.spyOn(view.quotes, 'read').mockImplementationOnce(async id => { const result = await original(id); entered.resolve(); await held.promise; return result; });
  await view.button(tr('view.project.resume-retry')).trigger('click'); await entered.promise;
  const source = view.wrapper.get('[data-rp-recovery-source]'); expect(source.attributes('aria-disabled')).toBe('true');
  await source.trigger('click'); await flushPromises(); expect(workspace.leaves).toHaveLength(0);
  held.resolve(); await flushPromises(); expect(view.wrapper.find('[data-rp-recovery-source]').exists()).toBe(false); expect(writes).toHaveBeenCalledOnce();
 } finally { held.resolve(); closeView(view); }
});

it('reports a host file-lookup exception and allows source opening to recover without another saved Quote write', async () => {
 const { rig, view, workspace, writes, saved } = await failedQuoteReadback();
 try {
  const failure = new Error('Host file lookup failed'), report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined), bytes = [...rig.stack.vault.entries];
  vi.spyOn(rig.stack.deps.vault, 'getAbstractFileByPath').mockImplementationOnce(() => { throw failure; });
  const source = view.wrapper.get('[data-rp-recovery-source]'); await source.trigger('click'); await flushPromises();
  expect(report).toHaveBeenCalledExactlyOnceWith(failure, view.context.commands.logger, 'view.project.open-failed'); expect(source.attributes('aria-disabled')).toBe('false');
  await source.trigger('click'); await flushPromises(); expect(workspace.leaves.at(-1)?.opened[0]?.path).toBe(rig.persistence.index.getPath(saved.entity.id));
  expect(writes).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { closeView(view); }
});
it('keeps a saved-source control inert behind a native Project dialog opened through the host command', async () => {
 const { rig, view, workspace, writes } = await failedQuoteReadback();
 try {
  const command = (view.wrapper.vm as unknown as { openNewProjectDialog(): Promise<void> }).openNewProjectDialog;
  void command(); await flushPromises(); expect(view.wrapper.find('.rp-dialog').exists()).toBe(true);
  const bytes = [...rig.stack.vault.entries]; await view.wrapper.get('[data-rp-recovery-source]').trigger('click'); await flushPromises();
  expect(workspace.leaves).toHaveLength(0); expect(writes).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
  await view.wrapper.get('[data-rp-action="cancel"]').trigger('click'); await flushPromises();
  await view.wrapper.get('[data-rp-recovery-source]').trigger('click'); await flushPromises(); expect(workspace.leaves).toHaveLength(1); expect(writes).toHaveBeenCalledOnce();
 } finally { closeView(view); }
});
