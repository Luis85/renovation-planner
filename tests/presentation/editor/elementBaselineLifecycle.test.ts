// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toRaw } from 'vue';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { injectedPersistenceError } from '../../helpers/domain';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.changePlan(); await settle();
	return rig;
}
async function retire(rig: Awaited<ReturnType<typeof setup>>, action: 'replace' | 'dispose') {
	if (action === 'dispose') { rig.unmount(); return; }
	rig.runtime.cancelActiveTask(); rig.runtime.setTool('draw-fence');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'replacement baseline');
	rig.runtime.elementTask.draft.name = 'Replacement fence';
	rig.runtime.elementTask.setPoints([{ x: 0, y: 0 }, { x: 4000, y: 0 }]);
}

describe.each(['replace', 'dispose'] as const)('element baseline after %s', action => {
	it('ignores a rejected initial repository read without changing the newer draft or reporting into a retired leaf', async () => {
		const rig = await setup(), release = defer<void>();
		const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		const read = vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(release.promise.then(() => { throw new Error('retired initial read'); }));
		rig.runtime.setTool('draw-path'); await settle();
		expect(read).toHaveBeenCalledOnce(); expect(rig.runtime.elementTask.draft.loading).toBe(true);
		await retire(rig, action);
		const draft = structuredClone(toRaw(rig.runtime.elementTask.draft)), bytes = [...rig.stack.vault.entries];
		release.resolve(undefined); await settle();
		expect(rig.runtime.elementTask.draft).toEqual(draft); expect(report).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('retires a failed read-only retry while preserving the replacement draft and vault contents', async () => {
		const rig = await setup(), release = defer<void>();
		vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
		rig.runtime.setTool('draw-path'); await settleUntil(() => rig.runtime.elementTask.needsRead.value, 'failed baseline');
		const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		const query = vi.spyOn(rig.deps.commands.zoneInspector, 'execute').mockReturnValueOnce(release.promise.then(() => { throw new Error('retired retry query'); }));
		const retry = rig.runtime.elementTask.retry();
		await settleUntil(() => query.mock.calls.length === 1, 'held inspector retry');
		await retire(rig, action);
		const draft = structuredClone(toRaw(rig.runtime.elementTask.draft)), bytes = [...rig.stack.vault.entries];
		release.resolve(undefined); await retry; await settle();
		expect(rig.runtime.elementTask.draft).toEqual(draft); expect(report).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
