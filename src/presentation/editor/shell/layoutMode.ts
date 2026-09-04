/**
 * Which shell layout a leaf width gets (M16). The two numbers are JUDGEMENTS checked by the
 * 460px and 1280px captures (`npm run harness-shot`), not measurements — 460 is the width an
 * Obsidian sidebar leaf actually has and must land in `constrained` with a usable canvas.
 * A 0 width is what a container reports before layout, and `unsupported` is the honest
 * answer to it: nothing is drawn until the observer reports a real size.
 */
export type LayoutMode = 'full' | 'constrained' | 'unsupported';

export const FULL_MIN_PX = 900;
export const CONSTRAINED_MIN_PX = 400;

export function layoutModeFor(widthPx: number): LayoutMode {
	if (widthPx >= FULL_MIN_PX) return 'full';
	if (widthPx >= CONSTRAINED_MIN_PX) return 'constrained';
	return 'unsupported';
}
