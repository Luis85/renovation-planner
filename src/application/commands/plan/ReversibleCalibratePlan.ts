import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { DispatchOutcome } from '../DispatchOutcome';
import type {
	CalculationError,
	ReferenceError,
	ValidationError,
} from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { EventBus } from '../../../core/events/EventBus';
import type { Point } from '../../../core/geometry/Point';
import { scale as scaleShape } from '../../../core/geometry/operations';
import type { PlanId } from '../../../domain/plan/PlanId';
import { planCalibrated } from '../../../domain/plan/Plan.events';
import { planError } from '../../../domain/plan/Plan.errors';
import { deriveCalibration, nonFiniteRescaleError, validateCalibration, type Calibration } from '../../../domain/plan/Calibration';
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
import { scaleStructure, validateStructure } from '../../../domain/spatial/structureGeometry';

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

export function calibrateDocument(previous: PlanGeometryDocument, input: Pick<CalibratePlanInput, 'pointA' | 'pointB' | 'knownDistance'>) {
		const derived = deriveCalibration(input.pointA, input.pointB, input.knownDistance, previous.calibration);
		if (!derived.ok) {
			return derived;
		}
		const { calibration, scaleCorrection } = derived.value;
		const origin: Point = { x: 0, y: 0 };
		// Typed `Calibration`, never null: `PlanGeometryDocument.calibration` is nullable in
		// general, but this document's is always this value, so validating the local needs no
		// null check whose other arm nothing can reach.
		const rescaledCalibration: Calibration = {
			pointA: scaleShape(calibration.pointA, scaleCorrection, origin),
			pointB: scaleShape(calibration.pointB, scaleCorrection, origin),
			knownDistance: calibration.knownDistance,
			pixelsPerWorldUnit: calibration.pixelsPerWorldUnit,
		};
		// The rescale anchors at the world origin: background sizing and every zone move
		// uniformly, so alignment between them is preserved — only what the numbers MEAN
		// in millimetres changes.
		const document: PlanGeometryDocument = {
			...previous,
			...(previous.intended ? { intended: scaleStructure(previous.intended, scaleCorrection) } : {}),
			...(previous.structure ? { structure: scaleStructure(previous.structure, scaleCorrection) } : {}),
			calibration: rescaledCalibration,
			objects: previous.objects.map((object) => ({
				...object,
				points: scaleShape({ points: object.points }, scaleCorrection, origin).points,
				// A caption follows its room: the offset is world millimetres, so it rescales with the points.
				...(object.labelOffset ? { labelOffset: { dx: object.labelOffset.dx * scaleCorrection, dy: object.labelOffset.dy * scaleCorrection } } : {}),
			})),
		};
		// The ratio passing finite does not mean the PRODUCT did: a legal-looking input
		// (measured ~1e-302 over known 3200) yields a finite correction whose rescaled
		// coordinates overflow — and JSON persists Infinity as null, which the schema then
		// refuses on every later read. Refusing here keeps the sidecar readable.
		if (!allPointsFinite(document)) {
			return err(nonFiniteRescaleError());
		}
		for (const structure of [document.structure, document.intended]) {
			if (!structure) continue;
			const checked = validateStructure(structure, document.objects.map(object => object.id));
			if (!checked.ok) return checked;
		}
		const checkedCalibration = validateCalibration(rescaledCalibration);
		if (!checkedCalibration.ok) return checkedCalibration;
		return ok(document);
}

/**
 * Design slice 7's undoable calibration (SDD §25, §29-31). Reference setup now shares
 * its complete-document math through `calibrateDocument` (ADR-0019). It replaced slice 3's plain `CalibratePlanCommand`, which was
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
 * **That also makes it the one adapter IMMUNE to the sandwich the shared ledger's generation
 * counter exists for, and this was measured rather than reasoned.** A private field is
 * per-GESTURE: this gesture conditions its restore on the version IT wrote, and a peer write
 * plus a later gesture's own writes on top all leave the sidecar somewhere that version is
 * not, so the store refuses. The shared ledger is precisely the thing that would carry a
 * later gesture's progress back to this one. `reversibleCalibratePlan.test.ts`'s last block
 * drives the five-step sandwich and pins the refusal, so moving this adapter onto the shared
 * ledger — the obvious tidy-up, since its four siblings are on one — fails at an assertion
 * instead of quietly reintroducing a lost update.
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
	): Promise<Result<DispatchOutcome, ReferenceError | ValidationError | CalculationError | RepositoryError>> {
		const found = await loadPlan(this.plans, input.planId);
		if (isErr(found)) {
			return found;
		}
		const snapshot = await this.geometry.read(input.planId);
		if (!snapshot.ok) {
			return snapshot;
		}
		const calibrated = calibrateDocument(snapshot.value.document, input);
		if (!calibrated.ok) return calibrated;
		const document = calibrated.value;
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

		await this.announce(
			input.planId,
			projectId,
			document.objects.map((object) => object.id),
		);
		return ok('wrote');
	}

	async undo(): Promise<Result<DispatchOutcome, RepositoryError>> {
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
		return ok('wrote');
	}

	/**
	 * The whole cascade a scale change produces, in ONE place so that both halves publish
	 * the same set.
	 *
	 * `PlanCalibrated` used to be published by `execute` alone, and it is the only one of
	 * these events a Plan Editor leaf was subscribed to — so undoing a calibration
	 * refreshed no leaf at all, while the class comment claimed "the cascade travels both
	 * directions". Putting it here is what makes that sentence a property of the code
	 * rather than of the caller that remembered.
	 *
	 * The per-object events are published ONE AT A TIME, and the concurrent `Promise.all`
	 * this replaced is why. Each `ZoneGeometryChanged` starts a recalculation cascade that
	 * bounds ITSELF at four concurrent writes (`CASCADE_CONCURRENCY` in `cascade.ts`) — a
	 * bound chosen against the disk and Obsidian's adapter. Announcing every zone at once
	 * multiplied it: a forty-zone plan ran a hundred and sixty concurrent writes, and undo
	 * repeated the whole thing. Nothing here depends on the order zones are announced in;
	 * what the loop buys is that the bound one seam down still means what it says.
	 */
	private async announce(
		planId: PlanId,
		projectId: ProjectId,
		objectIds: readonly string[],
	): Promise<void> {
		await this.events.publish(planCalibrated({ planId, projectId }));
		// The cast crosses the same erasure the adapter's `'polygon'` literal names from the
		// other side: `SpatialObjectGeometry.id` is a bare string because the port is
		// document-grained, and schema v1 has exactly one spatial-object type, so every
		// entry IS a Zone. The day the sidecar grows a second type this stops being true
		// silently — the entry's type has to reach the port before then, and this fan-out
		// has to filter on it.
		for (const id of objectIds) {
			await this.events.publish(zoneGeometryChanged({ zoneId: id as ZoneId, planId, projectId }));
		}
	}
}
