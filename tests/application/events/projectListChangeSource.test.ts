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
import { projectIndexEntryChanged, projectIndexRebuilt } from '../../../src/application/events/projectIndex.events';
import { projectCreated } from '../../../src/domain/project/Project.events';
import { planBackgroundChanged, planCreated } from '../../../src/domain/plan/Plan.events';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
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

	/**
	 * The path the two events above cannot see: a project note added by hand, copied in, or
	 * arriving through sync. `VaultChangeAdapter` is the SOLE index writer for everything this
	 * plugin did not write itself, and it published nothing at all — so a mounted pane drew the
	 * vault it had read at mount until something rebuilt the whole index, and
	 * `projectIndexRebuilt()` has exactly one publisher (layout-ready and a settings swap).
	 * Reported in review, one round after the `ProjectCreated` entry above closed the
	 * command-originated half of the same staleness.
	 */
	it('tells every listener that a project entry changed in the vault', async () => {
		const { bus, heard } = wired();

		await bus.publish(
			projectIndexEntryChanged({ entityId: createProjectId(), entityType: 'renovation-project' }),
		);

		expect(heard).toEqual(['first', 'second']);
	});

	/**
	 * `planCount` is a commissioned field (Home spec §8), so a plan created in a background
	 * leaf — or by `create-sample-project` seeding through the palette — is a number this row
	 * states and does not have until something re-reads. `PlanCreated` joins the unfiltered
	 * category list for the same reason `ProjectCreated` already sits there.
	 */
	it('tells every listener that a plan was created', async () => {
		const { bus, heard } = wired();

		await bus.publish(planCreated({ planId: createPlanId(), projectId: createProjectId() }));

		expect(heard).toEqual(['first', 'second']);
	});

	/**
	 * There is no `PlanDeleted` in this tree and no command that would raise one — measured,
	 * not assumed (`grep -rn "PlanDeleted" src/` prints nothing) — so a deleted plan note has to
	 * arrive through the entry arm instead. `VaultChangeAdapter.announce` runs on `index.remove`
	 * as well as on upsert, so this one event carries a plan note created by hand, modified,
	 * copied in, arriving through sync, or deleted alike.
	 */
	it('tells every listener that a plan entry changed in the vault, which is how a deleted plan arrives', async () => {
		const { bus, heard } = wired();

		await bus.publish(
			projectIndexEntryChanged({ entityId: createPlanId(), entityType: 'renovation-plan' }),
		);

		expect(heard).toEqual(['first', 'second']);
	});

	/**
	 * The same event for anything else is NOT the list's business, and the filter is what keeps
	 * this source from becoming decoration: a synced plan or a burst of zone notes would
	 * otherwise make this view re-read every project note in the vault, per note. The adapter
	 * announces every entry it touches — that is the category it can honestly claim — and
	 * deciding which of them mean "the project set may have changed" is this module's job,
	 * because this module is the one that may know both halves.
	 */
	it('stays out of an entry change that is not a project', async () => {
		const { bus, heard } = wired();

		await bus.publish(
			projectIndexEntryChanged({ entityId: createZoneId(), entityType: 'renovation-zone' }),
		);

		expect(heard).toEqual([]);
	});

	/**
	 * The guard's other arm, and it is a decision rather than a defensive line: an event named
	 * in the entry list that arrives WITHOUT the payload is never delivered, instead of
	 * comparing `undefined` against an entity type. `planChangeSource.planIdOf` carries the same
	 * rule for the same reason — the alternative, letting an unmatched event through, delivers
	 * every future payload-less event to every listener by accident.
	 */
	it('drops an entry event that carries no payload rather than treating it as a match', async () => {
		const { bus, heard } = wired();

		await bus.publish({ type: 'ProjectIndexEntryChanged' });

		expect(heard).toEqual([]);
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
