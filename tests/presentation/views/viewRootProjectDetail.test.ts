/**
 * @vitest-environment jsdom
 *
 * The detail state, drawn by `ViewRoot` — design slice 21's seam, where the two new queries,
 * `ProjectDetailStore`, the five context members, `ProjectDetail`/`PlanList` and `NewPlanForm`
 * all meet for the first time.
 *
 * Every case mounts the REAL `ViewRoot` and drives a real gesture, because each of the four
 * intents this task wires (navigate in, navigate back, open a plan, create a plan) is a
 * template binding that no unit test of any one piece can see. The three that could have been
 * asserted on a spy alone — the create, the vanished project, and the stale Open note — are
 * deliberately asserted on what the user is left looking at instead, since "hydrate was
 * called" is equally true of the builds those cases exist to refuse.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import {
	RENOVATION_PROJECT_CONTEXT,
	type ProjectOpenOutcome,
	type RenovationProjectDeps,
} from '../../../src/presentation/views/RenovationProjectContext';
import type { RenovationProjectCommandServices } from '../../../src/presentation/views/renovationProjectCommands';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';
import type { PlanSummaryDto, ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { ObservationToken } from '../../../src/application/ports/versioning';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import { err, ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';
import { makePlan } from '../../helpers/entities';
import { installObsidianDom } from '../../helpers/dom';
import { Notice } from '../../helpers/obsidian-mock';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';

/** The project every detail-state case is mounted for. */
const PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Hallway', status: 'IDEA' };

/** A read that was really attempted and really failed — never `ok(null)`, which means "gone". */
const READ_FAILED: RepositoryError = {
	category: 'Persistence',
	code: 'project.read-failed',
	message: 'io',
};

/**
 * `CreatePlanCommand` answers a `Loaded<Plan>`, and `EntityVersion` is a PAIR — a bare `1`
 * does not satisfy it. Nothing in this task reads either field; the value exists so the fake's
 * answer is the shape the real command's is.
 */
const VERSION = { revision: 1, observed: 'observed-1' as ObservationToken };

// The notice queue writes through Obsidian's own `createDiv`/`createSpan` globals, which jsdom
// has none of, and it is inert until something activates it — exactly as in production.
installObsidianDom();

interface Overrides {
	projectId: string | null;
	/** The LIST's rows, for the cases mounted with `projectId: null`. */
	projects?: readonly ProjectSummaryDto[];
	/** A fixed plan list. Use `plansRef` where a case CREATES a plan and re-reads. */
	plans?: readonly PlanSummaryDto[];
	/**
	 * A LIVE array the case also holds, so a `createPlan` that pushes into it is visible to the
	 * next `listPlansByProject`. `plans` cannot do that job — it is read once into a literal —
	 * and the creation case is exactly the one that needs the read to move.
	 */
	plansRef?: PlanSummaryDto[];
	/** For a case that has to COUNT the reads rather than look at what they drew. */
	listPlansByProject?: RenovationProjectQueryServices['listPlansByProject'];
	navigate?: (projectId: string | null) => void;
	openProject?: (projectId: string) => Promise<ProjectOpenOutcome>;
	openPlan?: (planId: string) => Promise<void>;
	/**
	 * Wired into `commands`, NOT `queries` — it is a write, and `ViewRoot` dispatches it through
	 * `useFormCommit`. Typed as the bundle's own method rather than restated: the alias behind it
	 * is not exported, is already a `Result`, and a hand-written signature beside it is one more
	 * thing to drift.
	 */
	createPlan?: RenovationProjectCommandServices['createPlan']['execute'];
	getProject?: RenovationProjectQueryServices['getProject'];
	indexScanCompleted?: () => boolean;
	onProjectsChanged?: (listener: () => void) => () => void;
	onPlansChanged?: (projectId: string, listener: () => void) => () => void;
}

/**
 * A `RenovationProjectDeps` for one case, over `defaultRenovationProjectDeps()` rather than a
 * hand-built literal — that factory is the one place this repository states what an honest
 * default for each member is, so a member added to the interface reaches every case here on the
 * day it is written rather than arriving as an `undefined` nothing reports. Each case overrides
 * only what it is about, and every override declared here is CONSUMED: a key that type-checked
 * but reached nothing would leave its case quietly exercising the default.
 */
