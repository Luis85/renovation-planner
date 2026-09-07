// @vitest-environment jsdom
import { Platform } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { downstreamStack } from '../../helpers/downstream';
import { mountRoot } from '../../helpers/assetLibraryRootHarness';
import { FakeWorkspace } from '../../helpers/workspace';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { installObsidianDom } from '../../helpers/dom';
import { assetLibraryDeps } from '../../../src/plugin/assetLibraryDeps';
import { renovationProjectDeps } from '../../../src/plugin/composition-root';
import { editorWorkspaceNavigation } from '../../../src/plugin/editorWorkspaceNavigation';
import { RenovationProjectView } from '../../../src/presentation/views/RenovationProjectView';
import { navigateToProject } from '../../../src/infrastructure/obsidian/workspace/navigateToProject';
import { compare, of } from '../../../src/core/money/Money';
import { tr } from '../../../src/presentation/i18n/strings';

installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); });
async function library() {
 const rig = await downstreamStack(), workspace = new FakeWorkspace();
 const editor = workspace.withOpen('renovation-plan-editor', { planId: rig.plan.id });
 const libraryLeaf = workspace.withOpen('renovation-asset-library', { assetId: rig.asset.id, expanded: [rig.asset.category] });
 const deps = assetLibraryDeps(rig.root, workspace as never, rig.stack.deps.vault, { indexScanCompleted: () => true });
 const selected = ref<string>(rig.asset.id), expanded = ref<readonly string[]>([rig.asset.category]);
 const wrapper = await mountRoot({ ...deps, assetId: selected, expanded, attach: true });
 await flushPromises();
 const rootElement = wrapper.element;
 return { rig, workspace, editor, libraryLeaf, wrapper, selected, expanded, deps,
  dispose: () => { wrapper.unmount(); rootElement.remove(); rig.dispose(); } };
}

