import { describe, expect, it } from 'vitest';
import { isTFolder } from '../../../../src/infrastructure/obsidian/repositories/noteIo';
import {
	freshProjectFolder,
	joinFolder,
	plansFolderFor,
	projectFolderOf,
} from '../../../../src/infrastructure/obsidian/repositories/paths';
import { InMemoryProjectIndex } from '../../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { createRepositoryStack, serializeFrontmatter } from '../../../helpers/vault';
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

	it('refuses a save whose project folder cannot be resolved, and writes nothing', async () => {
		const stack = createRepositoryStack('Renovation');
		const kitchen = makeProjectEntity({ id: 'p1' as ProjectId, name: 'Kitchen Refit' });
		await stack.projects.save(kitchen, 'absent');
		const groundFloor = makePlanEntity({ id: 'pl1' as PlanId, projectId: 'p1' as ProjectId, name: 'Ground floor' });
		await stack.plans.save(groundFloor, 'absent');
		const before = [...stack.vault.entries.keys()];

		// The read happened; the index entry disappears between it and the save. This is
		// the only way to reach the arm, and it is the arm that must never fall back to the
		// configured root.
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

		// Same route as the plan case: the index entry disappears between the read and the
		// save, which is the only way to reach the arm — and it must never fall back to the
		// configured root.
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

		// Same route as the plan and zone cases: the index entry disappears between the read
		// and the save, which is the only way to reach the arm — and it must never fall back
		// to the configured root.
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

	it('refuses to mark a requirement stale whose project folder cannot be resolved, and writes nothing', async () => {
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
		const before = [...stack.vault.entries.keys()];

		// `markStale` resolves the folder for itself (it scans the folder rather than
		// reading the note it just found through the index) — a second site the index
		// entry disappearing between the read and the write reaches, same as save.
		stack.index.remove('p1' as never);
		const result = await stack.requirements.markStale('r1' as RequirementId);

		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.category).toBe('Persistence');
		expect(result.ok === false && result.error.code).toBe('requirement.project-folder-unresolved');
		expect([...stack.vault.entries.keys()]).toEqual(before);
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

describe('FakeVault.getAbstractFileByPath', () => {
	// The root resolves to a folder rather than null, matching `folderExists('')`'s own
	// standing answer and real Obsidian — see the method's own comment for why leaving the
	// two disagree would be the thin-fake shape this repository keeps finding.
	it('resolves the vault root to a folder rather than null', () => {
		const stack = createRepositoryStack('Renovation');
		expect(isTFolder(stack.vault.getAbstractFileByPath(''))).toBe(true);
	});
});
