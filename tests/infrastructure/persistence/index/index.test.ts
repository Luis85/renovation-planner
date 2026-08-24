import { describe, expect, it } from 'vitest';
import { LATEST_VERSIONS, MigrationRunner, type Migration } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import type { ProjectIndexEntry } from '../../../../src/application/ports/ProjectIndex';

describe('the migration runner', () => {
	const v0toV1: Migration = {
		fromVersion: 0,
		toVersion: 1,
		migrate: (input) => {
			const raw = input as Record<string, unknown>;
			return { ...raw, 'schema-version': 1, renamed: raw['old-name'] };
		},
	};

	it('chains a synthetic v0→v1 migration deterministically', () => {
		const runner = new MigrationRunner();
		runner.register('fixture', v0toV1);
		LATEST_VERSIONS['fixture'] = 1;
		try {
			const input = { 'old-name': 'a' };
			const once = runner.migrateToLatest('fixture', input, 0);
			const twice = runner.migrateToLatest('fixture', input, 0);
			expect(once).toEqual({ 'old-name': 'a', 'schema-version': 1, renamed: 'a' });
			expect(once).toEqual(twice);
		} finally {
			delete LATEST_VERSIONS['fixture'];
		}
	});

	it('refuses a gap in the chain instead of guessing', () => {
		const runner = new MigrationRunner();
		runner.register('gap', { fromVersion: 2, toVersion: 3, migrate: (x) => x });
		LATEST_VERSIONS['gap'] = 3;
		try {
			expect(() => runner.migrateToLatest('gap', {}, 0)).toThrow(/No migration step/);
		} finally {
			delete LATEST_VERSIONS['gap'];
		}
	});

	it('ships with every real kind at version 1 and no steps to run', () => {
		expect(LATEST_VERSIONS['project']).toBe(1);
		expect(LATEST_VERSIONS['plan']).toBe(1);
		expect(LATEST_VERSIONS['zone']).toBe(1);
		expect(LATEST_VERSIONS['plan-geometry']).toBe(1);
		const runner = new MigrationRunner();
		expect(runner.migrateToLatest('zone', { already: 'v1' }, 1)).toEqual({ already: 'v1' });
	});
});

describe('the in-memory project index', () => {
	const projectEntry: ProjectIndexEntry = { id: 'project-a' as never, type: 'renovation-project', path: 'Renovation/Kitchen.md' };
	const planEntry: ProjectIndexEntry = {
		id: 'plan-b' as never,
		type: 'renovation-plan',
		path: 'Renovation/Plans/GF.md',
		projectId: 'project-a' as never,
		geometrySidecarPath: 'Renovation/Geometry/plan-b.rpgeo',
	};
	const zoneEntry: ProjectIndexEntry = {
		id: 'zone-c' as never,
		type: 'renovation-zone',
		path: 'Renovation/Zones/Bath.md',
		projectId: 'project-a' as never,
		planId: 'plan-b' as never,
	};

	it('answers all five lookups', () => {
		const index = new InMemoryProjectIndex();
		index.rebuild([projectEntry, planEntry, zoneEntry]);
		expect(index.getPath('plan-b' as never)).toBe('Renovation/Plans/GF.md');
		expect(index.getGeometrySidecarPath('plan-b' as never)).toBe('Renovation/Geometry/plan-b.rpgeo');
		expect(index.getIdsByType('renovation-zone')).toEqual(['zone-c']);
		expect(index.getIdsByProject('project-a' as never).toSorted()).toEqual(['plan-b', 'project-a', 'zone-c'].filter((x) => x !== 'project-a').toSorted());
		expect(index.getSpatialObjectIdsByPlan('plan-b' as never)).toEqual(['zone-c']);
	});

	it('replaces on upsert without duplicating axis entries, and removes cleanly', () => {
		const index = new InMemoryProjectIndex();
		index.upsert(zoneEntry);
		index.upsert({ ...zoneEntry, path: 'Renovation/Zones/Moved.md', projectId: undefined });
		expect(index.getPath('zone-c' as never)).toBe('Renovation/Zones/Moved.md');
		expect(index.getIdsByType('renovation-zone')).toHaveLength(1);
		expect(index.getIdsByProject('project-a' as never)).toEqual([]);
		index.remove('zone-c' as never);
		expect(index.entries()).toEqual([]);
	});

	it('rebuild converges to the same state an equal sequence of upserts produces', () => {
		const rebuilt = new InMemoryProjectIndex();
		rebuilt.rebuild([projectEntry, planEntry, zoneEntry]);
		const incremental = new InMemoryProjectIndex();
		for (const entry of [projectEntry, planEntry, zoneEntry]) incremental.upsert(entry);
		expect(incremental.entries()).toEqual(rebuilt.entries());
	});
});
