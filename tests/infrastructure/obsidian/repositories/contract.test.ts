import { describe, expect, it } from 'vitest';
import {
	createRepositoryStack,
	serializeFrontmatter,
	parseFrontmatter,
	type RepositoryStack,
} from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import {
	createPlanId,
	type PlanId,
} from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import type { Plan } from '../../../../src/domain/plan/Plan';
import type { Project } from '../../../../src/domain/project/Project';
import { projectRepositoryContract } from '../../../contracts/project-repository.contract';
import { planRepositoryContract } from '../../../contracts/plan-repository.contract';
import { zoneRepositoryContract } from '../../../contracts/zone-repository.contract';
import { normalizeFolder, plansFolderFor, sidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { projectToPersistence } from '../../../../src/infrastructure/persistence/mappers/projectMapper';
import { planToPersistence } from '../../../../src/infrastructure/persistence/mappers/planMapper';

/**
 * Slice 4's half of SDD §72: THE SAME suites slice 3 wrote against the in-memory
 * repositories, imported verbatim, run against the Obsidian-backed ones. The suite body
 * was not edited to accommodate this side; only fixtures live here.
 *
 * The fixture hooks are synchronous BY CONTRACT (`touch` and `otherParents` return
 * plain values in the shared suites), so anything the real persistence needs on disk
 * before a Zone can exist — its Project note, its Plan note, the Plan's sidecar, their
 * index entries — is planted directly here, in exactly the layout and byte shape the
 * repositories themselves produce.
 */

/** A hand edit: rewrites an OWNED key's value outside any repository — token moves, revision does not. */
function handEdit(stack: RepositoryStack, id: string): void {
	const path = stack.index.getPath(id as EntityId<string>);
	if (!path) throw new Error(`nothing indexed under ${id}`);
	const text = stack.vault.entries.get(path);
	if (text === undefined) throw new Error(`no note at ${path}`);
	const { frontmatter, body } = parseFrontmatter(text);
	frontmatter['name'] = `${frontmatter['name']} (edited by hand)`;
	stack.vault.entries.set(path, `${serializeFrontmatter(frontmatter)}${body}`);
}

function plantNote(
	stack: RepositoryStack,
	path: string,
	type: 'renovation-project' | 'renovation-plan',
	owned: Record<string, unknown>,
): void {
	stack.vault.entries.set(path, serializeFrontmatter(owned));
	stack.index.upsert({
		id: owned['id'] as EntityId<string>,
		type,
		path,
		projectId: owned['project'] as ProjectId | undefined,
		planId: owned['plan'] as PlanId | undefined,
	});
}

function fixEntry(
	stack: RepositoryStack,
	id: EntityId<string>,
	patch: (entry: { id: EntityId<string>; type: string; path: string; projectId?: ProjectId; planId?: PlanId; geometrySidecarPath?: string }) => {
		id: EntityId<string>;
		type: string;
		path: string;
		projectId?: ProjectId;
		planId?: PlanId;
		geometrySidecarPath?: string;
	},
): void {
	const entry = stack.index.entries().find((candidate) => candidate.id === id);
	if (entry) stack.index.upsert(patch(entry) as never);
}

projectRepositoryContract(() => {
	const stack = createRepositoryStack();
	return {
		repository: stack.projects,
		makeProject: (name?: string) => makeProjectEntity(name ? { name } : undefined),
		touch: (id) => handEdit(stack, id),
	};
});

planRepositoryContract(() => {
	const stack = createRepositoryStack();
	return {
		repository: stack.plans,
		makePlan: (projectId: ProjectId, name?: string) => makePlanEntity({ projectId, ...(name ? { name } : {}) }),
		touch: (id) => handEdit(stack, id),
		otherProject: () => createProjectId(),
	};
});

zoneRepositoryContract(() => {
	const stack = createRepositoryStack();
	const folder = normalizeFolder(stack.projectFolder);

	function provision(): { projectId: ProjectId; planId: PlanId } {
		const projectId = createProjectId();
		const planId = createPlanId();
		const project: Project = makeProjectEntity({ id: projectId });
		const plan: Plan = makePlanEntity({ id: planId, projectId });

		// Through the REAL mappers, not a hand-copied shape. A hand-built record is a second
		// answer to what a note holds: it drifts silently the day a mapper adds, renames or
		// re-spells a key, and the Obsidian-side contract run then passes against a layout
		// the repositories no longer write. `revision: 1` is what a first save records.
		const projectPath = `${folder}/${project.name} ${project.id}.md`;
		plantNote(stack, projectPath, 'renovation-project', projectToPersistence(project, 1));

		// `plantNote` reads `project` straight out of the record for the index entry, and
		// the mapper puts it there — so no separate patch for `projectId` is needed.
		const planPath = `${plansFolderFor(folder)}/${plan.name} ${plan.id}.md`;
		plantNote(stack, planPath, 'renovation-plan', planToPersistence(plan, 1));

		const sidecarPath = sidecarPathFor(folder, plan.id);
		stack.vault.entries.set(
			sidecarPath,
			JSON.stringify(
				{ schemaVersion: 1, planId: plan.id, revision: 1, unit: 'mm', calibration: null, objects: [] },
				null,
				'\t',
			),
		);
		fixEntry(stack, plan.id, (entry) => ({ ...entry, geometrySidecarPath: sidecarPath }));

		return { projectId, planId };
	}

	return {
		repository: stack.zones,
		makeZone: (projectId, planId, name?) => makeZoneEntity({ projectId, planId, ...(name ? { name } : {}) }),
		touch: (id) => handEdit(stack, id),
		otherParents: () => provision(),
		otherProject: () => createProjectId(),
	};
});

/**
 * The defect that shipped with slice 4 and was found by running slice 5's
 * `create-sample-project` in a real vault for the first time.
 *
 * Obsidian populates its `MetadataCache` ASYNCHRONOUSLY, so a note read back in the same
 * tick it was created has no cache entry at all. `frontmatterOf` answered `{}` for that,
 * every caller read the missing `schema-version` as version 0, and the migration runner —
 * which has no step from 0, because schema 1 is the first — threw `chain-gap`. So the read
 * failed with "Migrating the project note failed" on a note that had just been written
 * perfectly well, and `CreatePlanCommand`, which reads its Project back to validate the
 * reference, could never create a Plan.
 *
 * Driven through the REPOSITORIES rather than through the seed, because the defect is
 * theirs: any create-then-read pays it, and slice 15's creation dialogs would have paid it
 * next. `FakeMetadataCache` is what makes this reachable — it used to parse the vault's own
 * text synchronously, which is why 860 green tests said nothing about it.
 */
describe('reading a note back inside Obsidian’s parse window', () => {
	it('reads a project the repository has only just created', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();

		expectOk(await stack.projects.save(project, 'absent'));
		// No `catchUp()`: this is the window, and the assertion is that it works IN it.
		expect(stack.metadataCache.getFileCache(stack.vault.getAbstractFileByPath(stack.index.getPath(project.id) as string) as never)).toBeNull();

		const read = expectOk(await stack.projects.getById(project.id));

		expect(read?.entity.name).toBe(project.name);
		// The revision too: it comes from the same frontmatter, and a fallback that answered
		// the entity but not its version would refuse the next conditional write.
		expect(read?.version.revision).toBe(1);
	});

	it('creates a plan under a project created in the same tick', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));

		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));

		// Both readable, both still inside the window — the exact sequence the sample
		// project performs, and the one that failed in the vault.
		expect(expectOk(await stack.plans.getById(plan.id))?.entity.projectId).toBe(project.id);
		expect(expectOk(await stack.projects.getById(project.id))?.entity.id).toBe(project.id);
	});

	/**
	 * The other half of the same fix, and the reason `frontmatterOf` keys on the cache
	 * ENTRY rather than on its `frontmatter` field: a note Obsidian HAS parsed and found no
	 * frontmatter in must not be answered from what this plugin last wrote there, or a user
	 * deleting a note's frontmatter would be served stale bytes for the rest of the session.
	 */
	it('does not serve its own last write for a note whose frontmatter was deleted', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const path = stack.index.getPath(project.id) as string;

		stack.vault.entries.set(path, 'someone deleted the frontmatter');

		expect((await stack.projects.getById(project.id)).ok).toBe(false);
	});
});

