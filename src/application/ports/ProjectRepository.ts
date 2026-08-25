import type { Result } from '../../core/result/Result';
import type { Project } from '../../domain/project/Project';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { Expected, EntityVersion, Loaded } from './versioning';
import type { RepositoryError } from './repositoryErrors';

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
	listAll(): Promise<Result<Loaded<Project>[], RepositoryError>>;
}
