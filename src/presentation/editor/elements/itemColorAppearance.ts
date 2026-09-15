import Konva from 'konva';
import type { ItemColor } from '../../../domain/spatial/ItemColor';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { itemColorKind } from '../../../domain/spatial/ItemColor';

/** User content swatches, not interface tokens. A restrained tint preserves the host's outline/label contrast. */
export const ITEM_COLOR_RGB: Readonly<Record<ItemColor, string>> = {
	slate: '#778899', rose: '#ce6682', amber: '#d69b32', green: '#54976d', blue: '#518cce', violet: '#956bc4',
};
export function itemColorFill(element: Pick<SpatialElement, 'kind' | 'color'>, background: string): string {
	if (!itemColorKind(element.kind) || element.color === undefined) return background;
	const base = Konva.Util.colorToRGBA(background), tint = Konva.Util.getRGB(ITEM_COLOR_RGB[element.color]);
	// Unparseable custom host colors keep a safe native fill; the named value remains visible in Details.
	if (!base) return background;
	const channel = (a: number, b: number) => Math.round(a * 0.72 + b * 0.28);
	return `rgb(${channel(base.r, tint.r)}, ${channel(base.g, tint.g)}, ${channel(base.b, tint.b)})`;
}
