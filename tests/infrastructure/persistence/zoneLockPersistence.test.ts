import { describe, expect, it } from 'vitest';
import { createMigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { MIGRATION_SET } from '../../../src/infrastructure/persistence/migration/migrationSet';
import { ZoneFrontmatterSchemaV1 } from '../../../src/infrastructure/persistence/dto/zoneFrontmatter';
import {
	zoneFromPersistence,
	zoneToGeometryEntry,
	zoneToPersistence,
} from '../../../src/infrastructure/persistence/mappers/zoneMapper';
import { createRepositoryStack } from '../../helpers/vault';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';

function detachedZone() {
	const project = makeProject();
	return makeZone({ projectId: project.id, planId: makePlan({ projectId: project.id }).id });
}

describe('zone lock persistence (ADR-0027)', () => {
	it('writes v1 with no lock key while unlocked, and v2 with locked: true once locked', () => {
		const zone = detachedZone();
		const unlocked = zoneToPersistence(zone, 1);
		const locked = zoneToPersistence(zone.withLocked(true), 2);
		expect(unlocked['schema-version']).toBe(1);
		expect('locked' in unlocked).toBe(false);
		expect(locked).toMatchObject({ 'schema-version': 2, locked: true });
		// An older build parses only V1, so it refuses a locked note rather than saving the lock away.
		expect(ZoneFrontmatterSchemaV1.safeParse(locked).success).toBe(false);
		expect(expectOk(zoneFromPersistence(locked, zoneToGeometryEntry(zone))).locked).toBe(true);
		expect(expectOk(zoneFromPersistence(unlocked, zoneToGeometryEntry(zone))).locked).toBe(false);
	});

	it('upgrades a v1 note in memory only, and refuses a future version', () => {
		const raw = zoneToPersistence(detachedZone(), 1);
		const before = structuredClone(raw);
		const runner = createMigrationRunner(MIGRATION_SET);
		const latest = runner.migrateToLatest('zone', raw, 1);
		expect(raw).toEqual(before);
		expect(latest).toEqual({ ...raw, 'schema-version': 2 });
		expect(() => runner.migrateToLatest('zone', raw, 3)).toThrow(/newer than this build supports/);
	});

	it('round-trips through the Obsidian repository and removes the key again on unlock', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		const plan = makePlan({ projectId: project.id });
		expectOk(await stack.projects.save(project, 'absent'));
		expectOk(await stack.plans.save(plan, 'absent'));
		const saved = expectOk(await stack.zones.save(makeZone({ projectId: project.id, planId: plan.id }), 'absent'));
		const note = (): string =>
			[...stack.vault.entries.values()].find((text) => text.includes('renovation-zone') && text.includes(saved.entity.id)) ?? '';

		const locked = expectOk(await stack.zones.save(saved.entity.withLocked(true), saved.version));
		expect(expectFound(await stack.zones.getById(saved.entity.id)).entity.locked).toBe(true);
		expect(note()).toMatch(/^locked: true$/m);
		expect(note()).toMatch(/^schema-version: 2$/m);

		expectOk(await stack.zones.save(locked.entity.withLocked(false), locked.version));
		expect(expectFound(await stack.zones.getById(saved.entity.id)).entity.locked).toBe(false);
		expect(note()).not.toMatch(/^locked:/m);
		expect(note()).toMatch(/^schema-version: 1$/m);
	});
});
