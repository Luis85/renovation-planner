import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { describe, expect, it } from 'vitest';
import { renovationStack } from '../../helpers/renovation';
import { expectOk } from '../../helpers/domain';
import { applyRenovationDraft, renovationDraft } from '../../../src/presentation/editor/renovation/renovationDraft';
import { applyPlannedGeometry, geometryFields, plannedGeometryDraft } from '../../../src/presentation/editor/renovation/plannedGeometry';
import { removeRenovationRecord } from '../../../src/presentation/editor/renovation/renovationRemoval';
import { validateRenovationInput } from '../../../src/application/commands/renovation/RenovationCommand';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { sameRenovation } from '../../../src/domain/renovation/sameRenovation';
import { renovationMessage } from '../../../src/presentation/editor/renovation/renovationMessage';

describe('renovation draft semantics and spatial proposals', () => {
	it.each(['existing', 'planned', 'work', 'decision'] as const)('creates and updates %s without aliasing its Existing source', async kind => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const draft = renovationDraft(kind, rig.roomId, 'absent'); expect(draft.subject.existing !== null).toBe(kind === 'existing');
		const updated = applyRenovationDraft(baseline, draft); expect(updated.renovation.subjects.length + updated.renovation.work.length + updated.renovation.decisions.length).toBe(1);
		const plan = expectOk(withPlanRenovation(baseline.plan.entity, rig.value)), existing = { ...baseline, plan: { ...baseline.plan, entity: plan } };
		const id = kind === 'work' ? rig.value.work[0].id : kind === 'decision' ? rig.value.decisions[0].id : rig.value.subjects[0].id;
		const edit = renovationDraft(kind, rig.roomId, id, rig.value); expect(applyRenovationDraft(existing, edit).renovation).toEqual(rig.value);
		expect(sameRenovation(rig.value, { ...rig.value, decisions: rig.value.decisions.map(d => ({ resolved: d.resolved, resolution: d.resolution, question: d.question, subjectId: d.subjectId, roomId: d.roomId, id: d.id })) })).toBe(true);
	});
	it.each(['modify', 'unchanged', 'remove'] as const)('preserves the current wall while applying and discarding %s', async change => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const subject = { ...rig.value.subjects[0], targetId: 'wall-a', kind: 'wall' as const, planned: { change, description: change === 'remove' ? '' : change === 'unchanged' ? 'Worn timber' : 'Move endpoint' } };
		const input = { renovation: { subjects: [subject], work: [], decisions: [] }, intended: baseline.geometry.document.structure };
		const draft = plannedGeometryDraft(baseline, subject); draft.text.endX = '5';
		const result = expectOk(applyPlannedGeometry(baseline, input, subject, draft));
		expect(validateRenovationInput(result.renovation, { ...baseline.geometry.document, intended: result.intended }).ok).toBe(true);
		expect(baseline.geometry.document.structure?.walls[0].end.x).toBe(4000);
		const read = { plan: { ...baseline.plan, entity: expectOk(withPlanRenovation(baseline.plan.entity, result.renovation)) }, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, intended: result.intended } } };
		expect(plannedGeometryDraft(read, subject).kind).toBe('wall');
		const discarded = removeRenovationRecord(read, subject.id, true); expect(discarded.renovation.subjects[0]).toMatchObject({ existing: subject.existing, planned: null });
		expect(discarded.intended?.walls.find(w => w.id === 'wall-a')).toEqual(baseline.geometry.document.structure?.walls[0]);
		expect(discarded.intended?.boundaries).toEqual(baseline.geometry.document.structure?.boundaries);
	});
	it.each(['modify', 'unchanged', 'remove', 'add'] as const)('maintains opening hosts and independent geometry for %s', async change => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const opening = { id: 'opening-door', hostId: 'wall-a', kind: 'door' as const, offset: 100, width: 900, height: 2000, sill: 0 };
		const structure = { ...baseline.geometry.document.structure ?? EMPTY_STRUCTURE, openings: [opening] };
		const read = { ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, structure } } };
		const subject = { ...rig.value.subjects[0], targetId: change === 'add' ? rig.roomId : opening.id, existing: change === 'add' ? null : rig.value.subjects[0].existing, planned: { change, description: change === 'remove' ? '' : change === 'unchanged' ? 'Worn timber' : 'Door change' } };
		const input = { renovation: { subjects: [subject], work: [], decisions: [] }, intended: undefined };
		const draft = plannedGeometryDraft(read, subject); draft.kind = 'opening'; draft.hostId = 'wall-b';
		const result = expectOk(applyPlannedGeometry(read, input, subject, draft)); expect(result.intended?.openings).toHaveLength(change === 'remove' ? 0 : change === 'add' ? 2 : 1);
		expect(read.geometry.document.structure.openings).toEqual([opening]);
		const saved = { ...read, plan: { ...read.plan, entity: expectOk(withPlanRenovation(read.plan.entity, result.renovation)) }, geometry: { ...read.geometry, document: { ...read.geometry.document, intended: result.intended } } };
		const discarded = removeRenovationRecord(saved, subject.id, true); expect(discarded.intended?.openings).toEqual([opening]);
	});
	it("allocates an addition's id without touching the draft, so the geometry kind stays editable until the change is committed", async () => {
		// Preview and Apply both run `applyPlannedGeometry`; assigning the id INTO the draft on
		// the preview hid `PlannedGeometryFields`' kind selector before anything was persisted.
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const subject = { ...rig.value.subjects[0], targetId: rig.roomId, existing: null, planned: { change: 'add' as const, description: 'New wall' } };
		const draft = plannedGeometryDraft(baseline, subject); draft.kind = 'wall';
		const preview = expectOk(applyPlannedGeometry(baseline, { renovation: { subjects: [subject], work: [], decisions: [] }, intended: undefined }, subject, draft));
		expect(draft.id).toBe('');
		expect(preview.intended?.walls.at(-1)?.id).toBe(preview.renovation.subjects[0].targetId);
	});
	it('rejects invalid measurements and treats nonspatial and Existing-only drafts as metadata', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read()), subject = rig.value.subjects[0], input = { renovation: rig.value, intended: undefined };
		const draft = plannedGeometryDraft(baseline, subject); expect(geometryFields(draft)).toEqual([]); expect(expectOk(applyPlannedGeometry(baseline, input, subject, draft))).toEqual(input);
		draft.kind = 'wall'; draft.text.x = 'invalid'; expect(applyPlannedGeometry(baseline, input, subject, draft)).toMatchObject({ ok: false });
		expect(expectOk(applyPlannedGeometry(baseline, input, { ...subject, planned: null }, draft))).toEqual(input);
		expect(removeRenovationRecord(baseline, 'absent', false).renovation.subjects).toEqual([]);
	});
	it.each(['spatial.numeric', 'renovation.cycle', 'undo.superseded', 'plan.revision-conflict', 'renovation.state', 'renovation.write-failed'])('explains %s without leaking internal error text', code => {
		expect(renovationMessage({ category: code.endsWith('write-failed') ? 'Persistence' : 'Validation', code, message: 'private internal detail' })).not.toContain('private internal');
	});
});

