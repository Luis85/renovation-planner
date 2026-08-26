import { isErr, type Result } from '../../core/result/Result';
import type { AppError, ValidationError } from '../../core/errors/AppError';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { ReassignmentTargetDto } from '../../application/queries/reassignmentTypes';
import type { DeleteReferenceDialogResult, EntityCandidate } from '../dialogs/dialog-store';
import type { InspectorEdit } from './inspector/inspector-store';

/**
 * PRD §63–64's delete-with-references decision, as the Inspector's Delete button runs it —
 * the caller slice 15 built `DeleteReferenceDialog` and `EntityPickerDialog` for and
 * deliberately did not write, because the queries it reads and the command fields it
 * carries are design slice 10's to define.
 *
 * The whole point of the shape below is that **the read informs and the command
 * enforces**, and the two are allowed to disagree:
 *
 * - The referent read happens BEFORE the dialog and is stale by construction. It is never
 *   turned into consent: a zero count dispatches the ABSENT-resolution form, whose failure
 *   mode is a refusal (recoverable by asking), rather than a `delete-anyway` the user was
 *   never offered (whose failure mode is stranded Requirements the re-check cannot argue
 *   with, because consent is exactly what it does not second-guess).
 * - A resolution travels with `resolvedReferents` — the exact IDs the dialog's row was
 *   built from, not a count and not the live set — so the command can compare SETS and
 *   refuse a resolution consented to over a different one.
 * - `reference.set-changed` is re-asked exactly ONCE, against the re-read set. A second
 *   refusal is surfaced: a reference set churning under the user must not be able to trap
 *   them in a reopening dialog.
 *
 * Nothing here decides an invariant. `DeleteZoneCommand` re-checks every one of them
 * because a script or a migration never opens a dialog (§87 rule 5).
 *
 * Every user-facing string arrives already resolved, in `copy` and in `zoneName` — the
 * dialogs resolve nothing on their own behalf, and neither does this. `zoneName` is not a
 * `StringKey` at all: it is the user's own text.
 */

/**
 * Three outcomes rather than a `Result`, because "the user pressed Cancel" is neither a
 * success nor a failure: notifying for it would report an error the user chose, and
 * treating it as a delete would move the selection off a zone that is still there.
 */
export type DeleteZoneOutcome =
	| { readonly kind: 'deleted' }
	| { readonly kind: 'cancelled' }
	| { readonly kind: 'failed'; readonly error: AppError };

export interface DeleteZoneFlowDeps {
	/** Slice 10's query — §58/§59 route this read through one, never a repository handle. */
	listReferents(zoneId: string): Promise<Result<readonly RequirementId[], AppError>>;
	listReassignmentTargets(zoneId: string): Promise<Result<readonly ReassignmentTargetDto[], AppError>>;
	/** `dialogStore.openDialog({ kind: 'delete-reference', … })`, with the copy already resolved. */
	askResolution(
		entityLabel: string,
		referenceLabel: string,
		count: number,
	): Promise<DeleteReferenceDialogResult>;
	askReassignTarget(
		title: string,
		candidates: readonly EntityCandidate[],
	): Promise<{ readonly id: string } | 'cancel'>;
	/** The Inspector's ONE commit path (SDD §59), so the delete is one history entry like any other. */
	dispatch(edit: InspectorEdit): Promise<Result<void, AppError>>;
	/**
	 * Resolved copy for the DIALOGS, supplied by the caller — nothing under
	 * `presentation/dialogs/` names a key. Refusal copy is deliberately NOT here: an
	 * `AppError` carries a code, and the sentence a user reads for it is resolved from the
	 * locale tables at the notice by `toUserMessage`. This object once carried a
	 * `noReassignTarget` sentence that was stuffed into `AppError.message` and then
	 * discarded unread — see `NO_REASSIGNMENT_TARGET` below.
	 */
	readonly copy: {
		readonly referenceLabel: string;
		readonly reassignTitle: string;
	};
}

