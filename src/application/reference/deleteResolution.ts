import { err, isErr, ok, type Result } from '../../core/result/Result';
import type {
	AppError,
	ReferenceError,
} from '../../core/errors/AppError';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Loaded, EntityVersion, Expected } from '../ports/versioning';
import type { Requirement } from '../../domain/requirement/Requirement';
import type { RequirementOrigin } from '../../domain/requirement/RequirementOrigin';
import type { AssetId } from '../../domain/asset/AssetId';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { Logger } from '../ports/Logger';
import type { SequenceMarkerStore } from '../ports/SequenceMarkerStore';
import type { ReferenceLocks, LockSession } from './ReferenceLocks';
import type { RequirementRepository } from '../ports/RequirementRepository';
import { loadRequirement } from '../commands/requirement/loadRequirement';
import { markUncompensated } from '../commands/DispatchOutcome';

/**
 * The compensated multi-entity sequence behind every non-bare delete of a referenced
 * entity (design slice 10). One engine, driven by two commands (`DeleteZoneCommand`,
 * `DeleteAssetCommand`), because writing the discipline into its own section is what let
 * slice 8's mirror-image undo ship without any of it.
 *
 * Steps:
 *   0. level-1 locks (deleted entity + reassignment target, ONE sorted batch); resolution
 *      input validated BEFORE any write; the reassign target validated UNDER the lock
 *   1. referents read in full → `affectedBefore`; level-2 batch; live set compared against
 *      `resolvedReferents` AS A SET — a count check would read an added-and-removed pair
 *      as unchanged
 *   2. resolution applied per requirement, each completed write appended to `progress`
 *   3. entity deleted
 *   4. failure → restore what was written, presenting the versions step 2 recorded;
 *      compensation failures are logged AND left in the durable marker for recovery
 *   5. success → `affectedAfter` IS `progress` (same array handed onward, not rebuilt)
 */

export type ReferenceResolution = 'remove-references' | 'reassign' | 'delete-anyway';

/** The three optional fields this slice adds to both `DeleteZoneInput` and `DeleteAssetInput`. */
export interface ResolutionInput {
	readonly resolution?: ReferenceResolution;
	/** Required when `resolution` is `'reassign'`; a ZoneId or AssetId per entity kind. */
	readonly reassignTo?: string;
	/** Required whenever `resolution` is present — the exact set the user consented to. */
	readonly resolvedReferents?: readonly RequirementId[];
}

export type SequenceProgress =
	| { readonly id: RequirementId; readonly outcome: 'written'; readonly version: EntityVersion }
	| { readonly id: RequirementId; readonly outcome: 'deleted' };

export const SEQUENCE_MARKER_SCHEMA_VERSION = 1;

/**
 * The durable record written BEFORE a multi-entity sequence's first mutation. Plugin-local
 * operational state, not project data — never `data.json`'s settings object (which drops
 * undeclared keys), carrying its own schemaVersion like every persisted shape here.
 *
 * Migration story, deliberately short: a marker a newer version cannot read is DISCARDED
 * with a diagnostic, not migrated. It is short-lived by construction, and recovery WRITES,
 * so a misread `progress` entry could restore the wrong content over a requirement.
 */
export interface SequenceMarker {
	readonly schemaVersion: number;
	readonly kind: 'delete-resolution' | 'delete-undo';
	/** Which repository restores the deleted entity — an ID alone cannot say. */
	readonly entityKind: 'zone' | 'asset';
	readonly entityId: string;
	/** The deleted entity in full plus the version it was deleted at — an ID is not a Zone. */
	readonly entitySnapshot: Loaded<unknown>;
	readonly entityDeleted: boolean;
	readonly affectedBefore: readonly Loaded<Requirement>[];
	/** Appended (durably) after each completed write; on success handed onward as affectedAfter. */
	readonly progress: SequenceProgress[];
}

export type DeleteResolutionErrors = ReferenceError | RepositoryError;

function referenceSetChanged(liveCount: number): ReferenceError {
	return {
		category: 'Reference',
		code: 'reference.set-changed',
		message: `The referencing requirements changed since the resolution was confirmed `
			+ `(now ${liveCount}); nothing was written. Re-confirm the dialog.`,
	};
}

