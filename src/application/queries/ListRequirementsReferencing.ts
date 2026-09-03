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
 * Where a project IS: the path of its own `Project.md`, and the folder that note sits in.
 *
 * BOTH, because the row below needs both and the folder is derived from the path — so a
 * lookup answering one of them would leave the other to be derived a second time, at a call
 * site that cannot reach `parentOf` (it lives in `infrastructure/`, above an `obsidian`
 * import this layer may not name). One value carrying both makes a folder that disagrees
 * with its path unrepresentable.
 */
export interface ProjectLocation {
	/** The project note's own path — the discriminator where two projects share a folder. */
	readonly path: string;
	/** `parentOf(path)`, and `''` for a note at the vault root — a real answer, not an absence. */
	readonly folder: string;
}

/**
 * Where a project's note is, as a collaborator rather than as an import.
 *
 * A project's location is DERIVED — its folder is wherever its `Project.md` sits (ADR-0013) —
 * and the one function that derives it (`projectLocationOf`) lives in `infrastructure/`,
 * beside the rest of the path vocabulary and above an `obsidian` import this layer may not
 * name. So the composition root binds that same function here rather than this module
 * deriving a location for the second time: two derivations of one rule is exactly the drift a
 * single injected lookup cannot have.
 *
 * **It answers the NOTE PATH as well as the folder, and that widening is the Asset library's
 * §3.5.** A folder-only lookup cannot separate two projects sharing a display name AND a
 * directory, which is a vault nothing refuses — no command decides which directory a project's
 * note sits in — and an instruction to *display the full path* leaves an implementation with
 * nothing to display.
 *
 * `undefined` is the resolver REFUSING (the index holds no note for that id), and it stays
 * a refusal here: an unplaceable project gets no path rather than a guessed one.
 */
export type ProjectLocationLookup = (projectId: ProjectId) => ProjectLocation | undefined;

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
	/**
	 * Only where `projectName` is not unique among the groups returned — the project's FOLDER
	 * ordinarily, and its whole NOTE PATH where the folder does not separate the colliding
	 * rows either.
	 *
	 * Read it against `undefined` and never for truthiness: `''` is a supplied answer, for a
	 * `Project.md` sitting at the vault root, and a truthy test suppresses exactly the row the
	 * path was added to disambiguate.
	 *
	 * It is never the row's KEY. `projectId` is, being the only field unique by construction.
	 */
	readonly projectPath?: string;
	readonly requirementIds: readonly RequirementId[];
}

/**
 * The keys more than one item answers to — the colliding half of a tally.
 *
 * A SET of the colliding keys rather than a second `counts.get` at the map step: that second
 * lookup can never miss, so its own absent arm would be a branch no fixture can reach — and an
 * unreachable arm is not free against a coverage floor.
 *
 * Shared by both levels of the ambiguity rule below, which is what keeps "the name collides"
 * and "the folder collides too" one question asked twice rather than two spellings of it.
 */
function collidingKeys<T>(items: readonly T[], keyOf: (item: T) => string): ReadonlySet<string> {
	const counts = new Map<string, number>();
	for (const item of items) {
		const key = keyOf(item);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

/**
 * A name and a folder as ONE key, joined by a character no path can hold, so that
 * `('Refit', 'a/b')` and `('Refit/a', 'b')` cannot collide by accident.
 */
function nameAndFolder(projectName: string, folder: string): string {
	return `${projectName}\u0000${folder}`;
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
		private readonly locationOf: ProjectLocationLookup,
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
	 *
	 * **TWO levels, because a folder does not always separate the rows it is added to.** Two
	 * notes declaring `type: renovation-project` can sit in ONE directory under different
	 * filenames, so two colliding names can share a folder as well — and the disambiguator then
	 * disambiguates nothing. Where that happens the discriminator is the project note's own
	 * path, which is unique by construction; everywhere else the folder stands, which is what
	 * keeps `''` (a note at the vault root) a supplied answer with a label of its own rather
	 * than a filename nobody asked for.
	 *
	 * A location the resolver DECLINED leaves the group untouched, exactly as an unambiguous
	 * name does: the ambiguity rule cannot invent what the index could not place.
	 */
	private withPathsWhereAmbiguous(groups: readonly ReferencingGroup[]): readonly ReferencingGroup[] {
		const ambiguousNames = collidingKeys(groups, (group) => group.projectName);
		const located = groups.map((group) => ({
			group,
			// Resolved for the colliding groups ALONE, so an unambiguous listing costs no index
			// lookups at all — the common case, and the one this rule exists not to clutter.
			location: ambiguousNames.has(group.projectName) ? this.locationOf(group.projectId) : undefined,
		}));
		const ambiguousFolders = collidingKeys(
			located.filter((entry) => entry.location !== undefined),
			(entry) => nameAndFolder(entry.group.projectName, entry.location?.folder ?? ''),
		);
		return located.map(({ group, location }) => {
			if (location === undefined) return group;
			const folderCollides = ambiguousFolders.has(nameAndFolder(group.projectName, location.folder));
			return { ...group, projectPath: folderCollides ? location.path : location.folder };
		});
	}
}
