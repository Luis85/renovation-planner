/**
 * A location, in world units (millimeters — see `../units/WorldUnit.ts`). Never a
 * displacement: `Vector` is that.
 */
export interface Point {
	readonly x: number;
	readonly y: number;
}
