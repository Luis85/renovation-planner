import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity, squareAt } from '../../../helpers/entities';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId, type ZoneId } from '../../../../src/domain/zone/ZoneId';
import type { Loaded } from '../../../../src/application/ports/versioning';
import type { Zone } from '../../../../src/domain/zone/Zone';
import { normalizeFolder, plansFolderFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { serializeFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/noteIo';

/**
 * The two-file consistency suite (SDD §42): every compensated sequence driven red by an
 * injected I/O failure, conditional writes checked against what is actually on disk,
 * and the end-to-end reload that IS Increment 3's success criterion.
 */

async function seed(stack: RepositoryStack): Promise<{ projectId: ProjectId; planId: PlanId }> {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

function sidecarPathOf(stack: RepositoryStack, planId: PlanId): string {
	return `${normalizeFolder(stack.projectFolder)}/Geometry/${planId}.rpgeo`;
}

function zoneNoteText(stack: RepositoryStack, zoneId: ZoneId): string | undefined {
	const path = stack.index.getPath(zoneId);
	return path ? stack.vault.entries.get(path) : undefined;
}

describe('compensated sequences', () => {
	it('a failed sidecar write after an UPDATE restores the prior frontmatter bytes', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId: createProjectId(), planId });
		const written = expectOk(await stack.zones.save(zone, 'absent'));

		const moved = makeZoneEntity({ id: zoneId, projectId: zone.projectId, planId, name: 'Moved', geometry: squareAt(5, 5) });
		const before = zoneNoteText(stack, zoneId);
		stack.vault.failures.add(`modify:${sidecarPathOf(stack, planId)}`);

		const result = await stack.zones.save(moved, written.version);
		const failure = expectErr(result);
		expect(failure.code.startsWith('zone.sidecar-')).toBe(true);
		expect(failure.category).toBe('Persistence');
		expect(zoneNoteText(stack, zoneId)).toBe(before);

		// The queue survives the injected failure: the next save gets through — presenting
		// the same expectation, which is still current because the disk was restored.
		stack.vault.failures.clear();
		expectOk(await stack.zones.save(moved, written.version));
	});

	it('a failed sidecar write after an INSERT deletes the created note — not "restores nothing"', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });

		stack.vault.failures.add(`modify:${sidecarPathOf(stack, planId)}`);
		expect((await stack.zones.save(zone, 'absent')).ok).toBe(false);

		// A restore-the-snapshot compensation would pass the update test above while
		// leaving exactly the live-note-without-geometry orphan this case exists to prevent.
		expect(zoneNoteText(stack, zoneId)).toBeUndefined();

		// And no orphan geometry either: the plan's sidecar is back at its pre-save content.
		const sidecar = JSON.parse(stack.vault.entries.get(sidecarPathOf(stack, planId)) ?? '{}');
		expect(sidecar.objects).toEqual([]);
	});

	it('a failed sidecar removal after the note was deleted restores the note bytes', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		const written = expectOk(await stack.zones.save(zone, 'absent'));
		const before = zoneNoteText(stack, zoneId);

		stack.vault.failures.add(`modify:${sidecarPathOf(stack, planId)}`);
		const deleted = await stack.zones.delete(zoneId, written.version);
		expect(deleted.ok).toBe(false);

		// A caller whose Result is an error must be able to trust that NOTHING was deleted.
		expect(zoneNoteText(stack, zoneId)).toBe(before);
		expectOk(await stack.zones.getById(zoneId));

		stack.vault.failures.clear();
		expectOk(await stack.zones.delete(zoneId, written.version));
	});

	it('a failed note write after the sidecar was created (plan INSERT) deletes the sidecar', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		const plan = makePlanEntity({ id: planId, projectId, name: 'Collision' });
		// Force the note-create to fail. NOT by occupying the derived path any more: an
		// insert now steps around a taken filename onto `<name> <id>.md` and succeeds, which
		// is the point of that fallback — so this drives the failure at the `create` call
		// itself, which is what the compensation is actually about.
		const notePath = `${plansFolderFor(normalizeFolder(stack.projectFolder))}/${plan.name}.md`;
		stack.vault.failures.add(`create:${notePath}`);

		expect((await stack.plans.save(plan, 'absent')).ok).toBe(false);
		expect(stack.vault.entries.get(sidecarPathOf(stack, planId))).toBeUndefined();
	});

	it('a failed sidecar removal during plan DELETE restores the note bytes', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const planNotePath = stack.index.getPath(planId);
		const before = planNotePath ? stack.vault.entries.get(planNotePath) : undefined;

		stack.vault.failures.add(`delete:${sidecarPathOf(stack, planId)}`);
		const read = expectOk(await stack.plans.getById(planId));
		const result = await stack.plans.delete(planId, read.version);

		expect(expectErr(result).code).toBe('plan.delete-failed');
		expect(planNotePath ? stack.vault.entries.get(planNotePath) : undefined).toBe(before);
	});
});

