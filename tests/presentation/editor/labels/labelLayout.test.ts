import { describe, expect, it } from 'vitest';
import { assetLabelLayout, elementCaptionLayout, elementLabelLayout, measureLabelWidth, roomCaptionBounds, textLabelBounds } from '../../../../src/presentation/editor/labels/labelLayout';
import { captionBottom, captionOffsetY, captionPins, DETAIL_CAPTION_BOTTOM, roomCaptionAnchor } from '../../../../src/presentation/editor/layers/zone/captionPlacement';
import { elementFootprint } from '../../../../src/presentation/editor/elements/elementFootprint';
import { withElementPreviews } from '../../../../src/presentation/editor/elements/elementPreviews';
import type { NamedSpatialElement } from '../../../../src/domain/spatial/SpatialElement';

/** ADR-0029: every caption's drawn position and grab box are answered here, once. */
const path: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: 100, y: 500 }, { x: 900, y: 500 }] };
const square = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];

describe('element and asset name tags', () => {
	it('sit 18 screen px above their anchor and move by a dragged offset', () => {
		expect(elementLabelLayout(path, 0.5)).toEqual({ x: 100, y: 464, text: 'Garden path' });
		expect(elementLabelLayout({ ...path, labelOffset: { dx: 40, dy: -20 } }, 0.5)).toEqual({ x: 140, y: 444, text: 'Garden path' });
	});

	it('picks the asset layout for a placement and the element layout for everything else', () => {
		const asset = { ...path, kind: 'asset' as const, assetId: 'asset-a', points: [{ x: 100, y: 500 }, { x: 100, y: 900 }] };
		expect(elementCaptionLayout(asset, () => null, 1)).toEqual(assetLabelLayout(asset, elementFootprint(asset, () => null), 1));
		expect(elementCaptionLayout(path, () => null, 1)).toEqual(elementLabelLayout(path, 1));
	});

	it('names a measurement with its length', () => {
		expect(elementLabelLayout({ ...path, kind: 'measurement' }, 1)?.text).toMatch(/^Garden path · .+ m$/);
	});

	it('puts an asset tag above the footprint it draws, plus its offset', () => {
		const asset = { ...path, kind: 'asset' as const, assetId: 'asset-a', labelOffset: { dx: 10, dy: 0 } };
		expect(assetLabelLayout(asset, [{ x: 0, y: 300 }, { x: 50, y: 200 }], 1)).toEqual({ x: 110, y: 182, text: 'Garden path' });
	});

	it('bounds a tag by its measured width and one line of text, estimating where no canvas exists', () => {
		expect(textLabelBounds({ x: 100, y: 200, text: 'Sofa' }, 0.5, () => 30)).toEqual({ min: { x: 100, y: 200 }, max: { x: 160, y: 224 } });
		expect(measureLabelWidth('Sofa', 10)).toBeCloseTo(24);
	});
});

describe('room captions', () => {
	it('draw a dragged caption at anchor plus offset, ignoring the pins an automatic one clears', () => {
		const pins = [{ x: 500, y: 500, number: 1 }];
		const automatic = roomCaptionAnchor({ points: square }, 1, pins, [], { viewport: null, bottom: captionBottom(false) });
		expect(automatic).toEqual({ x: 500, y: 500 + captionOffsetY({ x: 500, y: 500 }, pins, 1) });
		expect(automatic.y).not.toBe(500);
		// A third caption line (a zone's detail plans, ADR-0028) clears obstacles with a taller block.
		expect(roomCaptionAnchor({ points: square }, 1, pins, [], { viewport: null, bottom: captionBottom(true) }).y).toBe(500 + captionOffsetY({ x: 500, y: 500 }, pins, 1, [], { bottom: DETAIL_CAPTION_BOTTOM }));
		expect(roomCaptionAnchor({ points: square, labelOffset: { dx: 50, dy: -70 } }, 1, pins, [], { viewport: null, bottom: captionBottom(true) })).toEqual({ x: 550, y: 430 });
		expect(roomCaptionBounds({ x: 500, y: 500 }, 2, captionBottom(false))).toEqual({ min: { x: 454.5, y: 488 }, max: { x: 545.5, y: 516 } });
		expect(roomCaptionBounds({ x: 500, y: 500 }, 2, captionBottom(true)).max.y).toBe(500 + DETAIL_CAPTION_BOTTOM / 2);
	});

	it('clear pins only while the session and the annotation layer both show them', () => {
		const pins = [{ x: 1, y: 2, number: 1 }];
		expect(captionPins(pins, true, true)).toBe(pins);
		expect(captionPins(pins, false, true)).toEqual([]);
		expect(captionPins(pins, true, false)).toEqual([]);
	});
});

describe('withElementPreviews', () => {
	it('moves only the dragged element caption', () => {
		const other = { ...path, id: 'element-other' };
		const shown = withElementPreviews([path, other], new Map([[path.id, path.name], [other.id, 'Other']]), null, null, { id: path.id, offset: { dx: 5, dy: 6 } });
		expect(shown.map(item => item.labelOffset)).toEqual([{ dx: 5, dy: 6 }, undefined]);
	});
});
