import type { ValidationError } from '../../../core/errors/AppError';
import type { EntityVersion, Loaded } from '../../ports/versioning';
import { checkExpectedVersion, revisionConflict } from '../../ports/versioning';
import type { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';

/**
 * What a rendered row believed about its pair: nothing, or one specific note at one version.
 * ONE field rather than two, so the id and the version cannot disagree.
 */
export type PriceRowExpectation = 'absent' | { readonly id: AssetPriceOverrideId; readonly version: EntityVersion };

/**
 * **Did the pair move under the caller since their row rendered?**
 *
 * This is `checkExpectedVersion` — the function `versionCheck.ts` already calls *"the ONE
 * comparison behind every conditional write"* — with an identity check in front of it. An
 * earlier draft of this plan hand-rolled a `revision`-only comparison here, which was wrong
 * three ways and is worth recording rather than quietly replacing:
 *
 * - it dropped `EntityVersion.observed`, whose whole job is to detect *"a change no plugin
 *   made (a hand edit, a sync)"* — the exact case this increment's own residuals say to
 *   expect, since these notes are user-editable;
 * - it collapsed two distinct outcomes into one code, where the vocabulary deliberately
 *   separates `revisionConflict` (another plugin writer) from `externalModification` (a hand
 *   edit) *"because the recoveries differ"*;
 * - and it recreated a duplication this repository had **already deleted once**:
 *   `checkExpected.ts` records that the in-memory store held its own copy of
 *   revision-then-token, "identical to `checkExpectedVersion` line for line".
 *
 * `checkExpectedVersion` therefore MOVES to `application/ports/versioning.ts`, beside the two
 * error factories it already returns. It is pure — its only imports are that vocabulary — and
 * it sits in `infrastructure/obsidian/` today by accident of who first needed it, which
 * `application/` may not import from. `versionOfFrontmatter` stays behind, because it reads
 * frontmatter. The move updates the importers named in Task 4's file list; it changes no
 * behaviour, and the existing suites are the check on that.
 *
 * The IDENTITY half is what `checkExpectedVersion` cannot answer, and it matters only because
 * duplicates are tolerated here: the row rendered one specific note, and a different note for
 * the same pair can carry the same revision. So the expectation is `{ id, version }` rather
 * than a bare version — one field the row fills from `overrideId`/`overrideVersion` together,
 * so the two cannot disagree.
 */
export function expectationMismatch(
	expected: PriceRowExpectation,
	found: Loaded<AssetPriceOverride> | null,
): ValidationError | null {
	if (expected === 'absent') {
		return found === null ? null : revisionConflict('asset-price', 'absent');
	}
	// A DIFFERENT note now wins the pair. Same revision is no comfort: ids are ULIDs and a
	// duplicate's winner can change without any revision moving.
	if (found !== null && found.entity.id !== expected.id) {
		return revisionConflict('asset-price', String(found.entity.id));
	}
	return checkExpectedVersion('asset-price', String(expected.id), found?.version, expected.version);
}
