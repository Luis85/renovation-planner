import { describe, expect, it } from 'vitest';
import { err } from '../../../../src/core/result/Result';
import { CreateZoneCommand } from '../../../../src/application/commands/zone/CreateZone';
import { ReversibleCreateZoneCommand } from '../../../../src/application/commands/zone/reversible-create-zone-command';
import { ReversibleDeleteZoneCommand } from '../../../../src/application/commands/zone/reversible-delete-zone-command';
import { SessionWriteLedger, type WriteLedger } from '../../../../src/application/editor/WriteLedger';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import type { PersistenceError } from '../../../../src/core/errors/AppError';
import type { ZoneRepository } from '../../../../src/application/ports/ZoneRepository';
import { makeDeleteZoneCommand, zoneUndoDeps } from '../../../helpers/slice10';
import { RecordingEventBus, expectErr, expectOk } from '../../../helpers/domain';
import { makePlan, makeZone, squareAt } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';

/**
 * The error arms of the two zone gesture adapters: a redo whose restore collides with
 * another writer's zone at the same id, an undo whose dispatch fails, and the delete
 * adapter's read refusals.
 */

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

async function wiredCreateAdapter(zones?: ZoneRepository) {
	const plans = new InMemoryPlanRepository();
	const plan = makePlan({ projectId: createProjectId() });
	await plans.save(plan, 'absent');
	const zoneRepo = zones ?? new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	const ledger: WriteLedger = new SessionWriteLedger();
	const command = new ReversibleCreateZoneCommand(
		new CreateZoneCommand(zoneRepo, plans, events),
		makeDeleteZoneCommand(zoneRepo, events),
		zoneRepo,
		ledger,
		{ planId: plan.id, name: 'Living room', zoneType: 'Room', geometry: squareAt() },
	);
	return { plan, zoneRepo, command };
}

describe('ReversibleCreateZoneCommand error arms', () => {
	it('a redo refuses when another zone now occupies the id it restores', async () => {
		const { plan, zoneRepo, command } = await wiredCreateAdapter();

		expectOk(await command.execute());
		const createdId = command.createdZoneId;
		if (createdId === null) throw new Error('expected the creation to record its zone');
		expectOk(await command.undo());

		// Another writer takes the id while this history holds it undone.
		const squatter = makeZone({ id: createdId, projectId: plan.projectId, planId: plan.id });
		expectOk(await zoneRepo.save(squatter, 'absent'));

		const error = expectErr(await command.execute());
		expect(error.category).toBe('Validation');
	});

	it('an undo whose dispatch fails propagates the failure', async () => {
		const inner = new InMemoryZoneRepository();
		let failing = false;
		const zones = Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, {
			getById: async (id: never) => {
				if (failing) return err(injectedPersistenceError()) as never;
				return await inner.getById(id);
			},
		});
		const { command } = await wiredCreateAdapter(zones);

		expectOk(await command.execute());
		failing = true;
		const error = expectErr(await command.undo());
		expect(error.code).toBe('test.injected-failure');
	});
});

describe('ReversibleDeleteZoneCommand read refusals', () => {
	it('answers zone.zone-not-found for an unknown zone', async () => {
		const zones = new InMemoryZoneRepository();
		const adapter = new ReversibleDeleteZoneCommand(
			makeDeleteZoneCommand(zones, new RecordingEventBus()),
			zones,
			new SessionWriteLedger(),
			{ zoneId: createZoneId() },
			zoneUndoDeps(),
		);
		const error = expectErr(await adapter.execute());
		expect(error.code).toBe('zone.zone-not-found');
	});

	it('propagates a failed pre-delete read', async () => {
		const inner = new InMemoryZoneRepository();
		const zones = Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const adapter = new ReversibleDeleteZoneCommand(
			makeDeleteZoneCommand(zones, new RecordingEventBus()),
			zones,
			new SessionWriteLedger(),
			{ zoneId: createZoneId() },
			zoneUndoDeps(),
		);
		const error = expectErr(await adapter.execute());
		expect(error.code).toBe('test.injected-failure');
	});
});
