import { isErr, ok, type Result } from '../core/result/Result';
import type { AppError } from '../core/errors/AppError';
import type { Point } from '../core/geometry/Point';
import type { PlanId } from '../domain/plan/PlanId';
import type { ZoneStatus } from '../domain/zone/ZoneStatus';
import type { ZoneType } from '../domain/zone/ZoneType';
import { revealPlanEditor } from '../infrastructure/obsidian/workspace/revealPlanEditor';
import { runDetached } from './runDetached';
import { notifyError } from '../presentation/notices/notify';
import { PLAN_EDITOR_VIEW } from '../presentation/views/PlanEditorView';
import { tr } from '../presentation/i18n/strings';
import type { StringKey } from '../presentation/i18n/locales/en';
import type { PersistenceServices } from './composition-root';
import type { PluginCommandHost } from './commandHost';

/**
 * **SCAFFOLDING.** A vault-side `npm run harness`: one command that seeds a project, a
 * plan and five zones so the canvas can be LOOKED AT inside Obsidian. It is a tool for
 * looking, not a feature, and the name in the palette says "sample" for that reason.
 *
 * Why it exists at all: slices 3, 4 and 5 shipped with `CreateProjectCommand`,
 * `CreatePlanCommand` and `CreateZoneCommand` fully tested and called by nothing outside
 * `application/`. A vault therefore contained no project, plan or zone note, the Plan
 * Editor had no plan to open, and slice 5's whole Definition of Done — five shell regions,
 * zones drawn by type and status, layer toggling, pan and zoom, a rendered background —
 * had never been seen in the app. The suite passing is exactly why that went unnoticed.
 *
 * **What replaces it, so this does not become permanent by default — and design slice 16,
 * now landed, does NOT retire it, which an earlier draft of this comment predicted it
 * would.** Slice 16 built HALF of the pair: `NewProjectForm` dispatches the real
 * `CreateProjectCommand`, reachable from `renovationProject.noProjects`'s action button
 * (design slice 14's empty state, wired in slice 16) and from `ProjectList`'s own header
 * button once a project exists. A user can create a PROJECT without this module now. They
 * still cannot create a PLAN: nothing in `presentation/` calls `CreatePlanCommand`,
 * `context.openProject` opens only the project's raw note (there is no in-plugin
 * project-detail surface a "new plan" action could live on), and this module is therefore
 * still the only way a Plan exists to open at all. What retires it is a plan-creation form
 * plus a surface to reach one from — neither exists yet. Zones are NOT what is missing:
 * `DrawPolygonTool` (slices 6 and 8) has let a user draw one by hand for slices now, so a
 * seeded flat's real remaining job is handing over a PLAN with something already on it, not
 * the zones themselves.
 *
 * It goes through the REAL commands, never the vault: writing notes here would prove
 * nothing about the persistence layer and would breach `WRITE_BOUNDARY` besides. So a
 * failure here is a real failure of the thing under review, which is the point.
 */

/**
 * One zone of the sample flat. `nameKey` rather than a name: the rooms are text a user
 * reads, so they resolve through `t`/`tr` like everything else, in both locales.
 *
 * Deliberately NOT shared with `tests/harness/planEditor.ts`, which describes a similar
 * flat for the browser harness. The two have different lifetimes — that fixture is slice
 * 5's and stays; this table is scaffolding and goes with the whole module, at slice 16
 * (not slice 14, which shipped no action that could have deleted it — see the module
 * docblock above) — and a shared literal would make deleting one a change to the other.
 */
interface SampleZone {
	readonly nameKey: StringKey;
	readonly zoneType: ZoneType;
	readonly status: ZoneStatus;
	readonly points: readonly Point[];
}

/**
 * A small flat in world millimetres (ADR-009), sized so the whole of it fits a pane at the
 * default zoom of 0.1 stage pixels per millimetre.
 *
 * Chosen to exercise every channel §17's zone rendering has, because a sample that only
 * demonstrates one of them cannot show a defect in the others: four zone TYPES so the
 * fills differ, all three STATUSES so the dash patterns differ, and one non-rectangular
 * outline so the polygon path is not being judged on rectangles alone.
 */
