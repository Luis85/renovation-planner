// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { roomPinPosition } from '../../../src/presentation/editor/planning/roomPinPosition';
import { contains, rotate, translate } from '../../../src/core/geometry/operations';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';

const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
const room = { points, bulges: [0.5, 0, 0, 0] }, fractions = { x: 0.5, y: 0.125 };
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('decodes normalized fractions into the bulging region and preserves straight and world-AABB semantics', () => {
	const point = expectDefined(roomPinPosition(room, fractions), 'curved pin');
	expect(point.x).toBeCloseTo(2000); expect(point.y).toBeCloseTo(-500); expect(expectOk(contains(room, point))).toBe(true);
	expect(roomPinPosition({ points }, fractions)).toEqual({ x: 2000, y: 375 });
	expect(roomPinPosition({ points: [] }, fractions)).toBeNull();
	const moved = expectDefined(roomPinPosition(translate(room, { dx: 80, dy: 50 }), fractions), 'moved pin');
	expect(moved.x).toBeCloseTo(point.x + 80); expect(moved.y).toBeCloseTo(point.y + 50);
	// Fractions stay relative to the world bounds, not an implicitly introduced rotating frame.
	const turned = rotate(room, Math.PI / 2, { x: 0, y: 0 });
	const decoded = expectDefined(roomPinPosition(turned, fractions), 'turned world-bounds pin');
	expect(decoded.x).toBeCloseTo(-1000); expect(decoded.y).toBeCloseTo(500);
});

it('round-trips a photo pin in the curved region and carries it through Room translation and undo', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	await rig.runtime.curveTask.open(rig.room.id); rig.runtime.curveTask.set(0, 0.5); await rig.runtime.curveTask.finish(); await settle();
	const evidence: Evidence = { id: 'curved-photo', roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'scan.png', subpath: '', description: 'Curved bay', type: 'photo', phase: 'before', pin: fractions };
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence: [evidence] } }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle();
	const before = expectDefined(rig.stage.findOne<Konva.Group>('.evidence-pin'), 'curved pin').position();
	expect(before.x).toBeCloseTo(2000); expect(before.y).toBeCloseTo(-500);
	const shape = expectDefined(rig.project.zones.get(rig.room.id), 'Room');
	expectOk(await rig.runtime.dispatcher.run(new ReversibleMoveZoneCommand(rig.deps.commands.moveObject, rig.runtime.structureTask.ledger, rig.room.id, translate(shape, { dx: 80, dy: 50 }), shape)));
	await settle(); const moved = expectDefined(rig.stage.findOne<Konva.Group>('.evidence-pin'), 'moved pin').position();
	expect(moved.x).toBeCloseTo(before.x + 80); expect(moved.y).toBeCloseTo(before.y + 50);
	expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation?.depth?.evidence[0].pin).toEqual(fractions);
	await rig.runtime.undo(); await settle(); const restored = expectDefined(rig.stage.findOne<Konva.Group>('.evidence-pin'), 'restored pin').position();
	expect(restored.x).toBeCloseTo(before.x); expect(restored.y).toBeCloseTo(before.y);
});
