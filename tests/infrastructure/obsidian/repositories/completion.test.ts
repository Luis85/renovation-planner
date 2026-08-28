import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import {
	versionOfFrontmatter,
	checkExpectedVersion,
} from '../../../../src/infrastructure/obsidian/repositories/versionCheck';
import { fileNameFor, projectFolderOf, sidecarPathFor, zonesFolderFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { observeFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/digest';import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { FindZonesByPlan } from '../../../../src/application/queries/FindZonesByPlan';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

/**
 * The long tail of slice 4's diagnostics: every remaining refusal path, driven red here
 * so none of them can rot into an untested guess.
 */

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

describe('plan repository: calibration sync and listing', () => {
	it('an update whose note write fails reports plan.write-failed', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		stack.vault.failures.add(`modify:${notePathOf(stack, planId)}`);
		expect(
			expectErr(await stack.plans.save(makePlanEntity({ id: planId, projectId, name: 'X' }), read.version)).code,
		).toBe('plan.write-failed');
	});

	it('delete refuses when the sidecar snapshot cannot be taken', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		stack.vault.failures.add(`read:${sidecarPathOf(stack, projectId, planId)}`);
		expect(expectErr(await stack.plans.delete(planId, read.version)).code).toBe('plan.delete-failed');
	});

	it('a save-update re-points the index entry and keeps the mapping through unchanged', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const read = expectOk(await stack.plans.getById(planId));
		const mappingBefore = stack.index.getGeometrySidecarPath(planId);

		const saved = expectOk(
			await stack.plans.save(makePlanEntity({ id: planId, projectId, name: 'Renamed' }), read.version),
		);
		expect(saved.version.revision).toBe(2);
		expect(stack.index.getGeometrySidecarPath(planId)).toBe(mappingBefore);

		const entry = stack.index.entries().find((candidate) => candidate.id === planId);
		expect(entry?.projectId).toBe(projectId);
	});
});


describe('project and zone listings', () => {
	/**
	 * INVERTED in the slice 11/14 polishing pass, and the inversion is the point of the case.
	 * It used to assert that one poisoned note failed the whole listing — so a single stale
	 * note cost the user every project in the vault, with hand-editing YAML as the only
	 * recovery. It is skipped and COUNTED now.
	 *
	 * The refusal is not lost by being skipped: `getById` records every one into the
	 * diagnostics ledger on the way past, which is why only the count travels outward.
	 */
	it('listAll skips an unreadable note and counts it, instead of failing the whole listing', async () => {
		const stack = createRepositoryStack();
		const readable = createProjectId();
		const poisoned = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: readable }), 'absent'));
		expectOk(await stack.projects.save(makeProjectEntity({ id: poisoned }), 'absent'));
		const path = notePathOf(stack, poisoned);
		stack.vault.entries.set(
			path,
			(stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: "junk"'),
		);

		const listing = expectOk(await stack.projects.listAll());

		expect(listing.loaded.map((one) => one.entity.id)).toEqual([readable]);
		expect(listing.refused).toBe(1);
	});

	/**
	 * A vanished note is NOT a refusal and must not be counted as one: `getById` answers
	 * `ok(null)` for it (§36, "not found is not an error"), nothing was refused, and telling
	 * the user "some projects could not be read" about a note that simply is not there would
	 * be a warning with no referent.
	 */
	it('listAll skips a vanished note without counting it as a refusal', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		stack.vault.entries.delete(notePathOf(stack, projectId));

		const listing = expectOk(await stack.projects.listAll());

		expect(listing.loaded).toEqual([]);
		expect(listing.refused).toBe(0);
	});

	it('listByProject skips a vanished note', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		stack.vault.entries.delete(notePathOf(stack, planId));
		expect(expectOk(await stack.plans.listByProject(projectId))).toEqual([]);
	});

	it('listByPlan/listByProject propagate read failures', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		expectOk(await stack.zones.save(makeZoneEntity({ id: zoneId, projectId, planId }), 'absent'));

		stack.vault.entries.set(sidecarPathOf(stack, projectId, planId), '{ not json');
		expect((await stack.zones.listByPlan(planId)).ok).toBe(false);
		expect((await stack.zones.listByProject(projectId)).ok).toBe(false);
	});

	it('delete refuses a hand-made note that does not declare its plan', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);

		const zoneId = 'zone-handmade';
		const path = `${stack.projectFolder}/Zones/${zoneId}.md`;
		stack.vault.entries.set(
			path,
			'---\ntype: "renovation-zone"\n"schema-version": 1\n"id": "zone-handmade"\nrevision: 1\nname: "H"\n---\n',
		);
		stack.index.upsert({ id: zoneId as never, type: 'renovation-zone', path });

		const fm = parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter;
		const error = expectErr(
			await stack.zones.delete(zoneId as never, { revision: 1, observed: observeFrontmatter(fm) }),
		);
		expect(error.code).toBe('zone.delete-failed');
		void projectId;
	});
});

