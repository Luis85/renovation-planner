import { describe, expect, it, vi } from 'vitest';
import { renovationStack } from '../../helpers/renovation';
import { expectOk, expectDefined, injectedPersistenceError } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { err } from '../../../src/core/result/Result';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { withPlanSpatialElements } from '../../../src/domain/plan/Plan';
import { planningStack } from '../../helpers/planning';

const element: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: -1000, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }] };
describe('element labels and geometry commit together through the existing transaction', () => {
	it('does not overwrite a peer label when compensation loses its conditional write', async () => {
		const r = await renovationStack(), initial = expectOk(await r.read());
		expectOk(await r.renovation.command(initial, elementInput(initial, element), r.ledger).execute());
		const baseline = expectOk(await r.read());
		vi.spyOn(r.geometry, 'write').mockImplementationOnce(async () => {
			const current = expectOk(await r.read()).plan;
			expectOk(await r.stack.plans.save(expectOk(withPlanSpatialElements(current.entity, [{ id: element.id, name: 'Peer label' }])), current.version));
			return err(injectedPersistenceError());
		});
		const result = await r.renovation.command(baseline, elementInput(baseline, { ...element, name: 'Local label' }), r.ledger).execute();
		expect(result).toMatchObject({ ok: false, error: { uncompensatedWrite: true } });
		const current = expectOk(await r.read()); expect(current.plan.entity.spatialElements?.[0].name).toBe('Peer label'); expect(current.geometry.document).toEqual(baseline.geometry.document);
	});
	it('refuses deleting an element used by material provenance before losing its label or geometry', async () => {
		const r = await planningStack(), initial = expectOk(await r.read());
		expectOk(await r.renovation.command(initial, elementInput(initial, element), r.ledger).execute());
		const material = { ...r.input, source: { ...r.input.source, targetId: element.id, rule: 'manual' as const, manual: '2' } };
		expectOk(await r.planning.material(expectOk(await r.read()), material, r.ledger).execute());
		const baseline = expectOk(await r.read()), bytes = [...r.stack.vault.entries];
		expect(await r.renovation.command(baseline, elementInput(baseline, element, true), r.ledger).execute()).toMatchObject({ ok: false });
		expect([...r.stack.vault.entries]).toEqual(bytes);
	});
	it('restores the element label when a peer material link appears during the deletion transaction', async () => {
		const r = await planningStack(), initial = expectOk(await r.read());
		expectOk(await r.renovation.command(initial, elementInput(initial, element), r.ledger).execute());
		const baseline = expectOk(await r.read()), write = r.geometry.write.bind(r.geometry);
		vi.spyOn(r.geometry, 'write').mockImplementationOnce(async (...args) => {
			const material = { ...r.input, source: { ...r.input.source, targetId: element.id, rule: 'manual' as const, manual: '2' } };
			expectOk(await r.planning.material(expectOk(await r.read()), material, r.ledger).execute());
			return write(...args);
		});
		expect(await r.renovation.command(baseline, elementInput(baseline, element, true), r.ledger).execute()).toMatchObject({ ok: false });
		const current = expectOk(await r.read()); expect(current.plan.entity.spatialElements).toEqual(baseline.plan.entity.spatialElements); expect(current.geometry.document.structure?.elements).toEqual(baseline.geometry.document.structure?.elements); expect(current.materials).toHaveLength(1);
	});
	it('creates, renames, removes and restores a stable ID without changing the renovation register', async () => {
		const r = await renovationStack();
		expectOk(await r.renovation.command(expectOk(await r.read()), { renovation: r.value, intended: undefined }, r.ledger).execute());
		const baseline = expectOk(await r.read()), create = r.renovation.command(baseline, elementInput(baseline, element), r.ledger);
		expectOk(await create.execute());
		const added = expectOk(await r.read()); expect(added.plan.entity.spatialElements).toEqual([{ id: element.id, name: element.name }]); expect(added.plan.entity.renovation).toEqual(r.value);
		expect(added.geometry.document.structure?.elements).toEqual([{ id: element.id, kind: element.kind, points: element.points }]);
		const renamed = { ...element, name: 'Walkway', points: element.points.map(point => ({ x: point.x + 200, y: point.y })) };
		const edit = r.renovation.command(added, elementInput(added, renamed), r.ledger); expectOk(await edit.execute());
		const changed = expectOk(await r.read()); expect(changed.plan.entity.spatialElements?.[0].name).toBe('Walkway');
		const remove = r.renovation.command(changed, elementInput(changed, renamed, true), r.ledger); expectOk(await remove.execute());
		expect(expectOk(await r.read()).plan.entity.spatialElements ?? []).toEqual([]);
		expectOk(await remove.undo()); expectOk(await edit.undo()); expectOk(await create.undo());
		const restored = expectOk(await r.read()); expect(restored.plan.entity.spatialElements).toBeUndefined(); expect(restored.plan.entity.renovation).toEqual(r.value); expect(restored.geometry.document).toEqual(baseline.geometry.document);
		expectOk(await create.execute()); expect(expectOk(await r.read()).geometry.document.structure?.elements?.[0].id).toBe(element.id);
	});
	it('compensates the Markdown label on geometry failure and retries without losing the original baseline', async () => {
		const r = await renovationStack(), baseline = expectOk(await r.read());
		const command = r.renovation.command(baseline, elementInput(baseline, element), r.ledger);
		vi.spyOn(r.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
		expect(await command.execute()).toMatchObject({ ok: false });
		const refused = expectOk(await r.read()); expect(refused.plan.entity.spatialElements).toBeUndefined(); expect(refused.geometry.document).toEqual(baseline.geometry.document);
		expectOk(await command.execute()); expect(expectOk(await r.read()).plan.entity.spatialElements?.[0].name).toBe(element.name);
	});
	it('refuses missing labels and malformed current geometry before writing metadata', async () => {
		const r = await renovationStack(), baseline = expectOk(await r.read()), input = elementInput(baseline, element), save = vi.spyOn(r.stack.plans, 'save');
		expect(await r.renovation.command(baseline, { ...input, spatial: { ...expectDefined(input.spatial, 'spatial input'), metadata: [] } }, r.ledger).execute()).toMatchObject({ ok: false, error: { code: 'plan.invalid-spatial-elements' } });
		expect(await r.renovation.command(baseline, elementInput(baseline, { ...element, points: [] }), r.ledger).execute()).toMatchObject({ ok: false, error: { code: 'spatial.element-invalid' } });
		expect(save).not.toHaveBeenCalled();
	});
	it('removes the element from the intended structure too, leaving its neighbours there', async () => {
		const r = await renovationStack(), baseline = expectOk(await r.read());
		const { name: _name, ...geometry } = element, other = { ...geometry, id: 'element-other' };
		const intended = { ...expectDefined(baseline.geometry.document.structure, 'structure'), elements: [geometry, other] };
		const read = { ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, intended } } };
		expect(elementInput(read, element, true).intended?.elements).toEqual([other]);
		expect(elementInput(read, element).intended).toBe(intended);
	});
});
