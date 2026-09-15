import { isItemColorPreset, type ItemColor } from '../../../domain/spatial/ItemColor';
import type { Structure } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';

export interface ColorTarget { readonly id: string; readonly color?: ItemColor }
export interface ColorSources { readonly zones: ReadonlyMap<string, ColorTarget>; readonly structure: Structure }
/** What the palette recolours for a single selection: the room, wall, opening or element it names, else nothing. */
export function colorTargets(sources: ColorSources, ids: readonly string[]): readonly ColorTarget[] {
	if (ids.length !== 1) return [];
	const { structure } = sources, id = ids[0];
	const target = sources.zones.get(id) ?? structure.walls.find(item => item.id === id) ?? structure.openings.find(item => item.id === id) ?? structure.elements?.find(item => item.id === id);
	return target ? [target] : [];
}
/** The palette's value line: a preset's name, a custom hex as saved, or Default. */
export function itemColorLabel(color: ItemColor | undefined): string {
	if (color === undefined) return tr('editor.item-color.default');
	return isItemColorPreset(color) ? tr(`editor.item-color.${color}`) : color;
}
