/**
 * The discriminant that keeps an OPEN path and a CLOSED boundary apart at the type level.
 *
 * It lives in a module of its own because BOTH types have to name it, and for the reason the first
 * version of this did not work: a brand only one side mentions is an EXTRA property, and an extra
 * property never blocks assignability. `CurvedPath` carrying `[OPEN_PATH]: true` was therefore
 * still assignable to `CurvedPolygon` — measured with a probe, not assumed — so the compiler
 * happily handed an open path to `polygonPolyline`, which is precisely the wrong picture the brand
 * exists to refuse.
 *
 * So the closed side declares it too, as `?: undefined`. `true` is not assignable to `undefined`,
 * which makes a path unusable where a polygon is expected; the property is optional and
 * `undefined`, so every `{ points }` literal in the codebase remains a valid polygon and nothing
 * has to mention it. This is `Point.__brand`'s idiom exactly — that field exists so a `ScreenPoint`
 * cannot be passed where world millimetres are expected — and `tests/core/geometry/geometryBrands.test-d.ts`
 * is what holds it, in both directions, rather than this paragraph.
 *
 * `declare const` and never a value: it has no runtime existence at all.
 */
export declare const OPEN_PATH: unique symbol;
