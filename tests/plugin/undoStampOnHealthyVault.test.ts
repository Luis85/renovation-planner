import { afterEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import type { AppError } from '../../src/core/errors/AppError';
import { err, type Result } from '../../src/core/result/Result';
import type { Command } from '../../src/application/commands/Command';
import { leftWritesBehind, type AffectedEntity, type DispatchResult, type UncompensatedWrite } from '../../src/application/commands/DispatchOutcome';
import { guardCommand } from '../../src/application/errors/guardAgainstThrowing';
import { installWriteIncidentRegistry } from '../../src/application/incidents/WriteIncidentRegistry';
import { SessionWriteLedger } from '../../src/application/editor/WriteLedger';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { CreateZoneCommand, type CreateZoneInput } from '../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand, type DeleteZoneInput } from '../../src/application/commands/zone/DeleteZone';
import { ReversibleCreateZoneCommand } from '../../src/application/commands/zone/reversible-create-zone-command';
import { ReversibleDeleteZoneCommand } from '../../src/application/commands/zone/reversible-delete-zone-command';
import { RecalculateRequirementCommand } from '../../src/application/commands/requirement/RecalculateRequirement';
import { AssignAssetCommand } from '../../src/application/commands/requirement/AssignAsset';
import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { groupGeometryServices } from '../../src/application/commands/spatial/GroupGeometryCommand';
import { structureServices } from '../../src/application/commands/spatial/StructureCommand';
import { RoomBoundaryHistory } from '../../src/application/commands/spatial/RoomBoundaryHistory';
import { DeleteSelectionCommand } from '../../src/application/commands/spatial/DeleteSelectionCommand';
import { PasteCommand } from '../../src/application/commands/spatial/PasteCommand';
import { ObsidianPlanGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { projectFolderOf, sidecarPathFor } from '../../src/infrastructure/obsidian/repositories/paths';
import { InMemoryAssetPriceOverrideRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { captureClipboard } from '../../src/domain/spatial/clipboard';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { RequirementId } from '../../src/domain/requirement/RequirementId';
import { createEntityId } from '../../src/core/identity/generateId';
import { CommandHistory } from '../../src/presentation/editor/tools/command-history';
import { VAULT_EXCEPTION_MAPPER } from '../../src/plugin/guardedServices';
import { guardedRenovation } from '../../src/plugin/guardedRenovation';
import { guardedGroups } from '../../src/plugin/guardedGroups';
import { guardedStructure } from '../../src/plugin/guardedStructure';
import { createRepositoryStack } from '../helpers/vault';
import { makeAsset, makePlan, makeProject } from '../helpers/entities';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../helpers/domain';
import { recorder } from '../helpers/logger';
import { zoneSequenceCollaborators } from '../helpers/slice10';
import { installQuietWriteIncidents } from '../helpers/writeIncidents';
import { WALL_LOOP } from '../helpers/structure';

/**
 * Q1's deciding measurement, kept as the pin a fix has to keep
 * (`docs/releases/first-beta-readiness/11-q1-stamp-census.md`).
 *
 * Five of the six `markUncompensated` raise sites the census found reaching NO recorder on some
 * path sit behind a Plan editor gesture that `CommandHistory` dispatches over raw ports — the
 * undo of a Room delete, the redo of a drawn Room, and a multi-element delete or paste in any
 * direction (the sixth is the Asset designer's, pinned beside this file). Whatever the owner
 * decides for them, the ordinary door on a healthy vault must go on raising no stamp and recording
 * nothing — the first describe — and the second shows the same rig CAN see each site's stamp when
 * both writes its condition names are refused, so the first is not a probe that sees nothing.
 * Composed as production composes it (`planEditorDeps.ts`): guarded inner doors (`guardCommand`,
 * `guardedStructure`, `guardedRenovation`, `guardedGroups`), the raw zone port, one history. Deliberately NOT asserted here: that a stamp raised on these paths is left
 * unrecorded — true today, and exactly what the owner's choice may change.
 */

/** Every dispatch of the five wrote, none was refused, and nothing opened an incident. */
const HEALTHY = { refusals: [], outcomes: ['wrote', 'wrote', 'wrote', 'wrote', 'wrote'], recorded: false };

afterEach(() => {
	vi.restoreAllMocks();
	installWriteIncidentRegistry(null);
});

const guard = <I, T, E extends AppError>(command: Command<I, Result<T, E>>) => guardCommand(command, 'probe.failed', recorder, VAULT_EXCEPTION_MAPPER);

/** The Plan editor's composition over one real stack: guarded inner doors, raw zone port, one history. */
async function planRig() {
	const registry = installQuietWriteIncidents();
	const stack = createRepositoryStack();
	const project = makeProject(), plan = makePlan({ projectId: project.id });
	expectOk(await stack.projects.save(project, 'absent'));
	expectOk(await stack.plans.save(plan, 'absent'));
	const geometry = new ObsidianPlanGeometrySidecar(stack.store);
	const { events } = stack;
	const locks = new ReferenceLocks(), ledger = new SessionWriteLedger(), overrides = new InMemoryAssetPriceOverrideRepository();
	const recalculate = new RecalculateRequirementCommand({ requirements: stack.requirements, zones: stack.zones, assets: stack.assets, events, projects: stack.projects, overrides });
	const createZone = guard(new CreateZoneCommand(stack.zones, stack.plans, events));
	const deleteZone = guard(new DeleteZoneCommand({ ...zoneSequenceCollaborators(), zones: stack.zones, requirements: stack.requirements, recalculate, events, locks, logger: recorder }));
	const assign = guard(new AssignAssetCommand({ zones: stack.zones, assets: stack.assets, requirements: stack.requirements, events, locks, projects: stack.projects, overrides }));
	const structure = guardedStructure(structureServices(geometry, events), recorder);
	const renovation = guardedRenovation(renovationServices(stack.plans, geometry, events), recorder);
	const groups = guardedGroups(groupGeometryServices(geometry, stack.zones, events), recorder);
	const createRoom = (input: CreateZoneInput) => new ReversibleCreateZoneCommand(createZone, deleteZone, ledger, input, { zones: stack.zones, events, requirements: stack.requirements, logger: recorder });
	const deleteRoom = (input: DeleteZoneInput) => new ReversibleDeleteZoneCommand(deleteZone, stack.zones, ledger, input,
		{ boundary: structure.roomHistory(), requirements: stack.requirements, locks, logger: recorder, events });
	const history = new CommandHistory();
	const seen: { step: string; code: string; stamped: boolean; named?: readonly AffectedEntity[] }[] = [];
	const outcomes: string[] = [];
	/** One dispatch through the history, recording any refusal, whether it carried the stamp, and what the stamp named. */
	async function dispatch(step: string, result: Promise<DispatchResult>): Promise<void> {
		const settled = await result;
		outcomes.push(settled.ok ? settled.value : 'refused');
		if (settled.ok) return;
		const stamped = leftWritesBehind(settled.error);
		seen.push({ step, code: settled.error.code, stamped, ...(stamped ? { named: (settled.error as AppError & UncompensatedWrite).uncompensatedWrite } : {}) });
	}
	/** Walls, a Room bounded by them, a group of the Room and one wall, and one requirement on the Room. */
	async function furnishedFloor(): Promise<ZoneId> {
		const points = WALL_LOOP.walls.map(wall => wall.start);
		const room = createRoom({ planId: plan.id, name: 'Kitchen', zoneType: 'Room', geometry: { points } });
		const roomStep = { execute: () => room.execute(), undo: () => room.undo(), get createdZoneId() { return room.createdZoneId; }, points };
		const baseline = expectOk(await geometry.read(plan.id));
		expectOk(await structure.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room: roomStep }).execute());
		const zoneId = expectDefined(room.createdZoneId, 'room') as ZoneId;
		const read = expectOk(await geometry.read(plan.id));
		const document = { ...read.document, groups: [{ id: 'group-kitchen', name: 'Kitchen set', memberIds: ['wall-a', zoneId] }] };
		expectOk(await groups.command({ planId: plan.id, baseline: read, document, ledger }).execute());
		const asset = expectOk(await stack.assets.save(makeAsset({ name: 'Tile', wasteFactorDefault: new Decimal('0.10') }), 'absent'));
		expectOk(await assign.execute({ zoneId, assetId: asset.entity.id }));
		return zoneId;
	}
	async function referents(zoneId: ZoneId): Promise<RequirementId[]> {
		return expectOk(await stack.requirements.listByZone(zoneId)).map(item => item.entity.id);
	}
	/** The multi-element door passes no resolution, so its Room must carry no requirement. */
	async function dropReferents(zoneId: ZoneId): Promise<void> {
		for (const id of await referents(zoneId)) expectOk(await stack.requirements.delete(id, expectFound(await stack.requirements.getById(id)).version));
	}
	return { registry, stack, plan, geometry, ledger, renovation, groups, structure, createRoom, deleteRoom, history, seen, outcomes, dispatch, furnishedFloor, referents, dropReferents };
}
type PlanRig = Awaited<ReturnType<typeof planRig>>;

/** Run, undo, redo, undo and redo — the ordinary door a user presses for any gesture. */
async function cycle(r: PlanRig, name: string, command: { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> }) {
	await r.dispatch(`${name} run`, r.history.run(command));
	await r.dispatch(`${name} undo`, r.history.undo());
	await r.dispatch(`${name} redo`, r.history.redo());
	await r.dispatch(`${name} undo again`, r.history.undo());
	await r.dispatch(`${name} redo again`, r.history.redo());
}

describe('a healthy vault, through the ordinary door: run, undo, redo, undo, redo', () => {
	it('deleting a bounded, grouped, referenced Room and undoing it raises no stamp and records nothing', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor(), resolvedReferents = await r.referents(zoneId);
		expect(resolvedReferents).toHaveLength(1);
		await cycle(r, 'delete room', r.deleteRoom({ zoneId, resolution: 'remove-references', resolvedReferents }));
		expect({ refusals: r.seen, outcomes: r.outcomes, recorded: r.registry.anyOpen() }).toEqual(HEALTHY);
	});

	it('a multi-element delete (Room plus its walls) and its undo raise no stamp and record nothing', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor();
		// Unreferenced, as the multi-element door passes no resolution.
		await r.dropReferents(zoneId);
		const baseline = expectOk(await r.renovation.read(r.plan.id));
		const command = new DeleteSelectionCommand({ deleteRoom: id => r.deleteRoom({ zoneId: id }), renovation: r.renovation, ledger: r.ledger },
			{ baseline, roomIds: [zoneId], structureIds: ['wall-a', 'wall-b'] });
		await cycle(r, 'delete selection', command);
		expect({ refusals: r.seen, outcomes: r.outcomes, recorded: r.registry.anyOpen() }).toEqual(HEALTHY);
	});

	it('a multi-element delete of TWO grouped Rooms and its undo raise no stamp and record nothing', async () => {
		const r = await planRig(), first = await r.furnishedFloor();
		await r.dropReferents(first);
		const second = r.createRoom({ planId: r.plan.id, name: 'Pantry', zoneType: 'Room', geometry: { points: [{ x: 20000, y: 0 }, { x: 21000, y: 0 }, { x: 21000, y: 1000 }] } });
		expectOk(await second.execute());
		const secondId = expectDefined(second.createdZoneId, 'second room');
		const read = expectOk(await r.geometry.read(r.plan.id));
		const document = { ...read.document, groups: [{ id: 'group-both', name: 'Both', memberIds: [first, secondId] }] };
		expectOk(await r.groups.command({ planId: r.plan.id, baseline: read, document, ledger: r.ledger }).execute());
		const baseline = expectOk(await r.renovation.read(r.plan.id));
		const command = new DeleteSelectionCommand({ deleteRoom: id => r.deleteRoom({ zoneId: id }), renovation: r.renovation, ledger: r.ledger },
			{ baseline, roomIds: [first, secondId], structureIds: [] });
		await cycle(r, 'delete two rooms', command);
		expect({ refusals: r.seen, outcomes: r.outcomes, recorded: r.registry.anyOpen() }).toEqual(HEALTHY);
	});

	it('a paste of Rooms, walls and a group and its undo raise no stamp and record nothing', async () => {
		const r = await planRig();
		const floor = {
			rooms: [
				{ key: 'zone-a', name: 'Kitchen', zoneType: 'Room', points: WALL_LOOP.walls.map(item => item.start) },
				{ key: 'zone-b', name: 'Pantry', zoneType: 'Room', points: [{ x: 20000, y: 0 }, { x: 21000, y: 0 }, { x: 21000, y: 1000 }] },
			],
			structure: { ...WALL_LOOP, boundaries: [{ roomId: 'zone-a', wallIds: ['wall-a', 'wall-b', 'wall-c', 'wall-d'] }] },
			names: [],
			groups: [{ id: 'group-two', name: 'Two', memberIds: ['zone-a', 'zone-b'] }],
		};
		const clipboard = expectDefined(captureClipboard(floor, ['zone-a', 'zone-b']), 'clipboard');
		const command = new PasteCommand({ createRoom: input => r.createRoom(input), renovation: r.renovation, groups: r.groups, ledger: r.ledger, mintId: prefix => createEntityId(prefix) },
			{ planId: r.plan.id as PlanId, clipboard, target: { x: 15000, y: 0 } });
		await cycle(r, 'paste', command);
		expect({ refusals: r.seen, outcomes: r.outcomes, recorded: r.registry.anyOpen() }).toEqual(HEALTHY);
	});

	it('drawing a Room and undoing and redoing it raises no stamp and records nothing', async () => {
		const r = await planRig();
		await cycle(r, 'draw room', r.createRoom({ planId: r.plan.id, name: 'Hall', zoneType: 'Room', geometry: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] } }));
		expect({ refusals: r.seen, outcomes: r.outcomes, recorded: r.registry.anyOpen() }).toEqual(HEALTHY);
	});
});

