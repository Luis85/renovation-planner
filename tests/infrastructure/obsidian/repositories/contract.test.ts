import {
	createRepositoryStack,
	serializeFrontmatter,
	parseFrontmatter,
	type RepositoryStack,
} from '../../../helpers/vault';
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
