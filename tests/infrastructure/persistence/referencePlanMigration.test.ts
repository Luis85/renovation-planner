import { describe, expect, it } from 'vitest';
import { PLAN_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { MIGRATION_SET } from '../../../src/infrastructure/persistence/migration/migrationSet';
import { createMigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PlanFrontmatterSchemaV1, PlanFrontmatterSchema } from '../../../src/infrastructure/persistence/dto/planFrontmatter';
import { planFromPersistence, planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { makePlan, makeProject } from '../../helpers/entities';
import { expectDefined, expectOk } from '../../helpers/domain';
import { serializeFrontmatter } from '../../../src/infrastructure/obsidian/repositories/noteIo';
import { parseFrontmatter } from '../../helpers/vault';

describe('reference appearance schema upgrade', () => {
	it('upgrades legacy metadata only in memory and preserves its absent appearance and calibration', () => {
		const plan = makePlan({ projectId: makeProject().id, background: { path: 'old.pdf', kind: 'pdf' } }), raw = planToPersistence(plan, 3);
		const before = structuredClone(raw), migrations = createMigrationRunner(MIGRATION_SET);
		const latest = migrations.migrateToLatest('plan', raw, 1);
		expect(raw).toEqual(before); expect(latest).toEqual({ ...raw, 'schema-version': 3 });
		expect(migrations.migrateToLatest('plan', latest, 3)).toEqual(latest);
		const check = PlanFrontmatterSchema.safeParse(latest);
		expect(check.success).toBe(true);
		expect(expectOk(planFromPersistence(latest, null)).background).toEqual({ path: 'old.pdf', kind: 'pdf', page: 1 });
		expect(expectOk(planFromPersistence(raw, null)).background?.appearance).toBeUndefined();
		expect(migrations.lastApplied).toBe('plan: 2 -> 3');
	});
	it('writes v2 for prepared references and prevents a legacy reader from dropping transforms', () => {
		const appearance = { crop: { x: 0, y: 0, width: 300, height: 200 }, rotation: -90, opacity: 0, visible: false, locked: false };
		const plan = makePlan({ projectId: makeProject().id, background: { path: 'source.png', kind: 'image', appearance } });
		const raw = planToPersistence(plan, 9);
		expect(raw['schema-version']).toBe(2); expect(PlanFrontmatterSchemaV1.safeParse(raw).success).toBe(false);
		expect(expectOk(planFromPersistence(parseFrontmatter(serializeFrontmatter(raw)).frontmatter, null)).background).toEqual(plan.background);
		const without = expectOk(plan.withBackground(null)); expect(planToPersistence(without, 10)['schema-version']).toBe(1);
	});
	it('refuses malformed appearance and future versions instead of defaulting silently', () => {
		const raw = planToPersistence(makePlan({ projectId: makeProject().id, background: { path: 'old.png', kind: 'image' } }), 1);
		expect(planFromPersistence({ ...raw, 'schema-version': 2, 'reference-appearance': { crop: 'bad' } }, null)).toMatchObject({ ok: false });
		expect(() => createMigrationRunner(MIGRATION_SET).migrateToLatest('plan', raw, 4)).toThrow(/newer than this build supports/);
		const migration = expectDefined(PLAN_MIGRATIONS[0], 'migration');
		expect(migration.migrate(null)).toBeNull(); expect(migration.migrate('invalid')).toBe('invalid');
	});
});
