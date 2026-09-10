import { expect, it } from 'vitest';
import { distance } from '../../../src/core/geometry/operations';
import { rotationPivot, rotationPoints, type RotationShape } from '../../../src/presentation/editor/elements/objectRotation';
import { layoutRotationControl } from '../../../src/presentation/editor/elements/rotationControl';
import { expectDefined } from '../../helpers/domain';

const group: RotationShape = { id: 'group-real', kind: 'group', visible: true, generation: 7,
	points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 1000 }, { x: 9000, y: 2000 }] };
it('uses the aggregate bounds centre for an explicit group and never treats disconnected members as a polygon', () => {
	const pivot = expectDefined(rotationPivot(group), 'group centre'); expect(pivot).toEqual({ x: 4500, y: 1000 });
	const control = expectDefined(layoutRotationControl(group, pivot, 1), 'group arrow');
	expect(control.anchor.x === 0 || control.anchor.x === 9000 || control.anchor.y === 0 || control.anchor.y === 2000).toBe(true);
	const points = expectDefined(rotationPoints(group, 90, pivot), 'group preview'); expect(points[0]).toEqual({ x: 5500, y: -3500 });
	points.forEach((point, index) => { expect(distance(point, pivot)).toBeCloseTo(distance(group.points[index], pivot), 8); });
	expect(group.kind).toBe('group'); expect(group.generation).toBe(7);
});
it('keeps hidden member geometry in the transform and refuses an empty group envelope', () => {
	const pivot = expectDefined(rotationPivot(group), 'group centre');
	expect(rotationPoints({ ...group, visible: false }, 37, pivot)).toEqual(rotationPoints(group, 37, pivot));
	expect(rotationPivot({ ...group, points: [] })).toBeNull();
	expect(layoutRotationControl({ ...group, points: [] }, pivot, 1)).toBeNull();
});
