import type { EntityVersion } from '../../../application/ports/versioning';
import { observeFrontmatter } from './digest';

/** The version of what is on disk right now: stored revision plus a fresh token. */
export function versionOfFrontmatter(frontmatter: Record<string, unknown>): EntityVersion {
	const revision = frontmatter['revision'];
	return {
		revision:
			typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 ? revision : 0,
		observed: observeFrontmatter(frontmatter),
	};
}
