/**
 * `ProjectStore` — the Plan Editor working copy: hydration, its failure/missing/stale arms,
 * `refreshing`/`retriesFailed` and `reset()` (SDD §14).
 *
 * Node, not jsdom: a store is plain reactive state, and needing a DOM to test one would
 * mean the persistent/ephemeral split had leaked into a component.
 *
 * Split out of `stores.test.ts` (which now holds `EditorStore` and `WorkspaceStore`) once the
 * combined file crossed its 450-line cap — this is the file the task originally named.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_PROJECT, FIXTURE_ZONES } from '../../helpers/planFixtures';
import { defer } from '../../helpers/async';

const READ_FAILED = { category: 'Persistence', code: 'plan.read-failed', message: 'boom' } as const;

function queries(overrides: Partial<PlanEditorQueryServices> = {}): PlanEditorQueryServices {
	return {
		getPlan: () => Promise.resolve(ok(FIXTURE_PLAN)),
		getProject: () => Promise.resolve(ok(FIXTURE_PROJECT)),
		findZonesByPlan: () => Promise.resolve(ok({ zones: FIXTURE_ZONES, unreadable: 0 })),
		getRequirementsForZone: () => Promise.resolve(ok([])),
		listAssets: () => Promise.resolve(ok([])),
		listRequirementsReferencing: () => Promise.resolve(ok([])),
		listReassignmentTargets: () => Promise.resolve(ok([])),
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('ProjectStore hydration', () => {
	it('starts idle, holding nothing', () => {
		const store = useProjectStore();

		expect(store.status).toBe('idle');
		expect(store.plan).toBeNull();
		expect(store.zones.size).toBe(0);
	});

	it('loads the plan and keys its zones by domain id', async () => {
		const store = useProjectStore();

		await store.hydrate(queries(), FIXTURE_PLAN.id);

		expect(store.status).toBe('ready');
		expect(store.plan).toEqual(FIXTURE_PLAN);
		expect([...store.zones.keys()]).toEqual(FIXTURE_ZONES.map((zone) => zone.id));
	});

	/**
	 * The distinction the query services exist to preserve. `missing` and `failed` are
	 * different states because slice 14 branches on the first and slice 17 on the second,
	 * and a store that collapsed them would make that impossible downstream.
	 */
	it('reports a plan that does not exist as missing', async () => {
		const store = useProjectStore();

		await store.hydrate(queries({ getPlan: () => Promise.resolve(ok(null)) }), 'nope');

		expect(store.status).toBe('missing');
		expect(store.error).toBeNull();
	});

	it('reports a failed plan read as failed, carrying the error', async () => {
		const store = useProjectStore();

		await store.hydrate(queries({ getPlan: () => Promise.resolve(err(READ_FAILED)) }), FIXTURE_PLAN.id);

		expect(store.status).toBe('failed');
		expect(store.error).toEqual(READ_FAILED);
	});

	it('reports a failed ZONE read as failed too, and keeps no half-loaded plan', async () => {
		const store = useProjectStore();

		await store.hydrate(
			queries({ findZonesByPlan: () => Promise.resolve(err(READ_FAILED)) }),
			FIXTURE_PLAN.id,
		);

		expect(store.status).toBe('failed');
		// The plan read SUCCEEDED here. Keeping it would draw a canvas that looks current
		// beside an error saying it is not — the worse of the two wrong answers.
		expect(store.plan).toBeNull();
		expect(store.zones.size).toBe(0);
		expect(store.refreshing).toBe(false);
	});

	/** Listing the zones of a plan that does not exist is a vault read with one answer. */
	it('does not ask for zones when the plan is absent', async () => {
		const findZonesByPlan = vi.fn<PlanEditorQueryServices['findZonesByPlan']>();
		const store = useProjectStore();

		await store.hydrate(queries({ getPlan: () => Promise.resolve(ok(null)), findZonesByPlan }), 'nope');

		expect(findZonesByPlan).not.toHaveBeenCalled();
	});

	/**
	 * A re-hydration must not blank a working editor: the root mounts its canvas on `ready`,
	 * so a drop to `loading` tears the Konva stage down and rebuilds it — the whole canvas
	 * flashing because one field changed. Asserted by watching the status THROUGH the call
	 * rather than after it, since after it the value is `ready` either way.
	 */
	it('stays ready while re-reading a plan it is already showing', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);

		const seen: string[] = [];
		const watched = queries({
			getPlan: () => {
				seen.push(store.status);
				return Promise.resolve(ok(FIXTURE_PLAN));
			},
		});
		await store.hydrate(watched, FIXTURE_PLAN.id);

		expect(seen).toEqual(['ready']);
	});

	it('does go through loading on a first load, and after a failure', async () => {
		const store = useProjectStore();
		const seen: string[] = [];
		const watched = queries({
			getPlan: () => {
				seen.push(store.status);
				return Promise.resolve(err(READ_FAILED));
			},
		});

		await store.hydrate(watched, FIXTURE_PLAN.id);
		await store.hydrate(watched, FIXTURE_PLAN.id);

		expect(seen).toEqual(['loading', 'loading']);
	});

	/**
	 * Slice 8 gave `hydrate` a SECOND concurrent caller — the post-command refresh funnel,
	 * alongside the plan-change listener, which `ProjectIndexRebuilt` fires on every leaf
	 * regardless of which plan it touched. Two overlapping hydrations resolve in whatever
	 * order the vault answers, and without a ticket the LAST assignment wins whether or not
	 * it is the freshest: a just-drawn zone disappears from the canvas with no error.
	 */
	it('a SLOW earlier hydration does not overwrite a faster later one', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);

		let releaseSlow!: () => void;
		const slowGate = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});
		const stalePlan = { ...FIXTURE_PLAN, name: 'the stale answer' };
		const slow = store.hydrate(
			queries({
				getPlan: () => slowGate.then(() => ok(stalePlan)),
				findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0 })),
			}),
			FIXTURE_PLAN.id,
		);

		// A second hydration starts and finishes entirely inside the first one's await.
		const fresh = { ...FIXTURE_PLAN, name: 'the fresh answer' };
		await store.hydrate(queries({ getPlan: () => Promise.resolve(ok(fresh)) }), FIXTURE_PLAN.id);
		expect(store.plan?.name).toBe('the fresh answer');

		releaseSlow();
		await slow;

		expect(store.plan?.name).toBe('the fresh answer');
		expect(store.zones.size).toBe(FIXTURE_ZONES.length);
	});

	/**
	 * The same race, gated on the PROJECT read rather than the plan read — its own
	 * `if (superseded()) return;`, right after `queries.getProject`, needs its own proof.
	 *
	 * Answering the STALE read `ok(null)` rather than a stale-but-real project is deliberate:
	 * a stale SUCCESS is still caught by the `superseded()` check after the later
	 * `findZonesByPlan` await, so mutating only this guard would not redden a case built on
	 * that path. `foundProject.value === null` calls `markMissing` and returns immediately,
	 * with no later guard behind it — so this is the one place a missing project-read guard
	 * is observable on its own: a project that vanishes on a stale read must not blank a
	 * plan a fresher hydration has already put on screen.
	 */
	it('a SLOW earlier hydration does not blank a fresher one when its project read supersedes', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');

		let releaseSlow!: () => void;
		const slowGate = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});
		// The slow hydration's OWN `getPlan` is the fast default, which resolves after a single
		// microtask — the same tick a synchronously-started fresh hydration bumps
		// `latestHydration` in. Without waiting for the slow hydration to actually REACH its
		// `getProject` call, starting the fresh one right away races the PLAN guard instead of
		// the PROJECT guard this case exists to exercise, and the slow read never gets far
		// enough to reach the branch under test.
		let projectReadStarted!: () => void;
		const projectReadStartedPromise = new Promise<void>((resolve) => {
			projectReadStarted = resolve;
		});
		const slow = store.hydrate(
			queries({
				getProject: () => {
					projectReadStarted();
					return slowGate.then(() => ok(null));
				},
			}),
			FIXTURE_PLAN.id,
		);
		await projectReadStartedPromise;

		// A second hydration starts and finishes entirely inside the first one's getProject await.
		await store.hydrate(queries(), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');

		releaseSlow();
		await slow;

		// The slow hydration's project vanished, but it started before the fresh one and must
		// not retroactively blank what the fresh hydration already established.
		expect(store.status).toBe('ready');
		expect(store.plan).toEqual(FIXTURE_PLAN);
	});

	it('a reset invalidates a hydration still in flight', async () => {
		// A leaf closing must not have the plan it was reading painted back a tick later.
		const store = useProjectStore();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = store.hydrate(
			queries({ getPlan: () => gate.then(() => ok(FIXTURE_PLAN)) }),
			FIXTURE_PLAN.id,
		);

		store.reset();
		// `reset()` is the only clearer left for a hydration it just invalidated: that read's
		// own `done()` will find itself permanently superseded and never fire.
		expect(store.refreshing).toBe(false);

		release();
		await pending;

		expect(store.plan).toBeNull();
		expect(store.status).toBe('idle');
		// The now-superseded read settling afterwards must not turn the flag back on.
		expect(store.refreshing).toBe(false);
	});

	it('is fully rebuildable — a reset returns it to its opening state', async () => {
		const store = useProjectStore();
		await store.hydrate(queries(), FIXTURE_PLAN.id);

		store.reset();

		expect({
			status: store.status,
			plan: store.plan,
			zones: store.zones.size,
			error: store.error,
			refreshing: store.refreshing,
			retriesFailed: store.retriesFailed,
		}).toEqual({
			status: 'idle',
			plan: null,
			zones: 0,
			error: null,
			refreshing: false,
			retriesFailed: 0,
		});
	});

	it('hydrates the project beside the plan, so the context bar can name it', async () => {
		const store = useProjectStore();
		await store.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');
		expect(store.project?.id).toBe(FIXTURE_PLAN.projectId);
		expect(store.project?.name).toBe('Willow House');
	});

	/**
	 * [[Project-hydration fakes ignore the requested project ID]]: neither `fakeQueries` nor
	 * `harnessDeps().queries` used to consult the id passed to `getProject` — they answered
	 * their fixture project for ANY id — so a `hydrate` that asked for the wrong field (the
	 * plan's OWN id, say, rather than `foundPlan.value.projectId`) would still have read back
	 * the right project by coincidence. This spies on the fake's own `getProject` to assert
	 * the ARGUMENT the store actually calls it with, which only discriminates once the fake
	 * itself is honest about the id it was given.
	 */
	it('asks for the PLAN\'s project, by the id the plan carries', async () => {
		const store = useProjectStore();
		const getProject = vi.fn<PlanEditorQueryServices['getProject']>(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES).getProject);
		await store.hydrate({ ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getProject }, FIXTURE_PLAN.id);
		expect(getProject).toHaveBeenCalledTimes(1);
		expect(getProject).toHaveBeenCalledWith(FIXTURE_PLAN.projectId);
		expect(store.project?.name).toBe('Willow House');
	});

	it('fails the hydration when the project read fails, like a failed plan read', async () => {
		const store = useProjectStore();
		const failingProject = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			getProject: () => Promise.resolve(err({ category: 'Persistence', code: 'project.read-failed', message: 'boom' } as const)),
		};
		await store.hydrate(failingProject, FIXTURE_PLAN.id);
		expect(store.status).toBe('failed');
		expect(store.error?.code).toBe('project.read-failed');
		expect(store.refreshing).toBe(false);
	});

	it('treats a project that no longer resolves as a missing plan', async () => {
		const store = useProjectStore();
		const danglingProject = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			getProject: () => Promise.resolve(ok(null)),
		};
		await store.hydrate(danglingProject, FIXTURE_PLAN.id);
		expect(store.status).toBe('missing');
		expect(store.refreshing).toBe(false);
	});

	/**
	 * The `keepOnFailure` arm of the project read — a failed re-read after a committed
	 * write must not blank a canvas that a moment ago showed real content, mirroring the
	 * same arm the plan and zone reads already have above.
	 */
	it('a failed project re-read keeps the previous contents too, with keepPreviousOnFailure', async () => {
		const store = useProjectStore();
		await store.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
		expect(store.status).toBe('ready');

		const failingProject = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			getProject: () => Promise.resolve(err(READ_FAILED)),
		};
		await store.hydrate(failingProject, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });

		expect(store.status).toBe('ready');
		expect(store.plan).toEqual(FIXTURE_PLAN);
		expect(store.error).toEqual(READ_FAILED);
		expect(store.stale).toBe(true);
	});

	it('a plan that goes missing after a stale re-read blanks the stale flag with the content', async () => {
		const store = useProjectStore();
		await store.hydrate(fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), FIXTURE_PLAN.id);
		await store.hydrate(
			{ ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), getProject: () => Promise.resolve(err(READ_FAILED)) },
			FIXTURE_PLAN.id,
			{ keepPreviousOnFailure: true },
		);
		expect(store.stale).toBe(true);

		await store.hydrate(fakeQueries(null, []), FIXTURE_PLAN.id);

		expect(store.status).toBe('missing');
		expect(store.plan).toBeNull();
		expect(store.stale).toBe(false);
	});
});

