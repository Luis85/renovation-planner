import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectFound, expectOk } from '../../../helpers/domain';
import {
	makeAsset as makeAssetEntity,
	makePlan as makePlanEntity,
	makeProject as makeProjectEntity,
	makeRequirement as makeRequirementEntity,
	makeZone as makeZoneEntity,
} from '../../../helpers/entities';
import { MIGRATION_SET } from '../../../../src/infrastructure/persistence/migration/migrationSet';
import { versionOfFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/versionCheck';
import type { DiagnosticEntityKind } from '../../../../src/application/ports/diagnostics';
import type { AppError } from '../../../../src/core/errors/AppError';
import type { Result } from '../../../../src/core/result/Result';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { createAssetId, type AssetId } from '../../../../src/domain/asset/AssetId';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { projectFolderOf, sidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { ObsidianAssetPriceOverrideRepository } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetPriceOverrideRepository';
import { makeOverride } from '../../../contracts/asset-price-override-repository.contract';

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

/**
 * Folder resolution goes through the index now (ADR-0013), so an Asset or a Requirement
 * needs a REAL, registered project underneath it — a bare `createProjectId()` used to be
 * enough because both repositories read the shared setting out of `NoteVaultDeps` instead.
 * Left unregistered, a save against it refuses with `*.project-folder-unresolved` before
 * reaching the behaviour each case below actually names.
 */
async function seedProject(stack: RepositoryStack): Promise<ProjectId> {
	const projectId = createProjectId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	return projectId;
}

/**
 * A note from a build this one predates, planted in a vault that otherwise loads: the
 * exact input SDD §92 item 13's word "unsupported" names. Rewriting the field on disk
 * rather than through a repository is the point — no writer in this plugin can produce
 * it, and a user's synced vault can.
 */
function plantFutureSchemaVersion(stack: RepositoryStack, id: EntityId<string>): void {
	const path = stack.index.getPath(id) ?? '';
	expect(path).not.toBe('');
	stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: 99'));
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
		// Under ADR-0013 a new project's note is created inside ITS OWN folder — derived from
		// the same name — rather than directly under the shared root.
		stack.vault.failures.add(`create:${stack.projectFolder}/${project.name}/${project.name}.md`);
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

	// SDD §87 rule 7 + §92 item 13 — a note from a NEWER build refuses as a Migration
	// error, and the refusal is scoped to that one entity — used to be driven HERE, for
	// `project` alone. It is the per-kind table below now ("the fail-closed gate is scoped
	// to one entity"): the gate is `migrateNote`'s, which every note-backed repository
	// shares, so one kind was a sample of five and the OTHER FOUR had never had their
	// `unsupported` half driven at all. Four, not "the four slice-10 kinds", which is what
	// this said and which conflated two counts: slice 10 added TWO of them (asset and
	// requirement) and plan and zone predate it. The narrower claim, about slice 10's two
	// alone, is the one the table's own docblock below makes.
});

/**
 * The one case whose `read` cannot be an id-keyed `getById` — the port deliberately has
 * none (see `AssetPriceOverrideRepository`'s own header). `seed` may run TWICE for one case
 * (the scoped-gate suite below seeds a poisoned entity and a healthy sibling before reading
 * either back), so a single closed-over pair is not enough — it is keyed by the id `seed`
 * returns, the same id `read` is later asked about. A fresh
 * `ObsidianAssetPriceOverrideRepository` per call rather than one held across `seed` and
 * `read`: both are handed the SAME `stack` by the caller below, so a fresh instance over
 * `stack.deps` reads what the other just wrote.
 */
function assetPriceCase(): {
	kind: DiagnosticEntityKind;
	seed: (stack: RepositoryStack) => Promise<EntityId<string>>;
	read: (stack: RepositoryStack, id: EntityId<string>) => Promise<Result<unknown, AppError>>;
} {
	const pairs = new Map<EntityId<string>, { projectId: ProjectId; assetId: AssetId }>();
	return {
		kind: 'asset-price',
		seed: async (stack) => {
			const projectId = await seedProject(stack);
			const assetId = createAssetId();
			const overrides = new ObsidianAssetPriceOverrideRepository(stack.deps);
			const saved = expectOk(await overrides.save(makeOverride(projectId, assetId), 'absent'));
			pairs.set(saved.entity.id, { projectId, assetId });
			return saved.entity.id;
		},
		read: (stack, id) => {
			const pair = pairs.get(id);
			if (pair === undefined) throw new Error(`asset-price seed must run before read for ${id}`);
			return new ObsidianAssetPriceOverrideRepository(stack.deps).getForPair(pair.projectId, pair.assetId);
		},
	};
}

/**
 * One case per note-backed kind — seed a real entity through its real repository, and
 * read it back through the same one. TWO suites below drive this list, because slice
 * 11 makes two claims about the same broken note and neither implies the other: that
 * the refusal is RECORDED content-free (§68), and that it is SCOPED to that entity
 * (§92 item 13). Both were covered for `project` alone.
 *
 * The SET is checked rather than trusted — the anchor is the plugin's own migration
 * table, so a seventh entity kind added to `MIGRATION_SET` makes this file red until
 * its refusal is covered here too.
 */
const NOTE_BACKED_CASES: ReadonlyArray<{
	kind: DiagnosticEntityKind;
	seed: (stack: RepositoryStack) => Promise<EntityId<string>>;
	read: (stack: RepositoryStack, id: EntityId<string>) => Promise<Result<unknown, AppError>>;
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
		// No project seeded: an asset's folder is the library's since design slice 19, so
		// there is nothing for the save to resolve out of the index.
		seed: async (stack) => expectOk(await stack.assets.save(makeAssetEntity(), 'absent')).entity.id,
		read: (stack, id) => stack.assets.getById(id as never),
	},
	{
		kind: 'requirement',
		seed: async (stack) => {
			const projectId = await seedProject(stack);
			const requirement = makeRequirementEntity({
				projectId,
				assetId: createAssetId(),
				origin: { kind: 'zone', zoneId: createZoneId() },
			});
			return expectOk(await stack.requirements.save(requirement, 'absent')).entity.id;
		},
		read: (stack, id) => stack.requirements.getById(id as never),
	},
	assetPriceCase(),
];

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
	it.each(NOTE_BACKED_CASES.map((testCase) => [testCase.kind, testCase] as const))(
		'a refused %s read lands in the ledger as an opaque id and a code',
		async (kind, testCase) => {
			const stack = createRepositoryStack();
			const id = await testCase.seed(stack);
			plantFutureSchemaVersion(stack, id);

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
		expect(NOTE_BACKED_CASES.map((testCase) => testCase.kind).toSorted()).toEqual(noteBacked.toSorted());
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
		const { projectId, planId } = await seed(stack);
		const path = sidecarPathOf(stack, projectId, planId);
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

/**
 * SDD §92 item 13, both halves, for every kind that has a repository: an entity whose
 * `schema-version` this build does not support refuses to load with a typed error rather
 * than a best-effort parse — and the refusal is SCOPED to that entity, so a sibling of the
 * same kind in the same vault still loads.
 *
 * The scoping half is what was a sample of one. It was driven for `project` alone, and for
 * the two slice-10 kinds not at all: `slice10ErrorPaths.test.ts` covers
 * `schema-version-MALFORMED` for both, which is the `ValidationError` `migrateNote` raises
 * BEFORE any chain runs — a different arm of a different function from the `MigrationError`
 * the word "unsupported" names, and the only one of the two that reaches the runner.
 *
 * The sibling is read back with the SAME closure that refused, so a case that quietly
 * refuses everything of its kind cannot pass: the read is the repository's, and the entity
 * it answers with is identified by id.
 */
describe('the fail-closed gate is scoped to one entity', () => {
	it.each(NOTE_BACKED_CASES.map((testCase) => [testCase.kind, testCase] as const))(
		'a future-version %s refuses as a Migration error while its sibling loads on',
		async (kind, testCase) => {
			const stack = createRepositoryStack();
			const poisoned = await testCase.seed(stack);
			const healthy = await testCase.seed(stack);
			expect(poisoned).not.toBe(healthy);
			plantFutureSchemaVersion(stack, poisoned);

			const refused = await testCase.read(stack, poisoned);
			// `ok` first: `expectErr` on an ok Result throws its own message, which reads as
			// a broken test rather than as a gate that stopped refusing.
			expect(refused.ok).toBe(false);
			const error = expectErr(refused);
			expect(error.category).toBe('Migration');
			expect(error.code).toBe(`${kind}.schema-version-unsupported`);

			const sibling = expectOk(await testCase.read(stack, healthy)) as { entity: { id: string } } | null;
			expect(sibling?.entity.id).toBe(healthy);
		},
	);

	/**
	 * The OTHER edge of the same gate, pinned as what is true today rather than left as a
	 * claim in a comment — the same shape as the `plan-geometry` case above. `migrateNote`
	 * is on the READ path only: every save resolves its note through the index (`fileAt` +
	 * `versionOfFrontmatter`) and never runs the runner, so "refuses to load" is checked and
	 * "refuses to write over" is not.
	 *
	 * What stands between a future-version note and this build's shape is therefore only
	 * that every command LOADS before it saves, and that the poisoned `schema-version` is an
	 * OWNED key — so an expectation taken before the poisoning refuses as an external
	 * modification. A writer holding a CURRENT expectation, which is what every save path
	 * mints for itself, meets no gate at all. No command does that today; this case is what
	 * makes the day one does visible, and it goes red — correctly — when the gate moves into
	 * the save path.
	 */
	it('is a READ gate: a save holding a current expectation overwrites a future-version note', async () => {
		const stack = createRepositoryStack();
		const asset = makeAssetEntity();
		expectOk(await stack.assets.save(asset, 'absent'));
		plantFutureSchemaVersion(stack, asset.id);
		expect(expectErr(await stack.assets.getById(asset.id)).code).toBe('asset.schema-version-unsupported');

		const path = stack.index.getPath(asset.id) ?? '';
		const current = parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter;
		expectOk(await stack.assets.save(asset, versionOfFrontmatter(current)));

		// The newer build's note now carries this build's version, and nothing refused.
		expect(parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter['schema-version']).toBe(1);
	});

	/**
	 * The other half of the same narrowing, and the half `migrateNote`'s docblock used to
	 * DENY: a delete is a write, and it does come through the read gate. `trashNoteBackedEntity`
	 * opens the note before it checks the expected version, so a note from a build this one
	 * predates can be neither loaded nor removed from inside the plugin.
	 *
	 * Asserted rather than described, because the docblock describing it was wrong for a whole
	 * slice. The refusal itself is deliberate — trashing a note this build cannot parse is not
	 * obviously safer than refusing — so this case pins behaviour that is meant to stay.
	 */
	it('refuses to DELETE a future-version note, not only to load one', async () => {
		const stack = createRepositoryStack();
		const asset = makeAssetEntity();
		const written = expectOk(await stack.assets.save(asset, 'absent'));
		plantFutureSchemaVersion(stack, asset.id);

		const refusal = expectErr(await stack.assets.delete(asset.id, written.version));

		expect(refusal.code).toBe('asset.schema-version-unsupported');
		// Still there: the refusal is a refusal, not a partial delete.
		expect(stack.index.getPath(asset.id)).not.toBe(null);
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
		const read = expectFound(await stack.plans.getById(planId));
		stack.vault.entries.delete(sidecarPathOf(stack, projectId, planId));

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
		const { projectId, planId } = await seed(stack);
		const read = expectFound(await stack.plans.getById(planId));
		const notePath = stack.index.getPath(planId) ?? '';
		const sidecarPath = sidecarPathOf(stack, projectId, planId);

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

		const plans = expectOk(await stack.plans.listByProject(projectId)).loaded;
		expect(plans.map((loaded) => loaded.entity.id)).toEqual([planId]);
	});

	it('a failed insert logs when even the sidecar rollback refuses', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const planId = createPlanId();
		const plan = makePlanEntity({ id: planId, projectId, name: 'Blocked' });
		// No `?? stack.projectFolder` fallback: the project was just saved above, so
		// `projectFolderOf` always resolves here — a fallback that never fires is dead
		// tolerance, the same shape `sidecarPathOf` above refuses.
		const folder = projectFolderOf(stack.index, projectId);
		if (folder === undefined) throw new Error(`no folder indexed for project ${projectId}`);
		const notePath = `${folder}/Plans/${plan.name}.md`;
		// The note create fails, and the sidecar rollback that should follow fails too.
		stack.vault.failures.add(`create:${notePath}`);
		stack.vault.failures.add(`delete:${sidecarPathOf(stack, projectId, planId)}`);

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
		const read = expectFound(await stack.zones.getById(zoneId));
		const notePath = stack.index.getPath(zoneId) ?? '';

		// The sidecar mutation fails, so the trashed note must come back; `restoreNote`
		// finds nothing at the path and takes its CREATE branch, which fails too.
		stack.vault.failures.add(`modify:${sidecarPathOf(stack, projectId, planId)}`);
		stack.vault.failures.add(`create:${notePath}`);
		const result = await stack.zones.delete(zoneId, read?.version);

		expect(expectErr(result).code).toBe('zone.sidecar-remove-failed');
		expect(stack.logged.some((line) => line.event === 'zone.delete-compensation-failed')).toBe(true);
	});
});

describe('geometry store failure branches', () => {
	it('create over an existing file refuses with create-failed', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const result = await stack.store.create(createPlanId(), sidecarPathOf(stack, projectId, planId));
		expect(expectErr(result).code).toBe('plan-geometry.create-failed');
	});

	it('mutate on a plan whose sidecar file vanished refuses instead of recreating blindly', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		stack.vault.entries.delete(sidecarPathOf(stack, projectId, planId));
		expect(expectErr(await stack.store.mutate(planId, (dto) => ({ ...dto }))).code).toBe('plan-geometry.missing');
	});
});

