/**
 * The extent zoom-to-fit frames: the union of some zones' bounding boxes.
 *
 * Node, not jsdom. It reads `boundingBoxOf` from Core rather than comparing coordinates of
 * its own — a second implementation of "the box around these points" is exactly the kind of
 * duplicate derivation this project keeps collapsing back into one function.
 */
import { describe, expect, it } from 'vitest';
import { boundsOfZones } from '../../../src/presentation/editor/viewport/zoneExtent';

const SQUARE = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 100 },
];
const FAR = [
	{ x: 500, y: 400 },
	{ x: 700, y: 400 },
	{ x: 700, y: 600 },
];

describe('boundsOfZones', () => {
	it('answers null for no zones at all, so the caller keeps its camera', () => {
		expect(boundsOfZones([])).toBeNull();
	});

	it('boxes a single zone', () => {
		expect(boundsOfZones([{ points: SQUARE }])).toEqual({
			min: { x: 0, y: 0 },
			max: { x: 100, y: 100 },
		});
	});

	it('unions several, rather than answering about the first', () => {
		expect(boundsOfZones([{ points: SQUARE }, { points: FAR }])).toEqual({
			min: { x: 0, y: 0 },
			max: { x: 700, y: 600 },
		});
	});

	it('still frames a zone too degenerate to be a polygon', () => {
		// Two points do not close into a polygon, but they are somewhere — and a user asking
		// to frame the plan wants to SEE the malformed zone rather than have it silently
		// dropped from the view they are trying to get.
		expect(boundsOfZones([{ points: [{ x: 9, y: 9 }, { x: 20, y: 30 }] }])).toEqual({
			min: { x: 9, y: 9 },
			max: { x: 20, y: 30 },
		});
	});

	it('skips a zone with no points at all, rather than losing the whole extent', () => {
		// Failing the gesture over one unusable entry would deny the user the view of every
		// zone that is fine.
		expect(boundsOfZones([{ points: [] }, { points: FAR }])).toEqual({
			min: { x: 500, y: 400 },
			max: { x: 700, y: 600 },
		});
	});

	it('skips a zone whose coordinates are not finite', () => {
		// The other arm `boundingBoxOf` refuses. A NaN reaching the camera would put the
		// viewport itself beyond recovery, since every later pan composes on it.
		expect(boundsOfZones([{ points: [{ x: Number.NaN, y: 0 }, { x: 1, y: 1 }] }, { points: FAR }])).toEqual({
			min: { x: 500, y: 400 },
			max: { x: 700, y: 600 },
		});
	});

	it('answers null when every zone is refused', () => {
		expect(boundsOfZones([{ points: [] }])).toBeNull();
	});
});
