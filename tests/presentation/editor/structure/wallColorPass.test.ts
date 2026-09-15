// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { backingCanvas } from '../../../helpers/canvas';
import { EMPTY_RENOVATION } from '../../../../src/domain/renovation/Renovation';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => {
	for (const rig of mounted.splice(0)) rig.unmount();
	document.documentElement.style.removeProperty('--background-secondary');
});

it('paints a coloured wall body as a tint over the wall fill and inks a coloured opening, leaving the rest', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	document.documentElement.style.setProperty('--background-secondary', 'rgb(255, 255, 255)');
	rig.changeTheme(); await settle();
	const read = expectOk(await rig.geometry.read(rig.plan.id)), current = expectDefined(read.document.structure, 'structure');
	const walls = current.walls.map((wall, index) => index === 0 ? { ...wall, color: 'rose' as const } : wall);
	const openings = [{ id: 'opening-door', kind: 'door' as const, hostId: walls[0].id, offset: 500, width: 800, height: 2100, sill: 0, color: 'blue' as const }];
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...current, walls, openings } }, read.version));
	await rig.runtime.refreshProjection();
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	await settleUntil(() => layer.find('.wall-color').length === 1, 'coloured wall pass');
	const painted = layer.findOne<Konva.Line>('.wall-color') as Konva.Line;
	expect(painted.fill()).toBe('rgb(241, 212, 220)');
	const lines = layer.find<Konva.Shape>('Line');
	expect(lines.indexOf(painted)).toBeGreaterThan(Math.max(...layer.find('.wall-body').map(item => lines.indexOf(item as Konva.Shape))));
	const door = expectDefined(layer.findOne<Konva.Group>('.opening-door'), 'door symbol');
	expect((door.getChildren()[1] as Konva.Line).stroke()).toBe('#518cce');
});

it('keeps a patterned wall\'s hatch on its own tinted ground, and caches its tile per ground rather than per pattern', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	document.documentElement.style.setProperty('--background-secondary', 'rgb(255, 255, 255)');
	rig.changeTheme(); await settle();
	const read = expectOk(await rig.geometry.read(rig.plan.id)), current = expectDefined(read.document.structure, 'structure');
	const walls = current.walls.map(wall => wall.id === 'wall-a' ? { ...wall, color: 'rose' as const } : wall);
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...current, walls } }, read.version));
	await rig.runtime.refreshProjection();
	const brick = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Brick', unit: 'm2', planPattern: 'brick' }), 'absent')).entity;
	// wall-a (coloured rose) and wall-b (uncoloured) both get the brick material, so both draw
	// `.wall-pattern` and the cache is asked for the SAME pattern with two different grounds.
	const subjects = ['wall-a', 'wall-b'].map(targetId => ({ id: 'detail-' + targetId, targetId, kind: 'wall' as const, existing: { description: 'Brick', condition: 'good' as const, assetId: brick.id }, planned: { change: 'remove' as const, description: '' } }));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), { renovation: { ...EMPTY_RENOVATION, subjects }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); await rig.runtime.refreshProjection();
	await settleUntil(() => rig.runtime.planning.baseline.value?.catalogue.some(item => item.asset.id === brick.id) === true, 'catalogue read');
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	await settleUntil(() => layer.find('.wall-pattern').length === 2, 'pattern pass drawn for both walls');
	expect(layer.find('.wall-color')).toHaveLength(0);
	// wall-a precedes wall-b in the written structure, and `patterned` walks `structure.walls`
	// in that order, so the first `.wall-pattern` node is wall-a's (coloured) and the second is
	// wall-b's (plain).
	const [colouredTile, plainTile] = layer.find<Konva.Line>('.wall-pattern').map(item => item.fillPatternImage() as HTMLCanvasElement);
	// (10, 10) sits 3.5 px from brick's nearer stroke pair (x = 6.5, y = 6.5) and 9.5 px from
	// the farther pair (x = 0.5, y = 0.5) — pure ground, same margin itemColorRendering.test.ts
	// uses for stone's diagonal.
	// rose (#ce6682 = 206,102,130) tinted 0.72/0.28 over white (255,255,255):
	// 0.72*255 + 0.28*206 = 241.28 -> 241, 0.72*255 + 0.28*102 = 212.16 -> 212, 0.72*255 + 0.28*130 = 220.0 -> 220.
	expect([...(backingCanvas(colouredTile)?.getContext('2d').getImageData(10, 10, 1, 1).data ?? [])]).toEqual([241, 212, 220, 255]);
	expect([...(backingCanvas(plainTile)?.getContext('2d').getImageData(10, 10, 1, 1).data ?? [])]).toEqual([255, 255, 255, 255]);
	expect(colouredTile).not.toBe(plainTile);
});
