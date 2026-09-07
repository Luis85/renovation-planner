// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { toolContext, pointerAt } from '../../helpers/tool-context';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { ElementMove } from '../../../src/presentation/editor/elements/ElementMove';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import * as notices from '../../../src/presentation/notices/notify';

const path: NamedSpatialElement = { id: 'element-retiring-path', kind: 'path', name: 'Garden route', points: [{ x: 500, y: 500 }, { x: 3000, y: 500 }] };
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, path), rig.runtime.structureTask.ledger)));
	rig.selection.select([path.id as never]); await settle(); return rig;
}

describe('element removal and drag lifetime at real source boundaries', () => {
	it('does not open a removal confirmation when its pending reference read completes after leaf disposal', async () => {
		const rig = await setup(), planning = expectDefined(rig.deps.commands.planning, 'planning');
		const entered = defer<void>(), release = defer<void>(), original = planning.read.bind(planning);
		vi.spyOn(planning, 'read').mockImplementationOnce(async id => { const result = await original(id); entered.resolve(); await release.promise; return result; });
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		rig.wrapper.get<HTMLButtonElement>('[data-rp-action="delete-element"]').element.click(); await entered.promise;
		mounted.splice(mounted.indexOf(rig), 1); rig.unmount(); release.resolve(); await settle();
		expect(rig.dialogs.current).toBeNull(); expect(rig.runtime.elementActions.active.value).toBe(false);
		expect(run).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('refuses the old deletion baseline after a peer changes the path during native confirmation', async () => {
		const rig = await setup(); rig.wrapper.get<HTMLButtonElement>('[data-rp-action="delete-element"]').element.click();
		await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'deletion confirmation');
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		const peer = { ...path, name: 'Peer garden route', points: [{ x: 500, y: 500 }, { x: 4500, y: 500 }] };
		expectOk(await rig.renovation.command(baseline, elementInput(baseline, peer), new SessionWriteLedger()).execute());
		await rig.runtime.refreshProjection(); await settle();
		const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
		const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click();
		await settleUntil(() => !rig.runtime.elementActions.active.value, 'refused stale deletion');
		expect(notify).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
		expect(rig.project.structure.elements?.find(item => item.id === path.id)?.points).toEqual(peer.points);
		expect(rig.project.plan?.spatialElements?.find(item => item.id === path.id)?.name).toBe(peer.name);
		expect(rig.dialogs.current).toBeNull();
	});
	it('finishes an old drag without writing after the peer removes and refreshes its entire source', async () => {
		const rig = await setup(), original = expectDefined(rig.project.structure.elements?.find(item => item.id === path.id), 'drag source');
		let completed: Promise<void> = Promise.resolve();
		const move = vi.spyOn(rig.runtime.elementActions, 'move');
		const gesture = new ElementMove({ moveElement: (id, points, captured) => { completed = rig.runtime.elementActions.move(id, points, captured); } });
		const tool = toolContext(); gesture.start(tool.context, pointerAt(500, 500), original);
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.renovation.command(baseline, elementInput(baseline, path, true), new SessionWriteLedger()).execute());
		await rig.runtime.refreshProjection(); await settle();
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		gesture.finish(tool.context, pointerAt(1500, 1500)); await completed; await settle();
		expect(move).toHaveBeenCalledOnce(); expect(run).not.toHaveBeenCalled();
		expect(rig.project.structure.elements ?? []).toEqual([]); expect(rig.selection.selectedIds).not.toContain(path.id);
		expect(rig.runtime.elementActions.preview.value).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
