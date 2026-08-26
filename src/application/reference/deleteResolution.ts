import { err, isErr, ok, type Result } from '../../core/result/Result';
import type {
	AppError,
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../core/errors/AppError';
import type { Loaded, EntityVersion, Expected } from '../ports/versioning';
import type { Requirement } from '../../domain/requirement/Requirement';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { Logger } from '../ports/Logger';
import type { SequenceMarkerStore } from '../ports/SequenceMarkerStore';
import type { ReferenceLocks, LockSession } from './ReferenceLocks';

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
	readonly entityId: string;
	/** The deleted entity in full plus the version it was deleted at — an ID is not a Zone. */
	readonly entitySnapshot: Loaded<unknown>;
	readonly entityDeleted: boolean;
	readonly affectedBefore: readonly Loaded<Requirement>[];
	/** Appended (durably) after each completed write; on success handed onward as affectedAfter. */
	readonly progress: SequenceProgress[];
}

export type DeleteResolutionErrors = ValidationError | ReferenceError | PersistenceError;

export function referenceSetChanged(liveCount: number): ReferenceError {
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
	readonly logger: Logger;
	listReferents(): Promise<Result<Loaded<Requirement>[], PersistenceError>>;
	loadEntity(): Promise<Result<Loaded<TEntity> | null, PersistenceError>>;
	deleteEntity(expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>>;
	validateReassignTarget(reassignTo: string): Promise<Result<void, DeleteResolutionErrors>>;
	/** Repoint + persist stale marker TOGETHER; answers the version the combined write produced. */
	repointAndMarkStale(
		requirement: Loaded<Requirement>,
		reassignTo: string,
	): Promise<Result<EntityVersion, DeleteResolutionErrors>>;
	markStalePersisted(
		requirement: Loaded<Requirement>,
	): Promise<Result<EntityVersion, PersistenceError>>;
	removeRequirement(
		requirement: Loaded<Requirement>,
	): Promise<Result<void, PersistenceError | ValidationError>>;
	/** Failure is LOGGED and left stale, never fatal to the sequence. */
	recalculateInline(requirementId: RequirementId): Promise<Result<unknown, AppError>>;
	restoreRequirement(
		snapshot: Loaded<Requirement>,
		expected: Expected,
	): Promise<Result<EntityVersion, PersistenceError | ValidationError>>;
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
): Promise<Result<void, PersistenceError>> {
	if (!markers) return ok(undefined);
	const written = await markers.write(marker);
	if (isErr(written)) return written;
	return ok(undefined);
}

async function clearMarker(
	markers: SequenceMarkerStore | undefined,
	entityId: string,
): Promise<Result<void, PersistenceError>> {
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
 */
async function compensate<TEntity>(
	ops: ResolutionOps<TEntity>,
	marker: SequenceMarker,
	cause: DeleteResolutionErrors,
): Promise<Result<never, DeleteResolutionErrors>> {
	for (const entry of [...marker.progress].toReversed()) {
		const snapshot = marker.affectedBefore.find((r) => r.entity.id === entry.id);
		if (!snapshot) continue;
		const expected: Expected = entry.outcome === 'written' ? entry.version : 'absent';
		const restored = await ops.restoreRequirement(snapshot, expected);
		if (isErr(restored)) {
			ops.logger.error('sequence.compensation.failed', {
				entityId: ops.entityId,
				requirementId: entry.id,
				cause: restored.error,
			});
		}
	}
	return err(cause);
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
				cause: recorded.error,
			});
		}

		// Step 5 — success clears the marker and hands progress onward untouched.
		const cleared = await clearMarker(markers, ops.entityId);
		if (isErr(cleared)) {
			ops.logger.error('sequence.marker-clear.failed', {
				entityId: ops.entityId,
				cause: cleared.error,
			});
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
