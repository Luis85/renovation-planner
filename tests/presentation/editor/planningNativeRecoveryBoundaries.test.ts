// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { tr } from '../../../src/presentation/i18n/strings';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); return rig; }

it('refuses Add Cost when two successful refresh reads straddle a real peer geometry write, then allows a fresh draft', async () => {
	const rig = await setup(); rig.runtime.renovation.focus(rig.room.id, 'costs'); await settle();
	const planning = expectDefined(rig.deps.commands.planning, 'planning services');
	const planningEntered = defer<void>(), releasePlanning = defer<void>(), spatialEntered = defer<void>(), releaseSpatial = defer<void>();
	const planningRead = planning.read.bind(planning), spatialRead = rig.deps.queries.findZonesByPlan.bind(rig.deps.queries);
	const old = expectDefined(rig.runtime.planning.baseline.value, 'shown planning baseline');
	vi.spyOn(planning, 'read').mockImplementationOnce(async id => {
		const actual = await planningRead(id); planningEntered.resolve(); await releasePlanning.promise; return actual;
	});
	vi.spyOn(rig.deps.queries, 'findZonesByPlan').mockImplementationOnce(async (...args) => {
		spatialEntered.resolve(); await releaseSpatial.promise; return spatialRead(...args);
	});
	const refreshing = rig.runtime.refreshProjection();
	try {
		await Promise.all([planningEntered.promise, spatialEntered.promise]);
		const before = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(before.document.structure, 'current walls');
		const peer = { ...structure, walls: structure.walls.map(wall => wall.id === 'wall-a' ? { ...wall, thickness: 225 } : wall) };
		// Independent sidecar writes can become visible between the two repository snapshots.
		expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: peer }, before.version));
		releaseSpatial.resolve();
		await settleUntil(() => rig.project.structure.walls[0]?.thickness === 225, 'later spatial snapshot');
		releasePlanning.resolve(); await refreshing; await settle();
		expect(rig.runtime.planning.baseline.value?.geometry.document).toEqual(old.geometry.document);
		expect(rig.runtime.planning.loading.value).toBe(false); expect(rig.runtime.writesBlocked.value).toBe(false);
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		const warning = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		rig.wrapper.get<HTMLButtonElement>('[data-rp-new-cost]').element.click();
		await settleUntil(() => rig.runtime.planning.baseline.value?.geometry.document.structure?.walls[0]?.thickness === 225, 'mismatch recovery');
		await settle(); expect(warning).toHaveBeenCalledOnce(); expect(rig.dialogs.current).toBeNull();
		expect(run).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		rig.wrapper.get<HTMLButtonElement>('[data-rp-new-cost]').element.click();
		await settleUntil(() => rig.wrapper.find('[data-rp-form="planning"]').exists(), 'fresh Cost draft');
		rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click(); await settle();
		expect(run).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { releaseSpatial.resolve(); releasePlanning.resolve(); await refreshing; }
});

it('names every shared Evidence context before full unlink and restores ownership with Undo without changing its file', async () => {
	const rig = await setup(), roomId = rig.room.id, path = 'Notes/shared-survey.md', file = '# Survey\n\nKeep this original text.\n';
	rig.stack.vault.entries.set(path, file);
	const item: Evidence = { id: 'evidence-shared-survey', roomId, targetId: roomId, workId: '', recordId: '', path, subpath: '#Survey',
		description: 'Shared wall survey', type: 'note', phase: 'before', pin: null, links: [{ roomId, targetId: 'wall-a' }, { roomId, targetId: 'wall-b' }] };
	const other: Evidence = { ...item, id: 'evidence-independent-survey', description: 'Independent survey', links: [] };
	const before = expectOk(await rig.renovation.read(rig.plan.id));
	const renovation = { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence: [item, other] } };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(before, { renovation, intended: before.geometry.document.intended }, rig.runtime.structureTask.ledger)));
	expectOk(await expectDefined(rig.deps.commands.planning, 'planning services').read(rig.plan.id));
	expectOk(await rig.deps.queries.getPlan(rig.plan.id));
	rig.runtime.renovation.focus(roomId, 'notes', item.id); await settle();
	const bytes = [...rig.stack.vault.entries], geometry = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const run = vi.spyOn(rig.runtime.dispatcher, 'run');
	const unlink = () => expectDefined(rig.wrapper.get(`[data-rp-record="${item.id}"]`).findAll<HTMLButtonElement>('.rp-planning-actions button')
		.find(button => button.text() === tr('planning.unlink')), 'native full-record Unlink').element.click();
	unlink(); await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'shared unlink confirmation');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Studio · Wall 1');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Studio · Wall 2');
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click(); await settle();
	expect(run).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	unlink(); await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'reopened shared unlink');
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click();
	await settleUntil(() => !rig.runtime.renovation.blocked.value && rig.project.plan?.renovation?.depth?.evidence.length === 1, 'unlink read-back');
	expect(run).toHaveBeenCalledOnce(); expect(rig.project.plan?.renovation?.depth?.evidence).toEqual([other]);
	expect(rig.stack.vault.entries.get(path)).toBe(file); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(geometry);
	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(rig.project.plan?.renovation).toEqual(renovation); expect(rig.stack.vault.entries.get(path)).toBe(file);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(geometry);
});
