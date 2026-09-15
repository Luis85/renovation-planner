import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../../helpers/structure';
import { expectDefined, expectErr, expectOk } from '../../../helpers/domain';
import { createRepositoryStack } from '../../../helpers/vault';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { PlanGeometrySchemaV12, PlanGeometrySchemaV13 } from '../../../../src/infrastructure/persistence/dto/planGeometry';
import { migrateWallSides } from '../../../../src/infrastructure/persistence/migration/geometry/plan/wallSidesMigration';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { MigrationRunner } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { withWallSideExtents } from '../../../../src/domain/spatial/wallSides';

it('backfills legacy actual and intended walls exactly in memory, with no file or note rewrite', async () => {
	const rig = await structureStack(), path = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'sidecar');
	const raw = JSON.parse(expectDefined(rig.stack.vault.entries.get(path), 'bytes'));
	const legacy = { ...WALL_LOOP, walls: WALL_LOOP.walls.map(wall => ({ ...wall, thickness: 150.25 })) };
	for (const schemaVersion of [2, 3, 5, 7, 10, 11, 12]) {
		const dto = { ...raw, schemaVersion, structure: legacy, intended: legacy };
		rig.stack.vault.entries.set(path, JSON.stringify(dto)); const bytes = [...rig.stack.vault.entries];
		const read = expectOk(await rig.geometry.read(rig.plan.id));
		for (const structure of [read.document.structure, read.document.intended]) expect(structure).toEqual({ ...legacy, walls: legacy.walls.map(wall => ({ ...wall, sideExtents: { a: 75.125, b: 75.125 } })) });
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	}
});

it('persists both structures at schema 13, refuses the old reader, and reopens without geometry drift', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = { ...expectDefined(withWallSideExtents(WALL_LOOP, 'wall-a', { a: 123.125, b: 75 }), 'sides'),
		openings: [{ id: 'opening-a', kind: 'door' as const, hostId: 'wall-a', offset: 750, width: 950, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 63 } }],
		boundaries: [{ roomId: expectDefined(rig.room.createdZoneId, 'room'), wallIds: WALL_LOOP.walls.map(wall => wall.id) }] };
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure, intended: structure }, baseline.version));
	const saved = expectOk(await rig.geometry.read(rig.plan.id)), path = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'path');
	const raw = JSON.parse(expectDefined(rig.stack.vault.entries.get(path), 'bytes'));
	expect(raw.schemaVersion).toBe(13); expect(PlanGeometrySchemaV12.safeParse(raw).success).toBe(false); expect(PlanGeometrySchemaV13.safeParse(raw).success).toBe(true);
	const old = new MigrationRunner(); old.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 12));
	expect(() => old.migrateToLatest('plan-geometry', raw, raw.schemaVersion)).toThrow('newer than this build supports');
	expect(saved.document.structure?.walls[0]).toEqual(structure.walls[0]); expect(saved.document.structure?.openings).toEqual(structure.openings); expect(saved.document.structure?.boundaries).toEqual(structure.boundaries);
	expect(saved.document.objects).toEqual(baseline.document.objects);
	const fresh = createRepositoryStack(); for (const [file, bytes] of rig.stack.vault.entries) fresh.vault.entries.set(file, bytes); fresh.rebuildIndex();
	expect(expectOk(await new ObsidianPlanGeometrySidecar(fresh.store).read(rig.plan.id)).document).toEqual(saved.document);
	const bytes = [...rig.stack.vault.entries];
	for (const sideExtents of [{ a: 0, b: 0 }, { a: -1, b: 151 }, { a: 100, b: 100 }, null]) {
		const invalid = { ...structure, walls: [{ ...structure.walls[0], thickness: 150, sideExtents: sideExtents as never }, ...structure.walls.slice(1)] };
		expect(expectErr(await rig.geometry.write(rig.plan.id, { ...saved.document, structure: invalid }, saved.version)).code).toBe('spatial.wall-side-extents');
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	}
	const missing = { ...raw, structure: { ...raw.structure, walls: [{ ...raw.structure.walls[0], sideExtents: undefined }] } };
	rig.stack.vault.entries.set(path, JSON.stringify(missing)); expect(await rig.geometry.read(rig.plan.id)).toMatchObject({ ok: false });
});

it('handles malformed migration inputs without inventing walls and is idempotent on v13', () => {
	for (const input of [null, 1, 'text']) expect(migrateWallSides(input)).toBe(input);
	for (const structure of [null, 7, {}, { walls: 1 }, { walls: [null, {}, { thickness: '150' }] }]) expect(migrateWallSides({ schemaVersion: 12, structure })).toEqual({ schemaVersion: 13, structure });
	const current = { schemaVersion: 13, structure: { walls: [{ thickness: 200, sideExtents: { a: 150, b: 50 } }] } };
	expect(migrateWallSides(current)).toBe(current); expect(migrateWallSides({})).toEqual({ schemaVersion: 13 });
});
