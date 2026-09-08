// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { FakeWorkspace } from '../../helpers/workspace';
import { makeProject } from '../../helpers/entities';
import { expectDefined, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { renovationProjectDeps } from '../../../src/plugin/composition-root';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function setup() {
 const rig = await downstreamStack(), workspace = new FakeWorkspace(), navigate = vi.fn<(projectId: string | null) => void>();
 const attic = makeProject({ name: 'Completed attic', status: 'COMPLETE' }), cellar = makeProject({ name: 'Completed cellar', status: 'COMPLETE' });
 for (const project of [attic, cellar]) expectOk(await rig.persistence.projects.save(project, 'absent'));
 const context = renovationProjectDeps(rig.root, workspace as never, rig.stack.deps.vault, { projectId: null, navigate,
  indexScanCompleted: () => true, continueContext: () => Promise.resolve({ projectId: rig.plan.projectId, planId: rig.plan.id }), rememberContinue: () => undefined });
 const wrapper = mount(ViewRoot, { attachTo: document.body, global: { plugins: [createPinia()], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } } });
 await flushPromises(); return { rig, workspace, navigate, wrapper, attic, cellar, dispose: () => { wrapper.unmount(); rig.dispose(); } };
}
it('opens the actual Continue Project source on a modifier click and uses Project navigation for an ordinary click without changing notes', async () => {
 const { rig, workspace, navigate, wrapper, dispose } = await setup();
 try {
  const bytes = [...rig.stack.vault.entries], open = wrapper.get('.rp-continue__open');
  await open.trigger('click', { ctrlKey: true }); await flushPromises();
  expect(workspace.leaves.flatMap(leaf => leaf.opened.map(file => file.path))).toEqual([rig.persistence.index.getPath(rig.plan.projectId)]); expect(navigate).not.toHaveBeenCalled();
  await open.trigger('click'); await flushPromises(); expect(navigate).toHaveBeenCalledExactlyOnceWith(rig.plan.projectId);
  expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { dispose(); }
});
it('navigates completed Project rows by keyboard, opens their canonical note on modified Enter and keeps modified filter arrows local', async () => {
 const { rig, workspace, navigate, wrapper, attic, cellar, dispose } = await setup();
 try {
  const disclosure = wrapper.get<HTMLDetailsElement>('.rp-project-list__completed'); disclosure.element.open = true; await disclosure.trigger('toggle');
  const filter = wrapper.get<HTMLInputElement>('.rp-project-filter__input'); filter.element.focus();
  await filter.trigger('keydown', { key: 'ArrowDown', altKey: true }); expect(document.activeElement).toBe(filter.element);
  const rows = disclosure.findAll<HTMLButtonElement>('[data-project-id]');
  expect(rows.map(row => row.attributes('data-project-id')).toSorted()).toEqual([attic.id, cellar.id].toSorted());
  const first = expectDefined(rows[0], 'first completed row'), second = expectDefined(rows[1], 'second completed row'), targetId = expectDefined([attic, cellar].find(project => project.id === second.attributes('data-project-id')), 'displayed completed Project').id;
  first.element.focus(); await first.trigger('keydown', { key: 'ArrowDown' }); expect(document.activeElement).toBe(second.element);
  const bytes = [...rig.stack.vault.entries]; await second.trigger('keydown', { key: 'Enter', ctrlKey: true }); await flushPromises();
  expect(workspace.leaves.flatMap(leaf => leaf.opened.map(file => file.path))).toEqual([rig.persistence.index.getPath(targetId)]); expect(navigate).not.toHaveBeenCalled();
  await second.trigger('click'); await flushPromises(); expect(navigate).toHaveBeenCalledExactlyOnceWith(targetId); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { dispose(); }
});
