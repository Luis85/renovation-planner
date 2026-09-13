import { ok } from '../../../core/result/Result';
import { circle, definePreset, frontClearance, rect, roundFront, stadium, type AssetPreset, type PresetDrawing } from './presetGeometry';

/** Standing room in front of a fitting, and to each side of a toilet. */
const FRONT_REACH_MM = 600;
const TOILET_SIDE_MM = 200;
const BATH_RIM_MM = 80;

/** A rectangular fitting's footprint and front clearance; each caller supplies its own details. */
const rectFitting = (width: number, depth: number, details: PresetDrawing['details']) =>
	ok({ footprint: rect(width, depth), clearance: frontClearance(width, depth, FRONT_REACH_MM), details });

export const SANITARY_PRESETS: readonly AssetPreset[] = [
	definePreset('toilet', 'sanitary', [
		{ key: 'width', kind: 'length', min: 300, max: 500, default: 380 },
		{ key: 'depth', kind: 'length', min: 500, max: 900, default: 700 },
	], (value) => {
		const width = value('width'), depth = value('depth'), tank = Math.min(200, depth * 0.3);
		return ok({
			footprint: roundFront(width, depth),
			clearance: rect(width + 2 * TOILET_SIDE_MM, depth + FRONT_REACH_MM, 0, FRONT_REACH_MM / 2),
			details: [
				{ name: 'tank', outline: rect(width, tank, 0, -depth / 2 + tank / 2) },
				{ name: 'bowl', outline: stadium(width * 0.8, (depth - tank) * 0.9, 0, -depth / 2 + tank + (depth - tank) / 2) },
			],
		});
	}),
	definePreset('washbasin', 'sanitary', [
		{ key: 'width', kind: 'length', min: 350, max: 1200, default: 600 },
		{ key: 'depth', kind: 'length', min: 300, max: 650, default: 450 },
	], (value) => {
		const width = value('width'), depth = value('depth');
		return rectFitting(width, depth, [
			{ name: 'basin', outline: stadium(width * 0.7, depth * 0.6, 0, depth * 0.1) },
			{ name: 'tap-hole', outline: circle(Math.min(40, width * 0.1), 0, -depth * 0.35) },
		]);
	}),
	definePreset('shower-tray', 'sanitary', [
		{ key: 'width', kind: 'length', min: 700, max: 1800, default: 900 },
		{ key: 'depth', kind: 'length', min: 700, max: 1800, default: 900 },
	], (value) => {
		const width = value('width'), depth = value('depth');
		return rectFitting(width, depth, [{ name: 'drain', outline: circle(Math.min(100, Math.min(width, depth) * 0.15)) }]);
	}),
	definePreset('bathtub', 'sanitary', [
		{ key: 'length', kind: 'length', min: 1200, max: 2200, default: 1700 },
		{ key: 'width', kind: 'length', min: 600, max: 1000, default: 750 },
	], (value) => {
		const length = value('length'), width = value('width');
		return ok({
			footprint: rect(length, width),
			clearance: frontClearance(length, width, FRONT_REACH_MM),
			details: [
				{ name: 'basin', outline: stadium(length - 2 * BATH_RIM_MM, width - 2 * BATH_RIM_MM) },
				{ name: 'drain', outline: circle(60, length / 2 - BATH_RIM_MM - 100, 0) },
			],
		});
	}),
];