/** The per-kind half the driving command supplies; everything policy-shaped lives above. */
export interface ResolutionOps<TEntity> {
	/** The deleted entity's id — a ZoneId or AssetId. */
	readonly entityId: string;
	readonly entityKind: 'zone' | 'asset';
	readonly logger: Logger;
	/**
	 * Slice 13's toast surface, injected exactly as `CascadeDeps.notify` is and for the same
	 * reason: this module is `application/` and may not reach `presentation/`, so the
	 * composition root decides what a user sees.
	 *
	 * **One member, because one failure here is invisible in a way the others are not.** A
	 * refusal travels back as an `AppError` and the dialog shows it; a mid-sequence fault is
	 * compensated and reported. A failed final `clear` is the one outcome that answers `ok`
	 * — the vault really did get every write — while leaving a durable marker that outlived
	 * the sequence it describes. The save indicator settles on `Saved`, correctly, and
	 * without this the whole of the user's notice is a log line they never see.
	 */
	readonly notify?: {
		markerClearFailed(entityId: string): void;
	};
	listReferents(): Promise<Result<Loaded<Requirement>[], RepositoryError>>;
	loadEntity(): Promise<Result<Loaded<TEntity> | null, RepositoryError>>;
	deleteEntity(expected: EntityVersion): Promise<Result<void, RepositoryError>>;
	validateReassignTarget(reassignTo: string): Promise<Result<void, DeleteResolutionErrors>>;
	/** Repoint + persist stale marker TOGETHER; answers the version the combined write produced. */
	repointAndMarkStale(
		requirement: Loaded<Requirement>,
		reassignTo: string,
	): Promise<Result<EntityVersion, DeleteResolutionErrors>>;
	/**
	 * The stale marker is persistence's own conditional write; its reread can also answer
	 * the requirement gone, which surfaces as the load preamble's ReferenceError.
	 */
	markStalePersisted(
		requirement: Loaded<Requirement>,
	): Promise<Result<EntityVersion, ReferenceError | RepositoryError>>;
	removeRequirement(
		requirement: Loaded<Requirement>,
	): Promise<Result<void, RepositoryError>>;
	/** Failure is LOGGED and left stale, never fatal to the sequence. */
	recalculateInline(requirementId: RequirementId): Promise<Result<unknown, AppError>>;
	restoreRequirement(
		snapshot: Loaded<Requirement>,
		expected: Expected,
	): Promise<Result<EntityVersion, RepositoryError>>;
}

export interface ResolvedSequence {
	readonly deletedId: string;
	readonly affectedBefore: readonly Loaded<Requirement>[];
	/** The marker's own progress array, handed onward — one writer, one record. */
	readonly affectedAfter: readonly SequenceProgress[];
}

function resolutionInputError(input: ResolutionInput): DeleteResolutionErrors | null {
	if (input.resolution && input.resolvedReferents === undefined) {
		return {
			category: 'Validation',
			code: 'reference.resolution-without-set',
			message: `A "${input.resolution}" resolution must carry the referent ids the user saw.`,
		};
	}
	if (input.resolution === 'reassign' && !input.reassignTo) {
		return {
			category: 'Validation',
			code: 'reference.reassign-without-target',
			message: 'A "reassign" resolution must name the target to repoint references at.',
		};
	}
	return null;
}

/**
 * Every per-referent step both driving commands hand in IDENTICALLY, plus the repoint
 * whose only per-kind fact is what the TARGET means: deleting a Zone repoints at a new
 * Zone reference (the Asset link survives), deleting an Asset repoints at a new Asset
 * (the Zone link survives). `repointTo` names that one fact.
 */
export function requirementResolutionSteps(
	requirements: RequirementRepository,
	recalculate: { execute(input: { requirementId: RequirementId }): Promise<Result<unknown, AppError>> },
	repointTo: (
		requirement: Requirement,
		target: string,
	) => { origin: RequirementOrigin; assetId: AssetId },
): Pick<
	ResolutionOps<never>,
	'repointAndMarkStale' | 'markStalePersisted' | 'removeRequirement' | 'recalculateInline' | 'restoreRequirement'
