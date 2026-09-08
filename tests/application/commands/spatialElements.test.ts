import { describe, expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectOk } from '../../helpers/domain';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';

const elements: SpatialElement[] = [
	{ id: 'element-object', kind: 'object', points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 }, { x: 0, y: 200 }] },
	{ id: 'element-measurement', kind: 'measurement', points: [{ x: 600, y: 0 }, { x: 1600, y: 0 }] },
];
describe('spatial elements use guarded Plan sidecar history', () => {
	it('round-trips current/intended facts and writes v4 only while element data exists', async () => {
		const r = await structureStack();
		const command = r.services.command({ planId: r.plan.id, baseline: r.baseline, structure: { ...EMPTY_STRUCTURE, elements }, ledger: r.ledger });
		expectOk(await command.execute());
		const current = expectOk(await r.geometry.read(r.plan.id));
		expect(current.document.structure?.elements).toEqual(elements);
		expect(expectOk(await r.stack.store.read(r.plan.id)).dto.schemaVersion).toBe(4);
		expectOk(await command.undo());
		expect(expectOk(await r.stack.store.read(r.plan.id)).dto.schemaVersion).toBe(1);
		expectOk(await command.execute());
		const saved = expectOk(await r.geometry.read(r.plan.id));
		expectOk(await r.geometry.write(r.plan.id, { ...saved.document, intended: { ...EMPTY_STRUCTURE, elements: [{ ...elements[0], points: elements[0].points.map(point => ({ x: point.x + 100, y: point.y })) }] } }, saved.version));
		const final = expectOk(await r.geometry.read(r.plan.id)).document;
		expect(final.structure?.elements).toEqual(elements); expect(final.intended?.elements?.[0].points[0]).toEqual({ x: 100, y: 0 });
	});
	it('preserves elements across Room creation, wall edits and their inverse', async () => {
		const r = await structureStack();
		expectOk(await r.geometry.write(r.plan.id, { ...r.baseline.document, structure: { ...EMPTY_STRUCTURE, elements } }, r.baseline.version));
		const baseline = expectOk(await r.geometry.read(r.plan.id));
		const command = r.services.command({ planId: r.plan.id, baseline, structure: { ...WALL_LOOP, elements }, room: r.room, ledger: r.ledger });
		expectOk(await command.execute());
		expect(expectOk(await r.geometry.read(r.plan.id)).document.structure?.elements).toEqual(elements);
		expectOk(await command.undo());
		expect(expectOk(await r.geometry.read(r.plan.id)).document).toEqual(baseline.document);
		expectOk(await command.execute());
		expect(expectOk(await r.geometry.read(r.plan.id)).document.structure?.elements).toEqual(elements);
	});
	it('refuses stale writes and peer changes without overwriting either representation', async () => {
		const r = await structureStack();
		const command = r.services.command({ planId: r.plan.id, baseline: r.baseline, structure: { ...EMPTY_STRUCTURE, elements }, ledger: r.ledger });
		expectOk(await command.execute());
		const live = expectOk(await r.geometry.read(r.plan.id));
		expectOk(await r.geometry.write(r.plan.id, live.document, live.version));
		expect(await command.undo()).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
		expect(await r.services.command({ planId: r.plan.id, baseline: r.baseline, structure: EMPTY_STRUCTURE, ledger: r.ledger }).execute()).toMatchObject({ ok: false });
		expect(expectOk(await r.geometry.read(r.plan.id)).document.structure?.elements).toEqual(elements);
	});
	it('makes old readers refuse v4 rather than stripping element data', () => {
		const old = new MigrationRunner(); old.registerAll('plan-geometry', PLAN_GEOMETRY_MIGRATIONS.filter(step => step.toVersion <= 3));
		expect(() => old.migrateToLatest('plan-geometry', { schemaVersion: 4, structure: { ...EMPTY_STRUCTURE, elements } }, 4)).toThrow('newer than this build supports');
	});
});