/**
 * A hand edit of the one frontmatter key the index is built from, made the way a user makes
 * it: on the BYTES, with the index left holding what it scanned beforehand. The `id:` LINE is
 * rewritten rather than the id's every occurrence, because a zone note names its plan and a
 * requirement names its asset, and replacing those would be planting a different defect.
 *
 * At module scope rather than inside the describe that uses it because
 * `unicorn/consistent-function-scoping` fails the build for a nested function capturing
 * nothing — which is also where `plantFutureSchemaVersion` above sits.
 */
function plantForeignId(stack: RepositoryStack, id: EntityId<string>, foreign: string): string {
	const path = stack.index.getPath(id) ?? '';
	expect(path).not.toBe('');
	const before = stack.vault.entries.get(path) ?? '';
	const after = before.replace(/^id: .*$/m, `id: ${JSON.stringify(foreign)}`);
	expect(after).not.toBe(before);
	stack.vault.entries.set(path, after);
	return path;
}

/**
 * A note's `id` is frontmatter, so a user can edit it — and when one does, the index keeps
 * the OLD id's entry pointing at that path until the next full rebuild. Every read here
 * resolves through the index, so the question "is the note I just loaded the one I asked
 * for" had no asker: `openNoteById` looked a path up, read it, migrated it and returned it,
 * and the four callers each parsed what they were handed.
 *
 * The symptom with teeth is `GetAssetDesignQuery`, which is the one read that JOINS a second
 * file keyed on the id it did not check: it answered `assetId: asset.id` — the loaded note's
 * — beside a `shape` and a `geometryVersion` read from the REQUESTED id's sidecar, so one DTO
 * described two assets and every edit dispatched from that leaf went on targeting the other
 * one. But the door is shared, so the defect was never the asset's: a displaced entry served
 * the wrong note for a plan, a zone, a requirement and an asset alike, and
 * `ObsidianProjectRepository` — which reads through the index without going through that door
 * at all — had the same hole one file over.
 *
 * The cases below are driven off the SAME table the ledger cases use, which is what makes
 * this a claim about the class rather than about the kind that was reported. That table is
 * itself checked against `MIGRATION_SET` above, so a sixth note-backed kind cannot arrive
 * without arriving here too.
 */
