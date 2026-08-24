import { createPolygon } from '../../../src/core/geometry/Polygon';
import type { Zone } from '../../../src/domain/zone/Zone';
import type { ScreenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import type { Point } from '../../../src/core/geometry/Point';

declare const screen: ScreenPoint;
declare const world: Point;
declare const zone: Zone;

// @ts-expect-error a screen pixel is not domain geometry
createPolygon([screen]);
createPolygon([world]);

// @ts-expect-error Zone.withGeometry consumes world-millimetre points, not screen pixels
zone.withGeometry({ points: [screen] });
zone.withGeometry({ points: [world] });
