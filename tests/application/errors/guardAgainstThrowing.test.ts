import { describe, expect, it } from 'vitest';
import { currencyOf } from '../../../src/core/money/Money';
import { err, ok, type Result } from '../../../src/core/result/Result';
import { injectedPersistenceError, RecordingEventBus } from '../../helpers/domain';
import { guardCommand, guardQuery } from '../../../src/application/errors/guardAgainstThrowing';
import { createVaultExceptionMapper, type VaultExceptionMapper } from '../../../src/application/errors/exceptionMapper';
import type { Logger } from '../../../src/application/ports/Logger';
import { CreatePlanCommand } from '../../../src/application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../../../src/application/commands/project/CreateProject';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { RecalculateRequirementCommand } from '../../../src/application/commands/requirement/RecalculateRequirement';
import type { RequirementRepository } from '../../../src/application/ports/RequirementRepository';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleCalibratePlanCommand } from '../../../src/application/commands/plan/ReversibleCalibratePlan';
import { SetPlanBackgroundCommand } from '../../../src/application/commands/plan/SetPlanBackground';
import { ReversibleSetPlanBackgroundCommand } from '../../../src/application/commands/plan/ReversibleSetPlanBackground';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { GetProject } from '../../../src/application/queries/GetProject';
import { GetZone } from '../../../src/application/queries/GetZone';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { makeAsset, makePlan, makeProject, makeRequirement, makeZone } from '../../helpers/entities';
import type { PlanRepository } from '../../../src/application/ports/PlanRepository';
import type { ProjectRepository } from '../../../src/application/ports/ProjectRepository';
import type { ZoneRepository } from '../../../src/application/ports/ZoneRepository';
import type { VaultFileProbe } from '../../../src/application/ports/VaultFileProbe';
import type { AssetRepository } from '../../../src/application/ports/AssetRepository';
import type { AssetPriceOverrideRepository } from '../../../src/application/ports/AssetPriceOverrideRepository';
import type { Command } from '../../../src/application/commands/Command';
import type { Query } from '../../../src/application/queries/Query';
import { CreateAssetCommand } from '../../../src/application/commands/asset/CreateAsset';
import { UpdateAssetCommand } from '../../../src/application/commands/asset/UpdateAsset';
import { DeleteAssetCommand } from '../../../src/application/commands/asset/DeleteAsset';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { SetRequirementQuantityOverrideCommand } from '../../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../../src/application/commands/requirement/SetRequirementCostOverride';
import { DeleteRequirementCommand } from '../../../src/application/commands/requirement/DeleteRequirement';
import { GetRequirementsForZone } from '../../../src/application/queries/GetRequirementsForZone';
import { ListAssets } from '../../../src/application/queries/ListAssets';
import { ListRequirementsReferencing } from '../../../src/application/queries/ListRequirementsReferencing';
import { ListReassignmentTargets } from '../../../src/application/queries/ListReassignmentTargets';

/**
 * The Result-not-throw contract (SDD 65-66), asserted over the command and query classes
 * NAMED BELOW - every one through slice 8, and design slice 10's eight commands and four
 * queries beside them. Each is constructed against dependencies that REJECT - the
 * unexpected fault the repositories' coded `Result`s do not cover - and wrapped exactly as
 * the composition root wraps it; each must answer a RESOLVED failed `Result` carrying a
 * `PersistenceError`, never a rejection.
 *
 * This file is about the MECHANISM: a guard applied to a service of that shape behaves.
 * Whether the composition root actually applies one is a different claim with its own
 * check - `tests/plugin/guardCategory.test.ts` walks everything the root hands out and
 * drives a fault through every door it finds, naming none of them, which is the category
 * form this file cannot reach by construction. `undo`'s half of the calibration
 * transaction is driven where the wrapper is BUILT (`tests/plugin/guardWiring.test.ts`),
 * because an `undo` before any `execute` refuses with a coded Result rather than throwing,
 * and this loop is about thrown faults.
 *
 * The cast-safety of the guards is no longer this test's job: their signatures demand
 * `Result<T, E | PersistenceError>`, so a future service whose error union narrowed
 * away `PersistenceError` fails to COMPILE at the composition root's wiring site. What
 * remains here is the runtime half - every rejection resolves, every failure (thrown
 * or resolved) is logged with its cause at the boundary.
 */

const map: VaultExceptionMapper = createVaultExceptionMapper('vault');
const logged: Array<{ event: string; context?: Record<string, unknown> }> = [];
const logger: Logger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: (event, context) => logged.push({ event, context }),
};

