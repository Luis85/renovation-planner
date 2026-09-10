// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { tr } from '../../../src/presentation/i18n/strings';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

function click(rig: Rig, scope: string, label: string): void {
	expectDefined(rig.wrapper.findAll<HTMLButtonElement>(`${scope} button`).find(item => item.text() === label), label).element.click();
}
async function confirm(rig: Rig, what: string): Promise<void> {
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', what);
	rig.dialogs.resolve('confirm'); await settle();
}

it('removes a linked Cost and its purchase quantities so the Material they block can be deleted', async () => {
	const rig = await renovationEditor(true), roomId = rig.room.id; mounted.push(rig);
	await rig.runtime.refreshProjection(); rig.runtime.renovation.focus(roomId, 'materials'); await settle();
	rig.wrapper.get<HTMLButtonElement>('[data-rp-new-material]').element.click();
	await settleUntil(() => rig.wrapper.find('[data-rp-form="planning"]').exists(), 'material draft');
	const asset = expectDefined(expectOk(await rig.stack.assets.listAll()).loaded.find(item => item.entity.unit === 'm2'), 'area material').entity;
	await rig.wrapper.get('select[name="asset"]').setValue(asset.id);
	rig.wrapper.get<HTMLButtonElement>('[data-rp-form="planning"] button[type="submit"]').element.click();
	await settleUntil(() => !rig.wrapper.find('[data-rp-form="planning"]').exists(), 'material save');
	const requirement = expectDefined(expectOk(await rig.stack.requirements.listByZone(roomId))[0], 'saved Requirement').entity;

	const link = { roomId, targetId: roomId, workId: '' };
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const depth = { ...EMPTY_DEPTH,
		costs: [{ ...link, id: 'cost-tiles', title: 'Tiles', category: 'material' as const, requirementId: requirement.id, planned: null, cancelled: false, facts: [] }],
		procurement: [{ ...link, id: 'stock-tiles', requirementId: requirement.id, unit: requirement.unit, purchased: '1', reserved: '0' }] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth }, intended: baseline.geometry.document.intended }, rig.runtime.structureTask.ledger)));
	await rig.runtime.refreshProjection(); await settle();
	const row = `.rp-material-row[data-rp-record="${requirement.id}"]`;

	click(rig, row, tr('renovation.delete')); await settle();
	expect(rig.wrapper.text()).toContain(tr('planning.resolve-links'));

	rig.runtime.renovation.focus(roomId, 'costs', 'cost-tiles'); await settle();
	click(rig, '.rp-cost-row[data-rp-record="cost-tiles"]', tr('renovation.delete'));
	await confirm(rig, 'cost delete');
	await settleUntil(() => rig.project.plan?.renovation?.depth?.costs.length === 0, 'cost removed');

	rig.runtime.renovation.focus(roomId, 'materials', requirement.id); await settle();
	click(rig, row, tr('planning.clear-procurement'));
	await confirm(rig, 'procurement clear');
	await settleUntil(() => rig.project.plan?.renovation?.depth?.procurement.length === 0, 'procurement removed');

	click(rig, row, tr('renovation.delete'));
	await confirm(rig, 'material delete');
	await settleUntil(async () => expectOk(await rig.stack.requirements.listByZone(roomId)).length === 0, 'material removed');
});
