import { describe, expect, it } from 'vitest';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import {
	makeAsset as makeAssetEntity,
	makePlan as makePlanEntity,
	makeProject as makeProjectEntity,
	makeRequirement as makeRequirementEntity,
	makeZone as makeZoneEntity,
} from '../../../helpers/entities';
import { MIGRATION_SET } from '../../../../src/infrastructure/persistence/migration/migrationSet';
import type { DiagnosticEntityKind } from '../../../../src/application/ports/diagnostics';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
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

	it('a note with a malformed schema version reports schema-version-malformed', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const path = stack.index.getPath(projectId) ?? '';
		stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: "junk"'));
		const error = expectErr(await stack.projects.getById(projectId));
		expect(error.code).toBe('project.schema-version-malformed');
		expect(error.category).toBe('Validation');
	});

	// SDD §87 rule 7 + §92 item 13: a note from a NEWER build refuses as a Migration
	// error — never a best-effort parse of a shape this build does not know — and the
	// refusal is scoped to that one entity, so the rest of the project still loads.
	it('a future schema version refuses fail-closed while other entities load on', async () => {
		const stack = createRepositoryStack();
		const first = createProjectId();
		const second = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: first }), 'absent'));
		expectOk(await stack.projects.save(makeProjectEntity({ id: second }), 'absent'));
		const futurePath = stack.index.getPath(first) ?? '';
		stack.vault.entries.set(futurePath, (stack.vault.entries.get(futurePath) ?? '').replace('schema-version: 1', 'schema-version: 99'));

		const refused = expectErr(await stack.projects.getById(first));
		expect(refused.category).toBe('Migration');
		expect(refused.code).toBe('project.schema-version-unsupported');
		expectOk(await stack.projects.getById(second));
	});

});

/**
 * SDD §68: a refusal is RECORDED content-free — opaque id + error code — so the diagnostics
 * snapshot can report it without ever holding project data.
 *
 * Every note-backed kind, driven through its REAL repository against a real broken note.
 * Only `project` was covered for two slices, which read as a category and was a sample of
 * one: `ObsidianProjectRepository` records at its own `getById`, while the other four go
 * through `openNoteById` — so the one covered case was the one path the shared helper is
 * NOT on, and whether slice 10's kinds recorded at all was a matter of inspection.
 *
 * It is also where the narrowed `record` signature meets a real caller rather than a fake:
 * the ids below are generated `EntityId`s and the third argument is the repository's own
 * `AppError`, which is the shape `application/ports/diagnostics.ts` refuses free text in.
 */
