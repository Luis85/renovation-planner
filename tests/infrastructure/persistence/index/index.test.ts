import { describe, expect, it } from 'vitest';
import { createMigrationRunner, MigrationRunner, type Migration } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import type { ProjectIndexEntry } from '../../../../src/application/ports/ProjectIndex';
import { createRepositoryStack, serializeFrontmatter } from '../../../helpers/vault';

describe('the migration runner', () => {
	const v0toV1: Migration = {
		fromVersion: 0,
		toVersion: 1,
		migrate: (input) => {
			const raw = input as Record<string, unknown>;
			return { ...raw, 'schema-version': 1, renamed: raw['old-name'] };
		},
	};
	const v1toV2: Migration = { fromVersion: 1, toVersion: 2, migrate: (input) => input };

	it('chains a synthetic v0→v1 migration deterministically', () => {
		const runner = new MigrationRunner();
		runner.register('fixture', v0toV1);
		const input = { 'old-name': 'a' };
		const once = runner.migrateToLatest('fixture', input, 0);
		const twice = runner.migrateToLatest('fixture', input, 0);
		expect(once).toEqual({ 'old-name': 'a', 'schema-version': 1, renamed: 'a' });
		expect(once).toEqual(twice);
	});

	it('refuses a gap in the chain instead of guessing', () => {
		const runner = new MigrationRunner();
		runner.register('gap', { fromVersion: 2, toVersion: 3, migrate: (x) => x });
		expect(() => runner.migrateToLatest('gap', {}, 0)).toThrow(/No migration step/);
	});

	// SDD §87 rule 7, fail closed: a FUTURE version must be refused as its own defect —
	// not fall through the loop and reach Zod, whose literal mismatch would report the
	// wrong failure ("frontmatter-invalid") for what is really "this build is too old".
	it('refuses a version newer than this build supports with a tagged Migration error', () => {
		const runner = new MigrationRunner();
		runner.registerAll('future', []);
		const thrown = (() => {
			try {
				runner.migrateToLatest('future', { 'schema-version': 2 }, 2);
				return null;
			} catch (cause) {
				return cause as Error & { code: string; category: 'Migration' };
			}
		})();
		expect(thrown).not.toBeNull();
		expect(thrown?.code).toBe('future.schema-version-unsupported');
		expect(thrown?.category).toBe('Migration');
		expect(thrown?.message).toMatch(/newer than this build supports/);
	});

	/**
	 * The MECHANISM behind `GetDiagnosticsSnapshot.schemaVersions`, which is the whole
	 * reason `latestVersions` is derived rather than declared: the versions the runner
	 * reports are exactly the kinds its registration table names, at exactly the version
	 * their steps reach.
	 *
	 * This case used to be "ships with every real kind at version 1 and no steps to run",
	 * and it listed four of the six kinds that existed — a title claiming a category while
	 * checking a hand-written subset, which is the listing defect this repository keeps
	 * paying for. The real kind SET is asserted in exactly one place now, and it is not
	 * here: `tests/plugin/persistence-wiring.test.ts` asks the real composition root for a
	 * real snapshot, so it cannot go stale against a constant a test edited for itself.
	 * What is left here is the rule that makes that one assertion sufficient, driven
	 * through a fixture table so a seventh kind needs no edit to this file.
	 */
	it('reports a version for exactly the kinds its registration table names', () => {
		const runner = createMigrationRunner({ stepless: [], stepped: [v0toV1, v1toV2] });
		expect(runner.latestVersions).toEqual({ stepless: 1, stepped: 2 });
		// A kind with no steps is at version 1 and has nothing to run — the state every
		// real shape ships in today.
		expect(runner.migrateToLatest('stepless', { already: 'v1' }, 1)).toEqual({ already: 'v1' });
	});

	/**
	 * The floor, and the arm the derivation's docblock claims: 1 is what a kind with no
	 * steps is at, and an UNREGISTERED kind answers the same, which keeps `migrateToLatest`
	 * total rather than needing a defensive throw for a kind nobody named. Asserted rather
	 * than described — the accessor reads `this.byKind.get(kind) ?? []` twice and both
	 * fallbacks are only reachable this way, so a comment was the only thing saying what
	 * happens here.
	 */
	it('passes an unregistered kind through at version 1, and still refuses a future one', () => {
		const runner = new MigrationRunner();
		expect(runner.migrateToLatest('never-registered', { a: 1 }, 1)).toEqual({ a: 1 });
		// Not in the version table either: `latestVersions` reports what was registered.
		expect(runner.latestVersions).toEqual({});
		expect(() => runner.migrateToLatest('never-registered', {}, 2)).toThrow(/newer than this build supports/);
	});

	// SDD §68's migrationState.lastApplied: content-free ("kind: from -> to"), null until
	// a step actually ran, and never persisted.
	it('tracks the last applied step, content-free', () => {
		const runner = new MigrationRunner();
		expect(runner.lastApplied).toBeNull();
		runner.register('fixture', v0toV1);
		runner.migrateToLatest('fixture', { 'old-name': 'a' }, 0);
		expect(runner.lastApplied).toBe('fixture: 0 -> 1');
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

	it('indexes a note of ours that sits outside the configured folder', () => {
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set(
			'Somewhere Else/Kitchen/Project.md',
			serializeFrontmatter({ type: 'renovation-project', id: 'p-outside', 'schema-version': 1 }),
		);
		stack.metadataCache.catchUp();

		stack.rebuildIndex();

		expect(stack.index.getPath('p-outside' as never)).toBe('Somewhere Else/Kitchen/Project.md');
	});

	it('joins a sidecar that sits outside the configured folder', () => {
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set(
			'Elsewhere/Plans/Ground floor.md',
			serializeFrontmatter({ type: 'renovation-plan', id: 'pl-outside', 'schema-version': 1 }),
		);
		stack.vault.entries.set('Elsewhere/Geometry/pl-outside.rpgeo', '{}');
		stack.metadataCache.catchUp();

		stack.rebuildIndex();

		expect(stack.index.getGeometrySidecarPath('pl-outside' as never)).toBe(
			'Elsewhere/Geometry/pl-outside.rpgeo',
		);
	});

	it('rebuild converges to the same state an equal sequence of upserts produces', () => {
		const rebuilt = new InMemoryProjectIndex();
		rebuilt.rebuild([projectEntry, planEntry, zoneEntry]);
		const incremental = new InMemoryProjectIndex();
		for (const entry of [projectEntry, planEntry, zoneEntry]) incremental.upsert(entry);
		expect(incremental.entries()).toEqual(rebuilt.entries());
	});
});