describe('refreshing and failed retries', () => {
	it('is refreshing from the first line of a hydrate until its read settles', async () => {
		const store = useProjectStore();
		const gate = defer<Awaited<ReturnType<PlanEditorQueryServices['getPlan']>>>();
		const reading = { ...fakeQueries(FIXTURE_PLAN), getPlan: () => gate.promise };

		const run = store.hydrate(reading, FIXTURE_PLAN.id);
		expect(store.refreshing).toBe(true);

		gate.resolve(ok(FIXTURE_PLAN));
		await run;

		expect(store.refreshing).toBe(false);
	});

	it('stays refreshing while a LATER read is still open, even after an earlier one settles', async () => {
		const store = useProjectStore();
		const first = defer<Awaited<ReturnType<PlanEditorQueryServices['getPlan']>>>();
		const second = defer<Awaited<ReturnType<PlanEditorQueryServices['getPlan']>>>();
		let call = 0;
		const reading = {
			...fakeQueries(FIXTURE_PLAN),
			getPlan: () => (++call === 1 ? first.promise : second.promise),
		};

		const a = store.hydrate(reading, FIXTURE_PLAN.id);
		const b = store.hydrate(reading, FIXTURE_PLAN.id);

		first.resolve(ok(FIXTURE_PLAN));
		await a;
		// The superseded read must not clear it: `b` still holds the latest ticket.
		expect(store.refreshing).toBe(true);

		second.resolve(ok(FIXTURE_PLAN));
		await b;
		expect(store.refreshing).toBe(false);
	});

	it('counts a failed RETRY, not the failure that made the canvas stale', async () => {
		const store = useProjectStore();
		let call = 0;
		const reading = {
			...fakeQueries(FIXTURE_PLAN),
			getPlan: () => Promise.resolve(++call === 1 ? ok(FIXTURE_PLAN) : err(READ_FAILED)),
		};

		await store.hydrate(reading, FIXTURE_PLAN.id);
		await store.hydrate(reading, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.stale).toBe(true);
		expect(store.retriesFailed).toBe(0);
		expect(store.refreshing).toBe(false);

		await store.hydrate(reading, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.retriesFailed).toBe(1);
		expect(store.refreshing).toBe(false);

		await store.hydrate(reading, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.retriesFailed).toBe(2);
		expect(store.refreshing).toBe(false);
	});

	it('resets the failed-retry count on the read that succeeds', async () => {
		const store = useProjectStore();
		const outcomes = [ok(FIXTURE_PLAN), err(READ_FAILED), err(READ_FAILED), ok(FIXTURE_PLAN)];
		let call = 0;
		const reading = { ...fakeQueries(FIXTURE_PLAN), getPlan: () => Promise.resolve(outcomes[call++]) };

		await store.hydrate(reading, FIXTURE_PLAN.id);
		expect(store.stale).toBe(false);

		await store.hydrate(reading, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.stale).toBe(true);
		expect(store.retriesFailed).toBe(0);
		expect(store.refreshing).toBe(false);

		await store.hydrate(reading, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.retriesFailed).toBe(1);
		expect(store.refreshing).toBe(false);

		await store.hydrate(reading, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		expect(store.retriesFailed).toBe(0);
		expect(store.stale).toBe(false);
		expect(store.refreshing).toBe(false);
	});

	/**
	 * The failure-path assertions above only ever drive the PLAN read's `isErr` branch — this
	 * covers its sibling `done()` call site, the plan resolving as MISSING (`ok(null)`), so a
	 * regression dropping `done()` from that arm is caught too.
	 */
	it('clears refreshing after a hydrate whose plan resolves as missing', async () => {
		const store = useProjectStore();

		await store.hydrate(fakeQueries(null, []), FIXTURE_PLAN.id);

		expect(store.status).toBe('missing');
		expect(store.refreshing).toBe(false);
	});
});
