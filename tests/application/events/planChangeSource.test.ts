/**
 * "Tell me when THIS plan changed", built from the event bus.
 *
 * The filtering is the whole of it: a Plan Editor showing the ground floor must not
 * re-read the vault because the first floor moved, and two open editors must not each
 * re-hydrate on the other's events.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPlanChangeSource } from '../../../src/application/events/planChangeSource';
import { createEventBus } from '../../../src/core/events/EventBus';
import { planBackgroundChanged, planCalibrated } from '../../../src/domain/plan/Plan.events';
import { zoneCreated, zoneDeleted, zoneGeometryChanged } from '../../../src/domain/zone/Zone.events';
import { geometrySidecarChanged } from '../../../src/application/events/projectIndex.events';
import type { EntityId } from '../../../src/core/identity/EntityId';

const GROUND = { planId: 'plan-ground' as never, projectId: 'project-1' as never };
const GROUND_ZONE = { ...GROUND, zoneId: 'zone-1' as never };
const FIRST = { planId: 'plan-first' as never, projectId: 'project-1' as never };

describe('subscribing to one plan changes', () => {
	it('fires when that plan background changes', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish(planBackgroundChanged(GROUND));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	/**
	 * The LIST is the extension point — slice 7 adds calibration's own re-render by naming
	 * an event there rather than giving the editor a second refresh path. Both entries are
	 * driven, so removing one is a failure rather than a silent narrowing.
	 */
	it('fires when that plan is calibrated', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish(planCalibrated(GROUND));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	/**
	 * The three zone events, driven one at a time so dropping any one is a failure rather
	 * than a silent narrowing.
	 *
	 * Slice 8's own post-command decorator refreshes only the leaf whose dispatcher ran, so
	 * it covers every zone change the editor itself makes and none of the others: a second
	 * Plan Editor leaf on the same plan (Obsidian's own "split" duplicates a leaf with its
	 * view state), the sample seed, a synced note. Without these entries that second leaf
	 * drew a stale zone set indefinitely and hit-tested against zones that no longer existed.
	 */
	it.each([
		['ZoneCreated', zoneCreated],
		['ZoneGeometryChanged', zoneGeometryChanged],
		['ZoneDeleted', zoneDeleted],
	])('fires when a zone of that plan is %s', async (_name, makeEvent) => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish(makeEvent(GROUND_ZONE));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('stays silent for a zone belonging to a DIFFERENT plan', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish(zoneGeometryChanged({ ...FIRST, zoneId: 'zone-9' as never }));

		expect(listener).not.toHaveBeenCalled();
	});

	it('stays silent for a different plan', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish(planBackgroundChanged(FIRST));

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * `DomainEvent` carries only a `type`. An event added to the list without a plan payload
	 * must be DROPPED rather than compared — an `undefined` plan id matching a leaf that also
	 * had none is the silent version of this bug.
	 */
	it('stays silent for an event carrying no plan id', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish({ type: 'PlanBackgroundChanged' });
		await events.publish({ type: 'PlanCalibrated', payload: { projectId: 'project-1' } } as never);

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * **A plan's ZONES live in its `.rpgeo`, so a sidecar edited or deleted out of band is a
	 * change to everything this editor draws — and no other arm hears it.** The sidecar path
	 * moves an index MAPPING at most, which `ProjectIndexEntryChanged` announces and this
	 * source does not subscribe to; a delete out of band moves nothing at all once the mapping
	 * has already been cleared. Without this arm the canvas drew the zone set it read at mount
	 * indefinitely and hit-tested against zones the vault no longer had.
	 */
	it('fires when this plan\'s geometry sidecar changes out of band', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish(
			geometrySidecarChanged({ entityId: 'plan-ground' as EntityId<string>, entityType: 'renovation-plan' }),
		);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	/**
	 * BOTH halves of that filter, because a build testing one of them passes with the other
	 * inverted. The TYPE half is not decoration: a plan's `.rpgeo` and an asset's are the same
	 * file type under two owners, so an asset id colliding with a plan id would otherwise
	 * re-read every editor showing that plan.
	 */
	it.each([
		['a different plan', 'plan-first' as EntityId<string>, 'renovation-plan' as const],
		['an entity of another kind carrying this id', 'plan-ground' as EntityId<string>, 'renovation-asset' as const],
	])('stays silent for a sidecar change for %s', async (_name, entityId, entityType) => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish(geometrySidecarChanged({ entityId, entityType }));

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * The sidecar arm reads a payload of its own, so it needs the same narrowing the plan-id
	 * guard has: an event of that type carrying nothing must be dropped rather than compared,
	 * or an `undefined` id matches whichever leaf also has none.
	 */
	it('stays silent for a sidecar change carrying no payload', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createPlanChangeSource(events)('plan-ground', listener);

		await events.publish({ type: 'GeometrySidecarChanged' });

		expect(listener).not.toHaveBeenCalled();
	});

	it('delivers to each subscriber independently', async () => {
		const events = createEventBus();
		const source = createPlanChangeSource(events);
		const ground = vi.fn<() => void>();
		const first = vi.fn<() => void>();
		source('plan-ground', ground);
		source('plan-first', first);

		await events.publish(planBackgroundChanged(FIRST));

		expect(ground).not.toHaveBeenCalled();
		expect(first).toHaveBeenCalledTimes(1);
	});

	/**
	 * The unsubscribe has to retire EVERY event type the source subscribed to. One left
	 * behind is a listener firing against an unmounted component for the rest of the
	 * session, and it would only show on the event type that was missed.
	 */
	it('stops delivering every event type once disposed', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		const unsubscribe = createPlanChangeSource(events)('plan-ground', listener);

		unsubscribe();
		await events.publish(planBackgroundChanged(GROUND));
		await events.publish(planCalibrated(GROUND));
		await events.publish(
			geometrySidecarChanged({ entityId: 'plan-ground' as EntityId<string>, entityType: 'renovation-plan' }),
		);

		expect(listener).not.toHaveBeenCalled();
	});
});