const SAMPLE_ZONES: readonly SampleZone[] = [
	{
		nameKey: 'sample.zone.kitchen',
		zoneType: 'Room',
		status: 'Planned',
		points: [
			{ x: 0, y: 0 },
			{ x: 4200, y: 0 },
			{ x: 4200, y: 3000 },
			{ x: 0, y: 3000 },
		],
	},
	{
		nameKey: 'sample.zone.bathroom',
		zoneType: 'Room',
		status: 'InProgress',
		points: [
			{ x: 4400, y: 0 },
			{ x: 6800, y: 0 },
			{ x: 6800, y: 2200 },
			{ x: 4400, y: 2200 },
		],
	},
	{
		nameKey: 'sample.zone.living-room',
		zoneType: 'Room',
		status: 'Complete',
		points: [
			{ x: 0, y: 3200 },
			{ x: 6800, y: 3200 },
			{ x: 6800, y: 7000 },
			{ x: 0, y: 7000 },
		],
	},
	{
		nameKey: 'sample.zone.terrace',
		zoneType: 'Terrace',
		status: 'Planned',
		points: [
			{ x: 7000, y: 3200 },
			{ x: 11_000, y: 3200 },
			{ x: 11_000, y: 6000 },
			{ x: 9000, y: 7000 },
			{ x: 7000, y: 6000 },
		],
	},
	{
		nameKey: 'sample.zone.garden',
		zoneType: 'Garden',
		status: 'InProgress',
		points: [
			{ x: 7000, y: 0 },
			{ x: 11_000, y: 0 },
			{ x: 11_000, y: 3000 },
			{ x: 7000, y: 3000 },
		],
	},
];

/**
 * Seed the sample, through the three real commands, and answer the Plan the caller should
 * open.
 *
 * Stops at the FIRST failure and hands the error back rather than pressing on: a plan
 * whose zones half-wrote is a worse thing to look at than a clear error, and the partial
 * notes are left in the vault on purpose — this is scaffolding, and a compensating delete
 * would be inventing transaction semantics slice 11 owns.
 *
 * The `geometry` handed over is a bare `{ points }` and not a `createPolygon` result, which
 * is not a shortcut: `Polygon` is a deliberately UNVALIDATED interface and `Zone.create` is
 * the validator every zone passes through. Unwrapping a Result here would add an arm no
 * input can reach, in front of the check that actually runs.
 */
export async function seedSampleProject(services: PersistenceServices): Promise<Result<PlanId, AppError>> {
	const project = await services.createProject.execute({ name: tr('sample.project.name') });
	if (isErr(project)) return project;

	const plan = await services.createPlan.execute({
		projectId: project.value.project.entity.id,
		name: tr('sample.plan.name'),
	});
	if (isErr(plan)) return plan;

	const planId = plan.value.plan.entity.id;
	for (const zone of SAMPLE_ZONES) {
		const created = await services.createZone.execute({
			planId,
			name: tr(zone.nameKey),
			zoneType: zone.zoneType,
			status: zone.status,
			geometry: { points: zone.points },
		});
		if (isErr(created)) return created;
	}

	return ok(planId);
}

/**
 * Seed, then show what was seeded — through `revealPlanEditor`, the single decider of what
 * opening a Plan Editor means. This is one more INPUT to that action, not a second idea of
 * it, which is the whole of CLAUDE.md's "one action, every input" rule.
 */
async function createAndOpen(host: PluginCommandHost, services: PersistenceServices): Promise<void> {
	const seeded = await seedSampleProject(services);
	if (isErr(seeded)) {
		// Through `notifyError` (SDD §66's last step): the notice is a translated sentence
		// keyed by the error's code, never the error's own `message`, which is developer
		// text. That function is the ONE door an `AppError` takes to a notice — slice 17
		// owns WHICH surface this lands on and will change it THERE, which is the whole of
		// CLAUDE.md's "one action, every input" rule applied to a failure.
		notifyError(seeded.error);
		return;
	}
	await revealPlanEditor(host.app.workspace, PLAN_EDITOR_VIEW, seeded.value);
}

export function registerSampleProjectCommand(host: PluginCommandHost): void {
	// `checkCallback`, so the command is absent from the palette when there is nothing to
	// write through: settings that could not be read compose no persistence at all, and a
	// command that would answer a click with an error is worse than one that is not there.
	host.addCommand({
		id: 'create-sample-project',
		name: tr('command.create-sample-project'),
		checkCallback: (checking: boolean) => {
			const services = host.root.persistence;
			if (services === null) return false;
			// Detached like every other command handler, and answered like every other one:
			// `createAndOpen` awaits a seed AND an activation, either of which can fault, and
			// a bare `void` sent both nowhere.
			if (!checking) runDetached(createAndOpen(host, services), host.root.logger, 'sample-project.failed');
			return true;
		},
	});
}
