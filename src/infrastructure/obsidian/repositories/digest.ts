import type { ObservationToken } from '../../../application/ports/versioning';

/**
 * How an observation token is minted, and therefore what "external modification" MEANS
 * — this implementation's business, and nothing above `infrastructure/` knows it
 * (slice 3's contract).
 *
 * The hash itself is deliberately NOT node:crypto: the plugin runs on mobile too, where
 * Node built-ins do not exist, and these tokens are never persisted or compared across
 * machines — they are recomputed from disk content on every read and compared against
 * tokens minted the same way in this session. A wide, well-mixed 64-bit FNV-style digest
 * is deterministic, dependency-free, and fully sufficient for that job.
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
	// Project notes (design slice 16, Task 5a). Omitted when they were added, which broke
	// BOTH halves of this file's rule at once for three keys: `writeOwnedFrontmatter`'s
	// `Object.assign` clobbers a user's hand-edited `description` while a token that excludes
	// it cannot refuse the save doing the clobbering. `digest.test.ts` derives this set from
	// the five schemas now, so the next key added there fails there rather than shipping.
	'description',
	'start',
	'target-completion',
	'plan',
	'zone-type',
	'background-path',
	'background-kind',
	'background-page',
	'layers',
	// Asset notes (design slice 10).
	'category',
	'supplier',
	'sku',
	'unit',
	'unit-cost',
	'currency',
	'waste-factor-default',
	'notes',
	// Requirement notes (design slice 10) — including every `calculated-from-*` input,
	// whose loss is invisible precisely because the read model keeps working without them.
	'asset',
	'origin-kind',
	'origin-zone',
	'waste-factor',
	'quantity-calculated',
	'quantity-override',
	'cost-calculated',
	'cost-override',
	'calculated-from-area',
	'calculated-from-unit-cost',
	'calculated-from-asset-unit',
	'recalculation-status',
	'required-date',
] as const;

/** 64-bit FNV-1a over UTF-8 bytes, hex-encoded — stable across sessions and platforms. */
function digest(text: string): ObservationToken {
	let high = 0x9e3779b9;
	let low = 0x85ebca6b;
	for (let index = 0; index < text.length; index += 1) {
		const codeUnit = text.charCodeAt(index);
		const bytes = codeUnit < 0x80
			? [codeUnit]
			: codeUnit < 0x800
				? [0xc0 | (codeUnit >> 6), 0x80 | (codeUnit & 0x3f)]
				: [0xe0 | (codeUnit >> 12), 0x80 | ((codeUnit >> 6) & 0x3f), 0x80 | (codeUnit & 0x3f)];
		for (const byte of bytes) {
			high = (high ^ byte) >>> 0;
			high = Math.imul(high, 0x01000193) >>> 0;
			low = (low ^ byte) >>> 0;
			low = Math.imul(low, 0x1000193d) >>> 0;
			low = ((low << 1) | (high >>> 31)) >>> 0;
		}
	}
	return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}` as ObservationToken;
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
