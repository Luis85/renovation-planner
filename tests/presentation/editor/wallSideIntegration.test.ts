// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { structureEditor } from '../../helpers/structureEditor';
import { renovationStack } from '../../helpers/renovation';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { applyPlannedGeometry, plannedGeometryDraft } from '../../../src/presentation/editor/renovation/plannedGeometry';
import { validateStructure } from '../../../src/domain/spatial/structureGeometry';
import { wallLength, type Structure, type Wall } from '../../../src/domain/spatial/Structure';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it.each([false, true])('preserves depth difference when a planned total edit restores a missing wall=%s', async missing => {
	const rig = await renovationStack(), read = expectOk(await rig.geometry.read(rig.plan.id)), current = expectDefined(read.document.structure, 'walls');
	const structure = { ...current, walls: current.walls.map((wall, index) => index === 0 ? { ...wall, sideExtents: { a: 120, b: 30 } } : wall) };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure }, read.version));
	const baseline = expectOk(await rig.read()), wall = structure.walls[0];
	const subject = { ...rig.value.subjects[0], targetId: wall.id, kind: 'wall' as const, planned: { change: 'modify' as const, description: 'Restore wall' } };
	const input = { renovation: { subjects: [subject], work: [], decisions: [] }, intended: { ...structure, walls: missing ? structure.walls.slice(1) : structure.walls, boundaries: [] } };
	const draft = plannedGeometryDraft(baseline, subject); draft.text.thickness = '0.25';
	const result = expectOk(applyPlannedGeometry(baseline, input, subject, draft)), next = expectDefined(result.intended?.walls.find(item => item.id === wall.id), 'restored wall');
	expect(next.sideExtents).toEqual({ a: 170, b: 80 }); expect(next.thickness).toBe(250);
	expect(next.start).toEqual(wall.start); expect(next.end).toEqual(wall.end); expect(wall.sideExtents).toEqual({ a: 120, b: 30 });
	expect(validateStructure(expectDefined(result.intended, 'intended'), []).ok).toBe(true);
	draft.text.thickness = '0.08';
	const invalid = expectOk(applyPlannedGeometry(baseline, input, subject, draft));
	expect(validateStructure(expectDefined(invalid.intended, 'invalid intended'), []).ok).toBe(false);
});

it('clips a symmetric stem opening to an asymmetric host and follows its far-face preview', async () => {
	const rig = await structureEditor(); mounted.push(rig);
	const east: Wall = { id: 'wall-east', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 110, sideExtents: { a: 100, b: 10 } };
	const west = { ...east, id: 'wall-west', start: { x: -4000, y: 0 }, end: east.start };
	const stem = { ...east, id: 'wall-stem', start: { x: -3000, y: -3000 }, end: east.start, thickness: 150, sideExtents: { a: 75, b: 75 } };
	const opening = { id: 'opening-junction', kind: 'opening' as const, hostId: stem.id, offset: wallLength(stem) - 1000, width: 1000, height: 2100, sill: 0 };
	const structure: Structure = { walls: [east, west, stem], openings: [opening], boundaries: [] }, before = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure }, before.version)); await rig.runtime.refreshProjection(); await settle();
	const frame = () => {
		const lines = expectDefined(rig.stage.findOne<Konva.Group>('.opening-junction'), 'opening symbol').find<Konva.Line>('Line');
		return { polygonMask: lines[0].closed(), farFrame: Math.max(...lines.slice(1).flatMap(line => line.points().filter((_value, index) => index % 2 === 1))) };
	};
	expect(frame().polygonMask).toBe(true); expect(frame().farFrame).toBeCloseTo(10, 7);
	rig.selection.select([east.id as never]); await rig.runtime.structureActions.thickness.begin(east.id, 'adjust'); rig.runtime.structureActions.thickness.increment('b', 1); await settle();
	// A stepped host uses the shallower far face until both host halves reach the new depth.
	expect(frame().farFrame).toBeCloseTo(10, 7); expect(rig.runtime.structureActions.preview.value?.walls[1].sideExtents?.b).toBe(10);
	await rig.runtime.structureActions.thickness.apply(); await settle();
	rig.selection.select([west.id as never]); await rig.runtime.structureActions.thickness.begin(west.id, 'adjust'); rig.runtime.structureActions.thickness.increment('b', 1); await settle();
	expect(frame().farFrame).toBeCloseTo(20, 7); expect(rig.runtime.structureActions.preview.value?.openings).toEqual([opening]);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.openings).toEqual([opening]);
});
