import type { PersistenceError } from '../../core/errors/AppError';
import type { Result } from '../../core/result/Result';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { Project } from '../../domain/project/Project';
import type { Query } from './Query';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { Loaded } from '../ports/versioning';

export interface GetProjectInput {
	readonly projectId: ProjectId;
}

/**
 * Passes the repository's "not found is ok(null)" answer straight through rather than
 * converting it into a ReferenceError: a caller asking "is there a Project with this
 * id" is asking a question, and slice 14's empty states need to tell "no such entity"
 * (ok(null)) apart from "the read failed" (isErr). Returns `Loaded<T>` so a caller that
 * loads in order to write already holds the version.
 */
export class GetProject
	implements Query<GetProjectInput, Result<Loaded<Project> | null, PersistenceError>>
{
	constructor(private readonly projects: ProjectRepository) {}

	execute({ projectId }: GetProjectInput) {
		return this.projects.getById(projectId);
	}
}
