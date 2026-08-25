import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type {
	CalculationError,
	PersistenceError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Point } from '../../../core/geometry/Point';
import { scale as scaleShape } from '../../../core/geometry/operations';
import type { PlanId } from '../../../domain/plan/PlanId';
import { planCalibrated } from '../../../domain/plan/Plan.events';
import { planError } from '../../../domain/plan/Plan.errors';
import { deriveCalibration, nonFiniteRescaleError } from '../../../domain/plan/Calibration';
import { zoneGeometryChanged } from '../../../domain/zone/Zone.events';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { EntityVersion } from '../../ports/versioning';
import type {
	PlanGeometryDocument,
	PlanGeometrySidecar,
} from '../../ports/PlanGeometrySidecar';
import type { PlanRepository } from '../../ports/PlanRepository';
import { loadPlan } from './loadPlan';

/**
 * What one calibration gesture supplies. Slice 3 declared this beside a plain
 * `CalibratePlanCommand` that this command REPLACED — the plain one derived a
 * calibration whose own points did not measure their `knownDistance` and rescaled no
 * existing geometry, so keeping it reachable meant two answers to what calibrating a
 * plan does. It was deleted rather than deprecated, and its input shape moved here, to
 * the one command that still holds it.
 */
export interface CalibratePlanInput {
	readonly planId: PlanId;
	/**
	 * In the plan's CURRENT world units — the space `event.worldPoint` already arrives in,
	 * which equals the background's pixel space only while the plan is uncalibrated and
	 * its placeholder scale is `1`. See `Calibration`.
	 */
	readonly pointA: Point;
	readonly pointB: Point;
	/** World units (mm) — like every length here (ADR-009). */
	readonly knownDistance: number;
}

function allPointsFinite(document: PlanGeometryDocument): boolean {
	for (const object of document.objects) {
		for (const point of object.points) {
			if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
		}
	}
	const calibration = document.calibration;
	return (
		calibration === null ||
		(Number.isFinite(calibration.pointA.x) &&
			Number.isFinite(calibration.pointA.y) &&
			Number.isFinite(calibration.pointB.x) &&
			Number.isFinite(calibration.pointB.y))
	);
}

/**
 * Design slice 7's undoable calibration (SDD §25, §29-31) — the ONE command that writes
 * a plan's calibration. It replaced slice 3's plain `CalibratePlanCommand`, which was
 * deleted rather than left beside it, and keeps that command's input shape and its
 * `PlanCalibrated`/`ZoneGeometryChanged` event vocabulary.
 *
 * One `execute()` is one transaction: derive the correction with
 * `deriveCalibration`, multiply EVERY world-unit coordinate for the plan by it — the
 * calibration's own points included, which is why a persisted calibration always
 * measures its own `knownDistance` — and land the whole document in ONE sidecar write,
 * so a refusal is all-or-nothing rather than half a plan at one scale and half at
 * another. First calibration and recalibration are deliberately the same operation: the
 * gate for warning the user is whether objects will be rescaled, not whether this is the
 * first time (that gate is slice 15's dialog, not this command's concern — a script, a
 * migration or an undo/redo replay never opens one).
 *
 * The write is CONDITIONAL on the version this execute's own read returned — including
 * the first one. The read and the write take the per-plan lock separately, so the lock
 * orders operations but not this read-then-write pair; presenting the read's version is
 * what turns a writer landing in between into a refusal rather than a silent lost update
 * of whole-document blast radius (a Zone move between the two would be overwritten by a
 * document built from before it). Redo re-presents what the undo wrote.
 *
 * The inverse is a SNAPSHOT against the version this execute wrote (slice 6's rule): it
 * restores the exact previous document only while nothing else has touched the sidecar —
 * another writer refusing with `plan-geometry.revision-conflict`, a hand edit that left
 * the revision alone refusing with `plan-geometry.external-modification`. Undoing past a
 * Zone move would otherwise silently divide coordinates authored under the NEW scale by
 * a correction they were never scaled by.
 *
 * **Deliberately NOT the shared `WriteLedger`**, unlike its sibling adapters: slice 6's
 * "the expectation is the history's" rule exists so a sibling command's own ordered
 * writes stay undoable past each other. This spec demands the OPPOSITE — design slice 7's
 * DoD refuses an undo when ANYTHING touched the plan's sidecar in between ("asserted by
 * moving a Zone between the calibration and its undo … both survive"), because the
 * restored snapshot is only valid against the exact bytes it was computed from. A ledger
 * would wave precisely that intervening sibling move through.
 *
 * The cascade travels both directions: `execute` publishes `PlanCalibrated` plus one
 * `ZoneGeometryChanged` per rescaled object, and `undo` re-publishes those geometry
 * events for what it un-rescaled — restoring coordinates without re-driving slice 10's
 * recalculation would leave quantities describing areas that no longer exist, marked
 * current. If a publish itself fails after the write landed, re-running `execute`
 * derives against the already-rescaled state and applies the correction twice; no caller
 * retries today (`CommandHistory` does not), and scripts/migrations must treat a failed
 * publish as terminal, not retryable.
 */
