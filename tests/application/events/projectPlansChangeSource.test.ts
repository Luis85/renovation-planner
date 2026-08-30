/**
 * "The set of plans in THIS project changed" — design slice 21's third change source.
 *
 * A third source rather than a filter on either of the two that exist, because it asks a
 * third question: `planChangeSource` is "this PLAN changed" and every caller binds a plan id;
 * `projectListChangeSource` is "the set of PROJECTS changed" and is unfiltered. This one is
 * filtered on the OWNING PROJECT, which `PlanCreated`'s payload carries.
 *
 * The third case pins a STATED COST rather than a wanted behaviour:
 * `ProjectIndexEntryChangedPayload` carries `entityId` and `entityType` and no owning
 * project, so that arm cannot be filtered by project and fires for a change to any plan note
 * in the vault. Affordable because the view is a singleton and the query is project-scoped.
 * Pinned so that narrowing it later — when that payload gains the owning project id — is a
 * deliberate change rather than a silent one.
 */
import { describe, expect, it, vi } from 'vitest';
import { createProjectPlansChangeSource } from '../../../src/application/events/projectPlansChangeSource';
import { createEventBus } from '../../../src/core/events/EventBus';
import { planCreated } from '../../../src/domain/plan/Plan.events';
import { projectIndexEntryChanged } from '../../../src/application/events/projectIndex.events';

const OURS = 'project-01JAAA';
const THEIRS = 'project-01JBBB';

describe('createProjectPlansChangeSource', () => {
	it('delivers a PlanCreated for its own project', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(planCreated({ planId: 'plan-01JXXX', projectId: OURS }));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	/**
	 * The filter, and the reason this is not `projectListChangeSource` with a different name.
	 * Without it every project's plan creation would re-read every open detail state.
	 */
	it('does not deliver a PlanCreated for another project', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(planCreated({ planId: 'plan-01JXXX', projectId: THEIRS }));

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * The stated cost, asserted rather than described. `entityType` is all the payload gives,
	 * so a plan note arriving through sync anywhere in the vault re-reads this one project's
	 * plans. Deliberate; narrow it when the payload can say whose plan it is.
	 */
	it('delivers a plan index entry change regardless of which project it belongs to', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(projectIndexEntryChanged({ entityId: 'plan-01JZZZ', entityType: 'renovation-plan' }));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('ignores an index entry change for something that is not a plan', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(projectIndexEntryChanged({ entityId: 'zone-01JZZZ', entityType: 'renovation-zone' }));

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * `projectIdOf` is a guard, not a cast: `PlanEventPayload.projectId` is a `PlanId` and
	 * still narrowed with `typeof === 'string'` rather than trusted, because `DomainEvent`
	 * itself promises nothing beyond `type`. An event carrying no payload at all must be
	 * DROPPED rather than compared — matching `null` against the string `OURS` would already
	 * fail, so the case that actually exercises the guard is a listener subscribed with no
	 * project id of its own, where a naive `===` on two `undefined`s would wrongly match.
	 */
	it('stays silent for a PlanCreated event carrying no payload', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(undefined as never, listener);

		await events.publish({ type: 'PlanCreated' } as never);

		expect(listener).not.toHaveBeenCalled();
	});

	it('stays silent for a PlanCreated event whose projectId is not a string', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(undefined as never, listener);

		await events.publish({ type: 'PlanCreated', payload: { projectId: 42 } } as never);

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * `changedEntityTypeOf` is the guard for the second list. An event with no payload has
	 * no `entityType` to compare, and must be dropped rather than matched against
	 * `'renovation-plan'` by way of two `undefined`s.
	 */
	it('stays silent for a ProjectIndexEntryChanged event carrying no payload', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish({ type: 'ProjectIndexEntryChanged' } as never);

		expect(listener).not.toHaveBeenCalled();
	});

	it('stays silent for a ProjectIndexEntryChanged event whose entityType is not a string', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish({
			type: 'ProjectIndexEntryChanged',
			payload: { entityId: 'plan-01JZZZ', entityType: 7 },
		} as never);

		expect(listener).not.toHaveBeenCalled();
	});

	it('disposes every subscription it took', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		const dispose = createProjectPlansChangeSource(events)(OURS, listener);

		dispose();
		await events.publish(planCreated({ planId: 'plan-01JXXX', projectId: OURS }));
		await events.publish(projectIndexEntryChanged({ entityId: 'plan-01JZZZ', entityType: 'renovation-plan' }));

		expect(listener).not.toHaveBeenCalled();
	});
});
