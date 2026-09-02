import type { ValidationError } from '../../core/errors/AppError';

/**
 * The conditional-write vocabulary, declared ONCE and shared by every entity port
 * (SDD §36 extended per design slice 3's "Writes are conditional").
 *
 * - `ObservationToken` is opaque above `infrastructure/`: minted by the repository at
 *   read time from what the bytes looked like, threaded to the write that presents it,
 *   never PARSED by anything in `application/` or `domain/`. Slice 4 derives
 *   a content digest; an in-memory implementation mints a counter.
 *
 *   The sentence used to say "never parsed or compared", and `sameVersion` below is a
 *   comparison — so the claim is narrowed to the half that is actually load-bearing rather
 *   than left standing beside a function that breaks it. Nothing above `infrastructure/`
 *   derives MEANING from a token: the only question asked of one is whether two readings are
 *   the same reading, which is the whole of what the type promises. Keeping that one
 *   comparison here, in the module that owns the vocabulary, is what stops a second
 *   hand-spelled `a.revision === b.revision && a.observed === b.observed` appearing beside
 *   the next caller that needs it — the drift `WRITE_BOUNDARY_CODES` below already refuses
 *   for the two codes.
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

/**
 * Are these two readings the same reading? Both halves, because they answer different
 * questions and a comparison of one is silent about the other: `revision` moves when a
 * plugin writes, `observed` when anything else does. `checkExpectedVersion` in
 * `infrastructure/obsidian/repositories/versionCheck.ts` asks the same pair and separates
 * the two answers, because it owes the caller a REASON; this one is asked where all that is
 * wanted is "did it move at all" — `WriteLedger.observe`, which reports no reason and only
 * bumps a counter.
 *
 * Revision-only would have been the cheaper spelling and it is measurably wrong here: a hand
 * edit or a sync leaves `revision` alone by construction, which is the entire reason
 * `observed` exists, so a ledger comparing revisions would wave through exactly the foreign
 * writes `external-modification` was added to catch.
 */
export function sameVersion(a: EntityVersion, b: EntityVersion): boolean {
	return a.revision === b.revision && a.observed === b.observed;
}

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
