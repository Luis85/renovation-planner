import { afterEach, describe, expect, it } from 'vitest';
import { SessionStores } from '../../src/plugin/sessionStores';
import { activeWriteIncidentRegistry, installWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import type { TextFileAdapter } from '../../src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore';
import { recorder, resetRecorder } from '../helpers/logger';
import { slowGuardedSave } from '../helpers/writeIncidents';
import { useFieldCommit } from '../../src/presentation/composables/use-field-commit';
import { withSaveStateTracking } from '../../src/presentation/editor/save-state/with-save-state-tracking';
import { ok } from '../../src/core/result/Result';
import { createSerialQueue } from '../../src/presentation/editor/tools/serial-queue';

const noop = (): void => undefined;

function fakeAdapter(): TextFileAdapter {
	const files = new Map<string, string>();
	return {
		exists: (path) => Promise.resolve(files.has(path)),
		read: (path) => Promise.resolve(files.get(path) ?? ''),
		write: (path, data) => {
			files.set(path, data);
			return Promise.resolve();
		},
		remove: (path) => {
			files.delete(path);
			return Promise.resolve();
		},
	};
}

/**
 * Fix 2's regression, isolated from the whole plugin load path
 * (`tests/plugin/writeIncidentWiring.test.ts` covers the single-session case end to end).
 *
 * `SessionStores.dispose()` used to call `installWriteIncidentRegistry(null)` unconditionally
 * — the weaker half of the exact pattern `konvaGlobal.ts`'s `claimKonvaGlobal` already carries
 * for the same shape of global: release only while the global is still the one YOU claimed.
 * Two overlapping `SessionStores` — routine in this suite (a second `loadedPlugin()` before
 * the first is disposed) and reachable in a real vault by a reload race — meant session A's
 * `dispose()` nulled out session B's already-installed registry, so the gate would answer
 * "nothing open" over a vault B's own incidents say is half-written.
 */
describe('SessionStores', () => {
	afterEach(() => {
		installWriteIncidentRegistry(null);
		resetRecorder();
	});

	/**
	 * The path the registry NAMES is the path the store WRITES, asserted rather than trusted
	 * to one spelling. `WriteIncidentRegistry`'s `location` defaults to `''` so fifteen test
	 * constructions need not carry a path they do not use — which means a composition site
	 * that forgot to pass one would report an empty path in the diagnostics section, and a
	 * report pointing at nothing is exactly the discoverability ADR-0034 asks this surface for.
	 * This is the only instrument that can see that.
	 */
	it('names the file it writes, so the diagnostics report points at a real path', async () => {
		const adapter = fakeAdapter();
		const stores = new SessionStores(adapter, 'plugins/renovation-planner', recorder);

		expect(stores.writeIncidents.report().path).toBe('plugins/renovation-planner/write-incidents.json');

		await stores.writeIncidents.record({
			category: 'Persistence',
			code: 'zone.write-uncompensated',
			message: 'half-written',
			uncompensatedWrite: [],
		});
		expect(await adapter.exists(stores.writeIncidents.report().path)).toBe(true);

		stores.dispose();
	});

	it('releases the registry it installed on dispose', () => {
		const stores = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);

		stores.dispose();

		expect(activeWriteIncidentRegistry()).toBeNull();
	});

	/**
	 * Lifecycle contract rule 3 — a refusal is not cleared by a teardown — at the unit, where
	 * the branch lives. `onunload` itself unmounts no Vue app and detaches no leaf, so wherever a
	 * view is still mounted when it runs, a released registry disarms `guardCommand`'s refusal
	 * arm, `withIncidentGate`'s `paused()` and `markUncompensated`'s record for it. Whether one
	 * IS still mounted is Obsidian's order: the one measurement (tracker row L-21, 1.13.7,
	 * Windows, one machine) found the Plan Editor view closed BEFORE `onunload` — other panes,
	 * versions and mobile unmeasured. `tests/plugin/unloadWithViewOpen.test.ts` drives the
	 * consequence on a rig whose fake leaves the view mounted; this case pins the decision the
	 * consequence rests on.
	 */
	it('keeps an OPEN registry installed on dispose, because a refusal outlives the teardown', async () => {
		const stores = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		await stores.writeIncidents.record({
			category: 'Persistence',
			code: 'zone.write-uncompensated',
			message: 'half-written',
			uncompensatedWrite: [],
		});

		stores.dispose();

		expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);
		expect(activeWriteIncidentRegistry()?.anyOpen()).toBe(true);
	});

	it('does not release a LATER session\'s registry — dispose only releases its own', () => {
		const a = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		const b = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		expect(activeWriteIncidentRegistry()).toBe(b.writeIncidents);

		a.dispose();
		expect(activeWriteIncidentRegistry()).toBe(b.writeIncidents);

		b.dispose();
		expect(activeWriteIncidentRegistry()).toBeNull();
	});

	/**
	 * Owner ruling 16 at the unit: a save RUNNING at dispose keeps the record installed until it
	 * settles, so a half-failure landing after `dispose()` is still recorded and still shuts the
	 * gate. Taken at the guard here — the door a direct dispatch reaches synchronously;
	 * `tests/plugin/unloadWithViewOpen.test.ts` drives the queued editor door.
	 */
	it('keeps the registry installed while a save is in flight at dispose, and records its half-failure', async () => {
		const adapter = fakeAdapter();
		const stores = new SessionStores(adapter, 'plugins/renovation-planner', recorder);
		const save = slowGuardedSave();
		const running = save.execute();

		stores.dispose();
		expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);

		save.halfFail();
		await running;

		expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);
		expect(stores.writeIncidents.anyOpen()).toBe(true);
		await expect.poll(() => adapter.read(stores.writeIncidents.report().path)).toContain('zone.write-uncompensated');
	});

	it('releases a clean registry once the save in flight at dispose settles', async () => {
		const stores = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		const save = slowGuardedSave();
		const running = save.execute();

		stores.dispose();
		expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);

		save.finish({ ok: true, value: 'wrote' });
		await running;

		expect(activeWriteIncidentRegistry()).toBeNull();
	});

	/**
	 * A reload before the old save settles: TWO registries, ONE file. Pinned, not endorsed. The
	 * old save was gated by the old session's registry, but its half-failure is recorded where it
	 * is STAMPED (owner ruling 13) — into whichever registry the holder answers then, which is the
	 * NEW session's. So the new gate shuts at once and the shared file carries the incident; the
	 * old record takes nothing. (Until ruling 13 the old record took it, and the new gate learned
	 * of it only at the load after.)
	 */
	it('pins a reload during an old save: the new record takes the stamp, and stays installed', async () => {
		const adapter = fakeAdapter();
		const a = new SessionStores(adapter, 'plugins/renovation-planner', recorder);
		const save = slowGuardedSave();
		const running = save.execute();
		a.dispose();

		const b = new SessionStores(adapter, 'plugins/renovation-planner', recorder);
		await b.writeIncidents.seed();
		save.halfFail();
		await running;

		expect(activeWriteIncidentRegistry()).toBe(b.writeIncidents);
		expect(a.writeIncidents.anyOpen()).toBe(false);
		expect(b.writeIncidents.anyOpen()).toBe(true);
		await expect.poll(() => adapter.read(b.writeIncidents.report().path)).toContain('zone.write-uncompensated');
	});

	/**
	 * A field commit QUEUED behind a save in flight at dispose — the teardown's blur landing while
	 * an earlier commit of the same field is still writing. The queued value sits inside
	 * `useFieldCommit`, outside both doors `hold()` names, so the first save settling used to
	 * release a clean record and the continuation then dispatched ungated and unrecorded.
	 */
	it('keeps the registry for a field commit queued behind the save in flight at dispose', async () => {
		const { stores, queued } = await queuedBehindDispose();

		expect(queued.seen).toEqual([stores.writeIncidents]);
		queued.halfFail();
		await expect.poll(() => stores.writeIncidents.anyOpen()).toBe(true);
		expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);
	});

	it('releases a clean registry once that queued field commit settles', async () => {
		const { queued } = await queuedBehindDispose();

		queued.finish(ok('wrote'));
		await expect.poll(() => activeWriteIncidentRegistry()).toBeNull();
	});

	/**
	 * The designer's height field: its path QUEUES before its first door (`toolDispatcher` →
	 * `chain.enqueue`, a `tail.then`), so even its FIRST commit reaches `withSaveStateTracking`
	 * a microtask after the gesture — after a `dispose()` in the same turn.
	 */
	it('keeps the registry for a field commit whose path queues before reaching a door', async () => {
		const stores = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		const save = slowGuardedSave();
		const queue = createSerialQueue();
		const tracked = trackedHistory();
		const field = fieldOver({ run: (command) => queue(() => tracked.run(command)) }, () => save);
		field.onInput(1);
		void field.onCommit();

		stores.dispose();
		await expect.poll(() => save.seen.length).toBe(1);

		expect(save.seen).toEqual([stores.writeIncidents]);
		save.finish(ok('wrote'));
		await expect.poll(() => activeWriteIncidentRegistry()).toBeNull();
	});

	/**
	 * The THROW arm of that chain's release: a round whose `buildCommand` throws ends the chain in
	 * `commitOnce`'s `finally`, which has to release the hold too — or the teardown after it waits
	 * on a field that has already stopped writing, and keeps a clean record installed.
	 */
	it("releases a field commit's hold when a round throws", async () => {
		const stores = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		const field = useFieldCommit<number, { readonly quantity: number }>({
			canonicalValue: 0,
			buildCommand: () => {
				throw new Error('no command');
			},
			history: trackedHistory(),
			errorMap: {},
			field: 'quantity',
			toUserMessage: (error) => error.code,
			notify: noop,
			logger: recorder,
		});
		field.onInput(1);
		await expect(field.onCommit()).rejects.toThrow('no command');

		stores.dispose();

		expect(activeWriteIncidentRegistry()).toBeNull();
	});
});

