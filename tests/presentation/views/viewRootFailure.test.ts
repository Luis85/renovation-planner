/**
 * @vitest-environment jsdom
 *
 * Design slice 17's in-place view failure, in the Renovation Project view — one of the two
 * cases slice 14 explicitly deferred to that slice ("a view whose hydrating query resolved
 * `isErr`").
 *
 * The two arms this file exists to keep apart are the RETRY and its absence. Both draw the
 * same component with the same mapped body, and they differ on one thing that matters: a
 * query that really tried and failed can be re-run, and a session that composed no query
 * services at all cannot. A single case would pass against a build that offered a retry to
 * both, which is a live control that does nothing — the exact failure slice 14's own amendment
 * refuses.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { installObsidianDom } from '../../helpers/dom';
import { makeView } from '../../helpers/makeRenovationProjectView';
import { unavailableRenovationProjectCommands } from '../../../src/presentation/views/renovationProjectCommands';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';

const commands = unavailableRenovationProjectCommands();
const openProject = (): Promise<'opened'> => Promise.resolve('opened');
const onProjectsChanged = (): (() => void) => () => undefined;

/** A session that never composed a query service: slice 1's unrecovered-settings bundle. */
const bootstrapFailure = (): RenovationProjectQueryServices => ({
	listProjects: () =>
		Promise.resolve(
			err({ category: 'Persistence', code: 'settings.unrecovered', message: 'no settings' }),
		),
});

/** A read that was really attempted and really failed — the retryable case. */
const vaultFailure = (): RenovationProjectQueryServices => ({
	listProjects: () =>
		Promise.resolve(
			err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' }),
		),
});

async function settle(): Promise<void> {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
	await new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

async function open(queries: RenovationProjectQueryServices) {
	installObsidianDom();
	const view = makeView({ queries, commands, openProject, onProjectsChanged });
	await view.onOpen();
	await settle();
	return view;
}

describe('the Renovation Project view, when its hydrating query refused', () => {
	it('draws a failure state rather than the loading line it used to share a region with', async () => {
		const view = await open(vaultFailure());

		expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();
		// The loading line is a different claim — "this is being read" — and drawing it beside a
		// failure, or instead of one, is what sharing the region risked.
		expect(view.contentEl.querySelector('.rp-view-message')).toBeNull();
		// And never the onboarding copy: that is slice 14's deferral, in one assertion.
		expect(view.contentEl.querySelector('.rp-empty-state')).toBeNull();

		await view.onClose();
	});

	it('shows the MAPPED sentence for the failing code, not one generic line', async () => {
		// Two different codes must produce two different bodies. Asserting one string would pass
		// against a build that had gone back to a fixed sentence, which is the defect the Plan
		// Editor still carried until this slice.
		const vault = await open(vaultFailure());
		const vaultBody = vault.contentEl.querySelector('.rp-view-failure__body')?.textContent;
		await vault.onClose();

		const bootstrap = await open(bootstrapFailure());
		const bootstrapBody =
			bootstrap.contentEl.querySelector('.rp-view-failure__body')?.textContent;
		await bootstrap.onClose();

		expect(vaultBody).not.toBe(bootstrapBody);
	});

	it('offers a retry for a read that really failed', async () => {
		const view = await open(vaultFailure());

		const action = view.contentEl.querySelector<HTMLButtonElement>('.rp-view-failure__action');
		expect(action).not.toBeNull();
		expect(action?.textContent?.trim()).toBe(t('en', 'view.failure.retry'));

		await view.onClose();
	});

	it('re-runs the hydrating query when that retry is pressed', async () => {
		let calls = 0;
		const counting: RenovationProjectQueryServices = {
			listProjects: () => {
				calls += 1;
				return Promise.resolve(
					err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' }),
				);
			},
		};
		const view = await open(counting);
		expect(calls).toBe(1);

		view.contentEl.querySelector<HTMLButtonElement>('.rp-view-failure__action')?.click();
		await settle();

		// The point of the button, and the half a rendered-but-inert control would fail.
		expect(calls).toBe(2);

		await view.onClose();
	});

	it('leaves the failure behind once a retry succeeds', async () => {
		let attempt = 0;
		const recovering: RenovationProjectQueryServices = {
			listProjects: () => {
				attempt += 1;
				return attempt === 1
					? Promise.resolve(
							err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' }),
						)
					: Promise.resolve(ok({ projects: [], unreadable: 0 }));
			},
		};
		const view = await open(recovering);
		expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();

		view.contentEl.querySelector<HTMLButtonElement>('.rp-view-failure__action')?.click();
		await settle();

		// A retry that offers no way back out of the failure state is not a retry.
		expect(view.contentEl.querySelector('.rp-view-failure')).toBeNull();
		expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();

		await view.onClose();
	});

	it('withholds the retry when the session composed nothing to re-run', async () => {
		// The narrowing, and the reason `viewHydrationOrigin` exists. Slice 1 settled the
		// recovery for this case — fix `data.json` and reload — and refused a repair UI; a
		// button here would re-run a query that was never wired, which is the "live control that
		// does nothing" slice 14's amendment refuses.
		const view = await open(bootstrapFailure());

		expect(view.contentEl.querySelector('.rp-view-failure')).not.toBeNull();
		expect(view.contentEl.querySelector('.rp-view-failure__action')).toBeNull();

		await view.onClose();
	});

	it('says it could not START, rather than that the projects could not be read', async () => {
		// The headline is the other half of the same distinction: nothing failed to read here,
		// because nothing was built to read.
		const view = await open(bootstrapFailure());

		expect(view.contentEl.querySelector('.rp-view-failure__headline')?.textContent?.trim()).toBe(
			t('en', 'view.session-failure.headline'),
		);

		await view.onClose();
	});
});
