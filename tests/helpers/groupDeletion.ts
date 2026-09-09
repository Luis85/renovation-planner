import { structureStack, WALL_LOOP } from './structure';
import { expectDefined, expectFound, expectOk } from './domain';
import { makeDeleteZoneCommand } from './slice10';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { ReversibleDeleteZoneCommand } from '../../src/application/commands/zone/reversible-delete-zone-command';
import type { DeleteZoneInput } from '../../src/application/commands/zone/DeleteZone';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import type { NamedSpatialElement } from '../../src/domain/spatial/SpatialElement';
import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { elementInput } from '../../src/presentation/editor/elements/elementInput';
import { PlanGeometryStore } from '../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import { ObsidianPlanGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { ObsidianZoneRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';

export async function groupDeletionStack(singleton = false) {
	const rig = await structureStack();
	const opening = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 65 } };
	expectOk(await rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: { ...WALL_LOOP, openings: [opening] }, ledger: rig.ledger, room: rig.room }).execute());
	const id = expectDefined(rig.room.createdZoneId, 'Room') as ZoneId, zone = expectFound(await rig.stack.zones.getById(id)).entity;
	const object: NamedSpatialElement = { id: 'element-table', name: 'Table', kind: 'object', points: [{ x: 100, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 500 }, { x: 100, y: 500 }] };
	const renovation = renovationServices(rig.stack.plans, rig.geometry, rig.stack.events), read = expectOk(await renovation.read(rig.plan.id));
	expectOk(await renovation.command(read, elementInput(read, object), rig.ledger).execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const group = { id: 'group-assembly', name: 'Assembly', memberIds: singleton ? [id] : ['wall-a', id, object.id, 'wall-b'] };
	const unrelated = { id: 'group-retained', name: 'Retained', memberIds: ['wall-d', 'wall-c'] };
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, groups: [group, unrelated] }, baseline.version));
	function deletion(extra: Partial<DeleteZoneInput> = {}) {
		return new ReversibleDeleteZoneCommand(makeDeleteZoneCommand(rig.stack.zones, rig.stack.events, rig.stack.requirements), rig.stack.zones, rig.ledger,
			{ zoneId: id, ...extra }, { boundary: rig.services.roomHistory(), events: rig.stack.events, requirements: rig.stack.requirements, locks: new ReferenceLocks(), logger: rig.stack.logger });
	}
	function reopen() {
		const store = new PlanGeometryStore(rig.stack.deps.vault, rig.stack.deps.fileManager, rig.stack.index, rig.stack.migrations, rig.stack.echo);
		return { geometry: new ObsidianPlanGeometrySidecar(store), zones: new ObsidianZoneRepository(rig.stack.deps, store) };
	}
	return { ...rig, id, zone, object, opening, group, unrelated, renovation, deletion, reopen };
}
