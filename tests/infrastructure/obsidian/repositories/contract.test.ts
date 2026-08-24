import { describe } from 'vitest';
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

		const projectPath = `${folder}/${project.name} ${project.id}.md`;
		plantNote(stack, projectPath, 'renovation-project', {
			...projectToStorage(project),
			id: project.id,
			name: project.name,
			project: undefined,
			plan: undefined,
		});

		const planPath = `${plansFolderFor(folder)}/${plan.name} ${plan.id}.md`;
		plantNote(stack, planPath, 'renovation-plan', {
			type: 'renovation-plan',
			'schema-version': 1,
			revision: 1,
			id: plan.id,
			name: plan.name,
			project: plan.projectId,
			plan: undefined,
			'background-path': '',
			'background-kind': 'image',
			'background-page': null,
			layers: [],
		});
		fixEntry(stack, plan.id, (entry) => ({ ...entry, projectId: plan.projectId }));

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

// Local helpers kept tiny and honest about what the storage shape is.
function projectToStorage(project: Project): Record<string, unknown> {
	return {
		type: 'renovation-project',
		'schema-version': 1,
		revision: 1,
		status: String(project.status).replace(/_/g, '-').toLowerCase(),
	};
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