describe('geometry store diagnostics', () => {
	it('schemaVersion handling: absent, junk, and valid versions behave distinctly', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const path = sidecarPathOf(stack, projectId, planId);
		const base = { planId, revision: 1, unit: 'mm', calibration: null, objects: [] };

		// Absent schemaVersion starts the chain at 0 → gap → a Migration refusal with
		// the runner's own code, no longer flattened into Persistence.
		stack.vault.entries.set(path, JSON.stringify(base));
		const gap = expectErr(await stack.store.read(planId));
		expect(gap.code).toBe('migration.chain-gap');
		expect(gap.category).toBe('Migration');

		// A PRESENT but non-numeric version is malformed data (Validation), and a FUTURE
		// one is fail-closed (Migration) — the same vocabulary a note read refuses with.
		stack.vault.entries.set(path, JSON.stringify({ ...base, schemaVersion: 'junk' }));
		const malformed = expectErr(await stack.store.read(planId));
		expect(malformed.code).toBe('plan-geometry.schema-version-malformed');
		expect(malformed.category).toBe('Validation');
		stack.vault.entries.set(path, JSON.stringify({ ...base, schemaVersion: 99 }));
		const future = expectErr(await stack.store.read(planId));
		expect(future.code).toBe('plan-geometry.schema-version-unsupported');
		expect(future.category).toBe('Migration');

		// A numeric v1 parses cleanly.
		stack.vault.entries.set(path, JSON.stringify({ ...base, schemaVersion: 1 }));
		expectOk(await stack.store.read(planId));

		// Wrong unit fails the schema.
		stack.vault.entries.set(path, JSON.stringify({ ...base, schemaVersion: 1, unit: 'cm' }));
		expect(expectErr(await stack.store.read(planId)).code).toBe('plan-geometry.schema-invalid');

		// An unreadable file reports unreadable, distinct from corrupt JSON.
		stack.vault.failures.add(`read:${path}`);
		expect(expectErr(await stack.store.read(planId)).code).toBe('plan-geometry.unreadable');
		stack.vault.failures.clear();

		// Deleting the underlying file makes delete a tolerant no-op.
		stack.vault.entries.delete(path);
		expectOk(await stack.store.delete(planId));
	});
});

describe('token and filename edges', () => {
	it('observation tokens handle multibyte names deterministically', () => {
		const a = observeFrontmatter({ name: 'Büro', id: 'x' });
		const b = observeFrontmatter({ name: 'Büro', id: 'x' });
		const c = observeFrontmatter({ name: 'Buro', id: 'x' });
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});

	it('versionOfFrontmatter falls back to revision 0 for junk values', () => {
		for (const junk of [-1, 1.5, '3', null]) {
			const version = versionOfFrontmatter({ revision: junk });
			expect(version.revision).toBe(0);
		}
	});

	it('checkExpectedVersion distinguishes absent-refusal from stale-revision', () => {
		const current = { revision: 2, observed: 't' as never };
		expect(checkExpectedVersion('zone', 'z', current, 'absent')?.code).toBe('zone.revision-conflict');
		expect(checkExpectedVersion('zone', 'z', current, { revision: 2, observed: 't' })).toBeNull();
	});

	it('fileNameFor trims forbidden characters and edge dots', () => {
		expect(fileNameFor('  ..Kitchen: Renovation?  ')).toBe('Kitchen Renovation');
		expect(fileNameFor('...')).toBe('untitled');
	});

	it('zones folder helper joins under the normalized folder', () => {
		expect(zonesFolderFor('A/B')).toBe('A/B/Zones');
	});
});