describe('conditional writes against real files', () => {
	it('refuses a save whose expectation predates an out-of-band edit, even after another read ran (interleaved reader)', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		const firstRead = expectOk(await stack.zones.save(zone, 'absent'));

		// A reads; the note is edited out of band; a SECOND read runs; then A saves with A's version.
		const path = stack.index.getPath(zoneId) ?? '';
		const parsed = parseFrontmatter(stack.vault.entries.get(path) ?? '');
		parsed.frontmatter['name'] = 'Hand edited';
		stack.vault.entries.set(path, `${serializeFrontmatter(parsed.frontmatter)}${parsed.body}`);

		const secondRead = expectOk(await stack.zones.getById(zoneId));
		expect(secondRead?.entity.name).toBe('Hand edited');

		// An implementation keeping one CURRENT digest per entity would let this through.
		const stale = await stack.zones.save(
			makeZoneEntity({ id: zoneId, projectId, planId, name: 'A speaks anyway' }),
			firstRead.version,
		);
		expect(expectErr(stale).code).toBe('zone.external-modification');
		expect(expectOk(await stack.zones.getById(zoneId))?.entity.name).toBe('Hand edited');

		// The CURRENT reader may speak: B presents exactly what B saw.
		const bVersion: Loaded<Zone>['version'] = secondRead.version;
		expect((await stack.zones.save(makeZoneEntity({ id: zoneId, projectId, planId, name: 'B renames' }), bVersion)).ok).toBe(true);
	});

	/**
	 * DoD 5b's other half — body prose and undeclared frontmatter keys neither refusing the
	 * next save nor being erased by it — used to be driven HERE, for the Zone repository
	 * alone, under a title that read as a category. It is
	 * `tests/infrastructure/obsidian/repositories/preservation.test.ts` now: the guarantee
	 * belongs to `writeOwnedFrontmatter` and `observeFrontmatter`, which five repositories
	 * and `markStale` share, so one entity's case was a sample of six.
	 * `tests/.../digest.test.ts` still pins the token function itself against both.
	 */

	it('the sidecar honours expected versions: absent applies, stale refuses, hand edits refuse', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);

		const first = expectOk(await stack.store.mutate(planId, (dto) => ({ ...dto, objects: [...dto.objects] })));
		expect(first.version.revision).toBeGreaterThanOrEqual(2);

		const sidecarPath = sidecarPathOf(stack, planId);
		const before = stack.vault.entries.get(sidecarPath) ?? '';

		// Revision matches; the FILE does not — trailing whitespace is still a hand touch
		// of a registered, openable file, which is what the raw-text token exists to catch.
		stack.vault.entries.set(sidecarPath, `${before}\n`);
		const snapshotBefore = stack.vault.entries.get(sidecarPath);
		const refused = await stack.store.mutate(planId, (dto) => dto, first.version);
		expect(expectErr(refused).code).toBe('plan-geometry.external-modification');
		expect(stack.vault.entries.get(sidecarPath)).toBe(snapshotBefore);

		// Without an expectation, the change applies to whatever is current.
		const applied = expectOk(await stack.store.mutate(planId, (dto) => ({ ...dto, unit: 'mm' })));
		expect(applied.version.revision).toBeGreaterThan(first.version.revision);
	});

	it('round-trips the revision fields themselves through disk', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		const written = expectOk(await stack.zones.save(zone, 'absent'));
		expect(written.version.revision).toBe(1);

		// Against the persisted bytes: an undeclared key would be stripped silently, so
		// this asserts the schema DECLARES the field.
		const noteText = zoneNoteText(stack, zoneId) ?? '';
		expect(parseFrontmatter(noteText).frontmatter['revision']).toBe(1);
		const sidecar = JSON.parse(stack.vault.entries.get(sidecarPathOf(stack, planId)) ?? '{}');
		expect(sidecar.revision).toBe(2);

		const reread = expectOk(await stack.zones.getById(zoneId));
		expect(reread.version.revision).toBe(1);
	});
});

