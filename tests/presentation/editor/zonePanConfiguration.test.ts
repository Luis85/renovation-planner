/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import { mountPlanEditorCanvas, type CanvasHarness } from '../../helpers/editor';
import { installDimensionFrames, flushDimensionFrames, clearDimensionFrames } from '../../helpers/dimensionFrames';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import ZoneShape from '../../../src/presentation/editor/layers/zone/ZoneShape.vue';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { placeAt, resizeTo } from '../../helpers/layout';
import { expectDefined } from '../../helpers/domain';

let open: CanvasHarness | undefined;
beforeEach(installDimensionFrames);
afterEach(() => {
	open?.unmount(); open = undefined;
	clearDimensionFrames(); vi.unstubAllGlobals();
});

it('does not resubmit unchanged zone configurations when the world viewport moves', async () => {
	const rig = await mountPlanEditorCanvas(); open = rig;
	useSelectionStore(rig.pinia).select(['zone-kitchen' as never]);
	await flushDimensionFrames();
	const overlay = rig.wrapper.get('.rp-dimension-labels').element as HTMLElement;
	placeAt(overlay, 0, 0, 800, 600); resizeTo(overlay, 800, 600);
	await flushDimensionFrames();
	const shape = rig.wrapper.findComponent(ZoneShape);
	const viewport = shape.props('captionViewport');
	expect(viewport).not.toBeNull();
	const nodes = ['Group', 'Line', 'Text'].flatMap(name => shape.findAllComponents({ name }));
	expect(nodes).toHaveLength(6);
	const configs = nodes.map(node => node.props('config'));
	const group = expectDefined(rig.stage.findOne<Konva.Group>(`.${shape.props('model').id}`), 'Room group');
	const children = [...group.getChildren()];
	expect(children).toHaveLength(5);
	const captions = group.find<Konva.Text>('Text').map(node => node.text());
	expect(captions).toHaveLength(3);
	const editor = useEditorStore(rig.pinia), before = editor.viewport;
	editor.viewport = { ...before, pan: { x: before.pan.x + 100, y: before.pan.y + 80 } };
	await flushDimensionFrames();
	expect(shape.props('captionViewport')).not.toEqual(viewport);
	for (const [index, node] of nodes.entries()) expect(node.props('config')).toBe(configs[index]);
	expect(group.getChildren()).toEqual(children);
	expect(group.find<Konva.Text>('Text').map(node => node.text())).toEqual(captions);
});
