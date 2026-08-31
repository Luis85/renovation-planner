/**
 * @vitest-environment jsdom
 *
 * The scaffolding command that makes slice 5 reviewable: what it writes, through what, and
 * what it does when a write fails.
 *
 * Driven against the REAL Obsidian repositories over a fake vault (`createRepositoryStack`)
 * rather than in-memory ones, because that is the claim worth checking. The command's whole
 * purpose is to exercise the persistence layer the way a vault does — a seed that only
 * proved three commands were called would say nothing about whether a human opening
 * Obsidian gets a plan they can see.
 */
import { beforeEach, describe, expect, it } from 'vitest';
// Mock-only surface, imported BY NAME. `Notice` carries members
// the real `obsidian` module does not declare (`shown`, `constructed`, `opened`, `choose`), so reaching them through the
// `'obsidian'` specifier type-checks against a surface that has no such thing. The
// vitest alias points that specifier at this very file, so this is the SAME class and
// the same statics — proven, not assumed — and the import now says which surface it
// wants.
import { Notice } from '../helpers/obsidian-mock';
import { currencyOf } from '../../src/core/money/Money';
import { registerSampleProjectCommand, seedSampleProject } from '../../src/plugin/sampleProject';
import type { PluginCommandHost } from '../../src/plugin/commandHost';
import type { PersistenceServices } from '../../src/plugin/composition-root';
import { CreateProjectCommand } from '../../src/application/commands/project/CreateProject';
import { CreatePlanCommand } from '../../src/application/commands/plan/CreatePlan';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import type { PlanRepository } from '../../src/application/ports/PlanRepository';
import type { ProjectRepository } from '../../src/application/ports/ProjectRepository';
import type { ZoneRepository } from '../../src/application/ports/ZoneRepository';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import { installObsidianDom } from '../helpers/dom';
import { expectErr, expectOk, injectedPersistenceError, RecordingEventBus } from '../helpers/domain';
import { createRepositoryStack, type RepositoryStack } from '../helpers/vault';
import { FakeWorkspace } from '../helpers/workspace';
import { t } from '../../src/presentation/i18n/strings';
import { activateNotices } from '../../src/presentation/notices/notify';

installObsidianDom();

interface Wired {
	readonly stack: RepositoryStack;
	readonly services: PersistenceServices;
}

/**
 * Only the three members the seed reaches; the rest of `PersistenceServices` is not its
 * business, and a cast is what says so rather than a hundred-member fake nobody reads.
 *
 * Each repository is overridable so a failure can be injected at EVERY step — the seed has
 * three early returns and they are three different points in a partially written vault, not
 * one arm reached three ways.
 */
function wired(refusing: { projects?: ProjectRepository; plans?: PlanRepository; zones?: ZoneRepository } = {}): Wired {
	const stack = createRepositoryStack();
	const events = new RecordingEventBus();
	const projects = refusing.projects ?? stack.projects;
	const plans = refusing.plans ?? stack.plans;
	const services = {
		createProject: new CreateProjectCommand(projects, events, currencyOf('EUR')),
		// `stack.plans` for the READ side even when the write side is refusing: the plan a
		// zone create resolves its project through has to be findable, or the zone would fail
		// on the reference rather than on the save under test.
		createPlan: new CreatePlanCommand(plans, projects, events),
		createZone: new CreateZoneCommand(refusing.zones ?? stack.zones, stack.plans, events),
	} as unknown as PersistenceServices;
	return { stack, services };
}

/**
 * A repository whose every save fails, and nothing else behind it — the reads fall through
 * to the real stack, so what a test injects is exactly one failure and not a broken vault.
 */
function refusingSave<T>(): T {
	return {
		save: () => Promise.resolve({ ok: false, error: injectedPersistenceError() } as const),
	} as unknown as T;
}

interface Hosted {
	readonly workspace: FakeWorkspace;
	readonly commands: { id?: string; name?: string; checkCallback?: (checking: boolean) => boolean }[];
}

function hosted(services: PersistenceServices | null): Hosted {
	const workspace = new FakeWorkspace();
	const commands: Hosted['commands'] = [];
	const host = {
		app: { workspace } as never,
		root: { persistence: services } as never,
		addCommand: (command: never) => commands.push(command),
	} satisfies PluginCommandHost;
	registerSampleProjectCommand(host);
	return { workspace, commands };
}

/**
 * The command dispatches a promise chain it deliberately does not return — Obsidian's
 * `checkCallback` is synchronous — so a test lets the queue drain before asking what
 * happened. A macrotask hop rather than a counted number of `await`s, because the chain's
 * length is an implementation detail: five zone writes is not a number a test should know.
 */
