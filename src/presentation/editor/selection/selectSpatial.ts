import type { EntityId } from '../../../core/identity/EntityId';
import type { SelectionStore } from './selection-store';

/** Canvas and accessible lists use the same selection action. */
export function selectSpatial(selection: SelectionStore, id: string, toggle: boolean): void {
	const target = id as EntityId<string>;
	if (!toggle) selection.select([target]);
	else if (selection.isSelected(target)) selection.select(selection.selectedIds.filter((current) => current !== target));
	else selection.select([...selection.selectedIds, target]);
}
