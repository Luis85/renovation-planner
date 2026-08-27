import { describe, expect, it } from 'vitest';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { frontmatterOf, findNoteIdInFolder } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import { MigrationRunner } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { projectFolderOf, sidecarPathFor, zonesFolderFor } from '../../../../src/infrastructure/obsidian/repositories/paths';

/**
 * Slice 4's refusal paths that are DRIVEN THROUGH A REPOSITORY against a behaving fake
 * vault: read, trash and delete failures injected per path, plus the three small helpers
 * whose empty-ish inputs have no repository to reach them through.
 *
 * The scope line matters, because this file and completion.test.ts opened with the same
 * sentence about 'the long tail of slice 4's diagnostics' and accumulated NINE tests that
 * were byte-for-byte the other file's — invisible precisely because neither header said
 * which half of the tail it held. Pure-function edges (tokens, version arithmetic, path
 * spelling) belong beside their unit; what is here needs a vault.
 */

async function seed(stack: RepositoryStack): Promise<{ projectId: ProjectId; planId: PlanId }> {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

function sidecarPathOf(stack: RepositoryStack, projectId: ProjectId, planId: PlanId): string {
	return sidecarPathFor(projectFolderOf(stack.index, projectId) ?? stack.projectFolder, planId);
}

function notePathOf(stack: RepositoryStack, id: string): string {
	return stack.index.getPath(id as never) ?? '';
}

describe('plan repository: update failures and listing', () => {
	it('delete refuses when snapshots cannot be taken or the trash fails', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		const notePath = notePathOf(stack, planId);

		stack.vault.failures.add(`read:${notePath}`);
		expect(expectErr(await stack.plans.delete(planId, read.version)).code).toBe('plan.delete-failed');
		stack.vault.failures.clear();

		stack.vault.failures.add(`read:${sidecarPathOf(stack, projectId, planId)}`);
		expect(expectErr(await stack.plans.delete(planId, read.version)).code).toBe('plan.delete-failed');
		stack.vault.failures.clear();

		stack.vault.failures.add(`delete:${notePath}`);
		expect(expectErr(await stack.plans.delete(planId, read.version)).code).toBe('plan.delete-failed');
		stack.vault.failures.clear();
	});

	it('delete tolerates a vanished sidecar and skips its echo bookkeeping', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		stack.vault.entries.delete(sidecarPathOf(stack, projectId, planId));

		expectOk(await stack.plans.delete(planId, read.version));
		expect(stack.index.getPath(planId)).toBeUndefined();
	});

	it('listByProject propagates read failures', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		stack.vault.entries.set(notePathOf(stack, planId), (stack.vault.entries.get(notePathOf(stack, planId)) ?? '').replace('schema-version: 1', 'schema-version: "junk"'));
		expect((await stack.plans.listByProject(projectId)).ok).toBe(false);
	});
});

describe('project repository: delete and listing failures', () => {
	it('delete refuses when the trash fails, leaving the note intact', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const read = expectOk(await stack.projects.getById(projectId));
		stack.vault.failures.add(`delete:${notePathOf(stack, projectId)}`);
		expect(expectErr(await stack.projects.delete(projectId, read.version)).code).toBe('project.delete-failed');
		expect(expectOk(await stack.projects.getById(projectId))).not.toBeNull();
	});
});

describe('zone repository: remaining refusals', () => {
	it('getById reports malformed versions and frontmatter-invalid distinctly', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		expectOk(await stack.zones.save(makeZoneEntity({ id: zoneId, projectId, planId }), 'absent'));
		const path = notePathOf(stack, zoneId);

		stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: "junk"'));
		const malformed = expectErr(await stack.zones.getById(zoneId));
		expect(malformed.code).toBe('zone.schema-version-malformed');
		expect(malformed.category).toBe('Validation');

		stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('schema-version: "junk"', 'schema-version: 1').replace('"planned"', '"done"'));
		expect(expectErr(await stack.zones.getById(zoneId)).code).toBe('zone.frontmatter-invalid');
	});

	it('delete refuses when the snapshot cannot be taken or the trash fails', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		const written = expectOk(await stack.zones.save(zone, 'absent'));
		const path = notePathOf(stack, zoneId);

		stack.vault.failures.add(`read:${path}`);
		expect(expectErr(await stack.zones.delete(zoneId, written.version)).code).toBe('zone.delete-failed');
		stack.vault.failures.clear();

		stack.vault.failures.add(`delete:${path}`);
		expect(expectErr(await stack.zones.delete(zoneId, written.version)).code).toBe('zone.delete-failed');
		stack.vault.failures.clear();
		expectOk(await stack.zones.getById(zoneId));
	});

	it('a failed insert whose created-note cleanup also fails logs the double fault', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });

		// Derive the fresh note path the way the repository will, then fail BOTH writes.
		const folder = projectFolderOf(stack.index, projectId) ?? stack.projectFolder;
		const plain = `${zonesFolderFor(folder)}/${zone.name}.md`;
		stack.vault.failures.add(`modify:${sidecarPathOf(stack, projectId, planId)}`);
		stack.vault.failures.add(`delete:${plain}`);

		expect((await stack.zones.save(zone, 'absent')).ok).toBe(false);
		expect(stack.logged.some((line) => line.event === 'zone.insert-compensation-failed')).toBe(true);
	});
});

describe('small unit edges', () => {
	/**
	 * Three answers, not two, and the middle one is the reason this test exists: a file
	 * Obsidian has NO cache entry for falls back to what this plugin last wrote there,
	 * because Obsidian populates its cache asynchronously and a note read back in the tick
	 * it was created has no entry at all. A file it HAS parsed and found no frontmatter in
	 * answers empty — never the fallback, or a note whose frontmatter a user deleted would
	 * be served our own stale bytes forever.
	 */
	it('frontmatterOf falls back to the echo window only when there is no cache entry', () => {
		const stack = createRepositoryStack();
		const ghost = { path: 'ghost.md' } as never;

		// No cache entry, nothing written: empty.
		expect(frontmatterOf(stack, ghost)).toEqual({});

		// No cache entry, but this plugin wrote here: what it wrote.
		stack.echo.markFrontmatter('ghost.md', { id: 'p1', 'schema-version': 1 });
		expect(frontmatterOf(stack, ghost)).toEqual({ id: 'p1', 'schema-version': 1 });

		// A PARSED note with no frontmatter: empty, even though the echo has a record. The
		// fake answers a cache object with no `frontmatter` for this, exactly as Obsidian does.
		stack.vault.entries.set('ghost.md', 'plain text, no frontmatter');
		expect(frontmatterOf(stack, ghost)).toEqual({});
	});

	it('findNoteIdInFolder skips files without cached frontmatter', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		stack.vault.entries.set(`${stack.projectFolder}/plain.md`, 'plain text');
		expect(findNoteIdInFolder(stack, stack.vault as never, stack.projectFolder, String(projectId))).not.toBeNull();
		expect(findNoteIdInFolder(stack, stack.vault as never, stack.projectFolder, 'unknown-id')).toBeNull();
	});

	it('registerAll chains every step of one kind', () => {
		const runner = new MigrationRunner();
		runner.registerAll('k', [
			{ fromVersion: 0, toVersion: 1, migrate: (x) => x },
			{ fromVersion: 1, toVersion: 2, migrate: (x) => x },
		]);
		expect(runner.migrateToLatest('k', {}, 0)).toEqual({});
	});
});
