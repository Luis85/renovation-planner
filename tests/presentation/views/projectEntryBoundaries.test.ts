// @vitest-environment jsdom
import { Platform } from 'obsidian';
import { afterEach, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import { createRepositoryStack } from '../../helpers/vault';
import { makeView } from '../../helpers/makeRenovationProjectView';
import { FakeWorkspace } from '../../helpers/workspace';
import { expectDefined, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { createCompositionRoot, renovationProjectDeps } from '../../../src/plugin/composition-root';
import { DEFAULT_SETTINGS } from '../../../src/plugin/settings/settings';
import type { RenovationProjectDeps } from '../../../src/presentation/views/RenovationProjectContext';
import { ASSET_LIBRARY_VIEW } from '../../../src/presentation/library/AssetLibraryView';
import { tr } from '../../../src/presentation/i18n/strings';

installObsidianDom();
const originalMobile = Platform.isMobile, cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0)) await cleanup();
	Platform.isMobile = originalMobile; vi.restoreAllMocks(); document.body.replaceChildren();
});

async function setup(withProject = false) {
	const stack = createRepositoryStack(), root = createCompositionRoot(DEFAULT_SETTINGS, stack.logger, stack.deps);
	const persistence = expectDefined(root.persistence, 'real persistence'), workspace = new FakeWorkspace();
	const navigate = vi.fn<RenovationProjectDeps['navigate']>();
	const context = renovationProjectDeps(root, workspace as never, stack.deps.vault, { projectId: null, navigate,
		indexScanCompleted: () => true, continueContext: () => Promise.resolve(null), rememberContinue: () => undefined });
	const project = withProject ? expectOk(await context.commands.createProject.execute({ name: 'Project entry fixture' })).project.entity : null;
	stack.metadataCache.catchUp();
	const view = makeView(context); document.body.append(view.containerEl);
	cleanups.push(async () => { await view.onClose(); for (const subscription of persistence.subscriptions) subscription.dispose(); view.containerEl.remove(); });
	await view.setState({ projectId: project?.id ?? '' }, { history: false }); await view.onOpen(); await flushPromises();
	return { stack, persistence, workspace, navigate, project, view, wrapper: new DOMWrapper(view.contentEl) };
}

it('keeps the actual empty mobile launcher readable with only the available Library entry and no creation writes', async () => {
	Platform.isMobile = true;
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	expect(rig.wrapper.get('.rp-empty-state').text()).toContain(tr('empty.project.no-projects.headline'));
	expect(rig.wrapper.find('.rp-empty-state button').exists()).toBe(false);
	expect(rig.wrapper.find('.rp-view-aside__create-asset').exists()).toBe(false);
	expect(rig.wrapper.find('.rp-project-list__create').exists()).toBe(false);
	const library = rig.wrapper.get<HTMLButtonElement>('.rp-view-aside__open-library');
	library.element.focus(); library.element.click(); await flushPromises();
	expect(rig.workspace.leaves.map(leaf => leaf.state?.type)).toEqual([ASSET_LIBRARY_VIEW]);
	expect(rig.navigate).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	expect(expectOk(await rig.persistence.projects.listAll()).loaded).toEqual([]);
});

it('keeps the native New Project draft after a real vault write failure and navigates only after the explicit successful retry', async () => {
	const rig = await setup();
	rig.wrapper.get<HTMLButtonElement>('.rp-empty-state button').element.click(); await flushPromises();
	const form = rig.wrapper.get('.rp-dialog form'), name = form.get<HTMLInputElement>('input[data-field="name"]');
	await name.setValue('Retained project entry'); name.element.focus();
	const before = [...rig.stack.vault.entries];
	const create = vi.spyOn(rig.stack.vault, 'create').mockRejectedValueOnce(new Error('Synthetic project note write failed'));
	form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await flushPromises();
	expect(form.find('.rp-form-banner').exists()).toBe(true); expect(name.element.value).toBe('Retained project entry');
	expect(rig.navigate).not.toHaveBeenCalled(); expect(create).toHaveBeenCalledOnce();
	expect(expectOk(await rig.persistence.projects.listAll()).loaded).toEqual([]);
	expect([...rig.stack.vault.entries]).toEqual(before);
	// mockRejectedValueOnce is exhausted: retry uses the original real vault writer.
	form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await flushPromises();
	const projects = expectOk(await rig.persistence.projects.listAll());
	expect(projects.loaded).toHaveLength(1);
	const saved = expectDefined(projects.loaded[0], 'created Project');
	expect(saved.entity.name).toBe('Retained project entry'); expect(saved.version.revision).toBe(1);
	expect(create).toHaveBeenCalledTimes(2); expect(rig.navigate).toHaveBeenCalledExactlyOnceWith(saved.entity.id);
	expect(rig.wrapper.find('.rp-dialog').exists()).toBe(false);
});

it.each([
	{ section: 'schedule', label: 'schedule.open' }, { section: 'quotes', label: 'quote.comparison' },
] as const)('opens $section through the native Project Detail entry with the actual Project identity', async ({ section, label }) => {
	const rig = await setup(true), project = expectDefined(rig.project, 'fixture Project'), bytes = [...rig.stack.vault.entries];
	expect(rig.wrapper.get('.rp-project-detail__name').text()).toBe(project.name);
	const action = expectDefined(rig.wrapper.findAll<HTMLButtonElement>('.rp-project-guidance button').find(button => button.text() === tr(label)), 'native downstream entry');
	action.element.focus(); action.element.click(); await flushPromises();
	expect(rig.navigate).toHaveBeenCalledExactlyOnceWith(project.id, section);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	expect(rig.view.getState()).toMatchObject({ projectId: project.id });
});
