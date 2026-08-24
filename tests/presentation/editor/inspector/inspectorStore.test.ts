// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { AppError, GeometryError, PersistenceError } from '../../../../src/core/errors/AppError';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';
import type { ZoneInspectorFields } from '../../../../src/application/queries/GetZoneInspector';
import {
	createInspectorStoreDefinition,
	type InspectorDeps,
} from '../../../../src/presentation/editor/inspector/inspector-store';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';

type QueryAnswer = Result<ZoneInspectorFields | null, PersistenceError | GeometryError>;

const zoneId = (n: number): ZoneId => `zone-${n}` as ZoneId;

function makeFields(id: ZoneId, overrides: Partial<ZoneInspectorFields> = {}): ZoneInspectorFields {
	return { id, name: 'Living room', areaMm2: 100, ...overrides };
}

/** A stub `InspectorDeps` whose query answer can be changed between calls (`setAnswer`),
 * whose `dispatcher.run` and `toCommand` are spies, and whose call counts this suite
 * asserts against directly — the DoD 10 rule that "not called" must be checked against a
 * spy, not inferred from the resulting DTO. */
function stubDeps(initialAnswer: QueryAnswer) {
	let answer = initialAnswer;
	const queryExecute = vi.fn<(input: { zoneId: ZoneId }) => Promise<QueryAnswer>>(() => Promise.resolve(answer));
	const commandRun = vi.fn<(command: UndoableCommand) => Promise<Result<void, AppError>>>(() =>
		Promise.resolve(ok(undefined)),
	);
	const toCommand = vi.fn<(edit: Record<string, unknown>) => UndoableCommand>(() => ({
		execute: () => Promise.resolve(ok(undefined)),
		undo: () => Promise.resolve(ok(undefined)),
	}));
	const deps: InspectorDeps = {
		query: { execute: queryExecute },
		dispatcher: { run: commandRun },
		toCommand,
	};
	return {
		deps,
		queryExecute,
		commandRun,
		toCommand,
		setAnswer: (next: QueryAnswer) => {
			answer = next;
		},
	};
}

/**
 * A deps stub whose query answers are resolved BY THIS TEST FILE, one deferred per call,
 * so a LATER request can be made to resolve before an earlier one. That interleaving is
 * the ordinary case — click a zone, click another — and nothing about a repository, a
 * vault read, or Obsidian's `MetadataCache` promises the answers come back in order.
 * `stubDeps` above cannot express it: its query resolves inline, so every call resolves in
 * the order it was made and a store with no staleness guard would pass every test there.
 */
function deferredDeps() {
	const pending: ((answer: QueryAnswer) => void)[] = [];
	const queryExecute = vi.fn<(input: { zoneId: ZoneId }) => Promise<QueryAnswer>>(
		() =>
			new Promise<QueryAnswer>((resolve) => {
				pending.push(resolve);
			}),
	);
	const deps: InspectorDeps = {
		query: { execute: queryExecute },
		dispatcher: { run: () => Promise.resolve(ok(undefined)) },
		toCommand: () => ({
			execute: () => Promise.resolve(ok(undefined)),
			undo: () => Promise.resolve(ok(undefined)),
		}),
	};
	/** Answers the nth query call (0-based, in the order the calls were made). */
	function answer(nth: number, value: QueryAnswer): void {
		const resolve = pending[nth];
		if (resolve === undefined) throw new Error(`no query call ${nth} to answer`);
		resolve(value);
	}
	return { deps, queryExecute, answer };
}

