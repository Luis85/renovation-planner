import { expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { postOutline } from '../../../src/domain/spatial/structuralElement';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

const post: SpatialElement = { id: 'element-post', kind: 'post', loadBearing: true, points: postOutline({ x: 1000, y: 500 }, 140, 140) };
const beam: SpatialElement = { id: 'element-beam', kind: 'beam', loadBearing: false, width: 160, points: [{ x: 0, y: 1500 }, { x: 4000, y: 1500 }] };

it('round-trips posts and beams as schema 11, which a build that stops at 10 refuses', async () => {
	const rig = await structureStack();
	const document = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [post, beam] }, intended: { ...WALL_LOOP, elements: [{ ...beam, loadBearing: true }] } };
	expectOk(await rig.geometry.write(rig.plan.id, document, rig.baseline.version));
	expect(expectOk(await new ObsidianPlanGeometrySidecar(rig.stack.store).read(rig.plan.id)).document).toEqual(document);
	const dto = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(dto.schemaVersion).toBe(11);
	const older = new MigrationRunner(); older.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 10));
	expect(() => older.migrateToLatest('plan-geometry', dto, 11)).toThrow('newer than this build supports');
	expect(expectDefined(PLAN_GEOMETRY_MIGRATIONS.find(step => step.toVersion === 11), 'schema 11 step').migrate({ schemaVersion: 10, revision: 3 })).toEqual({ schemaVersion: 11, revision: 3 });
});

it('treats width and load-bearing as geometry facts and refuses a malformed element before and after a write', async () => {
	const rig = await structureStack(), document = { ...rig.baseline.document, structure: { ...WALL_LOOP, elements: [post, beam] } };
	for (const changed of [{ ...beam, width: 200 }, { ...beam, loadBearing: true }]) {
		expect(sameGeometryDocument(document, { ...document, structure: { ...document.structure, elements: [post, changed] } })).toBe(false);
	}
	const before = [...rig.stack.vault.entries];
	for (const value of [{ ...beam, width: undefined }, { ...post, loadBearing: undefined }, { ...post, width: 160 }]) {
		expect((await rig.geometry.write(rig.plan.id, { ...document, structure: { ...document.structure, elements: [value] } }, rig.baseline.version)).ok).toBe(false);
	}
	expect([...rig.stack.vault.entries]).toEqual(before);
	expectOk(await rig.geometry.write(rig.plan.id, document, rig.baseline.version));
	const saved = expectOk(await rig.stack.store.read(rig.plan.id));
	for (const element of [{ ...beam, width: undefined }, { ...post, loadBearing: 'yes' }, { ...beam, kind: 'column' }]) {
		const invalid = JSON.stringify({ ...saved.dto, structure: { ...saved.dto.structure, elements: [element] } });
		rig.stack.vault.entries.set(saved.path, invalid);
		expect((await rig.geometry.read(rig.plan.id)).ok).toBe(false);
		expect(rig.stack.vault.entries.get(saved.path)).toBe(invalid);
	}
});