function mountRoot(over: Overrides): VueWrapper {
	const base = defaultRenovationProjectDeps();
	const context: RenovationProjectDeps = {
		...base,
		projectId: over.projectId,
		navigate: over.navigate ?? base.navigate,
		openProject: over.openProject ?? base.openProject,
		openPlan: over.openPlan ?? base.openPlan,
		indexScanCompleted: over.indexScanCompleted ?? base.indexScanCompleted,
		onProjectsChanged: over.onProjectsChanged ?? base.onProjectsChanged,
		onPlansChanged: over.onPlansChanged ?? base.onPlansChanged,
		commands: {
			...base.commands,
			createPlan:
				over.createPlan === undefined
					? base.commands.createPlan
					: { execute: over.createPlan },
		},
		queries: {
			...base.queries,
			listProjects: () => Promise.resolve(ok({ projects: over.projects ?? [], unreadable: 0 })),
			getProject: over.getProject ?? (() => Promise.resolve(ok(PROJECT))),
			// A COPY per call, never the caller's own array. `createRenovationProjectQueries`
			// maps its entities into a fresh array on every read, and the identity is the whole
			// point here rather than a detail: a ref assigned the array it already holds does not
			// re-render, so a fake handing back one live array would make the creation case fail
			// against a CORRECT build — measured, not reasoned, by running it both ways.
			listPlansByProject:
				over.listPlansByProject ??
				(() => Promise.resolve(ok([...(over.plansRef ?? over.plans ?? [])]))),
		},
	};
	setActivePinia(createPinia());
	return mount(ViewRoot, {
		global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
}

/**
 * Opens the New plan form through WHICHEVER `New plan` control this state actually renders and
 * submits it. `ProjectDetail` draws the empty state in place of `PlanList` for a project with no
 * plans, so a case that starts empty has `.rp-empty-state__action` and no `.rp-plan-list__create`
 * — and `wrapper.get()` on the missing one THROWS before the case reaches its assertion.
 * Hard-coding either would be wrong for half the cases this file should be able to express, and
 * both controls emit one `createPlan` intent, so this is one gesture with two entry points rather
 * than a distinction being papered over.
 */
async function openTheFormAndSubmit(wrapper: VueWrapper, name = 'Ground floor'): Promise<void> {
	const create = wrapper.find('.rp-plan-list__create');
	await (create.exists() ? create : wrapper.get('.rp-empty-state__action')).trigger('click');
	await flushPromises();
	await wrapper.get('input[data-field="name"]').setValue(name);
	await wrapper.get('form').trigger('submit');
	await flushPromises();
}

describe('ViewRoot in the detail state', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		Notice.shown.length = 0;
		activateNotices();
	});

	it('draws the project it was mounted for, never the list', async () => {
		const wrapper = mountRoot({ projectId: 'project-1' });
		await flushPromises();

		expect(wrapper.find('.rp-project-detail').exists()).toBe(true);
		expect(wrapper.find('.rp-project-list').exists()).toBe(false);
	});

	/**
	 * **Criterion 1, and the case an earlier draft of this plan had no route for.** The list
	 * row NAVIGATES; it does not open `Project.md`. Both halves asserted, because "navigate
	 * was called" is equally true of a build that also still opens the note.
	 */
	it('navigates into a project from a list row rather than opening its note', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const openProject = vi.fn<(id: string) => Promise<ProjectOpenOutcome>>(() =>
			Promise.resolve('opened'),
		);
		const wrapper = mountRoot({
			projectId: null,
			navigate,
			openProject,
			projects: [{ id: 'project-1', name: 'Hallway', status: 'IDEA' }],
		});
		await flushPromises();

		await wrapper.get('.rp-project-list__row').trigger('click');

		expect(navigate).toHaveBeenCalledWith('project-1');
		expect(openProject).not.toHaveBeenCalled();
	});

	/**
	 * Criterion 5 and criterion 11 on the most common detail state there is — a project just
	 * created, with no plans. The empty state goes inside the plans region, never in place of
	 * the header that holds the only way back.
	 */
	it('keeps the way back and the note action on a project with no plans', async () => {
		const wrapper = mountRoot({ projectId: 'project-1', plans: [] });
		await flushPromises();

		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
		expect(wrapper.find('.rp-project-detail__back').exists()).toBe(true);
		expect(wrapper.find('.rp-project-detail__open-note').exists()).toBe(true);
	});

	/** Criterion 2's presentation half; the `revealPlanEditor` half is Task 5's wiring case. */
	it('opens a plan row through context.openPlan', async () => {
		const openPlan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const wrapper = mountRoot({
			projectId: 'project-1',
			openPlan,
			plans: [{ id: 'plan-1', name: 'Ground floor' }],
		});
		await flushPromises();

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(openPlan).toHaveBeenCalledWith('plan-1');
	});

	it('navigates back to the list with null', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const wrapper = mountRoot({ projectId: 'project-1', navigate });
		await flushPromises();

		await wrapper.get('.rp-project-detail__back').trigger('click');

		expect(navigate).toHaveBeenCalledWith(null);
	});

	it('opens the project’s own note from the header', async () => {
		const openProject = vi.fn<(id: string) => Promise<ProjectOpenOutcome>>(() =>
			Promise.resolve('opened'),
		);
		const wrapper = mountRoot({ projectId: 'project-1', openProject });
		await flushPromises();

		await wrapper.get('.rp-project-detail__open-note').trigger('click');

		expect(openProject).toHaveBeenCalledWith('project-1');
	});

	/**
	 * Criterion 3, asserted on the RENDERED ROWS and not on "hydrate was called" — the latter
	 * is equally true of a build whose subscription hears nothing and whose create happens to
	 * re-read.
	 */
	it('shows a created plan in the rows without reopening the pane', async () => {
		const plans: PlanSummaryDto[] = [];
		const wrapper = mountRoot({
			projectId: 'project-1',
			plansRef: plans,
			createPlan: (input) => {
				plans.push({ id: 'plan-9', name: input.name });
				return Promise.resolve(
					ok({ plan: { entity: makePlan({ projectId: PROJECT.id as ProjectId }), version: VERSION } }),
				);
			},
		});
		await flushPromises();

		await openTheFormAndSubmit(wrapper, 'Ground floor');

		expect(wrapper.findAll('.rp-plan-list__row').map((row) => row.text())).toEqual(['Ground floor']);
	});

	/**
	 * The other entry point to the same gesture, and the reason the helper picks the control
	 * that exists rather than naming one: a project that ALREADY has plans draws `PlanList`'s
	 * own header button and no empty state at all.
	 */
	it('creates a second plan from the plan list’s own header button', async () => {
		const plans: PlanSummaryDto[] = [{ id: 'plan-1', name: 'Ground floor' }];
		const wrapper = mountRoot({
			projectId: 'project-1',
			plansRef: plans,
			createPlan: (input) => {
				plans.push({ id: 'plan-2', name: input.name });
				return Promise.resolve(
					ok({ plan: { entity: makePlan({ projectId: PROJECT.id as ProjectId }), version: VERSION } }),
				);
			},
		});
		await flushPromises();
		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);

		await openTheFormAndSubmit(wrapper, 'First floor');

		expect(wrapper.findAll('.rp-plan-list__row').map((row) => row.text())).toEqual([
			'Ground floor',
			'First floor',
		]);
	});

	/**
	 * Criterion 4's one refusal that cannot be a banner. BOTH halves in one case, deliberately:
	 * "it navigated" is equally true of the build that tells the user nothing, and "a notice
	 * appeared" is equally true of the build that strands them in a dead detail state.
	 */
	it('returns to the list AND notifies when the project vanished while the form was open', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate,
			createPlan: () =>
				Promise.resolve(err({ category: 'Reference', code: 'plan.project-not-found', message: 'x' })),
		});
		await flushPromises();

		await openTheFormAndSubmit(wrapper, 'Ground floor');

		expect(navigate).toHaveBeenCalledWith(null);
		expect(Notice.shown).toHaveLength(1);
	});

	/**
	 * The same refusal, asked about the pane rather than about the call — and it is the FAILURE
	 * path of the case above rather than a second view of its happy one.
	 *
	 * `navigate` is a spy here exactly as it is there, which means no remount ever happens: in
	 * production that is what a `setViewState` fault looks like, `navigateToProject` having
	 * reported the cause and resolved without moving the leaf. The case above asserts the call
	 * and the notice and stops, so it passed while the pane behind the dialog still drew the
	 * project the command had just refused to write to — and cancelling the form returned the
	 * user to that stale `'ready'` state, with the `'gone'` screen this slice built for exactly
	 * this situation unreachable.
	 *
	 * Watched red against the build that navigated straight out of `onProjectGone`: it draws
	 * `.rp-project-detail__name` there, because nothing ever moved the status off `'ready'`.
	 * `getProject` is deliberately left answering the project SUCCESSFULLY, which is the whole
	 * discriminator — a fix that re-read instead of settling the status would be handed
	 * `'ready'` by a stale index and pass the notice-and-call case while failing this one.
	 * Reported by a review bot.
	 */
	it('shows the gone screen when the redirect does not remount the leaf', async () => {
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate: vi.fn<(projectId: string | null) => void>(),
			createPlan: () =>
				Promise.resolve(err({ category: 'Reference', code: 'plan.project-not-found', message: 'x' })),
		});
		await flushPromises();

		await openTheFormAndSubmit(wrapper, 'Ground floor');

		expect(wrapper.find('.rp-project-detail__name').exists()).toBe(false);
		expect(wrapper.get('.rp-empty-state__headline').text()).toBe(t('en', 'view.project.gone'));
	});

	/**
	 * A failed read STAYS on the detail and shows the mapped sentence — it does not navigate.
	 * Navigating on a failure would tell a user their project was deleted because their vault
	 * hiccuped.
	 */
	it('shows the mapped failure sentence and stays put when a read refuses', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate,
			getProject: () => Promise.resolve(err(READ_FAILED)),
		});
		await flushPromises();

		// `project.read-failed` has no locale entry of its own, so `trError` falls back to the
		// error's CATEGORY — `Persistence`. Asserting the category sentence rather than
		// `toUserMessage('en', READ_FAILED)` pins which sentence the user sees; deriving it
		// from the same mapper the component uses would pass for any mapping at all.
		expect(wrapper.get('.rp-view-message').text()).toBe(t('en', 'error.category.persistence'));
		expect(navigate).not.toHaveBeenCalled();
	});

	/**
	 * The Open note action racing a deletion. Asserted on the NAVIGATION rather than on
	 * "hydrate was called", because refreshing the list store from the detail state is
	 * equally true of the build that leaves the user on a stale screen — which is what an
	 * earlier draft of this plan specified. Reported by a review bot.
	 */
	it('returns to the list when the header’s note turns out to be gone', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		let exists = true;
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate,
			openProject: () => {
				exists = false;
				return Promise.resolve('missing');
			},
			getProject: () => Promise.resolve(ok(exists ? PROJECT : null)),
		});
		await flushPromises();

		await wrapper.get('.rp-project-detail__open-note').trigger('click');
		await flushPromises();

		expect(navigate).toHaveBeenCalledWith(null);
	});

	/** Criterion 6's other arm: the project really is gone, so return to the list. */
	it('navigates back to the list when the project is gone and the scan has run', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		mountRoot({ projectId: 'project-1', navigate, getProject: () => Promise.resolve(ok(null)) });
		await flushPromises();

		expect(navigate).toHaveBeenCalledWith(null);
	});

	/**
	 * **The screen a `'gone'` project draws when the navigation above does not happen.**
	 * `navigateToProject` does not reject by contract, so a rejected `setViewState` reports its
	 * fault and resolves — the watcher's `navigate(null)` silently does nothing and the store
	 * stays `'gone'`. Before this branch existed the pane then rendered the LOADING line: a
	 * false sentence, with no Back and no retry, recoverable only by closing the leaf.
	 *
	 * Driven with a `navigate` that does nothing, which is exactly what a failed navigation
	 * looks like from here — the store cannot tell a refused write from one that never
	 * happened, and that is the whole reason the fallback has to be honest rather than
	 * transient. Reported by a review bot.
	 */
	it('draws an actionable gone state when the navigation does not take', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const wrapper = mountRoot({ projectId: 'project-1', navigate, getProject: () => Promise.resolve(ok(null)) });
		await flushPromises();

		// The lie the old build told, asserted as ABSENT: a green here is what the loading line
		// used to satisfy.
		expect(wrapper.find('.rp-view-message').exists()).toBe(false);
		expect(wrapper.get('.rp-empty-state__headline').text()).toBe(t('en', 'view.project.gone'));
		// `<h2>`, not `<h3>`: this state REPLACES the view, so there is no project heading above
		// it for a subsection to belong to. The no-plans state is the embedded case and takes
		// `3`. Asserted because the tag is the whole content of that distinction and nothing
		// else here would notice it flipping — the first version of this screen passed `3`.
		expect(wrapper.get('.rp-empty-state__headline').element.tagName).toBe('H2');

		await wrapper.get('.rp-empty-state__action').trigger('click');

		// Twice: once from the watcher, once from the button the user had to be given.
		expect(navigate).toHaveBeenNthCalledWith(2, null);
	});

	it('holds the loading line rather than navigating before the scan has run', async () => {
		const navigate = vi.fn<(projectId: string | null) => void>();
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate,
			indexScanCompleted: () => false,
			getProject: () => Promise.resolve(ok(null)),
		});
		await flushPromises();

		expect(navigate).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-view-message').text()).toBe(t('en', 'view.project.loading'));
	});

	/**
	 * The subscription doing its job, which is a different claim from it being disposed: a plan
	 * created in another leaf, arriving through a sync, or written into the vault by hand
	 * reaches this pane through `onPlansChanged` and through nothing else — the mount read has
	 * already happened and no other caller of `hydrate` is reachable from a change somebody else
	 * made. Asserted on the ROW, because "hydrate was called" is equally true of a build whose
	 * re-read answers the same list it already had.
	 *
	 * The subscribed id is asserted beside it: an unfiltered subscription would re-read this
	 * project for every plan note in the vault, which `projectPlansChangeSource` exists to
	 * prevent.
	 */
	it('redraws its plans when a plan of this project changes elsewhere', async () => {
		const plans: PlanSummaryDto[] = [];
		const listeners: (() => void)[] = [];
		let subscribedTo: string | null = null;
		const wrapper = mountRoot({
			projectId: 'project-1',
			plansRef: plans,
			onPlansChanged: (projectId, listener) => {
				subscribedTo = projectId;
				listeners.push(listener);
				return () => undefined;
			},
		});
		await flushPromises();
		expect(wrapper.findAll('.rp-plan-list__row')).toHaveLength(0);

		plans.push({ id: 'plan-1', name: 'Ground floor' });
		for (const listener of listeners) listener();
		await flushPromises();

		expect(subscribedTo).toBe('project-1');
		expect(wrapper.findAll('.rp-plan-list__row').map((row) => row.text())).toEqual(['Ground floor']);
	});

	/**
	 * The restored-leaf race, in the detail state. Obsidian restores its leaves BEFORE
	 * `onLayoutReady` and the index scan runs FROM it, so a pane reopened with the app asks an
	 * EMPTY index about its project and is answered a legitimate `ok(null)` — which is why the
	 * store refuses to call that `'gone'` until the scan has run, and why this pane would sit on
	 * its loading line forever without hearing the rebuild.
	 */
	it('draws the project once the index is rebuilt under a restored leaf', async () => {
		let scanned = false;
		let found: ProjectSummaryDto | null = null;
		const listeners: (() => void)[] = [];
		const navigate = vi.fn<(projectId: string | null) => void>();
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate,
			indexScanCompleted: () => scanned,
			getProject: () => Promise.resolve(ok(found)),
			onProjectsChanged: (listener) => {
				listeners.push(listener);
				return () => undefined;
			},
		});
		await flushPromises();
		expect(wrapper.find('.rp-project-detail').exists()).toBe(false);
		expect(navigate).not.toHaveBeenCalled();

		scanned = true;
		found = PROJECT;
		for (const listener of listeners) listener();
		await flushPromises();

		expect(wrapper.find('.rp-project-detail').exists()).toBe(true);
	});

	it('disposes its onPlansChanged subscription on unmount', async () => {
		const dispose = vi.fn<() => void>();
		const wrapper = mountRoot({ projectId: 'project-1', onPlansChanged: () => dispose });
		await flushPromises();

		wrapper.unmount();

		expect(dispose).toHaveBeenCalledTimes(1);
	});

	/**
	 * `openDialog` THROWS `DialogStackingError` while a dialog is already open, so the guard has
	 * to stop the SECOND call from being made rather than trust that nobody double-clicks. The
	 * spy is what discriminates: without the guard the store is asked twice and the second ask
	 * rejects, while the rendered form count is 1 either way.
	 */
	it('does not open a second New plan dialog on a double press', async () => {
		const wrapper = mountRoot({ projectId: 'project-1' });
		await flushPromises();
		// `mountRoot` has already made this mount's Pinia the active one, so `useDialogStore()`
		// here is the very store `ViewRoot` is holding.
		const openDialog = vi.spyOn(useDialogStore(), 'openDialog');

		const action = wrapper.get('.rp-empty-state__action');
		await Promise.all([action.trigger('click'), action.trigger('click')]);
		await flushPromises();

		expect(openDialog).toHaveBeenCalledTimes(1);
	});

	/**
	 * `onCreatePlan`'s `if (result === 'cancel') return;`. A Cancel dispatched nothing, so a
	 * re-read would answer a question nobody asked — and the read COUNT is the only instrument
	 * that can see the difference, since the rows are the same either way.
	 */
	it('does not re-read the plans when the dialog is cancelled', async () => {
		const listPlansByProject = vi.fn<RenovationProjectQueryServices['listPlansByProject']>(() =>
			Promise.resolve(ok([])),
		);
		const wrapper = mountRoot({ projectId: 'project-1', listPlansByProject });
		await flushPromises();
		expect(listPlansByProject).toHaveBeenCalledTimes(1);

		await wrapper.get('.rp-empty-state__action').trigger('click');
		await flushPromises();
		await wrapper.get('[data-rp-action="cancel"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('.rp-dialog').exists()).toBe(false);
		expect(listPlansByProject).toHaveBeenCalledTimes(1);
	});
});
