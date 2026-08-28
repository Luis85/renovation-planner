import { describe, expect, it } from 'vitest';
import { isTFolder } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import {
	freshProjectFolder,
	joinFolder,
	plansFolderFor,
	projectFolderOf,
} from '../../../../src/infrastructure/obsidian/repositories/paths';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { createRepositoryStack, serializeFrontmatter, type RepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import {
	makeAsset as makeAssetEntity,
	makePlan as makePlanEntity,
	makeProject as makeProjectEntity,
	makeRequirement as makeRequirementEntity,
	makeZone as makeZoneEntity,
} from '../../../helpers/entities';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import type { RequirementId } from '../../../../src/domain/requirement/RequirementId';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';

describe('joinFolder', () => {
	it('joins a folder and a child with one separator', () => {
		expect(joinFolder('Renovation/Kitchen', 'Plans')).toBe('Renovation/Kitchen/Plans');
	});

	it('answers the child alone at the vault root, rather than a leading slash', () => {
		// A Project.md at the vault root derives the empty folder, and `/Plans` is a path
		// Obsidian refuses. This arm is why the join is a function rather than a template.
		expect(joinFolder('', 'Plans')).toBe('Plans');
		expect(plansFolderFor('')).toBe('Plans');
	});
});

describe('projectFolderOf', () => {
	it('answers the folder the project note sits in', () => {
		const index = new InMemoryProjectIndex();
		index.upsert({
			id: 'p1' as never,
			type: 'renovation-project',
			path: 'Renovation/Kitchen Refit/Project.md',
		});
		expect(projectFolderOf(index, 'p1' as never)).toBe('Renovation/Kitchen Refit');
	});

	it('answers undefined for a project the index does not hold', () => {
		expect(projectFolderOf(new InMemoryProjectIndex(), 'nope' as never)).toBeUndefined();
	});
});

describe('freshProjectFolder', () => {
	it('derives the folder from the project name, under the configured root', () => {
		const stack = createRepositoryStack('Renovation');
		expect(freshProjectFolder(stack.vault as never, 'Renovation', 'Kitchen Refit', 'p1')).toBe(
			'Renovation/Kitchen Refit',
		);
	});

	it('appends the id when the plain name is taken', () => {
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set('Renovation/Kitchen Refit/Project.md', '');
		expect(freshProjectFolder(stack.vault as never, 'Renovation', 'Kitchen Refit', 'p2')).toBe(
			'Renovation/Kitchen Refit p2',
		);
	});
});

describe('a project owns its folder', () => {
	// The note's own FILENAME is unchanged by this task — `freshNotePath` still derives it
	// from the project's name via `fileNameFor` (filename is never identity, §83), exactly
	// as it did before ADR-0013. Only the FOLDER it is created in moves, so each project's
	// note lands at `<folder>/<fileNameFor(name)>.md`, not literally `Project.md`.
	it('creates each project in its own folder under the configured root', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		const bathroom = makeProjectEntity({ id: 'p2' as ProjectId, name: 'Bathroom' });

		await stack.projects.save(kitchen, 'absent');
		await stack.projects.save(bathroom, 'absent');

		expect(stack.index.getPath('p1' as never)).toBe('Renovation/Kitchen Refit/Kitchen Refit.md');
		expect(stack.index.getPath('p2' as never)).toBe('Renovation/Bathroom/Bathroom.md');
	});

	it('takes the configured root, so changing the setting moves where a new project goes', async () => {
		const stack = createRepositoryStack('Somewhere Else');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });

		await stack.projects.save(kitchen, 'absent');

		expect(stack.index.getPath('p1' as never)).toBe('Somewhere Else/Kitchen Refit/Kitchen Refit.md');
	});
});

