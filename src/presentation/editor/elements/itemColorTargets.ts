import { isItemColorPreset, type ItemColor } from '../../../domain/spatial/ItemColor';
import type { Structure } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';

export interface ColorTarget { readonly id: string; readonly color?: ItemColor }
export interface ColorSources { readonly zones: ReadonlyMap<string, ColorTarget>; readonly structure: Structure }
/** What the palette recolours for this selection: one selected item or placement, else nothing. */
export function colorTargets(sources: ColorSources, ids: readonly string[]): readonly ColorTarget[] {
	const element = ids.length === 1 ? sources.structure.elements?.find(item => item.id === ids[0]) : undefined;
	return element && (element.kind === 'object' || element.kind === 'asset') ? [element] : [];
}
/** The palette's value line: a preset's name, a custom hex as saved, or Default. */
export function itemColorLabel(color: ItemColor | undefined): string {
	if (color === undefined) return tr('editor.item-color.default');
	return isItemColorPreset(color) ? tr(`editor.item-color.${color}`) : color;
}
