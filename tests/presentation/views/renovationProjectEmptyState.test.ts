/**
 * @vitest-environment jsdom
 *
 * The Renovation Project view's first content (design slice 14, DoD 4).
 *
 * Until this slice the view mounted an empty Vue app and drew nothing, which was slice 1's
 * success criterion and is no longer anybody's. Mounted through `makeView`, the ONE
 * construction site both this suite and the browser harness go through — so a grown
 * constructor requirement meets both at once instead of stranding the harness page.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import type { Result } from '../../../src/core/result/Result';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import { t } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { defaultRenovationProjectDeps, makeView } from '../../helpers/makeRenovationProjectView';
import { useRenovationProjectStore } from '../../../src/presentation/stores/RenovationProjectStore';
import { unavailableRenovationProjectCommands } from '../../../src/presentation/views/renovationProjectCommands';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';

/**
 * Every case here is about the read side's empty/loading/failed states, never about the
 * write side — so `commands` is the refusal bundle, spelled out because `makeView`'s own
 * default ANSWERS through a real `CreateProjectCommand` and no case here dispatches.
 * Everything else this file has no opinion about is spread from the factory's defaults, so
 * a member `RenovationProjectDeps` grows next is decided once there rather than guessed here
 * — which is exactly what did NOT happen when design slice 21 grew it by five.
 *
 * `openProject` and `onProjectsChanged` are the factory's own no-ops (no index rebuild is
 * published here; `viewRootIndexRebuild.test.ts` is what drives one).
 */
const commands = unavailableRenovationProjectCommands();

/**
 * Design slice 21's two detail-state doors, answering emptily. Every case in this file draws
 * the LIST (`projectId` is the factory's `null`), so neither is reached — and they ANSWER
 * rather than refuse for CLAUDE.md's fifth fake-instance reason: `refusing()` below models a
 * session whose reads are genuinely unavailable, and using that same shape where the read
 * side works would be a fake harsher than the real thing.
 */
const detailDoors = {
	getProject: () => Promise.resolve(ok(null)),
	listPlansByProject: () => Promise.resolve(ok([])),
} satisfies Pick<RenovationProjectQueryServices, 'getProject' | 'listPlansByProject'>;

const PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning' };

const answering = (
	projects: readonly ProjectSummaryDto[],
	unreadable = 0,
): RenovationProjectQueryServices => ({
	listProjects: () => Promise.resolve(ok({ projects, unreadable })),
	...detailDoors,
});

/**
 * A session with unrecovered settings, and ALL THREE doors refuse — which is what production
 * does (`unavailableRenovationProjectQueries` builds every member out of one `refuseUnrecovered`).
 * A bundle whose `listProjects` refused while `getProject` answered would be the mirror of
 * the fifth fake-instance lesson: kinder than the real thing, in the one session where there
 * is genuinely nothing to read.
 */
const refuseUnrecovered = (): Promise<Result<never, RepositoryError>> =>
	Promise.resolve(err({ category: 'Persistence', code: 'settings.unrecovered', message: 'no' }));

const refusing = (): RenovationProjectQueryServices => ({
	listProjects: refuseUnrecovered,
	getProject: refuseUnrecovered,
	listPlansByProject: refuseUnrecovered,
});

