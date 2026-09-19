import { afterEach, describe, expect, it } from 'vitest';
import { SessionStores } from '../../src/plugin/sessionStores';
import { activeWriteIncidentRegistry, installWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import type { TextFileAdapter } from '../../src/infrastructure/obsidian/plugin-data/SequenceMarkerFileStore';
import { recorder, resetRecorder } from '../helpers/logger';

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
	 * the branch lives. `onunload` unmounts no Vue app and detaches no leaf, so a released
	 * registry disarms `guardCommand`'s refusal arm, `withIncidentGate`'s `paused()` and the
	 * recording arm over views that are still mounted and still dispatching.
	 * `tests/plugin/unloadWithViewOpen.test.ts` drives that consequence through the plugin's own
	 * view factory; this case pins the decision the consequence rests on.
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
});
