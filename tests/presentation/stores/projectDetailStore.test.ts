/**
 * `ProjectDetailStore` in isolation (design slice 21).
 *
 * Node, not jsdom — the same reasoning `renovationProjectStore.test.ts` gives: a store is
 * plain reactive state, and needing a DOM to test one would mean the persistent/ephemeral
 * split had leaked into a component.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { watch } from 'vue';
import { err, ok } from '../../../src/core/result/Result';
import { useProjectDetailStore } from '../../../src/presentation/stores/ProjectDetailStore';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';
import type { AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';

// `libraryOverlap` is slice 19's §83 marker, required on the DTO and `false` here because
// these cases are about the DETAIL state, which draws no marker — stated rather than omitted,
// so a fixture never carries a value nothing chose.
const PROJECT: ProjectSummaryDto = { id: 'project-01JAAA', name: 'Hallway', status: 'IDEA', currency: 'EUR', libraryOverlap: false, planCount: 0, lastWorked: null };
const READ_FAILED = { category: 'Persistence', code: 'project.read-failed', message: 'boom' } as const;

/**
 * One price row, ANNOTATED as the DTO the query answers so a member it grows is a compile error
 * here rather than an `undefined` nothing reports. The section itself is driven in
 * `assetPriceList.test.ts`; these cases are about the store's own ticket and its own failure
 * arm, so one row is enough and its content is not asserted beyond identity.
 */
const ROWS: AssetPriceRowDto[] = [
	{
		assetId: 'a1',
		assetName: 'Oak flooring',
		catalogue: null,
		override: null,
		overrideId: null,
		overrideVersion: null,
		assetStatus: 'known',
	},
];

