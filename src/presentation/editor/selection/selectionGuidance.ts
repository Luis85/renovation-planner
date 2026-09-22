import { tr } from '../../i18n/strings';
import type { useProjectStore } from '../../stores/ProjectStore';
import { structureRecords } from '../structure/structureRecords';

/**
 * The sentence pair that names the one object a selection is on and how to cycle past it:
 * `editor.input.current-target` followed by `editor.input.overlap-cycle-guidance`. Nothing for
 * an empty or multiple selection, and nothing for an id neither the zones nor the structure
 * records name.
 *
 * The ids are a PARAMETER rather than read from the selection store, because a caller may be a
 * watcher holding the incoming value while the store has already moved on.
 *
 * The `. ` between them is here rather than in the locale string because the separator belongs
 * to the composition rather than to either key. Without it the shell's `role="status"` region
 * announced `Current target: Bathroom Alt-click to select another overlapping item.` Known and
 * deliberately unguarded: a target whose own name ends in a period — `Apt.` — renders `Apt..`,
 * which costs less than a branch that then has to be covered.
 */
export function selectionGuidance(ids: readonly string[], project: ReturnType<typeof useProjectStore>): string | null {
	if (ids.length !== 1) return null;
	const id = ids[0];
	const target = project.zones.get(id)?.name
		?? structureRecords(project.structure, project.plan?.id ?? '', project.plan?.spatialElements).find(item => item.id === id)?.name
		?? null;
	return target === null ? null : `${tr('editor.input.current-target', { target })}. ${tr('editor.input.overlap-cycle-guidance')}`;
}
