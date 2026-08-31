import { isErr, type Result } from '../../core/result/Result';
import type { AppError, ValidationError } from '../../core/errors/AppError';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { ReassignmentTargetDto } from '../../application/queries/reassignmentTypes';
import type { ReferencingGroup } from '../../application/queries/ListRequirementsReferencing';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type {
	DeleteReferenceDialogResult,
	EntityCandidate,
	ReferenceRow,
} from '../dialogs/dialog-store';
import type { InspectorEdit } from './inspector/inspector-store';
import { tr } from '../i18n/strings';

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
 * Every user-facing string the dialogs receive is resolved before it reaches them —
 * nothing under `presentation/dialogs/` names a key. Two of them are resolved HERE rather
 * than by the caller, and that is a change from this module's first shape: a reference
 * row's label depends on whether the group carries a `projectPath`, which is the ambiguity
 * rule `ListRequirementsReferencing` has already applied, so a caller building the label
 * would be deriving that rule a second time. Everything else still arrives resolved, in
 * `copy` and in `zoneName` — and `zoneName` is not a `StringKey` at all: it is the user's
 * own text.
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
	/**
	 * Slice 10's query — §58/§59 route this read through one, never a repository handle.
	 *
	 * GROUPED per project since design slice 19, because an Asset is owned by no project and
	 * its referents are no longer all in the project the user is looking at. A Zone still
	 * yields exactly one group, and a zone nothing references yields NONE — a group exists
	 * only for a project holding at least one referent, which is what lets every emptiness
	 * test below stay a test on the list itself.
	 */
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
	): Promise<{ readonly id: string } | 'cancel'>;
	/** The Inspector's ONE commit path (SDD §59), so the delete is one history entry like any other. */
	dispatch(edit: InspectorEdit): Promise<DispatchResult>;
	/**
	 * Resolved copy for the DIALOGS, supplied by the caller — nothing under
	 * `presentation/dialogs/` names a key. Refusal copy is deliberately NOT here: an
	 * `AppError` carries a code, and the sentence a user reads for it is resolved from the
	 * locale tables at the notice by `toUserMessage`. This object once carried a
	 * `noReassignTarget` sentence that was stuffed into `AppError.message` and then
	 * discarded unread — see `NO_REASSIGNMENT_TARGET` below.
	 */
	readonly copy: {
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

// The dispatch's `DispatchOutcome` is deliberately not read here: this flow reports whether
// the ZONE is gone, and every one of its dispatch paths writes when it succeeds. The save
// indicator is the consumer that cares which, and it reads the same result one seam up.
function outcomeOf(dispatched: DispatchResult): DeleteZoneOutcome {
	return dispatched.ok ? { kind: 'deleted' } : { kind: 'failed', error: dispatched.error };
}

/**
 * Slice 15's Definition of Done item 6: one dialog row per referencing PROJECT, named by
 * that project and counting the referents it holds.
 *
 * ONE KEY PER LABEL, never a translated fragment concatenated with a name — word order and
 * the punctuation around an interpolated name are the translator's to choose
 * ([[Multilanguage]]), which is why the qualified form is its own key rather than
 * `reference.row.project` plus a hand-built separator.
 *
 * The path is taken on `projectPath !== undefined` and NOT on `'projectPath' in group`:
 * `ListRequirementsReferencing` writes the field as an explicit `undefined` for an
 * ambiguous project the index cannot place, so the `in` operator answers true with no value
 * and the row would read `Kitchen refit — undefined`.
 */
export function rowsFor(groups: readonly ReferencingGroup[]): readonly ReferenceRow[] {
	return groups.map((group) => ({
		label: group.projectPath === undefined
			? tr('reference.row.project', { name: group.projectName })
			: tr('reference.row.project-at-path', { name: group.projectName, path: group.projectPath }),
		count: group.requirementIds.length,
	}));
}

/**
 * The flat set the COMMAND compares, taken from the same groups the rows were drawn from —
 * one derivation, so the rows and `resolvedReferents` cannot describe different sets.
 */
function referentsOf(groups: readonly ReferencingGroup[]): readonly RequirementId[] {
	return groups.flatMap((group) => group.requirementIds);
}

/**
 * One ask and the dispatch it consents to. `groups` is what the dialog's rows are built
 * from AND what the command's `resolvedReferents` is flattened out of, which is what makes
 * the two the same set by construction rather than by a comparison nobody re-runs.
 */
async function askAndDispatch(
	deps: DeleteZoneFlowDeps,
	zoneId: ZoneId,
	zoneName: string,
	groups: readonly ReferencingGroup[],
): Promise<DeleteZoneOutcome> {
	const referents = referentsOf(groups);
	const chosen = await deps.askResolution(zoneName, rowsFor(groups));
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
 * decision the non-zero branch makes, one round-trip later. Answers the groups to ask
 * about, or the outcome to report instead.
 */
async function resolveZeroBranch(
	deps: DeleteZoneFlowDeps,
	zoneId: ZoneId,
): Promise<{ readonly groups: readonly ReferencingGroup[] } | { readonly outcome: DeleteZoneOutcome }> {
	const bare = await deps.dispatch({ kind: 'delete', zoneId });
	if (bare.ok || !isStaleReadRefusal(bare.error)) return { outcome: outcomeOf(bare) };
	const reread = await deps.listReferents(zoneId);
	if (isErr(reread)) return { outcome: { kind: 'failed', error: reread.error } };
	// Gone again already: the refusal is the honest answer, not a dialog with an empty row.
	if (reread.value.length === 0) return { outcome: outcomeOf(bare) };
	return { groups: reread.value };
}

export async function deleteZoneWithReferences(
	deps: DeleteZoneFlowDeps,
	zoneId: ZoneId,
	zoneName: string,
): Promise<DeleteZoneOutcome> {
	const initial = await deps.listReferents(zoneId);
	if (isErr(initial)) return { kind: 'failed', error: initial.error };

	// No GROUP is no referent: the query builds one only for a project holding at least one,
	// so this is the same zero the flat shape used to test and not a weaker reading of it.
	let groups = initial.value;
	if (groups.length === 0) {
		const zero = await resolveZeroBranch(deps, zoneId);
		if ('outcome' in zero) return zero.outcome;
		groups = zero.groups;
	}

	// One ask, and — only for `reference.set-changed` — one re-ask against the live set.
	// Spelled as two statements rather than a loop with a bound, because the bound IS the
	// rule: a set churning under the user must not be able to trap them in a reopening
	// dialog, and a loop invites the bound to be widened by someone who reads it as a retry
	// count. The second ask's own refusal is returned whatever it is.
	const first = await askAndDispatch(deps, zoneId, zoneName, groups);
	if (!isSetChanged(first)) return first;

	const live = await deps.listReferents(zoneId);
	if (isErr(live)) return { kind: 'failed', error: live.error };
	// Every referent vanished while the dialog was open: the bare form is what a zone with
	// no referents takes, and its own refusal is what says otherwise.
	if (live.value.length === 0) return outcomeOf(await deps.dispatch({ kind: 'delete', zoneId }));
	return await askAndDispatch(deps, zoneId, zoneName, live.value);
}
