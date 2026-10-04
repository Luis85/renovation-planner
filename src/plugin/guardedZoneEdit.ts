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
 * **Its body is `guardedPlanNorth.ts`'s inner block character for character, and nothing in it
 * is zone-specific** — it guards both doors of ANY `UndoableCommand` under two event names, and
 * the name is about its one caller rather than about that shape. Said plainly rather than
 * refactored away: collapsing the two would edit `guardedPlanNorth`'s call site to share three
 * lines, and a sibling file per guarded factory is already this repository's shape —
 * `ls src/plugin/guarded*.ts` printed nine on 2026-09-17: `guardedAssetLibrary.ts`,
 * `guardedAssetPrice.ts`, `guardedGroups.ts`, `guardedPlanNorth.ts`, `guardedReferencePlan.ts`,
 * `guardedRenovation.ts` and `guardedStructure.ts` beside the `guardedServices.ts` hub and this
 * file. A third caller is the trigger for sharing it; two is a clone the reader can see whole.
 *
 * **In its own file rather than beside `guardCalibratePlan`, and the measurement behind that has
 * been RE-PROBED — the first version of this paragraph got it wrong.** It claimed
 * `guardedServices.ts` reached EXACTLY its 400-line cap with this function in it. It does not.
 * Re-measured 2026-09-17 by appending 400 throwaway `export const PROBE_i = i;` lines and reading
 * ESLint's own count back (`max-lines` is `{ max: 400, skipBlankLines: true, skipComments: true }`,
 * so `wc -l` overstates by a wide margin):
 *
 * - `guardedServices.ts` bare → `File has too many lines (786)`, i.e. **386** counted;
 * - `guardedServices.ts` with this function and its one missing import folded in → **(796)**,
 *   i.e. **396** counted — the function costs **10** counted lines there and would have left
 *   **4** of headroom, not zero;
 * - this file standing alone → **(413)**, i.e. **13** counted lines.
 *
 * Four lines is thin enough that a concurrent branch adding five would have produced a red merge,
 * which is the argument the extraction actually rests on — but "thin" is what the probe supports
 * and "exactly at the cap" is not, so the sentence is written to what the probe printed.
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
