import type { Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';

/**
 * A reversible editor gesture (SDD §30, design slice 6). A thin adapter around a plain
 * application command — capturing whatever state it needs at gesture end to compute an
 * inverse — never the command itself: `CommandHistory` only ever needs to know whether a
 * write succeeded, not what it returned, so both methods discard the wrapped command's
 * success payload and resolve `Result<void, AppError>`.
 *
 * Neither method ever rejects for an expected domain or persistence failure (SDD §65) —
 * only an unexpected technical fault throws. `CommandHistory` inspects the resolved
 * `Result` explicitly at every operation before touching a stack.
 */
export interface UndoableCommand {
	execute(): Promise<Result<void, AppError>>;
	undo(): Promise<Result<void, AppError>>;
}
