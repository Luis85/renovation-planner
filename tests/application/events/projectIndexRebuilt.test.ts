/**
 * The event that reaches every open Plan Editor rather than one of them.
 *
 * Its reason is an ordering fact about Obsidian, recorded in
 * `src/application/events/projectIndex.events.ts`: leaves are restored BEFORE
 * `onLayoutReady`, and the index scan runs from `onLayoutReady` because a scan in `onload`
 * builds a partial index that looks complete. So a Plan Editor reopened with the app
 * hydrates against an empty index and reports the plan missing. Found in a real vault, on
 * the first of two restored leaves — the second was fine because Obsidian defers a
 * non-active leaf's view until it is activated, by which time the scan has run.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createPlanChangeSource } from '../../../src/application/events/planChangeSource';
import { projectIndexRebuilt } from '../../../src/application/events/projectIndex.events';
import { planBackgroundChanged, planCalibrated } from '../../../src/domain/plan/Plan.events';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';

function wired() {
	const bus = createEventBus(() => undefined);
	const source = createPlanChangeSource(bus);
	const projectId = createProjectId();
	const mine = createPlanId();
	const theirs = createPlanId();
	const heard: string[] = [];
	const dispose = source(mine, () => heard.push('mine'));
	source(theirs, () => heard.push('theirs'));
	return { bus, projectId, mine, theirs, heard, dispose };
}

describe('a rebuilt project index', () => {
	it('reaches every listener, whichever plan each is showing', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexRebuilt());

		// BOTH, and that is the difference from a plan event: a rebuild says nothing about
		// which entities changed, so every subscriber has to re-read.
		expect(heard).toEqual(['mine', 'theirs']);
	});

	/** The per-plan filter is untouched — the new list is a second one, not a hole. */
	it('leaves the per-plan events filtered', async () => {
		const { bus, projectId, mine, heard } = wired();

		await bus.publish(planBackgroundChanged({ planId: mine, projectId }));
		await bus.publish(planCalibrated({ planId: mine, projectId }));

		expect(heard).toEqual(['mine', 'mine']);
	});

	/** One dispose takes BOTH subscriptions with it, or the listener outlives its view. */
	it('is unsubscribed by the same disposer as the plan events', async () => {
		const { bus, heard, dispose } = wired();
		dispose();

		await bus.publish(projectIndexRebuilt());

		expect(heard).toEqual(['theirs']);
	});
});
