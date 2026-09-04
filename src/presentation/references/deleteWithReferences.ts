import { isErr, type Result } from '../../core/result/Result';
import type { AppError, ValidationError } from '../../core/errors/AppError';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { ReferenceResolution } from '../../application/reference/deleteResolution';
import type { ReassignmentTargetDto } from '../../application/queries/reassignmentTypes';
import type { ReferencingGroup } from '../../application/queries/ListRequirementsReferencing';
import type {
	DeleteReferenceDialogResult,
	EntityCandidate,
	EntityPickerDialogResult,
	ReferenceRow,
} from '../dialogs/dialog-store';
import { tr } from '../i18n/strings';

/**
 * PRD §63–64's delete-with-references decision, as a SHAPE two surfaces instantiate rather
 * than as one surface's flow a second surface copies.
 *
 * It was `deleteZoneFlow.ts` alone until the Asset library needed the identical gesture, and
 * the two candidate seams were: widen `DeleteZoneFlowDeps.dispatch` past `InspectorEdit` (the
 * Plan editor's own vocabulary, which the library has no store to speak), or lift the body.
 * The body is what moved, because the ONLY entity-specific thing in it was the shape of the
 * command input — every other step is a question about referents, dialogs and a set. Copying
 * it was refused outright: a second derivation answers differently the first time slice 10's
 * rules change, which is what the re-ask bound below is and what a copy would silently drop.
 *
 * **The entity ID is not a parameter here at all**, which is the measurable result of the
 * extraction rather than a stylistic choice. Every door that needed one — the two reads and
 * the dispatch — is a closure the CALLER builds, so this module cannot ask what kind of thing
 * is being deleted and cannot grow a branch that does. What it takes is a resolved LABEL,
 * which is the only fact about the entity a dialog states.
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
 * Nothing here decides an invariant. `DeleteZoneCommand` and `DeleteAssetCommand` each
 * re-check every one of them because a script or a migration never opens a dialog (§87
 * rule 5).
 *
 * Every user-facing string the dialogs receive is resolved before it reaches them —
 * nothing under `presentation/dialogs/` names a key. Two of them are resolved HERE rather
 * than by the caller, and that is deliberate: a reference row's label depends on whether the
 * group carries a `projectPath`, which is the ambiguity rule `ListRequirementsReferencing`
 * has already applied, so a caller building the label would be deriving that rule a second
 * time. Everything else still arrives resolved, in `copy` and in `entityLabel` — and
 * `entityLabel` is not a `StringKey` at all: it is the user's own text.
 */

/**
 * Three outcomes rather than a `Result`, because "the user pressed Cancel" is neither a
 * success nor a failure: notifying for it would report an error the user chose, and
 * treating it as a delete would move a selection off an entity that is still there.
 */
export type DeleteOutcome =
	| { readonly kind: 'deleted' }
	| { readonly kind: 'cancelled' }
	| { readonly kind: 'failed'; readonly error: AppError };

/**
 * What the user consented to, in the three fields both `DeleteZoneInput` and
 * `DeleteAssetInput` carry.
 *
 * `application/reference/deleteResolution.ts`'s own `ResolutionInput` is this shape with
 * `reassignTo` typed as a bare `string`, which is right for a command that validates it and
 * wrong for a caller that has to SPREAD it into a branded input. Parameterising the id here
 * is what lets each caller write `{ …its own key, ...resolved }` with no cast and no
 * per-field reassembly, and it is why the one cast in this file is at the picker's answer:
 * `EntityPickerDialogResult` is a plain `{ id: string }` because the dialog renders what it
 * was handed and knows nothing about zones or assets.
 */
export interface ResolvedDeletion<Id extends string> {
	readonly resolution?: ReferenceResolution;
	readonly reassignTo?: Id;
	readonly resolvedReferents?: readonly RequirementId[];
}

export interface DeleteWithReferencesDeps<Id extends string> {
	/**
	 * Slice 10's query — §58/§59 route this read through one, never a repository handle.
	 *
	 * GROUPED per project since design slice 19, because an Asset is owned by no project and
	 * its referents are no longer all in the project the user is looking at. A Zone still
	 * yields exactly one group, and an entity nothing references yields NONE — a group exists
	 * only for a project holding at least one referent, which is what lets every emptiness
	 * test below stay a test on the list itself.
	 *
	 * It takes no id: the caller closed over the one it is asking about.
	 */
	listReferents(): Promise<Result<readonly ReferencingGroup[], AppError>>;
	listReassignmentTargets(): Promise<Result<readonly ReassignmentTargetDto[], AppError>>;
	/** `dialogStore.openDialog({ kind: 'delete-reference', … })`, with the rows already built. */
	askResolution(
		entityLabel: string,
		references: readonly ReferenceRow[],
	): Promise<DeleteReferenceDialogResult>;
	askReassignTarget(
		title: string,
		candidates: readonly EntityCandidate[],
	): Promise<EntityPickerDialogResult>;
	/** The caller's one write path, so the delete is one entry in whatever history it has. */
	dispatch(resolved: ResolvedDeletion<Id>): Promise<Result<unknown, AppError>>;
	/**
	 * Resolved copy for the DIALOGS, plus the one refusal this module raises itself.
	 *
	 * `noReassignTarget` is a whole `ValidationError` rather than a sentence, and that is
	 * slice 11's rule kept rather than a convenience: `message` is developer English for a
	 * log line, and the sentence a user reads is resolved from the locale tables by
	 * `toUserMessage` at the notice. It is the CALLER's because the two surfaces mint
	 * different codes for it — there is no zone in this project to move these requirements
	 * to, and there is no other area-kind asset in the vault — and this module cannot know
	 * which sentence is true.
	 */
	readonly copy: {
		readonly reassignTitle: string;
		readonly noReassignTarget: ValidationError;
	};
}

