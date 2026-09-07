import { describe, expect, it } from 'vitest';
import { renovationStack } from '../../helpers/renovation';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { removeRenovationRecord } from '../../../src/presentation/editor/renovation/renovationRemoval';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import type { RenovationSubject } from '../../../src/domain/renovation/Renovation';

const element: NamedSpatialElement = { id: 'element-fence', name: 'Garden fence', kind: 'fence', points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };
const neighbour: NamedSpatialElement = { ...element, id: 'element-path', name: 'Retained path', kind: 'path' };

describe('discarded element proposals use conditional renovation history', () => {
	it.each(['modify', 'remove', 'add'] as const)('discards a persisted %s proposal and restores it through undo without replacing peer work', async change => {
		const rig = await renovationStack(), initial = expectOk(await rig.read());
		expectOk(await rig.renovation.command(initial, elementInput(initial, neighbour), rig.ledger).execute());
		if (change !== 'add') {
			const read = expectOk(await rig.read());
			expectOk(await rig.renovation.command(read, elementInput(read, element), rig.ledger).execute());
		}
		const before = expectOk(await rig.read()), current = expectDefined(before.geometry.document.structure, 'current geometry');
		const subject: RenovationSubject = { id: 'detail-fence', roomId: rig.roomId, targetId: element.id, kind: 'other',
			existing: change === 'add' ? null : { description: 'Existing fence', condition: 'good' },
			planned: { change, description: change === 'remove' ? '' : 'New fence line' } };
		const { name, ...geometry } = element;
		const intended = { ...current, elements: [...current.elements?.filter(item => item.id !== element.id) ?? [],
			...change === 'remove' ? [] : [{ ...geometry, points: [{ x: 0, y: 0 }, { x: 4500, y: 0 }] }]] };
		expectOk(await rig.renovation.command(before, {
			renovation: { ...rig.value, subjects: [...rig.value.subjects, subject] }, intended,
			...(change === 'add' ? { spatial: { structure: current, metadata: [...before.plan.entity.spatialElements ?? [], { id: element.id, name }] } } : {}),
		}, rig.ledger).execute());
		const proposed = expectOk(await rig.read());
		const discard = rig.renovation.command(proposed, removeRenovationRecord(proposed, subject.id, true), rig.ledger);
		expectOk(await discard.execute());
		const discarded = expectOk(await rig.read());
		expect(discarded.geometry.document.structure).toEqual(current);
		expect(discarded.geometry.document.intended?.elements).toEqual(current.elements);
		expect(discarded.plan.entity.spatialElements).toEqual(before.plan.entity.spatialElements);
		expect(discarded.plan.entity.renovation?.subjects.find(item => item.id === subject.id)).toEqual(change === 'add' ? undefined : { ...subject, planned: null });
		expect(discarded.plan.entity.renovation?.work).toEqual(rig.value.work);
		expectOk(await discard.undo());
		const undone = expectOk(await rig.read());
		expect(undone.geometry.document).toEqual(proposed.geometry.document);
		expect(undone.plan.entity.spatialElements).toEqual(proposed.plan.entity.spatialElements);
		expect(undone.plan.entity.renovation).toEqual(proposed.plan.entity.renovation);
		expectOk(await discard.execute());
		const latest = expectOk(await rig.read()), value = expectDefined(latest.plan.entity.renovation, 'saved register');
		expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(latest.plan.entity, {
			...value, work: value.work.map(work => ({ ...work, title: 'Peer changed the preparation' })),
		})), latest.plan.version));
		const bytes = [...rig.stack.vault.entries];
		expect(expectErr(await discard.undo()).code).toBe('undo.superseded');
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('restores a removed current element when the intended document has no element array', async () => {
		const rig = await renovationStack(), initial = expectOk(await rig.read());
		expectOk(await rig.renovation.command(initial, elementInput(initial, element), rig.ledger).execute());
		const before = expectOk(await rig.read()), current = expectDefined(before.geometry.document.structure, 'current geometry');
		const subject: RenovationSubject = { id: 'detail-fence', roomId: rig.roomId, targetId: element.id, kind: 'other',
			existing: { description: 'Old fence', condition: 'worn' }, planned: { change: 'remove', description: '' } };
		const intended = { walls: current.walls, openings: current.openings, boundaries: current.boundaries };
		expectOk(await rig.renovation.command(before, { renovation: { ...rig.value, subjects: [...rig.value.subjects, subject] }, intended }, rig.ledger).execute());
		const proposed = expectOk(await rig.read());
		expect(proposed.geometry.document.intended?.elements).toBeUndefined();
		expectOk(await rig.renovation.command(proposed, removeRenovationRecord(proposed, subject.id, true), rig.ledger).execute());
		expect(expectOk(await rig.read()).geometry.document.intended?.elements).toEqual(current.elements);
	});
});