/**
 * The second defect a live vault found, on the very next command after the parse-window one
 * was fixed: "the geometry sidecar could not be created".
 *
 * ADR-011 puts a Plan's sidecar in a `Geometry/` folder of its own, and `PlanGeometryStore`
 * went straight to `vault.create` for it. The project, plans and zones folders each get an
 * `ensureFolder` from the repository that writes into them; `Geometry/` had none, and no
 * note ever lands there to create it as a side effect. Obsidian refuses a create whose
 * parent does not exist, so on a fresh vault the FIRST write of the FIRST plan failed — and
 * because the sidecar is written before the note, the plan save failed outright.
 *
 * `FakeVault.create` accepted a missing parent, which is why 869 green tests said nothing.
 * It refuses now, and making it refuse turned 86 tests red at once.
 */
describe('writing into a folder nothing has created yet', () => {
	it('creates a plan into an empty vault, geometry folder and all', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));

		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));

		// The sidecar exists, at the path the index maps the plan to — not merely "the save
		// returned ok", which is what a fake with no folders would have allowed.
		const sidecarPath = stack.index.getGeometrySidecarPath(plan.id);
		expect(sidecarPath).toBe(sidecarPathFor(normalizeFolder(stack.projectFolder), plan.id));
		expect(stack.vault.entries.has(sidecarPath as string)).toBe(true);
	});

	/**
	 * The whole sequence the sample project runs, into a vault with nothing in it — the one
	 * that failed in Obsidian twice for two different reasons. A zone as well as a plan,
	 * because the Zones folder is a third folder and the sidecar MUTATION path is the one
	 * that reads the file back.
	 */
	it('creates a project, a plan and a zone with no folders in place', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));
		const zone = makeZoneEntity({ projectId: project.id, planId: plan.id });
		expectOk(await stack.zones.save(zone, 'absent'));

		expect(expectOk(await stack.zones.listByPlan(plan.id))).toHaveLength(1);
	});
	/**
	 * The geometry sidecar is PLAN-grained: one vault read, one JSON parse, one migration
	 * and one Zod validation of every spatial object in the plan. Loading N zones by
	 * calling `getById` N times therefore did N of those — O(N) file reads and O(N²) point
	 * validations to answer one listing — and the Plan Editor's post-command refresh
	 * re-hydrates the whole plan after every drag release, drawn polygon, delete and Undo
	 * press.
	 *
	 * Counted at the vault rather than argued about: a memo that quietly stopped memoising
	 * would answer every other assertion in this file identically.
	 */
	it('reads a plan geometry sidecar ONCE per listing, not once per zone', async () => {
		const stack = createRepositoryStack();
		const project = makeProjectEntity();
		expectOk(await stack.projects.save(project, 'absent'));
		const plan = makePlanEntity({ projectId: project.id });
		expectOk(await stack.plans.save(plan, 'absent'));
		for (let index = 0; index < 4; index += 1) {
			expectOk(await stack.zones.save(makeZoneEntity({ projectId: project.id, planId: plan.id }), 'absent'));
		}

		stack.vault.operations.length = 0;
		expect(expectOk(await stack.zones.listByPlan(plan.id))).toHaveLength(4);

		const sidecarReads = stack.vault.operations.filter(
			(operation) => operation.startsWith('read:') && operation.includes('Geometry/'),
		);
		expect(sidecarReads).toHaveLength(1);
	});
});
