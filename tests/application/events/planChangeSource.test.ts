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

const GROUND = { planId: 'plan-ground' as never, projectId: 'project-1' as never };
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

		expect(listener).not.toHaveBeenCalled();
	});
});
