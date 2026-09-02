import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	GeometryError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { Command } from '../../../application/commands/Command';
import type { DispatchOutcome, DispatchResult } from '../../../application/commands/DispatchOutcome';
import type {
	MoveSpatialObjectInput,
	MoveSpatialObjectResult,
} from '../../../application/commands/zone/MoveSpatialObject';
import { undoSuperseded, type WriteLedger } from '../../../application/editor/WriteLedger';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { UndoableCommand } from './undoable-command';

export type MoveError = ReferenceError | GeometryError | RepositoryError;
export type MoveCommand = Command<MoveSpatialObjectInput, Result<MoveSpatialObjectResult, MoveError>>;

/**
 * A reversible editor gesture wrapping slice 3's `MoveSpatialObjectCommand` (design
 * slice 6, `docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md`, "An inverse
 * is conditional on the write it inverts").
 *
 * The expectation presented on every dispatch after the first comes from the shared
 * `WriteLedger`, never from a field this adapter keeps itself — "The expectation is the
 * history's, not the adapter's" in the same document walks the exact sequence (a sibling
 * adapter touching the same zone in between) where a per-adapter memory goes stale and an
 * undo can never succeed again. The first `execute()` is the user's gesture and is
 * last-writer-wins, matching what `MoveSpatialObjectCommand` already does with no
 * `expected`.
 *
 * **This is also design slice 8's `ReversibleMoveZoneVertexCommand`**, which the spec
 * names for the vertex-drag gesture. There is no second class and there was never going to
 * be one: a vertex drag is a whole-geometry replacement exactly like a body drag — same
 * wrapped command, one forward and one inverse `Polygon`, expectations from the same
 * ledger. The two differ only in how `SelectTool` computes forward/inverse (one index
 * replaced versus every point translated), which happens there and not here. The name
 * existed briefly as an exported type alias so the spec's word appeared in code; an
 * exported name carrying no type of its own only makes a reader go looking for a second
 * implementation, so it is recorded in this paragraph instead.
 *
 * **This is the one adapter that observes a foreign write AFTER its own forward write, and
 * what that costs is stated rather than glossed.** Its four siblings read the resource
 * themselves before dispatching and so can say their inverse post-dates whatever they found;
 * this one keeps no snapshot at all — `SelectTool` computes both polygons from the render
 * state at drag START and hands them to the constructor — so the earliest reading available
 * to it is the one `MoveSpatialObjectCommand` reports having loaded, taken inside the
 * dispatch. Two consequences, both deliberate:
 *
 * - a peer writing between the drag starting and this write landing is not refused, which is
 *   the last-writer-wins rule above and is unchanged;
 * - this gesture records the generation the observation produced, so its OWN undo still
 *   applies. That is right when the leaf refreshed on the peer's `ZoneGeometryChanged` and
 *   the drag therefore started from the peer's geometry, which is the ordinary case; it
 *   restores a pre-peer polygon when the leaf had not yet refreshed — but the forward write
 *   had already overwritten the peer's geometry by then, so the loss is the last-writer-wins
 *   rule's and not this counter's. What the counter closes is the sandwich BELOW it: every
 *   earlier gesture on this zone is refused.
 */
export class ReversibleMoveZoneCommand implements UndoableCommand {
	private hasWritten = false;
	/**
	 * The `WriteLedger` generation this gesture's forward write executed under — captured at
	 * `execute` and compared again at `undo`.
	 *
	 * **The forward write's own conditioning cannot answer this question, which is why the
	 * counter exists.** The first execute is deliberately last-writer-wins (see the class
	 * header), so a foreign write between two gestures is not refused; the second gesture's
	 * undo then advances the ledger's TIP to a version the store really holds, and the first
	 * gesture's undo matches it and restores a polygon from before the peer's edit.
	 * `WriteLedger` walks all five steps. `null` until this gesture has written, because
	 * before that there is no inverse to protect.
	 */
	private generation: number | null = null;

	constructor(
		private readonly moveCommand: MoveCommand,
		private readonly ledger: WriteLedger,
		private readonly zoneId: ZoneId,
		private readonly forward: Polygon,
		private readonly inverse: Polygon,
	) {}

	execute(): Promise<DispatchResult> {
		return this.dispatch(this.forward);
	}

	undo(): Promise<Result<DispatchOutcome, MoveError | ValidationError>> {
		// Asked BEFORE the dispatch, because the question is about this gesture's premise
		// rather than about the write: once the ledger's generation has moved, the polygon
		// this adapter holds describes a state that stopped being the truth, and no
		// conditional write can notice — the tip it would be conditioned on is current.
		if (this.generation !== null && this.ledger.generation(this.zoneId) !== this.generation) {
			return Promise.resolve(err(undoSuperseded(this.zoneId)));
		}
		return this.dispatch(this.inverse);
	}

	private async dispatch(geometry: Polygon): Promise<Result<DispatchOutcome, MoveError>> {
		const expected = this.hasWritten ? this.ledger.lastWritten(this.zoneId) : undefined;
		const input: MoveSpatialObjectInput =
			expected === undefined || expected === null
				? { zoneId: this.zoneId, geometry }
				: { zoneId: this.zoneId, geometry, expected };
		const result = await this.moveCommand.execute(input);
		if (isErr(result)) return result;
		// The version the command's own LOAD found, compared against what this history last
		// wrote: two readings of one zone, one of them ours, which is the only place this
		// adapter can see a foreign write at all — it keeps no snapshot and opens no
		// repository. Observed AFTER the write rather than before it because the command
		// performs the read; what that costs is written into the class header.
		this.generation = this.ledger.observe(this.zoneId, result.value.before);
		this.hasWritten = true;
		this.ledger.record(this.zoneId, result.value.zone.version);
		return ok('wrote');
	}
}
