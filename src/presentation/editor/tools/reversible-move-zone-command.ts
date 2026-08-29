import { isErr, ok, type Result } from '../../../core/result/Result';
import type {
	AppError,
	GeometryError,
	ReferenceError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { Command } from '../../../application/commands/Command';
import type { DispatchOutcome } from '../../../application/commands/DispatchOutcome';
import type { MoveSpatialObjectInput } from '../../../application/commands/zone/MoveSpatialObject';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Loaded } from '../../../application/ports/versioning';
import type { Zone } from '../../../domain/zone/Zone';
import type { UndoableCommand } from './undoable-command';

type MoveError = ReferenceError | GeometryError | RepositoryError;
type MoveCommand = Command<MoveSpatialObjectInput, Result<{ zone: Loaded<Zone> }, MoveError>>;

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
 */
export class ReversibleMoveZoneCommand implements UndoableCommand {
	private hasWritten = false;

	constructor(
		private readonly moveCommand: MoveCommand,
		private readonly ledger: WriteLedger,
		private readonly zoneId: ZoneId,
		private readonly forward: Polygon,
		private readonly inverse: Polygon,
	) {}

	execute(): Promise<Result<DispatchOutcome, AppError>> {
		return this.dispatch(this.forward);
	}

	undo(): Promise<Result<DispatchOutcome, AppError>> {
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
		this.hasWritten = true;
		this.ledger.record(this.zoneId, result.value.zone.version);
		return ok('wrote');
	}
}