function queriesAnswering(overrides: Partial<RenovationProjectQueryServices>): RenovationProjectQueryServices {
	return {
		listProjects: () => Promise.reject(new Error('not exercised')),
		getProject: () => Promise.resolve(ok(PROJECT)),
		listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
		listAssetPrices: () => Promise.reject(new Error('not exercised')),
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('ProjectDetailStore', () => {
	it('is ready with the project and its plans when both reads answer', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ listPlansByProject: () => Promise.resolve(ok({ plans: [{ id: 'plan-1', name: 'Ground floor' }], unreadable: 0 })) }), PROJECT.id, true);

		expect(store.status).toBe('ready');
		expect(store.project?.name).toBe('Hallway');
		expect(store.plans.map((plan) => plan.name)).toEqual(['Ground floor']);
		// The other arm of `selectProjectDetailEmptyState` — non-empty plans answer `null` —
		// asserted here rather than in a case of its own, since this is the one hydration in
		// the file that is both `'ready'` and holds a plan.
		expect(store.emptyStateKey).toBeNull();
	});

	/**
	 * Zero readable plans with a refusal behind them is NOT an empty state, and this state was
	 * unreachable until the plan listing learned to skip and count: one bad plan note used to
	 * fail the whole read, so the store went to `'failed'` and never got here.
	 *
	 * Both halves are the assertion. `unreadablePlans` alone would pass against a build that
	 * still offered "Create your first plan" beside "1 plan could not be read"; `emptyStateKey`
	 * alone would pass against one that never carried the count this far.
	 */
	it('offers no empty state when every plan note in the project refused', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(
			queriesAnswering({
				listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 1 })),
			}),
			PROJECT.id,
			true,
		);

		expect(store.status).toBe('ready');
		expect(store.unreadablePlans).toBe(1);
		expect(store.emptyStateKey).toBeNull();
	});

	it('still offers the empty state for a project whose plans all read as none', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(
			queriesAnswering({
				listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
			}),
			PROJECT.id,
			true,
		);

		expect(store.emptyStateKey).toBe('noPlans');
	});

	/**
	 * A failed read is NOT a missing project. Navigating away on one would tell a user their
	 * project was deleted because their vault hiccuped — the whole reason
	 * `ProjectStoreStatus` keeps `missing` and `failed` apart, kept here.
	 */
	it('fails rather than going, when a read refuses', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(err(READ_FAILED)) }), PROJECT.id, true);

		expect(store.status).toBe('failed');
		expect(store.error?.code).toBe('project.read-failed');
	});

	/**
	 * No partial state: either both reads answered and the detail draws, or neither did. There
	 * is no honest picture of a project whose identity loaded but whose plans did not.
	 */
	it('draws nothing at all when the plans read refuses and the project read succeeded', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ listPlansByProject: () => Promise.resolve(err(READ_FAILED)) }), PROJECT.id, true);

		expect(store.status).toBe('failed');
		expect(store.project).toBeNull();
		expect(store.plans).toEqual([]);
	});

	/**
	 * **There is exactly ONE case here for the completed scan, and an earlier draft of this
	 * plan had two.** The second was written to discriminate `indexScanCompleted` — "has the
	 * scan RUN" — from the "seen populated" rule it replaced, on the vault whose only project
	 * note was deleted while Obsidian was closed. That distinction is real and it matters (the
	 * wrong rule spins a restored pane for the session), but it **cannot be tested here**: this
	 * store consumes an opaque boolean, so any case passing `true` hits this one branch the one
	 * way, and the two cases were byte-identical bodies under different names. Found in review,
	 * against a docblock claiming "every other case here passes under both rules; this one does
	 * not" — which the store's own code could not make true.
	 *
	 * The discrimination lives where the flag is COMPUTED, not where it is consumed:
	 * `startPersistence` sets it after `index.rebuild(...)` unconditionally, so a completed
	 * EMPTY rebuild sets it exactly like a full one. Task 5 carries that case.
	 */
	it('is gone when the project is missing and the scan has completed', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, true);

		expect(store.status).toBe('gone');
	});

	/**
	 * **The restored-leaf hazard, driven in the order the hazard is about.** Obsidian restores
	 * its leaves BEFORE `onLayoutReady`, and the index scan runs from it — so a detail leaf
	 * restored with the app hydrates against an EMPTY index and `getProject` answers a
	 * perfectly legitimate `ok(null)`. Going there would set `{ projectId: '' }` and destroy
	 * the very view state criterion 8 exists to preserve, which no later read can restore.
	 *
	 * Hydrate FIRST, rebuild AFTER: hydrating a scanned index passes either way.
	 */
	it('holds the loading state on a missing project while the scan has not completed', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, false);

		expect(store.status).toBe('loading');
	});

	it('reaches the project once the scan has run and the re-hydrate arrives', async () => {
		const store = useProjectDetailStore();
		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, false);

		await store.hydrate(queriesAnswering({}), PROJECT.id, true);

		expect(store.status).toBe('ready');
	});

	/**
	 * The ticket. A slower EARLIER read must not land on top of a faster later one — without
	 * it the content silently reverts with no error anywhere. Driven with a deferred first
	 * read so the earlier request genuinely settles last.
	 */
	it('discards a slower earlier read when a later one has already landed', async () => {
		const store = useProjectDetailStore();
		let releaseFirst!: () => void;
		const slow = new Promise<void>((resolve) => { releaseFirst = resolve; });

		const first = store.hydrate(
			queriesAnswering({ getProject: async () => { await slow; return ok({ ...PROJECT, name: 'Stale' }); } }),
			PROJECT.id,
			true,
		);
		await store.hydrate(queriesAnswering({}), PROJECT.id, true);
		releaseFirst();
		await first;

		expect(store.project?.name).toBe('Hallway');
	});

	/**
	 * The re-hydration guard — ONE line, and its absence is a flicker no assertion about final
	 * content can see. `onPlansChanged`'s index arm fires for ANY plan note in the vault, so
	 * without it a background sync flickers the whole detail state through its loading line
	 * while the user is reading it.
	 */
	it('does not flip a ready detail state through its loading line while re-reading', async () => {
		const store = useProjectDetailStore();
		await store.hydrate(queriesAnswering({}), PROJECT.id, true);
		const seen: string[] = [];
		watch(() => store.status, (value) => { seen.push(value); });

		await store.hydrate(queriesAnswering({}), PROJECT.id, true);

		expect(seen).not.toContain('loading');
	});

	/**
	 * The flicker guard's own trade, applied to a MISS rather than to a hit — pinned rather
	 * than left implied by `hydrate`'s docblock. An already-`'ready'` store re-hydrating
	 * against a pre-scan `ok(null)` keeps `'ready'` (the guard above the read never let it
	 * leave) AND keeps its project and plans exactly as they were, rather than adopting the
	 * loading line: the miss is transient and self-corrects on the next authoritative
	 * re-hydrate, and blanking a project that is correctly rendered is the worse of the two
	 * wrong answers. A review bot proposed setting `'loading'` unconditionally here instead;
	 * that was declined, and this case is what makes the decision testable rather than only
	 * argued in a comment.
	 *
	 * All three fields are asserted, and the fixture carries a real plan, not an empty list —
	 * a status-only assertion, or one against no content, would pass equally against a build
	 * that blanked the screen and left `status` behind.
	 */
	it('keeps a ready detail state and its content when a re-hydrate misses before the scan has completed', async () => {
		const store = useProjectDetailStore();
		await store.hydrate(
			queriesAnswering({ listPlansByProject: () => Promise.resolve(ok({ plans: [{ id: 'plan-1', name: 'Ground floor' }], unreadable: 0 })) }),
			PROJECT.id,
			true,
		);
		expect(store.status).toBe('ready');

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, false);

		expect(store.status).toBe('ready');
		expect(store.project?.name).toBe('Hallway');
		expect(store.plans.map((plan) => plan.name)).toEqual(['Ground floor']);
	});

	/**
	 * Structurally gated on `'ready'` — the `RenovationProjectStore.emptyStateKey` shape, not
	 * `ProjectStore`'s stated-exception one — so a failed read can never render as "no plans
	 * yet".
	 */
	it('offers no empty state from any status but ready', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(err(READ_FAILED)) }), PROJECT.id, true);

		expect(store.emptyStateKey).toBeNull();
	});

	it('offers noPlans when a ready project has no plans', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({}), PROJECT.id, true);

		expect(store.emptyStateKey).toBe('noPlans');
	});

	/**
	 * The ticket's second checkpoint. The first hydration's `getProject` resolves
	 * immediately and only its `listPlansByProject` is slow, so a later hydration can finish
	 * entirely — including its own (empty) plans read — before the earlier one's plans read
	 * settles. Without the check after the SECOND await, the stale plans array would still
	 * land on top of the fresher, already-drawn one.
	 *
	 * The extra microtask tick before starting the second hydration is what makes this the
	 * SECOND checkpoint and not the first: it lets the first hydration's own `getProject`
	 * resolve and its `listPlansByProject` call begin — parking it past `CHECK1` — before the
	 * second hydration's ticket increments. Without that tick both `hydrate` calls take their
	 * ticket before either's `getProject` resolves, and the first is superseded at the FIRST
	 * checkpoint instead, leaving this one untested.
	 */
	it('discards a slower earlier read that outlives a later one at the plans read too', async () => {
		const store = useProjectDetailStore();
		let releaseFirst!: () => void;
		const slow = new Promise<void>((resolve) => { releaseFirst = resolve; });

		const first = store.hydrate(
			queriesAnswering({
				listPlansByProject: async () => {
					await slow;
					return ok({ plans: [{ id: 'stale-plan', name: 'Stale' }], unreadable: 0 });
				},
			}),
			PROJECT.id,
			true,
		);
		await Promise.resolve();
		await store.hydrate(queriesAnswering({}), PROJECT.id, true);
		releaseFirst();
		await first;

		expect(store.plans).toEqual([]);
	});

	/**
	 * ADR-005: fully rebuildable, and a reset invalidates whatever hydration is still in
	 * flight — `RenovationProjectStore`'s own case for its ticket, carried here because this
	 * store's ticket is the identical mechanism.
	 */
	it('a reset invalidates a hydration still in flight and returns the store to idle', async () => {
		const store = useProjectDetailStore();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = store.hydrate(
			queriesAnswering({ getProject: () => gate.then(() => ok(PROJECT)) }),
			PROJECT.id,
			true,
		);

		store.reset();
		release();
		await pending;

		expect(store.status).toBe('idle');
		expect(store.project).toBeNull();
		expect(store.plans).toEqual([]);
		expect(store.error).toBeNull();
	});

	/**
	 * The price region's own read and its own TICKET, which is deliberately not the store's.
	 *
	 * Its callers are the mount, a catalogue change and a project-price change, all of which can
	 * be in flight while a `hydrate` is — so sharing `latestHydration` would let a price read
	 * cancel a project read, and each other's, on a question neither is asking.
	 */
	describe('the price region', () => {
		it('holds the rows it read', async () => {
			const store = useProjectDetailStore();

			await store.hydratePrices(
				queriesAnswering({ listAssetPrices: () => Promise.resolve(ok(ROWS)) }),
				PROJECT.id,
			);

			expect(store.assetPrices).toEqual(ROWS);
			expect(store.assetPricesError).toBeNull();
		});

		/**
		 * A failed price read leaves NO stale rows behind — `fail`'s rule, applied to the region
		 * that owns it: a section showing prices beside a message saying they could not be read is
		 * a section disagreeing with itself.
		 *
		 * And it touches NEITHER `status` NOR `error`, which is the half that says why this is a
		 * second read rather than a third arm of `hydrate`: a project whose prices could not be
		 * read is still a project the user can look at and work in.
		 */
		it('clears the rows and records the failure without disturbing the project', async () => {
			const store = useProjectDetailStore();
			await store.hydrate(queriesAnswering({}), PROJECT.id, true);
			await store.hydratePrices(
				queriesAnswering({ listAssetPrices: () => Promise.resolve(ok(ROWS)) }),
				PROJECT.id,
			);

			await store.hydratePrices(
				queriesAnswering({ listAssetPrices: () => Promise.resolve(err(READ_FAILED)) }),
				PROJECT.id,
			);

			expect(store.assetPrices).toEqual([]);
			expect(store.assetPricesError).toEqual(READ_FAILED);
			expect(store.status).toBe('ready');
			expect(store.error).toBeNull();
		});

		/**
		 * The TICKET. A slower EARLIER read must not land on top of a faster later one — a
		 * just-set price vanishing with no error is the failure, and it is the same mechanism
		 * `hydrate` above carries for its own pair.
		 *
		 * Watched failing with the ticket check removed: the first read's rows then arrive last
		 * and the assertion reads the stale pair.
		 */
		it('lets the latest price read win, whichever resolves last', async () => {
			const store = useProjectDetailStore();
			let releaseFirst: (() => void) | undefined;
			const held = new Promise<void>((resolve) => {
				releaseFirst = resolve;
			});

			const slow = store.hydratePrices(
				queriesAnswering({
					listAssetPrices: async () => {
						await held;
						return ok([]);
					},
				}),
				PROJECT.id,
			);
			const fast = store.hydratePrices(
				queriesAnswering({ listAssetPrices: () => Promise.resolve(ok(ROWS)) }),
				PROJECT.id,
			);
			await fast;
			releaseFirst?.();
			await slow;

			expect(store.assetPrices).toEqual(ROWS);
		});

		/**
		 * `markGone` takes the price region's ticket too, so a read still in flight for a project
		 * the command has just declared gone cannot land its rows under the screen that says so.
		 */
		it('drops a price read in flight when the project is marked gone', async () => {
			const store = useProjectDetailStore();
			let release: (() => void) | undefined;
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});

			const reading = store.hydratePrices(
				queriesAnswering({
					listAssetPrices: async () => {
						await held;
						return ok(ROWS);
					},
				}),
				PROJECT.id,
			);
			store.markGone();
			release?.();
			await reading;

			expect(store.assetPrices).toEqual([]);
			expect(store.status).toBe('gone');
		});

		/** `reset` empties the region with everything else — ADR-005's rebuildable state. */
		it('is emptied by reset', async () => {
			const store = useProjectDetailStore();
			await store.hydratePrices(
				queriesAnswering({ listAssetPrices: () => Promise.resolve(ok(ROWS)) }),
				PROJECT.id,
			);

			store.reset();

			expect(store.assetPrices).toEqual([]);
			expect(store.assetPricesError).toBeNull();
		});
	});
});
