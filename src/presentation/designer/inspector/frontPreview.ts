import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { distance, extentOf } from '../../../core/geometry/operations';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { facingTip } from '../layers/anchorLayer';
import { presetPreview } from '../presets/presetPreview';

/** How far the arrow reaches from the outline's middle, as a share of the outline's longer side. */
const REACH = 0.4;
/** Clear space around the picture, as a share of the outline's longer side, so the head never touches the edge. */
const MARGIN = 0.1;
/** The head's length, as a share of the reach — the canvas's own 10 px head on its 44 px arrow, rounded. */
const HEAD = 0.25;

/**
 * The Front direction picker's mini preview (AD18-R17): a `viewBox` fitted to the outline AND the
 * arrow together, the outline's path,
 * the arrow's `shaft` (`x1 y1 x2 y2`, from the outline's middle to the head's base) and its
 * `head` (the tip, then the two barbs), all in world millimetres. The return type is inferred
 * rather than named: one caller, and a named export nothing imports is an `unused-exports` finding.
 *
 * The outline through `presetPreview` (the card's renderer, never a third one) and the arrow's
 * direction through `facingTip` — the function the CANVAS places its arrow's tip with. So the
 * preview cannot disagree with the canvas about which way `facing` points (C04): both take the same
 * `(cos, sin)` with the y term added, in a space whose y runs down the screen, and an SVG's y runs
 * down too. `designerFrontDirection.test.ts` checks that against `worldToScreen`, not against angles.
 *
 * **Two departures from the canvas, both about fitting a thumbnail rather than about direction.**
 * The arrow starts at the outline's MIDDLE rather than at the anchor, because an anchor on the back
 * edge would push the tip out of a picture sized to the outline; and the picture is a SQUARE around
 * the outline and the arrow TOGETHER, because a long thin object facing across its short side would
 * otherwise clip the tip. Fitting both rather than a fixed square lets the box below the picker
 * (`designer-placement.css`, full width by about 112 px) draw the object as large as it fits.
 *
 * `facingArrow` itself is not called, deliberately: it answers `null` for no shape, which is an arm
 * this caller (always handed a shape) could never take, and an unreachable arm is a coverage branch
 * nothing can pay back. Its head is two lines of arithmetic, restated below at thumbnail scale.
 */
export function frontPreview(shape: AssetShape) {
	const { minX, minY, maxX, maxY } = extentOf(polygonPolyline(shape.footprint, 2));
	const side = Math.max(maxX - minX, maxY - minY);
	const middle = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
	const reach = side * REACH;
	const towards = facingTip({ ...shape, anchor: middle }, 1);
	const length = distance(middle, towards);
	const dx = (towards.x - middle.x) / length;
	const dy = (towards.y - middle.y) / length;
	const tip = { x: middle.x + dx * reach, y: middle.y + dy * reach };
	const base = { x: tip.x - dx * reach * HEAD, y: tip.y - dy * reach * HEAD };
	const barb = (reach * HEAD) / 2;
	const head = [tip.x, tip.y, base.x - dy * barb, base.y + dx * barb, base.x + dy * barb, base.y - dx * barb];
	const xs = [minX, maxX, ...head.filter((_, index) => index % 2 === 0)];
	const ys = [minY, maxY, ...head.filter((_, index) => index % 2 === 1)];
	const pad = side * MARGIN;
	const left = Math.min(...xs) - pad;
	const top = Math.min(...ys) - pad;
	return {
		viewBox: `${left} ${top} ${Math.max(...xs) + pad - left} ${Math.max(...ys) + pad - top}`,
		footprint: presetPreview(shape).footprint,
		shaft: [middle.x, middle.y, base.x, base.y],
		head,
	};
}
