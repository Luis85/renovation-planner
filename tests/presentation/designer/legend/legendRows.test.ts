/**
 * Which rows the canvas legend earns from a design (AD18-R16 Task 4) and what each row says about
 * THIS design (AD18-R17 Task 6) — pure arithmetic over `AssetShape`, with no camera, no store and no
 * `.vue` file. The mounted half — that these rows reach the DOM in board order and read the right
 * host variables — is `designerLegend.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { circle, rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { legendRows } from '../../../../src/presentation/designer/legend/legendRows';
import { t } from '../../../../src/presentation/i18n/strings';
import { editableShape } from '../../../helpers/assetShapes';

/** A row's text as the legend draws it, in English. */
function said(shape: AssetShape, kind: string): string {
	const row = legendRows(shape).find((candidate) => candidate.kind === kind);
	if (row === undefined) throw new Error(`no ${kind} row`);
	return t('en', row.label, row.params);
}

describe('which rows a design earns for the canvas legend', () => {
	it('earns none at all for a design nobody has traced yet', () => {
		expect(legendRows(null)).toEqual([]);
	});

	it('lists clearance, footprint, details, placement point and front direction in board order for a full design', () => {
		expect(legendRows(editableShape()).map((row) => row.kind)).toEqual(['clearance', 'footprint', 'details', 'placement', 'facing']);
	});

	it('drops the clearance row for a design with none, keeping the other four', () => {
		expect(legendRows(editableShape({ clearance: null })).map((row) => row.kind)).toEqual(['footprint', 'details', 'placement', 'facing']);
	});

	it('drops the details row for a design with none, keeping the other four', () => {
		expect(legendRows(editableShape({ details: [] })).map((row) => row.kind)).toEqual(['clearance', 'footprint', 'placement', 'facing']);
	});

	it('draws only footprint, placement point and front direction for a design with neither clearance nor details', () => {
		expect(legendRows(editableShape({ clearance: null, details: [] })).map((row) => row.kind)).toEqual(['footprint', 'placement', 'facing']);
	});

	it('resolves each row to its own locale key', () => {
		expect(legendRows(editableShape()).map((row) => row.label)).toEqual([
			'designer.legend.clearance',
			'designer.legend.footprint',
			'designer.legend.details',
			'designer.legend.placement-point.centre',
			'designer.legend.front-direction',
		]);
	});
});

/**
 * AD18-R17: `Clearance (300 mm)` only when the four sides agree, because a single figure over an
 * asymmetric boundary would be a false measurement (C07). The footprint is 1000 x 600 centred on
 * the origin throughout.
 */
describe('the clearance row’s figure', () => {
	it('names the setback when the clearance is the footprint grown by one amount on all four sides', () => {
		expect(said(editableShape({ clearance: rect(1600, 1200) }), 'clearance')).toBe('Clearance (300 mm)');
	});

	it('names no figure when the four sides differ', () => {
		// The fixture's own clearance: 200 on each side, 0 behind and 400 in front along y.
		expect(said(editableShape(), 'clearance')).toBe('Clearance');
	});

	it('names no figure when the near sides agree and a far side does not', () => {
		// x -800..900 by y -600..600: 300 off the left, the back and the front, but 400 off the right.
		expect(said(editableShape({ clearance: rect(1700, 1200, 50, 0) }), 'clearance')).toBe('Clearance');
	});

	it('names no figure for a setback that would round to 0 mm', () => {
		expect(said(editableShape({ clearance: rect(1000.6, 600.6) }), 'clearance')).toBe('Clearance');
	});

	it('names no figure when the clearance is not a rectangle, even one centred on the footprint', () => {
		expect(said(editableShape({ clearance: circle(2000) }), 'clearance')).toBe('Clearance');
	});

	it('names no figure when the footprint is not a rectangle', () => {
		expect(said(editableShape({ footprint: circle(1000), details: [], clearance: rect(1600, 1600) }), 'clearance')).toBe('Clearance');
	});

	it('names no figure for a clearance that sits exactly on the footprint', () => {
		expect(said(editableShape({ clearance: rect(1000, 600) }), 'clearance')).toBe('Clearance');
	});

	it('names no figure while either outline is still in sheet pixels, since the difference is no millimetre', () => {
		expect(said(editableShape({ clearance: rect(1600, 1200), clearancePending: true }), 'clearance')).toBe('Clearance');
		expect(said(editableShape({ clearance: rect(1600, 1200), footprintPending: true, footprintOrigin: 'traced' }), 'clearance')).toBe('Clearance');
	});

	it('rounds the figure the way the canvas dimensions do', () => {
		expect(said(editableShape({ clearance: rect(1000 + 2 * 299.6, 600 + 2 * 299.6) }), 'clearance')).toBe('Clearance (300 mm)');
	});
});

/**
 * AD18-R17: `Placement point (back centre | centre | custom)` from `currentAnchorPreset`, the one
 * predicate `DesignerReferencePlacement`'s segment reads for its pressed state. Facing +x, so the
 * back centre is the middle of the footprint's -x edge.
 */
describe('the placement point row’s detail', () => {
	it('says back centre for an anchor on the back edge’s middle', () => {
		expect(said(editableShape({ anchor: { x: -500, y: 0 } }), 'placement')).toBe('Placement point (back centre)');
	});

	it('says centre for an anchor in the middle', () => {
		expect(said(editableShape(), 'placement')).toBe('Placement point (centre)');
	});

	it('says custom for any other point', () => {
		expect(said(editableShape({ anchor: { x: 100, y: 100 } }), 'placement')).toBe('Placement point (custom)');
	});
});
