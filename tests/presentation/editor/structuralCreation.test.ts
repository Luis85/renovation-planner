// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { registerEditorIcons } from '../../../src/plugin/editorIconRegistration';
import { postOutline } from '../../../src/domain/spatial/structuralElement';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
let unregister: () => void;
beforeEach(() => { unregister = registerEditorIcons(); });
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); unregister(); });

async function setup(entry: 'post' | 'beam'): Promise<Rig> {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	await rig.wrapper.get('[data-rp-action="add"]').trigger('click');
	expect(rig.wrapper.findAll('[data-rp-entry]')).toHaveLength(16);
	expect(rig.wrapper.find('[data-icon-missing]').exists()).toBe(false);
	await rig.wrapper.get(`[data-rp-entry="${entry}"]`).trigger('click');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, `${entry} baseline`);
	return rig;
}
function click(rig: Rig, x: number, y: number): void {
	rig.runtime.toolManager.pointerDown(pointerAt(x, y)); rig.runtime.toolManager.pointerUp(pointerAt(x, y));
}

it('places one post per click at the typed section, stays on the tool, and undoes each post alone', async () => {
	const rig = await setup('post');
	expect(rig.runtime.activeToolId.value).toBe('place-post');
	await rig.wrapper.get('input[name="structural-width"]').setValue('0,2');
	click(rig, 1000, 500);
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'first post');
	const first = expectDefined(rig.project.structure.elements?.[0], 'first post');
	expect(first).toMatchObject({ kind: 'post', loadBearing: true, points: postOutline({ x: 1000, y: 500 }, 200, 140) });
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Post');
	expect(rig.runtime.activeToolId.value).toBe('place-post');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'next post baseline');
	expect(rig.runtime.elementTask.draft.post).toEqual({ width: 200, depth: 140 });
	click(rig, 3000, 2500);
	await settleUntil(() => rig.project.structure.elements?.length === 2, 'second post');
	expect(rig.stage.find('.post-outline')).toHaveLength(2);
	expect(rig.stage.find('.post-diagonal')).toHaveLength(4);
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(11);
	const placed = { elements: rig.project.structure.elements, metadata: rig.project.plan?.spatialElements };
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements).toEqual([first]);
	// Redo through the same door, `runtime.redo()`: the second post comes back as it was saved, geometry and name.
	await rig.runtime.redo(); await settle();
	expect({ elements: rig.project.structure.elements, metadata: rig.project.plan?.spatialElements }).toEqual(placed);
});

it('saves a beam on its second click with the typed width and draws it as two dashed edges', async () => {
	const rig = await setup('beam');
	expect(rig.wrapper.find('input[name="structural-depth"]').exists()).toBe(false);
	await rig.wrapper.get('input[name="structural-width"]').setValue('0,24');
	click(rig, 500, 3000); click(rig, 3500, 3000);
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'saved beam');
	const beam = expectDefined(rig.project.structure.elements?.[0], 'saved beam');
	expect(beam).toMatchObject({ kind: 'beam', width: 240, loadBearing: true, points: [{ x: 500, y: 3000 }, { x: 3500, y: 3000 }] });
	expect(rig.selection.selectedIds).toEqual([beam.id]);
	const edges = rig.stage.find<Konva.Line>('.beam-edge');
	expect(edges).toHaveLength(2);
	expect(edges[0].dash()).toHaveLength(2);
});

it('resets the structural fields when switching directly from the post tool to the beam tool', async () => {
	const rig = await setup('post');
	await rig.wrapper.get('input[name="structural-width"]').setValue('0,2');
	expect(rig.wrapper.get<HTMLInputElement>('input[name="structural-width"]').element.value).toBe('0,2');
	await rig.wrapper.get('[data-rp-action="add"]').trigger('click');
	await rig.wrapper.get('[data-rp-entry="beam"]').trigger('click');
	await settleUntil(() => rig.runtime.activeToolId.value === 'draw-beam' && !rig.runtime.elementTask.draft.loading, 'switched to beam');
	expect(rig.wrapper.get<HTMLInputElement>('input[name="structural-width"]').element.value).toBe(formatMetres(160));
	click(rig, 500, 3000); click(rig, 3500, 3000);
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'saved beam');
	const beam = expectDefined(rig.project.structure.elements?.[0], 'saved beam');
	expect(beam).toMatchObject({ kind: 'beam', width: 160 });
});

it('refuses to place while a typed section is unreadable, then places with the corrected one', async () => {
	const rig = await setup('post'), before = [...rig.stack.vault.entries];
	await rig.wrapper.get('input[name="structural-depth"]').setValue('-');
	expect(rig.wrapper.get('input[name="structural-depth"]').attributes('aria-invalid')).toBe('true');
	click(rig, 1000, 500); await settle();
	expect(rig.project.structure.elements ?? []).toHaveLength(0);
	expect([...rig.stack.vault.entries]).toEqual(before);
	await rig.wrapper.get('input[name="structural-depth"]').setValue('0,1');
	click(rig, 1000, 500);
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'corrected post');
	expect(rig.project.structure.elements?.[0].points).toEqual(postOutline({ x: 1000, y: 500 }, 140, 100));
});
