import type { ValidationError } from '../../core/errors/AppError';

/**
 * The conditional-write vocabulary, declared ONCE and shared by every entity port
 * (SDD §36 extended per design slice 3's "Writes are conditional").
 *
 * - `ObservationToken` is opaque above `infrastructure/`: minted by the repository at
 *   read time from what the bytes looked like, threaded to the write that presents it,
 *   never parsed or compared by anything in `application/` or `domain/`. Slice 4 derives
 *   a content digest; an in-memory implementation mints a counter.
 * - `EntityVersion` carries BOTH halves of the contract. `revision` detects another
 *   plugin writer; `observed` detects a change no plugin made (a hand edit, a sync).
 *   Two comparisons, two distinct error codes, because the recoveries differ.
 */

export type ObservationToken = string & { readonly __brand: 'ObservationToken' };

export interface EntityVersion {
	/** Persisted with the entity; bumped by plugin writes only. */
	readonly revision: number;
	readonly observed: ObservationToken;
}

/**
 * A read hands back the pair — the version is the store's bookkeeping ABOUT the entity,
 * not part of it, so it travels beside the entity rather than inside it.
 */
export interface Loaded<T> {
	readonly entity: T;
	readonly version: EntityVersion;
}

/** `'absent'`: insert, and fail if something is already there. */
export type Expected = EntityVersion | 'absent';

/**
 * The two refusals the version check itself produces. They are `Validation` by CATEGORY and
 * WRITE-BOUNDARY by meaning: the command reached the repository, the version had moved, and
 * the user's edit was not saved. The ARRAY is exported because the save-state indicator has
 * to tell them apart from a pre-write field refusal, and a second hand-spelled copy of these
 * strings is exactly the drift this repository refuses.
 *
 * The two singles are deliberately NOT exported. Nothing outside this file wants one on its
 * own — `affectsSaveState` reads the array — and `npm run analyze` reported both as unused
 * exports when they were, which is the gate doing its job: an export nothing consumes is a
 * door somebody will eventually reach through instead of the array.
 */
const REVISION_CONFLICT = 'revision-conflict';
const EXTERNAL_MODIFICATION = 'external-modification';
export const WRITE_BOUNDARY_CODES = [REVISION_CONFLICT, EXTERNAL_MODIFICATION] as const;

export function revisionConflict(entity: string, id: string): ValidationError {
	return {
		category: 'Validation',
		code: `${entity}.${REVISION_CONFLICT}`,
		message: `${entity} ${id} was written again after it was read; re-read and retry.`,
	};
}

export function externalModification(entity: string, id: string): ValidationError {
	return {
		category: 'Validation',
		code: `${entity}.${EXTERNAL_MODIFICATION}`,
		message: `${entity} ${id} changed outside this plugin since it was read.`,
	};
}

/**
 * The ONE comparison behind every conditional write (SDD §42 step 2b): revision first
 * (another plugin writer), then the observed token (a change no plugin made). Distinct
 * codes, because the caller's recovery differs — re-read and retry vs. surface a
 * conflict. Shared by all three Obsidian repositories, the geometry store, the in-memory
 * `VersionedStore`, and `expectationMismatch` (design slice 22's price override, which
 * layers an identity check in front of it).
 *
 * It is pure — its only names are this module's own vocabulary — and lives here rather
 * than beside the Obsidian repositories that were its first callers, because
 * `application/` may not import `infrastructure/` and a caller of this comparison need
 * not be one.
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
