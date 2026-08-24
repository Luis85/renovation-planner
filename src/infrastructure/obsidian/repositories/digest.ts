import { createHash } from 'node:crypto';
import type { ObservationToken } from '../../../application/ports/versioning';

/**
 * How an observation token is minted, and therefore what "external modification" MEANS
 * — this implementation's business, and nothing above `infrastructure/` knows it
 * (slice 3's contract).
 *
 * Two scopes, because the two file kinds are exposed differently:
 *
 * - A NOTE's token digests ONLY the frontmatter keys this plugin owns (the ones its
 *   schema declares). The note body and any undeclared key belong to the user, so prose
 *   edits and extra keys neither refuse a later save nor get clobbered by one.
 * - A SIDECAR's token digests the raw file text. Every key in the document is
 *   plugin-owned, and `.rpgeo` is deliberately a registered, openable file type
 *   (ADR-011), so ANY out-of-band change — including whitespace — makes the token stale
 *   and refuses the conditional write built on it.
 */

const OWNED_KEYS = [
	'type',
	'schema-version',
	'id',
	'revision',
	'name',
	'status',
	'project',
	'plan',
	'zone-type',
	'background-path',
	'background-kind',
	'background-page',
	'layers',
] as const;

function digest(text: string): ObservationToken {
	return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 32) as ObservationToken;
}

/** The token for a note, over its plugin-owned frontmatter keys alone. */
export function observeFrontmatter(frontmatter: Record<string, unknown>): ObservationToken {
	const owned = OWNED_KEYS.filter((key) => key in frontmatter)
		.toSorted()
		.map((key) => `${JSON.stringify(key)}:${JSON.stringify(frontmatter[key])}`);
	return digest(`v1|${owned.join('|')}`);
}

/** The token for a sidecar, over the whole file as it sits on disk. */
export function observeSidecar(rawText: string): ObservationToken {
	return digest(`v1|sidecar|${rawText}`);
}