describe('Project and Library dependencies of editor navigation', () => {
 it('reuses Library state from the editor and selects a genuinely created asset after clearing an old search', async () => {
  const view = await library(), { rig, wrapper } = view;
  try {
   const editorState = view.editor.state, libraryState = view.libraryLeaf.state;
   editorWorkspaceNavigation(view.workspace as never, rig.root.logger).library(); await flushPromises();
   expect(view.workspace.leaves).toHaveLength(2); expect(view.libraryLeaf.state).toBe(libraryState); expect(view.editor.state).toBe(editorState);
   expect(view.selected.value).toBe(rig.asset.id); expect(view.expanded.value).toEqual([rig.asset.category]);
   await wrapper.get('.rp-al-search__input').setValue('No matching catalogue item'); await flushPromises();
   const create = vi.spyOn(rig.persistence.createAsset, 'execute');
   await wrapper.get('.rp-al-create').trigger('click'); await flushPromises();
   const form = wrapper.get('[role="dialog"] form');
   await form.get('[data-field="name"]').setValue('Hall cabinet');
   await form.get('[data-field="category"]').setValue('furniture'); await form.get('[data-field="unit"]').setValue('piece');
   await form.get('[data-field="unitCostAmount"]').setValue('450.00'); await form.trigger('submit'); await flushPromises();
   expect(create).toHaveBeenCalledOnce(); expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
   const created = expectOk(await rig.persistence.assets.listAll()).loaded.filter(item => item.entity.name === 'Hall cabinet');
   expect(created).toHaveLength(1); const asset = created[0].entity;
   expect(asset.id).not.toBe(rig.asset.id); expect(asset.category).toBe('furniture'); expect(asset.unit).toBe('piece'); expect(expectOk(compare(asset.unitCost, of('450.00', 'EUR')))).toBe(0);
   expect(wrapper.get<HTMLInputElement>('.rp-al-search__input').element.value).toBe('');
   expect(view.expanded.value).toContain('furniture'); expect(view.selected.value).toBe(asset.id);
   expect(wrapper.attributes('data-selected-asset-id')).toBe(asset.id);
   expect(wrapper.get<HTMLInputElement>('[data-field="name"]').element.value).toBe('Hall cabinet');
   const afterCreate = [...rig.stack.vault.entries];
   await view.workspace.revealLeaf(view.editor as never);
   expect(view.editor.state).toBe(editorState); expect([...rig.stack.vault.entries]).toEqual(afterCreate);
  } finally { view.dispose(); }
 });

 it('reopens the same searched asset without discarding or saving its dirty definition', async () => {
  const view = await library(), { rig, wrapper } = view;
  try {
   const bytes = [...rig.stack.vault.entries], update = vi.spyOn(rig.persistence.updateAsset, 'execute');
   await wrapper.get('[data-field="supplier"]').setValue('Local unsaved supplier');
   await wrapper.get('.rp-al-inspector__back').trigger('click'); await flushPromises();
   expect(wrapper.attributes('data-selected-asset-id')).toBe('');
   await wrapper.get('.rp-al-search__input').setValue(rig.asset.name); await flushPromises();
   await wrapper.get(`[data-asset-id="${rig.asset.id}"]`).trigger('click'); await flushPromises();
   expect(wrapper.attributes('data-selected-asset-id')).toBe(rig.asset.id);
   expect(wrapper.get<HTMLInputElement>('[data-field="supplier"]').element.value).toBe('Local unsaved supplier');
   expect(wrapper.find('[role="dialog"]').exists()).toBe(false); expect(update).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
   await wrapper.get('.rp-al-draft-actions button[type="button"]').trigger('click'); await flushPromises();
   const saved = expectFound(await rig.persistence.assets.getById(rig.asset.id));
   expect(wrapper.get<HTMLInputElement>('[data-field="supplier"]').element.value).toBe(saved.entity.supplier ?? '');
   expect(update).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
  } finally { view.dispose(); }
 });

 it('coalesces repeated native Refresh clicks while retaining a definition draft after a real peer edit', async () => {
  const view = await library(), { rig, wrapper, deps } = view, entered = defer<void>(), release = defer<void>();
  try {
   await wrapper.get('[data-field="supplier"]').setValue('Keep my supplier draft');
   const beforePeer = expectFound(await rig.persistence.assets.getById(rig.asset.id));
   expectOk(await rig.persistence.updateAsset.execute({ assetId: rig.asset.id, expected: beforePeer.version, changes: { supplier: 'Peer supplier' } }));
   await flushPromises(); expect(wrapper.text()).toContain('Peer supplier');
   const bytes = [...rig.stack.vault.entries], update = vi.spyOn(rig.persistence.updateAsset, 'execute');
   const query = deps.queries.listCatalogue.bind(deps.queries);
   const read = vi.spyOn(deps.queries, 'listCatalogue').mockImplementationOnce(async () => {
    const result = await query(); expect(result.ok).toBe(true); entered.resolve(); await release.promise; return result;
   });
   const retry = expectDefined(wrapper.findAll<HTMLButtonElement>('.rp-al-draft-actions button').find(button => button.text() === tr('view.failure.retry')), 'definition Refresh');
   retry.element.click(); await entered.promise;
   retry.element.click(); await flushPromises();
   expect(read).toHaveBeenCalledOnce(); expect(update).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
   expect(wrapper.get<HTMLInputElement>('[data-field="supplier"]').element.value).toBe('Keep my supplier draft');
   release.resolve(); await flushPromises();
   expect(read).toHaveBeenCalledOnce(); expect(update).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
   expect(wrapper.get<HTMLInputElement>('[data-field="supplier"]').element.value).toBe('Keep my supplier draft');
   expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  } finally { release.resolve(); await flushPromises(); view.dispose(); }
 });

 it('keeps mobile no-match Project search read-only while native Project navigation and return remain available', async () => {
  const rig = await downstreamStack(), workspace = new FakeWorkspace(), platform = Platform as { isMobile: boolean };
  const previousMobile = platform.isMobile;
  const leaf = workspace.withOpen('renovation-project', { projectId: '' });
  const deps = renovationProjectDeps(rig.root, workspace as never, rig.stack.deps.vault, {
   projectId: null, indexScanCompleted: () => true, continueContext: () => Promise.resolve(null), rememberContinue: () => undefined,
   navigate: (id, section) => { void navigateToProject({ workspace: workspace as never, reportFault: cause => rig.root.logger.error('test.navigation.failed', { cause }) }, 'renovation-project', id, leaf as never, section); },
  });
  const openPlan = vi.spyOn(deps, 'openPlan'), create = vi.spyOn(deps.commands.createProject, 'execute');
  const view = new RenovationProjectView(leaf as never, deps); leaf.view = view;
  document.body.append(view.containerEl);
  platform.isMobile = true;
  try {
   await view.onOpen(); await flushPromises();
   const root = new DOMWrapper(view.contentEl), bytes = [...rig.stack.vault.entries];
   await root.get('.rp-project-filter__input').setValue('No matching renovation'); await flushPromises();
   expect(root.get('.rp-project-list__no-match').text()).toContain('No matching renovation');
   expect(root.find('.rp-project-list__create-named').exists()).toBe(false); expect(root.find('.rp-project-list__create').exists()).toBe(false);
   root.get<HTMLButtonElement>('.rp-project-list__clear-filter').element.click(); await flushPromises();
   expect(root.get<HTMLInputElement>('.rp-project-filter__input').element.value).toBe('');
   root.get<HTMLButtonElement>(`[data-project-id="${rig.plan.projectId}"]`).element.click(); await flushPromises();
   expect(view.getState()).toMatchObject({ projectId: rig.plan.projectId }); expect(root.find('.rp-project-detail__back').exists()).toBe(true);
   expect(root.get<HTMLButtonElement>('.rp-plan-list__row').element.disabled).toBe(true);
   root.get<HTMLButtonElement>('.rp-project-detail__back').element.click(); await flushPromises();
   expect(view.getState()).toMatchObject({ projectId: '' }); expect(root.find(`[data-project-id="${rig.plan.projectId}"]`).exists()).toBe(true);
   expect(openPlan).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(root.find('[role="dialog"]').exists()).toBe(false);
   expect([...rig.stack.vault.entries]).toEqual(bytes);
  } finally { await view.onClose(); view.containerEl.remove(); platform.isMobile = previousMobile; rig.dispose(); }
 });
});
