/**
 * The project surface's own subscription: "the set of projects may have changed."
 *
 * A SECOND source beside `createPlanChangeSource` rather than a filter on it, because this
 * view has no plan id to bind and wants the unfiltered category. The reason it exists at all
 * is the ordering fact `projectIndex.events.ts` records — leaves are restored BEFORE
 * `onLayoutReady` and the index scan runs from it — which for this surface means a restored
 * pane reads an empty index and draws "no projects yet" over a populated vault.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createProjectListChangeSource } from '../../../src/application/events/projectListChangeSource';
import { projectIndexRebuilt } from '../../../src/application/events/projectIndex.events';
import { projectCreated } from '../../../src/domain/project/Project.events';
import { planBackgroundChanged } from '../../../src/domain/plan/Plan.events';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../src/domain/project/ProjectId';

function wired() {
	const bus = createEventBus(() => undefined);
	const source = createProjectListChangeSource(bus);
	const heard: string[] = [];
	const dispose = source(() => heard.push('first'));
	source(() => heard.push('second'));
	return { bus, heard, dispose };
}

describe('the project list change source', () => {
	it('tells every listener that the index was rebuilt', async () => {
		const { bus, heard } = wired();

		// Awaited: the bus is promise-aware and costs one microtask hop per delivery, so a
		// fire-and-forget publish is asserted on before the handler has run.
		await bus.publish(projectIndexRebuilt());

		expect(heard).toEqual(['first', 'second']);
	});

	it('tells every listener that a project was created', async () => {
		// Not only the FORM path. `create-sample-project` seeds through the same
		// `CreateProjectCommand` from the palette, so a Renovation project pane open in a
		// background leaf drew a vault it no longer described until something rebuilt the whole
		// index. Reported in review — and the reason recorded for the omission, that
		// `ViewRoot.onCreateProject` re-reads for its own create, was a reason about that one
		// CALLER and never about the event.
		const { bus, heard } = wired();

		await bus.publish(projectCreated({ projectId: createProjectId() }));

		expect(heard).toEqual(['first', 'second']);
	});

	it('stays out of the events that are about one plan', async () => {
		// The list is the extension point, and a source that woke on everything would make it
		// decoration: this view re-reads every project note in the vault per delivery.
		const { bus, heard } = wired();

		await bus.publish(
			planBackgroundChanged({ planId: createPlanId(), projectId: createProjectId() }),
		);

		expect(heard).toEqual([]);
	});

	it('releases only the subscription it was asked to release', async () => {
		const { bus, heard, dispose } = wired();

		dispose();
		await bus.publish(projectIndexRebuilt());

		expect(heard).toEqual(['second']);
	});
});
