// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectFound } from '../../helpers/domain';
import { canvasCandidates } from '../../../src/presentation/editor/selection/canvasCandidates';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('locks a zone from the sidebar, takes it off the canvas hit list, and undoes the lock', async () => {
	const rig = await renovationEditor();
	mounted.push(rig);
	rig.selection.clear();
	await settle();
	const hittable = () => canvasCandidates(rig.project.zones.values(), rig.project.structure, { zone: true, architecture: true, asset: true }).map((item) => item.id);
	expect(hittable()).toContain(rig.room.id);

	await rig.wrapper.get(`[data-rp-lock="${rig.room.id}"]`).trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.locked === true, 'zone locked');
	expect(expectFound(await rig.stack.zones.getById(rig.room.id)).entity.locked).toBe(true);
	expect(hittable()).not.toContain(rig.room.id);
	expect(rig.wrapper.get(`[data-rp-lock="${rig.room.id}"]`).attributes('aria-pressed')).toBe('true');

	await rig.runtime.undo();
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.locked !== true, 'zone unlocked');
	expect(expectFound(await rig.stack.zones.getById(rig.room.id)).entity.locked).toBe(false);
	expect(hittable()).toContain(rig.room.id);
});
