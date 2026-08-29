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
