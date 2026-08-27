import type { Result } from '../../core/result/Result';
import type { Project } from '../../domain/project/Project';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { Expected, EntityVersion, Loaded } from './versioning';
import type { RepositoryError } from './repositoryErrors';

/**
 * What a listing answers: the projects that LOADED, and how many notes refused to.
 *
 * `refused` is what keeps "this vault has no projects" and "this vault has no READABLE
 * projects" different facts. Without it, a vault whose only three project notes are
 * unreadable answers `ok({ loaded: [] })` and the view renders onboarding copy inviting the
 * user to create their first project — a real, actionable problem hidden behind a cheerful
 * invitation, which is the failure this codebase warns against in three separate docblocks.
 *
 * A COUNT and deliberately not a list of ids: WHICH notes refused is already recorded per
 * entity in the diagnostics ledger by `getById`, and a second copy of that detail here would
 * be a second answer to the same question. The count is all the view needs, because the copy
 * it renders is count-free.
 */
export interface ProjectListing {
	readonly loaded: readonly Loaded<Project>[];
	readonly refused: number;
}

/**
 * The root aggregate's port. Every method is `Result`-returning because slice 4's real
 * implementation can fail on every one of them — a read is a Vault file read plus a
 * parse, not a Map lookup. "Not found" is `ok(null)`, never an error.
 */
export interface ProjectRepository {
	getById(id: ProjectId): Promise<Result<Loaded<Project> | null, RepositoryError>>;
	save(
		project: Project,
		expected: Expected,
	): Promise<Result<Loaded<Project>, RepositoryError>>;
	delete(id: ProjectId, expected: EntityVersion): Promise<Result<void, RepositoryError>>;
	listAll(): Promise<Result<ProjectListing, RepositoryError>>;
}