describe('plans and zones land in their own project folder', () => {
	it('writes two projects\' plans into two different folders', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		const bathroom = makeProjectEntity({ id: 'p2' as ProjectId, name: 'Bathroom' });
		await stack.projects.save(kitchen, 'absent');
		await stack.projects.save(bathroom, 'absent');

		const groundFloor = makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' });
		const upstairs = makePlanEntity({ id: 'pl2' as PlanId, projectId: 'p2' as ProjectId, name: 'Upstairs' });
		await stack.plans.save(groundFloor, 'absent');
		await stack.plans.save(upstairs, 'absent');

		expect(stack.index.getPath('pl1' as never)).toBe('Renovation/Kitchen Refit/Plans/Ground floor.md');
		expect(stack.index.getPath('pl2' as never)).toBe('Renovation/Bathroom/Plans/Upstairs.md');
	});

	it('puts a plan\'s geometry sidecar in its own project folder', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		await stack.projects.save(kitchen, 'absent');
		const groundFloor = makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' });
		await stack.plans.save(groundFloor, 'absent');

		expect(stack.index.getGeometrySidecarPath('pl1' as never)).toBe(
			'Renovation/Kitchen Refit/Geometry/pl1.rpgeo',
		);
	});

	it('writes two projects\' zones into two different folders', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		const bathroom = makeProjectEntity({ id: 'p2' as ProjectId, name: 'Bathroom' });
		await stack.projects.save(kitchen, 'absent');
		await stack.projects.save(bathroom, 'absent');

		const groundFloor = makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' });
		const upstairs = makePlanEntity({ id: 'pl2' as PlanId, projectId: 'p2' as ProjectId, name: 'Upstairs' });
		await stack.plans.save(groundFloor, 'absent');
		await stack.plans.save(upstairs, 'absent');

		const livingRoom = makeZoneEntity({
			id: 'z1' as ZoneId,
			projectId: 'p1' as ProjectId,
			planId: 'pl1' as PlanId,
			name: 'Living room',
		});
		const bedroom = makeZoneEntity({
			id: 'z2' as ZoneId,
			projectId: 'p2' as ProjectId,
			planId: 'pl2' as PlanId,
			name: 'Bedroom',
		});
		await stack.zones.save(livingRoom, 'absent');
		await stack.zones.save(bedroom, 'absent');

		expect(stack.index.getPath('z1' as never)).toBe('Renovation/Kitchen Refit/Zones/Living room.md');
		expect(stack.index.getPath('z2' as never)).toBe('Renovation/Bathroom/Zones/Bedroom.md');
	});

	it('reads and mutates a sidecar through PlanGeometryStore, isolated per project', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		const bathroom = makeProjectEntity({ id: 'p2' as ProjectId, name: 'Bathroom' });
		await stack.projects.save(kitchen, 'absent');
		await stack.projects.save(bathroom, 'absent');

		const groundFloor = makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' });
		const upstairs = makePlanEntity({ id: 'pl2' as PlanId, projectId: 'p2' as ProjectId, name: 'Upstairs' });
		await stack.plans.save(groundFloor, 'absent');
		await stack.plans.save(upstairs, 'absent');

		const groundRead = expectOk(await stack.store.read('pl1' as PlanId));
		const upstairsRead = expectOk(await stack.store.read('pl2' as PlanId));
		expect(groundRead.path).toBe('Renovation/Kitchen Refit/Geometry/pl1.rpgeo');
		expect(upstairsRead.path).toBe('Renovation/Bathroom/Geometry/pl2.rpgeo');

		// A write through the store to one project's sidecar must not reach the other's —
		// the join is by basename across the whole vault now, so this is what proves two
		// projects' sidecars stay distinct rather than merely differently NAMED.
		expectOk(
			await stack.store.mutate('pl1' as PlanId, (dto) => ({
				...dto,
				objects: [{ id: 'z1', type: 'polygon', points: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] }],
			})),
		);

		const groundAfter = expectOk(await stack.store.read('pl1' as PlanId));
		const upstairsAfter = expectOk(await stack.store.read('pl2' as PlanId));
		expect(groundAfter.dto.objects).toHaveLength(1);
		expect(upstairsAfter.dto.objects).toHaveLength(0);
	});

	it('refuses an insert whose project folder cannot be resolved, and writes nothing', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		await stack.projects.save(kitchen, 'absent');
		const groundFloor = makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' });
		const before = [...stack.vault.entries.keys()];

		// An INSERT is the only path that has to choose a location, so it is the only one
		// this arm guards: an update writes where the note already is. The project's index
		// entry disappears between reading it and creating the plan, and the write must
		// refuse rather than fall back to the configured root.
		stack.index.remove('p1' as never);
		const result = await stack.plans.save(groundFloor, 'absent');

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.category).toBe('Persistence');
		expect(result.ok === false && result.error.code).toBe('plan.project-folder-unresolved');
		expect([...stack.vault.entries.keys()]).toEqual(before);
	});

	it('refuses a zone save whose project folder cannot be resolved, and writes nothing', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		await stack.projects.save(kitchen, 'absent');
		const groundFloor = makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' });
		await stack.plans.save(groundFloor, 'absent');
		const livingRoom = makeZoneEntity({ projectId: 'p1' as ProjectId, planId: 'pl1' as PlanId });
		const before = [...stack.vault.entries.keys()];

		// Same route as the plan case, and an INSERT for the same reason: this zone has
		// never been saved, so the write has to choose a location and the unresolvable
		// folder is what stops it. It must never fall back to the configured root.
		stack.index.remove('p1' as never);
		const result = await stack.zones.save(livingRoom, 'absent');

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.category).toBe('Persistence');
		expect(result.ok === false && result.error.code).toBe('zone.project-folder-unresolved');
		expect([...stack.vault.entries.keys()]).toEqual(before);
	});
});

