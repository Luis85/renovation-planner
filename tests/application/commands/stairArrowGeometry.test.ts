import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
import { DEFAULT_STAIR } from '../../../src/domain/spatial/stairGeometry';
import { scaleStructure } from '../../../src/domain/spatial/structureGeometry';
import { validSpatialElement, type SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { groupPoints, transformGroupGeometry } from '../../../src/domain/spatial/groupGeometry';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

const stair: SpatialElement = { id: 'element-stair', kind: 'stair', points: [{ x: 1000, y: 5000 }, { x: 1000, y: 2000 }], stair: DEFAULT_STAIR };
const arrow: SpatialElement = { id: 'element-arrow', kind: 'arrow', points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }] };

it('round-trips schema8 stairs/arrows alongside curves/groups and opening options, with exact history', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = { ...WALL_LOOP, elements: [stair, arrow], walls: WALL_LOOP.walls.map((wall, index) => index ? wall : { ...wall, bulge: 0.25 }),
		openings: [{ id: 'opening-stair', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'left' as const, angle: 70 } }] };
	const document = { ...baseline.document, objects: baseline.document.objects.map(object => ({ ...object, bulges: [0.25, 0, 0, 0] })), structure,
		intended: { ...structure, elements: [{ ...stair, stair: { ...DEFAULT_STAIR, width: 1200 } }, arrow] }, groups: [{ id: 'group-stair', name: 'Landing', memberIds: [stair.id, arrow.id] }] };
	expectOk(await rig.geometry.write(rig.plan.id, document, baseline.version));
	const fresh = new ObsidianPlanGeometrySidecar(rig.stack.store), saved = expectOk(await fresh.read(rig.plan.id));
	expect(saved.document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto; expect(dto.schemaVersion).toBe(8);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 7));
	expect(() => older.migrateToLatest('plan-geometry', dto, 8)).toThrow('newer than this build supports');
	const changed = { ...structure, elements: [{ ...stair, stair: { ...DEFAULT_STAIR, width: 1500, treads: 15, direction: 'down' as const } }, arrow] };
	const command = rig.services.command({ planId: rig.plan.id, baseline: saved, structure: changed, ledger: rig.ledger });
	expectOk(await command.execute()); expect(expectOk(await fresh.read(rig.plan.id)).document.structure).toEqual(changed);
	expectOk(await command.undo()); expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(document);
	expectOk(await command.execute()); expect(expectOk(await fresh.read(rig.plan.id)).document.structure?.elements).toEqual(changed.elements);
});

it('scales stair width only for calibration and keeps the full footprint in group bounds', () => {
	const structure = { ...WALL_LOOP, elements: [stair, arrow] };
	const scaled = scaleStructure(structure, 2);
	expect(scaled.elements?.[0]).toMatchObject({ points: [{ x: 2000, y: 10000 }, { x: 2000, y: 4000 }], stair: { width: 1800, treads: 12, direction: 'up' } });
	const geometry = { objects: [], structure };
	expect(groupPoints(geometry, [stair.id])).toEqual([{ x: 550, y: 5000 }, { x: 550, y: 2000 }, { x: 1450, y: 2000 }, { x: 1450, y: 5000 }]);
	const moved = transformGroupGeometry([], structure, [stair.id, arrow.id], point => ({ x: point.x + 200, y: point.y - 100 }));
	expect(moved.structure.elements?.[0]).toMatchObject({ points: [{ x: 1200, y: 4900 }, { x: 1200, y: 1900 }], stair: DEFAULT_STAIR });
	expect(moved.structure.elements?.[1].points).toHaveLength(3);
});

it('treats width, tread count and direction as geometry facts and refuses invalid options before a write', async () => {
	const rig = await structureStack(), document = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [stair, arrow] } };
	for (const options of [{ ...DEFAULT_STAIR, width: 1200 }, { ...DEFAULT_STAIR, treads: 8 }, { ...DEFAULT_STAIR, direction: 'down' as const }]) {
		expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, elements: [{ ...stair, stair: options }, arrow] } })).toBe(false);
	}
	const before = [...rig.stack.vault.entries];
	for (const value of [{ ...stair, stair: undefined }, { ...stair, stair: { ...DEFAULT_STAIR, treads: 1.5 } }, { ...stair, points: [stair.points[0]] }, { ...arrow, points: [arrow.points[0], arrow.points[0]] }, { ...arrow, stair: DEFAULT_STAIR }]) {
		expect(validSpatialElement(value)).toBe(false);
		expect((await rig.geometry.write(rig.plan.id, { ...document, structure: { ...document.structure, elements: [value] } }, rig.baseline.version)).ok).toBe(false);
	}
	expect([...rig.stack.vault.entries]).toEqual(before);
	expect(expectDefined(PLAN_GEOMETRY_MIGRATIONS.find(step => step.toVersion === 8), 'schema8 step').migrate({ schemaVersion: 7, revision: 3 })).toEqual({ schemaVersion: 8, revision: 3 });
});

it('refuses malformed persisted stair options without stripping or rewriting the sidecar', async () => {
	const rig = await structureStack();
	expectOk(await rig.geometry.write(rig.plan.id, { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [stair] } }, rig.baseline.version));
	const saved = expectOk(await rig.stack.store.read(rig.plan.id));
	const original = expectDefined(rig.stack.vault.entries.get(saved.path), 'saved sidecar');
	for (const options of [undefined, { ...DEFAULT_STAIR, width: 0 }, { ...DEFAULT_STAIR, treads: 2.5 }, { ...DEFAULT_STAIR, direction: 'sideways' }]) {
		const invalid = JSON.stringify({ ...saved.dto, structure: { ...saved.dto.structure, elements: [{ ...stair, stair: options }] } });
		rig.stack.vault.entries.set(saved.path, invalid);
		expect((await rig.geometry.read(rig.plan.id)).ok).toBe(false);
		expect(rig.stack.vault.entries.get(saved.path)).toBe(invalid);
	}
	rig.stack.vault.entries.set(saved.path, original);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements).toEqual([stair]);
});