export class ReversibleCalibratePlanCommand {
	private lastWritten: EntityVersion | null = null;
	private inverse: {
		planId: PlanId;
		document: PlanGeometryDocument;
		objectIds: readonly string[];
		projectId: ProjectId;
	} | null = null;

	constructor(
		private readonly plans: PlanRepository,
		private readonly geometry: PlanGeometrySidecar,
		private readonly events: EventBus,
	) {}

	// Nothing in the COMPOSITION ROOT wires this yet — that arrives with slice 8's
	// toolbar and its ToolManager. Both halves are reached from `src/` all the same:
	// `CalibrateTool` closes over `execute(input)` and `undo()` in the zero-arg gesture
	// wrapper it hands the dispatcher, which is how the task doc's
	// `implements UndoableCommand` sketch is satisfied without an application class naming
	// a presentation interface. That reference is also why neither method needs the
	// `fallow-ignore` mark `ReversibleSetPlanBackground` still carries: they had one while
	// the tool imported its input type from the deleted slice-3 command, and fallow now
	// resolves both through the tool.
	async execute(
		input: CalibratePlanInput,
	): Promise<Result<void, ReferenceError | ValidationError | CalculationError | PersistenceError>> {
		const found = await loadPlan(this.plans, input.planId);
		if (isErr(found)) {
			return found;
		}
		const snapshot = await this.geometry.read(input.planId);
		if (!snapshot.ok) {
			return snapshot;
		}
		const derived = deriveCalibration(input.pointA, input.pointB, input.knownDistance, snapshot.value.document.calibration);
		if (!derived.ok) {
			return derived;
		}
		const { calibration, scaleCorrection } = derived.value;
		const origin: Point = { x: 0, y: 0 };
		// The rescale anchors at the world origin: background sizing and every zone move
		// uniformly, so alignment between them is preserved — only what the numbers MEAN
		// in millimetres changes.
		const document: PlanGeometryDocument = {
			calibration: {
				pointA: scaleShape(calibration.pointA, scaleCorrection, origin),
				pointB: scaleShape(calibration.pointB, scaleCorrection, origin),
				knownDistance: calibration.knownDistance,
				pixelsPerWorldUnit: calibration.pixelsPerWorldUnit,
			},
			objects: snapshot.value.document.objects.map((object) => ({
				id: object.id,
				points: scaleShape({ points: object.points }, scaleCorrection, origin).points,
			})),
		};
		// The ratio passing finite does not mean the PRODUCT did: a legal-looking input
		// (measured ~1e-302 over known 3200) yields a finite correction whose rescaled
		// coordinates overflow — and JSON persists Infinity as null, which the schema then
		// refuses on every later read. Refusing here keeps the sidecar readable.
		if (!allPointsFinite(document)) {
			return err(nonFiniteRescaleError());
		}
		const expected = this.lastWritten ?? snapshot.value.version;
		const written = await this.geometry.write(input.planId, document, expected);
		if (!written.ok) {
			return written;
		}
		this.lastWritten = written.value;
		const projectId = found.value.entity.projectId;
		this.inverse = {
			planId: input.planId,
			document: structuredClone(snapshot.value.document),
			objectIds: document.objects.map((object) => object.id),
			projectId,
		};

		await this.events.publish(planCalibrated({ planId: input.planId, projectId }));
		await this.announce(input.planId, projectId, document.objects.map((object) => object.id));
		return ok(undefined);
	}

	async undo(): Promise<Result<void, PersistenceError | ValidationError>> {
		const inverse = this.inverse;
		if (inverse === null || this.lastWritten === null) {
			return err(planError('nothing-to-undo', 'This calibration has no recorded previous state.'));
		}
		const written = await this.geometry.write(inverse.planId, inverse.document, this.lastWritten);
		if (!written.ok) {
			return written;
		}
		this.lastWritten = written.value;
		// Dropped once spent, exactly like `ReversibleSetPlanBackground`: redo re-runs
		// `execute` from the input the history kept and rebuilds everything it needs, while
		// a second undo would otherwise re-write the same restore — another revision bump
		// and a duplicate event cascade for a change that did not happen.
		this.inverse = null;
		await this.announce(inverse.planId, inverse.projectId, inverse.objectIds);
		return ok(undefined);
	}

	private async announce(
		planId: PlanId,
		projectId: ProjectId,
		objectIds: readonly string[],
	): Promise<void> {
		for (const id of objectIds) {
			// The cast crosses the same erasure the adapter's `'polygon'` literal names from
			// the other side: `SpatialObjectGeometry.id` is a bare string because the port
			// is document-grained, and schema v1 has exactly one spatial-object type, so
			// every entry IS a Zone. The day the sidecar grows a second type this stops
			// being true silently — the entry's type has to reach the port before then, and
			// this loop has to filter on it.
			await this.events.publish(zoneGeometryChanged({ zoneId: id as ZoneId, planId, projectId }));
		}
	}
}
