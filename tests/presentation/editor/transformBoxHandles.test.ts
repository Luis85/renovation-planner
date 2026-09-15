// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import Konva from 'konva';
import { CABINET, selectedItemRig } from '../../helpers/transformBox';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { transformHandlePoints } from '../../../src/presentation/editor/elements/transformBox';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldPerScreenPixel, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';

/** `--interactive-accent` is what `themeTokens.ts` resolves the accent from; see `zoneEditing.test.ts`'s own use of this pattern. */
const ACCENT_FOR_TEST = 'rgb(4, 5, 6)';
const mounted: Awaited<ReturnType<typeof selectedItemRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); document.documentElement.style.removeProperty('--interactive-accent'); });
const handles = () => expectDefined(Konva.stages.at(-1), 'stage').find('.transform-box-handle');

it('draws eight handles and a padded outline for a selected item, and none for a multi-selection or in Renovate', async () => {
	const rig = await selectedItemRig(); mounted.push(rig);
	await settleUntil(() => handles().length === 8, 'box handles');
	expect(expectDefined(Konva.stages.at(-1), 'stage').find('.transform-box-outline')).toHaveLength(1);
	rig.selection.select([CABINET.id, rig.room.id] as never); await settle();
	expect(handles()).toHaveLength(0);
	rig.selection.select([CABINET.id as never]); rig.session.perspective = 'renovate'; await settle();
	expect(handles()).toHaveLength(0);
});

it('fills the hovered handle and hides the box while the element previews a move', async () => {
	document.documentElement.style.setProperty('--interactive-accent', ACCENT_FOR_TEST);
	const rig = await selectedItemRig(); mounted.push(rig);
	await settleUntil(() => handles().length === 8, 'box handles');
	const editor = useEditorStore(rig.pinia), frame = expectDefined(rig.runtime.elementActions.transformBox.value, 'item box');
	const first = transformHandlePoints(frame, worldPerScreenPixel(editor.viewport, STAGE_PIXELS))[0];
	editor.setPointer(worldToScreen(first, editor.viewport, STAGE_PIXELS));
	rig.runtime.renderState.hoveredTargetKind = 'resize'; await settle();
	const fills = handles().map(node => (node as Konva.Rect).fill());
	expect(fills[0]).not.toBe(fills[1]);
	expect(new Set(fills.slice(1)).size).toBe(1);
	rig.runtime.elementActions.previewElement(CABINET.id, CABINET.points.map(point => ({ x: point.x + 100, y: point.y }))); await settle();
	expect(handles()).toHaveLength(0);
});
