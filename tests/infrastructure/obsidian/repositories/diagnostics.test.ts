import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { versionOfFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/versionCheck';

/**
 * The error paths of the storage layer: every diagnostic the repositories and the
 * geometry store can produce is driven here, so a broken vault answers with precise
 * errors instead of exceptions.
 */

async function seed(stack: RepositoryStack): Promise<{ projectId: ProjectId; planId: PlanId }> {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

function sidecarPathOf(stack: RepositoryStack, planId: PlanId): string {
	return `${stack.projectFolder}/Geometry/${planId}.rpgeo`;
}

describe('plan geometry store diagnostics', () => {
	it('read without an indexed path refuses', async () => {
		const stack = createRepositoryStack();
		const result = await stack.store.read(createPlanId());
		expect(expectErr(result).code).toBe('plan-geometry.path-unresolved');
	});

	it('read of a missing or corrupt sidecar refuses distinctly', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const path = sidecarPathOf(stack, planId);

		stack.vault.entries.delete(path);
		expect(expectErr(await stack.store.read(planId)).code).toBe('plan-geometry.missing');

		stack.vault.entries.set(path, '{ not json');
		expect(expectErr(await stack.store.read(planId)).code).toBe('plan-geometry.corrupt');
	});

	it('a migration gap on old data surfaces as a Migration refusal with the runner\'s own code', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		stack.vault.entries.set(
			sidecarPathOf(stack, planId),
			JSON.stringify({ schemaVersion: 0, planId, revision: 0, unit: 'mm', calibration: null, objects: [] }),
		);
		const result = await stack.store.read(planId);
		expect(!result.ok && result.error.code).toBe('migration.chain-gap');
		expect(!result.ok && result.error.category).toBe('Migration');
	});

	it('a hand-renamed or hand-edited planId refuses at read time (the filename join verified)', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		stack.vault.entries.set(
			sidecarPathOf(stack, planId),
			JSON.stringify({ schemaVersion: 1, planId: `${planId}-imposter`, revision: 1, unit: 'mm', calibration: null, objects: [] }),
		);
		expect(expectErr(await stack.store.read(planId)).code).toBe('plan-geometry.plan-id-mismatch');
	});

	it('mutate write failures surface as write-failed and leave the queue usable', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		stack.vault.failures.add(`modify:${sidecarPathOf(stack, planId)}`);
		const failed = await stack.store.mutate(planId, (dto) => ({ ...dto }));
		expect(expectErr(failed).code).toBe('plan-geometry.write-failed');

		stack.vault.failures.clear();
		expectOk(await stack.store.mutate(planId, (dto) => ({ ...dto })));
	});

	it('delete honours the path hint when the index mapping does not exist yet', async () => {
		const stack = createRepositoryStack();
		const planId = createPlanId();
		const path = sidecarPathOf(stack, planId);
		stack.vault.entries.set(path, '{}');

		await stack.store.delete(planId, path);
		expect(stack.vault.entries.has(path)).toBe(false);

		// And absence is success, never an error.
		expectOk(await stack.store.delete(planId));
	});
});

describe('repository diagnostics', () => {
	it('plan getById reports an unreadable sidecar instead of a bare note', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		stack.vault.entries.delete(sidecarPathOf(stack, planId));

		expect(expectErr(await stack.plans.getById(planId)).code).toBe('plan.sidecar-unreadable');
	});

	it('project getById reports frontmatter-invalid for a domain-refused row', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		stack.vault.entries.set(path, stack.vault.entries.get(path)?.replace('"Kitchen renovation"', '"   "') ?? '');

		expect(expectErr(await stack.projects.getById(projectId)).code).toBe('project.frontmatter-invalid');
	});

	it('zone getById distinguishes a broken sidecar, a broken link, and bad geometry', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		expectOk(await stack.zones.save(zone, 'absent'));

		// A live note whose plan's sidecar became unreadable.
		stack.vault.entries.set(sidecarPathOf(stack, planId), '{ not json');
		expect(expectErr(await stack.zones.getById(zoneId)).code).toBe('zone.sidecar-unreadable');

		// Sidecar fine again, but this zone's entry gone.
		stack.vault.entries.set(sidecarPathOf(stack, planId), JSON.stringify({ schemaVersion: 1, planId, revision: 2, unit: 'mm', calibration: null, objects: [] }));
		expect(expectErr(await stack.zones.getById(zoneId)).code).toBe('zone.geometry-entry-missing');

		// Entry back, but the note's name was wiped to whitespace by hand.
		stack.vault.entries.set(
			sidecarPathOf(stack, planId),
			JSON.stringify({
				schemaVersion: 1,
				planId,
				revision: 2,
				unit: 'mm',
				calibration: null,
				objects: [{ id: zoneId, type: 'polygon', points: [[0, 0], [10, 0], [10, 10]] }],
			}),
		);
		const notePath = stack.index.getPath(zoneId) ?? '';
		stack.vault.entries.set(notePath, stack.vault.entries.get(notePath)?.replace(/"Living room"/, '"   "') ?? '');
		expect(expectErr(await stack.zones.getById(zoneId)).code).toBe('zone.entity-invalid');
	});

	it('zone save refuses pre-write-invalid geometry before touching disk', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		// A Zone entity can never hold non-finite geometry — but the repository still
		// proves its pre-write gate with an object that carries one (a defensive cast).
		const bogus = { ...zone, geometry: { points: [{ x: Number.NaN, y: 0 }, { x: 5, y: 5 }] } } as unknown as typeof zone;

		const result = await stack.zones.save(bogus, 'absent');
		expect(expectErr(result).code).toBe('zone.pre-write-invalid');
		expect(stack.vault.entries.get(sidecarPathOf(stack, planId))?.includes(String(zoneId))).toBe(false);
	});

	/**
	 * The `plan` key present but EMPTIED — the other half of the guard that
	 * completion.test.ts drives with a note that never declared one.
	 *
	 * The expectation is recomputed from the edited note ON PURPOSE. Blanking the value
	 * moves the observation token, so presenting the version the save returned refuses at
	 * the compare-and-swap and never reaches the guard at all. That is what this test used
	 * to do while asserting only `code.startsWith('zone.')`, which
	 * `zone.external-modification` satisfies — so it passed without ever executing the
	 * branch it is named after.
	 */
	it('zone delete reports a note whose plan reference was emptied', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		expectOk(await stack.zones.save(makeZoneEntity({ id: zoneId, projectId, planId }), 'absent'));

		const notePath = stack.index.getPath(zoneId) ?? '';
		stack.vault.entries.set(notePath, stack.vault.entries.get(notePath)?.replace(/plan: "[^"]*"/, 'plan: ""') ?? '');

		const edited = parseFrontmatter(stack.vault.entries.get(notePath) ?? '').frontmatter;
		const current = versionOfFrontmatter(edited);

		expect(expectErr(await stack.zones.delete(zoneId, current)).code).toBe('zone.delete-failed');
	});
});