function drain(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

beforeEach(() => {
	Notice.shown.length = 0;
	// A notice is INERT until something activates the queue — `onload` is what does that
	// in production, so a suite asserting on `Notice.shown` has to stand where the plugin
	// stands. Per TEST, and for a second reason: the queue DEDUPS, so two cases raising the
	// identical sentence would fold into one `(×2)` and construct no second `Notice`.
	activateNotices();
});

describe('seeding the sample project', () => {
	it('writes a project, a plan and five zones the vault can read back', async () => {
		const { stack, services } = wired();

		const planId = expectOk(await seedSampleProject(services));

		const projectId = stack.index.getIdsByType('renovation-project')[0] as ProjectId;
		const project = expectOk(await stack.projects.getById(projectId));
		expect(project?.entity.name).toBe(t('en', 'sample.project.name'));

		const plan = expectOk(await stack.plans.getById(planId));
		expect(plan?.entity.name).toBe(t('en', 'sample.plan.name'));
		// The plan belongs to the project just created, not to a dangling id: the reference
		// is what `CreatePlanCommand` refuses to invent, and the seed's ORDER is the only
		// thing that makes it resolvable.
		expect(plan?.entity.projectId).toBe(projectId);

		const zones = expectOk(await stack.zones.listByPlan(planId));
		expect(zones).toHaveLength(5);
		expect(zones.map((zone) => zone.entity.name)).toContain(t('en', 'sample.zone.kitchen'));
	});

	/**
	 * The invariant the sample table's docblock asserts — that it exercises every channel
	 * §17's zone rendering has — with a test that fails if the data stops doing so. Five
	 * identical planned rooms would look correct in a vault and would demonstrate neither the
	 * fill-by-type nor the dash-by-status half of the render model.
	 */
	it('covers every channel the zone rendering distinguishes on', async () => {
		const { stack, services } = wired();

		const planId = expectOk(await seedSampleProject(services));
		const zones = expectOk(await stack.zones.listByPlan(planId)).map((loaded) => loaded.entity);

		expect(new Set(zones.map((zone) => zone.status))).toEqual(
			new Set(['Planned', 'InProgress', 'Complete']),
		);
		expect(new Set(zones.map((zone) => zone.zoneType)).size).toBeGreaterThan(1);
		// At least one outline that is not a rectangle, so the polygon path is not being
		// judged on four-corner shapes alone.
		expect(zones.some((zone) => zone.geometry.points.length > 4)).toBe(true);
	});

	/**
	 * Zone geometry is handed over as a bare `{ points }` rather than a `createPolygon`
	 * result, which is only safe because `Zone.create` is the validator. This is that claim
	 * checked at the far end: the polygon comes back out of the vault intact and in world
	 * millimetres, so nothing along the way quietly reinterpreted it.
	 */
	it('persists the geometry it was given, in world millimetres', async () => {
		const { stack, services } = wired();

		const planId = expectOk(await seedSampleProject(services));
		const kitchen = expectOk(await stack.zones.listByPlan(planId)).find(
			(zone) => zone.entity.name === t('en', 'sample.zone.kitchen'),
		);

		expect(kitchen?.entity.geometry.points).toEqual([
			{ x: 0, y: 0 },
			{ x: 4200, y: 0 },
			{ x: 4200, y: 3000 },
			{ x: 0, y: 3000 },
		]);
	});

	it('stops at the first failure and hands the error back', async () => {
		const { stack, services } = wired({ projects: refusingSave() });

		const error = expectErr(await seedSampleProject(services));

		expect(error.code).toBe('test.injected-failure');
		// Nothing downstream ran: no plan, and therefore no zones either.
		expect(stack.index.getIdsByType('renovation-plan')).toEqual([]);
		expect(stack.index.getIdsByType('renovation-zone')).toEqual([]);
	});

	/**
	 * The three early returns are driven separately, and what each ASSERTS is different: the
	 * seed stops where the failure was and leaves what it had already written in the vault.
	 * The partial notes are deliberate — this is scaffolding, and a compensating delete would
	 * be transaction semantics slice 11 owns — so a test that only checked the error code
	 * would leave that decision unrecorded.
	 */
	it('leaves the project behind when the plan cannot be written', async () => {
		const { stack, services } = wired({ plans: refusingSave() });

		expect(expectErr(await seedSampleProject(services)).code).toBe('test.injected-failure');
		expect(stack.index.getIdsByType('renovation-project')).toHaveLength(1);
		expect(stack.index.getIdsByType('renovation-plan')).toEqual([]);
	});

	it('leaves the project and plan behind when the first zone cannot be written', async () => {
		const { stack, services } = wired({ zones: refusingSave() });

		expect(expectErr(await seedSampleProject(services)).code).toBe('test.injected-failure');
		expect(stack.index.getIdsByType('renovation-project')).toHaveLength(1);
		expect(stack.index.getIdsByType('renovation-plan')).toHaveLength(1);
		expect(stack.index.getIdsByType('renovation-zone')).toEqual([]);
	});
});

describe('the create-sample-project command', () => {
	it('stays out of the palette when there is nothing to write through', () => {
		const { commands } = hosted(null);

		expect(commands[0].checkCallback?.(true)).toBe(false);
	});

	it('carries an unprefixed id and a translated name', () => {
		const { commands } = hosted(wired().services);

		expect(commands[0].id).toBe('create-sample-project');
		expect(commands[0].name).toBe(t('en', 'command.create-sample-project'));
	});

	it('seeds, then reveals the plan editor for what it seeded', async () => {
		const { stack, services } = wired();
		const { workspace, commands } = hosted(services);

		expect(commands[0].checkCallback?.(true)).toBe(true);
		// Asking must not act — the `checking` contract, same as every other command here.
		expect(workspace.leaves).toHaveLength(0);

		commands[0].checkCallback?.(false);
		await drain();

		const planId = stack.index.getIdsByType('renovation-plan')[0] as PlanId;
		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].state?.state).toEqual({ planId });
	});

	it('reports a failure to the user instead of opening an empty editor', async () => {
		const { workspace, commands } = hosted(wired({ projects: refusingSave() }).services);

		commands[0].checkCallback?.(false);
		await drain();

		expect(workspace.leaves).toHaveLength(0);
		// Through `toUserMessage`: the notice is the locale table's Persistence fallback
		// for this injected code, never the error's own developer-facing `message`.
		expect(Notice.shown).toEqual(['The vault could not be read or written.']);
	});
});
