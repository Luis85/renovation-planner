import { expect, it } from 'vitest';
import type { Wall } from '../../../src/domain/spatial/Structure';
import { validWallFaceCurve } from '../../../src/domain/spatial/wallFaceGeometry';
import { wallHostClips, wallJunctions, wallCrossesHostClip } from '../../../src/domain/spatial/wallSideJunctions';
import { wallSideGeometryIssue, wallSideNetworkGeometry } from '../../../src/domain/spatial/wallSideNetwork';

const base: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150, sideExtents: { a: 100, b: 50 } };

it('bevels almost-parallel outgoing faces without an unstable infinite mitre', () => {
	const near = { ...base, id: 'wall-near', end: { x: 4000, y: 0.0000004 } };
	const geometry = wallSideNetworkGeometry([base, near]);
	expect(geometry.joins).toHaveLength(1); expect(geometry.joins[0].points).toHaveLength(3);
	expect(geometry.joins[0].points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.hypot(point.x, point.y) < 200)).toBe(true);
});

it('identifies the inside A face of a reversed curve and refuses a tangent curved T', () => {
	expect(validWallFaceCurve({ ...base, bulge: -0.5, thickness: 2600, sideExtents: { a: 2500, b: 100 } })).toBe(false);
	const west = { ...base, id: 'wall-west', end: { x: -4000, y: 0 } }, curve = { ...base, id: 'wall-curve', end: { x: 0, y: -4000 }, bulge: 1 };
	const walls = [base, west, curve], clips = wallHostClips(curve, wallJunctions(walls));
	expect(clips[0].tangent).toBe(true); expect(wallSideGeometryIssue(walls)).toEqual({ wallId: curve.id, kind: 'curved-junction' });
	expect(wallCrossesHostClip(curve, { point: base.start, normal: { x: 0, y: 1 }, distance: 6000 })).toBe(false);
});

it('accepts a curved T whose faces need no clipping by its wider host', () => {
	const east = { ...base, thickness: 6000, sideExtents: { a: 3000, b: 3000 } };
	const west = { ...east, id: 'wall-west', start: { x: -4000, y: 0 }, end: base.start };
	const stem = { ...base, id: 'wall-stem', start: { x: -3000, y: -3000 }, end: base.start, bulge: 0.1 };
	expect(wallSideGeometryIssue([west, east, stem])).toBeNull();
	expect(wallSideNetworkGeometry([west, east, stem]).bodies.find(body => body.id === stem.id)?.points.length).toBeGreaterThan(4);
});