function trackedHistory() {
	return withSaveStateTracking(
		{ run: (command) => command.execute(), undo: () => Promise.resolve(ok('wrote')), redo: () => Promise.resolve(ok('wrote')) },
		{ beginSaving: noop, resolveOk: noop, resolveErr: noop, resolveNeutral: noop, markUnrecovered: noop, markVaultPaused: noop },
	);
}

function fieldOver(history: Pick<ReturnType<typeof trackedHistory>, 'run'>, saveFor: (value: number) => ReturnType<typeof slowGuardedSave>) {
	return useFieldCommit<number, { readonly quantity: number }>({
		canonicalValue: 0,
		buildCommand: (value) => ({ execute: saveFor(value).execute, undo: saveFor(value).execute }),
		history,
		errorMap: {},
		field: 'quantity',
		toUserMessage: (error) => error.code,
		notify: noop,
		logger: recorder,
	});
}

/**
 * One field: a first commit in flight, a second value queued behind it (twice — two blurs), then
 * `dispose()` and the first save settling. Resolves once the queued value has reached its guard.
 */
async function queuedBehindDispose() {
	const stores = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
	const inFlight = slowGuardedSave();
	const queued = slowGuardedSave();
	const field = fieldOver(trackedHistory(), (value) => (value === 1 ? inFlight : queued));
	field.onInput(1);
	const first = field.onCommit();
	field.onInput(2);
	void field.onCommit();
	void field.onCommit();

	stores.dispose();
	inFlight.finish(ok('wrote'));
	await first;
	await expect.poll(() => queued.seen.length).toBe(1);
	return { stores, queued };
}