> {
	return {
		repointAndMarkStale: async (snapshot, target) => {
			const current = await loadRequirement(requirements, snapshot.entity.id);
			if (!current.ok) return err(current.error);
			const referent: Requirement = current.value.entity;
			const destination = repointTo(referent, target);
			const repointed = referent.repointedTo(destination.origin, destination.assetId);
			if (!repointed.ok) return err(repointed.error);
			const saved = await requirements.save(repointed.value, current.value.version);
			if (!saved.ok) return err(saved.error);
			return ok(saved.value.version);
		},
		markStalePersisted: async (snapshot) => {
			const marked = await requirements.markStale(snapshot.entity.id);
			// The write itself refused, so nothing landed and the refusal is pre-write.
			if (isErr(marked)) return err(marked.error);
			const reread = await loadRequirement(requirements, snapshot.entity.id);
			// **Past this line the stale marker IS in the vault, and this refusal is the one
			// place that knows it.** `applyAll` appends to `marker.progress` only after this
			// step RETURNS, so a refusal here leaves the completed write in no progress record
			// at all: `compensate` iterates past it, nothing restores it, and its category
			// (`Reference`, via `loadRequirement`'s `requirement.not-found`) is one the save
			// indicator reads as "wrote nothing". Stamping at the loop alone would have closed
			// the multi-referent case and left this single-call one open, which is a partial
			// fix that reads exactly like a complete one.
			if (isErr(reread)) return err(markUncompensated(reread.error));
			return ok(reread.value.version);
		},
		removeRequirement: (snapshot) => requirements.delete(snapshot.entity.id, snapshot.version),
		recalculateInline: (id) => recalculate.execute({ requirementId: id }),
		restoreRequirement: async (snapshot, expected) => {
			const saved = await requirements.save(snapshot.entity, expected);
			if (isErr(saved)) return err(saved.error);
			return ok(saved.value.version);
		},
	};
}

interface Prepared<TEntity> {
	readonly affectedBefore: Loaded<Requirement>[];
	readonly entitySnapshot: Loaded<TEntity>;
}

/** A resolution consents to a specific SET of referents, never to a number. */
function checkConsentedSet(
	entityId: string,
	affectedBefore: readonly Loaded<Requirement>[],
	input: ResolutionInput,
): DeleteResolutionErrors | null {
	if (input.resolution !== undefined) {
		const live = new Set(affectedBefore.map((r) => r.entity.id));
		const consented = new Set(input.resolvedReferents ?? []);
		const sameSet =
			live.size === consented.size && [...consented].every((id) => live.has(id));
		return sameSet ? null : referenceSetChanged(affectedBefore.length);
	}
	if (affectedBefore.length > 0) {
		// Bare delete with live referents: refuse naming them. This is the path a script
		// or migration takes, and it costs nothing to reject here.
		return {
			category: 'Reference',
			code: 'reference.referents-exist',
			message: `${entityId} is still referenced by `
				+ `${affectedBefore.map((r) => r.entity.id).join(', ')}; pass a resolution to proceed.`,
		};
	}
	return null;
}

/**
 * Steps 0–1: level-1 locks as ONE sorted batch (entity + target), the reassignment
 * target validated UNDER them (resolving is a fact about an entity another tab could be
 * deleting, and a check made outside the lock is one the lock does not keep true), then
 * the full pre-state read, the level-2 batch, and the consent check.
 */
async function prepare<TEntity>(
	ops: ResolutionOps<TEntity>,
	input: ResolutionInput,
	session: LockSession,
): Promise<Result<Prepared<TEntity>, DeleteResolutionErrors>> {
	const reassignTo = input.resolution === 'reassign' ? input.reassignTo : undefined;
	await session.acquire(reassignTo ? [ops.entityId, reassignTo] : [ops.entityId], []);
	if (reassignTo) {
		const valid = await ops.validateReassignTarget(reassignTo);
		if (!valid.ok) return valid;
	}

	const listed = await ops.listReferents();
	if (isErr(listed)) return listed;
	const affectedBefore = listed.value.toSorted((a, b) =>
		String(a.entity.id).localeCompare(String(b.entity.id)),
	);
	await session.acquire([], affectedBefore.map((r) => r.entity.id));

	const setCheck = checkConsentedSet(ops.entityId, affectedBefore, input);
	if (setCheck) return err(setCheck);

	const entitySnapshot = await ops.loadEntity();
	if (isErr(entitySnapshot)) return entitySnapshot;
	if (entitySnapshot.value === null) {
		return err({
			category: 'Reference',
			code: 'reference.entity-gone',
			message: `${ops.entityId} no longer exists.`,
		});
	}
	return ok({ affectedBefore, entitySnapshot: entitySnapshot.value });
}

