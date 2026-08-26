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
import { t } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { makeView } from '../../helpers/makeRenovationProjectView';
import { useRenovationProjectStore } from '../../../src/presentation/stores/RenovationProjectStore';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';

const PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning' };

const answering = (projects: readonly ProjectSummaryDto[]): RenovationProjectQueryServices => ({
	listProjects: () => Promise.resolve(ok(projects)),
});

const refusing = (): RenovationProjectQueryServices => ({
	listProjects: () =>
		Promise.resolve(err({ category: 'Persistence', code: 'settings.unrecovered', message: 'no' })),
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
	const view = makeView({ queries });
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
	 * Amendment 1: no button, because the hand-off is slice 16's project-creation form and
	 * slice 16 depends on slice 11. A rendered control that does nothing is worse than no
	 * control, and this is what stops one appearing by accident.
	 */
	it('renders no action button, since there is no hand-off yet', async () => {
		const view = await open(answering([]));

		expect(view.contentEl.querySelector('.rp-empty-state button')).toBeNull();
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
});
