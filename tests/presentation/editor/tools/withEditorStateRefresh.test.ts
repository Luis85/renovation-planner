import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { AppError, PersistenceError } from '../../../../src/core/errors/AppError';
import type { PlanEditorQueryServices, ZoneDto } from '../../../../src/presentation/read-models/planEditorQueries';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { withEditorStateRefresh } from '../../../../src/presentation/editor/tools/with-editor-state-refresh';

/**
 * Design slice 8's post-command funnel (docs/tasks/08-zone-editing.md, "Store-refresh
 * tests"): table-driven over run/undo/redo, asserted PER STORE — a decorator that
 * refreshed only the canvas satisfies every assertion written about the canvas, and the
 * Inspector panel is exactly where that gap hides.
 */

type VoidResult = Result<void, AppError>;

const PLAN_ID = 'plan-1';

const planDto = () => ({ id: PLAN_ID, projectId: 'project-1', name: 'Ground floor', background: null, layers: [] });

const zoneDto = (id: string): ZoneDto => ({
	id,
	planId: PLAN_ID,
	name: id,
	zoneType: 'Room',
	status: 'Planned',
	points: [],
});

/** Counts zones reads; optional injected failure from the Nth read on. */
function makeQueries(options?: { failZonesReadsFrom?: number }) {
	let zoneReads = 0;
	const queries: PlanEditorQueryServices & { zoneReads(): number } = {
		getPlan: () => Promise.resolve(ok(planDto())),
		findZonesByPlan: () => {
			zoneReads += 1;
			if (options?.failZonesReadsFrom !== undefined && zoneReads >= options.failZonesReadsFrom) {
				const failure: PersistenceError = {
					category: 'Persistence',
					code: 'test.injected-failure',
					message: 'Injected read failure.',
				};
				return Promise.resolve(err(failure));
			}
			return Promise.resolve(ok([zoneDto('zone-1')]));
		},
		zoneReads: () => zoneReads,
	};
	return queries;
}

function fakeHistory() {
	const calls: string[] = [];
	return {
		calls,
		run(command: UndoableCommand): Promise<VoidResult> {
			calls.push('run');
			return command.execute();
		},
		undo(): Promise<VoidResult> {
			calls.push('undo');
			return Promise.resolve(ok(undefined));
		},
		redo(): Promise<VoidResult> {
			calls.push('redo');
			return Promise.resolve(ok(undefined));
		},
	};
}

const noopCommand: UndoableCommand = {
	execute: () => Promise.resolve(ok(undefined)),
	undo: () => Promise.resolve(ok(undefined)),
};