/** `reference.referents-exist` is the command telling us our advisory read was stale. */
function isStaleReadRefusal(error: AppError): boolean {
	return error.code === 'reference.referents-exist';
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
 */
const NO_REASSIGNMENT_TARGET: ValidationError = {
	category: 'Validation',
	code: 'reference.no-reassignment-target',
	message: 'This project has no other zone to repoint the referencing requirements at.',
};

/** The one refusal that earns a re-ask: the live set is no longer what was consented to. */
function isSetChanged(outcome: DeleteZoneOutcome): boolean {
	return outcome.kind === 'failed' && outcome.error.code === 'reference.set-changed';
}

function outcomeOf(dispatched: Result<void, AppError>): DeleteZoneOutcome {
	return dispatched.ok ? { kind: 'deleted' } : { kind: 'failed', error: dispatched.error };
}

/**
 * One ask and the dispatch it consents to. `referents` is what the dialog's row is built
 * from AND what travels to the command, which is what makes the two the same set by
 * construction rather than by a comparison nobody re-runs.
 */
async function askAndDispatch(
	deps: DeleteZoneFlowDeps,
	zoneId: ZoneId,
	zoneName: string,
	referents: readonly RequirementId[],
): Promise<DeleteZoneOutcome> {
	const chosen = await deps.askResolution(zoneName, deps.copy.referenceLabel, referents.length);
	if (chosen.action === 'cancel') return { kind: 'cancelled' };

	if (chosen.action === 'reassign') {
		const targets = await deps.listReassignmentTargets(zoneId);
		if (isErr(targets)) return { kind: 'failed', error: targets.error };
		// Reported rather than opened: a dialog whose only possible action is Cancel is a
		// dead end presented as a choice.
		if (targets.value.length === 0) {
			return { kind: 'failed', error: NO_REASSIGNMENT_TARGET };
		}
		const picked = await deps.askReassignTarget(deps.copy.reassignTitle, targets.value);
		if (picked === 'cancel') return { kind: 'cancelled' };
		return outcomeOf(
			await deps.dispatch({
				kind: 'delete',
				zoneId,
				resolution: 'reassign',
				reassignTo: picked.id as ZoneId,
				resolvedReferents: referents,
			}),
		);
	}

	return outcomeOf(
		await deps.dispatch({
			kind: 'delete',
			zoneId,
			resolution: chosen.action,
			resolvedReferents: referents,
		}),
	);
}

/**
 * The zero branch: no resolution, because none was chosen. If a Requirement appeared
 * between the read and the dispatch the command refuses, and we ask after all — the same
 * decision the non-zero branch makes, one round-trip later. Answers the referents to ask
 * about, or the outcome to report instead.
 */
async function resolveZeroBranch(
	deps: DeleteZoneFlowDeps,
	zoneId: ZoneId,
): Promise<{ readonly referents: readonly RequirementId[] } | { readonly outcome: DeleteZoneOutcome }> {
	const bare = await deps.dispatch({ kind: 'delete', zoneId });
	if (bare.ok || !isStaleReadRefusal(bare.error)) return { outcome: outcomeOf(bare) };
	const reread = await deps.listReferents(zoneId);
	if (isErr(reread)) return { outcome: { kind: 'failed', error: reread.error } };
	// Gone again already: the refusal is the honest answer, not a dialog with an empty row.
	if (reread.value.length === 0) return { outcome: outcomeOf(bare) };
	return { referents: reread.value };
}

export async function deleteZoneWithReferences(
	deps: DeleteZoneFlowDeps,
	zoneId: ZoneId,
	zoneName: string,
): Promise<DeleteZoneOutcome> {
	const initial = await deps.listReferents(zoneId);
	if (isErr(initial)) return { kind: 'failed', error: initial.error };

	let referents = initial.value;
	if (referents.length === 0) {
		const zero = await resolveZeroBranch(deps, zoneId);
		if ('outcome' in zero) return zero.outcome;
		referents = zero.referents;
	}

	// One ask, and — only for `reference.set-changed` — one re-ask against the live set.
	// Spelled as two statements rather than a loop with a bound, because the bound IS the
	// rule: a set churning under the user must not be able to trap them in a reopening
	// dialog, and a loop invites the bound to be widened by someone who reads it as a retry
	// count. The second ask's own refusal is returned whatever it is.
	const first = await askAndDispatch(deps, zoneId, zoneName, referents);
	if (!isSetChanged(first)) return first;

	const live = await deps.listReferents(zoneId);
	if (isErr(live)) return { kind: 'failed', error: live.error };
	// Every referent vanished while the dialog was open: the bare form is what a zone with
	// no referents takes, and its own refusal is what says otherwise.
	if (live.value.length === 0) return outcomeOf(await deps.dispatch({ kind: 'delete', zoneId }));
	return await askAndDispatch(deps, zoneId, zoneName, live.value);
}
