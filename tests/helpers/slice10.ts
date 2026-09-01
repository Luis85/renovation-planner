import { InMemoryAssetRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryRequirementRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { err } from '../../src/core/result/Result';
import { RecalculateRequirementCommand } from '../../src/application/commands/requirement/RecalculateRequirement';
import { AssignAssetCommand } from '../../src/application/commands/requirement/AssignAsset';
import { DeleteZoneCommand } from '../../src/application/commands/zone/DeleteZone';
import type { ZoneRepository } from '../../src/application/ports/ZoneRepository';
import type { RequirementRepository } from '../../src/application/ports/RequirementRepository';
import type { DeleteZoneUndoDeps } from '../../src/application/commands/zone/reversible-delete-zone-command';
import type { DomainEvent, EventBus } from '../../src/core/events/EventBus';
import { createEventBus } from '../../src/core/events/EventBus';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import type { Loaded } from '../../src/application/ports/versioning';
import type { Project } from '../../src/domain/project/Project';
import type { Plan } from '../../src/domain/plan/Plan';
import { recorder } from './logger';
import { expectOk } from './domain';
import { makePlan, makeProject } from './entities';

/**
 * The slice-10 collaborators the zone commands grew, wired to in-memory doubles — what
 * every pre-existing zone test needs to keep constructing a `DeleteZoneCommand` without
 * caring that delete is now reference-aware.
 */
export function makeDeleteZoneCommand(
	zones: ZoneRepository,
	events: EventBus,
	requirements = new InMemoryRequirementRepository(),
	locks = new ReferenceLocks(),
	projects: InMemoryProjectRepository = new InMemoryProjectRepository(),
): DeleteZoneCommand {
	const assets = new InMemoryAssetRepository();
	const recalculate = new RecalculateRequirementCommand(requirements, zones, assets, events, projects);
	return new DeleteZoneCommand({ zones, requirements, recalculate, events, locks, logger: recorder });
}

/**
 * The undo half `ReversibleDeleteZoneCommand` grew in slice 10 — the Requirements a
 * resolution touched are restored through these. Defaulted for the pre-slice-10 tests,
 * whose zones have no referents and whose undo therefore collapses to one write.
 */
export function zoneUndoDeps(
	requirements: RequirementRepository = new InMemoryRequirementRepository(),
	locks: ReferenceLocks = new ReferenceLocks(),
): DeleteZoneUndoDeps {
	return { requirements, locks, logger: recorder };
}

/**
 * A REAL dispatching bus recording publication order — for event-chain assertions.
 *
 * `clear()` rather than a caller writing `published.length = 0`: the list is handed out
 * `readonly` so nothing can quietly rewrite what was recorded, and nine call sites were
 * assigning through that anyway to start counting from a later phase. One method says what
 * they meant and keeps the array read-only for everything else.
 */
export interface RecordingBus extends EventBus {
	readonly published: readonly DomainEvent[];
	/** Forget everything recorded so far, so an assertion can start from the next publish. */
	clear(): void;
}

export function dispatchingEventBus(): RecordingBus {
	const published: DomainEvent[] = [];
	const inner = createEventBus();
	// ANNOTATED rather than cast at the end: the trailing `as unknown as …` gave the object
	// literal no contextual type at all, so `event`, `type` and `handler` each inferred `any`
	// — three implicit anys in a bus that exists to record what a cascade publishes, and three
	// more in every file that re-declares this shape.
	const bus: RecordingBus = {
		published,
		publish: async (event) => {
			published.push(event);
			await inner.publish(event);
		},
		subscribe: (type, handler) => inner.subscribe(type, handler),
		clear: () => {
			published.length = 0;
		},
	};

	return bus;
}

/**
 * Test seam: fail the repository's NEXT markStale — the cascade-abort fixture. Lives
 * HERE rather than as a member of the in-memory repository, so production code carries
 * no test-only branch.
 */
export function failMarkStaleOnce(repo: InMemoryRequirementRepository): void {
	const inner = repo.markStale.bind(repo);
	let armed = true;
	repo.markStale = ((id: Parameters<typeof inner>[0]) => {
		if (armed) {
			armed = false;
			return Promise.resolve(
				err({
					category: 'Persistence' as const,
					code: 'requirement.mark-stale-failed',
					message: `markStale was configured to fail for ${String(id)}.`,
				}),
			);
		}
		return inner(id);
	}) as typeof repo.markStale;
}

/** The 4 m × 2.5 m rectangle in world millimeters: exactly 10 m², no rounding anywhere. */
export const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];

export interface RequirementFixture {
	readonly projects: InMemoryProjectRepository;
	readonly plans: InMemoryPlanRepository;
	readonly zones: InMemoryZoneRepository;
	readonly assets: InMemoryAssetRepository;
	readonly requirements: InMemoryRequirementRepository;
	readonly events: ReturnType<typeof dispatchingEventBus>;
	readonly locks: ReferenceLocks;
	readonly project: Loaded<Project>;
	readonly plan: Loaded<Plan>;
	readonly assign: AssignAssetCommand;
	readonly recalculate: RecalculateRequirementCommand;
}

/**
 * One in-memory stack with a project and plan already saved — the base fixture of slice
 * 10's application tests. Both mutable repositories are injectable so a subclass can fail a
 * chosen write at the PORT, which is where a fault the code cannot branch on belongs.
 */
export async function requirementFixture(
	requirements: InMemoryRequirementRepository = new InMemoryRequirementRepository(),
	zones: InMemoryZoneRepository = new InMemoryZoneRepository(),
): Promise<RequirementFixture> {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const assets = new InMemoryAssetRepository();
	const events = dispatchingEventBus();
	const locks = new ReferenceLocks();
	const project = expectOk(await projects.save(makeProject(), 'absent'));
	const plan = expectOk(
		await plans.save(makePlan({ projectId: project.entity.id }), 'absent'),
	);
	const recalculate = new RecalculateRequirementCommand(requirements, zones, assets, events, projects);
	return {
		projects,
		plans,
		zones,
		assets,
		requirements,
		events,
		locks,
		project,
		plan,
		assign: new AssignAssetCommand({ zones, assets, requirements, events, locks, projects }),
		recalculate,
	};
}