describe('withEditorStateRefresh', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	for (const op of ['run', 'undo', 'redo'] as const) {
		it(`${op}: a successful operation re-hydrates the ProjectStore AND refreshes the Inspector, unchanged Result`, async () => {
			const queries = makeQueries();
			const projectStore = useProjectStore();
			const history = fakeHistory();
			let inspectorRefreshes = 0;
			const refreshed = withEditorStateRefresh(history, {
				projectStore,
				inspectorStore: {
					refresh: () => {
						inspectorRefreshes += 1;
						return Promise.resolve();
					},
				},
				queries,
				planId: PLAN_ID,
			});

			const result =
				op === 'run' ? await refreshed.run(noopCommand) : await refreshed[op]();

			expect(result).toMatchObject({ ok: true });
			// The CANVAS store was re-hydrated through the real hydration routine...
			expect(projectStore.status).toBe('ready');
			expect(projectStore.zones.has('zone-1')).toBe(true);
			expect(queries.zoneReads()).toBe(1);
			// ...and the PANEL store was refreshed too, separately and as well.
			expect(inspectorRefreshes).toBe(1);
		});
	}

	it('a FAILED operation does neither refresh', async () => {
		const queries = makeQueries();
		const projectStore = useProjectStore();
		const history = fakeHistory();
		let inspectorRefreshes = 0;
		const refreshed = withEditorStateRefresh(history, {
			projectStore,
			inspectorStore: {
				refresh: () => {
					inspectorRefreshes += 1;
					return Promise.resolve();
				},
			},
			queries,
			planId: PLAN_ID,
		});
		const failing: UndoableCommand = {
			execute: () =>
				Promise.resolve(err({ category: 'Persistence', code: 'test.no', message: 'no' })),
			undo: () => Promise.resolve(ok(undefined)),
		};

		const result = await refreshed.run(failing);

		expect(result.ok).toBe(false);
		expect(queries.zoneReads()).toBe(0);
		expect(inspectorRefreshes).toBe(0);
	});

	it('a re-query that itself fails still returns the write success and keeps the previous contents', async () => {
		// The open-time hydrate succeeds; every later (post-command) read fails.
		const queries = makeQueries({ failZonesReadsFrom: 2 });
		const projectStore = useProjectStore();
		await projectStore.hydrate(queries, PLAN_ID);
		expect(projectStore.zones.size).toBe(1);

		const history = fakeHistory();
		const refreshed = withEditorStateRefresh(history, {
			projectStore,
			inspectorStore: { refresh: () => Promise.resolve() },
			queries,
			planId: PLAN_ID,
		});

		const result = await refreshed.run(noopCommand);

		expect(result).toMatchObject({ ok: true });
		expect(projectStore.status).toBe('ready');
		expect(projectStore.zones.size).toBe(1);
		expect(projectStore.error?.code).toBe('test.injected-failure');
	});

	it('a failed PLAN re-read keeps the previous contents too, not only a failed zones read', async () => {
		let planReads = 0;
		const queries: PlanEditorQueryServices = {
			getPlan: () => {
				planReads += 1;
				if (planReads >= 2) {
					return Promise.resolve(
						err({
							category: 'Persistence',
							code: 'test.injected-failure',
							message: 'Injected plan-read failure.',
						}),
					);
				}
				return Promise.resolve(ok(planDto()));
			},
			findZonesByPlan: () => Promise.resolve(ok([zoneDto('zone-1')])),
		};
		const projectStore = useProjectStore();
		await projectStore.hydrate(queries, PLAN_ID);

		const refreshed = withEditorStateRefresh(fakeHistory(), {
			projectStore,
			inspectorStore: { refresh: () => Promise.resolve() },
			queries,
			planId: PLAN_ID,
		});
		await refreshed.run(noopCommand);

		expect(projectStore.status).toBe('ready');
		expect(projectStore.zones.size).toBe(1);
		expect(projectStore.error?.code).toBe('test.injected-failure');
	});

	it("two overlapping dispatches: the first command's slower re-query cannot overwrite the second's snapshot", async () => {
		// The FIRST zones read is gated; an UNQUEUED decorator would let the second
		// dispatch's refresh land first and then be overwritten by this late snapshot.
		let releaseFirstRead: (() => void) | null = null;
		let signalFirstReadStarted: (() => void) | null = null;
		const firstReadGate = new Promise<void>((resolve) => {
			releaseFirstRead = resolve;
		});
		const firstReadStarted = new Promise<void>((resolve) => {
			signalFirstReadStarted = resolve;
		});
		let firstReadBegan = false;
		let lastLanded: string | null = null;
		const queries: PlanEditorQueryServices = {
			getPlan: () => Promise.resolve(ok(planDto())),
			async findZonesByPlan() {
				if (!firstReadBegan) {
					firstReadBegan = true;
					signalFirstReadStarted?.(); // tell the test this read has begun
					await firstReadGate;
					lastLanded = 'first';
					return ok([zoneDto('zone-a')]);
				}
				lastLanded = 'second';
				return ok([zoneDto('zone-a'), zoneDto('zone-b')]);
			},
		};

		const history = fakeHistory();
		const projectStore = useProjectStore();
		const refreshed = withEditorStateRefresh(history, {
			projectStore,
			inspectorStore: { refresh: () => Promise.resolve() },
			queries,
			planId: PLAN_ID,
		});

		// Dispatch BOTH before awaiting either — the concurrent-dispatch shape slice 13
		// describes. Release the gate once the first command's re-query has actually begun.
		const first = refreshed.run(noopCommand);
		const second = refreshed.run(noopCommand);
		await firstReadStarted;
		releaseFirstRead?.();
		await Promise.all([first, second]);

		// The store ends holding the SECOND command's snapshot, not the first's.
		expect(lastLanded).toBe('second');
		expect(projectStore.zones.has('zone-b')).toBe(true);
		// And the writes themselves stayed in dispatch order.
		expect(history.calls).toEqual(['run', 'run']);
	});
});