describe('index empties', () => {
	it('lookups over an empty index answer empty without error', () => {
		const index = new InMemoryProjectIndex();
		expect(index.getIdsByType('renovation-zone')).toEqual([]);
		expect(index.getIdsByProject('project-x' as never)).toEqual([]);
		expect(index.getSpatialObjectIdsByPlan('plan-x' as never)).toEqual([]);
	});
});

/**
 * Calibration is READ-ONLY through the plan repository (design slice 7's review pass).
 * The sidecar owns the field; `ReversibleCalibratePlanCommand` writes it through
 * `PlanGeometrySidecar`; `getById` merges it into the entity. What used to be here — a
 * `syncCalibration` that lowered the entity's value on every note save — was a lost
 * update no version check could see, because calibration does not live in the note.
 */
describe('calibration is read-only through the plan repository', () => {
	const CALIBRATION = {
		pointA: { x: 0, y: 0 },
		pointB: { x: 0, y: 2000 },
		knownDistance: 2000,
		pixelsPerWorldUnit: 0.05,
	};

	it('getById merges the sidecar calibration into the entity', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		expect(expectOk(await stack.plans.getById(planId)).entity.calibration).toBeNull();

		const sidecar = new ObsidianPlanGeometrySidecar(stack.store);
		expectOk(await sidecar.write(planId, { calibration: CALIBRATION, objects: [] }));

		const after = expectOk(await stack.plans.getById(planId)).entity;
		expect(after.calibration).toEqual(CALIBRATION);
	});

	it('a note save NEVER writes the calibration field, even from an entity that disagrees', async () => {
		const stack = createRepositoryStack();
		const { planId, projectId } = await seed(stack);
		const sidecar = new ObsidianPlanGeometrySidecar(stack.store);
		expectOk(await sidecar.write(planId, { calibration: CALIBRATION, objects: [] }));
		const untouched = stack.vault.entries.get(sidecarPathOf(stack, projectId, planId));

		// The exact shape of the old lost update: an entity read BEFORE the calibration
		// landed (here, one that never had it at all) saved afterwards. Calibration is not
		// in the note, so the note's revision never moved and `checkExpectedVersion` passes
		// — the only thing standing between that save and the sidecar is that the
		// repository no longer writes it.
		const loaded = expectOk(await stack.plans.getById(planId));
		expectOk(await stack.plans.save(
			makePlanEntity({ id: planId, projectId, name: 'Renamed' }),
			loaded.version,
		));

		expect(stack.vault.entries.get(sidecarPathOf(stack, projectId, planId))).toBe(untouched);
		expect(expectOk(await stack.plans.getById(planId)).entity.calibration).toEqual(CALIBRATION);
	});

	it('refuses to load a plan whose sidecar holds a calibration the derivation could not produce', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const path = sidecarPathOf(stack, projectId, planId);
		const document = JSON.parse(stack.vault.entries.get(path) ?? '{}') as Record<string, unknown>;
		// Hand-edited coincident points: the Zod schema checks each field's shape, so only
		// `validateCalibration` at `withCalibration` can catch the RELATIONSHIP between them.
		document['calibration'] = { ...CALIBRATION, pointA: { x: 7, y: 7 }, pointB: { x: 7, y: 7 } };
		stack.vault.entries.set(path, JSON.stringify(document));

		const failure = expectErr(await stack.plans.getById(planId));
		expect(failure.code).toBe('plan.frontmatter-invalid');
		// The code is the door; the cause is which rule refused. Without it the diagnostic
		// points at the note, and the note is fine.
		expect(failure.cause).toMatchObject({ code: 'plan.degenerate-points' });
	});
});

describe('the long tail, continued', () => {
	it('getById reports a malformed schema version as a ValidationError, not a migration failure', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const path = notePathOf(stack, planId);
		stack.vault.entries.set(path, (stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: "junk"'));
		const error = expectErr(await stack.plans.getById(planId));
		expect(error.code).toBe('plan.schema-version-malformed');
		expect(error.category).toBe('Validation');
	});

	it('an insert whose sidecar creation fails reports sidecar-create-failed', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const planId = createPlanId();
		stack.vault.failures.add(`create:${sidecarPathOf(stack, projectId, planId)}`);
		const result = await stack.plans.save(
			makePlanEntity({ id: planId, projectId }),
			'absent',
		);
		expect(expectErr(result).code).toBe('plan.sidecar-create-failed');
	});
});

