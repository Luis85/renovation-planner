import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../../src/core/geometry/operations';
import { dimensionsOf, validateAssetShape } from '../../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues, type AssetPreset, type PresetValues } from '../../../../src/domain/asset/presets/presetGeometry';
import { expectErr, expectOk } from '../../../helpers/domain';
import { closedOutlineOf } from '../../../helpers/assetShapes';

/** Spec 2026-09-13 Decision 8's table-driven check, over every preset the catalogue holds. */
const EPSILON = 1e-6;
const at = (preset: AssetPreset, pick: 'min' | 'max'): PresetValues => Object.fromEntries(preset.fields.map((field) => [field.key, field[pick]]));
const v = (values: PresetValues, key: keyof PresetValues): number => values[key] ?? Number.NaN;

/** The bounding box each preset's typed fields promise, per the axis conventions in the plan. */
function typedExtent(preset: AssetPreset, values: PresetValues): readonly [number, number] {
	switch (preset.id) {
		case 'round-table': return [v(values, 'diameter'), v(values, 'diameter')];
		case 'shrub': return [v(values, 'diameter'), v(values, 'diameter')];
		case 'tree': return [v(values, 'canopy'), v(values, 'canopy')];
		case 'oval-table': return [v(values, 'length'), v(values, 'width')];
		case 'bathtub': return [v(values, 'length'), v(values, 'width')];
		case 'bed': return [v(values, 'width'), v(values, 'length')];
		case 'curved-table': {
			const radius = v(values, 'radius'), half = (v(values, 'sweep') * Math.PI) / 360;
			return [2 * radius * Math.sin(half), radius - (radius - v(values, 'depth')) * Math.cos(half)];
		}
		default: return [v(values, 'width'), v(values, 'depth')];
	}
}

describe.each(ASSET_PRESETS.map((preset) => [preset.id, preset] as const))('preset %s', (_id, preset) => {
	it.each(['default', 'min', 'max'] as const)('builds a valid typed shape at its %s values', (which) => {
		const values = which === 'default' ? defaultValues(preset) : at(preset, which);
		const shape = expectOk(preset.build(values));

		expect(validateAssetShape(shape).ok).toBe(true);
		expect([shape.footprintOrigin, shape.footprintPending]).toEqual(['typed', false]);
		expect(shape.facing).toBeCloseTo(Math.PI / 2, 12);
		const { width, depth } = expectOk(dimensionsOf(shape.footprint));
		const [expectedWidth, expectedDepth] = typedExtent(preset, values);
		expect(width).toBeCloseTo(expectedWidth, 6);
		expect(depth).toBeCloseTo(expectedDepth, 6);
		const outer = expectOk(boundingBoxOf(shape.footprint));
		for (const detail of shape.details) {
			const box = expectOk(boundingBoxOf(closedOutlineOf(detail)));
			expect(box.min.x).toBeGreaterThanOrEqual(outer.min.x - EPSILON);
			expect(box.min.y).toBeGreaterThanOrEqual(outer.min.y - EPSILON);
			expect(box.max.x).toBeLessThanOrEqual(outer.max.x + EPSILON);
			expect(box.max.y).toBeLessThanOrEqual(outer.max.y + EPSILON);
		}
	});

	it('refuses a value above its range', () => {
		const [field] = preset.fields;
		expect(expectErr(preset.build({ ...defaultValues(preset), [field.key]: field.max + 1 })).code).toBe('asset.preset-value-out-of-range');
	});
});

describe('preset refusals that are not ranges', () => {
	it('refuses a curved table as deep as its radius', () => {
		const curved = ASSET_PRESETS.find((preset) => preset.id === 'curved-table');
		expect(curved && expectErr(curved.build({ radius: 600, depth: 600, sweep: 90 })).code).toBe('asset.preset-incoherent');
	});

	it('refuses a fractional seat count', () => {
		const sofa = ASSET_PRESETS.find((preset) => preset.id === 'sofa');
		expect(sofa && expectErr(sofa.build({ width: 2000, depth: 900, seats: 2.5 })).code).toBe('asset.preset-value-out-of-range');
	});

	it('refuses a value that is missing, or not a finite number', () => {
		const [preset] = ASSET_PRESETS;
		const [field] = preset.fields;
		expect(expectErr(preset.build({ ...defaultValues(preset), [field.key]: undefined })).code).toBe('asset.preset-value-out-of-range');
		expect(expectErr(preset.build({ ...defaultValues(preset), [field.key]: Number.POSITIVE_INFINITY })).code).toBe('asset.preset-value-out-of-range');
	});

	it('refuses a tree whose trunk is half its canopy or more', () => {
		const tree = ASSET_PRESETS.find((preset) => preset.id === 'tree');
		expect(tree && expectErr(tree.build({ canopy: 1000, trunk: 500 })).code).toBe('asset.preset-incoherent');
	});

	it('offers all fifteen presets', () => {
		expect(ASSET_PRESETS.map((preset) => preset.id)).toEqual([
			'rect-table', 'round-table', 'oval-table', 'curved-table',
			'chair', 'armchair', 'sofa',
			'toilet', 'washbasin', 'vanity', 'shower-tray', 'bathtub',
			'tree', 'shrub', 'bed',
		]);
	});

	/**
	 * AD18-R8's two dimension claims, which are otherwise only prose: board 01's default, and a range
	 * wide enough for `previous-expansion-concept.md` §11's 1,000 × 500 walk to be typed into it.
	 * The parts come with it — the carcass is dashed because it sits under the countertop.
	 */
	it('builds the vanity at board 01’s default and at the scenario’s 1,000 × 500', () => {
		const [vanity] = ASSET_PRESETS.filter((preset) => preset.id === 'vanity');
		expect(defaultValues(vanity)).toEqual({ width: 800, depth: 450 });

		const scenario = expectOk(vanity.build({ width: 1000, depth: 500 }));
		const { width, depth } = expectOk(dimensionsOf(scenario.footprint));
		expect(width).toBeCloseTo(1000, 6);
		expect(depth).toBeCloseTo(500, 6);
		expect(scenario.details.map((detail) => [detail.name, detail.line])).toEqual([
			['cabinet', 'dashed'], ['basin', 'solid'], ['tap-hole', 'solid'],
		]);

		// The countertop IS the footprint, so the carcass under it is inset at the sides and the
		// front and flush at the back (−y), where the wall is.
		const [cabinet] = scenario.details;
		const carcass = expectOk(boundingBoxOf(closedOutlineOf(cabinet)));
		const top = expectOk(boundingBoxOf(scenario.footprint));
		expect([carcass.min.x - top.min.x, top.max.x - carcass.max.x]).toEqual([20, 20]);
		expect([carcass.min.y - top.min.y, top.max.y - carcass.max.y]).toEqual([0, 20]);
	});
});
