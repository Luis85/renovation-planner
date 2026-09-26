import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import { persistenceError } from '../../../src/application/errors';
import { WRITE_INCIDENT_SCHEMA_VERSION, type WriteIncident } from '../../../src/application/incidents/WriteIncident';
import { WriteIncidentRegistry } from '../../../src/application/incidents/WriteIncidentRegistry';
import type { WriteIncidentStore } from '../../../src/application/ports/WriteIncidentStore';
import { InMemoryWriteIncidentStore } from '../../helpers/InMemoryWriteIncidentStore';
import { lines, recorder, resetRecorder } from '../../helpers/logger';
import { expectOk } from '../../helpers/domain';

/**
 * The in-memory mirror `guardCommand` asks synchronously. Three behaviours, each of which
 * ADR-0034 decides and none of which the type system can hold: seeded at load, a failed
 * durable write does not un-raise, and an unreadable store fails CLOSED.
 */

function stamped(entities: WriteIncident['affected'] = []): PersistenceError & { uncompensatedWrite: WriteIncident['affected'] } {
	return { ...persistenceError('zone.sidecar-write-uncompensated', 'left standing'), uncompensatedWrite: entities };
}

function seededStore(...ids: string[]): InMemoryWriteIncidentStore {
	const store = new InMemoryWriteIncidentStore();
	for (const incidentId of ids) {
		void store.add({
			schemaVersion: WRITE_INCIDENT_SCHEMA_VERSION,
			incidentId,
			raisedAt: '2026-09-16T00:00:00.000Z',
			code: 'plan.write-uncompensated',
			category: 'Persistence',
			affected: [],
		});
	}
	return store;
}

describe('WriteIncidentRegistry', () => {
	beforeEach(resetRecorder);

	it('opens closed and stays closed when the store holds nothing', async () => {
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
		expect(registry.anyOpen()).toBe(false);
		await registry.seed();
		expect(registry.anyOpen()).toBe(false);
	});

	it('is seeded from the store at load, so a previous session closes the gate', async () => {
		const registry = new WriteIncidentRegistry(seededStore('incident-a'), recorder);
		await registry.seed();
		expect(registry.anyOpen()).toBe(true);
	});

	it('treats an incident that names NO entity as fully open', async () => {
		const store = new InMemoryWriteIncidentStore();
		const registry = new WriteIncidentRegistry(store, recorder);
		await registry.record(stamped([]));
		expect(registry.anyOpen()).toBe(true);
		expect(expectOk(await store.list())[0]?.affected).toEqual([]);
	});

	it('carries the refusing error’s code, category and affected entities into the record', async () => {
		const store = new InMemoryWriteIncidentStore();
		const registry = new WriteIncidentRegistry(store, recorder);
		await registry.record(stamped([{ entityKind: 'zone', entityId: 'zone-1' }]));

		const [recorded] = expectOk(await store.list());
		expect(recorded?.code).toBe('zone.sidecar-write-uncompensated');
		expect(recorded?.category).toBe('Persistence');
		expect(recorded?.affected).toEqual([{ entityKind: 'zone', entityId: 'zone-1' }]);
		expect(recorded?.incidentId).toMatch(/^incident-/);
		expect(recorded?.schemaVersion).toBe(WRITE_INCIDENT_SCHEMA_VERSION);
	});

	it('leaves the incident open in memory when the DURABLE write refuses', async () => {
		const refusing: WriteIncidentStore = {
			list: () => Promise.resolve(ok([])),
			add: () => Promise.resolve(err(persistenceError('write-incident.write-failed', 'no'))),
		};
		const registry = new WriteIncidentRegistry(refusing, recorder);

		await registry.record(stamped());

		expect(registry.anyOpen()).toBe(true);
		expect(lines.map((l) => l.event)).toContain('incident.write-failed');
	});

	it('leaves the incident open when the store THROWS rather than refusing', async () => {
		const throwing: WriteIncidentStore = {
			list: () => Promise.resolve(ok([])),
			add: () => Promise.reject(new Error('adapter exploded')),
		};
		const registry = new WriteIncidentRegistry(throwing, recorder);

		await expect(registry.record(stamped())).resolves.toBeUndefined();

		expect(registry.anyOpen()).toBe(true);
		expect(lines.map((l) => l.event)).toContain('incident.write-failed');
	});

	/**
	 * Fix 1's regression: `startPersistence` (`RenovationPlannerPlugin.ts`) is re-entered by
	 * every settings save, ABOVE the `listenersRegistered` guard that stops the rest of that
	 * method from re-running, so `seed()` used to be called again on every save. It re-read
	 * the store and re-pushed the SAME durable incidents onto the open list each time —
	 * invisible because `anyOpen()` only tests `length > 0`, so the count is what has to be
	 * watched. Watched red: without the `seeded` guard in `WriteIncidentRegistry.seed()`, the
	 * store below is asked to `list()` twice and `listCalls` is 2, not 1.
	 */
	it('seeds only once: a second seed() call re-reads nothing', async () => {
		let listCalls = 0;
		const store: WriteIncidentStore = {
			list: () => {
				listCalls += 1;
				return Promise.resolve(ok([
					{
						schemaVersion: WRITE_INCIDENT_SCHEMA_VERSION,
						incidentId: 'incident-a',
						raisedAt: '2026-09-16T00:00:00.000Z',
						code: 'plan.write-uncompensated',
						category: 'Persistence' as const,
						affected: [],
					},
				]));
			},
			add: () => Promise.resolve(ok(undefined)),
		};
		const registry = new WriteIncidentRegistry(store, recorder);

		await registry.seed();
		await registry.seed();

		expect(listCalls).toBe(1);
		expect(registry.anyOpen()).toBe(true);
	});

	it('fails CLOSED when the seeding read itself refuses: unreadable is not empty', async () => {
		const unreadable: WriteIncidentStore = {
			list: () => Promise.resolve(err(persistenceError('write-incident.file-unreadable', 'no'))),
			add: () => Promise.resolve(ok(undefined)),
		};
		const registry = new WriteIncidentRegistry(unreadable, recorder);

		await registry.seed();

		expect(registry.anyOpen()).toBe(true);
		expect(lines.map((l) => l.event)).toContain('incident.seed-failed');
	});

	/**
	 * A release is ONE-SHOT. `whenIdle` tests `held === 0` exactly, so a release called twice
	 * used to count a save that was still running as ended — and let `SessionStores.dispose()`
	 * release the record under it.
	 */
	it('counts a release called twice once, so a save still running keeps it busy', () => {
		const registry = new WriteIncidentRegistry(new InMemoryWriteIncidentStore(), recorder);
		const first = registry.hold();
		const second = registry.hold();
		first();
		first();
		const idle = vi.fn<() => void>();

		registry.whenIdle(idle);
		expect(idle).not.toHaveBeenCalled();

		second();
		expect(idle).toHaveBeenCalledOnce();
	});
});
