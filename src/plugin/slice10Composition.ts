/**
 * Design slice 10's composition, lifted out of `composition-root.ts` when that file reached
 * its 400-line cap — an EXTRACTION rather than a second collapsed literal, which is the
 * remedy this repository writes down for a budget that has already been spent. The seam is
 * a coherent one and not merely a convenient one: everything here is slice 10's write side,
 * read side and cascade handlers, plus the two notice objects those handlers report
 * through. `composition-root.ts` remains the ONE place dependencies are composed (SDD §10);
 * this is one of its blocks, called from it and from nothing else.
 *
 * `sequenceNotices` is exported because `composeGuarded` builds the OTHER delete command
 * that raises it, back in the root — the reason its own docblock gives for it being at
 * module scope in the first place.
 */

import type { EventBus } from '../core/events/EventBus';
import type { Logger } from '../application/ports/Logger';
import type { ReferenceLocks } from '../application/reference/ReferenceLocks';
import { CreateAssetCommand } from '../application/commands/asset/CreateAsset';
import { UpdateAssetCommand } from '../application/commands/asset/UpdateAsset';
import { DeleteAssetCommand } from '../application/commands/asset/DeleteAsset';
import { AssignAssetCommand } from '../application/commands/requirement/AssignAsset';
import type { RecalculateRequirementCommand } from '../application/commands/requirement/RecalculateRequirement';
import type { AssetPriceOverrideRepository } from '../application/ports/AssetPriceOverrideRepository';
import { SetRequirementQuantityOverrideCommand } from '../application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../application/commands/requirement/SetRequirementCostOverride';
import { DeleteRequirementCommand } from '../application/commands/requirement/DeleteRequirement';
import { GetRequirementsForZone } from '../application/queries/GetRequirementsForZone';
import { ListAssets } from '../application/queries/ListAssets';
import { ListRequirementsReferencing } from '../application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../application/queries/ListReassignmentTargets';
import { registerOnZoneGeometryChanged } from '../application/event-handlers/requirement/onZoneGeometryChanged';
import { registerOnAssetUpdated } from '../application/event-handlers/requirement/onAssetUpdated';
import { registerOnAssetPriceOverrideChanged } from '../application/event-handlers/requirement/onAssetPriceOverrideChanged';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { SequenceMarkerStore } from '../application/ports/SequenceMarkerStore';
import type { AssetRepository as AssetRepositoryPort } from '../application/ports/AssetRepository';
import type { RequirementRepository as RequirementRepositoryPort } from '../application/ports/RequirementRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { ZoneRepository } from '../application/ports/ZoneRepository';
import { projectLocationOf } from '../infrastructure/obsidian/repositories/paths';
import { notifyWarning } from '../presentation/notices/notify';
import { tr } from '../presentation/i18n/strings';
import type { UnguardedSlice10Services } from './guardedServices';

/**
 * The one notice both delete commands raise, at module scope because the two are built in
 * different functions and a second literal is a second answer to what this failure says.
 *
 * **WARNING rather than the `info` default, for `cascadeNotices`' reason and one of its
 * own.** Slice 13 gives `warning` no auto-dismiss, and this one arrives at the end of a
 * gesture the user is watching: the delete they asked for SUCCEEDED, so the save indicator
 * says `Saved` and every other surface agrees. This sentence is the only thing that says
 * the vault also kept a recovery record it should not have. Six seconds is not long enough
 * to read a caveat attached to something that otherwise looks finished.
 */
export const sequenceNotices = {
	markerClearFailed: () => {
		notifyWarning(tr('sequence.marker-clear-failed'));
	},
	/**
	 * Task 7a: an asset's price overrides go with it, and a failure clearing one is a residual
	 * the user should hear about the same way a stray recovery marker is — see
	 * `DeleteAssetCommand.deleteOverridesOf`'s header for why it does not fail the delete.
	 */
	priceCleanupFailed: () => {
		notifyWarning(tr('asset-price.cleanup-failed'));
	},
};

