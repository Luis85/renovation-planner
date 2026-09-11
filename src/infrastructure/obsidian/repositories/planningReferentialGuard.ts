import { parseYaml, TFile, type Vault } from 'obsidian';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import { err, ok } from '../../../core/result/Result';
import { depthError } from '../../../domain/renovation/validatePlanningDepth';
import { requirementFromPersistence } from '../../persistence/mappers/requirementMapper';
import { sourceMeasurement } from '../../../domain/requirement/RequirementSource';
import { RenovationSchema } from '../../persistence/dto/renovation';
import { materialReferents } from '../../../application/commands/renovation/planningLinks';

function sourceDocument(dto: PlanGeometryDTO) { return { ...dto, objects: dto.objects.map(item => ({ id: item.id, points: item.points.map(([x, y]) => ({ x, y })), bulges: item.bulges })) }; }

async function frontmatter(vault: Vault, path: string | undefined): Promise<Record<string, unknown> | null> {
	const file = path ? vault.getAbstractFileByPath(path) : null;
	if (!(file instanceof TFile)) return null;
	const text = await vault.read(file), yaml = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1];
	const parsed: unknown = yaml ? parseYaml(yaml) : null;
	return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
}
/** Called inside the geometry write lane. Read bytes, never a potentially lagging link cache. */
export async function guardMaterialGeometry(deps: { vault: Vault; index: ProjectIndex }, planId: PlanId, before: PlanGeometryDTO, after: PlanGeometryDTO) {
	for (const id of deps.index.getIdsByType('renovation-requirement')) {
		const raw = await frontmatter(deps.vault, deps.index.getPath(id));
		if (!raw?.source) continue;
		const parsed = requirementFromPersistence(raw);
		if (!parsed.ok) return err(depthError());
		const requirement = parsed.value, source = requirement.source;
		if (!source || source.planId !== planId) continue;
		const roomId = requirement.origin.zoneId;
		if (!after.objects.some(item => item.id === roomId)) return err(depthError());
		if (sourceMeasurement(source, roomId, sourceDocument(before), requirement.unit, requirement.assetId).ok && !sourceMeasurement(source, roomId, sourceDocument(after), requirement.unit, requirement.assetId).ok) return err(depthError());
	}
	return ok(undefined);
}
export async function guardMaterialRemoval(deps: { vault: Vault; index: ProjectIndex }, requirementId: string) {
	for (const id of deps.index.getIdsByType('renovation-plan')) {
		const raw = await frontmatter(deps.vault, deps.index.getPath(id));
		if (!raw?.renovation) continue;
		const parsed = RenovationSchema.safeParse(raw.renovation);
		if (!parsed.success || materialReferents(parsed.data.depth, requirementId).length) return err(depthError());
	}
	return ok(undefined);
}
