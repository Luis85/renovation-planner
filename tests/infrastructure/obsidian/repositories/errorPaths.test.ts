import { describe, expect, it } from 'vitest';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';

/**
 * The failure branches of every repository method — each one a diagnostic a user's
 * broken vault can actually produce, asserted by code so none of them can silently
 * become an exception or a swallowed error.
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

describe('project repository failure branches', () => {
	it('an update whose write fails reports project.write-failed', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const written = expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		stack.vault.failures.add(`modify:${path}`);
		expect(expectErr(await stack.projects.save(makeProjectEntity({ id: projectId }), written.version)).code).toBe('project.write-failed');
	});

	/**
	 * An occupied filename is no longer the way to drive this: the insert steps around a
	 * taken name onto `<name> <id>.md` (see the collision tests in completion.test.ts), so
	 * the refusal this asserts has to come from the `create` call failing, which is the only
	 * thing `project.write-failed` was ever meant to report.
	 */
	it('an insert whose note create fails reports write-failed', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity({ name: 'Collision' });
		stack.vault.failures.add(`create:${stack.projectFolder}/${project.name}.md`);
		expect(expectErr(await stack.projects.save(project, 'absent')).code).toBe('project.write-failed');
	});

	it('a note with an unreadable schema version reports migration-failed', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: "junk"'));
		expect(expectErr(await stack.projects.getById(projectId)).code).toBe('project.migration-failed');
	});
});

describe('plan repository failure branches', () => {
	it('getById reports frontmatter-invalid for a domain-refused row', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const path = stack.index.getPath(planId) ?? '';
		stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('"Ground floor"', '"   "'));
		expect(expectErr(await stack.plans.getById(planId)).code).toBe('plan.frontmatter-invalid');
	});

	it('an update fails when the calibration sync cannot read the sidecar', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		stack.vault.entries.delete(sidecarPathOf(stack, planId));
		const result = await stack.plans.save(
			makePlanEntity({ id: planId, projectId, name: 'Renamed' }),
			read.version,
		);
		expect(expectErr(result).code).toBe('plan.sidecar-unreadable');
	});

	it('a delete whose compensation also fails still reports the original failure and logs it', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		const notePath = stack.index.getPath(planId) ?? '';
		const sidecarPath = sidecarPathOf(stack, planId);

		// The sidecar removal fails; the note restore then fails too.
		stack.vault.failures.add(`delete:${sidecarPath}`);
		stack.vault.failures.add(`create:${notePath}`);
		const result = await stack.plans.delete(planId, read.version);

		expect(expectErr(result).code).toBe('plan.delete-failed');
		expect(stack.logged.some((line) => line.event === 'plan.delete-compensation-failed')).toBe(true);
	});

	it('listByProject skips entries of other kinds without reading them as plans', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		expectOk(await stack.zones.save(zone, 'absent'));

		const plans = expectOk(await stack.plans.listByProject(projectId));
		expect(plans.map((loaded) => loaded.entity.id)).toEqual([planId]);
	});

	it('a failed insert logs when even the sidecar rollback refuses', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const planId = createPlanId();
		const plan = makePlanEntity({ id: planId, projectId, name: 'Blocked' });
		const notePath = `${stack.projectFolder}/Plans/${plan.name}.md`;
		// The note create fails, and the sidecar rollback that should follow fails too.
		stack.vault.failures.add(`create:${notePath}`);
		stack.vault.failures.add(`delete:${sidecarPathOf(stack, planId)}`);

		expect((await stack.plans.save(plan, 'absent')).ok).toBe(false);
		expect(stack.logged.some((line) => line.event === 'plan.insert-compensation-failed')).toBe(true);
	});
});

describe('zone repository failure branches', () => {
	/**
	 * The delete arm of `compensateFailedSidecarWrite`'s sibling in `delete`: the note is
	 * already trashed, the sidecar entry cannot be removed, and the restore that should put
	 * the note back refuses as well. The original failure is what the caller sees — the
	 * compensation failure is a DIAGNOSTIC, and an unasserted log line is a log line nobody
	 * would notice disappearing.
	 *
	 * The update-path twin (`zone.update-compensation-failed`) is deliberately not driven
	 * here: step 3 and the restore both write the note through `modify`, so one injected
	 * failure cannot hit the second without having already failed the first, and the branch
	 * is unreachable through this mechanism rather than merely untested.
	 */
	it('a delete whose note restore also fails reports the sidecar failure and logs the compensation', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		expectOk(await stack.zones.save(makeZoneEntity({ id: zoneId, projectId, planId }), 'absent'));
		const read = expectOk(await stack.zones.getById(zoneId));
		const notePath = stack.index.getPath(zoneId) ?? '';

		// The sidecar mutation fails, so the trashed note must come back; `restoreNote`
		// finds nothing at the path and takes its CREATE branch, which fails too.
		stack.vault.failures.add(`modify:${sidecarPathOf(stack, planId)}`);
		stack.vault.failures.add(`create:${notePath}`);
		const result = await stack.zones.delete(zoneId, read?.version);

		expect(expectErr(result).code).toBe('zone.sidecar-remove-failed');
		expect(stack.logged.some((line) => line.event === 'zone.delete-compensation-failed')).toBe(true);
	});
});

describe('geometry store failure branches', () => {
	it('create over an existing file refuses with create-failed', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const result = await stack.store.create(createPlanId(), sidecarPathOf(stack, planId));
		expect(expectErr(result).code).toBe('plan-geometry.create-failed');
	});

	it('mutate on a plan whose sidecar file vanished refuses instead of recreating blindly', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		stack.vault.entries.delete(sidecarPathOf(stack, planId));
		expect(expectErr(await stack.store.mutate(planId, (dto) => ({ ...dto }))).code).toBe('plan-geometry.missing');
	});
});