export interface Slice10Wiring {
	readonly zones: ZoneRepository;
	readonly assets: AssetRepositoryPort;
	readonly requirements: RequirementRepositoryPort;
	/** Slice 19: a referent group is named after its project, so the read side reads them. */
	readonly projects: ProjectRepository;
	/**
	 * Where `ListRequirementsReferencing` resolves a project's FOLDER (ADR-0013) — the
	 * derivation lives in `infrastructure/`, which `application/` may not import, so the
	 * root binds the one existing function rather than the query deriving a second answer.
	 */
	readonly index: ProjectIndex;
	readonly recalculate: RecalculateRequirementCommand;
	readonly events: EventBus;
	readonly locks: ReferenceLocks;
	readonly logger: Logger;
	readonly markers?: SequenceMarkerStore;
	/** The precedence's input half: a project may price a shared asset in its own currency. */
	readonly overrides: AssetPriceOverrideRepository;
}

/**
 * Design slice 10's write side, read side, and cascade handlers, composed as ONE block —
 * the same seam discipline as every other service here, kept out of
 * `createCompositionRoot`'s own body only by the size budget every function shares.
 *
 * Nothing this returns is guarded: it is the raw composition, and `guardSlice10` wraps the
 * copy that LEAVES the root. `recalculate` reaches `DeleteAssetCommand` and both cascade
 * handlers unguarded on purpose — those uses are INSIDE the application layer, which is
 * not the boundary the guard defends.
 */
export function composeSlice10(
	wiring: Slice10Wiring,
): UnguardedSlice10Services & { subscriptions: { dispose(): void }[] } {
	const { zones, assets, requirements, projects, index, recalculate, events, locks, logger, markers, overrides } = wiring;

	/**
	 * The cascade runs in the BACKGROUND — nothing the user clicked is waiting on it — so a
	 * failure inside it reaches nobody unless it is announced. That matters most for exactly
	 * the case this port is named after: the durable marker that lets a later reader see
	 * "these figures are out of date" is itself the write that failed, so silence here means
	 * a wrong figure presented as current. The port is optional on `CascadeDeps` for the
	 * suite's benefit; production always passes it, and this is the caller that makes the
	 * whole port more than a tested no-op.
	 *
	 * **WARNING rather than the `info` default, and for the same reason the port exists.**
	 * Slice 13 gives `warning` no auto-dismiss: it stays until the user dismisses it, while
	 * `info` goes after six seconds. These two run with nothing the user clicked waiting on
	 * them, so a six-second notice about figures that may be wrong is one the user is most
	 * likely to be looking elsewhere for — the same silence this port was added to break,
	 * only slower.
	 */
	const cascadeNotices = {
		cascadeAborted: () => {
			notifyWarning(tr('cascade.aborted'));
		},
		staleMarkerFailed: () => {
			notifyWarning(tr('cascade.stale-marker-failed'));
		},
	};

	const subscriptions: { dispose(): void }[] = [
		registerOnZoneGeometryChanged(events, {
			requirements,
			events,
			logger,
			notify: cascadeNotices,
			recalculate: (input) => recalculate.execute({ requirementId: input.requirementId as never }),
		}),
		registerOnAssetUpdated(events, {
			requirements,
			assets,
			overrides,
			events,
			logger,
			notify: cascadeNotices,
			recalculate: (input) => recalculate.execute({ requirementId: input.requirementId as never }),
		}),
		registerOnAssetPriceOverrideChanged(events, {
			requirements,
			events,
			logger,
			notify: cascadeNotices,
			recalculate: (input) => recalculate.execute({ requirementId: input.requirementId as never }),
		}),
	];

	return {
		createAsset: new CreateAssetCommand(assets, events),
		updateAsset: new UpdateAssetCommand(assets, requirements, events, locks),
		deleteAsset: new DeleteAssetCommand({
			assets,
			requirements,
			recalculate,
			events,
			locks,
			logger,
			markers,
			overrides,
			notify: sequenceNotices,
		}),
		assignAsset: new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides }),
		setRequirementQuantityOverride: new SetRequirementQuantityOverrideCommand(requirements, events, locks),
		setRequirementCostOverride: new SetRequirementCostOverrideCommand(requirements, events, locks),
		deleteRequirement: new DeleteRequirementCommand(requirements),
		queries: {
			getRequirementsForZone: new GetRequirementsForZone({ requirements, zones, assets, projects, overrides, logger }),
			listAssets: new ListAssets(assets),
			listRequirementsReferencing: new ListRequirementsReferencing(
				requirements,
				projects,
				(projectId) => projectLocationOf(index, projectId),
			),
			listReassignmentTargets: new ListReassignmentTargets(zones, assets),
		},
		subscriptions,
	};
}
