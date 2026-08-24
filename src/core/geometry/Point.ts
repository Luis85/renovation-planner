/**
 * A location, in world units (millimeters — see `../units/WorldUnit.ts`). Never a
 * displacement: `Vector` is that.
 *
 * `__brand` is a phantom discriminant: never assigned, never read, and optional so no
 * object literal has to mention it — it carries no runtime value at all. Its only job is
 * to make `Point` incompatible with a branded coordinate type such as
 * `src/presentation/editor/viewport/Viewport.ts`'s `ScreenPoint` (`__brand: 'ScreenPoint'`),
 * which is otherwise the same two fields and would satisfy this interface structurally in
 * both directions — a screen pixel could then be passed anywhere world millimetres are
 * expected. `tests/presentation/editor/type-safety.test-d.ts` is what checks that this
 * stays true, rather than this paragraph.
 */
export interface Point {
	readonly x: number;
	readonly y: number;
	readonly __brand?: undefined;
}
