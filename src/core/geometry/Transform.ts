import type { Vector } from './Vector';

/**
 * A rigid-plus-uniform-scale transform. The scale is ONE scalar, not independent
 * `scaleX`/`scaleY`: §22 lists scale conversion as one operation, and no cited section
 * asks core geometry for a non-uniform affine matrix. Konva's own per-axis output is a
 * rendering artifact normalized before it reaches domain geometry (slice 6's concern).
 */
export interface Transform {
	readonly translation: Vector;
	readonly rotationRadians: number;
	readonly scale: number;
}
