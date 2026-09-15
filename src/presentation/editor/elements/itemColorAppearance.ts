import Konva from 'konva';
import { isItemColorPreset, type ItemColor, type ItemColorPreset } from '../../../domain/spatial/ItemColor';

/** User content swatches, not interface tokens. A restrained tint preserves the host's outline/label contrast. */
export const ITEM_COLOR_RGB: Readonly<Record<ItemColorPreset, string>> = {
	slate: '#778899', rose: '#ce6682', amber: '#d69b32', green: '#54976d', blue: '#518cce', violet: '#956bc4',
};
/** A preset's content sample, or the custom hex itself. */
export function itemColorRgb(color: ItemColor): string { return isItemColorPreset(color) ? ITEM_COLOR_RGB[color] : color; }
const channel = (a: number, b: number) => Math.round(a * 0.72 + b * 0.28);
/** A filled area's colour: an opaque 28% blend over the resolved host background (plan colours design §2). */
export function itemColorTint(color: ItemColor | undefined, background: string): string {
	if (color === undefined) return background;
	const base = Konva.Util.colorToRGBA(background), tint = Konva.Util.getRGB(itemColorRgb(color));
	// Unparseable custom host colors keep a safe native fill; the saved value remains visible in Details.
	if (!base) return background;
	return `rgb(${channel(base.r, tint.r)}, ${channel(base.g, tint.g)}, ${channel(base.b, tint.b)})`;
}
/** A line's or text's colour at full strength; the theme token while absent. Callers put `accent` first while selected. */
export function itemColorInk(color: ItemColor | undefined, fallback: string): string {
	return color === undefined ? fallback : itemColorRgb(color);
}
