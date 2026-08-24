import type { ValidationError } from '../../../core/errors/AppError';
import type { EntityVersion, Expected } from '../../../application/ports/versioning';
import { externalModification, revisionConflict } from '../../../application/ports/versioning';
import { observeFrontmatter } from './digest';

/**
 * The ONE comparison behind every conditional write (SDD §42 step 2b): revision first
 * (another plugin writer), then the observed token (a change no plugin made). Distinct
 * codes, because the caller's recovery differs — re-read and retry vs. surface a
 * conflict. Shared by all three Obsidian repositories and the geometry store.
 */
export function checkExpectedVersion(
	label: string,
	id: string,
	current: EntityVersion | undefined,
	expected: Expected,
): ValidationError | null {
	if (expected === 'absent') {
		return current === undefined ? null : revisionConflict(label, id);
	}
	if (current === undefined || current.revision !== expected.revision) {
		return revisionConflict(label, id);
	}
	if (current.observed !== expected.observed) return externalModification(label, id);
	return null;
}

/** The version of what is on disk right now: stored revision plus a fresh token. */
export function versionOfFrontmatter(frontmatter: Record<string, unknown>): EntityVersion {
	const revision = frontmatter['revision'];
	return {
		revision:
			typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 ? revision : 0,
		observed: observeFrontmatter(frontmatter),
	};
}
