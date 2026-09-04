import type { Result } from '../../core/result/Result';
import type { AppError, ValidationError } from '../../core/errors/AppError';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { ReassignmentTargetDto } from '../../application/queries/reassignmentTypes';
import type { ReferencingGroup } from '../../application/queries/ListRequirementsReferencing';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type {
	DeleteReferenceDialogResult,
	EntityCandidate,
	EntityPickerDialogResult,
	ReferenceRow,
} from '../dialogs/dialog-store';
import {
	deleteWithReferences,
	type DeleteOutcome,
	type DeleteWithReferencesDeps,
} from '../references/deleteWithReferences';
import type { InspectorEdit } from './inspector/inspector-store';

/**
 * PRD §63–64's delete-with-references decision, as the PLAN EDITOR's Inspector runs it.
 *
 * **The decision itself is not here any more.** `presentation/references/deleteWithReferences.ts`
 * holds the shape — the stale-read rule, the consented set, the single re-ask — and this module
 * is the adapter that gives it the Plan editor's vocabulary: an id it closes over, and an
 * `InspectorEdit` for the one commit path SDD §59 allows. The extraction happened when the Asset
 * library needed the identical gesture and could not speak `InspectorEdit`; that module's header
 * carries why the body moved rather than being copied.
 *
 * What stayed behind is this caller's own bundle plus the two facts that are true of a ZONE and
 * not of an asset: `reassignTo` is a `ZoneId`, and `NO_REASSIGNMENT_TARGET` names a project
 * rather than a vault — the Asset library mints `reference.no-reassignment-asset` for its half,
 * which is why the shared flow takes that refusal from its caller instead of holding one.
 */

/** The Plan editor's own name for the shared three outcomes — see `DeleteOutcome`. */
export type DeleteZoneOutcome = DeleteOutcome;

export interface DeleteZoneFlowDeps {
	/** Slice 10's query, per zone — the shared flow takes no id, so this door is closed over. */
	listReferents(zoneId: string): Promise<Result<readonly ReferencingGroup[], AppError>>;
	listReassignmentTargets(zoneId: string): Promise<Result<readonly ReassignmentTargetDto[], AppError>>;
	/** `dialogStore.openDialog({ kind: 'delete-reference', … })`, with the rows already built. */
	askResolution(
		entityLabel: string,
		references: readonly ReferenceRow[],
	): Promise<DeleteReferenceDialogResult>;
	askReassignTarget(
		title: string,
		candidates: readonly EntityCandidate[],
	): Promise<EntityPickerDialogResult>;
	/** The Inspector's ONE commit path (SDD §59), so the delete is one history entry like any other. */
	dispatch(edit: InspectorEdit): Promise<DispatchResult>;
	/**
	 * Resolved copy for the DIALOGS, supplied by the caller — nothing under
	 * `presentation/dialogs/` names a key. Refusal copy is deliberately NOT here: an
	 * `AppError` carries a code, and the sentence a user reads for it is resolved from the
	 * locale tables at the notice by `toUserMessage`.
	 */
	readonly copy: {
		readonly reassignTitle: string;
	};
}

/**
 * A project with one zone has nothing to reassign to.
 *
 * `message` is developer English for a log line (SDD §65) and nothing else: the sentence
 * the USER reads is `reference.no-reassignment-target` in the locale tables, resolved by
 * `toUserMessage` when `notifyError` prints this. It used to be a PARAMETER — the caller
 * handed in the already-translated string — which inverted slice 11's rule and then wasted
 * the translation, because `notifyError` never reads `message`: the localized sentence
 * reached nobody and the user got the Validation category fallback instead. A constant
 * rather than a factory, because it now depends on nothing.
 *
 * The Asset library mints `reference.no-reassignment-asset` for its own half of this, and
 * the two are separate CODES rather than one because the sentences differ in what they name:
 * a zone's alternatives are bounded by its project, an asset's by the vault.
 */
const NO_REASSIGNMENT_TARGET: ValidationError = {
	category: 'Validation',
	code: 'reference.no-reassignment-target',
	message: 'This project has no other zone to repoint the referencing requirements at.',
};

export async function deleteZoneWithReferences(
	deps: DeleteZoneFlowDeps,
	zoneId: ZoneId,
	zoneName: string,
): Promise<DeleteZoneOutcome> {
	const bound: DeleteWithReferencesDeps<ZoneId> = {
		listReferents: () => deps.listReferents(zoneId),
		listReassignmentTargets: () => deps.listReassignmentTargets(zoneId),
		askResolution: (entityLabel, references) => deps.askResolution(entityLabel, references),
		askReassignTarget: (title, candidates) => deps.askReassignTarget(title, candidates),
		// SPREAD rather than reassembled field by field, which is the whole reason
		// `ResolvedDeletion` is parameterised by the id type: the zero branch hands `{}` and
		// produces exactly `{ kind: 'delete', zoneId }`, with none of the three optional keys
		// present as an explicit `undefined`.
		dispatch: (resolved) => deps.dispatch({ kind: 'delete', zoneId, ...resolved }),
		copy: { reassignTitle: deps.copy.reassignTitle, noReassignTarget: NO_REASSIGNMENT_TARGET },
	};
	return await deleteWithReferences(bound, zoneName);
}
