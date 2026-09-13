import { describe, expect, it } from 'vitest';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { beamOutline, postOutline } from '../../../src/domain/spatial/structuralElement';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { structureRecords } from '../../../src/presentation/editor/structure/structureRecords';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { spatialOutlinePoints } from '../../../src/presentation/editor/selection/spatialOutlinePoints';
import { roomSnapCandidates } from '../../../src/presentation/editor/snapping/roomSnapCandidates';
import { rotationPivot } from '../../../src/presentation/editor/elements/objectRotation';
import { hasPointHandles } from '../../../src/presentation/editor/elements/ElementMove';
import { acceptsElementPoints } from '../../../src/presentation/editor/elements/elementDraft';

const wall = { id: 'wall-frame', start: { x: 0, y: 1000 }, end: { x: 4000, y: 1000 }, height: 2500, thickness: 160 };
const post: SpatialElement = { id: 'element-post', kind: 'post', loadBearing: true, points: postOutline({ x: 2000, y: 1000 }, 140, 140) };
const beam: SpatialElement = { id: 'element-beam', kind: 'beam', loadBearing: true, width: 160, points: [{ x: 2000, y: 0 }, { x: 2000, y: 3000 }] };
const structure = { ...EMPTY_STRUCTURE, walls: [wall], elements: [post, beam] };

describe('posts and beams on the canvas', () => {
	it('hits a post standing in a wall before the wall, and a beam across its whole width', () => {
		const candidates = structureCandidates(structure);
		const at = (x: number, y: number) => resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 8 });
		expect(at(2050, 1040)).toEqual({ kind: 'body', id: post.id });
		expect(at(2070, 2500)).toEqual({ kind: 'body', id: beam.id });
		expect(at(1000, 1000)).toEqual({ kind: 'body', id: wall.id });
	});

	it('outlines a post as a closed shape and a beam as its band, in candidates and records alike', () => {
		const [postCandidate, beamCandidate] = structureCandidates(structure);
		expect(postCandidate.hitPoints).toBeUndefined();
		expect(spatialOutlinePoints(postCandidate, 0.25)).toEqual(spatialOutlinePoints({ ...postCandidate, kind: 'object' }, 0.25));
		expect(beamCandidate.hitPoints).toEqual(beamOutline(beam.points, 160));
		const records = structureRecords(structure, 'plan-a', [{ id: post.id, name: 'Post 1' }, { id: beam.id, name: 'Kitchen beam' }]);
		expect(records.find(item => item.id === post.id)?.areaMm2).toBe(19600);
		expect(records.find(item => item.id === beam.id)).toMatchObject({ name: 'Kitchen beam', hitPoints: beamOutline(beam.points, 160), areaMm2: 480000 });
	});

	it('snaps to a post outline including its closing edge, and gives a beam point handles but a post none', () => {
		const snap = roomSnapCandidates([], { ...EMPTY_STRUCTURE, elements: [post] });
		expect(snap.edges).toContainEqual({ start: post.points[3], end: post.points[0] });
		expect(hasPointHandles('beam')).toBe(true);
		expect(hasPointHandles('post')).toBe(false);
	});

	it('rotates a post about its centre and refuses a post outline that crosses itself', () => {
		expect(rotationPivot({ id: post.id, kind: 'post', points: post.points })).toEqual({ x: 2000, y: 1000 });
		expect(acceptsElementPoints(post, post.points)).toBe(true);
		expect(acceptsElementPoints(post, [post.points[0], post.points[2], post.points[1], post.points[3]])).toBe(false);
	});
});