/** `reference.referents-exist` is the command telling us our advisory read was stale. */
function isStaleReadRefusal(error: AppError): boolean {
	return error.code === 'reference.referents-exist';
}

/** The one refusal that earns a re-ask: the live set is no longer what was consented to. */
function isSetChanged(outcome: DeleteOutcome): boolean {
	return outcome.kind === 'failed' && outcome.error.code === 'reference.set-changed';
}

// The dispatch's own success VALUE is deliberately not read here: this flow reports whether
// the entity is gone, and every one of its dispatch paths writes when it succeeds. Whichever
// indicator cares which reads the same result one seam up.
function outcomeOf(dispatched: Result<unknown, AppError>): DeleteOutcome {
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
async function askAndDispatch<Id extends string>(
	deps: DeleteWithReferencesDeps<Id>,
	entityLabel: string,
	groups: readonly ReferencingGroup[],
): Promise<DeleteOutcome> {
	const referents = referentsOf(groups);
	const chosen = await deps.askResolution(entityLabel, rowsFor(groups));
	if (chosen.action === 'cancel') return { kind: 'cancelled' };

	if (chosen.action === 'reassign') {
		const targets = await deps.listReassignmentTargets();
		if (isErr(targets)) return { kind: 'failed', error: targets.error };
		// Reported rather than opened: a dialog whose only possible action is Cancel is a
		// dead end presented as a choice.
		if (targets.value.length === 0) {
			return { kind: 'failed', error: deps.copy.noReassignTarget };
		}
		const picked = await deps.askReassignTarget(deps.copy.reassignTitle, targets.value);
		if (picked === 'cancel') return { kind: 'cancelled' };
		return outcomeOf(
			await deps.dispatch({
				resolution: 'reassign',
				reassignTo: picked.id as Id,
				resolvedReferents: referents,
			}),
		);
	}

	return outcomeOf(
		await deps.dispatch({ resolution: chosen.action, resolvedReferents: referents }),
	);
}

/**
 * The zero branch: no resolution, because none was chosen. If a Requirement appeared
 * between the read and the dispatch the command refuses, and we ask after all — the same
 * decision the non-zero branch makes, one round-trip later. Answers the groups to ask
 * about, or the outcome to report instead.
 */
async function resolveZeroBranch<Id extends string>(
	deps: DeleteWithReferencesDeps<Id>,
): Promise<{ readonly groups: readonly ReferencingGroup[] } | { readonly outcome: DeleteOutcome }> {
	const bare = await deps.dispatch({});
	if (bare.ok || !isStaleReadRefusal(bare.error)) return { outcome: outcomeOf(bare) };
	const reread = await deps.listReferents();
	if (isErr(reread)) return { outcome: { kind: 'failed', error: reread.error } };
	// Gone again already: the refusal is the honest answer, not a dialog with an empty row.
	if (reread.value.length === 0) return { outcome: outcomeOf(bare) };
	return { groups: reread.value };
}

export async function deleteWithReferences<Id extends string>(
	deps: DeleteWithReferencesDeps<Id>,
	entityLabel: string,
): Promise<DeleteOutcome> {
	const initial = await deps.listReferents();
	if (isErr(initial)) return { kind: 'failed', error: initial.error };

	// No GROUP is no referent: the query builds one only for a project holding at least one,
	// so this is the same zero the flat shape used to test and not a weaker reading of it.
	let groups = initial.value;
	if (groups.length === 0) {
		const zero = await resolveZeroBranch(deps);
		if ('outcome' in zero) return zero.outcome;
		groups = zero.groups;
	}

	// One ask, and — only for `reference.set-changed` — one re-ask against the live set.
	// Spelled as two statements rather than a loop with a bound, because the bound IS the
	// rule: a set churning under the user must not be able to trap them in a reopening
	// dialog, and a loop invites the bound to be widened by someone who reads it as a retry
	// count. The second ask's own refusal is returned whatever it is.
	const first = await askAndDispatch(deps, entityLabel, groups);
	if (!isSetChanged(first)) return first;

	const live = await deps.listReferents();
	if (isErr(live)) return { kind: 'failed', error: live.error };
	// Every referent vanished while the dialog was open: the bare form is what an entity with
	// no referents takes, and its own refusal is what says otherwise.
	if (live.value.length === 0) return outcomeOf(await deps.dispatch({}));
	return await askAndDispatch(deps, entityLabel, live.value);
}
