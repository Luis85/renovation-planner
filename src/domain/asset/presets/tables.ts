import { ok } from '../../../core/result/Result';
import { circle, definePreset, incoherent, rect, ringSector, stadium, type AssetPreset } from './presetGeometry';

/** Room to pull a chair out on every side of a table. */
const CHAIR_ROOM_MM = 600;

export const TABLE_PRESETS: readonly AssetPreset[] = [
	definePreset('rect-table', 'tables', [
		{ key: 'width', kind: 'length', min: 400, max: 5000, default: 1600 },
		{ key: 'depth', kind: 'length', min: 400, max: 3000, default: 900 },
	], (value) => ok({
		footprint: rect(value('width'), value('depth')),
		clearance: rect(value('width') + 2 * CHAIR_ROOM_MM, value('depth') + 2 * CHAIR_ROOM_MM),
		details: [],
	})),
	definePreset('round-table', 'tables', [
		{ key: 'diameter', kind: 'length', min: 400, max: 3000, default: 900 },
	], (value) => ok({
		footprint: circle(value('diameter')),
		clearance: circle(value('diameter') + 2 * CHAIR_ROOM_MM),
		details: [],
	})),
	definePreset('oval-table', 'tables', [
		{ key: 'length', kind: 'length', min: 600, max: 5000, default: 1800 },
		{ key: 'width', kind: 'length', min: 400, max: 3000, default: 1000 },
	], (value) => ok({
		footprint: stadium(value('length'), value('width')),
		clearance: stadium(value('length') + 2 * CHAIR_ROOM_MM, value('width') + 2 * CHAIR_ROOM_MM),
		details: [],
	})),
	definePreset('curved-table', 'tables', [
		{ key: 'radius', kind: 'length', min: 500, max: 6000, default: 1500 },
		{ key: 'depth', kind: 'length', min: 300, max: 2000, default: 600 },
		{ key: 'sweep', kind: 'angle', min: 10, max: 180, default: 90 },
	], (value) => (value('depth') >= value('radius')
		? incoherent('A curved table must be shallower than its outer radius.')
		: ok({ footprint: ringSector(value('radius'), value('depth'), value('sweep')), clearance: null, details: [] }))),
];
