import { isErr, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Logger } from '../ports/Logger';
import type { SequenceMarkerStore } from '../ports/SequenceMarkerStore';
import type { AssetRepository } from '../ports/AssetRepository';
import type { ZoneRepository } from '../ports/ZoneRepository';
import type { RequirementRepository } from '../ports/RequirementRepository';
import type { Loaded } from '../ports/versioning';
import type { Requirement } from '../../domain/requirement/Requirement';
import type { SequenceMarker, SequenceProgress } from './deleteResolution';

export interface RecoveryDeps {
	readonly markers: SequenceMarkerStore;
	readonly requirements: RequirementRepository;
	readonly zones: ZoneRepository;
	readonly assets: AssetRepository;
	readonly logger: Logger;
}

function findSnapshot(marker: SequenceMarker, requirementId: string): Loaded<Requirement> | undefined {
	return marker.affectedBefore.find((r) => r.entity.id === requirementId);
}

async function restoreEntity(
	deps: RecoveryDeps,
	marker: SequenceMarker,
): Promise<Result<unknown, RepositoryError>> {
	const snapshot = marker.entitySnapshot as Loaded<{ readonly id: string }>;
	if (marker.entityKind === 'zone') {
		return await deps.zones.save(snapshot.entity as never, 'absent');
	}
	return await deps.assets.save(snapshot.entity as never, 'absent');
}

/**
 * One marker: restore every `progress` entry from the pre-state, presenting the version
 * the forward write recorded (`'absent'` for a removed referent); restore the deleted
 * entity from its full snapshot when the marker says step 3 ran. A refused restore is
 * surfaced, never forced; the marker clears once every entry is restored or surfaced.
 */
async function recoverOne(deps: RecoveryDeps, marker: SequenceMarker): Promise<void> {
	for (const entry of marker.progress as readonly SequenceProgress[]) {
		const snapshot = findSnapshot(marker, entry.id);
		if (!snapshot) continue;
		const expected = entry.outcome === 'written' ? entry.version : 'absent';
		const saved = await deps.requirements.save(snapshot.entity, expected);
		if (isErr(saved)) {
			deps.logger.error('sequence.recovery.restore-refused', {
				requirementId: entry.id,
				entityId: marker.entityId,
				cause: saved.error,
			});
		}
	}

	if (marker.entityDeleted) {
		const restored = await restoreEntity(deps, marker);
		if (isErr(restored)) {
			deps.logger.error('sequence.recovery.entity-restore-refused', {
				entityKind: marker.entityKind,
				entityId: marker.entityId,
				cause: restored.error,
			});
		}
	}

	const cleared = await deps.markers.clear(marker.entityId);
	if (isErr(cleared)) {
		deps.logger.error('sequence.recovery.clear-failed', { entityId: marker.entityId, cause: cleared.error });
	}
}

/**
 * The idempotent, conditional recovery of an interrupted multi-entity sequence (design
 * slice 10, "Compensated multi-entity sequences" step 4's cold half). At load a marker
 * means a crash landed between the first mutation and the sequence's completion.
 *
 * Restoring from the pre-state is idempotent in both directions — a requirement already at
 * its before-state writes back to the same content — so a crash between a forward write
 * and its progress append corrupts nothing either way; and because the marker clears only
 * after every entry is restored or surfaced, a crash DURING recovery simply leaves the
 * marker for the next load.
 */
export async function recoverInterruptedSequences(deps: RecoveryDeps): Promise<void> {
	try {
		const listed = await deps.markers.list();
		if (isErr(listed)) {
			deps.logger.error('sequence.recovery.list-failed', { cause: listed.error });
			return;
		}
		for (const marker of listed.value) {
			await recoverOne(deps, marker);
		}
	} catch (cause) {
		// The Error Boundary (SDD §65–66) for the one entry point that has no wrapper: this
		// runs at LOAD, dispatched fire-and-forget, so a throw below it — a vault read that
		// faults rather than refusing — is an unhandled rejection reaching nobody. The
		// handling is HERE rather than at the call site because the guarantee belongs to
		// the function: `RenovationPlannerPlugin` is one caller today and a second would
		// have to remember a `.catch` that nothing checks.
		//
		// Swallowed on purpose, and only here. **The reason USED to be that there was no
		// surface to tell the user on; slice 13 built one, and this comment was swept in the
		// same pass that swept `StatusBar.vue` and `styles/editor.css`.** Three reasons
		// stand in its place, and the first is structural rather than a judgement: this
		// module is in `application/`, which may not import `presentation/` — so reaching
		// `notifyError` from here is a layer violation `npm run lint` refuses, and routing
		// it would mean a port and a wiring decision rather than a call. Second, this is a
		// background repair nobody asked for, running at LOAD: a toast about a marker the
		// user has never heard of arrives before they have done anything, and names nothing
		// they can act on. Third, WHICH failures get a toast is slice 17's table, and
		// `docs/components/Toast.md`'s own contract refuses a component that routes to
		// itself — this line choosing a surface ahead of that table would be exactly that.
		// What must not happen is silence, which is what this line prevents.
		deps.logger.error('sequence.recovery.failed', { cause });
	}
}