describe('assets and requirements land in their own project folder', () => {
	it('writes two projects\' assets and requirements into two different folders', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		const bathroom = makeProjectEntity({ id: 'p2' as ProjectId, name: 'Bathroom' });
		await stack.projects.save(kitchen, 'absent');
		await stack.projects.save(bathroom, 'absent');

		const tiles = makeAssetEntity({ id: 'a1' as AssetId, projectId: 'p1' as ProjectId, name: 'Tiles' });
		const grout = makeAssetEntity({ id: 'a2' as AssetId, projectId: 'p2' as ProjectId, name: 'Grout' });
		await stack.assets.save(tiles, 'absent');
		await stack.assets.save(grout, 'absent');

		expect(stack.index.getPath('a1' as never)).toBe('Renovation/Kitchen Refit/Assets/Tiles.md');
		expect(stack.index.getPath('a2' as never)).toBe('Renovation/Bathroom/Assets/Grout.md');

		const requirement = makeRequirementEntity({
			id: 'r1' as RequirementId,
			projectId: 'p2' as ProjectId,
			assetId: grout.id,
			origin: { kind: 'zone', zoneId: 'z1' as ZoneId },
		});
		await stack.requirements.save(requirement, 'absent');

		expect(stack.index.getPath('r1' as never)).toBe('Renovation/Bathroom/Requirements/r1.md');
	});

	it('refuses an asset save whose project folder cannot be resolved, and writes nothing', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		await stack.projects.save(kitchen, 'absent');
		const tiles = makeAssetEntity({ projectId: 'p1' as ProjectId, name: 'Tiles' });
		const before = [...stack.vault.entries.keys()];

		// Same route as the plan and zone cases, and an INSERT for the same reason — this
		// asset has never been saved, so the write has to choose a location. `saveQueued`
		// hands the unresolved folder to the spec as `undefined`; `saveNoteBackedEntity`
		// refuses on the insert path, before `ensureFolder`, which is why nothing is written.
		stack.index.remove('p1' as never);
		const result = await stack.assets.save(tiles, 'absent');

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.category).toBe('Persistence');
		expect(result.ok === false && result.error.code).toBe('asset.project-folder-unresolved');
		expect([...stack.vault.entries.keys()]).toEqual(before);
	});

	it('refuses a requirement save whose project folder cannot be resolved, and writes nothing', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		await stack.projects.save(kitchen, 'absent');
		const requirement = makeRequirementEntity({
			projectId: 'p1' as ProjectId,
			assetId: 'a1' as AssetId,
			origin: { kind: 'zone', zoneId: 'z1' as ZoneId },
		});
		const before = [...stack.vault.entries.keys()];

		stack.index.remove('p1' as never);
		const result = await stack.requirements.save(requirement, 'absent');

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.category).toBe('Persistence');
		expect(result.ok === false && result.error.code).toBe('requirement.project-folder-unresolved');
		expect([...stack.vault.entries.keys()]).toEqual(before);
	});

	it('marks a requirement stale without resolving its project folder at all', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		await stack.projects.save(kitchen, 'absent');
		const requirement = makeRequirementEntity({
			id: 'r1' as RequirementId,
			projectId: 'p1' as ProjectId,
			assetId: 'a1' as AssetId,
			origin: { kind: 'zone', zoneId: 'z1' as ZoneId },
		});
		await stack.requirements.save(requirement, 'absent');

		// This case used to assert a `requirement.project-folder-unresolved` refusal here.
		// That arm is gone: `markStale` never inserts, so it never chooses a location, and
		// resolving a folder it had no use for is what made it refuse on notes it had just
		// read successfully. The project's index entry disappearing must therefore cost the
		// stale marker nothing.
		stack.index.remove('p1' as never);

		expectOk(await stack.requirements.markStale('r1' as RequirementId));

		const marked = expectOk(await stack.requirements.getById('r1' as RequirementId));
		expect(marked?.entity.recalculationStatus).toBe('stale');
	});

	it('reads and writes a project in the old single-folder layout unchanged', async () => {
		// Every vault this plugin has produced looks like this: the project note and the
		// per-kind folders directly under the configured root. Under ADR-0013 that IS a
		// valid project — its folder is `Renovation` — so nothing has to move, and this is
		// the test under that claim rather than a paragraph asserting it.
		const stack = createRepositoryStack('Renovation');
		stack.vault.entries.set(
			'Renovation/Project.md',
			serializeFrontmatter({ type: 'renovation-project', id: 'p-old', 'schema-version': 1, name: 'Old Layout', status: 'idea' }),
		);
		stack.metadataCache.catchUp();
		stack.rebuildIndex();

		// The READ half: the old note itself still loads through the real repository, not
		// merely through the index rebuild that feeds the write half below.
		const read = expectOk(await stack.projects.getById('p-old' as ProjectId));
		expect(read?.entity.name).toBe('Old Layout');

		const plan = makePlanEntity({ id: 'pl-old' as PlanId, projectId: 'p-old' as ProjectId, name: 'Ground floor' });
		await stack.plans.save(plan, 'absent');

		expect(stack.index.getPath('pl-old' as never)).toBe('Renovation/Plans/Ground floor.md');
	});
});

