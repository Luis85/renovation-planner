import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RequirementRepository } from '../ports/RequirementRepository';

export type ReferencedTarget =
	| { readonly kind: 'zone'; readonly zoneId: ZoneId }
	| { readonly kind: 'asset'; readonly assetId: AssetId };

/**
 * Where a project's folder comes from, as a collaborator rather than as an import.
 *
 * A project's folder is DERIVED — the folder its `Project.md` sits in (ADR-0013) — and the
 * one function that derives it (`projectFolderOf`) lives in `infrastructure/`, beside the
 * rest of the path vocabulary and above an `obsidian` import this layer may not name. So
 * the composition root binds that same function here rather than this module deriving a
 * folder for the second time: two derivations of one rule is exactly the drift a single
 * injected lookup cannot have.
 *
 * `undefined` is the resolver REFUSING (the index holds no note for that id), and it stays
 * a refusal here: an unplaceable project gets no path rather than a guessed one.
 */
export type ProjectFolderLookup = (projectId: ProjectId) => string | undefined;

/**
 * One project's referents — what slice 15's delete-confirmation dialog draws a row from,
 * and what the resolution owes BACK to the command as `resolvedReferents`.
 *
 * GROUPED rather than flat since design slice 19, because an Asset is a vault-level
 * catalogue entry owned by no project: its referents are no longer all in the project the
 * user is looking at, and a bare total then reads as "in the project I am looking at",
 * which is exactly what they are not. A Zone still yields exactly one group — unchanged in
 * appearance, changed in derivation.
 *
 * IDs rather than a count, because the command compares SETS, not numbers.
 */
export interface ReferencingGroup {
	readonly projectId: ProjectId;
	readonly projectName: string;
	/** Only where `projectName` is not unique among the groups returned. */
	readonly projectPath?: string;
	readonly requirementIds: readonly RequirementId[];
}

/**
 * Every requirement referencing the target, grouped by the project it belongs to — what
 * slice 15's delete-confirmation flow shows BEFORE the dialog.
 *
 * §58/§59 route this through a query so presentation never holds a repository handle.
 */
export class ListRequirementsReferencing {
	constructor(
		private readonly requirements: RequirementRepository,
		private readonly projects: ProjectRepository,
		private readonly folderOf: ProjectFolderLookup,
	) {}

	async execute(target: ReferencedTarget): Promise<Result<readonly ReferencingGroup[], RepositoryError>> {
		const listed = target.kind === 'zone'
			? await this.requirements.listByZone(target.zoneId)
			: await this.requirements.listByAsset(target.assetId);
		if (isErr(listed)) return listed;

		const byProject = new Map<ProjectId, RequirementId[]>();
		for (const loaded of listed.value) {
			const held = byProject.get(loaded.entity.projectId);
			if (held) held.push(loaded.entity.id);
			else byProject.set(loaded.entity.projectId, [loaded.entity.id]);
		}

		const named: ReferencingGroup[] = [];
		for (const [projectId, requirementIds] of byProject) {
			const loaded = await this.projects.getById(projectId);
			if (isErr(loaded)) return loaded;
			// A project note that is GONE still owes a group: dropping it would hide the very
			// requirements the user is about to strand. The id is the only name left to give.
			named.push({ projectId, projectName: loaded.value?.entity.name ?? String(projectId), requirementIds });
		}
		return ok(this.withPathsWhereAmbiguous(named));
	}

	/**
	 * A path beside every row is noise on the common case; a missing path where two names
	 * collide renders two identical rows for the two things the user is choosing between.
	 * `Project.create` trims a name and rejects only an empty one, so a collision is a thing
	 * a vault legitimately holds and nothing refuses.
	 */
	private withPathsWhereAmbiguous(groups: readonly ReferencingGroup[]): readonly ReferencingGroup[] {
		const counts = new Map<string, number>();
		for (const group of groups) counts.set(group.projectName, (counts.get(group.projectName) ?? 0) + 1);
		// A SET of the colliding names rather than a second `counts.get` at the map step: that
		// second lookup can never miss, so its own absent arm would be a branch no fixture can
		// reach — and an unreachable arm is not free against a coverage floor.
		const ambiguous = new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
		return groups.map((group) =>
			ambiguous.has(group.projectName)
				? { ...group, projectPath: this.folderOf(group.projectId) }
				: group,
		);
	}
}