describe('zone repository failure branches', () => {
	it('save refuses when the snapshot cannot be taken or the note cannot be written', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneId = createZoneId();
		const zone = makeZoneEntity({ id: zoneId, projectId, planId });
		const written = expectOk(await stack.zones.save(zone, 'absent'));
		const path = notePathOf(stack, zoneId);

		// Snapshot read fails on update.
		stack.vault.failures.add(`read:${path}`);
		const snapshotFailure = await stack.zones.save(
			makeZoneEntity({ id: zoneId, projectId, planId, name: 'X' }),
			written.version,
		);
		expect(expectErr(snapshotFailure).code).toBe('zone.save-failed');
		stack.vault.failures.clear();

		// Frontmatter merge fails on update.
		stack.vault.failures.add(`modify:${path}`);
		expect(
			expectErr(await stack.zones.save(makeZoneEntity({ id: zoneId, projectId, planId, name: 'X' }), written.version)).code,
		).toBe('zone.write-failed');
		stack.vault.failures.clear();
	});

	it('a second zone with the same name gets an ID-suffixed filename', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const first = makeZoneEntity({ id: createZoneId(), projectId, planId, name: 'Hall' });
		const second = makeZoneEntity({ id: createZoneId(), projectId, planId, name: 'Hall' });
		expectOk(await stack.zones.save(first, 'absent'));
		expectOk(await stack.zones.save(second, 'absent'));

		const paths = [first.id, second.id].map((id) => stack.index.getPath(id));
		expect(new Set(paths).size).toBe(2);
		expect(paths.map((p) => p?.includes('Hall'))).toEqual([true, true]);
	});

	/**
	 * The same rule for the other two entity kinds, which had no collision fallback at all:
	 * the plain path went straight to `vault.create`, so the SECOND plan a user named
	 * "Ground floor" — or the second project named "Kitchen" — refused to save with a write
	 * failure naming nothing they could act on. Filename is never identity (§83), so two
	 * entities sharing a name is ordinary rather than a mistake to reject.
	 */
	it('a second plan with the same name gets an ID-suffixed filename instead of refusing', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		const first = makePlanEntity({ id: createPlanId(), projectId, name: 'Ground floor' });
		const second = makePlanEntity({ id: createPlanId(), projectId, name: 'Ground floor' });
		expectOk(await stack.plans.save(first, 'absent'));
		expectOk(await stack.plans.save(second, 'absent'));

		const paths = [first.id, second.id].map((id) => stack.index.getPath(id));
		expect(new Set(paths).size).toBe(2);
		expect(paths.every((p) => p?.includes('Ground floor'))).toBe(true);

		// Both readable afterwards — a free filename is not enough if the index lost one.
		expect(expectOk(await stack.plans.getById(second.id))?.entity.name).toBe('Ground floor');
	});

	it('a second project with the same name gets an ID-suffixed filename instead of refusing', async () => {
		const stack = createRepositoryStack();
		const first = makeProjectEntity({ id: createProjectId(), name: 'Kitchen' });
		const second = makeProjectEntity({ id: createProjectId(), name: 'Kitchen' });
		expectOk(await stack.projects.save(first, 'absent'));
		expectOk(await stack.projects.save(second, 'absent'));

		const paths = [first.id, second.id].map((id) => stack.index.getPath(id));
		expect(new Set(paths).size).toBe(2);
		expect(expectOk(await stack.projects.getById(second.id))?.entity.name).toBe('Kitchen');
	});
});

describe('the find-zones query', () => {
	it('resolves every persisted zone of one plan', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		const zoneA = makeZoneEntity({ id: createZoneId(), projectId, planId, name: 'A' });
		const zoneB = makeZoneEntity({ id: createZoneId(), projectId, planId, name: 'B' });
		expectOk(await stack.zones.save(zoneA, 'absent'));
		expectOk(await stack.zones.save(zoneB, 'absent'));

		const found = expectOk(await new FindZonesByPlan(stack.zones).execute({ planId }));
		expect(found.map((loaded) => loaded.entity.name).toSorted()).toEqual(['A', 'B']);
	});
});
