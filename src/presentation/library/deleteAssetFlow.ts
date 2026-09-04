import type { ValidationError } from '../../core/errors/AppError';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';
import type { AssetLibraryCommandServices } from './AssetLibraryDeps';
import type { useDialogStore } from '../dialogs/dialog-store';
import {
	deleteWithReferences,
	type DeleteOutcome,
	type DeleteWithReferencesDeps,
} from '../references/deleteWithReferences';
import { tr } from '../i18n/strings';

/**
 * §3.5's `Delete`, as the Asset library runs it — the ADAPTER half of
 * `presentation/references/deleteWithReferences.ts`, exactly as `deleteZoneFlow.ts` is for the
 * Plan editor's Inspector.
 *
 * **This module exists rather than a widening of `deleteZoneFlow.ts`, and the seam was the
 * decision this task was written to make.** That module's `dispatch` takes an `InspectorEdit`,
 * which is the Plan editor's own commit vocabulary (SDD §59's one choke point) and names a
 * `zoneId`; the library has no Inspector store, no `CommandHistory` and no zone. Widening that
 * parameter to a union of two surfaces' edit types would have put the library's command shape
 * inside the editor's store contract for no gain, so what moved is the flow's SHAPE — the part
 * neither surface owns — and each surface keeps the adapter that spells its own command input.
 * Copying was refused: a second derivation answers differently the first time slice 10's rules
 * change, and this flow's rules are precisely the subtle ones (a stale read that is never
 * consent, one re-ask and no loop).
 *
 * **The *Used in* read IS this flow's read**, per §3.5 — `listReferencing` is the query
 * `AssetSelectionStore` already ran on selection and the one this hands the shared flow, so the
 * blast radius the panel is showing and the set the dialog is built from come from one door.
 * They are two CALLS of it rather than one cached answer, and deliberately: §3.5's own
 * *"the read informs and the command enforces"* rule needs the freshest set the moment the user
 * asks, and a snapshot taken at selection is exactly what slice 10 refuses to turn into consent.
 *
 * `Delete` is unavailable at all while that read has not SUCCEEDED (`AssetInspector.canDelete`),
 * so this flow is never reached with the section in flight or refused.
 */

/**
 * The vault holds no other area-kind asset to repoint the referencing requirements at.
 *
 * Its OWN code rather than the zone flow's `reference.no-reassignment-target`, because the two
 * sentences name different things: a zone's alternatives are bounded by its project
 * (*"no other zone in this project"*), and an asset's by the vault — the catalogue has been
 * project-free since design slice 19, so borrowing that copy would tell a user about a project
 * that has nothing to do with the refusal. `message` is developer English for a log line (SDD
 * §65); the sentence the user reads is this code's entry in the locale tables, resolved by
 * `toUserMessage` at the notice.
 */
const NO_REASSIGNMENT_ASSET: ValidationError = {
	category: 'Validation',
	code: 'reference.no-reassignment-asset',
	message: 'The vault holds no other area-kind asset to repoint the referencing requirements at.',
};

export interface DeleteAssetFlowDeps {
	readonly queries: Pick<AssetLibraryQueryServices, 'listReferencing' | 'listReassignmentTargets'>;
	readonly deleteAsset: AssetLibraryCommandServices['deleteAsset'];
	readonly dialogs: Pick<ReturnType<typeof useDialogStore>, 'openDialog'>;
}

/**
 * `assetName` is the catalogue entry's own text, resolved by the caller — the dialog states
 * WHICH asset is about to go, and §3.5's *"a descriptor says what it is about in words"* rule
 * (slice 15) is why it is a required string rather than something the dialog reads off a
 * selection sitting behind it.
 */
export async function deleteAssetWithReferences(
	deps: DeleteAssetFlowDeps,
	assetId: AssetId,
	assetName: string,
): Promise<DeleteOutcome> {
	const bound: DeleteWithReferencesDeps<AssetId> = {
		listReferents: () => deps.queries.listReferencing(assetId),
		listReassignmentTargets: () => deps.queries.listReassignmentTargets(assetId),
		askResolution: (entityLabel, references) =>
			deps.dialogs.openDialog({ kind: 'delete-reference', entityLabel, references }),
		askReassignTarget: (title, candidates) =>
			deps.dialogs.openDialog({ kind: 'entity-picker', title, candidates }),
		// SPREAD, per `ResolvedDeletion`'s own header: the zero branch hands `{}` and produces
		// exactly `{ assetId }`, so none of the three optional fields reaches `DeleteAssetInput`
		// as an explicit `undefined` and the command sees the absent-resolution form slice 10
		// requires for a referent-free delete.
		dispatch: (resolved) => deps.deleteAsset.execute({ assetId, ...resolved }),
		copy: {
			reassignTitle: tr('view.asset-library.delete.reassign-title'),
			noReassignTarget: NO_REASSIGNMENT_ASSET,
		},
	};
	return await deleteWithReferences(bound, assetName);
}
