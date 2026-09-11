/**
 * The side panels' layout arithmetic (2026-09-12 side panels spec §1), asked of pure functions.
 * Node, not jsdom: nothing here touches a DOM.
 */
import { describe, expect, it } from 'vitest';
import {
	CANVAS_FLOOR_PX,
	PANEL_BOUNDS,
	STRIP_PX,
	clampPanelWidth,
	defaultPanelLayout,
	effectivePanelWidths,
	maxPanelWidth,
	parsePanelLayout,
} from '../../../../src/presentation/editor/shell/panelLayout';

describe('panel layout defaults and parsing', () => {
	it('opens both panels expanded at their default widths', () => {
		expect(defaultPanelLayout()).toEqual({
			layers: { width: 256, collapsed: false },
			inspector: { width: 352, collapsed: false },
		});
	});

	it.each([
		['null', null],
		['a string', 'wide'],
		['an array', []],
		['an empty object', {}],
	])('falls back to the defaults for %s', (_what, raw) => {
		expect(parsePanelLayout(raw)).toEqual(defaultPanelLayout());
	});

	it('keeps each valid field and defaults each invalid one on its own', () => {
		expect(parsePanelLayout({
			layers: { width: 300, collapsed: 'yes' },
			inspector: { width: Number.NaN, collapsed: true },
		})).toEqual({
			layers: { width: 300, collapsed: false },
			inspector: { width: 352, collapsed: true },
		});
	});

	it('defaults a width outside its bounds rather than trusting a hand-edited value', () => {
		expect(parsePanelLayout({ layers: { width: 199, collapsed: false }, inspector: { width: 521, collapsed: false } }))
			.toEqual(defaultPanelLayout());
		expect(parsePanelLayout({ layers: { width: 399.6, collapsed: false } }).layers.width).toBe(400);
	});

	it('clamps and rounds a width to its side', () => {
		expect(clampPanelWidth('layers', 12)).toBe(PANEL_BOUNDS.layers.min);
		expect(clampPanelWidth('inspector', 9999)).toBe(PANEL_BOUNDS.inspector.max);
		expect(clampPanelWidth('layers', 300.6)).toBe(301);
	});
});

describe('effective widths', () => {
	it('gives the stored widths when the shell has room for them and the canvas floor', () => {
		expect(effectivePanelWidths(defaultPanelLayout(), 1280)).toEqual({ layers: 256, inspector: 352 });
	});

	it('gives a collapsed panel the strip width', () => {
		const layout = { ...defaultPanelLayout(), inspector: { width: 352, collapsed: true } };
		expect(effectivePanelWidths(layout, 1280)).toEqual({ layers: 256, inspector: STRIP_PX });
	});

	it('shrinks both expanded panels proportionally so the canvas keeps its floor', () => {
		const widths = effectivePanelWidths(defaultPanelLayout(), 900);
		expect(900 - widths.layers - widths.inspector).toBeGreaterThanOrEqual(CANVAS_FLOOR_PX);
		expect(widths.layers).toBe(244);
		expect(widths.inspector).toBe(335);
	});

	it('shrinks only the expanded panel when the other is a strip', () => {
		const layout = { layers: { width: 400, collapsed: false }, inspector: { width: 520, collapsed: true } };
		expect(effectivePanelWidths(layout, 700)).toEqual({ layers: 700 - CANVAS_FLOOR_PX - STRIP_PX, inspector: STRIP_PX });
	});

	it('answers strips and zero for a shell that has not been laid out yet', () => {
		const both = { layers: { width: 256, collapsed: true }, inspector: { width: 352, collapsed: true } };
		expect(effectivePanelWidths(both, 0)).toEqual({ layers: STRIP_PX, inspector: STRIP_PX });
		expect(effectivePanelWidths(defaultPanelLayout(), 0)).toEqual({ layers: 0, inspector: 0 });
	});
});

describe('the widest a panel may be dragged', () => {
	it('is the side maximum when the shell is wide', () => {
		expect(maxPanelWidth('layers', defaultPanelLayout(), 1600)).toBe(400);
	});

	it('leaves the canvas floor beside the other panel as it stands', () => {
		expect(maxPanelWidth('inspector', defaultPanelLayout(), 1000)).toBe(1000 - CANVAS_FLOOR_PX - 256);
	});

	it('never answers less than the side minimum', () => {
		expect(maxPanelWidth('layers', defaultPanelLayout(), 400)).toBe(200);
	});
});