/** What the user did in Obsidian's file explorer, plus the rescan that follows it. */
function relocate(stack: RepositoryStack, from: string, to: string): void {
	const text = stack.vault.entries.get(from);
	if (text === undefined) throw new Error(`nothing to relocate at ${from}`);
	stack.vault.entries.delete(from);
	stack.vault.entries.set(to, text);
	stack.metadataCache.catchUp();
	stack.rebuildIndex();
}

async function seedKitchenProject(stack: RepositoryStack): Promise<void> {
	await stack.projects.save(
		makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' }),
		'absent',
	);
}

async function seedGroundFloorPlan(stack: RepositoryStack): Promise<void> {
	await stack.plans.save(
		makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' }),
		'absent',
	);
}

/**
 * Slice 18 widened discovery to the whole vault: a note of ours is found by what it
 * DECLARES, not by where it sits. The save paths did not follow — they established
 * existence by scanning the derived `<projectFolder>/<Kind>/`, so a note the user had
 * filed anywhere else was read, indexed and deletable but could never be saved again: the
 * scan missed it, `currentVersion` came back `undefined`, and `checkExpectedVersion`
 * answered a permanent `*-revision-conflict`.
 *
 * The in-contract trigger is the slice's own widening, not "drag Project.md out": the note
 * moved here is a CHILD note, its project's folder still resolves, and the read half keeps
 * working throughout — which is what makes the refusal a defect rather than a boundary.
 * Each case asserts the note was written where it actually SITS, and that no duplicate
 * appeared at the derived path.
 */
