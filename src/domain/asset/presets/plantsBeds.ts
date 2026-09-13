import { ok } from '../../../core/result/Result';
import { circle, definePreset, incoherent, lobed, rect, type AssetPreset } from './presetGeometry';

const BED_SIDE_MM = 600;
const PILLOW_DEPTH_MM = 180;
const PILLOW_MARGIN_MM = 60;

export const PLANT_AND_BED_PRESETS: readonly AssetPreset[] = [
	definePreset('tree', 'plants-beds', [
		{ key: 'canopy', kind: 'length', min: 1000, max: 15000, default: 3000 },
		{ key: 'trunk', kind: 'length', min: 100, max: 1000, default: 300 },
	], (value) => (value('trunk') * 2 >= value('canopy')
		? incoherent('A trunk must be less than half as wide as its canopy.')
		: ok({
			footprint: circle(value('canopy')),
			clearance: null,
			details: [
				{ name: 'canopy', outline: lobed(value('canopy'), 8) },
				{ name: 'trunk', outline: circle(value('trunk')) },
			],
		}))),
	definePreset('shrub', 'plants-beds', [
		{ key: 'diameter', kind: 'length', min: 300, max: 4000, default: 1000 },
	], (value) => ok({
		footprint: circle(value('diameter')),
		clearance: null,
		details: [{ name: 'outline', outline: lobed(value('diameter'), 6) }],
	})),
	definePreset('bed', 'plants-beds', [
		{ key: 'width', kind: 'length', min: 800, max: 2200, default: 1600 },
		{ key: 'length', kind: 'length', min: 1800, max: 2200, default: 2000 },
		{ key: 'pillows', kind: 'count', min: 1, max: 2, default: 2 },
	], (value) => {
		const width = value('width'), length = value('length'), pillows = value('pillows');
		const pillowWidth = (width - PILLOW_MARGIN_MM * (pillows + 1)) / pillows;
		return ok({
			footprint: rect(width, length),
			clearance: rect(width + 2 * BED_SIDE_MM, length + BED_SIDE_MM, 0, BED_SIDE_MM / 2),
			details: [
				...Array.from({ length: pillows }, (_, index) => ({
					name: 'pillow',
					outline: rect(pillowWidth, PILLOW_DEPTH_MM,
						-width / 2 + PILLOW_MARGIN_MM + pillowWidth / 2 + index * (pillowWidth + PILLOW_MARGIN_MM),
						-length / 2 + PILLOW_MARGIN_MM + PILLOW_DEPTH_MM / 2),
				})),
				{ name: 'duvet', outline: rect(width, length * 0.7, 0, length * 0.15) },
			],
		});
	}),
];