describe('a note that no longer declares the id it was asked for', () => {
	it.each(NOTE_BACKED_CASES.map((testCase) => [testCase.kind, testCase] as const))(
		'a displaced %s entry refuses instead of serving the note it points at',
		async (kind, testCase) => {
			const stack = createRepositoryStack();
			const id = await testCase.seed(stack);
			plantForeignId(stack, id, `${id}-somebody-else`);

			const result = await testCase.read(stack, id);

			// Asserted before the code, because the pre-guard build answers `ok` carrying the
			// STRANGER's entity — so a case that reached straight for the error would fail at a
			// helper rather than at an assertion, and would read the same against a build that
			// answered `ok(null)`.
			expect(result.ok).toBe(false);
			expect(expectErr(result).code).toBe(`${kind}.note-id-mismatch`);
			// Recorded like every other read refusal (SDD §68): opaque id, code, nothing else.
			expect(stack.ledger.issues()).toEqual([
				{ entityType: kind, entityId: id, issue: `${kind}.note-id-mismatch` },
			]);
		},
	);

	/**
	 * The write half, and the one where believing the index DESTROYS something. A delete
	 * resolves through the same door, so a caller holding a version it read AFTER the hand
	 * edit — which is the ordinary flow: read, show, press Delete — passed the conditional
	 * check and trashed a note it had never been asked about.
	 *
	 * The expectation is taken off the planted BYTES for exactly that reason: a version
	 * captured before the edit is refused by `checkExpectedVersion` anyway, so a case built
	 * that way would pass against the defect and pin nothing.
	 */
	it('refuses to DELETE the stranger note a displaced entry points at', async () => {
		const stack = createRepositoryStack();
		const assetId = expectOk(await stack.assets.save(makeAssetEntity(), 'absent')).entity.id;
		const path = plantForeignId(stack, assetId, `${assetId}-somebody-else`);
		const current = versionOfFrontmatter(parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter);

		const result = await stack.assets.delete(assetId, current);

		expect(result.ok).toBe(false);
		expect(expectErr(result).code).toBe('asset.note-id-mismatch');
		// The note somebody else's id is on is still there: a refusal, never a partial delete.
		expect(stack.vault.entries.has(path)).toBe(true);
	});

	/**
	 * **What this guard does NOT reach, pinned as behaviour rather than described** — the same
	 * shape, and for the same reason, as the 'is a READ gate' case above. `saveNoteBackedEntity`
	 * resolves existence through `deps.index.getPath(entity.id)` directly, never through
	 * `openNoteById`, so a save holding an expectation that matches the displaced note's own
	 * bytes writes over the stranger and stamps the requested id onto it. Measured, not
	 * reasoned: the id on disk afterwards is the SAVER's.
	 *
	 * It is unreachable through this plugin today, which is a property of the CALLERS and not
	 * of the write path: every command loads before it saves, that load now refuses, and an
	 * expectation captured BEFORE the hand edit fails `checkExpectedVersion` on the digest. The
	 * expectation below is therefore built from the planted bytes by hand, which nothing above
	 * this layer can do. Closing it properly means the save path asking the same question — a
	 * change to how a WRITE establishes existence, not to this guard, and one that owes its own
	 * increment. This case exists so that the day it lands, it goes red here rather than
	 * leaving a paragraph quietly stale.
	 */
	it('is a READ guard: a save with a matching expectation still overwrites the stranger note', async () => {
		const stack = createRepositoryStack();
		const asset = makeAssetEntity();
		expectOk(await stack.assets.save(asset, 'absent'));
		const path = plantForeignId(stack, asset.id, `${asset.id}-somebody-else`);
		const current = versionOfFrontmatter(parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter);

		expectOk(await stack.assets.save(asset, current));

		expect(parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter['id']).toBe(asset.id);
	});

	/**
	 * The NARROWING, pinned so that the guard's shape cannot quietly widen. It refuses a
	 * POSITIVE disagreement — a note declaring a different id — and says nothing about a note
	 * declaring none, which stays whatever the schema already made of it.
	 *
	 * The reason is that a malformed note already has a PRECISER refusal — the code asserted
	 * below is the schema's, and it names what is actually wrong — while `*.note-id-mismatch`
	 * would claim a displacement that did not happen. The index is built from a NON-EMPTY `id`,
	 * so a note declaring none has displaced nothing.
	 *
	 * **This case is the whole instrument for that narrowing, and that is measured rather than
	 * assumed.** Widening the guard to treat an absent id as a disagreement reddens exactly this
	 * one case in a suite of 4573: nothing else in the tree reads a note through the index whose
	 * frontmatter carries no id. So it is not a nicety beside the refusals above — a build that
	 * widens the guard fails HERE or nowhere — and an earlier draft of this comment justified
	 * the narrowing by the metadata cache's create window, which that same run disproves:
	 * `frontmatterOf` falls back to the ECHO record for a note this plugin just wrote, and that
	 * record carries the id.
	 */
	it('says nothing about a note that declares no id at all', async () => {
		const stack = createRepositoryStack();
		const assetId = expectOk(await stack.assets.save(makeAssetEntity(), 'absent')).entity.id;
		const path = stack.index.getPath(assetId) ?? '';
		stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace(/^id: .*$\n/m, ''));

		expect(expectErr(await stack.assets.getById(assetId)).code).toBe('asset.entity-invalid');
	});

	/**
	 * The over-correction control, at the door rather than through a repository: the guard
	 * must be invisible to every read whose note says what the index says. The rest of this
	 * suite is the wider version of this assertion — a guard that refused legitimate reads
	 * would redden hundreds of cases — and this one exists so that the intent is written down
	 * beside the refusals rather than inferred from what did not break.
	 */
	it('is invisible to a note whose id still matches', async () => {
		const stack = createRepositoryStack();
		const assetId = expectOk(await stack.assets.save(makeAssetEntity(), 'absent')).entity.id;

		expect(expectFound(await stack.assets.getById(assetId)).entity.id).toBe(assetId);
		expect(stack.ledger.issues()).toEqual([]);
	});
});
