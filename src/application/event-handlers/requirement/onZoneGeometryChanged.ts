import { isErr } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Disposable } from '../../../core/events/Disposable';
import type { ZoneGeometryChanged } from '../../../domain/zone/Zone.events';
import type {
	CascadeDeps,
} from './cascade';
import { runRecalculationCascade } from './cascade';

/**
 * Slice 10's cascade, first half (design slice 10, "Event cascade"): every geometry
 * mutation resolves to a command that publishes `ZoneGeometryChanged`, and every
 * requirement referencing that zone owes a recalculation. A failed LIST is not a failed
 * recalculation of nothing — it is "we do not know which requirements this affects", so
 * nothing may be marked stale and nothing may be reported as current; there is no
 * requirement to hang a durable marker on either, which is what makes this the one branch
 * in the cascade that is loud without one.
 */
export function registerOnZoneGeometryChanged(
	events: EventBus,
	deps: CascadeDeps,
): Disposable {
	return events.subscribe('ZoneGeometryChanged', async (event) => {
		const { zoneId } = (event as ZoneGeometryChanged).payload;
		const listed = await deps.requirements.listByZone(zoneId);
		if (isErr(listed)) {
			deps.logger.error('requirement.list-by-zone.failed', {
				zoneId,
				cause: listed.error,
			});
			deps.notify?.cascadeAborted(zoneId);
			return;
		}
		await runRecalculationCascade(deps, listed.value);
	});
}
