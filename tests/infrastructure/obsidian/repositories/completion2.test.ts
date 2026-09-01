import { describe, expect, it } from 'vitest';
import { err } from '../../../../src/core/result/Result';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectFound, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { frontmatterOf, type FrontmatterSource } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
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

/**
 * The stack AS the `FrontmatterSource` that seam declares.
 *
 * `RepositoryStack.metadataCache` is `FakeMetadataCache`, which models the one member this
 * seam reads (`getFileCache`) and none of the twenty-odd others Obsidian's `MetadataCache`
 * declares — and `tsconfig.json` deliberately checks tests against the REAL module, so
 * no fake can satisfy that type however faithful it is at the member in question. ONE cast,
 * named, over the one field that needs it, rather than three at the call sites; `echo` is a
 * real `EchoWindow` and is passed through untouched.
 */
const frontmatterSource = (stack: RepositoryStack): FrontmatterSource => ({
	metadataCache: stack.metadataCache as unknown as FrontmatterSource['metadataCache'],
	echo: stack.echo,
});

async function seed(stack: RepositoryStack): Promise<{ projectId: ProjectId; planId: PlanId }> {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

// No `?? stack.projectFolder` fallback: every caller in this file seeds a real project
// first (via `seed()` or its own `stack.projects.save`), so `projectFolderOf` always
// resolves — a fallback that never fires is dead tolerance that would silently
// reconstruct the old flat path the day a caller stops seeding one.
function sidecarPathOf(stack: RepositoryStack, projectId: ProjectId, planId: PlanId): string {
	const folder = projectFolderOf(stack.index, projectId);
	if (folder === undefined) throw new Error(`no folder indexed for project ${projectId}`);
	return sidecarPathFor(folder, planId);
}

function notePathOf(stack: RepositoryStack, id: string): string {
	return stack.index.getPath(id as never) ?? '';
}

describe('plan repository: update failures and listing', () => {
	it('delete refuses when snapshots cannot be taken or the trash fails', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectFound(await stack.plans.getById(planId));
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
		const read = expectFound(await stack.plans.getById(planId));
		stack.vault.entries.delete(sidecarPathOf(stack, projectId, planId));

		expectOk(await stack.plans.delete(planId, read.version));
		expect(stack.index.getPath(planId)).toBeUndefined();
	});

	/**
	 * This case used to be named 'listByProject propagates read failures' and asserted
	 * `ok === false` for exactly this input. That was the behaviour until one bad note stopped
	 * costing the project's whole plan list: `plan.schema-version-malformed` is note-local, so
	 * it is in `SKIPPABLE_PLAN_CODES` and the listing now skips and counts it. The input is
	 * unchanged; the expectation is inverted, deliberately, and the propagating half moved to
	 * the case below.
	 */
	it('listByProject skips a note whose schema-version is malformed, and counts it', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		stack.vault.entries.set(notePathOf(stack, planId), (stack.vault.entries.get(notePathOf(stack, planId)) ?? '').replace('schema-version: 1', 'schema-version: "junk"'));

		const listed = expectOk(await stack.plans.listByProject(projectId));

		expect(listed.loaded).toHaveLength(0);
		expect(listed.refused).toBe(1);
	});

	/**
	 * The fail-closed half of the allowlist, and the arm no fixture can reach through the
	 * production migration table: every code that table can produce is either note-local or
	 * tagged `Migration`. Driven by overriding `getById` on the repository itself — an own
	 * property, which `listByProject`'s own `this.getById` then resolves to — so the code under
	 * test is the real loop and only its per-note read is stood in for.
	 */
	it('listByProject propagates a refusal that is not on the skippable list', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const propagating = Object.assign(Object.create(Object.getPrototypeOf(stack.plans)), stack.plans, {
			getById: () =>
				Promise.resolve(err({ category: 'Persistence', code: 'plan.migration-failed', message: 'Injected.' })),
		}) as typeof stack.plans;

		const refusal = expectErr(await propagating.listByProject(projectId));

		expect(refusal.code).toBe('plan.migration-failed');
	});
});

describe('project repository: delete and listing failures', () => {
	it('delete refuses when the trash fails, leaving the note intact', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const read = expectFound(await stack.projects.getById(projectId));
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
		// `seed()` above always registers the project first, so this always resolves — a
		// `?? stack.projectFolder` fallback here would be the dead tolerance this file's own
		// header refuses.
		const folder = projectFolderOf(stack.index, projectId);
		if (folder === undefined) throw new Error(`no folder indexed for project ${projectId}`);
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
		expect(frontmatterOf(frontmatterSource(stack), ghost)).toEqual({});

		// No cache entry, but this plugin wrote here: what it wrote.
		stack.echo.markFrontmatter('ghost.md', { id: 'p1', 'schema-version': 1 });
		expect(frontmatterOf(frontmatterSource(stack), ghost)).toEqual({ id: 'p1', 'schema-version': 1 });

		// A PARSED note with no frontmatter: empty, even though the echo has a record. The
		// fake answers a cache object with no `frontmatter` for this, exactly as Obsidian does.
		stack.vault.entries.set('ghost.md', 'plain text, no frontmatter');
		expect(frontmatterOf(frontmatterSource(stack), ghost)).toEqual({});
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
