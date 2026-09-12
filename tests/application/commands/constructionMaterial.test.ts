// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { EMPTY_RENOVATION, type Renovation, type RenovationSubject } from '../../../src/domain/renovation/Renovation';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { constructionAsset } from '../../../src/application/commands/renovation/constructionEntries';
import { constructionAwareRenovation } from '../../../src/application/commands/renovation/ConstructionMaterialCommand';
import type { PlanningDeps } from '../../../src/application/commands/renovation/materialPlanning';
import { leftWritesBehind, type DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { RenovationServices } from '../../../src/application/commands/renovation/RenovationCommand';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const wall = (planned: RenovationSubject['planned'], existing: RenovationSubject['existing'] = { description: 'Brick', condition: 'good' }): RenovationSubject => ({ id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing, planned });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const render = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Render', unit: 'm2', category: 'material' }), 'absent')).entity;
	const lime = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Lime render', unit: 'm2', category: 'material' }), 'absent')).entity;
	return { rig, render, lime };
}
async function write(rig: Rig, renovation: Renovation) {
	return rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation, intended: undefined }, rig.runtime.structureTask.ledger));
}
const entries = async (rig: Rig) => expectOk(await rig.stack.requirements.listByPlanOrigin(rig.plan.id)).filter(item => item.entity.source?.construction);

describe('the construction entry (ADR-0031)', () => {
	it('exists only for a new wall or a planned material that differs from the existing one', () => {
		expect(constructionAsset(wall({ change: 'modify', description: 'Rendered', assetId: 'render' }))).toBe('render');
		expect(constructionAsset(wall({ change: 'add', description: 'New', assetId: 'render' }, null))).toBe('render');
		expect(constructionAsset(wall({ change: 'modify', description: 'Painted', assetId: 'render' }, { description: 'Render', condition: 'good', assetId: 'render' }))).toBeUndefined();
		expect(constructionAsset(wall({ change: 'unchanged', description: 'Brick' }))).toBeUndefined();
		expect(constructionAsset(wall(null))).toBeUndefined();
	});

	it('creates, repoints and removes one entry with the planned material, each one undoable', async () => {
		const { rig, render, lime } = await setup();
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] }));
		const [created] = await entries(rig);
		expect(created.entity).toMatchObject({ assetId: render.id, origin: { kind: 'plan', planId: rig.plan.id } });
		expect(created.entity.source).toMatchObject({ targetId: 'wall-a', outcomeId: 'detail-wall', state: 'intended', rule: 'wall-net', construction: true });
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: lime.id })] }));
		expect((await entries(rig)).map(item => [item.entity.id, item.entity.assetId])).toEqual([[created.entity.id, lime.id]]);
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'unchanged', description: 'Brick' })] }));
		expect(await entries(rig)).toEqual([]);
		await rig.runtime.undo(); await settle();
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([lime.id]);
		await rig.runtime.undo(); await settle();
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([render.id]);
		await rig.runtime.undo(); await settle();
		expect(await entries(rig)).toEqual([]);
		expect(rig.project.plan?.renovation?.subjects ?? []).toEqual([]);
	});

	it('refuses to clear a material whose entry a cost still uses, and writes nothing', async () => {
		const { rig, render } = await setup();
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] }));
		const [entry] = await entries(rig);
		const withCost: Renovation = { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })],
			depth: { procurement: [], evidence: [], costs: [{ id: 'cost-render', targetId: 'wall-a', workId: '', title: 'Render', category: 'material', requirementId: entry.entity.id, planned: null, facts: [], cancelled: false }] } };
		expectOk(await write(rig, withCost));
		const before = [...rig.stack.vault.entries];
		expect(await write(rig, { ...withCost, subjects: [wall({ change: 'unchanged', description: 'Brick' })] })).toMatchObject({ ok: false, error: { code: 'renovation.construction-referenced' } });
		expect([...rig.stack.vault.entries]).toEqual(before);
	});

	it('restores the subject when the entry cannot be written', async () => {
		const { rig, render } = await setup();
		const save = rig.stack.requirements.save.bind(rig.stack.requirements);
		rig.stack.requirements.save = () => Promise.resolve({ ok: false, error: { category: 'Persistence', code: 'test.injected', message: 'Injected.' } } as never);
		expect((await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] })).ok).toBe(false);
		rig.stack.requirements.save = save;
		expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation?.subjects ?? []).toEqual([]);
	});
});

const rendered = (assetId: string): Renovation => ({ ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId })] });
const injected = { ok: false, error: { category: 'Persistence', code: 'test.injected', message: 'Injected.' } } as never;
const subjects = async (rig: Rig) => expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation?.subjects ?? [];
async function command(rig: Rig, renovation: Renovation) {
	return rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation, intended: undefined }, rig.runtime.structureTask.ledger);
}

