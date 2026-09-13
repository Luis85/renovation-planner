// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { EMPTY_RENOVATION, type Renovation, type RenovationSubject } from '../../../src/domain/renovation/Renovation';
import { withPlanRenovation, withPlanSpatialElements } from '../../../src/domain/plan/Plan';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { renovationMessage } from '../../../src/presentation/editor/renovation/renovationMessage';
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
		const refused = await write(rig, { ...withCost, subjects: [wall({ change: 'unchanged', description: 'Brick' })] });
		expect(refused).toMatchObject({ ok: false, error: { code: 'renovation.construction-referenced' } });
		expect(renovationMessage(expectErr(refused))).toContain('Render');
		expect([...rig.stack.vault.entries]).toEqual(before);
	});

	it('names the evidence and the order still using an entry the way a user reads them', async () => {
		const { rig, render } = await setup();
		const rendered = { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] };
		expectOk(await write(rig, rendered));
		const [entry] = await entries(rig);
		const depth = { costs: [], evidence: [{ id: 'photo-render', targetId: 'wall-a', workId: '', recordId: entry.entity.id, path: 'Photos/wall.png', subpath: '', description: 'Cracked render', type: 'photo' as const, phase: 'before' as const, pin: null }],
			procurement: [{ id: 'procurement-render', targetId: 'wall-a', workId: '', requirementId: entry.entity.id, unit: 'm2' as const, purchased: '1', reserved: '0' }] };
		expectOk(await write(rig, { ...rendered, depth }));
		const refused = expectErr(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'unchanged', description: 'Brick' })], depth }));
		expect(renovationMessage(refused)).toBe('Other records still use this material\'s quantity: Cracked render, Render. Remove them before changing the material.');
	});

	it('leaves an entry whose asset left the catalogue untouched through an unrelated write (spec §6.1)', async () => {
		const { rig, render } = await setup();
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })] }));
		const [entry] = await entries(rig);
		expectOk(await rig.stack.requirements.save(expectOk(entry.entity.withQuantityOverride({ value: new Decimal('20'), unit: 'm2' })), entry.version));
		const asset = expectDefined(expectOk(await rig.stack.assets.getById(render.id)), 'asset');
		expectOk(await rig.stack.assets.delete(render.id, asset.version));
		const work = { id: 'work-border', targetId: 'wall-a', title: 'Repoint', description: '', order: 0, progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
		expectOk(await write(rig, { ...EMPTY_RENOVATION, subjects: [wall({ change: 'modify', description: 'Rendered', assetId: render.id })], work: [work] }));
		expect((await entries(rig)).map(item => [item.entity.id, item.entity.assetId, item.entity.quantity.override?.value.toString()])).toEqual([[entry.entity.id, render.id, '20']]);
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
		expect(expectErr(await create.undo()).code).toBe('renovation.recovery-required');
	});
});

const unchanged = (): Renovation => ({ ...EMPTY_RENOVATION, subjects: [wall({ change: 'unchanged', description: 'Brick' })] });
const bytes = (rig: Rig) => [...rig.stack.vault.entries];
const element: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: -1000, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }] };
/** Runs `peer` once the entry step's last write (its sidecar confirmation) lands, before the renovation step reads anything. */
function afterDelete(rig: Rig, peer: () => Promise<void>): () => void {
	const sidecarWrite = rig.geometry.write.bind(rig.geometry);
	let writes = 0;
	rig.geometry.write = async (...args) => { const written = await sidecarWrite(...args); if (++writes === 1) await peer(); return written; };
	return () => { rig.geometry.write = sidecarWrite; };
}

