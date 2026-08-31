import type { DispatchResult } from '../../../application/commands/DispatchOutcome';

/**
 * A reversible editor gesture (SDD §30, design slice 6). A thin adapter around a plain
 * application command — capturing whatever state it needs at gesture end to compute an
 * inverse — never the command itself.
 *
 * **Both methods resolve a `DispatchOutcome` rather than `void`, and the reason is written
 * up in full where that type is declared.** This docblock used to say `CommandHistory` "only
 * ever needs to know whether a write succeeded, not what it returned, so both methods discard
 * the wrapped command's success payload" — accurate about the stacks and false about slice
 * 13's save indicator, which needs to know whether a write LANDED. `ok` is not evidence of
 * that: four dispatch paths succeed having written nothing, and each of them cleared a
 * `save-error` raised by a real persistence failure. The wrapped command's payload is still
 * discarded; what survives is one bit about the vault.
 *
 * Neither method ever rejects for an expected domain or persistence failure (SDD §65) —
 * only an unexpected technical fault throws. `CommandHistory` inspects the resolved
 * `Result` explicitly at every operation before touching a stack, and it reads only
 * `isErr`: which of the two outcomes a success carries decides nothing about a stack. A
 * gesture that wrote nothing is still undoable in the sense the stacks care about — it
 * happened, and undoing it is a legal thing to ask for.
 */
export interface UndoableCommand {
	execute(): Promise<DispatchResult>;
	undo(): Promise<DispatchResult>;
}