describe('concurrency', () => {
	it('two unawaited zone saves for one plan both land in the sidecar', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneA = makeZoneEntity({ id: createZoneId(), projectId, planId, name: 'A' });
		const zoneB = makeZoneEntity({ id: createZoneId(), projectId, planId, name: 'B' });

		// Issued WITHOUT awaiting the first, driven at the repository — the guarantee must
		// hold for every writer, not only callers that serialize.
		const [resultA, resultB] = await Promise.all([
			stack.zones.save(zoneA, 'absent'),
			stack.zones.save(zoneB, 'absent'),
		]);
		expectOk(resultA);
		expectOk(resultB);

		const sidecar = JSON.parse(stack.vault.entries.get(sidecarPathOf(stack, planId)) ?? '{}');
		expect(sidecar.objects.map((o: { id: string }) => o.id).toSorted()).toEqual([zoneA.id, zoneB.id].toSorted());
	});
});

describe('immediate usability and location', () => {
	it('a freshly saved Plan is usable without waiting for the vault-change pipeline', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));

		expect(expectOk(await stack.plans.getById(planId))?.entity.id).toBe(planId);

		const zone = makeZoneEntity({ id: createZoneId(), projectId, planId });
		expectOk(await stack.zones.save(zone, 'absent'));
		expect(expectOk(await stack.zones.listByPlan(planId))).toHaveLength(1);
	});

	it('writes sidecars under <project folder>/Geometry/, keyed by the full plan ID', async () => {
		const stack = createRepositoryStack('Somewhere/My Renovation');
		const planId = createPlanId();
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId: createProjectId() }), 'absent'));
		expect(stack.vault.entries.has(`Somewhere/My Renovation/Geometry/${planId}.rpgeo`)).toBe(true);
	});

	it('keeps two projects in two folders isolated', async () => {
		const stackA = createRepositoryStack('Projects/A');
		const stackB = createRepositoryStack('Projects/B');
		const planA = makePlanEntity({ id: createPlanId(), projectId: createProjectId() });
		const planB = makePlanEntity({ id: createPlanId(), projectId: createProjectId() });
		expectOk(await stackA.plans.save(planA, 'absent'));
		expectOk(await stackB.plans.save(planB, 'absent'));

		// `entries` is a Map, so `Object.keys` over it answers `[]` and every `some` on that
		// is false — an earlier version of these two assertions passed for that reason and
		// would have passed with the isolation broken. Read the keys through the Map's own
		// iterator, and prove the instrument SEES something before trusting what it denies.
		const pathsA = [...stackA.vault.entries.keys()];
		const pathsB = [...stackB.vault.entries.keys()];
		expect(pathsA.some((p) => p.includes(String(planA.id)))).toBe(true);
		expect(pathsB.some((p) => p.includes(String(planB.id)))).toBe(true);

		expect(pathsA.some((p) => p.includes(String(planB.id)))).toBe(false);
		expect(pathsB.some((p) => p.includes(String(planA.id)))).toBe(false);
	});
});

describe('unload and reload (Increment 3)', () => {
	it('project, plan, and zone survive discarding all in-memory state and rebuilding the index', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		const zoneId = createZoneId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId, name: 'Riverside' }), 'absent'));
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId, name: 'Ground Floor', layers: ['Walls'] }), 'absent'));
		const zone = makeZoneEntity({ id: zoneId, projectId, planId, name: 'Bathroom' });
		expectOk(await stack.zones.save(zone, 'absent'));

		const beforeProject = expectOk(await stack.projects.getById(projectId));
		const beforePlan = expectOk(await stack.plans.getById(planId));
		const beforeZone = expectOk(await stack.zones.getById(zoneId));

		// Unload: the index is pure derived data — drop it entirely, rebuild from the Vault.
		stack.index.rebuild([]);
		stack.rebuildIndex();

		const afterProject = expectOk(await stack.projects.getById(projectId));
		const afterPlan = expectOk(await stack.plans.getById(planId));
		const afterZone = expectOk(await stack.zones.getById(zoneId));

		expect(afterProject?.entity).toEqual(beforeProject?.entity);
		expect(afterPlan?.entity).toEqual(beforePlan?.entity);
		expect(afterZone?.entity).toEqual(beforeZone?.entity);
		// Versions survive too: a caller reloaded mid-session holds valid expectations.
		expect(afterZone?.version.revision).toBe(beforeZone?.version.revision);
	});
});

// Keep expectErr referenced: it documents that these paths are error-shaped assertions.
void expectErr;