it('adds and discards intended geometry on a legacy plan with no current structure', async () => {
 const rig = await renovationStack(), baseline = expectOk(await rig.read());
 const legacy = { ...baseline, geometry: { ...baseline.geometry, document: { ...baseline.geometry.document, structure: undefined } } };
 const subject = { ...rig.value.subjects[0], existing: null, planned: { change: 'add' as const, description: 'First partition' } };
 const draft = plannedGeometryDraft(legacy, subject); expect(draft.hostId).toBe(''); expect(draft.kind).toBe('none');
 draft.kind = 'wall';
 const proposal = expectOk(applyPlannedGeometry(legacy, { renovation: { subjects: [subject], work: [], decisions: [] }, intended: undefined }, subject, draft));
 expect(proposal.intended?.walls).toHaveLength(1); expect(legacy.geometry.document.structure).toBeUndefined();
 const saved = { ...legacy, plan: { ...legacy.plan, entity: expectOk(withPlanRenovation(legacy.plan.entity, proposal.renovation)) }, geometry: { ...legacy.geometry, document: { ...legacy.geometry.document, intended: proposal.intended } } };
 const discarded = removeRenovationRecord(saved, subject.id, true);
 expect(discarded.intended).toEqual(EMPTY_STRUCTURE); expect(discarded.renovation.subjects).toEqual([]);
});


it('keeps an unsaved geometry choice editable after preview, including a refused host', async () => {
 const rig = await renovationStack(), baseline = expectOk(await rig.read());
 const subject = { ...rig.value.subjects[0], existing: null, planned: { change: 'add' as const, description: 'Partition' } };
 const input = { renovation: { subjects: [subject], work: [], decisions: [] }, intended: undefined };
 const draft = plannedGeometryDraft(baseline, subject); draft.kind = 'opening'; draft.hostId = 'missing';
 const before = structuredClone(draft), preview = expectOk(applyPlannedGeometry(baseline, input, subject, draft));
 expect(validateRenovationInput(preview.renovation, { ...baseline.geometry.document, intended: preview.intended }).ok).toBe(false);
 expect(draft).toEqual(before); expect(draft.id).toBe(''); draft.kind = 'wall'; draft.text.x = '1'; draft.text.endX = '3'; draft.text.y = '1'; draft.text.endY = '1';
 const wall = expectOk(applyPlannedGeometry(baseline, input, subject, draft)); expect(validateRenovationInput(wall.renovation, { ...baseline.geometry.document, intended: wall.intended }).ok).toBe(true); expect(draft.id).toBe('');
});
