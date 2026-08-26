import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import { injectedPersistenceError } from '../../helpers/domain';
import { guardCommand, guardQuery } from '../../../src/application/errors/guardAgainstThrowing';
import { createVaultExceptionMapper, type VaultExceptionMapper } from '../../../src/application/errors/exceptionMapper';
import type { Logger } from '../../../src/application/ports/Logger';
import { CreatePlanCommand } from '../../../src/application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../../../src/application/commands/project/CreateProject';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleCalibratePlanCommand } from '../../../src/application/commands/plan/ReversibleCalibratePlan';
import { SetPlanBackgroundCommand } from '../../../src/application/commands/plan/SetPlanBackground';
import { ReversibleSetPlanBackgroundCommand } from '../../../src/application/commands/plan/ReversibleSetPlanBackground';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { GetProject } from '../../../src/application/queries/GetProject';
import { GetZone } from '../../../src/application/queries/GetZone';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';
import type { PlanRepository } from '../../../src/application/ports/PlanRepository';
import type { ProjectRepository } from '../../../src/application/ports/ProjectRepository';
import type { ZoneRepository } from '../../../src/application/ports/ZoneRepository';
import type { VaultFileProbe } from '../../../src/application/ports/VaultFileProbe';

/**
 * The Result-not-throw contract (SDD §65–66), asserted over EVERY command and query
 * class there is: constructed against dependencies that REJECT — the unexpected fault
 * the repositories' coded `Result`s do not cover — and wrapped exactly as the
 * composition root wraps them, each must answer a RESOLVED failed `Result` carrying a
 * `PersistenceError`, never a rejection.
 *
 * The cast-safety of the guards is no longer this test's job: their signatures demand
 * `Result<T, E | PersistenceError>`, so a future service whose error union narrowed
 * away `PersistenceError` fails to COMPILE at the composition root's wiring site. What
 * remains here is the runtime half — every rejection resolves, every failure (thrown
 * or resolved) is logged with its cause at the boundary.
 *
 * What this deliberately does NOT prove: that the composition root actually wraps every
 * future service it gains. That half lives in review of `composition-root.ts`, whose
 * comment names the rule where the wiring happens.
 */

const map: VaultExceptionMapper = createVaultExceptionMapper('vault');
const logged: Array<{ event: string; context?: Record<string, unknown> }> = [];
const logger: Logger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: (event, context) => logged.push({ event, context }),
};

function rejecting<T>(name: string): T {
	const reject = (): never => {
		throw new Error(`${name} exploded`);
	};
	return new Proxy({ reject }, { get: () => reject }) as T;
}

const plans = rejecting<PlanRepository>('plans');
const projects = rejecting<ProjectRepository>('projects');
const zones = rejecting<ZoneRepository>('zones');
const files = rejecting<VaultFileProbe>('files');
const events = { publish: (): Promise<void> => Promise.resolve() };

function services(): Array<{ name: string; run: () => Promise<unknown> }> {
	const project = makeProject();
	const plan = makePlan({ projectId: project.id });
	const zone = makeZone({ projectId: project.id, planId: plan.id });
	return [
		{
			name: 'CreateProjectCommand',
			run: () =>
				guardCommand(new CreateProjectCommand(projects, events), 'command.createProject.failed', logger, map).execute({
					name: 'Kitchen',
				}),
		},
		{
			name: 'CreatePlanCommand',
			run: () =>
				guardCommand(new CreatePlanCommand(plans, projects, events), 'command.createPlan.failed', logger, map).execute({
					projectId: plan.projectId,
					name: 'Ground floor',
				}),
		},
		{
			name: 'CreateZoneCommand',
			run: () =>
				guardCommand(new CreateZoneCommand(zones, plans, events), 'command.createZone.failed', logger, map).execute({
					planId: plan.id,
					name: 'Kitchen',
					zoneType: 'kitchen',
					geometry: { points: [] },
				} as never),
		},
		{
			name: 'ReversibleCalibratePlanCommand',
			run: () =>
				guardCommand(
					new ReversibleCalibratePlanCommand(plans, rejecting('sidecar'), events),
					'command.calibratePlan.failed',
					logger,
					map,
				).execute({
					planId: plan.id,
					pointA: { x: 0, y: 0 },
					pointB: { x: 10, y: 0 },
					knownDistance: 1000,
				} as never),
		},
		{
			name: 'DeleteZoneCommand',
			run: () => guardCommand(new DeleteZoneCommand(zones, events), 'command.deleteZone.failed', logger, map).execute({ zoneId: zone.id }),
		},
		{
			name: 'GetZoneInspector',
			run: () =>
				guardQuery(new GetZoneInspector(zones), 'query.zoneInspector.failed', logger, map).execute({ zoneId: zone.id }),
		},
		{
			name: 'MoveSpatialObjectCommand',
			run: () =>
				guardCommand(new MoveSpatialObjectCommand(zones, events), 'command.moveSpatialObject.failed', logger, map).execute({
					zoneId: zone.id,
					geometry: { points: [] },
				} as never),
		},
		{
			name: 'SetPlanBackgroundCommand',
			run: () =>
				guardCommand(
					new SetPlanBackgroundCommand(plans, files, events),
					'command.setPlanBackground.failed',
					logger,
					map,
				).execute({ planId: plan.id, background: { path: 'a.png', kind: 'image' } }),
		},
		{
			name: 'ReversibleSetPlanBackgroundCommand',
			run: () =>
				guardCommand(
					new ReversibleSetPlanBackgroundCommand(
						guardCommand(new SetPlanBackgroundCommand(plans, files, events), 'command.setPlanBackground.failed', logger, map),
						plans,
					),
					'command.setPlanBackground.undoable.failed',
					logger,
					map,
				).execute({ planId: plan.id, background: { path: 'a.png', kind: 'image' } }),
		},
		{ name: 'GetProject', run: () => guardQuery(new GetProject(projects), 'query.getProject.failed', logger, map).execute({ projectId: project.id }) },
		{ name: 'GetPlan', run: () => guardQuery(new GetPlan(plans), 'query.getPlan.failed', logger, map).execute({ planId: plan.id }) },
		{ name: 'GetZone', run: () => guardQuery(new GetZone(zones), 'query.getZone.failed', logger, map).execute({ zoneId: zone.id }) },
		{ name: 'FindZonesByPlan', run: () => guardQuery(new FindZonesByPlan(zones), 'query.findZonesByPlan.failed', logger, map).execute({ planId: plan.id }) },
	];
}

describe('the Result-not-throw contract', () => {
	it('resolves a failed Result for every command and query when its dependencies reject', async () => {
		for (const service of services()) {
			// A rejection here IS the failure the contract forbids: awaited bare, so an
			// unexpected throw fails this test rather than passing through as a value.
			const result = (await service.run()) as { ok: boolean; error?: { category: string; code: string } };
			expect(result.ok).toBe(false);
			expect(result.error?.category).toBe('Persistence');
			expect(result.error?.code).toBe('vault.unexpected-failure');
		}
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
