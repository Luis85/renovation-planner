import type { AppError } from '../../../core/errors/AppError';
import { err, ok } from '../../../core/result/Result';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';

export interface SpatialCommandState { applied: boolean; busy: boolean; retired: boolean }

/** Shared admission and finally boundary; each command retains its own write/compensation sequence. */
export async function runSpatialCommand(
	state: SpatialCommandState,
	forward: boolean,
	operation: () => Promise<DispatchResult>,
	faults: { recovery: () => AppError; unexpected: (cause: unknown) => AppError },
): Promise<DispatchResult> {
	// Empty, genuinely: `SpatialCommandState` carries no id at all, and this function is shared
	// by every command that wraps it (`StructureCommand`, `GroupGeometryCommand`, …), so there
	// is no per-kind field here to reach for either. The command that first set `state.retired`
	// stamped its OWN entity at its own call site; this is only the "already retired, refuse
	// again" arm on a later call.
	if (state.retired) return err(markUncompensated(faults.recovery(), []));
	if (state.busy || state.applied === forward) return ok('no-write');
	state.busy = true;
	try { return await operation(); }
	catch (cause) { return err(faults.unexpected(cause)); }
	finally { state.busy = false; }
}