async function recordMarker(
	markers: SequenceMarkerStore | undefined,
	marker: SequenceMarker,
): Promise<Result<void, RepositoryError>> {
	if (!markers) return ok(undefined);
	const written = await markers.write(marker);
	if (isErr(written)) return written;
	return ok(undefined);
}

async function clearMarker(
	markers: SequenceMarkerStore | undefined,
	entityId: string,
): Promise<Result<void, RepositoryError>> {
	if (!markers) return ok(undefined);
	const cleared = await markers.clear(entityId);
	if (isErr(cleared)) return cleared;
	return ok(undefined);
}

async function applyResolutionToRequirement<TEntity>(
	ops: ResolutionOps<TEntity>,
	input: ResolutionInput,
	requirement: Loaded<Requirement>,
): Promise<Result<SequenceProgress, DeleteResolutionErrors>> {
	switch (input.resolution) {
		case 'remove-references': {
			const removed = await ops.removeRequirement(requirement);
			if (isErr(removed)) return err(removed.error);
			return ok({ id: requirement.entity.id, outcome: 'deleted' });
		}
		case 'delete-anyway': {
			const marked = await ops.markStalePersisted(requirement);
			if (isErr(marked)) return err(marked.error);
			return ok({ id: requirement.entity.id, outcome: 'written', version: marked.value });
		}
		case 'reassign': {
			const repointed = await ops.repointAndMarkStale(requirement, input.reassignTo as string);
			if (isErr(repointed)) return err(repointed.error);
			// Inline recalculation: a FAILURE does not fail the sequence — the stale
			// marker is already persisted and the failure is logged (slice 17's
			// background-cascade case).
			const recalculated = await ops.recalculateInline(requirement.entity.id);
			if (isErr(recalculated)) {
				ops.logger.warn('requirement.reassignment-recalculation.failed', {
					requirementId: requirement.entity.id,
					cause: recalculated.error,
				});
			}
			return ok({ id: requirement.entity.id, outcome: 'written', version: repointed.value });
		}
		case undefined:
			return err({
				category: 'Validation',
				code: 'reference.resolution-required',
				message: `${ops.entityId} still has referencing requirements; a resolution is required.`,
			});
	}
}

/**
 * Step 2 — apply per requirement, appending each completed write to the durable progress
 * record (a crash between a write and its append must be survivable, so the append is
 * part of completing the write).
 */
async function applyAll<TEntity>(
	ops: ResolutionOps<TEntity>,
	input: ResolutionInput,
	marker: SequenceMarker,
	markers: SequenceMarkerStore | undefined,
): Promise<Result<void, DeleteResolutionErrors>> {
	for (const requirement of marker.affectedBefore) {
		const applied = await applyResolutionToRequirement(ops, input, requirement);
		if (isErr(applied)) return err(applied.error);
		marker.progress.push(applied.value);
		const recorded = await recordMarker(markers, marker);
		if (isErr(recorded)) return err(recorded.error);
	}
	return ok(undefined);
}

/**
 * Step 4 — restore every requirement already written/deleted, from the pre-state,
 * presenting the version the forward writes recorded: as conditional as the writes they
 * undo. A failing compensation is logged AND left in the durable marker (`marker.progress`
 * still holds every completed forward write) for recovery at next load — a log entry is
 * not a recovery, and the repository cannot promise multi-file atomicity.
 *
 * **A log entry is not the user-facing half either, which is what `markUncompensated` adds.**
 * This function is the one place that knows the vault has been left half-written: it holds the
 * completed forward writes and it watched the restores refuse. Everything above it sees only
 * the FORWARD refusal, whose category is a fact about why step 2 stopped and says nothing
 * about what step 2 had already saved — so slice 13's save indicator, reading that category,
 * settled to `Saved` over a plan with a stale marker nothing put back. The stamp is additive
 * (`category`, `code` and `message` are untouched, so `toUserMessage` resolves the same
 * sentence) and is applied ONLY when a write really is left standing: a compensation that
 * restores everything has returned the vault to its pre-state, and stamping that would be a
 * badge over data as safe as it was before the gesture. `DispatchOutcome`'s header carries
 * the argument for why this is a reported value rather than an inference.
 *
 * The two ways a write is left standing are handled as one, because they are the same fact:
 * a restore that REFUSED, and a completed forward write compensation could find no snapshot
 * for. The second is unreachable while `progress` is built from `affectedBefore` in this
 * same call — it is the recovery path that reads a marker off disk, and that path has its own
 * loop in `recoverInterruptedSequences.ts` — so it is guarded rather than proven, and it
 * fails toward reporting.
 */