/**
 * Every member the ports and collaborators stood in for below actually declare - the five
 * repositories, `VaultFileProbe`, `PlanGeometrySidecar`, and the `Pick<…, 'execute'>` a
 * command takes of another command.
 *
 * It exists because the stand-in under it is a fake that is KINDER than the real thing in
 * a specific way: a Proxy answering EVERY property with a thrower means a service
 * constructed with the wrong argument SHAPE reaches for `deps.requirements`, gets a
 * thrower, and faults exactly like the rejecting repository the case is about.
 * `new DeleteZoneCommand(zones, events)` did that here for a whole slice after the command
 * grew a deps object, and `tests/**` is not type-checked, so nothing else noticed. An ask
 * for anything outside this set is a malformed FIXTURE rather than a faulting vault; it is
 * recorded and asserted empty, because the guard maps it into the same
 * `vault.unexpected-failure` the contract under test is about.
 */
const PORT_MEMBERS: ReadonlySet<string> = new Set([
	'getById',
	'save',
	'delete',
	'listAll',
	'listByProject',
	'listByPlan',
	'listByZone',
	'listByAsset',
	'getForPair',
	'markStale',
	'fileExists',
	'read',
	'write',
	'execute',
]);

/** Every ask no port declares, in order — see `PORT_MEMBERS`. */
const malformedAsks: string[] = [];

/** A dependency that throws for every call the ports declare, and only those. */
function rejecting<T>(name: string): T {
	const reject = (): never => {
		throw new Error(`${name} exploded`);
	};
	return new Proxy(
		{ reject },
		{
			get: (_target, key) => {
				// A real port has no symbol-keyed members; answering `undefined` keeps
				// `await`, printing and `instanceof` behaving the way they do for one.
				if (typeof key === 'symbol') return undefined;
				if (!PORT_MEMBERS.has(key)) {
					malformedAsks.push(`${name}.${key}`);
				}
				return reject;
			},
		},
	) as T;
}

const plans = rejecting<PlanRepository>('plans');
const projects = rejecting<ProjectRepository>('projects');
const zones = rejecting<ZoneRepository>('zones');
const assets = rejecting<AssetRepository>('assets');
const requirements = rejecting<RequirementRepository>('requirements');
const overrides = rejecting<AssetPriceOverrideRepository>('overrides');
const files = rejecting<VaultFileProbe>('files');
// The shared bus rather than a `{ publish }` object literal, which is not an `EventBus`:
// `subscribe` was simply absent, so this fake could never have delivered anything and every
// command below was composed with something the compiler would have refused. Nothing here
// subscribes, so a recording bus is the honest stand-in — see its own docblock for the one
// place a recording bus is NOT (`planEditorRig`, where a cascade has to actually run).
const events = new RecordingEventBus();

interface Fixture {
	readonly name: string;
	readonly run: () => Promise<unknown>;
}

/**
 * One case: build the service, wrap it, and hand back only the CALL.
 *
 * The construction happens HERE rather than inside `run`, so a constructor that reads its
 * argument - one that destructures, or validates - faults while the fixture list is being
 * built and fails this file loudly, instead of throwing inside the guard and being
 * asserted as the rejecting repository. It is only half the answer: a constructor that
 * merely STORES what it is given (`DeleteZoneCommand` is one) accepts anything, and the
 * malformed shape surfaces later, as a property no port declares. `PORT_MEMBERS` is what
 * catches that half.
 */
function commandCase<I>(name: string, command: Command<I, Result<unknown, never>>, event: string, input: I): Fixture {
	const wrapped = guardCommand(command, event, logger, map);
	return { name, run: () => wrapped.execute(input) };
}

function queryCase<I>(name: string, query: Query<I, Result<unknown, never>>, event: string, input: I): Fixture {
	const wrapped = guardQuery(query, event, logger, map);
	return { name, run: () => wrapped.execute(input) };
}

