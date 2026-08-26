import { describe, expect, it } from 'vitest';
import { makeDeleteZoneCommand } from '../../../helpers/slice10';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	injectedReadFailure,
	observationToken,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makeZone } from '../../../helpers/entities';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';

const wired = () => {
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	return { zones, events, command: makeDeleteZoneCommand(zones, events) };
};

const seed = async (zones: InMemoryZoneRepository) => {
	const zone = makeZone({
		projectId: 'project-seed' as ProjectId,
		planId: 'plan-seed' as PlanId,
	});
	await zones.save(zone, 'absent');
	return zone;
};

describe('DeleteZoneCommand', () => {
	it('deletes and publishes ZoneDeleted with the full payload', async () => {
		const { zones, events, command } = wired();
		const zone = await seed(zones);

		const result = await command.execute({ zoneId: zone.id });
		const payload = expectOk(result);
		expect(payload.zoneId).toBe(zone.id);
		expect(payload.affectedBefore).toEqual([]);
		expect(payload.affectedAfter).toEqual([]);
		expect(await zones.getById(zone.id)).toEqual({ ok: true, value: null });

		expect(events.published).toEqual([
			{
				type: 'ZoneDeleted',
				payload: { zoneId: zone.id, planId: zone.planId, projectId: zone.projectId },
			},
		]);
	});

	it('refuses a missing zone with a ReferenceError', async () => {
		const { events, command } = wired();
		const error = expectErr(await command.execute({ zoneId: 'zone-missing' as never }));
		expect(error).toMatchObject({ category: 'Reference', code: 'zone.zone-not-found' });
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed read rather than a missing zone', async () => {
		const { events } = wired();
		class FailingRead extends InMemoryZoneRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		const error = expectErr(
			await makeDeleteZoneCommand(new FailingRead() as never, events).execute({ zoneId: 'zone-x' as never }),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});

	it('honours a caller-supplied expectation and refuses on mismatch', async () => {
		const { zones, events, command } = wired();
		const zone = await seed(zones);
		const error = expectErr(
			await command.execute({
				zoneId: zone.id,
				expected: { revision: 7, observed: observationToken('stale-token') },
			}),
		);
		expect(error.code).toBe('zone.revision-conflict');
		expect(expectOk(await zones.getById(zone.id))).not.toBeNull();
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed delete', async () => {
		const { events } = wired();
		class FailingDelete extends InMemoryZoneRepository {
			fail = false;
			override delete(id: Parameters<InMemoryZoneRepository['delete']>[0], expected: Parameters<InMemoryZoneRepository['delete']>[1]) {
				if (this.fail) {
					return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
				}
				return super.delete(id, expected);
			}
		}
		const zones = new FailingDelete();
		const zone = await seed(zones);
		zones.fail = true;
		const error = expectErr(
			await makeDeleteZoneCommand(zones, events).execute({ zoneId: zone.id }),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});
});
