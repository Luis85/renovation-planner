/**
 * The Plan editor's two side panels in the FULL layout (2026-09-12 side panels spec §1): how wide
 * each may be, how a stored value is read back, and how much each actually gets in a pane of a
 * given width. `constrained` and `unsupported` (M16) never read any of this.
 *
 * Pure on purpose: the stored value comes from `App.loadLocalStorage`, which answers whatever a
 * user or another build put there, so parsing it is a trust boundary and belongs where a node test
 * can drive every arm.
 */
export type PanelSide = 'layers' | 'inspector';

export interface PanelState {
	readonly width: number;
	readonly collapsed: boolean;
}

export type PanelLayout = Readonly<Record<PanelSide, PanelState>>;

export const PANEL_BOUNDS: Readonly<Record<PanelSide, { readonly min: number; readonly initial: number; readonly max: number }>> = {
	layers: { min: 200, initial: 256, max: 400 },
	inspector: { min: 280, initial: 352, max: 520 },
};

/** The canvas never gets less than this beside two panels. */
export const CANVAS_FLOOR_PX = 320;
/** A collapsed panel's strip. */
export const STRIP_PX = 40;

export function defaultPanelLayout(): PanelLayout {
	return {
		layers: { width: PANEL_BOUNDS.layers.initial, collapsed: false },
		inspector: { width: PANEL_BOUNDS.inspector.initial, collapsed: false },
	};
}

export function clampPanelWidth(side: PanelSide, width: number): number {
	const { min, max } = PANEL_BOUNDS[side];
	return Math.round(Math.min(max, Math.max(min, width)));
}

/**
 * One side, field by field. An out-of-range width is DEFAULTED rather than clamped: this build
 * clamps on every write, so a stored value outside the bounds was not written by it.
 */
function parseState(side: PanelSide, raw: unknown): PanelState {
	const fallback = defaultPanelLayout()[side];
	if (typeof raw !== 'object' || raw === null) return fallback;
	const { width, collapsed } = raw as { readonly width?: unknown; readonly collapsed?: unknown };
	const { min, max } = PANEL_BOUNDS[side];
	const valid = typeof width === 'number' && width >= min && width <= max;
	return {
		width: valid ? Math.round(width) : fallback.width,
		collapsed: typeof collapsed === 'boolean' ? collapsed : fallback.collapsed,
	};
}

export function parsePanelLayout(raw: unknown): PanelLayout {
	const record = typeof raw === 'object' && raw !== null ? (raw as { readonly layers?: unknown; readonly inspector?: unknown }) : {};
	return { layers: parseState('layers', record.layers), inspector: parseState('inspector', record.inspector) };
}

function demand(state: PanelState): number {
	return state.collapsed ? STRIP_PX : state.width;
}

/**
 * What each panel is actually drawn at in a shell `shellWidth` px wide. The stored layout is never
 * rewritten here: a narrow leaf shrinks the panels, and widening it again gives the stored widths
 * back. Expanded panels shrink in proportion; a strip never shrinks.
 */
export function effectivePanelWidths(layout: PanelLayout, shellWidth: number): Readonly<Record<PanelSide, number>> {
	const available = shellWidth - CANVAS_FLOOR_PX;
	const wanted = demand(layout.layers) + demand(layout.inspector);
	if (wanted <= available) return { layers: demand(layout.layers), inspector: demand(layout.inspector) };
	const strips = wanted - (layout.layers.collapsed ? 0 : layout.layers.width) - (layout.inspector.collapsed ? 0 : layout.inspector.width);
	const expanded = wanted - strips;
	const scale = expanded === 0 ? 0 : Math.max(0, available - strips) / expanded;
	const width = (state: PanelState): number => (state.collapsed ? STRIP_PX : Math.floor(state.width * scale));
	return { layers: width(layout.layers), inspector: width(layout.inspector) };
}

/** The widest `side` may be dragged to in this shell, with the other panel as it stands. */
export function maxPanelWidth(side: PanelSide, layout: PanelLayout, shellWidth: number): number {
	const other = side === 'layers' ? layout.inspector : layout.layers;
	const { min, max } = PANEL_BOUNDS[side];
	return Math.max(min, Math.min(max, Math.floor(shellWidth - CANVAS_FLOOR_PX - demand(other))));
}
