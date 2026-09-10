import { expect } from 'vitest';
import type Konva from 'konva';
import { expectDefined } from './domain';
import { settle, type EditorHarness } from './editor';
import { pointer } from './planEditorRig';
import type { Point } from '../../src/core/geometry/Point';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../src/presentation/editor/viewport/Viewport';

/** Preserve exact vertex counts and exercise the real idle hover before expecting rotation arrows. */
export async function zoneEditingHandles(harness: EditorHarness, pointCount: number, hoverWorld: Point) {
	const interaction = expectDefined(harness.stage?.findOne<Konva.Layer>('.interaction'), 'interaction layer');
	expect(interaction.getChildren().filter(node => node.getClassName() === 'Circle')).toHaveLength(pointCount);
	const canvas = expectDefined(harness.canvasEl, 'editor canvas'), box = canvas.getBoundingClientRect();
	const hover = worldToScreen(hoverWorld, useEditorStore(harness.pinia).viewport, STAGE_PIXELS);
	pointer(canvas, 'pointermove', box.left + hover.x, box.top + hover.y, 0, 1, 0); await settle();
	expect(interaction.findOne('.object-rotation-handle')).toBeDefined();
	return interaction;
}
