import { describe, expect, it } from 'vitest';
import { ListRequirementsReferencing } from '../../../src/application/queries/ListRequirementsReferencing';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryProjectIndex } from '../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { projectFolderOf } from '../../../src/infrastructure/obsidian/repositories/paths';
import { createAssetId, type AssetId } from '../../../src/domain/asset/AssetId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { ProjectRepository } from '../../../src/application/ports/ProjectRepository';
import { err } from '../../../src/core/result/Result';
import { expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeProject, makeRequirement } from '../../helpers/entities';

/**
 * Design slice 19's regrouping. An Asset is a vault-level catalogue entry owned by no
 * project, so its referents are no longer all in the project the user is looking at — a
 * flat total reads as "in the project I am looking at", which is exactly what they are not.
 *
 * `projectPath` is asserted against a path this file never spells as a fixture: the index
 * holds each project's `Project.md` NOTE and a group must carry the FOLDER it sits in, so a
 * build handing back `index.getPath(id)` verbatim fails here rather than shipping a dialog
 * row labelled `…/Project.md`.
 */

const KITCHEN_ZONE = createZoneId();
const BATHROOM_ZONE = createZoneId();

interface Fixture {
	readonly query: ListRequirementsReferencing;
	readonly requirements: InMemoryRequirementRepository;
	readonly projects: InMemoryProjectRepository;
	readonly tiles: AssetId;
	readonly kitchen: ProjectId;
	readonly bathroom: ProjectId;
}

/**
 * Two projects, one shared Asset, three requirements — two in the first project and one in
 * the second, each originating in a zone of its OWN project, which is the only arrangement
 * a real vault can hold. `names` is the single knob the ambiguity rule turns.
 */
async function fixture(
	names: readonly [string, string] = ['Kitchen refit', 'Bathroom refit'],
	options: { readonly indexed?: boolean; readonly saved?: boolean } = {},
): Promise<Fixture> {
	const { indexed = true, saved = true } = options;
	const projects = new InMemoryProjectRepository();
	const requirements = new InMemoryRequirementRepository();
	const index = new InMemoryProjectIndex();
	const tiles = createAssetId();

	const kitchen = makeProject({ name: names[0] });
	const bathroom = makeProject({ name: names[1] });
	for (const [project, folder] of [
		[kitchen, 'Renovation/Kitchen refit'],
		[bathroom, 'Renovation/Bathroom refit'],
	] as const) {
		if (saved) expectOk(await projects.save(project, 'absent'));
		if (indexed) {
			index.upsert({
				id: project.id,
				type: 'renovation-project',
				path: `${folder}/Project.md`,
				projectId: project.id,
			});
		}
	}

	const seeded: readonly (readonly [ProjectId, ReturnType<typeof createZoneId>])[] = [
		[kitchen.id, KITCHEN_ZONE],
		[kitchen.id, KITCHEN_ZONE],
		[bathroom.id, BATHROOM_ZONE],
	];
	for (const [projectId, zoneId] of seeded) {
		expectOk(
			await requirements.save(
				makeRequirement({ projectId, assetId: tiles, origin: { kind: 'zone', zoneId } }),
				'absent',
			),
		);
	}

	return {
		query: new ListRequirementsReferencing(requirements, projects, (id) => projectFolderOf(index, id)),
		requirements,
		projects,
		tiles,
		kitchen: kitchen.id,
		bathroom: bathroom.id,
	};
}

describe('ListRequirementsReferencing groups by project', () => {
	it("groups an asset's referents by project", async () => {
		const f = await fixture();
		const groups = expectOk(await f.query.execute({ kind: 'asset', assetId: f.tiles }));
		// A bare total fails this: two groups, not one count of three.
		expect(groups.map((g) => g.projectId)).toEqual([f.kitchen, f.bathroom]);
		expect(groups.map((g) => g.requirementIds.length)).toEqual([2, 1]);
		expect(groups.map((g) => g.projectName)).toEqual(['Kitchen refit', 'Bathroom refit']);
	});

	it('yields exactly one group for a zone target', async () => {
		// A Zone belongs to one project, so the Zone flow's existing single row is unchanged
		// in appearance and changed in derivation.
		const f = await fixture();
		const groups = expectOk(await f.query.execute({ kind: 'zone', zoneId: KITCHEN_ZONE }));
		expect(groups).toHaveLength(1);
		expect(groups[0]?.requirementIds).toHaveLength(2);
	});

	it('supplies projectPath — the FOLDER, not the note — where two projects share a name', async () => {
		// `Project.create` trims a name and rejects only an empty one, so two projects may
		// legitimately share one and nothing refuses it. This fixture is the ONLY way to
		// produce the case.
		const f = await fixture(['Refit', 'Refit']);
		const groups = expectOk(await f.query.execute({ kind: 'asset', assetId: f.tiles }));
		expect(groups.every((g) => g.projectPath !== undefined)).toBe(true);
		expect(groups.map((g) => g.projectPath)).toEqual([
			'Renovation/Kitchen refit',
			'Renovation/Bathroom refit',
		]);
	});

	it('omits projectPath when names are unambiguous', async () => {
		const f = await fixture();
		const groups = expectOk(await f.query.execute({ kind: 'asset', assetId: f.tiles }));
		// The length and the id assertion are what stop this passing against a flat list of
		// requirement ids, on which `g.projectPath` is `undefined` for the wrong reason.
		expect(groups.map((g) => g.projectId)).toEqual([f.kitchen, f.bathroom]);
		expect(groups.every((g) => g.projectPath === undefined)).toBe(true);
	});

	it('leaves projectPath undefined for a colliding project the index cannot place', async () => {
		// `projectFolderOf` REFUSES rather than defaulting when the index holds no note for
		// the id, and the ambiguity rule cannot invent what the resolver declined to answer.
		const f = await fixture(['Refit', 'Refit'], { indexed: false });
		const groups = expectOk(await f.query.execute({ kind: 'asset', assetId: f.tiles }));
		expect(groups.map((g) => g.projectName)).toEqual(['Refit', 'Refit']);
		expect(groups.every((g) => g.projectPath === undefined)).toBe(true);
	});

	it('names a group by its project id when the project note is gone', async () => {
		// A referent whose project note has been deleted still has to be shown: dropping the
		// group would hide requirements the user is about to strand.
		const f = await fixture(['Kitchen refit', 'Bathroom refit'], { saved: false });
		const groups = expectOk(await f.query.execute({ kind: 'asset', assetId: f.tiles }));
		expect(groups.map((g) => g.projectName)).toEqual([String(f.kitchen), String(f.bathroom)]);
	});

	it('propagates a failed project read rather than guessing a name', async () => {
		const f = await fixture();
		const failing = Object.assign(
			Object.create(Object.getPrototypeOf(f.projects) as object) as ProjectRepository,
			f.projects,
			{ getById: () => Promise.resolve(err(injectedPersistenceError())) },
		) as ProjectRepository;
		const query = new ListRequirementsReferencing(f.requirements, failing, () => undefined);
		expect(expectErr(await query.execute({ kind: 'asset', assetId: f.tiles })).code).toBe(
			'test.injected-failure',
		);
	});
});
