// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { backingCanvas } from '../../../helpers/canvas';
import { EMPTY_RENOVATION } from '../../../../src/domain/renovation/Renovation';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { TILE_PX } from '../../../../src/presentation/editor/structure/patternTile';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => {
	for (const rig of mounted.splice(0)) rig.unmount();
	document.documentElement.style.removeProperty('--text-muted');
});
const pixelsOf = (canvas: HTMLCanvasElement) => [...(backingCanvas(canvas)?.getContext('2d').getImageData(0, 0, TILE_PX, TILE_PX).data ?? [])];

it('draws a patterned wall after every wall body, at a constant screen density, and re-resolves its tile on a theme change', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Brick', unit: 'm2', planPattern: 'brick' }), 'absent')).entity;
	const subjects = [{ id: 'detail-wall', targetId: 'wall-a', kind: 'wall' as const, existing: { description: 'Brick', condition: 'good' as const, assetId: brick.id }, planned: { change: 'remove' as const, description: '' } }];
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: { ...EMPTY_RENOVATION, subjects }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === brick.id) === true, 'catalogue read');
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	await settleUntil(() => layer.find('.wall-pattern').length === 1, 'pattern pass drawn');
	const lines = layer.find<Konva.Shape>('Line'), pattern = layer.findOne<Konva.Line>('.wall-pattern') as Konva.Line;
	expect(lines.indexOf(pattern)).toBeGreaterThan(Math.max(...layer.find('.wall-body').map(node => lines.indexOf(node as Konva.Shape))));
	expect(pattern.fillPatternScaleX()).toBeCloseTo(1 / useEditorStore(rig.pinia).viewport.zoom);

	// Spec §8's Canvas row: "tile cache re-resolves on theme change". A cache keyed on the
	// pattern alone, ignorant of the resolved ThemeTokens, would keep handing back this same
	// tile forever; feeding the layer a different `wallPattern` ink is what tells them apart.
	const tileBefore = pixelsOf(pattern.fillPatternImage() as HTMLCanvasElement);
	document.documentElement.style.setProperty('--text-muted', 'rgb(7, 7, 7)');
	rig.changeTheme(); await settle();
	const repatterned = expectDefined(layer.findOne<Konva.Line>('.wall-pattern'), 'pattern after theme change');
	expect(pixelsOf(repatterned.fillPatternImage() as HTMLCanvasElement)).not.toEqual(tileBefore);

	rig.runtime.renovation.focus('', 'planned'); await settle();
	expect(layer.find('.wall-pattern')).toHaveLength(0);
});
