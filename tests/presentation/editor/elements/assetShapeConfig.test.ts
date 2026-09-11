import { describe, expect, it } from 'vitest';
import { expectOk } from '../../../helpers/domain';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { placementPoints } from '../../../../src/domain/spatial/assetPlacement';
import { assetShapeConfig } from '../../../../src/presentation/editor/elements/assetShapeConfig';
import type { ThemeTokens } from '../../../../src/presentation/editor/theme/themeTokens';

const tokens = { canvasBackground: 'bg', zoneStroke: 'ink', zoneLabel: 'label', zoneCaption: 'muted', accent: 'accent' } as ThemeTokens;
const base = expectOk(shapeFromDimensions(800, 600));
const shape = { ...base, clearance: { points: [{ x: -600, y: -500 }, { x: 600, y: -500 }, { x: 600, y: 500 }, { x: -600, y: 500 }] } };
const element = { id: 'element-radiator', kind: 'asset' as const, assetId: 'asset-radiator', name: 'Radiator', points: placementPoints({ x: 1000, y: 1000 }, 0) };
const state = { selected: false, hovered: false, tokens, zoom: 1 };

describe('assetShapeConfig', () => {
	it('draws a closed footprint with a facing tick and no clearance at rest', () => {
		const config = assetShapeConfig(element, () => shape, state);
		expect(config.footprint).toMatchObject({ name: 'asset-footprint', closed: true, stroke: 'ink', points: [600, 700, 1400, 700, 1400, 1300, 600, 1300] });
		expect(config.tick.points).toEqual([1000, 1000, 1016, 1000]);
		expect(config.clearance).toBeNull();
		expect(config.cross).toBeNull();
	});
	it('shows the clearance while selected or hovered, in the accent when selected', () => {
		expect(assetShapeConfig(element, () => shape, { ...state, hovered: true }).clearance).toMatchObject({ name: 'asset-clearance', closed: true });
		expect(assetShapeConfig(element, () => shape, { ...state, selected: true }).footprint.stroke).toBe('accent');
	});
	it('draws a dashed, crossed placeholder when the shape is unknown', () => {
		const config = assetShapeConfig(element, () => null, state);
		expect(config.footprint).toMatchObject({ name: 'asset-placeholder', points: [750, 750, 1250, 750, 1250, 1250, 750, 1250] });
		expect(config.footprint.dash).toEqual([6, 4]);
		expect(config.cross).toEqual([[750, 750, 1250, 1250], [1250, 750, 750, 1250]]);
	});
});
