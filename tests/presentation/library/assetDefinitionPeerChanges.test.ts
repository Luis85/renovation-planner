// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { mountRoot } from '../../helpers/assetLibraryRootHarness';
import { FakeWorkspace } from '../../helpers/workspace';
import { expectFound, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { assetLibraryDeps } from '../../../src/plugin/assetLibraryDeps';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function setup() {
 const rig = await downstreamStack(), workspace = new FakeWorkspace();
 const deps = assetLibraryDeps(rig.root, workspace as never, rig.stack.deps.vault, { indexScanCompleted: () => true });
 const wrapper = await mountRoot({ ...deps, assetId: ref(rig.asset.id), expanded: ref([rig.asset.category]), attach: true });
 await flushPromises(); return { rig, wrapper, dispose: () => { wrapper.unmount(); rig.dispose(); } };
}
it.each([false, true])('refreshes a clean mounted definition from a canonical peer edit after a local save: %s', async locallySaved => {
 const { rig, wrapper, dispose } = await setup();
 try {
  if (locallySaved) {
   await wrapper.get('[data-field="sku"]').setValue('LOCAL-SAVED'); await wrapper.get('.rp-al-definition').trigger('submit'); await flushPromises();
  }
  const name = wrapper.get<HTMLInputElement>('[data-field="name"]').element;
  const current = expectFound(await rig.persistence.assets.getById(rig.asset.id)), writes = vi.spyOn(rig.persistence.updateAsset, 'execute');
  expectOk(await rig.persistence.updateAsset.execute({ assetId: rig.asset.id, expected: current.version, changes: { name: 'Peer renamed floor', supplier: 'Peer timber yard' } }));
  await flushPromises();
  expect(wrapper.get('[data-field="name"]').element).toBe(name); expect(name.value).toBe('Peer renamed floor');
  expect(wrapper.get<HTMLInputElement>('[data-field="supplier"]').element.value).toBe('Peer timber yard');
  const saved = expectFound(await rig.persistence.assets.getById(rig.asset.id)); expect(saved.entity.sku).toBe(current.entity.sku);
  const bytes = [...rig.stack.vault.entries]; await wrapper.get('.rp-al-definition').trigger('submit'); await flushPromises();
  expect(writes).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { dispose(); }
});
it('preserves a native local definition draft across a canonical peer edit and allows explicit discard without replaying a write', async () => {
 const { rig, wrapper, dispose } = await setup();
 try {
  await wrapper.get('[data-field="supplier"]').setValue('Local unsaved supplier');
  const current = expectFound(await rig.persistence.assets.getById(rig.asset.id));
  expectOk(await rig.persistence.updateAsset.execute({ assetId: rig.asset.id, expected: current.version, changes: { supplier: 'Peer supplier' } })); await flushPromises();
  const writes = vi.spyOn(rig.persistence.updateAsset, 'execute'), bytes = [...rig.stack.vault.entries];
  expect(wrapper.get<HTMLInputElement>('[data-field="supplier"]').element.value).toBe('Local unsaved supplier');
  expect(wrapper.text()).toContain('Peer supplier'); await wrapper.get('.rp-al-definition').trigger('submit'); await flushPromises();
  expect(writes).not.toHaveBeenCalled();
  await wrapper.get('.rp-al-draft-actions button[type="button"]').trigger('click'); await flushPromises();
  expect(wrapper.get<HTMLInputElement>('[data-field="supplier"]').element.value).toBe('Peer supplier'); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { dispose(); }
});