/** Slice 8 and earlier: the writes and reads the editor was built on. */
function editorServices(): Fixture[] {
	const project = makeProject();
	const plan = makePlan({ projectId: project.id });
	const zone = makeZone({ projectId: project.id, planId: plan.id });
	const background = { planId: plan.id, background: { path: 'a.png', kind: 'image' } } as never;
	const forward = guardCommand(
		new SetPlanBackgroundCommand(plans, files, events),
		'command.setPlanBackground.failed',
		logger,
		map,
	);
	return [
		commandCase('CreateProjectCommand', new CreateProjectCommand(projects, events, currencyOf('EUR')) as never, 'command.createProject.failed', {
			name: 'Kitchen',
		}),
		commandCase('CreatePlanCommand', new CreatePlanCommand(plans, projects, events) as never, 'command.createPlan.failed', {
			projectId: plan.projectId,
			name: 'Ground floor',
		}),
		commandCase('CreateZoneCommand', new CreateZoneCommand(zones, plans, events) as never, 'command.createZone.failed', {
			planId: plan.id,
			name: 'Kitchen',
			zoneType: 'kitchen',
			geometry: { points: [] },
		}),
		commandCase(
			'ReversibleCalibratePlanCommand',
			new ReversibleCalibratePlanCommand(plans, rejecting('sidecar'), events) as never,
			'command.calibratePlan.failed',
			{ planId: plan.id, pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 0 }, knownDistance: 1000 },
		),
		commandCase(
			// ONE deps object since slice 10, not `(zones, events)`. The lock set is REAL and
			// the logger is this file's, so the only thing that can throw is a collaborator
			// this case names.
			'DeleteZoneCommand',
			new DeleteZoneCommand({
				zones,
				requirements,
				recalculate: rejecting<Pick<RecalculateRequirementCommand, 'execute'>>('recalculate'),
				events,
				locks: new ReferenceLocks(),
				logger,
			}) as never,
			'command.deleteZone.failed',
			{ zoneId: zone.id },
		),
		commandCase(
			'MoveSpatialObjectCommand',
			new MoveSpatialObjectCommand(zones, events) as never,
			'command.moveSpatialObject.failed',
			{ zoneId: zone.id, geometry: { points: [] } },
		),
		commandCase(
			'SetPlanBackgroundCommand',
			new SetPlanBackgroundCommand(plans, files, events) as never,
			'command.setPlanBackground.failed',
			background,
		),
		commandCase(
			'ReversibleSetPlanBackgroundCommand',
			new ReversibleSetPlanBackgroundCommand(forward as never, plans) as never,
			'command.setPlanBackground.undoable.failed',
			background,
		),
		queryCase('GetZoneInspector', new GetZoneInspector(zones) as never, 'query.zoneInspector.failed', { zoneId: zone.id }),
		queryCase('GetProject', new GetProject(projects) as never, 'query.getProject.failed', { projectId: project.id }),
		queryCase('GetPlan', new GetPlan(plans) as never, 'query.getPlan.failed', { planId: plan.id }),
		queryCase('GetZone', new GetZone(zones) as never, 'query.getZone.failed', { zoneId: zone.id }),
		queryCase('FindZonesByPlan', new FindZonesByPlan(zones) as never, 'query.findZonesByPlan.failed', { planId: plan.id }),
	];
}

/**
 * Design slice 10's twelve, over the same rejecting collaborators - the shapes the guard
 * actually wraps in production, and ones this file did not reach while the composition
 * wired every one of them.
 *
 * The two override commands appear TWICE, because they have two public doors and the one
 * the app dispatches through is the second: the Inspector's reversible adapters call
 * `executeWithVersion`. The composition's two-door facade is `guardBothDoors`, which lives
 * in `plugin/` and is asserted where it is built; what belongs here is the mechanism - the
 * same guard over a door that is not named `execute`.
 */
function slice10Services(): Fixture[] {
	const project = makeProject();
	const plan = makePlan({ projectId: project.id });
	const zone = makeZone({ projectId: project.id, planId: plan.id });
	const asset = makeAsset();
	const requirement = makeRequirement({
		projectId: project.id,
		assetId: asset.id,
		origin: { kind: 'zone', zoneId: zone.id },
	});
	const locks = new ReferenceLocks();
	const quantityOverride = new SetRequirementQuantityOverrideCommand(requirements, events, locks);
	const costOverride = new SetRequirementCostOverrideCommand(requirements, events, locks);
	const target = { kind: 'zone', zoneId: zone.id } as const;
	return [
		commandCase('CreateAssetCommand', new CreateAssetCommand(assets, events) as never, 'command.createAsset.failed', {
			name: 'Porcelain Terrace Tile',
			category: 'material',
			unit: 'm2',
			unitCostAmount: '45.00',
			currency: 'EUR',
		}),
		commandCase(
			'UpdateAssetCommand',
			new UpdateAssetCommand(assets, requirements, events, locks) as never,
			'command.updateAsset.failed',
			{ assetId: asset.id, changes: { name: 'Renamed' } },
		),
		commandCase(
			'DeleteAssetCommand',
			new DeleteAssetCommand({
				assets,
				requirements,
				recalculate: rejecting<Pick<RecalculateRequirementCommand, 'execute'>>('recalculate'),
				events,
				locks,
				logger,
				overrides,
			}) as never,
			'command.deleteAsset.failed',
			{ assetId: asset.id },
		),
		commandCase(
			'AssignAssetCommand',
			new AssignAssetCommand({ zones, assets, requirements, events, locks, projects, overrides }) as never,
			'command.assignAsset.failed',
			{ zoneId: zone.id, assetId: asset.id },
		),
		commandCase(
			'RecalculateRequirementCommand',
			new RecalculateRequirementCommand({ requirements, zones, assets, events, projects, overrides }) as never,
			'command.recalculateRequirement.failed',
			{ requirementId: requirement.id },
		),
		commandCase(
			'SetRequirementQuantityOverrideCommand',
			quantityOverride as never,
			'command.setRequirementQuantityOverride.failed',
			{ requirementId: requirement.id, quantity: 3 },
		),
		commandCase(
			'SetRequirementQuantityOverrideCommand.executeWithVersion',
			{ execute: (input: never) => quantityOverride.executeWithVersion(input) } as never,
			'command.setRequirementQuantityOverride.with-version.failed',
			{ requirementId: requirement.id, quantity: 3 },
		),
		commandCase('SetRequirementCostOverrideCommand', costOverride as never, 'command.setRequirementCostOverride.failed', {
			requirementId: requirement.id,
			cost: null,
		}),
		commandCase(
			'SetRequirementCostOverrideCommand.executeWithVersion',
			{ execute: (input: never) => costOverride.executeWithVersion(input) } as never,
			'command.setRequirementCostOverride.with-version.failed',
			{ requirementId: requirement.id, cost: null },
		),
		commandCase(
			'DeleteRequirementCommand',
			new DeleteRequirementCommand(requirements) as never,
			'command.deleteRequirement.failed',
			{ requirementId: requirement.id },
		),
		queryCase(
			'GetRequirementsForZone',
			new GetRequirementsForZone(requirements, zones, assets, projects, overrides) as never,
			'query.getRequirementsForZone.failed',
			zone.id,
		),
		queryCase('ListAssets', new ListAssets(assets) as never, 'query.listAssets.failed', undefined),
		queryCase(
			'ListRequirementsReferencing',
			// Three collaborators since slice 19 grouped referents by project. `projects` is the
			// same rejecting stand-in every other case uses; the folder lookup is pure and is
			// never reached, because the repository throws first — which is this case's subject.
			new ListRequirementsReferencing(requirements, projects, () => undefined) as never,
			'query.listRequirementsReferencing.failed',
			target,
		),
		queryCase(
			'ListReassignmentTargets',
			new ListReassignmentTargets(zones, assets) as never,
			'query.listReassignmentTargets.failed',
			target,
		),
	];
}

