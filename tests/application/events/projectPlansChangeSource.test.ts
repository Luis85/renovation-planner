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
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';

// Minted rather than spelled as branded string literals — the idiom
// `projectListChangeSource.test.ts` next door already uses for the same payloads. Nothing
// here reads an id's TEXT; every case only asks whether two ids are the same one.
const OURS = createProjectId();
const THEIRS = createProjectId();
const A_PLAN = createPlanId();

describe('createProjectPlansChangeSource', () => {
	it('delivers a PlanCreated for its own project', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(planCreated({ planId: A_PLAN, projectId: OURS }));

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

		await events.publish(planCreated({ planId: A_PLAN, projectId: THEIRS }));

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

		await events.publish(projectIndexEntryChanged({ entityId: createPlanId(), entityType: 'renovation-plan' }));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('ignores an index entry change for something that is not a plan', async () => {
		const events = createEventBus();
		const listener = vi.fn<() => void>();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(projectIndexEntryChanged({ entityId: createZoneId(), entityType: 'renovation-zone' }));

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
	 * `changedEntityTypeOf` is the guard for the second list, and these two cases cover its
	 * false arm — no more, which is a narrowing of what they used to claim.
	 *
	 * They said the payload-less event "must be dropped rather than matched against
	 * `'renovation-plan'` by way of two `undefined`s", copied from the `projectIdOf` pair
	 * above. That collision cannot happen here: the comparison target is a string LITERAL,
	 * not a caller-supplied id, so `undefined === 'renovation-plan'` is already false and
	 * both cases stay green against a `changedEntityTypeOf` that returns
	 * `payload?.entityType` with no `typeof` guard at all — measured. The sibling
	 * `projectIdOf` cases discriminate only because they subscribe with `undefined as never`,
	 * so two `undefined`s really can meet; this pair copied the form without the condition
	 * that makes it work, and there is no condition to add — with a literal on one side, the
	 * guard is held by the TYPE and not by any case that could be written here.
	 *
	 * Found by the whole-branch review. Worth keeping as the shape rather than for the two
	 * cases: a case copied from a discriminating sibling inherits its docblock's confidence
	 * and not necessarily its mechanism.
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
		await events.publish(planCreated({ planId: A_PLAN, projectId: OURS }));
		await events.publish(projectIndexEntryChanged({ entityId: createPlanId(), entityType: 'renovation-plan' }));

		expect(listener).not.toHaveBeenCalled();
	});
});
