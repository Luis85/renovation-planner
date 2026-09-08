import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryRequirementRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { FindZonesByPlan } from '../../src/application/queries/FindZonesByPlan';
import { GetZoneInspector } from '../../src/application/queries/GetZoneInspector';
import { Plan } from '../../src/domain/plan/Plan';
import { Zone } from '../../src/domain/zone/Zone';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import type { ZoneType } from '../../src/domain/zone/ZoneType';
import type { ZoneStatus } from '../../src/domain/zone/ZoneStatus';
import { toZoneDto, type PlanDto, type ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { ok } from '../../src/core/result/Result';
import { expectOk } from '../helpers/domain';
import { dispatchingEventBus, makeDeleteZoneCommand } from '../helpers/slice10';
import { settleUntil } from '../helpers/settle';

/** Explicitly ephemeral browser workspace: real Area commands/history, no files or vault. */
export function areaNumericWorkspace(base: PlanEditorDeps, planDto: PlanDto, zoneDtos: readonly ZoneDto[]): PlanEditorDeps {
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = dispatchingEventBus();
	const plan = expectOk(Plan.create({ ...planDto, id: planDto.id as PlanId, projectId: planDto.projectId as ProjectId }));
	const ready = (async () => {
		expectOk(await plans.save(plan, 'absent'));
		for (const dto of zoneDtos) {
			const zone = expectOk(Zone.create({ ...dto, id: dto.id as ZoneId, planId: plan.id, projectId: plan.projectId,
				zoneType: dto.zoneType as ZoneType, status: dto.status as ZoneStatus, geometry: { points: dto.points } }));
			expectOk(await zones.save(zone, 'absent'));
		}
	})();
	const find = new FindZonesByPlan(zones);
	return {
		...base,
		queries: {
			...base.queries,
			getPlan: async (id) => { await ready; return base.queries.getPlan(id); },
			findZonesByPlan: async (id) => {
				await ready;
				const result = await find.execute({ planId: id as PlanId });
				return result.ok ? ok({ zones: result.value.loaded.map(({ entity }) => toZoneDto(entity)), unreadable: result.value.refused }) : result;
			},
		},
		commands: {
			...base.commands,
			createZone: new CreateZoneCommand(zones, plans, events),
			deleteZone: makeDeleteZoneCommand(zones, events, requirements),
			zoneInspector: new GetZoneInspector(zones),
			zones, events,
			requirementEdits: { ...base.commands.requirementEdits, requirements },
		},
	};
}

/** Reproducible visual state, driven through the same controls the keyboard journey uses. */
export async function enterNumericArea(root: HTMLElement): Promise<void> {
	await settleUntil(() => root.querySelector('[data-rp-action="add"]') !== null, 'numeric Area Add');
	root.querySelector<HTMLButtonElement>('[data-rp-action="add"]')?.click();
	await settleUntil(() => root.querySelector('[data-rp-entry="area"]') !== null, 'numeric Area entry');
	root.querySelector<HTMLButtonElement>('[data-rp-entry="area"]')?.click();
	await settleUntil(() => root.querySelector('.rp-area-corners details') !== null, 'coordinate form');
	(root.querySelector('.rp-area-corners details') as HTMLDetailsElement).open = true;
	for (const [x, y] of [['0', '0'], ['4.2', '0'], ['4.2', '3.5'], ['0', '3.5']]) {
		for (const [name, text] of [['x', x], ['y', y]]) {
			const field = root.querySelector<HTMLInputElement>(`.rp-area-corners input[name="${name}"]`) as HTMLInputElement;
			field.value = text as string; field.dispatchEvent(new Event('input', { bubbles: true }));
		}
		root.querySelector<HTMLButtonElement>('[data-rp-corner="apply"]')?.click();
	}
}