function services(): Fixture[] {
	return [...editorServices(), ...slice10Services()];
}

describe('the Result-not-throw contract', () => {
	it('resolves a failed Result for every command and query when its dependencies reject', async () => {
		malformedAsks.length = 0;
		for (const service of services()) {
			// A rejection here IS the failure the contract forbids: awaited bare, so an
			// unexpected throw fails this test rather than passing through as a value.
			const result = (await service.run()) as { ok: boolean; error?: { category: string; code: string } };
			expect(result.ok).toBe(false);
			expect(result.error?.category).toBe('Persistence');
			expect(result.error?.code).toBe('vault.unexpected-failure');
		}
		// And every one of those faults came from a member a port DECLARES. Without this
		// line a fixture built against a constructor the command no longer has is green:
		// the fault is a stand-in answering a property nothing should have asked it for,
		// mapped into the same coded error the contract is about. See `PORT_MEMBERS`.
		expect(malformedAsks).toEqual([]);
	});

	it('logs every mapped exception with its original cause at the mapping step', async () => {
		logged.length = 0;
		for (const service of services()) {
			const before = logged.length;
			await service.run();
			// At least one line per service; the one nested case (the reversible adapter
			// wrapping a guarded forward) legitimately logs at BOTH boundaries.
			expect(logged.length).toBeGreaterThan(before);
			for (const line of logged.slice(before)) {
				expect(line.event).toContain('.failed');
				expect(line.context?.cause).toBeDefined();
			}
		}
	});

	// The logging policy's second half (SDD §67): a RESOLVED failed `Result` — the
	// repositories' expected-refusal channel, which never enters the catch above — is
	// logged at the boundary too, with the AppError itself as the cause. Without this, a
	// revision conflict reaches the user as a Notice and no log line anywhere.
	it('logs a resolved failed Result with the error as cause', async () => {
		logged.length = 0;
		const refusingPlans = {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		} as unknown as PlanRepository;
		const plan = makePlan({ projectId: makeProject().id });
		await guardQuery(new GetPlan(refusingPlans), 'query.getPlan.failed', logger, map).execute({ planId: plan.id });

		expect(logged).toHaveLength(1);
		expect(logged[0]?.event).toBe('query.getPlan.failed');
		expect(logged[0]?.context?.cause).toEqual(injectedPersistenceError());
	});

	// And the boundary is silent on success — "console noise" is a marketplace rejection,
	// so a happy path must produce no error line even though it passes through the guard.
	it('logs nothing when the service resolves a success', async () => {
		logged.length = 0;
		const emptyProjects = { getById: () => Promise.resolve(ok(null)) } as unknown as ProjectRepository;
		const result = await guardQuery(new GetProject(emptyProjects), 'query.getProject.failed', logger, map).execute({
			projectId: makeProject().id,
		});

		expect(result.ok).toBe(true);
		expect(logged).toEqual([]);
	});
});