describe('InspectorStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('hydrateFrom — selection to DTO', () => {
		it('a single-id selection produces a zone DTO sourced from the query', async () => {
			const id = zoneId(1);
			const { deps, queryExecute } = stubDeps(ok(makeFields(id)));
			const store = createInspectorStoreDefinition(deps)();

			await store.hydrateFrom([id]);

			expect(queryExecute).toHaveBeenCalledTimes(1);
			expect(queryExecute).toHaveBeenCalledWith({ zoneId: id });
			expect(store.dto).toEqual({ kind: 'zone', id, name: 'Living room', areaMm2: 100 });
		});

		it('several ids produce `multiple`, and the query is never called', async () => {
			const ids = [zoneId(1), zoneId(2)] as readonly EntityId<string>[];
			const { deps, queryExecute } = stubDeps(ok(null));
			const store = createInspectorStoreDefinition(deps)();

			await store.hydrateFrom(ids);

			expect(queryExecute).not.toHaveBeenCalled();
			expect(store.dto).toEqual({ kind: 'multiple', ids });
		});

		it('an empty selection produces `empty`, and the query is never called', async () => {
			const { deps, queryExecute } = stubDeps(ok(null));
			const store = createInspectorStoreDefinition(deps)();

			await store.hydrateFrom([]);

			expect(queryExecute).not.toHaveBeenCalled();
			expect(store.dto).toEqual({ kind: 'empty' });
		});

		it('a single id the query cannot find falls back to `empty` rather than throwing', async () => {
			const { deps } = stubDeps(ok(null));
			const store = createInspectorStoreDefinition(deps)();

			await store.hydrateFrom([zoneId(1)]);

			expect(store.dto).toEqual({ kind: 'empty' });
		});

		it('a failed query on hydrate falls back to `empty` rather than throwing', async () => {
			const failure: PersistenceError = { category: 'Persistence', code: 'test.injected', message: 'x' };
			const { deps } = stubDeps(err(failure));
			const store = createInspectorStoreDefinition(deps)();

			await store.hydrateFrom([zoneId(1)]);

			expect(store.dto).toEqual({ kind: 'empty' });
		});
	});

	describe('commit — edit to command', () => {
		it('dispatches exactly one command through toCommand and the dispatcher, per call', async () => {
			const { deps, commandRun, toCommand } = stubDeps(ok(null));
			const store = createInspectorStoreDefinition(deps)();
			const edit = { name: 'New name' };

			const result = await store.commit(edit);

			expect(toCommand).toHaveBeenCalledTimes(1);
			expect(toCommand).toHaveBeenCalledWith(edit);
			expect(commandRun).toHaveBeenCalledTimes(1);
			// Not just "a command was built" and "the dispatcher ran once" separately —
			// the exact object toCommand returned is the one the dispatcher received.
			expect(commandRun).toHaveBeenCalledWith(toCommand.mock.results[0]?.value);
			expect(result).toEqual(ok(undefined));
		});

		it('two commit calls dispatch exactly two commands, one each', async () => {
			const { deps, commandRun } = stubDeps(ok(null));
			const store = createInspectorStoreDefinition(deps)();

			await store.commit({ name: 'First' });
			await store.commit({ name: 'Second' });

			expect(commandRun).toHaveBeenCalledTimes(2);
		});
	});

	describe('refresh — the cached read’s invalidation', () => {
		it('on an empty selection, resolves with zero query calls', async () => {
			const { deps, queryExecute } = stubDeps(ok(null));
			const store = createInspectorStoreDefinition(deps)();
			await store.hydrateFrom([]);

			await store.refresh();

			expect(queryExecute).not.toHaveBeenCalled();
		});

		it('on success, replaces dto with the new answer', async () => {
			const id = zoneId(1);
			const { deps, queryExecute, setAnswer } = stubDeps(ok(makeFields(id, { name: 'Old name' })));
			const store = createInspectorStoreDefinition(deps)();
			await store.hydrateFrom([id]);
			expect(store.dto).toEqual({ kind: 'zone', id, name: 'Old name', areaMm2: 100 });

			setAnswer(ok(makeFields(id, { name: 'New name' })));
			await store.refresh();

			expect(queryExecute).toHaveBeenCalledTimes(2);
			expect(store.dto).toEqual({ kind: 'zone', id, name: 'New name', areaMm2: 100 });
		});

		it('on a failed query (a transient read failure), keeps the previous dto rather than blanking the panel', async () => {
			const id = zoneId(1);
			const { deps, setAnswer } = stubDeps(ok(makeFields(id)));
			const store = createInspectorStoreDefinition(deps)();
			await store.hydrateFrom([id]);
			const before = store.dto;

			setAnswer(err({ category: 'Persistence', code: 'test.injected', message: 'x' }));
			await store.refresh();

			expect(store.dto).toEqual(before);
		});

		it('on a genuine not-found (ok(null)) — distinct from a failed query — transitions to `empty` rather than keeping a deleted zone on display forever', async () => {
			// ok(null) is DEFINITIVE evidence the zone is gone (GetZoneInspector's own
			// "not found is ok(null), never an error" contract), not a transient read
			// failure — so unlike the case above, the stale dto must NOT be kept.
			const id = zoneId(1);
			const { deps, setAnswer } = stubDeps(ok(makeFields(id)));
			const store = createInspectorStoreDefinition(deps)();
			await store.hydrateFrom([id]);
			expect(store.dto).toEqual({ kind: 'zone', id, name: 'Living room', areaMm2: 100 });

			setAnswer(ok(null));
			await store.refresh();

			expect(store.dto).toEqual({ kind: 'empty' });
		});

		it('never mutates what is selected', async () => {
			const id = zoneId(1);
			const selection = useSelectionStore();
			selection.select([id]);
			const { deps } = stubDeps(ok(makeFields(id)));
			const store = createInspectorStoreDefinition(deps)();
			await store.hydrateFrom(selection.selectedIds);

			await store.refresh();

			expect(selection.selectedIds).toEqual([id]);
		});
	});

	describe('out-of-order query answers', () => {
		// The panel's own doc argues at length about a STALE dto and never names this source
		// of one: two selections in flight at once. Each of these three fails without the
		// request token in `inspector-store.ts` — the earlier read's answer lands last and
		// overwrites the current selection's, leaving `dto` describing one entity while
		// `lastSelection` names another, with nothing anywhere reporting a problem.

		it('two rapid selection changes: the later selection wins, even when the earlier query answers last', async () => {
			const { deps, answer } = deferredDeps();
			const store = createInspectorStoreDefinition(deps)();

			const firstSelection = store.hydrateFrom([zoneId(1)]);
			const secondSelection = store.hydrateFrom([zoneId(2)]);
			// Deliberately the wrong way round: the newer request answers first, the older
			// one last, so the last write to `dto` would be the stale one.
			answer(1, ok(makeFields(zoneId(2), { name: 'Second' })));
			answer(0, ok(makeFields(zoneId(1), { name: 'First' })));
			await Promise.all([firstSelection, secondSelection]);

			expect(store.dto).toEqual({ kind: 'zone', id: zoneId(2), name: 'Second', areaMm2: 100 });
		});

		it('a refresh superseded by a new selection does not overwrite the new selection’s dto', async () => {
			const { deps, answer } = deferredDeps();
			const store = createInspectorStoreDefinition(deps)();
			const hydrated = store.hydrateFrom([zoneId(1)]);
			answer(0, ok(makeFields(zoneId(1), { name: 'One' })));
			await hydrated;

			const refreshing = store.refresh(); // query call 1, for zone 1
			const reselected = store.hydrateFrom([zoneId(2)]); // query call 2, for zone 2
			answer(2, ok(makeFields(zoneId(2), { name: 'Two' })));
			await reselected;
			expect(store.dto).toEqual({ kind: 'zone', id: zoneId(2), name: 'Two', areaMm2: 100 });

			answer(1, ok(makeFields(zoneId(1), { name: 'One, refreshed' })));
			await refreshing;

			expect(store.dto).toEqual({ kind: 'zone', id: zoneId(2), name: 'Two', areaMm2: 100 });
		});

		it('selecting several zones invalidates a single-zone query still in flight', async () => {
			// The synchronous branches of hydrateFrom take a ticket too, which is what makes
			// this case work: `multiple` is assigned without awaiting anything, so only the
			// token stops the in-flight single-zone read from replacing it afterwards.
			const { deps, answer } = deferredDeps();
			const store = createInspectorStoreDefinition(deps)();
			const single = store.hydrateFrom([zoneId(1)]);

			await store.hydrateFrom([zoneId(1), zoneId(2)]);
			expect(store.dto).toEqual({ kind: 'multiple', ids: [zoneId(1), zoneId(2)] });

			answer(0, ok(makeFields(zoneId(1))));
			await single;

			expect(store.dto).toEqual({ kind: 'multiple', ids: [zoneId(1), zoneId(2)] });
		});
	});

	describe('createInspectorStoreDefinition against a single Pinia instance', () => {
		it('registering the store id twice keeps the FIRST deps bound — a fresh Pinia is required to rebind', () => {
			const { deps: depsA } = stubDeps(ok(null));
			const { deps: depsB } = stubDeps(ok(null));

			const storeA = createInspectorStoreDefinition(depsA)();
			const storeB = createInspectorStoreDefinition(depsB)();

			// Pinia dedupes by the string id passed to defineStore ('inspector'), not by
			// which definition function produced it — the second registration under one
			// active Pinia instance is a no-op, and useB() returns storeA. See this
			// module's own comment on createInspectorStoreDefinition for what that means
			// for callers.
			expect(storeB).toBe(storeA);
		});
	});
});
