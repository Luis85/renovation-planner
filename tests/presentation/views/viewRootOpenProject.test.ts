/**
 * @vitest-environment jsdom
 *
 * The **Open note** action, and the one thing it has to do beyond opening a note: correct the
 * surface that asked when the id turns out to point at nothing.
 *
 * **This file used to be about a project ROW's click**, which is what opened `Project.md` for
 * five slices. Design slice 21's criterion 1 makes a row a NAVIGATION, so the gesture moved to
 * the detail header and the cases moved with it — `viewRootProjectDetail.test.ts` is what pins
 * that a row navigates and does not open a note. The `'missing'` behaviour itself is unchanged
 * and still real: a project note deleted after the pane was opened drops out of the Project
 * Index, and the pane needs telling. **Not because nothing announces it** — an earlier draft of
 * this header said `VaultChangeAdapter` "publishes nothing for it", which
 * `projectListChangeSource.ts` itself records as a sentence it retired:
 * `ProjectIndexEntryChanged` reaches this pane through `onProjectsChanged`. What that refresh
 * cannot do is answer the CLICK the user just made, which is what the `'missing'` arm is for.
 *
 * What DID change is which read corrects it. Slice 21 left the list state with no caller for
 * this handler at all, so the re-read for the DETAIL state's own copy of the action is
 * `ProjectDetailState`'s: it answers `ok(null)`, settles `'gone'`, and returns the user to the
 * list. Re-reading the list from the detail state would refresh something nobody is looking at
 * — an earlier draft of this slice's plan specified exactly that.
 *
 * **Task 8 gives the LIST state a caller again, through a different door.** A row no longer
 * opens a note on a plain click — that stays `context.navigate(id)` — but it does on the
 * `Mod+↵`/middle-click/modifier-click accelerators design spec §7 gives it, and those go
 * through `ViewRoot`'s own `onOpenNote`, re-reading the PROJECT LIST rather than one project's
 * detail: the surface that asked is the one that gets corrected, same rule as the detail
 * state's, applied to its sibling. The block below this comment is that caller's cases.
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
 * Mounts the view in the DETAIL state for one project, and hands back the pieces each case
 * drives: the two spies, the navigation, and a way to make the vault agree that the project's
 * note is gone.
 *
 * `getProject` is the spy that discriminates here, not `listProjects`: the count of DETAIL
 * reads is what says whether the stale surface was corrected, and every case in this file is
 * mounted on the surface that asked.
 */
async function mountOnOneProject(outcome: ProjectOpenOutcome) {
	setActivePinia(createPinia());
	let exists = true;
	const getProject = vi.fn<() => Promise<unknown>>(() => Promise.resolve(ok(exists ? KITCHEN : null)));
	const openProject = vi.fn<(id: string) => Promise<ProjectOpenOutcome>>(() => Promise.resolve(outcome));
	const navigate = vi.fn<(projectId: string | null) => void>();
	const wrapper = mount(ViewRoot, {
		global: {
			provide: {
				[RENOVATION_PROJECT_CONTEXT as symbol]: {
					queries: {
						listProjects: () => Promise.resolve(ok({ projects: [KITCHEN], unreadable: 0 })),
						getProject,
						listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
					},
					commands: unavailableRenovationProjectCommands(),
					openProject,
					// The DETAIL state, which is where this action lives. Stated rather than
					// omitted for the reason `viewRootIndexRebuild.test.ts` gives at length: a
					// `provide` value is `unknown`, so nothing type-checks this literal and an
					// absent key reaches `ViewRoot` as an `undefined` no gate would report.
					projectId: KITCHEN.id,
					navigate,
					openPlan: () => Promise.resolve(),
					onProjectsChanged: () => () => undefined,
					onPlansChanged: () => () => undefined,
					// TRUE, so an `ok(null)` from the fake above is authoritative rather than a
					// read that merely raced the index scan — which is the state this file's
					// first case is about.
					indexScanCompleted: () => true,
				},
			},
		},
	});
	await flushPromises();
	const deleteIt = (): void => {
		exists = false;
	};
	return { wrapper, getProject, openProject, navigate, deleteIt };
}

