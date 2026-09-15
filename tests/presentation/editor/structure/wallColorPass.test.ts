// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { expectDefined, expectOk } from '../../../helpers/domain';

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
