import { afterEach, expect, it, vi } from 'vitest';
import { groupDeletionStack } from '../../helpers/groupDeletion';
import { stackFoundation } from '../../helpers/repositoryStack';
import { expectDefined, expectOk } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { calibrateDocument } from '../../../src/application/commands/plan/ReversibleCalibratePlan';
import { groupMembers } from '../../../src/domain/spatial/SpatialGroup';
import { transformGroupGeometry } from '../../../src/domain/spatial/groupGeometry';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { PlanGeometrySchemaV6 } from '../../../src/infrastructure/persistence/dto/planGeometry';

afterEach(() => vi.restoreAllMocks());

it('rotates a saved assembly with a later hosted opening, preserves intended geometry, and reconstructs every saved fact', async () => {
	const rig = await groupDeletionStack(), read = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = expectDefined(read.document.structure, 'structure');
	const laterOpening = { ...rig.opening, id: 'opening-later', offset: 1600 };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, intended: structure, structure: { ...structure, openings: [...structure.openings, laterOpening] } }, read.version));
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), current = expectDefined(baseline.document.structure, 'current structure');
	const transformed = transformGroupGeometry(baseline.document.objects, current, rig.group.memberIds, point => ({ x: 3500 - point.y, y: point.x - 500 }));
	const document = { ...baseline.document, ...transformed }, services = groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events);
	const command = services.command({ planId: rig.plan.id, baseline, document, ledger: rig.ledger });
	const write = vi.spyOn(rig.geometry, 'write');
	expectOk(await command.execute()); expect(write).toHaveBeenCalledExactlyOnceWith(rig.plan.id, document, baseline.version);
	// New index, migration runner, echo window, store and sidecar: no old repository cache.
	rig.stack.metadataCache.catchUp();
	const foundation = stackFoundation(rig.stack, rig.stack.projectFolder); foundation.rebuildIndex();
	const fresh = new ObsidianPlanGeometrySidecar(foundation.store), saved = expectOk(await fresh.read(rig.plan.id));
	expect(saved.document).toEqual(document); expect(saved.document.intended).toEqual(structure);
	expect(saved.document.structure?.walls[0]).toMatchObject({ start: { x: 3500, y: -500 }, end: { x: 3500, y: 3500 } });
	expect(saved.document.structure?.openings).toEqual([rig.opening, laterOpening]);
	expect(saved.document.groups).toEqual([rig.group, rig.unrelated]);
	expect(groupMembers(rig.group, expectDefined(saved.document.structure, 'saved structure'))).toEqual([...rig.group.memberIds, rig.opening.id, laterOpening.id]);
	expect(expectOk(await foundation.store.read(rig.plan.id)).dto.schemaVersion).toBe(6);
	expectOk(await command.undo()); expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(baseline.document);
	expectOk(await command.execute()); expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(document);
});

it('preserves group identity and ordered membership through calibration and fresh storage', async () => {
	const rig = await groupDeletionStack(), before = expectOk(await rig.geometry.read(rig.plan.id));
	const calibrated = expectOk(calibrateDocument(before.document, { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 }));
	expect(calibrated.groups).toEqual(before.document.groups);
	expect(calibrated.structure?.walls[0].end).toEqual({ x: 8000, y: 0 });
	expectOk(await rig.geometry.write(rig.plan.id, calibrated, before.version));
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(calibrated);
});

it.each(['', ' \t\n ', 'x'.repeat(101)])('continues refusing invalid group names on schema reads: %j', async name => {
	const rig = await groupDeletionStack(), dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(PlanGeometrySchemaV6.safeParse({ ...dto, groups: [{ ...rig.group, name }] }).success).toBe(false);
});
