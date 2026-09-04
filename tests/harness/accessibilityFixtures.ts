/**
 * The fixtures `accessibility.test.ts` mounts, extracted from it — construction, not scanning.
 *
 * **Why this file exists is a budget, and the budget is the honest reason.**
 * `tests/harness/accessibility.test.ts` sits under a 450-line `max-lines` cap
 * (`eslint.config.mjs`, `skipComments: true`, so those are CODE lines) and the Add Room merge
 * took it to 451: both branches had added scans to the same describe block — `main` the asset
 * library and Home surfaces, this branch the four New Room ones — and the file merged cleanly
 * one line over. That is the same two-branches-one-region arithmetic the smoke-test census and
 * the fixed-shot inventory each hit at this merge, arriving in a lint budget instead of a count.
 *
 * **An extraction rather than a line shaved back**, per this repository's own recorded rule
 * from `runtime.ts`: a budget bought back by reformatting is a budget already spent, and the
 * next scan added would spend it again. The seam is the one the file already had informally —
 * every function here BUILDS something to mount, and every `it` left behind SCANS what is
 * mounted — so no assertion moved and no scan changed. `mountWithDrawRoom` comes too, despite
 * being a mount rather than a deps literal, because "the state this scan needs" is the same
 * job as the three below it and leaving it behind would split the seam for no reason.
 *
 * The alternative was splitting the plan-editor scans into a second test file, which is the
 * larger and probably eventual move; it relocates fourteen assertions and their fixtures, and
 * doing it inside a merge resolution would mix a refactor into a conflict. Recorded here as the
 * next step rather than taken, so whoever meets this cap again has the argument already made.
 */
import { err, ok } from '../../src/core/result/Result';
import type { Result } from '../../src/core/result/Result';
import type { RepositoryError } from '../../src/application/ports/repositoryErrors';
import type { RenovationProjectQueryServices } from '../../src/presentation/read-models/renovationProjectQueries';
import type { RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';
import type { PlanSummaryDto } from '../../src/presentation/read-models/PlanDto';
import type { AssetPriceRowDto } from '../../src/application/queries/ListProjectAssetPrices';
import { createMoney, type Money } from '../../src/core/money/Money';
import { defaultRenovationProjectDeps } from '../helpers/makeRenovationProjectView';
import { mountPlanEditor, runtimeOf, settle, type EditorHarness } from '../helpers/editor';

/**
 * A read side where every door refuses with the same code — which is what production does for
 * a session that has one (`unavailableRenovationProjectQueries` builds all three members out
 * of one `refuseUnrecovered`). The cases that use it grade the FAILURE state, so refusing is
 * the honest stand-in rather than the fake-harsher-than-the-real-thing CLAUDE.md's fifth
 * instance names: there is no production answer being hidden. Design slice 21's two detail
 * doors refuse beside `listProjects` rather than answering, because a bundle that half-refused
 * would model no session this plugin can be in.
 */
export const refusingWith = (code: string): RenovationProjectQueryServices => {
	const refuse = (): Promise<Result<never, RepositoryError>> =>
		Promise.resolve(err({ category: 'Persistence', code, message: 'refused' }));
	return { listProjects: refuse, getProject: refuse, listPlansByProject: refuse, listAssetPrices: refuse };
};

/**
 * A view whose DETAIL state has something to draw.
 *
 * Over `defaultRenovationProjectDeps()` rather than a hand-built literal, for that factory's
 * own stated reason: it is the one place an honest default per member is written down, so a
 * widened `RenovationProjectDeps` meets this file at the same moment it meets every other
 * consumer — which is exactly what stranded the caller's own four-member literal when design
 * slice 21's Task 5 grew the interface by five members.
 *
 * **It sets no `projectId`, and that is a measurement rather than an omission.**
 * `RenovationProjectView.mount` provides `{ ...this.deps, projectId }` with the VIEW's own
 * field last, so `deps.projectId` is written over on every mount and a value set here would be
 * inert — measured directly: a view built with `projectId: 'project-1'` in its bundle and no
 * `setState` draws the LIST. `setState` is what puts the view in the detail state, so that is
 * what the cases drive, and a member that looked load-bearing here would send the next reader
 * to the wrong line when one of them fails.
 */
export function detailDeps(over: {
	projectId: string;
	plans: readonly PlanSummaryDto[];
	/**
	 * The price section's rows. `undefined` leaves the factory's own answer — an empty catalogue,
	 * which draws the section's empty state — and the price-section case supplies real rows,
	 * because a scan of an empty state grades none of the controls the section exists for.
	 */
	prices?: readonly AssetPriceRowDto[];
}): RenovationProjectDeps {
	const base = defaultRenovationProjectDeps();
	return {
		...base,
		queries: {
			...base.queries,
			getProject: () =>
				Promise.resolve(
					ok({ id: over.projectId, name: 'Hallway', status: 'IDEA', currency: 'EUR', libraryOverlap: false, planCount: 0, lastWorked: null }),
				),
			listPlansByProject: () => Promise.resolve(ok({ plans: over.plans, unreadable: 0 })),
			listAssetPrices:
				over.prices === undefined ? base.queries.listAssetPrices : () => Promise.resolve(ok([...over.prices ?? []])),
		},
	};
}

/** A fixture amount, through the constructor the price row itself mints with. */
export function price(amount: string): Money {
	const minted = createMoney(amount, 'EUR');
	if (!minted.ok) throw new Error('unmintable fixture');
	return minted.value;
}

/** A mounted Plan Editor with `draw-room` already active, for Task 13's four scans. */
export async function mountWithDrawRoom(): Promise<EditorHarness> {
	const mounted = await mountPlanEditor();
	runtimeOf(mounted).setTool('draw-room');
	await settle();
	return mounted;
}
