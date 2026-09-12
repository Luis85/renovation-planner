import type { Renovation } from '../../../domain/renovation/Renovation';
import type { Structure } from '../../../domain/spatial/Structure';

export interface ContextSource {
	readonly zoneIds: ReadonlySet<string>;
	readonly structure: Structure;
	readonly renovation: Renovation;
}

/**
 * The Room context a new record on `targetId` starts in; '' for none (spec §4.1). The one answer
 * `RenovationInspector`, `StructureRenovationEntry`, the Add submenu and Add › Note share — two
 * watchers used to disagree about it.
 */
export function defaultRenovationContext(source: ContextSource, targetId: string, remembered: string): string {
	if (!targetId) return '';
	if (source.zoneIds.has(targetId)) return targetId;
	const recorded = source.renovation.subjects.find(item => item.targetId === targetId)?.roomId
		?? source.renovation.work.find(item => item.targetId === targetId)?.roomId;
	if (recorded) return recorded;
	const host = source.structure.openings.find(item => item.id === targetId)?.hostId ?? targetId;
	const bounded = source.structure.boundaries.find(item => item.wallIds.includes(host))?.roomId;
	if (bounded) return bounded;
	return source.zoneIds.has(remembered) ? remembered : '';
}
