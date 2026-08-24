import type { ValidationError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import { Project } from '../../../domain/project/Project';
import { ProjectFrontmatterSchemaV1, PROJECT_TYPE, type ProjectFrontmatterDTO } from '../dto/projectFrontmatter';
import { toKebab } from '../dto/kebab';
import { parsePersisted } from './parse';

/**
 * The Project mapper: frontmatter ↔ domain entity, never partial (SDD §37). Raw
 * frontmatter never crosses this module in either direction.
 *
 * The revision is an ARGUMENT on the way down rather than a field read off the entity:
 * it is persistence bookkeeping (`Loaded<T>.version`), not domain state, and the
 * repository — which owns the compare-and-swap — is what knows the value the next write
 * carries.
 *
 * The two directions are typed differently ON PURPOSE: what a WRITE produces is the
 * storage shape (kebab-case vocabulary, plain records — exactly what lands in the note),
 * while what a READ produces has passed the schema and carries the domain's own union
 * types. One type for both would lie to one of them.
 */
export function projectToPersistence(project: Project, revision: number): Record<string, unknown> {
	return {
		type: PROJECT_TYPE,
		'schema-version': 1,
		id: project.id,
		revision,
		name: project.name,
		status: toKebab(project.status),
	};
}

function fromDto(dto: ProjectFrontmatterDTO): Result<Project, ValidationError> {
	return Project.create({
		id: dto.id as Project['id'],
		name: dto.name,
		status: dto.status,
	});
}

/** Parse (already-migrated) raw frontmatter through the versioned schema, then construct. */
export function projectFromPersistence(raw: unknown): Result<Project, ValidationError> {
	const parsed = parsePersisted(ProjectFrontmatterSchemaV1, raw, 'project.frontmatter-invalid', 'Project note');
	if (!parsed.ok) return parsed;
	return fromDto(parsed.value);
}
