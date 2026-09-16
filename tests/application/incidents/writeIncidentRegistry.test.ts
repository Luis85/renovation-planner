import { beforeEach, describe, expect, it } from 'vitest';
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
});
