/**
 * A displacement/direction — not a location (`Point` is that). The distinction is the
 * API's: translating takes a `Vector`, and nothing else accepts one.
 */
export interface Vector {
	readonly dx: number;
	readonly dy: number;
}
