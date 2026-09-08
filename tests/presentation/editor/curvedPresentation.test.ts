import { expect, it } from 'vitest';
import { roomEdges } from '../../../src/presentation/editor/resize/roomEdgeMeasurements';
import { roomDimensions } from '../../../src/presentation/editor/resize/roomDimensions';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { layoutRotationControls } from '../../../src/presentation/editor/elements/rotationControl';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { curvedCandidateIntersection } from '../../../src/presentation/editor/selection/curvedCandidateIntersection';
import { spatialOutlinePoints } from '../../../src/presentation/editor/selection/spatialOutlinePoints';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { alongWall, wallLength } from '../../../src/domain/spatial/Structure';
import { boundsOfZones } from '../../../src/presentation/editor/viewport/zoneExtent';
import { expectDefined } from '../../helpers/domain';

const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
const room = { id: 'room', points, bulges: [0.5, 0, 0, 0] };
const wall = { id: 'wall-a', start: points[0], end: points[1], bulge: 0.5, thickness: 150, height: 2400 };

it('keeps actual curved edge lengths and centroid through rotation without offering rectangular scaling', () => {
	const edges = roomEdges(points, true, true, room.bulges);
	expect(edges).toHaveLength(4); expect(edges[0].length).toBeCloseTo(wallLength(wall));
	expect(edges[0].midpoint.x).toBeCloseTo(2000); expect(edges[0].midpoint.y).toBeCloseTo(-1000); expect(roomDimensions(points, room.bulges)).toBeNull();
	const shape = { ...room, kind: 'room' as const }, pivot = expectDefined(rotationPivot(shape), 'curved centroid');
	expect(pivot.y).toBeLessThan(1500);
	const turned = expectDefined(rotationPoints(shape, 37, pivot), 'turned curve');
	roomEdges(turned, true, false, room.bulges).forEach((edge, index) => expect(edge.length).toBeCloseTo(edges[index].length));
	expect(boundsOfZones([room])?.min.y).toBeCloseTo(-1000);
});

it('hits curved Room interiors and hosted opening arcs with the same analytic source geometry', () => {
	const structure = { walls: [wall], boundaries: [], openings: [{ id: 'opening-a', kind: 'door' as const, hostId: wall.id, offset: 1500, width: 900, height: 2100, sill: 0 }] };
	const at = alongWall(wall, 1900), candidates = [room, ...structureCandidates(structure)];
	expect(resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: at, handleToleranceWorld: 10 })).toEqual({ kind: 'body', id: 'opening-a' });
	expect(resolveSelectionTarget({ candidates: [room], selectedIds: [], worldPoint: { x: 2000, y: -500 }, handleToleranceWorld: 10 })).toEqual({ kind: 'body', id: 'room' });
	const candidate = expectDefined(structureCandidates(structure).find(item => item.id === wall.id), 'wall');
	expect(curvedCandidateIntersection(candidate, { min: { x: 1999.999, y: -1000.001 }, max: { x: 2000.001, y: -999.999 } })).toBe(true);
	expect(curvedCandidateIntersection(candidate, { min: { x: 1999, y: -500 }, max: { x: 2001, y: -499 } })).toBe(false);
	expect(spatialOutlinePoints(candidate, 0.1).length).toBeGreaterThan(2);
});

it('places hover rotation anchors on actual curved edges, retaining generous hit rectangles', () => {
	const shape = { ...room, kind: 'room' as const }, pivot = expectDefined(rotationPivot(shape), 'pivot');
	const controls = layoutRotationControls(shape, pivot, 1);
	const top = expectDefined(controls.find(control => control.edgeIndex === 0), 'curve control');
	expect(top.anchor.y).toBeLessThan(0); expect(top.bounds.max.x - top.bounds.min.x).toBe(44);
	const straight = spatialOutlinePoints({ points }, 0.1); expect(straight).toBe(points);
});
