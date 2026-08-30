import { err, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { Logger } from '../../application/ports/Logger';
import type { DispatchOutcome } from '../../application/commands/DispatchOutcome';
import { faultError } from '../notices/notify';
import type { InspectorEdit } from './inspector/inspector-store';

/**
 * `commitEdit`'s guard, factored out into its own module (design slice 16) because
 * `runtime.ts` measures exactly its 400-line `max-lines` cap and has no headroom left for
 * this addition — moved rather than compressed, the same shape `composition-root.ts`'s own
 * budget crisis resolved by moving code out to `guardedServices.ts` rather than squeezing it.
 *
 * Guards ONLY the thrown half: a fault is mapped and logged once (`faultError`, which does
 * NOT notify) and converted to a failed `Result`, never left to reject the caller's promise
 * — every dispatch here is ultimately bound to a `@blur` handler or a click handler that
 * discards its promise, so an unconverted rejection would be an unhandled one reaching
 * nobody, and SDD §65 reserves throws for exactly that unexpected-fault case.
 *
 * The RESOLVED half — whether a refusal belongs under one field or in a notice — is left
 * entirely to whichever caller consumes the returned `Result`: `commitEdit` notifies once
 * for any refusal it sees (fault or resolved alike), and `useFieldCommit`'s own `notify`
 * does the same for the two override fields it drives. That is why this function calls
 * `faultError` and not `notifyFault`: a fault this guard announced ITSELF, on top of
 * whichever downstream owner announces the `Result` it hands back, would be the same
 * failure reported twice — which is exactly the defect a first version of this guard had,
 * found by asserting a notice COUNT rather than only the last notice's text.
 */
export function makeCommitField(
	logger: Logger,
	commit: (edit: InspectorEdit) => Promise<Result<DispatchOutcome, AppError>>,
): (edit: InspectorEdit) => Promise<Result<DispatchOutcome, AppError>> {
	return async (edit) => {
		try {
			return await commit(edit);
		} catch (cause) {
			return err(faultError(cause, logger, 'editor.dispatch.faulted'));
		}
	};
}
