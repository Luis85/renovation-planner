// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { of } from '../../../src/core/money/Money';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { tr } from '../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
type Rig = Awaited<ReturnType<typeof renovationEditor>>;

/** Work, a cost, a planned subject, a plan-origin material and a photo, all on `wall-a` and none bound to a room (ADR-0030, ADR-0031). */
const border: Renovation = {
	subjects: [{ id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good' }, planned: { change: 'modify', description: 'Rendered' } }],
	decisions: [],
	work: [{ id: 'work-border', targetId: 'wall-a', title: 'Repoint the border wall', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['detail-wall'], dependencies: [] }],
	depth: { ...EMPTY_DEPTH,
		costs: [{ id: 'cost-border', targetId: 'wall-a', workId: 'work-border', title: 'Mortar', category: 'other', requirementId: '', planned: of('40', 'EUR'), facts: [], cancelled: false }],
		evidence: [{ id: 'photo-wall', targetId: 'wall-a', workId: '', recordId: '', path: 'Evidence/wall.jpg', subpath: '', description: 'Cracked render', type: 'photo', phase: 'before', pin: null }] },
};
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: border, intended: undefined }, rig.runtime.structureTask.ledger)));
	const planning = expectDefined(rig.deps.commands.planning, 'planning services'), render = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Render', unit: 'm2', category: 'material' }), 'absent')).entity;
	const materialId = createRequirementId();
	expectOk(await rig.runtime.dispatcher.run(planning.material(expectOk(await planning.read(rig.plan.id)), { id: materialId, assetId: render.id, waste: '0', override: '',
		source: { planId: rig.plan.id, targetId: 'wall-a', workId: 'work-border', outcomeId: 'detail-wall', state: 'current', rule: 'wall-net', manual: '0', coverage: '1', lot: '', minimum: '' } }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.materials.some(item => item.entity.id === materialId) === true, 'plan-origin material read');
	rig.selection.select(['wall-a' as never]); await settle();
	return { rig, materialId };
}
async function openForm(rig: Rig, mode: 'costs' | 'materials' | 'notes', button: string) {
	rig.runtime.renovation.focus('', mode); await settle();
	await rig.wrapper.get(button).trigger('click'); await settle();
	return rig.wrapper.get('[data-rp-form="planning"]');
}

it('offers a room-less cost the wall\'s own material', async () => {
	const { rig, materialId } = await setup();
	expect(rig.session.roomId).toBe('');
	const cost = await openForm(rig, 'costs', '[data-rp-new-cost]');
	expect(cost.find(`select[name="requirement"] option[value="${materialId}"]`).exists()).toBe(true);
});

it('offers a room-less material the wall\'s own Work and planned subject', async () => {
	const { rig } = await setup();
	const material = await openForm(rig, 'materials', '[data-rp-new-material]');
	expect(material.find('option[value="work-border"]').exists()).toBe(true);
	expect(material.find('option[value="detail-wall"]').exists()).toBe(true);
});

it('offers a room-less note the wall\'s own records to link', async () => {
	const { rig } = await setup();
	const note = await openForm(rig, 'notes', '[data-rp-new-evidence]');
	expect(note.find('option[value="work-border"]').exists()).toBe(true);
});

it('creates an untitled room-less note that names its wall as the context', async () => {
	const { rig } = await setup();
	const files = expectDefined(rig.deps.commands.evidenceFiles, 'evidence files'), create = vi.spyOn(files, 'createNote');
	const note = await openForm(rig, 'notes', '[data-rp-new-evidence]');
	await expectDefined(note.findAll('button').find(button => button.text() === tr('planning.create-note')), 'create note').trigger('click'); await settle();
	expect(create).toHaveBeenCalledOnce();
	const body = create.mock.calls[0][2];
	expect(body.startsWith(`# ${tr('planning.note')}\n`)).toBe(true);
	expect(body).toContain(tr('planning.context-note', { room: 'wall-a' }));
});

it('offers a wall\'s materials no shopping list where the host cannot write one', async () => {
	const { rig } = await setup();
	rig.runtime.renovation.focus('', 'materials'); await settle();
	expect(rig.wrapper.findAll('button').some(button => button.text() === tr('planning.shopping'))).toBe(true);
	rig.runtime.renovation.focus('', 'costs'); await settle();
	Object.assign(rig.deps.commands, { shoppingNote: undefined });
	rig.runtime.renovation.focus('', 'materials'); await settle();
	expect(rig.wrapper.find('[data-rp-new-material]').exists()).toBe(true);
	expect(rig.wrapper.findAll('button').some(button => button.text() === tr('planning.shopping'))).toBe(false);
});

it('focuses a room-less photo from the gallery with no room', async () => {
	const { rig } = await setup();
	rig.runtime.renovation.focus('', 'photos'); await settle();
	await rig.wrapper.get('[data-rp-evidence-photo="photo-wall"]').trigger('click'); await settle();
	expect([rig.session.roomId, rig.session.targetId, rig.session.focusedId]).toEqual(['', 'wall-a', 'photo-wall']);
});

it('focuses no target when nothing is selected, and opens no form for a session target no longer on the plan', async () => {
	const { rig } = await setup();
	rig.selection.select([]); await settle();
	rig.runtime.renovation.focus('', 'work'); await settle();
	expect([rig.session.roomId, rig.session.targetId, rig.selection.selectedIds]).toEqual(['', '', []]);
	const read = vi.spyOn(rig.renovation, 'read');
	rig.session.targetId = 'wall-gone';
	await rig.runtime.renovation.edit('work', ''); await settle();
	expect(read).not.toHaveBeenCalled(); expect(rig.dialogs.current).toBeNull();
});
