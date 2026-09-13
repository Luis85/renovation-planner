// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, KITCHEN_BEAM, POST_A, type EditorRig } from '../../helpers/structural';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';

const path: NamedSpatialElement = { id: 'element-garden-path', kind: 'path', name: 'Garden route', points: [{ x: 500, y: 5000 }, { x: 3000, y: 5000 }] };
const WARNING = 'Remove only after a structural check.';
const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function confirmationFor(rig: EditorRig, id: string): Promise<string> {
	rig.selection.select([id as never]); await settle();
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="delete-element"]').element.click();
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', `${id} confirmation`);
	const current = rig.dialogs.current;
	return current?.kind === 'confirm' ? current.message : '';
}

it('names a load-bearing post in its own confirmation, and still deletes it on confirm', async () => {
	const rig = await editorWith(mounted, POST_A, path);
	expect(await confirmationFor(rig, POST_A.id)).toContain(`Load-bearing: Post A. ${WARNING}`);
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click();
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'post deleted');
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements?.map(item => item.id)).toContain(POST_A.id);
});

it('says nothing about load for a post that carries none or an element that cannot', async () => {
	const rig = await editorWith(mounted, { ...POST_A, loadBearing: false }, path);
	for (const id of [POST_A.id, path.id]) {
		expect(await confirmationFor(rig, id)).not.toContain(WARNING);
		rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click();
		await settleUntil(() => rig.dialogs.current === null && !rig.runtime.elementActions.active.value, `${id} cancelled`);
	}
});

it('names every load-bearing element in a multi-item confirmation', async () => {
	const rig = await editorWith(mounted, POST_A, KITCHEN_BEAM, path);
	const removing = rig.runtime.elementActions.removeMany([POST_A.id, KITCHEN_BEAM.id, path.id]);
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'selection confirmation');
	const current = rig.dialogs.current;
	expect(current?.kind === 'confirm' ? current.message : '').toContain(`Load-bearing: Post A, Kitchen beam. ${WARNING}`);
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click(); await removing; await settle();
	expect(rig.project.structure.elements ?? []).toEqual([]);
});
