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
): DeleteZoneCommand {
	const assets = new InMemoryAssetRepository();
	const recalculate = new RecalculateRequirementCommand(requirements, zones, assets, events);
	return new DeleteZoneCommand(
		{ zones, requirements, recalculate, events, locks: new ReferenceLocks(), logger: recorder },
	);
}

/** A REAL dispatching bus recording publication order — for event-chain assertions. */
function dispatchingEventBus(): EventBus & {
	readonly published: readonly DomainEvent[];
} {
	const published: DomainEvent[] = [];
	const inner = createEventBus();
	return {
		published,
		publish: async (event) => {
			published.push(event);
			await inner.publish(event);
		},
		subscribe: (type, handler) => inner.subscribe(type, handler),
	} as unknown as EventBus & { readonly published: readonly DomainEvent[] };
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

/** One in-memory stack with a project and plan already saved — the base fixture of slice 10's application tests. */
export async function requirementFixture(): Promise<RequirementFixture> {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = dispatchingEventBus();
	const locks = new ReferenceLocks();
	const project = expectOk(await projects.save(makeProject(), 'absent'));
	const plan = expectOk(
		await plans.save(makePlan({ projectId: project.entity.id }), 'absent'),
	);
	const recalculate = new RecalculateRequirementCommand(requirements, zones, assets, events);
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
		assign: new AssignAssetCommand(zones, assets, requirements, events, locks),
		recalculate,
	};
}
