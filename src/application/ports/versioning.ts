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
 * the user's edit was not saved. Exported because the save-state indicator has to tell them
 * apart from a pre-write field refusal, and a second hand-spelled copy of these strings is
 * exactly the drift this repository refuses.
 */
export const REVISION_CONFLICT = 'revision-conflict';
export const EXTERNAL_MODIFICATION = 'external-modification';
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
