/**
 * Which rows the canvas legend earns from a design (AD18-R16 Task 4) — pure arithmetic over
 * `AssetShape`, with no camera, no store and no `.vue` file. The mounted half — that these rows
 * reach the DOM in board order and read the right host variables — is `designerLegend.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { legendRows } from '../../../../src/presentation/designer/legend/legendRows';
import { editableShape } from '../../../helpers/assetShapes';

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
			'designer.legend.placement-point',
			'designer.legend.front-direction',
		]);
	});
});