describe('a construction write refused part-way puts back what already moved', () => {
	it.each(['refuses', 'throws'])('puts the subject back when a read %s before its entry is saved', async how => {
		const { rig, render } = await setup();
		const create = await command(rig, rendered(render.id));
		const planSave = rig.stack.plans.save.bind(rig.stack.plans), getProject = rig.stack.projects.getById.bind(rig.stack.projects);
		let armed = false;
		rig.stack.plans.save = (...args) => { armed = true; rig.stack.plans.save = planSave; return planSave(...args); };
		rig.stack.projects.getById = (...args) => {
			if (!armed) return getProject(...args);
			armed = false; rig.stack.projects.getById = getProject;
			return how === 'throws' ? Promise.reject(new Error('Injected.')) : Promise.resolve(injected);
		};
		const refused = expectErr(await create.execute());
		rig.stack.plans.save = planSave; rig.stack.projects.getById = getProject;
		expect(leftWritesBehind(refused)).toBe(false);
		expect([await entries(rig), await subjects(rig)]).toEqual([[], []]);
		const before = bytes(rig);
		await create.undo();
		expect(bytes(rig)).toEqual(before);
		// The put-back emptied `done`, so a second execute starts afresh rather than replaying the renovation step alone.
		const again = await create.execute();
		expect([again.ok, (await entries(rig)).length, (await subjects(rig)).length, bytes(rig).length === before.length]).toEqual([false, 0, 0, true]);
	});

	it('puts the entry back when the sidecar moved after the entry was deleted', async () => {
		const { rig, render } = await setup();
		expectOk(await write(rig, rendered(render.id)));
		const clear = await command(rig, unchanged());
		const restore = afterDelete(rig, async () => {
			const snapshot = expectOk(await rig.geometry.read(rig.plan.id));
			expectOk(await rig.geometry.write(rig.plan.id, { ...snapshot.document, objects: snapshot.document.objects.map(item => ({ ...item, labelOffset: { dx: 100, dy: 100 } })) }, snapshot.version));
		});
		const refused = expectErr(await clear.execute());
		restore();
		expect([refused.code, leftWritesBehind(refused)]).toEqual(['undo.superseded', false]);
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([render.id]);
		expect((await subjects(rig)).map(item => item.planned?.assetId)).toEqual([render.id]);
		const before = bytes(rig);
		await clear.undo();
		expect(bytes(rig)).toEqual(before);
	});

	it('keeps the plan note version check across the rebase, so a peer label survives and the entry is put back', async () => {
		const { rig, render } = await setup();
		expectOk(await write(rig, rendered(render.id)));
		const added = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(added, elementInput(added, element), rig.runtime.structureTask.ledger)));
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		const relabel = rig.renovation.command(baseline, { ...elementInput(baseline, { ...element, name: 'Local label' }), renovation: unchanged() }, rig.runtime.structureTask.ledger);
		const restore = afterDelete(rig, async () => {
			const loaded = expectDefined(expectOk(await rig.stack.plans.getById(rig.plan.id)), 'plan');
			expectOk(await rig.stack.plans.save(expectOk(withPlanSpatialElements(loaded.entity, [{ id: element.id, name: 'Peer label' }])), loaded.version));
		});
		expectErr(await relabel.execute());
		restore();
		const current = expectOk(await rig.renovation.read(rig.plan.id));
		expect(current.plan.entity.spatialElements?.map(item => item.name)).toEqual(['Peer label']);
		expect(current.plan.entity.renovation?.subjects.map(item => item.planned?.assetId)).toEqual([render.id]);
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([render.id]);
	});

	it('retires when the renovation step left writes behind, even though the entry is put back', async () => {
		const { rig, render } = await setup();
		expectOk(await write(rig, rendered(render.id)));
		const clear = await command(rig, unchanged());
		const planSave = rig.stack.plans.save.bind(rig.stack.plans), geometryWrite = rig.geometry.write.bind(rig.geometry);
		let planSaves = 0, geometryWrites = 0;
		rig.stack.plans.save = (...args) => ++planSaves === 2 ? Promise.resolve(injected) : planSave(...args);
		rig.geometry.write = (...args) => ++geometryWrites === 2 ? Promise.resolve(injected) : geometryWrite(...args);
		expect(leftWritesBehind(expectErr(await clear.execute()))).toBe(true);
		rig.stack.plans.save = planSave; rig.geometry.write = geometryWrite;
		expect((await entries(rig)).map(item => item.entity.assetId)).toEqual([render.id]);
		expect(expectErr(await clear.execute()).code).toBe('renovation.recovery-required');
	});
});
