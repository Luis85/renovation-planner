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

	it('releases the registry it installed on dispose', () => {
		const stores = new SessionStores(fakeAdapter(), 'plugins/renovation-planner', recorder);
		expect(activeWriteIncidentRegistry()).toBe(stores.writeIncidents);

		stores.dispose();

		expect(activeWriteIncidentRegistry()).toBeNull();
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
