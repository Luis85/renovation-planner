import { createPolygon } from '../../../src/core/geometry/Polygon';
import type { Zone } from '../../../src/domain/zone/Zone';
import type { ScreenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import type { Point } from '../../../src/core/geometry/Point';
import type { useSelectionStore, SelectionStore } from '../../../src/presentation/editor/selection/selection-store';

declare const screen: ScreenPoint;
declare const world: Point;
declare const zone: Zone;

// @ts-expect-error a screen pixel is not domain geometry
createPolygon([screen]);
createPolygon([world]);

// @ts-expect-error Zone.withGeometry consumes world-millimetre points, not screen pixels
zone.withGeometry({ points: [screen] });
zone.withGeometry({ points: [world] });

/**
 * `SelectionStore` is a hand-declared four-member interface rather than
 * `ReturnType<typeof useSelectionStore>`, so that `EditorContext.selection` cannot hand a
 * tool Pinia's `$patch`/`$dispose`. That narrowing is only safe while the real store still
 * SATISFIES the interface, and nothing at runtime can check a type — this is the check: a
 * store whose `selectedIds`, `select`, `clear` or `isSelected` drifted from the contract
 * would fail `vue-tsc --noEmit` in `npm run build`. It is an assignability check in one
 * direction only: the store may still have more members than the interface (it does —
 * Pinia adds them), which is exactly what the interface exists to keep out of a tool's
 * reach.
 */
declare function acceptsSelectionContract(selection: SelectionStore): void;
declare const liveSelectionStore: ReturnType<typeof useSelectionStore>;
acceptsSelectionContract(liveSelectionStore);
