import type { ProjectOrigin } from '../../src/application/navigation/ProjectDestination';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ViewRoot from '../../src/presentation/views/ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT, type RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';
import { projectWorkServices } from '../../src/plugin/projectWorkServices';
import { quoteServices } from '../../src/plugin/quoteServices';
import { defaultRenovationProjectDeps } from './makeRenovationProjectView';
import type { downstreamStack } from './downstream';
import { expectDefined } from './domain';
export async function downstreamView(rig: Awaited<ReturnType<typeof downstreamStack>>, section: 'schedule' | 'quotes', origin?: ProjectOrigin) {
 const work = expectDefined(projectWorkServices(rig.root, rig.stack.deps.vault, {} as never), 'work services');
 const quotes = expectDefined(quoteServices(rig.root), 'quote services');
 const context: RenovationProjectDeps = { ...defaultRenovationProjectDeps(), projectId: rig.plan.projectId, section, origin, work, quotes, session: { query: '', completedOpen: false, focusedProjectId: null, scrollTop: 0, guidanceHidden: false } };
 const wrapper = mount(ViewRoot, { attachTo: document.body, global: { plugins: [createPinia()], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } } });
 await flushPromises();
 function button(text: string) { return expectDefined(wrapper.findAll('button').find(item => item.text() === text), 'button ' + text); }
 return { wrapper, work, quotes, context, button, dispose: () => { wrapper.unmount(); rig.dispose(); } };
}