async function compensate<TEntity>(
	ops: ResolutionOps<TEntity>,
	marker: SequenceMarker,
	cause: DeleteResolutionErrors,
): Promise<Result<never, DeleteResolutionErrors>> {
	let uncompensated = false;
	for (const entry of [...marker.progress].toReversed()) {
		const snapshot = marker.affectedBefore.find((r) => r.entity.id === entry.id);
		if (!snapshot) {
			uncompensated = true;
			continue;
		}
		const expected: Expected = entry.outcome === 'written' ? entry.version : 'absent';
		const restored = await ops.restoreRequirement(snapshot, expected);
		if (isErr(restored)) {
			uncompensated = true;
			ops.logger.error('sequence.compensation.failed', {
				entityId: ops.entityId,
				entityKind: ops.entityKind,
				requirementId: entry.id,
				cause: restored.error,
			});
		}
	}
	return err(uncompensated ? markUncompensated(cause) : cause);
}

export async function runDeleteResolution<TEntity>(
	ops: ResolutionOps<TEntity>,
	input: ResolutionInput,
	locks: ReferenceLocks,
	markers?: SequenceMarkerStore,
): Promise<Result<ResolvedSequence, DeleteResolutionErrors>> {
	const inputError = resolutionInputError(input);
	if (inputError) return err(inputError);

	const session: LockSession = locks.beginSession();
	try {
		const prepared = await prepare(ops, input, session);
		if (!prepared.ok) return prepared;
		const { affectedBefore, entitySnapshot } = prepared.value;

		const marker: SequenceMarker = {
			schemaVersion: SEQUENCE_MARKER_SCHEMA_VERSION,
			kind: 'delete-resolution',
			entityId: ops.entityId,
			entityKind: ops.entityKind,
			entitySnapshot: entitySnapshot,
			entityDeleted: false,
			affectedBefore,
			progress: [],
		};

		// Written before the FIRST mutation; a failed marker write aborts before anything
		// else happens — the recovery guarantee must never rest on a write already known
		// not to work.
		const opened = await recordMarker(markers, marker);
		if (isErr(opened)) return err(opened.error);

		const applied = await applyAll(ops, input, marker, markers);
		if (isErr(applied)) return compensate(ops, marker, applied.error);

		const deleted = await ops.deleteEntity(entitySnapshot.version);
		if (isErr(deleted)) return compensate(ops, marker, deleted.error);

		const recorded = await recordMarker(markers, { ...marker, entityDeleted: true });
		if (isErr(recorded)) {
			ops.logger.error('sequence.marker-update.failed', {
				entityId: ops.entityId,
				entityKind: ops.entityKind,
				cause: recorded.error,
			});
		}

		// Step 5 — success clears the marker and hands progress onward untouched.
		//
		// **A failure here is not fatal to the sequence and must still be SAID.** Every write
		// this resolution owed the vault has landed, so it answers `ok` and slice 13's
		// indicator settles on `Saved` — which is true. What is left behind is a marker that
		// outlived its sequence: `recoverInterruptedSequences` clears it on the next load
		// without reversing anything (it reads `entityDeleted`, which the step above set),
		// but until that load the durable record of this plan disagrees with the plan. The
		// user is told, because a log line is not a surface. Reported by a review bot on the
		// slice 13 pull request, whose scenario was the harsher one this pairing removed:
		// recovery used to ROLL the whole deletion BACK.
		const cleared = await clearMarker(markers, ops.entityId);
		if (isErr(cleared)) {
			ops.logger.error('sequence.marker-clear.failed', {
				entityId: ops.entityId,
				entityKind: ops.entityKind,
				cause: cleared.error,
			});
			ops.notify?.markerClearFailed(ops.entityId);
		}
		return ok({
			deletedId: ops.entityId,
			affectedBefore,
			affectedAfter: marker.progress,
		});
	} finally {
		session.release();
	}
}
