import { describe, expect, it, vi } from 'vitest';
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

	it('measures a bold line in a bold font, and makes one canvas even where it has no 2D context', async () => {
		const fonts: string[] = [];
		const drawing = { set font(value: string) { fonts.push(value); }, measureText: (text: string) => ({ width: text.length }) };
		for (const context of [drawing, null]) {
			const createEl = vi.fn<() => { getContext: () => typeof context }>(() => ({ getContext: () => context }));
			vi.stubGlobal('createEl', createEl); vi.resetModules();
			try {
				const fresh = await import('../../../../src/presentation/editor/labels/labelLayout');
				fresh.measureLabelWidth('Kitchen', 16, true); fresh.measureLabelWidth('Kitchen', 14);
				expect(createEl).toHaveBeenCalledTimes(1);
			} finally { vi.unstubAllGlobals(); }
		}
		expect(fonts).toEqual(['bold 16px Arial', '14px Arial']);
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
	});

	it('are grabbed by their widest drawn line, capped at the 180 px text box, from the name top to the last line', () => {
		const measure = vi.fn<(text: string, fontPx: number, bold?: boolean) => number>(text => text === 'Kitchen' ? 100 : text.startsWith('▸') ? 400 : 60);
		const box = (detail: string | null) => {
			const { min, max } = roomCaptionBounds({ x: 500, y: 500 }, 2, { label: 'Kitchen', areaMm2: 12e6, detail }, measure);
			return [min.x, min.y, max.x, max.y].map(value => Number(value.toFixed(6)));
		};
		// The bold 16 px name (22.4 px above the anchor) over the 14 px area line (ending 14 px below it).
		expect(box(null)).toEqual([475, 488.8, 525, 507]);
		expect(measure).toHaveBeenCalledWith('Kitchen', 16, true);
		// A 12 px detail-plans line ends 32.2 px below the anchor, and no line is drawn wider than 180 px.
		expect(box('▸ Upper floor')).toEqual([455, 488.8, 545, 516.1]);
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
