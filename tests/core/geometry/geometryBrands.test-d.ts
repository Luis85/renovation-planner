/**
 * The open/closed discriminant, proved by the compiler rather than asserted in a docblock.
 *
 * **This file exists because the first version of the brand refused nothing at all.** `CurvedPath`
 * carried `[OPEN_PATH]: true` and `CurvedPolygon` said nothing about the symbol, which makes the
 * brand an EXTRA PROPERTY — and an extra property never blocks assignability. A validated open path
 * was therefore assignable to `CurvedPolygon`, and `polygonPolyline(path)` compiled happily, which
 * is exactly the wrong picture the brand was introduced to refuse. Measured with a probe; the
 * AD04 commit's own claim about it was false until this file was written.
 *
 * Both directions are pinned, because a fix to one is not a fix to the other.
 */
import { createCurvedPath, type CurvedPath } from '../../../src/core/geometry/CurvedPath';
import type { CurvedPolygon } from '../../../src/core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../../src/core/geometry/curvePolyline';

declare const path: CurvedPath;
declare const polygon: CurvedPolygon;

// A path may not stand in for a closed boundary: `true` is not assignable to `undefined`.
// @ts-expect-error an open path is not a closed boundary
const asPolygon: CurvedPolygon = path;

// Nor may it reach a routine that closes one — the operation the brand exists to refuse.
// @ts-expect-error `polygonPolyline` closes the ring it is given
polygonPolyline(path);

// And a polygon may not stand in for a path either: it carries no proof of `createCurvedPath`.
// @ts-expect-error a closed boundary has not been through the open path's validator
const asPath: CurvedPath = polygon;

// A hand-built object cannot claim the brand: the symbol is a declared type, never a value.
// @ts-expect-error nothing outside `createCurvedPath` can mint one
const forged: CurvedPath = { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };

// What IS allowed: reading the shared fields off either, with no narrowing at all.
const bothHavePoints: readonly { x: number; y: number }[] = ([polygon, path] as const)[0].points;

// And the constructor's own answer is a path.
const made = createCurvedPath({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
const fromConstructor: CurvedPath | null = made.ok ? made.value : null;

export type Pinned = [typeof asPolygon, typeof asPath, typeof forged, typeof bothHavePoints, typeof fromConstructor];
