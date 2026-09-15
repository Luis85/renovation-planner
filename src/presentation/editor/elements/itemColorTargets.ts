import { isItemColorPreset, type ItemColor } from '../../../domain/spatial/ItemColor';
import type { Structure } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';

export interface ColorTarget { readonly id: string; readonly color?: ItemColor }
export interface ColorSources { readonly zones: ReadonlyMap<string, ColorTarget>; readonly structure: Structure }
/** What the palette recolours: every selected room, wall, opening and element — or nothing, never a silent subset. */
export function colorTargets(sources: ColorSources, ids: readonly string[]): readonly ColorTarget[] {
	const { structure } = sources;
	const found = ids.map(id => sources.zones.get(id) ?? structure.walls.find(item => item.id === id) ?? structure.openings.find(item => item.id === id) ?? structure.elements?.find(item => item.id === id));
	return found.every((target): target is ColorTarget => target !== undefined) ? found : [];
}
/** The one colour every target shares — `undefined` is Default — or `'mixed'`. */
export function sharedColor(targets: readonly ColorTarget[]): ItemColor | undefined | 'mixed' {
	const first = targets[0]?.color;
	return targets.every(target => target.color === first) ? first : 'mixed';
}
/** The palette's value line: Mixed, a preset's name, a custom hex as saved, or Default. */
export function itemColorLabel(color: ItemColor | undefined | 'mixed'): string {
	if (color === 'mixed') return tr('editor.item-color.mixed');
	if (color === undefined) return tr('editor.item-color.default');
	return isItemColorPreset(color) ? tr(`editor.item-color.${color}`) : color;
}
