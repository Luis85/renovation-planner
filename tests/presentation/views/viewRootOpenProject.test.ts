/**
 * @vitest-environment jsdom
 *
 * A project row's click, and the one thing it has to do beyond opening a note: clear itself
 * when the project it names is gone.
 *
 * A project note deleted after this pane was opened drops out of the Project Index silently —
 * `VaultChangeAdapter` publishes nothing — and no caller of `RenovationProjectStore.hydrate`
 * is reachable from a deletion, the `ProjectIndexRebuilt` subscription added by the P1 round
 * after this one included: a rebuild is published by `startPersistence` alone, at layout-ready
 * and on a settings swap. So the row stayed drawn, did nothing
 * when clicked, and said nothing until the view was reopened. `openProjectNote` answers
 * `'missing'` for it now and this file is what holds the answer to a re-read: reported in
 * review against a comment claiming the list was "re-read on the next hydrate anyway", of
 * which there was none.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
import { unavailableRenovationProjectCommands } from '../../../src/presentation/views/renovationProjectCommands';
import { ok } from '../../../src/core/result/Result';
import type { ProjectOpenOutcome } from '../../../src/presentation/views/RenovationProjectContext';

const KITCHEN = { id: 'p1', name: 'Kitchen', status: 'IDEA' };

/**
 * Mounts the view over a list holding one project, and hands back the pieces each case drives:
 * the two spies, and a way to make the vault agree that the project is gone.
 */
async function mountWithOneProject(outcome: ProjectOpenOutcome) {
	setActivePinia(createPinia());
	let projects: readonly (typeof KITCHEN)[] = [KITCHEN];
	const listProjects = vi.fn<() => Promise<unknown>>(() => Promise.resolve(ok({ projects, unreadable: 0 })));
	const openProject = vi.fn<(id: string) => Promise<ProjectOpenOutcome>>(() => Promise.resolve(outcome));
	const wrapper = mount(ViewRoot, {
		global: {
			provide: {
				[RENOVATION_PROJECT_CONTEXT as symbol]: {
					queries: { listProjects },
					commands: unavailableRenovationProjectCommands(),
					openProject,
					// The LIST state, stated rather than omitted: a `provide` value is `unknown`,
					// so an absent key would reach `ViewRoot` as `undefined` once slice 21 gives
					// it a `projectId` to branch on, with nothing to report it. See
					// `viewRootIndexRebuild.test.ts` for the whole argument.
					projectId: null,
					// No index rebuild is published here — this file is about the row's own click.
					onProjectsChanged: () => () => undefined,
				},
			},
		},
	});
	await flushPromises();
	const deleteIt = (): void => {
		projects = [];
	};
	return { wrapper, listProjects, openProject, deleteIt };
}

describe('ViewRoot, opening a project', () => {
	it('re-reads the list when the row turns out to point at nothing, so the stale row goes', async () => {
		const { wrapper, listProjects, openProject, deleteIt } = await mountWithOneProject('missing');
		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(1);

		// The note is deleted between the read and the click — the whole race this answers.
		deleteIt();
		await wrapper.get('.rp-project-list__row').trigger('click');
		await flushPromises();

		expect(openProject).toHaveBeenCalledWith(KITCHEN.id);
		expect(listProjects).toHaveBeenCalledTimes(2);
		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(0);
	});

	it('does not re-read the list when the note opened', async () => {
		// The common case, and the one a blanket re-hydrate would have made expensive: every
		// click on a healthy row would re-read every project note in the vault.
		const { wrapper, listProjects, openProject } = await mountWithOneProject('opened');

		await wrapper.get('.rp-project-list__row').trigger('click');
		await flushPromises();

		expect(openProject).toHaveBeenCalledTimes(1);
		expect(listProjects).toHaveBeenCalledTimes(1);
	});

	it('does not re-read the list when the open faulted', async () => {
		// `'failed'` has already reached the user as a notice (the composition root's own
		// `.catch`), and the list behind the row is not stale — so a vault-wide re-read would
		// answer a question nobody asked.
		const { listProjects, wrapper } = await mountWithOneProject('failed');

		await wrapper.get('.rp-project-list__row').trigger('click');
		await flushPromises();

		expect(listProjects).toHaveBeenCalledTimes(1);
	});
});
