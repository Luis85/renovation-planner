import type { ObservationToken } from '../../../application/ports/versioning';
import { ASSET_TYPE, AssetFrontmatterSchemaV1 } from '../../persistence/dto/assetFrontmatter';
import { ASSET_PRICE_TYPE, AssetPriceFrontmatterSchemaV1 } from '../../persistence/dto/assetPriceFrontmatter';
import { PLAN_TYPE, PlanFrontmatterSchemaV1 } from '../../persistence/dto/planFrontmatter';
import { PROJECT_TYPE, ProjectFrontmatterSchemaV1 } from '../../persistence/dto/projectFrontmatter';
import { REQUIREMENT_TYPE, RequirementFrontmatterSchemaV1 } from '../../persistence/dto/requirementFrontmatter';
import { ZONE_TYPE, ZoneFrontmatterSchemaV1 } from '../../persistence/dto/zoneFrontmatter';

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
 * - A NOTE's token digests ONLY the frontmatter keys this plugin owns in a note of THAT
 *   KIND — the ones that note's own schema declares, never the union of all six (see
 *   `OWNED_KEYS_BY_TYPE`). The note body and any key that schema does not declare belong
 *   to the user, so prose edits and extra keys neither refuse a later save nor get
 *   clobbered by one.
 * - A SIDECAR's token digests the raw file text. Every key in the document is
 *   plugin-owned, and `.rpgeo` is deliberately a registered, openable file type
 *   (ADR-011), so ANY out-of-band change — including whitespace — makes the token stale
 *   and refuses the conditional write built on it.
 */

/**
 * What each note KIND owns, derived from the six frontmatter schemas rather than
 * transcribed beside them.
 *
 * It used to be one hand-written array covering every kind at once, and that union is a
 * different rule from the one the paragraph above states. `description`, `start` and
 * `target-completion` (design slice 16) made the difference visible: they belong to a
 * project note, and a ZONE note carrying a user's own `description` had it digested too —
 * so editing that property refused the zone's next save with `zone.external-modification`,
 * for a key the Zone schema does not declare and `writeOwnedFrontmatter` never writes.
 * Measured before it was fixed, and true of the earlier union as well (an asset's `notes`
 * on a plan note, and so on) — slice 16 only widened it into keys a user is likely to have.
 *
 * Derived and not listed, because a second list is exactly how the first one drifted: a key
 * added to a schema is owned the day it is added, in the digest and in the write, with
 * nothing to keep in step.
 */
const SCHEMAS: readonly (readonly [string, { readonly shape: Readonly<Record<string, unknown>> }])[] = [
	[PROJECT_TYPE, ProjectFrontmatterSchemaV1],
	[PLAN_TYPE, PlanFrontmatterSchemaV1],
	[ZONE_TYPE, ZoneFrontmatterSchemaV1],
	[ASSET_TYPE, AssetFrontmatterSchemaV1],
	[REQUIREMENT_TYPE, RequirementFrontmatterSchemaV1],
	[ASSET_PRICE_TYPE, AssetPriceFrontmatterSchemaV1],
];

const OWNED_KEYS_BY_TYPE: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
	SCHEMAS.map(([type, schema]) => [type, Object.keys(schema.shape).toSorted()]),
);

/**
 * The fallback for a note whose `type` is none of the six: every key any schema declares.
 *
 * Deliberately the WIDER answer rather than the empty one. A token over no keys at all
 * would move for nothing, so a note this plugin somehow wrote without a recognisable type
 * could be overwritten by a conditional write that had checked nothing — the failure mode
 * this whole mechanism exists to prevent. The cost of being wide here is a refusal the user
 * can clear by re-reading; the cost of being narrow is a lost edit.
 */
const EVERY_OWNED_KEY: readonly string[] = [
	...new Set(Object.values(OWNED_KEYS_BY_TYPE).flat()),
].toSorted();

/** The keys a note of this `type` owns — its own schema's, or the union when the type is not ours. */
function ownedKeysFor(type: unknown): readonly string[] {
	return (typeof type === 'string' ? OWNED_KEYS_BY_TYPE[type] : undefined) ?? EVERY_OWNED_KEY;
}

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
	const owned = ownedKeysFor(frontmatter['type'])
		.filter((key) => key in frontmatter)
		.toSorted()
		.map((key) => `${JSON.stringify(key)}:${JSON.stringify(frontmatter[key])}`);
	return digest(`v1|${owned.join('|')}`);
}

/** The token for a sidecar, over the whole file as it sits on disk. */
export function observeSidecar(rawText: string): ObservationToken {
	return digest(`v1|sidecar|${rawText}`);
}