describe('the construction entry beside its subject (spec §8)', () => {
	it('dispatches the plain renovation command when no subject names a planned material', () => {
		const plain = { execute: vi.fn<() => Promise<DispatchResult>>(), undo: vi.fn<() => Promise<DispatchResult>>() };
		const services = constructionAwareRenovation({ read: vi.fn<RenovationServices['read']>(), command: () => plain }, {} as PlanningDeps);
		const baseline = { plan: { entity: { renovation: { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Painted' })] } } } } as never;
		const unchanged = { ...EMPTY_RENOVATION, subjects: [wall({ change: 'unchanged', description: 'Brick' }, { description: 'Brick', condition: 'good', assetId: 'brick' })] };
		expect(services.command(baseline, { renovation: unchanged, intended: undefined }, new SessionWriteLedger())).toBe(plain);
		expect(services.command(baseline, { renovation: rendered('render'), intended: undefined }, new SessionWriteLedger())).not.toBe(plain);
	});

	it('undoes and redoes the subject and its entry together', async () => {
		const { rig, render } = await setup();
		const create = await command(rig, rendered(render.id));
		expectOk(await create.execute());
		expectOk(await create.undo());
		expect([await entries(rig), await subjects(rig)]).toEqual([[], []]);
		expectOk(await create.execute());
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([render.id]);
		expect((await subjects(rig)).map(item => item.id)).toEqual(['detail-wall']);
	});

	it('deletes the entry before removing the subject it measures', async () => {
		const { rig, render } = await setup();
		expectOk(await write(rig, rendered(render.id)));
		expectOk(await write(rig, EMPTY_RENOVATION));
		expect([await entries(rig), await subjects(rig)]).toEqual([[], []]);
	});

	it('keeps a quantity override across a repoint only while the unit is unchanged', async () => {
		const { rig, render, lime } = await setup();
		const skirting = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Skirting', unit: 'm', category: 'material' }), 'absent')).entity;
		expectOk(await write(rig, rendered(render.id)));
		const [entry] = await entries(rig);
		expectOk(await rig.stack.requirements.save(expectOk(entry.entity.withQuantityOverride({ value: new Decimal('20'), unit: 'm2' })), entry.version));
		expectOk(await write(rig, rendered(lime.id)));
		expect((await entries(rig)).map(item => [item.entity.id, item.entity.quantity.override?.value.toString()])).toEqual([[entry.entity.id, '20']]);
		expectOk(await write(rig, rendered(skirting.id)));
		expect((await entries(rig)).map(item => [item.entity.id, item.entity.unit, item.entity.quantity.override])).toEqual([[entry.entity.id, 'm', undefined]]);
	});

	it('refuses an undo after a peer edited the entry, and writes nothing', async () => {
		const { rig, render } = await setup();
		const create = await command(rig, rendered(render.id));
		expectOk(await create.execute());
		const [entry] = await entries(rig);
		expectOk(await rig.stack.requirements.save(expectOk(entry.entity.withQuantityOverride({ value: new Decimal('20'), unit: 'm2' })), entry.version));
		const before = [...rig.stack.vault.entries];
		const refused = expectErr(await create.undo());
		expect([refused.code, leftWritesBehind(refused)]).toEqual(['undo.superseded', false]);
		expect([...rig.stack.vault.entries]).toEqual(before);
	});

	it('refuses an undo after a peer edited the plan note, and leaves the entry standing', async () => {
		const { rig, render } = await setup();
		const create = await command(rig, rendered(render.id));
		expectOk(await create.execute());
		const loaded = expectDefined(expectOk(await rig.stack.plans.getById(rig.plan.id)), 'plan');
		const peer: Renovation = { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered by a peer', assetId: render.id })] };
		expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(loaded.entity, peer)), loaded.version));
		const refused = expectErr(await create.undo());
		expect([refused.code, leftWritesBehind(refused)]).toEqual(['undo.superseded', false]);
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([render.id]);
		expect((await subjects(rig)).map(item => item.planned?.description)).toEqual(['Rendered by a peer']);
	});

	it('reports a failed compensation as a write left behind, and retires', async () => {
		const { rig, render } = await setup();
		const create = await command(rig, rendered(render.id));
		const requirementSave = rig.stack.requirements.save.bind(rig.stack.requirements), planSave = rig.stack.plans.save.bind(rig.stack.plans);
		let planSaves = 0;
		rig.stack.requirements.save = () => Promise.resolve(injected);
		rig.stack.plans.save = (...args) => ++planSaves > 1 ? Promise.resolve(injected) : planSave(...args);
		expect(leftWritesBehind(expectErr(await create.execute()))).toBe(true);
		rig.stack.requirements.save = requirementSave; rig.stack.plans.save = planSave;
		expect(leftWritesBehind(expectErr(await create.execute()))).toBe(true);
		expect(leftWritesBehind(expectErr(await create.undo()))).toBe(true);
	});
});
