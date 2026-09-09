import type { EventBus } from '../../../core/events/EventBus';
import type { AppError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { Structure } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import type { PlanGeometryDocument, PlanGeometrySidecar, PlanGeometrySnapshot } from '../../ports/PlanGeometrySidecar';
import { checkExpectedVersion } from '../../ports/versioning';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';
import { persistenceError } from '../../errors';
import { sameGeometryDocument } from './sameGeometryDocument';
import { RoomBoundaryHistory } from './RoomBoundaryHistory';
import { groupsAfterStructureChange } from '../../../domain/spatial/groupMembership';

export interface SpatialRoomCommand {
	execute(): Promise<DispatchResult>;
	undo(): Promise<DispatchResult>;
	readonly createdZoneId: string | null;
	readonly points: PlanGeometryDocument['objects'][number]['points'];
}
export interface StructureServices {
	roomHistory(): RoomBoundaryHistory;
	read(id: PlanId): Promise<Result<PlanGeometrySnapshot, AppError>>;
	command(input: { planId: PlanId; baseline: PlanGeometrySnapshot; structure: Structure; ledger: WriteLedger; room?: SpatialRoomCommand }): { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };
}
type CommandInput = Parameters<StructureServices['command']>[0];

/** One conditional sidecar operation, optionally composed with existing Zone creation. */
class StructureCommand {
	private applied = false;
	private busy = false;
	private retired = false;
	private current: PlanGeometrySnapshot;
	private generation: number | null = null;
	constructor(private readonly deps: { geometry: PlanGeometrySidecar; events: EventBus }, private readonly input: CommandInput) {
		this.current = input.baseline;
	}

	execute(): Promise<DispatchResult> { return this.run(true); }
	undo(): Promise<DispatchResult> { return this.run(false); }
	private async run(forward: boolean): Promise<DispatchResult> {
		if (this.retired) return err(markUncompensated(persistenceError('spatial.recovery-required', 'Reopen the floor before editing.')));
		if (this.busy || this.applied === forward) return ok('no-write');
		this.busy = true;
		try {
			const checked = await this.check();
			if (!checked.ok) return checked;
			const result = forward ? await this.apply() : await this.revert();
			if (!result.ok) return result;
			this.applied = forward;
			await this.deps.events.publish({ type: 'PlanStructureChanged', payload: { planId: this.input.planId } });
			return result;
		} catch (cause) {
			return err(persistenceError('spatial.write-failed', 'The spatial operation failed.', cause));
		} finally { this.busy = false; }
	}

	private async check(): Promise<DispatchResult> {
		const { ledger, planId } = this.input;
		const live = await this.deps.geometry.read(planId);
		if (!live.ok) return live;
		if (this.generation === null) {
			const conflict = checkExpectedVersion('plan-geometry', planId, live.value.version, this.current.version);
			if (conflict) return err(conflict);
			this.generation = ledger.observe(planId, live.value.version);
		} else {
			// The generation DOES decide here, and a sibling Zone command is not what moves it:
			// every adapter that writes this sidecar under a zone's id also records the receipt
			// under the plan's (`recordRelatedWrite`), so a Room move and its undo leave the
			// plan's generation where this step recorded it, while a PEER write — one no adapter
			// here made, identical bytes or not — bumps it and refuses the undo. Deciding by the
			// document alone (tried on #86) could not tell those two apart.
			const generation = ledger.observe(planId, live.value.version);
			if (generation !== this.generation || !sameGeometryDocument(live.value.document, this.current.document)) return err(undoSuperseded(planId));
		}
		this.current = live.value;
		return ok('no-write');
	}

	private async write(document: PlanGeometryDocument): Promise<DispatchResult> {
		const valid = document.structure ? validateStructure(document.structure, document.objects.map(object => object.id)) : ok(undefined);
		if (!valid.ok) return valid;
		const written = await this.deps.geometry.write(this.input.planId, document, this.current.version);
		if (!written.ok) return written;
		this.current = { document, version: written.value };
		this.input.ledger.record(this.input.planId, written.value);
		return ok('wrote');
	}

	private async afterRoom(expected: PlanGeometryDocument): Promise<DispatchResult> {
		const read = await this.deps.geometry.read(this.input.planId);
		if (!read.ok) return read;
		if (!sameGeometryDocument(read.value.document, expected)) return err(undoSuperseded(this.input.planId));
		this.current = read.value;
		this.input.ledger.record(this.input.planId, read.value.version);
		return ok('wrote');
	}

	private async safe(action: () => Promise<DispatchResult>): Promise<DispatchResult> {
		try { return await action(); }
		catch (cause) { return err(persistenceError('spatial.write-failed', 'The spatial operation failed.', cause)); }
	}
	private recovery(): DispatchResult {
		this.retired = true;
		return err(markUncompensated(persistenceError('spatial.compensation-failed', 'Spatial recovery failed. Reopen the floor before editing.')));
	}
	private async restoreRoom(before: PlanGeometryDocument, room: SpatialRoomCommand): Promise<boolean> {
		return (await this.safe(() => room.undo())).ok && (await this.safe(() => this.afterRoom(before))).ok;
	}
	private withRoomBoundary(before: PlanGeometryDocument): Structure {
		const { room, structure } = this.input;
		if (!room) return structure;
		const existingIds = new Set(before.structure?.walls.map(wall => wall.id));
		const wallIds = structure.walls.filter(wall => !existingIds.has(wall.id)).map(wall => wall.id);
		return { ...structure, boundaries: [...structure.boundaries, { roomId: room.createdZoneId as string, wallIds }] };
	}

	private async apply(): Promise<DispatchResult> {
		const room = this.input.room;
		const before = this.current.document;
		if (room) {
			const created = await this.safe(() => room.execute());
			if (!created.ok) return created;
			const read = await this.safe(() => this.afterRoom({ ...before, objects: [...before.objects, { id: room.createdZoneId as string, points: room.points }] }));
			if (!read.ok) {
				return await this.restoreRoom(before, room) ? read : this.recovery();
			}
		}
		const structure = this.withRoomBoundary(before);
		const groups = groupsAfterStructureChange(this.current.document.groups, before.structure, structure);
		const result = await this.safe(() => this.write({ ...this.current.document, structure, ...(groups ? { groups } : {}) }));
		if (!result.ok && room) {
			if (!(await this.restoreRoom(before, room))) return this.recovery();
		}
		return result;
	}

	private async revert(): Promise<DispatchResult> {
		const before = this.current.document;
		const document = { ...before, structure: this.input.baseline.document.structure, groups: this.input.baseline.document.groups };
		const result = await this.safe(() => this.write(document));
		if (!result.ok || !this.input.room) return result;
		const room = this.input.room;
		const removed = await this.safe(() => room.undo());
		if (!removed.ok) {
			if (!(await this.safe(() => this.write(before))).ok) return this.recovery();
			return removed;
		}
		const read = await this.safe(() => this.afterRoom(this.input.baseline.document));
		return read.ok ? ok('wrote') : this.recovery();
	}
}

export function structureServices(geometry: PlanGeometrySidecar, events: EventBus): StructureServices {
	return { roomHistory: () => new RoomBoundaryHistory(geometry), read: id => geometry.read(id), command: input => new StructureCommand({ geometry, events }, input) };
}
