import type { ValidationError } from '../../../core/errors/AppError';
import { currencyOf, type Currency } from '../../../core/money/Money';
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

/**
 * `Project.start`/`targetCompletion` on the wire: date-only, UTC, always — never a
 * timestamp, never local time. Declared once so both keys and both directions share one
 * rule rather than drifting a day apart from each other.
 *
 * `toDateOnly` guards nothing and must not: `toISOString()` throws a `RangeError` on an
 * `Invalid Date`, and the reason it can never receive one is that `Project.create` refuses
 * a non-finite date at the domain boundary and the constructor is private, so no other
 * `Project` exists. A second guard here would be a second answer to the same question,
 * and the one that answered `null` would silently drop a date rather than refuse it.
 * `fromDateOnly` is safe for a different reason worth keeping distinct: `DATE_ONLY` in
 * `projectFrontmatter.ts` refuses a date-shaped string the calendar does not hold and
 * `.catch(null)`s it, so nothing that reaches here parses to `NaN`.
 */
function toDateOnly(date: Date | null): string | null {
	return date === null ? null : date.toISOString().slice(0, 10);
}

function fromDateOnly(value: string | null): Date | null {
	return value === null ? null : new Date(`${value}T00:00:00Z`);
}

export function projectToPersistence(project: Project, revision: number): Record<string, unknown> {
	return {
		type: PROJECT_TYPE,
		'schema-version': 1,
		id: project.id,
		revision,
		name: project.name,
		status: toKebab(project.status),
		description: project.description,
		start: toDateOnly(project.start),
		'target-completion': toDateOnly(project.targetCompletion),
		currency: project.currency,
	};
}

function fromDto(dto: ProjectFrontmatterDTO, defaultCurrency: Currency): Result<Project, ValidationError> {
	return Project.create({
		id: dto.id as Project['id'],
		name: dto.name,
		status: dto.status,
		description: dto.description,
		start: fromDateOnly(dto.start),
		targetCompletion: fromDateOnly(dto['target-completion']),
		// The schema has already refused any spelling that is not `/^[A-Z]{3}$/`, so this is
		// a program-safe value and `currencyOf` is the right door. The only branch here is
		// the absence, and both of its arms have a test.
		currency: dto.currency === null ? defaultCurrency : currencyOf(dto.currency),
	});
}

/** Parse (already-migrated) raw frontmatter through the versioned schema, then construct. */
export function projectFromPersistence(
	raw: unknown,
	defaultCurrency: Currency,
): Result<Project, ValidationError> {
	const parsed = parsePersisted(ProjectFrontmatterSchemaV1, raw, 'project.frontmatter-invalid', 'Project note');
	if (!parsed.ok) return parsed;
	return fromDto(parsed.value, defaultCurrency);
}
