import { describe, expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../../helpers/structure';
import { expectDefined, expectErr, expectOk } from '../../../helpers/domain';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';

describe('ADR-SO sidecar compatibility and refusal', () => {
	it('migrates v1 idempotently in memory and never rewrites legacy notes or polygons on read', async () => {
		const { stack, plan, geometry, room } = await structureStack();
		expectOk(await room.execute());
		const bytes = [...stack.vault.entries], before = expectOk(await geometry.read(plan.id));
		expectOk(await geometry.read(plan.id)); expect([...stack.vault.entries]).toEqual(bytes);
		const path = expectDefined(stack.index.getGeometrySidecarPath(plan.id), 'sidecar path');
		const legacy = JSON.parse(expectDefined(stack.vault.entries.get(path), 'sidecar'));
		expect(legacy.schemaVersion).toBe(1);
		const migrate = PLAN_GEOMETRY_MIGRATIONS[0].migrate;
		const next = migrate(legacy); expect(migrate(next)).toEqual(next); expect(migrate(null)).toBeNull(); expect(migrate(7)).toBe(7);
		expectOk(await geometry.write(plan.id, { ...before.document, structure: WALL_LOOP }, before.version));
		expect(JSON.parse(expectDefined(stack.vault.entries.get(path), 'sidecar')).schemaVersion).toBe(2);
		expect(expectOk(await geometry.read(plan.id)).document.objects).toEqual(before.document.objects);
		for (const [name, content] of bytes.filter(([entryPath]) => entryPath.endsWith('.md'))) expect(stack.vault.entries.get(name)).toBe(content);
	});
	it.each([8, 200])('refuses a future schema %i without writes', async schemaVersion => {
		const { stack, plan, geometry } = await structureStack();
		const path = expectDefined(stack.index.getGeometrySidecarPath(plan.id), 'sidecar path');
		const dto = JSON.parse(expectDefined(stack.vault.entries.get(path), 'sidecar'));
		stack.vault.entries.set(path, JSON.stringify({ ...dto, schemaVersion }));
		const before = [...stack.vault.entries];
		expect(expectErr(await geometry.read(plan.id)).category).toBe('Migration');
		expect([...stack.vault.entries]).toEqual(before);
	});
	it('rejects malformed spatial schema and valid-shaped dangling hosts before mutation', async () => {
		const { stack, plan, geometry, baseline } = await structureStack();
		const path = expectDefined(stack.index.getGeometrySidecarPath(plan.id), 'sidecar path');
		const dto = JSON.parse(expectDefined(stack.vault.entries.get(path), 'sidecar'));
		for (const structure of [{ walls: 'invalid' }, { ...WALL_LOOP, openings: [{ id: 'opening-x', kind: 'door', hostId: 'wall-missing', offset: 0, width: 900, height: 2000, sill: 0 }] }]) {
			const text = JSON.stringify({ ...dto, schemaVersion: 2, structure }); stack.vault.entries.set(path, text);
			expect(await geometry.read(plan.id)).toMatchObject({ ok: false }); expect(stack.vault.entries.get(path)).toBe(text);
		}
		stack.vault.entries.set(path, JSON.stringify(dto));
		expect(await geometry.write(plan.id, { ...baseline.document, structure: { ...WALL_LOOP, boundaries: [{ roomId: 'missing', wallIds: WALL_LOOP.walls.map(wall => wall.id) }] } })).toMatchObject({ ok: false });
	});
});
