// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { downstreamStack } from '../../helpers/downstream';
import { FakeWorkspace } from '../../helpers/workspace';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined } from '../../helpers/domain';
import { createCompositionRoot, renovationProjectDeps } from '../../../src/plugin/composition-root';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
import { tr } from '../../../src/presentation/i18n/strings';
installObsidianDom();
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
it.each(['schedule', 'quotes'] as const)('restores %s with explicit unavailable-settings recovery and no blank authoritative data or writes', async section => {
 const rig = await downstreamStack(), workspace = new FakeWorkspace(), navigate = vi.fn<(projectId: string | null) => void>();
 const unavailable = createCompositionRoot(null, rig.stack.logger, rig.stack.deps);
 const context = { ...renovationProjectDeps(unavailable, workspace as never, rig.stack.deps.vault, { projectId: rig.plan.projectId, navigate,
  indexScanCompleted: () => false, continueContext: () => Promise.resolve(null), rememberContinue: () => undefined }), section };
 const wrapper = mount(ViewRoot, { attachTo: document.body, global: { plugins: [createPinia()], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } } });
 try {
  await flushPromises(); const bytes = [...rig.stack.vault.entries];
  expect(wrapper.get('[role="alert"]').text()).toContain(tr('settings.unrecovered'));
  expect(wrapper.text()).not.toContain(tr('quote.empty')); expect(wrapper.text()).not.toContain(tr('schedule.empty'));
  for (const button of wrapper.findAll('button[aria-disabled="true"]')) { await button.trigger('click'); await flushPromises(); }
  expect(wrapper.find('.rp-dialog').exists()).toBe(false);
  await expectDefined(wrapper.findAll('button').find(button => button.text() === tr('view.project.resume-retry')), 'retry').trigger('click'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain(tr('settings.unrecovered'));
  await wrapper.get('.rp-project-detail__back').trigger('click'); expect(navigate).toHaveBeenCalledExactlyOnceWith(rig.plan.projectId);
  expect(workspace.leaves).toHaveLength(0); expect([...rig.stack.vault.entries]).toEqual(bytes);
 } finally { wrapper.unmount(); rig.dispose(); }
});
