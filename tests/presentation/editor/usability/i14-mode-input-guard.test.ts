// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { expectOk } from '../../../helpers/domain';
import { settle } from '../../../helpers/editor';
import { pointerAt } from '../../../helpers/tool-context';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function setup() {
	const rig = await renovationEditor(true);
	mounted.push(rig);
	return rig;
}

function key(target: HTMLElement, init: KeyboardEventInit): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

it('I14 keeps selection visible but removes Room and wall geometry handles in Renovate', async () => {
	const rig = await setup();
	rig.selection.select([rig.room.id]);
	await settle();
	expect(rig.stage.findOne<Konva.Layer>('.interaction')?.find('Circle')).toHaveLength(4);

	rig.selection.select(['wall-a' as never]);
	await settle();
	expect(rig.stage.findOne<Konva.Layer>('.architecture')?.find('Circle')).toHaveLength(2);

	await rig.runtime.renovation.perspective('renovate');
	await settle();
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
	expect(rig.stage.findOne<Konva.Layer>('.interaction')?.find('Circle')).toHaveLength(0);
	expect(rig.stage.findOne<Konva.Layer>('.architecture')?.find('Circle')).toHaveLength(0);
	expect(rig.wrapper.find('[data-rp-dimension="width"]').exists()).toBe(false);
	expect(rig.wrapper.find('[data-rp-dimension="depth"]').exists()).toBe(false);

	await rig.runtime.renovation.perspective('plan');
	await settle();
	expect(rig.stage.findOne<Konva.Layer>('.architecture')?.find('Circle')).toHaveLength(2);
});

it('I14 keeps Room and wall pointer gestures selection-only in Renovate', async () => {
	const rig = await setup();
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	const history = rig.runtime.canUndo.value;
	rig.selection.select([rig.room.id]);
	await rig.runtime.renovation.perspective('renovate');
	await settle();
	const tool = rig.runtime.toolManager;

	tool.pointerDown(pointerAt(2000, 1500));
	tool.pointerMove(pointerAt(2200, 1700));
	expect(rig.runtime.renderState.previewPolygon).toBeNull();
	tool.pointerUp(pointerAt(2200, 1700));

	rig.selection.select(['wall-a' as never]);
	tool.pointerDown(pointerAt(4000, 0));
	tool.pointerMove(pointerAt(5000, 0));
	expect(rig.runtime.structureActions.preview.value).toBeNull();
	tool.pointerUp(pointerAt(5000, 0));
	await settle();

	expect(rig.dialogs.current).toBeNull();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
	expect(rig.runtime.canUndo.value).toBe(history);
});

it('I14 makes arrow nudge a no-op in Renovate without changing the selected Room or its history', async () => {
	const rig = await setup();
	rig.selection.select([rig.room.id]);
	await settle();
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	const history = rig.runtime.canUndo.value;

	await rig.runtime.renovation.perspective('renovate');
	key(rig.canvasEl, { key: 'ArrowRight' });
	await settle();

	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
	expect(rig.runtime.canUndo.value).toBe(history);
});
