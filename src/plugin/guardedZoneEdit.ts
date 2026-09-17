import type { Logger } from '../application/ports/Logger';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import type { UndoableCommand } from '../presentation/editor/tools/undoable-command';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

/**
 * Both doors of ONE Inspector zone edit, guarded — the same shape `guardCalibratePlan` takes,
 * one seam over, and for the same reason it gives.
 *
 * `EditZoneDetailsCommand` and `ReversibleRenameZoneCommand` are built PER EDIT in
 * `src/presentation/editor/inspector-wiring.ts`, each holding that edit's inverse and its own
 * generation, so neither ever passes through `PersistenceServices` and `composeGuarded` cannot
 * reach either. Until BP-02 slice 4 they were therefore constructed straight against the raw
 * `ZoneRepository` port — ADR-0034's Coverage paragraph names both by file and line as outside
 * the `guardCommand` chokepoint, which is what made an incident raised anywhere else in the
 * vault leave exactly these two edits still writing.
 *
 * BOTH doors, not `execute` alone. `undo()` is the door ADR-0034's own Consequences correction
 * records as still open on every other reversible adapter, and a guarded `execute` beside a raw
 * `undo` is a wrapper by every structural test anyone can write — which is the shape
 * `tests/plugin/guardCategory.test.ts`'s header exists to refuse.
 *
 * Neither door takes an argument (the edit is bound at construction), so each is presented to
 * the guard as a `Command` over `void`: the guard cares about the shape of the call, not about
 * who supplies the argument. `tests/plugin/guardWiring.test.ts` measures the door list rather
 * than assuming it and drives all four.
 *
 * In its own file rather than beside `guardCalibratePlan`, and that is a measurement rather than
 * taste: `guardedServices.ts` reached EXACTLY its 400-line `max-lines` cap with this function in
 * it — probed by appending three code lines and reading ESLint's own count back
 * (`File has too many lines (403). Maximum allowed is 400`), so the next line of code anywhere in
 * that file would have forced this extraction anyway. `guardedPlanNorth.ts` is the shape copied:
 * a one-function module importing `VAULT_EXCEPTION_MAPPER` rather than taking it as a parameter.
 */
export function guardZoneEdit(
	transaction: UndoableCommand,
	events: { readonly execute: string; readonly undo: string },
	logger: Logger,
): UndoableCommand {
	const execute = guardCommand({ execute: () => transaction.execute() }, events.execute, logger, VAULT_EXCEPTION_MAPPER);
	const undo = guardCommand({ execute: () => transaction.undo() }, events.undo, logger, VAULT_EXCEPTION_MAPPER);
	return { execute: () => execute.execute(undefined), undo: () => undo.execute(undefined) };
}
