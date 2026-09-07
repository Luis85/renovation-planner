import { describe, expect, it } from 'vitest';
import { plannedElementGeometry } from '../../../src/presentation/editor/elements/plannedElementGeometry';
import { plannedGeometryDraft, applyPlannedGeometry } from '../../../src/presentation/editor/renovation/plannedGeometry';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { renovationStack } from '../../helpers/renovation';
import { expectOk } from '../../helpers/domain';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';

const element: NamedSpatialElement = { id: 'element-fence', name: 'Fence', kind: 'fence', points: [{ x: 0.123456, y: 0 }, { x: 4000.123456, y: 0 }, { x: 4000.123456, y: 3000 }] };
describe('planned generic elements retain independent current facts', () => {
	it('changes exact coordinates through a persisted planned subject, then restores and removes the proposal', async () => {
		const r = await renovationStack();
		const initial = expectOk(await r.read());
		expectOk(await r.renovation.command(initial, elementInput(initial, element), r.ledger).execute());
		const baseline = expectOk(await r.read());
		const subject = { id: 'detail-fence', roomId: r.roomId, targetId: element.id, kind: 'other' as const, existing: { description: 'Existing fence', condition: 'good' as const }, planned: { change: 'modify' as const, description: 'Extend fence' } };
		const input = { renovation: { ...r.value, subjects: [...r.value.subjects, subject] }, intended: undefined };
		const draft = plannedGeometryDraft(baseline, subject); expect(draft.kind).toBe('element');
		draft.elementEdits = [{}, {}, { y: '4,5' }];
		const proposal = expectOk(applyPlannedGeometry(baseline, input, subject, draft));
		expect(proposal.intended?.elements?.[0].points[0].x).toBe(element.points[0].x);
		expect(proposal.intended?.elements?.[0].points[2].y).toBe(4500);
		const command = r.renovation.command(baseline, proposal, r.ledger); expectOk(await command.execute());
		const current = expectOk(await r.read()); expect(current.geometry.document.structure?.elements?.[0].points).toEqual(element.points);
		const restored = expectOk(plannedElementGeometry(current.geometry.document.structure ?? EMPTY_STRUCTURE, proposal.intended ?? EMPTY_STRUCTURE, { id: element.id, change: 'unchanged' }));
		expect(restored.elements?.[0].points).toEqual(element.points);
		expect(expectOk(plannedElementGeometry(EMPTY_STRUCTURE, restored, { id: element.id, change: 'remove' })).elements).toEqual([]);
		expectOk(await command.undo()); expect(expectOk(await r.read()).geometry.document).toEqual(baseline.geometry.document);
	});
	it('refuses missing, malformed and zero-area proposals without inventing geometry', () => {
		expect(plannedElementGeometry(EMPTY_STRUCTURE, EMPTY_STRUCTURE, { id: element.id, change: 'modify' }).ok).toBe(false);
		expect(plannedElementGeometry(EMPTY_STRUCTURE, EMPTY_STRUCTURE, { id: element.id, change: 'modify', element, edits: [{ x: '-' }] }).ok).toBe(false);
		expect(plannedElementGeometry(EMPTY_STRUCTURE, EMPTY_STRUCTURE, { id: element.id, change: 'modify', element: { ...element, kind: 'object', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] } }).ok).toBe(false);
	});
});