describe('a note filed outside its kind folder still saves', () => {
	it('saves a plan note the user moved out of the Plans folder', async () => {
		const stack = createRepositoryStack('Renovation');
		await seedKitchenProject(stack);
		await seedGroundFloorPlan(stack);
		const derived = 'Renovation/Kitchen Refit/Plans/Ground floor.md';
		relocate(stack, derived, 'Inbox/Ground floor.md');

		const read = expectOk(await stack.plans.getById('pl1' as PlanId));
		if (read === null) throw new Error('the moved plan note should still read');

		const saved = expectOk(await stack.plans.save(read.entity, read.version));

		expect(saved.version.revision).toBe(2);
		expect(stack.index.getPath('pl1' as never)).toBe('Inbox/Ground floor.md');
		expect(stack.vault.entries.has(derived)).toBe(false);
	});

	it('saves a zone note the user moved out of the Zones folder', async () => {
		const stack = createRepositoryStack('Renovation');
		await seedKitchenProject(stack);
		await seedGroundFloorPlan(stack);
		await stack.zones.save(
			makeZoneEntity({
				id: 'z1' as ZoneId,
				projectId: 'p1' as ProjectId,
				planId: 'pl1' as PlanId,
				name: 'Living room',
			}),
			'absent',
		);
		const derived = 'Renovation/Kitchen Refit/Zones/Living room.md';
		relocate(stack, derived, 'Inbox/Living room.md');

		const read = expectOk(await stack.zones.getById('z1' as ZoneId));
		if (read === null) throw new Error('the moved zone note should still read');

		const saved = expectOk(await stack.zones.save(read.entity, read.version));

		expect(saved.version.revision).toBe(2);
		expect(stack.index.getPath('z1' as never)).toBe('Inbox/Living room.md');
		expect(stack.vault.entries.has(derived)).toBe(false);
	});

	it('saves an asset note the user moved out of the Assets folder', async () => {
		const stack = createRepositoryStack('Renovation');
		await seedKitchenProject(stack);
		await stack.assets.save(
			makeAssetEntity({ id: 'a1' as AssetId, projectId: 'p1' as ProjectId, name: 'Tiles' }),
			'absent',
		);
		const derived = 'Renovation/Kitchen Refit/Assets/Tiles.md';
		relocate(stack, derived, 'Inbox/Tiles.md');

		const read = expectOk(await stack.assets.getById('a1' as AssetId));
		if (read === null) throw new Error('the moved asset note should still read');

		const saved = expectOk(await stack.assets.save(read.entity, read.version));

		expect(saved.version.revision).toBe(2);
		expect(stack.index.getPath('a1' as never)).toBe('Inbox/Tiles.md');
		expect(stack.vault.entries.has(derived)).toBe(false);
	});

	it('saves a requirement note the user moved out of the Requirements folder', async () => {
		const stack = createRepositoryStack('Renovation');
		await seedKitchenProject(stack);
		await stack.requirements.save(
			makeRequirementEntity({
				id: 'r1' as RequirementId,
				projectId: 'p1' as ProjectId,
				assetId: 'a1' as AssetId,
				origin: { kind: 'zone', zoneId: 'z1' as ZoneId },
			}),
			'absent',
		);
		const derived = 'Renovation/Kitchen Refit/Requirements/r1.md';
		relocate(stack, derived, 'Inbox/r1.md');

		const read = expectOk(await stack.requirements.getById('r1' as RequirementId));
		if (read === null) throw new Error('the moved requirement note should still read');

		const saved = expectOk(await stack.requirements.save(read.entity, read.version));

		expect(saved.version.revision).toBe(2);
		expect(stack.index.getPath('r1' as never)).toBe('Inbox/r1.md');
		expect(stack.vault.entries.has(derived)).toBe(false);
	});

	it('marks a requirement note stale where it actually sits', async () => {
		const stack = createRepositoryStack('Renovation');
		await seedKitchenProject(stack);
		await stack.requirements.save(
			makeRequirementEntity({
				id: 'r1' as RequirementId,
				projectId: 'p1' as ProjectId,
				assetId: 'a1' as AssetId,
				origin: { kind: 'zone', zoneId: 'z1' as ZoneId },
			}),
			'absent',
		);
		relocate(stack, 'Renovation/Kitchen Refit/Requirements/r1.md', 'Inbox/r1.md');

		expectOk(await stack.requirements.markStale('r1' as RequirementId));

		const marked = expectOk(await stack.requirements.getById('r1' as RequirementId));
		expect(marked?.entity.recalculationStatus).toBe('stale');
	});
});

describe('FakeVault.getAbstractFileByPath', () => {
	// The root resolves to a folder rather than null, matching `folderExists('')`'s own
	// standing answer and real Obsidian — see the method's own comment for why leaving the
	// two disagree would be the thin-fake shape this repository keeps finding.
	it('resolves the vault root to a folder rather than null', () => {
		const stack = createRepositoryStack('Renovation');
		expect(isTFolder(stack.vault.getAbstractFileByPath(''))).toBe(true);
	});
});