describe('read refusals reaching the diagnostics ledger', () => {
	/**
	 * One case per kind, and the SET is checked below rather than trusted — the anchor is
	 * the plugin's own migration table, so a seventh entity kind added to `MIGRATION_SET`
	 * makes this file red until its refusal is covered here too.
	 */
	const cases: ReadonlyArray<{
		kind: DiagnosticEntityKind;
		seed: (stack: RepositoryStack) => Promise<EntityId<string>>;
		read: (stack: RepositoryStack, id: EntityId<string>) => Promise<unknown>;
	}> = [
		{
			kind: 'project',
			seed: async (stack) => {
				const id = createProjectId();
				expectOk(await stack.projects.save(makeProjectEntity({ id }), 'absent'));
				return id;
			},
			read: (stack, id) => stack.projects.getById(id as ProjectId),
		},
		{
			kind: 'plan',
			seed: async (stack) => (await seed(stack)).planId,
			read: (stack, id) => stack.plans.getById(id as PlanId),
		},
		{
			kind: 'zone',
			seed: async (stack) => {
				const { projectId, planId } = await seed(stack);
				return expectOk(await stack.zones.save(makeZoneEntity({ projectId, planId }), 'absent')).entity.id;
			},
			read: (stack, id) => stack.zones.getById(id as never),
		},
		{
			kind: 'asset',
			seed: async (stack) =>
				expectOk(await stack.assets.save(makeAssetEntity({ projectId: createProjectId() }), 'absent')).entity.id,
			read: (stack, id) => stack.assets.getById(id as never),
		},
		{
			kind: 'requirement',
			seed: async (stack) => {
				const requirement = makeRequirementEntity({
					projectId: createProjectId(),
					assetId: createAssetId(),
					origin: { kind: 'zone', zoneId: createZoneId() },
				});
				return expectOk(await stack.requirements.save(requirement, 'absent')).entity.id;
			},
			read: (stack, id) => stack.requirements.getById(id as never),
		},
	];

	it.each(cases.map((testCase) => [testCase.kind, testCase] as const))(
		'a refused %s read lands in the ledger as an opaque id and a code',
		async (kind, testCase) => {
			const stack = createRepositoryStack();
			const id = await testCase.seed(stack);
			const path = stack.index.getPath(id) ?? '';
			expect(path).not.toBe('');
			stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: 99'));

			await testCase.read(stack, id);

			expect(stack.ledger.issues()).toEqual([
				{ entityType: kind, entityId: id, issue: `${kind}.schema-version-unsupported` },
			]);
		},
	);

	/**
	 * The instrument, checked before the cases are believed. A table of five is a listing,
	 * and a listing goes stale silently — so it is compared against the runtime table the
	 * plugin actually registers (`MIGRATION_SET`, shared with the composition root), minus
	 * the one kind that is not a note, excluded BY NAME rather than by the list happening not
	 * to mention it.
	 *
	 * **Why `plan-geometry` is excluded, stated as what is true rather than as an absence.**
	 * It is a sidecar: no repository, no `openNoteById` call, and so no path through the one
	 * `ledger.record` site the other five share. It does NOT lack a read refusal —
	 * `PlanGeometryStore` runs `migrations.migrateToLatest('plan-geometry', …)` and turns a
	 * future `schemaVersion` into `mappedMigrationFailure('plan-geometry', cause)`, which is
	 * the same refusal the note-backed kinds produce. That refusal is simply never RECORDED.
	 *
	 * So the gap is real and worth naming rather than papering over: `plan-geometry` appears
	 * in a snapshot's `schemaVersions` and can never appear in its `validationIssues`, so a
	 * user whose geometry sidecar is unreadable sees a diagnostics report that says nothing
	 * about it. Closing it means recording at the sidecar read, which is a change to
	 * `PlanGeometryStore` rather than to this table — and on the day it lands, this exclusion
	 * comes out and the case table gains a sixth entry. An earlier version of this comment
	 * said `plan-geometry` had "no read refusal to record", which the code contradicts.
	 */
	it('covers every migratable kind except the sidecar', () => {
		const noteBacked = Object.keys(MIGRATION_SET).filter((kind) => kind !== 'plan-geometry');
		expect(cases.map((testCase) => testCase.kind).toSorted()).toEqual(noteBacked.toSorted());
	});

	/**
	 * The excluded kind, PINNED as an absence rather than left as a claim in the comment
	 * above — the same shape `tests/build/network-boundary.test.ts` uses for the spellings its
	 * lint rule cannot see, and for the same reason: writing down that a gap exists is not an
	 * endorsement of it, it is what stops the next reader believing the coverage is total.
	 *
	 * Both halves, because the interesting part is that they disagree. The sidecar read DOES
	 * refuse a future `schemaVersion`, with the identical code and category a note read
	 * produces — so "no read refusal" would be false. The ledger stays EMPTY, because
	 * `PlanGeometryStore` is not on the `openNoteById` path where the one `ledger.record` site
	 * for note-backed entities lives.
	 *
	 * This case is expected to be DELETED, not maintained: on the day the sidecar records, it
	 * goes red, the exclusion above comes out, and the case table gains a sixth entry.
	 */
	it('has a plan-geometry refusal that reaches the user and never reaches the ledger', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const path = sidecarPathOf(stack, planId);
		stack.vault.entries.set(
			path,
			JSON.stringify({ planId, revision: 1, unit: 'mm', calibration: null, objects: [], schemaVersion: 99 }),
		);

		const refused = expectErr(await stack.store.read(planId));
		expect(refused.code).toBe('plan-geometry.schema-version-unsupported');
		expect(refused.category).toBe('Migration');

		// The gap. Not an assertion that this is right — an assertion of what is true today.
		expect(stack.ledger.issues()).toEqual([]);
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

	it('an update touches no sidecar at all — a missing one does not fail a rename', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		stack.vault.entries.delete(sidecarPathOf(stack, planId));

		// This used to refuse: the save read the sidecar to sync the calibration field.
		// Since the sidecar owns that field outright (slice 7's review pass), a note update
		// has no reason to open the file — and renaming a plan whose geometry file went
		// missing is not a rename failure. `getById` is what still reports the absence.
		expectOk(await stack.plans.save(
			makePlanEntity({ id: planId, projectId, name: 'Renamed' }),
			read.version,
		));
		expect(expectErr(await stack.plans.getById(planId)).code).toBe('plan.sidecar-unreadable');
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
