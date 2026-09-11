import type { AppError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import { err, ok, type Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { placedRooms, placedStructure, type ClipboardIdPrefix, type PlacedStructure, type SpatialClipboard } from '../../../domain/spatial/clipboard';
import { EMPTY_STRUCTURE, type Structure } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { ZoneType } from '../../../domain/zone/ZoneType';
import type { WriteLedger } from '../../editor/WriteLedger';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';
import type { RenovationBaseline, RenovationInput, RenovationServices } from '../renovation/RenovationCommand';
import type { CreateZoneInput } from '../zone/CreateZone';
import type { GroupGeometryServices } from './GroupGeometryCommand';

export interface PasteStep { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> }
export interface PasteDeps {
	createRoom(input: CreateZoneInput): PasteStep & { readonly createdZoneId: ZoneId | null };
	readonly renovation: RenovationServices;
	readonly groups: GroupGeometryServices;
	readonly ledger: WriteLedger;
	mintId(prefix: ClipboardIdPrefix): string;
}
export interface PasteInput { readonly planId: PlanId; readonly clipboard: SpatialClipboard; readonly target: Point }

/** The floor's own structure with the paste's appended. */
function mergedStructure(baseline: RenovationBaseline, placed: PlacedStructure): Structure {
	const current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE, added = placed.structure;
	return { walls: [...current.walls, ...added.walls], openings: [...current.openings, ...added.openings],
		boundaries: [...current.boundaries, ...added.boundaries], elements: [...current.elements ?? [], ...added.elements] };
}

/** The floor's own structure and element names, with the paste's appended; renovation and planned geometry untouched. */
function spatialInput(baseline: RenovationBaseline, placed: PlacedStructure): RenovationInput {
	return {
		renovation: baseline.plan.entity.renovation ?? EMPTY_RENOVATION,
		intended: baseline.geometry.document.intended,
		spatial: { structure: mergedStructure(baseline, placed), metadata: [...baseline.plan.entity.spatialElements ?? [], ...placed.names] },
	};
}

/**
 * A paste as ONE undo step (design spec §5), composed of the commands that already own each
 * write rather than writing any file itself: a `ReversibleCreateZoneCommand` per Room, then one
 * `RenovationCommand` for walls, openings, boundaries, elements and their names, then one
 * `GroupGeometryCommand` for groups. Each later step reads the floor AFTER the earlier ones
 * wrote, and every step keeps its own snapshot, so redo restores the same ids.
 *
 * A step that refuses puts back the steps already taken in the same call, newest first, and
 * returns the refusal; if putting one back fails too, the refusal is marked uncompensated.
 */
export class PasteCommand {
	/** Set once the first `execute` has written everything; later ones are redos of `steps`. */
	private created = false;
	private steps: readonly PasteStep[] = [];
	private ids: readonly string[] = [];
	constructor(private readonly deps: PasteDeps, private readonly input: PasteInput) {}

	get pastedIds(): readonly string[] { return this.ids; }

	execute(): Promise<DispatchResult> { return this.created ? this.walk(this.steps, true) : this.first(); }
	undo(): Promise<DispatchResult> { return this.walk(this.steps.toReversed(), false); }

	private async first(): Promise<DispatchResult> {
		const refused = await this.refusal();
		if (refused) return err(refused);
		const { planId, clipboard, target } = this.input, done: PasteStep[] = [], roomIds: ZoneId[] = [];
		for (const room of placedRooms(clipboard, target)) {
			const step = this.deps.createRoom({ planId, name: room.name, zoneType: room.zoneType as ZoneType, geometry: { points: room.points, bulges: room.bulges } });
			const result = await step.execute();
			if (!result.ok) return this.restore(done, false, result.error);
			done.push(step); roomIds.push(step.createdZoneId as ZoneId);
		}
		const placed = placedStructure(clipboard, target, roomIds, prefix => this.deps.mintId(prefix));
		for (const next of [() => this.structureStep(placed), () => this.groupStep(placed)]) {
			const step = await next();
			const result = step.ok ? await this.run(step.value) : step;
			if (!result.ok) return this.restore(done, false, result.error);
			if (step.ok && step.value) done.push(step.value);
		}
		this.steps = done; this.created = true;
		this.ids = [...roomIds, ...placed.structure.walls.map(item => item.id), ...placed.structure.openings.map(item => item.id), ...placed.structure.elements.map(item => item.id)];
		return ok('wrote');
	}

	/**
	 * The structure refusal step 2's `RenovationCommand` would return — `validateStructure` over the
	 * merged structure and the floor's room ids — asked BEFORE step 1 writes a single Zone note, so a
	 * refused paste writes nothing. The rooms do not exist yet, so each stands in under its clipboard
	 * key, prefixed: on the floor it was copied from, the bare key IS an existing zone id, and a
	 * boundary naming it would be refused as a second boundary for that room. The ids this placement
	 * mints are thrown away with it; step 2 places the paste again under its own.
	 */
	private async refusal(): Promise<AppError | null> {
		const { planId, clipboard, target } = this.input;
		if (!clipboard.structure.walls.length && !clipboard.structure.elements.length) return null;
		const baseline = await this.deps.renovation.read(planId);
		if (!baseline.ok) return baseline.error;
		const standIns = clipboard.rooms.map(room => `paste:${room.key}`);
		const placed = placedStructure(clipboard, target, standIns, prefix => this.deps.mintId(prefix));
		const valid = validateStructure(mergedStructure(baseline.value, placed), [...baseline.value.geometry.document.objects.map(item => item.id), ...standIns]);
		return valid.ok ? null : valid.error;
	}

	private run(step: PasteStep | null): Promise<DispatchResult> {
		return step ? step.execute() : Promise.resolve(ok('no-write'));
	}

	private async structureStep(placed: PlacedStructure): Promise<Result<PasteStep | null, AppError>> {
		if (!placed.structure.walls.length && !placed.structure.elements.length) return ok(null);
		const baseline = await this.deps.renovation.read(this.input.planId);
		return baseline.ok ? ok(this.deps.renovation.command(baseline.value, spatialInput(baseline.value, placed), this.deps.ledger)) : baseline;
	}

	private async groupStep(placed: PlacedStructure): Promise<Result<PasteStep | null, AppError>> {
		if (!placed.groups.length) return ok(null);
		const baseline = await this.deps.groups.read(this.input.planId);
		if (!baseline.ok) return baseline;
		const document = { ...baseline.value.document, groups: [...baseline.value.document.groups ?? [], ...placed.groups] };
		return ok(this.deps.groups.command({ planId: this.input.planId, baseline: baseline.value, document, ledger: this.deps.ledger }));
	}

	private async walk(steps: readonly PasteStep[], forward: boolean): Promise<DispatchResult> {
		const moved: PasteStep[] = [];
		for (const step of steps) {
			const result = forward ? await step.execute() : await step.undo();
			if (!result.ok) return this.restore(moved, !forward, result.error);
			moved.push(step);
		}
		return ok('wrote');
	}

	private async restore(moved: readonly PasteStep[], forward: boolean, error: AppError): Promise<DispatchResult> {
		for (const step of moved.toReversed()) {
			const back = forward ? await step.execute() : await step.undo();
			if (!back.ok) return err(markUncompensated(error));
		}
		return err(error);
	}
}
