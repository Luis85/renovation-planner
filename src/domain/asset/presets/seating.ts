import { ok } from '../../../core/result/Result';
import { definePreset, frontClearance, rect, type AssetPreset } from './presetGeometry';

const SEAT_REACH_MM = 600;
const SOFA_REACH_MM = 450;

/** Backrest across the back, an arm each side, `cushions` seats between them. */
function upholstered(width: number, depth: number, cushions: number) {
	const arm = Math.min(150, width * 0.2), back = Math.min(200, depth * 0.25);
	const seatWidth = (width - 2 * arm) / cushions, seatDepth = depth - back, seatY = back / 2;
	return [
		{ name: 'backrest', outline: rect(width, back, 0, -depth / 2 + back / 2) },
		{ name: 'arm', outline: rect(arm, seatDepth, -width / 2 + arm / 2, seatY) },
		{ name: 'arm', outline: rect(arm, seatDepth, width / 2 - arm / 2, seatY) },
		...Array.from({ length: cushions }, (_, index) => ({
			name: 'cushion',
			outline: rect(seatWidth, seatDepth, -width / 2 + arm + seatWidth * (index + 0.5), seatY),
		})),
	];
}

export const SEATING_PRESETS: readonly AssetPreset[] = [
	definePreset('chair', 'seating', [
		{ key: 'width', kind: 'length', min: 350, max: 700, default: 450 },
		{ key: 'depth', kind: 'length', min: 350, max: 700, default: 500 },
	], (value) => {
		const width = value('width'), depth = value('depth');
		return ok({
			footprint: rect(width, depth),
			clearance: frontClearance(width, depth, SEAT_REACH_MM),
			details: [
				{ name: 'seat', outline: rect(width, depth * 0.8, 0, depth * 0.1) },
				{ name: 'backrest', outline: rect(width, depth * 0.2, 0, -depth * 0.4) },
			],
		});
	}),
	definePreset('armchair', 'seating', [
		{ key: 'width', kind: 'length', min: 600, max: 1200, default: 800 },
		{ key: 'depth', kind: 'length', min: 600, max: 1100, default: 800 },
	], (value) => ok({
		footprint: rect(value('width'), value('depth')),
		clearance: frontClearance(value('width'), value('depth'), SEAT_REACH_MM),
		details: upholstered(value('width'), value('depth'), 1),
	})),
	definePreset('sofa', 'seating', [
		{ key: 'width', kind: 'length', min: 1200, max: 3600, default: 2000 },
		{ key: 'depth', kind: 'length', min: 700, max: 1200, default: 900 },
		{ key: 'seats', kind: 'count', min: 1, max: 6, default: 3 },
	], (value) => ok({
		footprint: rect(value('width'), value('depth')),
		clearance: frontClearance(value('width'), value('depth'), SOFA_REACH_MM),
		details: upholstered(value('width'), value('depth'), value('seats')),
	})),
];