/** The view hydrates on open; the same settle shape the editor harness uses. */
async function settle(): Promise<void> {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
	await new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

async function open(queries: RenovationProjectQueryServices) {
	installObsidianDom();
	const view = makeView({ ...defaultRenovationProjectDeps(), queries, commands });
	await view.onOpen();
	await settle();
	return view;
}

describe('the renovation project view', () => {
	it('invites the user to create a project when the vault has none', async () => {
		const view = await open(answering([]));

		const empty = view.contentEl.querySelector('.rp-empty-state');
		expect(empty?.querySelector('h2')?.textContent).toBe(
			t('en', 'empty.project.no-projects.headline'),
		);
		await view.onClose();
	});

	/**
	 * Amendment 1 held while `noProjects` had no hand-off. Design slice 16 built one —
	 * `ViewRoot` opens `NewProjectForm` in a `FormDialog` — so this asserts the button now
	 * exists, updated rather than deleted per that amendment's own rule: a button appearing
	 * is meant to be a deliberate, tested change. `tests/presentation/views/viewRootCreateProject.test.ts`
	 * covers what the click actually does; this file's job stays the read side alone.
	 */
	it('renders an action button, now that slice 16 built its hand-off', async () => {
		const view = await open(answering([]));

		const button = view.contentEl.querySelector('.rp-empty-state button');
		expect(button).not.toBeNull();
		expect(button?.textContent).toBe(t('en', 'empty.project.no-projects.action'));
		await view.onClose();
	});

	it('renders no empty state once a project exists', async () => {
		const view = await open(answering([PROJECT]));

		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();
		await view.onClose();
	});

	/**
	 * DoD 6, asserted rather than reviewed. A failed read is not "legitimately nothing yet",
	 * and downgrading it would hide a persistence or settings failure behind copy telling the
	 * user to create something. What it renders INSTEAD is slice 17's; this slice's claim is
	 * only that it is not this.
	 */
	it('renders no empty state for a failed read', async () => {
		const view = await open(refusing());

		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();
		await view.onClose();
	});

	/**
	 * DoD 6's "never reaches the selector" half. The brief's preferred instrument was
	 * `vi.spyOn(selectors, 'selectRenovationProjectEmptyState')`, asserted un-called — but a
	 * spy on a module export does not reliably bind through an SFC's own import binding
	 * (a compiled `<script setup>` closes over the imported identifier directly, not through
	 * a property lookup a spy on the module namespace can intercept), so that instrument was
	 * not taken. This asserts the equivalent claim one layer down, at the STORE the selector
	 * reads: a failed read leaves `status === 'failed'` and `emptyStateKey === null`, which is
	 * exactly what makes the selector unreachable regardless of whether anything calls it —
	 * `emptyStateKey` is COMPUTED from `status`, so a failed status can never resolve to a
	 * key. Weaker than watching the selector itself go uncalled, and said so here rather than
	 * deleting the case.
	 *
	 * Reached through `useRenovationProjectStore()` called bare, outside any component: Pinia
	 * resolves it against whatever pinia instance was last made active, which
	 * `RenovationProjectView.onOpen`'s `app.use(createPinia())` did synchronously for exactly
	 * this view — there is only ever one view open in this test.
	 */
	it('leaves the store in a state the selector cannot answer for a failed read', async () => {
		const view = await open(refusing());

		const store = useRenovationProjectStore();
		expect(store.status).toBe('failed');
		expect(store.emptyStateKey).toBeNull();
		await view.onClose();
	});

	/**
	 * The defect this pass exists to close on this surface. `emptyStateKey` is correctly
	 * `null` for a failed read, and until now that was the view's ONLY conditional — so an
	 * unreadable project note, a vault fault or unrecovered settings drew an empty div: no
	 * message, no notice, and `store.error` read by nobody. `PlanEditorRoot` rendered all
	 * three states in the same slice.
	 *
	 * The copy comes from `trError`, so the sentence is the mapped one for the actual code
	 * (`settings.unrecovered` has its own) rather than a generic second answer.
	 *
	 * **The CONTAINER changed in design slice 17 and the claim did not.** That message used to
	 * share `.rp-view-message` with the loading line; it is now the body of a `ViewFailure`,
	 * which is a different region from the loading one and can carry an action. What this case
	 * asserts — that the mapped sentence for THIS code reaches the user — is untouched, and
	 * `viewRootFailure.test.ts` is where the new state's own behaviour is pinned.
	 */
	it('renders the mapped failure message for a failed read', async () => {
		const view = await open(refusing());

		const message = view.contentEl.querySelector('.rp-view-failure__body');
		expect(message?.textContent?.trim()).toBe(t('en', 'settings.unrecovered'));
		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();
		await view.onClose();
	});

	/**
	 * A vault holding projects that cannot be read is the third state, and the one a
	 * one-conditional view could not express at all: it is neither `ready`-with-projects nor
	 * "nothing here yet". Onboarding copy would be wrong and unactionable here.
	 *
	 * The last two assertions are what this case was MISSING, and CLAUDE.md described the
	 * surface wrongly for a review round because of it: asserting the notice and the absent
	 * empty state says nothing about what fills the region instead, so "the list draws once
	 * the vault holds at least one project" read as true. `ProjectList` is the `v-else` of a
	 * selector that declines on `unreadable > 0` BEFORE it looks at the length, so THIS vault
	 * draws the list with zero rows — which is the right picture (a header and a way to create
	 * one, beside the warning) and not the one the sentence promised.
	 */
	it('warns instead of inviting when every project note refused', async () => {
		const view = await open(answering([], 3));

		const notice = view.contentEl.querySelector('.rp-view-notice');
		expect(notice?.textContent?.trim()).toBe(t('en', 'view.project.some-unreadable'));
		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();
		expect(view.contentEl.querySelector('.rp-project-list__header')).not.toBeNull();
		expect(view.contentEl.querySelectorAll('.rp-project-list__row')).toHaveLength(0);
		await view.onClose();
	});

	it('renders no warning when nothing refused', async () => {
		const view = await open(answering([PROJECT]));

		expect(view.contentEl.querySelector('.rp-view-notice')).toBeNull();
		await view.onClose();
	});

	/**
	 * The loading arm, reached by NOT settling: `open` awaits the hydration, so this case
	 * mounts and asserts before the query resolves. Without a case here the arm is an
	 * untested branch, and at this coverage headroom that fails the gate rather than denting
	 * a number.
	 */
	it('says it is loading before the query resolves', async () => {
		installObsidianDom();
		const view = makeView({
			...defaultRenovationProjectDeps(),
			queries: { listProjects: () => new Promise(() => {}), ...detailDoors },
			commands,
		});
		await view.onOpen();
		await Promise.resolve();

		expect(view.contentEl.querySelector('.rp-view-message')?.textContent?.trim()).toBe(
			t('en', 'view.project.loading'),
		);
		await view.onClose();
	});
});
