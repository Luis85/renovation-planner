import type { PlanPattern } from '../../../domain/asset/PlanPattern';

export const TILE_PX = 12;
type Segment = readonly [number, number, number, number];
/** Each pattern as tile-space segments; distinct shapes, never colours (SDD §84). */
const SEGMENTS: Record<PlanPattern, readonly Segment[]> = {
	brick: [[0, 0.5, 12, 0.5], [0, 6.5, 12, 6.5], [0.5, 0, 0.5, 6], [6.5, 6, 6.5, 12]],
	stone: [[0, 12, 12, 0], [0, 0, 12, 12]],
	concrete: [[2, 3.5, 4, 3.5], [8, 7.5, 10, 7.5], [5, 10.5, 7, 10.5]],
	timber: [[0, 12, 12, 0]],
	insulation: [[0, 9, 3, 3], [3, 3, 6, 9], [6, 9, 9, 3], [9, 3, 12, 9]],
	drywall: [[0, 0, 12, 12]],
	glass: [[3.5, 0, 3.5, 12], [8.5, 0, 8.5, 12]],
};

/**
 * One repeat of a plan pattern in theme colours on an offscreen canvas; null where the host
 * cannot draw one — no 2D context, or (a node-run import with no DOM at all) no global
 * `createEl`, Obsidian's own helper (`obsidianmd/prefer-create-el`; `pdfRaster.ts`'s same
 * detached-element idiom).
 */
export function patternTile(pattern: PlanPattern, ink: string, ground: string): HTMLCanvasElement | null {
	if (typeof createEl === 'undefined') return null;
	const canvas = createEl('canvas');
	canvas.width = TILE_PX; canvas.height = TILE_PX;
	const context = canvas.getContext('2d');
	if (!context) return null;
	context.fillStyle = ground; context.fillRect(0, 0, TILE_PX, TILE_PX);
	context.strokeStyle = ink; context.lineWidth = 1;
	context.beginPath();
	for (const [x1, y1, x2, y2] of SEGMENTS[pattern]) { context.moveTo(x1, y1); context.lineTo(x2, y2); }
	context.stroke();
	return canvas;
}
