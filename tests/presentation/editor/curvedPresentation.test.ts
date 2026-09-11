import { expect, it, vi } from 'vitest';
import { roomEdges } from '../../../src/presentation/editor/resize/roomEdgeMeasurements';
import { roomDimensions } from '../../../src/presentation/editor/resize/roomDimensions';
import { rotationHandleGeometry, rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { layoutRotationControl } from '../../../src/presentation/editor/elements/rotationControl';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { curvedCandidateIntersection } from '../../../src/presentation/editor/selection/curvedCandidateIntersection';
import { spatialOutlinePoints } from '../../../src/presentation/editor/selection/spatialOutlinePoints';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { alongWall, wallLength } from '../../../src/domain/spatial/Structure';
import { boundsOfZones } from '../../../src/presentation/editor/viewport/zoneExtent';
import { expectDefined } from '../../helpers/domain';
import { ElementRotation, type RotationGestureDeps } from '../../../src/presentation/editor/elements/ElementRotation';
import { pointerAt, toolContext } from '../../helpers/tool-context';
import { roomSnapCandidates } from '../../../src/presentation/editor/snapping/roomSnapCandidates';
import { SnapService } from '../../../src/presentation/editor/snapping/snap-service';

const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
const room = { id: 'room', points, bulges: [0.5, 0, 0, 0] };
const wall = { id: 'wall-a', start: points[0], end: points[1], bulge: 0.5, thickness: 150, height: 2400 };

it('snaps Room creation to actual circular edges while leaving empty chord space unsnapped', () => {
	const snap = new SnapService({ gridSpacingMm: 100, toleranceMm: 8, angleStepRadians: Math.PI / 12 });
	const candidates = roomSnapCandidates([room], { walls: [wall], openings: [], boundaries: [] });
	const projected = snap.snapPoint({ x: 2000, y: -995 }, candidates);
	expect(projected.x).toBeCloseTo(2000); expect(projected.y).toBeCloseTo(-1000);
	const chord = { x: 2000, y: 0 }; expect(snap.snapPoint(chord, candidates)).toBe(chord);
	expect(snap.snapToEdge(chord, [{ start: chord, end: chord, bulge: 0.5 }])).toBeNull();
	expect(snap.snapPoint({ x: 1, y: 1 }, candidates)).toBe(points[0]);
});

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
	const top = expectDefined(layoutRotationControl(shape, pivot, 1), 'curve control');
	expect(top.edgeIndex).toBe(0);
	expect(top.anchor.y).toBeLessThan(0); expect(top.bounds.max.x - top.bounds.min.x).toBe(44);
	const straight = spatialOutlinePoints({ points }, 0.1); expect(straight).toBe(points);
});

it('selects curved polygons by enclosure, interior and closing-edge crossings without selecting remote boxes', () => {
	expect(curvedCandidateIntersection(room, { min: { x: -1, y: -1001 }, max: { x: 4001, y: 3001 } })).toBe(true);
	expect(curvedCandidateIntersection(room, { min: { x: 1950, y: -500 }, max: { x: 2050, y: -450 } })).toBe(true);
	expect(curvedCandidateIntersection(room, { min: { x: -10, y: 1000 }, max: { x: 10, y: 1100 } })).toBe(true);
	expect(curvedCandidateIntersection(room, { min: { x: -100, y: 1000 }, max: { x: -50, y: 1100 } })).toBe(false);
	expect(curvedCandidateIntersection({ id: 'empty', points: [] }, { min: { x: 0, y: 0 }, max: { x: 5, y: 5 } })).toBe(false);
	const object = { ...room, kind: 'object' as const };
	expect(curvedCandidateIntersection(object, { min: { x: 1000, y: 3000 }, max: { x: 1100, y: 3010 } })).toBe(true);
	expect(curvedCandidateIntersection({ id: 'straight', points }, { min: { x: -1, y: 1000 }, max: { x: 1, y: 1100 } })).toBe(true);
});

it('measures a curved candidate with no stated width against the bare tolerance', () => {
	// `nearLine` widens its tolerance by half a candidate's width; an arc that states none is
	// measured against the tolerance alone rather than against half of `undefined`.
	const curved = { id: 'wall-curved', kind: 'wall' as const, points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }], bulges: [0.5] };
	const at = (y: number) => resolveSelectionTarget({ candidates: [curved], selectedIds: [], worldPoint: { x: 1000, y }, handleToleranceWorld: 60 });
	// The arc bows 500 below its chord, so the chord's own midpoint is a miss and the apex a hit.
	expect(at(-500)).toEqual({ kind: 'body', id: 'wall-curved' });
	expect(at(0)).toBeNull();
	expect(at(500)).toBeNull();
});

it('freezes a curved shape at the press so a later edit cannot reach the running gesture', () => {
	const context = toolContext().context, previewRotation = vi.fn<NonNullable<RotationGestureDeps['previewRotation']>>();
	const curved = { id: 'room-curved', kind: 'room' as const, points: [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }], bulges: [0.25, 0, 0, 0] };
	const gesture = new ElementRotation({ previewRotation, commitRotation: vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>() });
	const control = expectDefined(rotationHandleGeometry(curved, 1), 'rotation control');
	gesture.start(context, pointerAt(control.handle.x, control.handle.y), curved, control);
	expect(gesture.active).toBe(true);
	// The gesture copied the bulge list rather than aliasing it: the caller's array is untouched.
	curved.bulges[0] = 0.9;
	gesture.move(context, pointerAt(control.handle.x + 40, control.handle.y + 40));
	expect(previewRotation).toHaveBeenCalled();
	gesture.cancel();
	expect(curved.bulges).toEqual([0.9, 0, 0, 0]);
});