describe('the positive controls: the named faults DO raise the stamp', () => {
	it('POSITIVE RECORDER CONTROL: the same repository stamp through the GUARDED forward delete IS recorded', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor();
		await r.dropReferents(zoneId);
		const folder = expectDefined(projectFolderOf(r.stack.index, r.plan.projectId), 'folder');
		r.stack.vault.failures.add(`modify:${sidecarPathFor(folder, r.plan.id)}`);
		r.stack.vault.failures.add(`create:${expectDefined(r.stack.index.getPath(zoneId), 'note')}`);
		await r.dispatch('guarded delete', r.history.run(r.deleteRoom({ zoneId })));
		expect(r.seen).toEqual([{ step: 'guarded delete', code: 'zone.sidecar-remove-uncompensated', stamped: true, named: [{ entityKind: 'zone', entityId: zoneId }, { entityKind: 'plan', entityId: r.plan.id }] }]);
		expect(r.registry.anyOpen()).toBe(true);
	});

	it('undoDeleteResolution.rollBack: requirement restore refused AND the zone re-delete refused', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor(), resolvedReferents = await r.referents(zoneId);
		await r.dispatch('run', r.history.run(r.deleteRoom({ zoneId, resolution: 'remove-references', resolvedReferents })));
		vi.spyOn(r.stack.requirements, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		vi.spyOn(r.stack.zones, 'delete').mockResolvedValueOnce(err(injectedPersistenceError()));
		await r.dispatch('undo', r.history.undo());
		expect(r.seen).toEqual([{ step: 'undo', code: 'test.injected-failure', stamped: true, named: [] }]);
	});

	it('undoDeleteResolution.rollBack control: the requirement restore refused ALONE compensates and raises no stamp', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor(), resolvedReferents = await r.referents(zoneId);
		await r.dispatch('run', r.history.run(r.deleteRoom({ zoneId, resolution: 'remove-references', resolvedReferents })));
		vi.spyOn(r.stack.requirements, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		await r.dispatch('undo', r.history.undo());
		expect(r.seen).toEqual([{ step: 'undo', code: 'test.injected-failure', stamped: false }]);
	});

	it('ReversibleDeleteZoneCommand restoreEntity: boundary restore refused AND the zone re-delete refused', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor(), resolvedReferents = await r.referents(zoneId);
		await r.dispatch('run', r.history.run(r.deleteRoom({ zoneId, resolution: 'remove-references', resolvedReferents })));
		vi.spyOn(RoomBoundaryHistory.prototype, 'restore').mockResolvedValueOnce(err(injectedPersistenceError()));
		vi.spyOn(r.stack.zones, 'delete').mockResolvedValueOnce(err(injectedPersistenceError()));
		await r.dispatch('undo', r.history.undo());
		expect(r.seen).toEqual([{ step: 'undo', code: 'test.injected-failure', stamped: true, named: [{ entityKind: 'zone', entityId: zoneId }, { entityKind: 'plan', entityId: r.plan.id }] }]);
	});

	it('restoreZone (ObsidianZoneRepository insert arm) inside a delete undo: sidecar write refused AND the new note removal refused', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor(), resolvedReferents = await r.referents(zoneId);
		const notePath = expectDefined(r.stack.index.getPath(zoneId), 'note');
		await r.dispatch('run', r.history.run(r.deleteRoom({ zoneId, resolution: 'remove-references', resolvedReferents })));
		const folder = expectDefined(projectFolderOf(r.stack.index, r.plan.projectId), 'folder');
		r.stack.vault.failures.add(`modify:${sidecarPathFor(folder, r.plan.id)}`);
		r.stack.vault.failures.add(`delete:${notePath}`);
		await r.dispatch('undo', r.history.undo());
		expect(r.seen).toEqual([{ step: 'undo', code: 'zone.sidecar-insert-uncompensated', stamped: true, named: [{ entityKind: 'zone', entityId: zoneId }, { entityKind: 'plan', entityId: r.plan.id }] }]);
	});

	it('restoreZone inside a REDO of a drawn Room: sidecar write refused AND the new note removal refused', async () => {
		const r = await planRig();
		await r.dispatch('run', r.history.run(r.createRoom({ planId: r.plan.id, name: 'Hall', zoneType: 'Room', geometry: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] } })));
		const zoneId = expectDefined(expectOk(await r.stack.zones.listByPlan(r.plan.id)).loaded[0], 'zone').entity.id;
		const notePath = expectDefined(r.stack.index.getPath(zoneId), 'note');
		await r.dispatch('undo', r.history.undo());
		const folder = expectDefined(projectFolderOf(r.stack.index, r.plan.projectId), 'folder');
		r.stack.vault.failures.add(`modify:${sidecarPathFor(folder, r.plan.id)}`);
		r.stack.vault.failures.add(`delete:${notePath}`);
		await r.dispatch('redo', r.history.redo());
		expect(r.seen).toEqual([{ step: 'redo', code: 'zone.sidecar-insert-uncompensated', stamped: true, named: [{ entityKind: 'zone', entityId: zoneId }, { entityKind: 'plan', entityId: r.plan.id }] }]);
	});

	it('composedSteps.restoreSteps on UNDO of a multi-element delete: the Room restore refused AND the walls re-delete refused', async () => {
		const r = await planRig(), zoneId = await r.furnishedFloor();
		await r.dropReferents(zoneId);
		const baseline = expectOk(await r.renovation.read(r.plan.id));
		const command = new DeleteSelectionCommand({ deleteRoom: id => r.deleteRoom({ zoneId: id }), renovation: r.renovation, ledger: r.ledger },
			{ baseline, roomIds: [zoneId], structureIds: ['wall-a', 'wall-b'] });
		await r.dispatch('run', r.history.run(command));
		// Undo walks [walls, room]: the walls come back, the Room restore refuses, so the walls are deleted again — and that refuses too.
		vi.spyOn(r.stack.zones, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		const save = r.stack.plans.save.bind(r.stack.plans);
		vi.spyOn(r.stack.plans, 'save').mockImplementationOnce(save).mockResolvedValueOnce(err(injectedPersistenceError()));
		await r.dispatch('undo', r.history.undo());
		expect(r.seen).toEqual([{ step: 'undo', code: 'test.injected-failure', stamped: true, named: [] }]);
	});
});
