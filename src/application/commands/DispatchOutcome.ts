import type { AppError } from '../../core/errors/AppError';

/**
 * What a dispatched reversible gesture DID, beside whether it succeeded.
 *
 * **`ok` is not evidence that anything was written, and treating it as such shipped a false
 * assurance.** `UndoableCommand` used to resolve `Result<void, AppError>` under a docblock
 * arguing that "`CommandHistory` only ever needs to know whether a write succeeded, not what
 * it returned" — true of the stacks, which is all that existed when it was written, and false
 * of design slice 13's save indicator, whose whole subject is whether this Plan's data is
 * safely written. `SaveStateStore` states the rule categorically: only a write that actually
 * succeeded may clear a `save-error`. With `void` as the success type the tracker had to
 * INFER one from the other, and every successful no-op cleared a badge left by a real
 * persistence failure.
 *
 * There is no safe default for that inference, which is why this is a value and not a
 * convention. Reading every `ok` as a write is the defect above. Reading every `ok` as a
 * no-write is worse in the other direction — a genuine successful save would never clear the
 * badge, and the indicator would rest on `save-error` for the session.
 *
 * **Required rather than optional, deliberately.** A `void | 'no-write'` widening would have
 * changed two call sites and left every other `ok(undefined)` compiling, which makes this a
 * SELF-DECLARED property: the next command that writes nothing and forgets to say so would
 * reintroduce the same defect silently. As a required union every `ok(...)` in every adapter
 * is a build error until somebody decides, which is the same shape design slice 15 records
 * for adding a dialog kind — four of its five edits are build failures and only the last is
 * something the compiler cannot make you write.
 *
 * **The four no-write successes that exist today**, so the union has subjects rather than
 * only a rationale:
 *
 * - `ReversibleAssignAssetCommand.execute()` when the asset is already assigned to the zone.
 *   `AssignAssetCommand` returns `ok({ created: false })` from a read, having saved nothing.
 * - the same adapter's `undo()` when its recorded outcome is `'found'` — undo deletes only
 *   what execute created, so there is nothing to delete and nothing to write.
 * - `CommandHistory.undo()` on an empty undo stack, and `redo()` on an empty redo stack.
 *   Both resolve `ok` without reaching a command at all.
 *
 * The first is one click in the Inspector, which is what made this a P1 rather than a
 * curiosity.
 *
 * **What this does NOT model, and the distinction is the reason the union has two members
 * rather than a count.** It says whether a dispatch reached the vault, not how much it wrote
 * or which entities moved. A resolution that writes an entity and six Requirements is one
 * `'wrote'`, exactly like a single zone rename — the save indicator asks one question and
 * this answers that question. A consumer wanting more would be asking for something the
 * commands do not report either.
 *
 * It lives in `application/` because the commands PRODUCE it: the reversible adapters are
 * application code and may not import `presentation/`, where `UndoableCommand` itself lives
 * and satisfies this structurally.
 */
export type DispatchOutcome = 'wrote' | 'no-write';

/**
 * The same question on the OTHER channel of the same `Result`: a refusal that left writes
 * standing in the vault.
 *
 * **`DispatchOutcome` answers "did this dispatch write" for successes only, and the failure
 * channel needed the same answer for the same reason.** A `Result` carries an `AppError` and
 * nothing else when it fails, so slice 13's save indicator had to INFER the answer from the
 * error's category — pre-write categories neutral, everything else reported. That inference
 * is sound exactly while every raise site in those categories really is pre-write, and
 * `deleteResolution.ts` holds one that is not: `applyAll` writes a Requirement per referent,
 * and a refusal on the third has already saved the first two. A failing compensation then
 * leaves them standing, and the category axis reports the whole thing as `Reference` — which
 * `affectsSaveState` reads as "wrote nothing" and settles the indicator to `Saved` over a
 * half-written plan. The category cannot see a write; only the code that performed one can.
 *
 * **Additive, and that is the whole reason this shape was chosen over the two that were
 * rejected before it.** `affects-save-state.ts` turned down carving `requirement.not-found`
 * out by CODE (it is genuinely pre-write at its other raise sites, so the carve-out would
 * trade a false silence for a false badge on an override of a Requirement somebody else
 * deleted) and turned down re-labelling the refusal's CATEGORY (which changes the sentence
 * `toUserMessage` resolves for it, and error-to-surface mapping is slice 17's territory).
 * A flag beside the error changes neither: `category`, `code` and `message` are untouched, so
 * every consumer that reads them reads exactly what it read before, and the one consumer that
 * asks about persistence gets an answer nothing had to infer.
 *
 * **Its only producer today is `compensate` in `application/reference/deleteResolution.ts`**,
 * at the one moment the vault is KNOWN to be half-written — a restore that refused, or a
 * completed forward write compensation could not find a snapshot for. A compensation that
 * succeeds leaves the vault at its pre-state and is deliberately NOT marked: neutral is the
 * true answer there, and marking it would be the false badge this shape exists to avoid.
 */
export interface UncompensatedWrite {
	readonly uncompensatedWrite: true;
}

/**
 * Stamp a refusal as having left writes behind. Returns a copy: the errors these sequences
 * carry are plain data (`AppError` is deliberately not a class), and mutating a caller's
 * value to record something about the caller's own failure is a second surprise on top of
 * the first.
 */
export function markUncompensated<TError extends AppError>(
	error: TError,
): TError & UncompensatedWrite {
	return { ...error, uncompensatedWrite: true };
}

/**
 * Did this refusal leave writes standing? Asked rather than spelled inline at the two call
 * sites, so `uncompensatedWrite` is a string in ONE place and a consumer cannot half-spell it
 * into a predicate that silently answers `false` forever.
 */
export function leftWritesBehind(error: AppError): boolean {
	return (error as Partial<UncompensatedWrite>).uncompensatedWrite === true;
}