describe('ViewRoot, opening a project’s note', () => {
	it('re-reads the project when the action turns out to point at nothing, and leaves the detail state', async () => {
		const { wrapper, getProject, openProject, navigate, deleteIt } = await mountOnOneProject('missing');
		expect(wrapper.find('.rp-project-detail').exists()).toBe(true);

		// The note is deleted between the read and the click — the whole race this answers.
		deleteIt();
		await wrapper.get('.rp-project-detail__open-note').trigger('click');
		await flushPromises();

		expect(openProject).toHaveBeenCalledWith(KITCHEN.id);
		expect(getProject).toHaveBeenCalledTimes(2);
		// The re-read is not the point on its own: what the user needs is to stop being in a
		// detail state for a project that does not exist. This asserted the redirect until the
		// `'gone'` watcher was retired; what replaced it is the screen, and `navigate` is
		// asserted NOT called for the reason that task gives — an automatic redirect records a
		// history entry nobody asked for.
		expect(wrapper.find('.rp-project-detail').exists()).toBe(false);
		expect(navigate).not.toHaveBeenCalled();
	});

	it('does not re-read when the note opened', async () => {
		// The common case, and the one a blanket re-hydrate would have made expensive: every
		// press on a healthy project would re-read that project and its whole plan list.
		const { wrapper, getProject, openProject, navigate } = await mountOnOneProject('opened');

		await wrapper.get('.rp-project-detail__open-note').trigger('click');
		await flushPromises();

		expect(openProject).toHaveBeenCalledTimes(1);
		expect(getProject).toHaveBeenCalledTimes(1);
		expect(navigate).not.toHaveBeenCalled();
	});

	it('does not re-read when the open faulted', async () => {
		// `'failed'` has already reached the user as a notice (the composition root's own
		// `.catch`), and what is drawn behind the action is not stale — so a re-read would
		// answer a question nobody asked, and navigating would claim a deletion that did not
		// happen.
		const { wrapper, getProject, navigate } = await mountOnOneProject('failed');

		await wrapper.get('.rp-project-detail__open-note').trigger('click');
		await flushPromises();

		expect(getProject).toHaveBeenCalledTimes(1);
		expect(navigate).not.toHaveBeenCalled();
	});
});

/**
 * Mounts the view in the LIST state with one project, and hands back the row-level accelerator
 * spies. `listProjects` is the spy that discriminates here, not `getProject`: the count of LIST
 * reads is what says whether the stale surface — the list a row was drawn from — was corrected.
 */
async function mountOnListState(outcome: ProjectOpenOutcome) {
	setActivePinia(createPinia());
	let exists = true;
	const listProjects = vi.fn<() => Promise<unknown>>(() =>
		Promise.resolve(ok({ projects: exists ? [KITCHEN] : [], unreadable: 0 })),
	);
	const openProject = vi.fn<(id: string) => Promise<ProjectOpenOutcome>>(() => Promise.resolve(outcome));
	const wrapper = mount(ViewRoot, {
		global: {
			provide: {
				[RENOVATION_PROJECT_CONTEXT as symbol]: {
					queries: {
						listProjects,
						getProject: () => Promise.resolve(ok(null)),
						listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
					},
					commands: unavailableRenovationProjectCommands(),
					openProject,
					// The LIST state — `null`, not `KITCHEN.id` — which is the surface Task 8's
					// row-level accelerators reach `onOpenNote` from.
					projectId: null,
					navigate: () => undefined,
					openPlan: () => Promise.resolve(),
					openAsset: () => Promise.resolve(),
					onProjectsChanged: () => () => undefined,
					onPlansChanged: () => () => undefined,
					indexScanCompleted: () => true,
				},
			},
		},
	});
	await flushPromises();
	const deleteIt = (): void => {
		exists = false;
	};
	return { wrapper, listProjects, openProject, deleteIt };
}

describe('ViewRoot, a row’s open-note accelerator', () => {
	it('re-reads the project LIST when the row turns out to point at nothing', async () => {
		const { wrapper, listProjects, openProject, deleteIt } = await mountOnListState('missing');
		deleteIt();

		// A middle click is platform-independent — unlike `Mod+↵`, it carries no modifier for
		// `Platform.isMacOS` to disagree about.
		await wrapper.get('.rp-project-list__row').trigger('auxclick', { button: 1 });
		await flushPromises();

		expect(openProject).toHaveBeenCalledWith(KITCHEN.id);
		expect(listProjects).toHaveBeenCalledTimes(2);
	});

	it('does not re-read the list when the note opened', async () => {
		const { wrapper, listProjects, openProject } = await mountOnListState('opened');

		await wrapper.get('.rp-project-list__row').trigger('auxclick', { button: 1 });
		await flushPromises();

		expect(openProject).toHaveBeenCalledTimes(1);
		expect(listProjects).toHaveBeenCalledTimes(1);
	});

	it('does not re-read the list when the open faulted', async () => {
		// `'failed'` has already reached the user as a notice; the list behind the action is not
		// stale, so a re-read would answer a question nobody asked.
		const { wrapper, listProjects } = await mountOnListState('failed');

		await wrapper.get('.rp-project-list__row').trigger('auxclick', { button: 1 });
		await flushPromises();

		expect(listProjects).toHaveBeenCalledTimes(1);
	});
});
