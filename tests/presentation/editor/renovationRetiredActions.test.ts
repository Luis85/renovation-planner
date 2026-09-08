// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import RenovationForm from '../../../src/presentation/editor/renovation/RenovationForm.vue';
import RenovationBatchForm from '../../../src/presentation/editor/renovation/RenovationBatchForm.vue';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';
import { batchRenovationInput } from '../../../src/presentation/editor/renovation/renovationBatch';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(); mounted.push(rig); return rig; }

it.each(['record', 'batch'] as const)('refuses a retained %s submit callback after its editor closes', async kind => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const targets = ['wall-a', 'wall-b'].map(targetId => ({ roomId: rig.room.id, targetId, name: targetId, kind: 'wall' as const }));
	const pending = kind === 'record' ? rig.runtime.renovation.edit('existing', rig.room.id) : rig.runtime.renovation.batch('work', targets);
	await settle();
	const dispatch = kind === 'record' ? rig.wrapper.getComponent(RenovationForm).props('dispatch') : rig.wrapper.getComponent(RenovationBatchForm).props('dispatch');
	const input = expectOk(batchRenovationInput(baseline, targets, { kind: 'work', id: '', title: 'Retired change', path: '', type: 'note' }));
	const run = vi.spyOn(rig.runtime.dispatcher, 'run');
	rig.unmount(); expect((await dispatch(input)).ok).toBe(false); await pending;
	expect(run).not.toHaveBeenCalled(); expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation).toBeUndefined();
});
it.each(['record', 'batch', 'change'] as const)('ignores a rejected %s read arriving after the editor closes', async kind => {
	const rig = await setup(), signal = defer<void>();
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(signal.promise.then(() => { throw new Error('Closed leaf'); }));
	const targets = ['wall-a', 'wall-b'].map(targetId => ({ roomId: rig.room.id, targetId, name: targetId, kind: 'wall' as const }));
	const pending = kind === 'record' ? rig.runtime.renovation.edit('existing', rig.room.id) : kind === 'batch' ? rig.runtime.renovation.batch('work', targets)
		: rig.runtime.renovation.change(() => ({ renovation: EMPTY_RENOVATION, intended: undefined }), 'Change');
	rig.unmount(); signal.resolve(); await pending;
	expect(rig.dialogs.current).toBeNull(); expect(rig.runtime.renovation.blocked.value).toBe(false);
});
