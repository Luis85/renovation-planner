import { parseYaml, TFile, type Vault } from 'obsidian';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import { err, ok, type Result } from '../../../core/result/Result';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { depthError } from '../../../domain/renovation/validatePlanningDepth';
import { requirementFromPersistence } from '../../persistence/mappers/requirementMapper';
import { sourceMeasurement } from '../../../domain/requirement/RequirementSource';
import { originRoomId } from '../../../domain/requirement/RequirementOrigin';
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
		const roomId = originRoomId(requirement.origin);
		if (roomId !== undefined && !after.objects.some(item => item.id === roomId)) return err(depthError());
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

/**
 * Plans whose renovation subjects name `assetId` as a material. An unreadable plan note (no
 * `renovation` frontmatter, or one `RenovationSchema.safeParse` rejects) is skipped rather
 * than refused, unlike `guardMaterialRemoval`, which treats that same case as a depth
 * violation: this is a delete-time SCAN naming who uses the asset, not a write-time guard
 * defending an in-flight depth edit, so there is no edit here to refuse.
 */
export async function planMaterialUsers(deps: { vault: Vault; index: ProjectIndex }, assetId: string): Promise<Result<readonly string[], RepositoryError>> {
	const names: string[] = [];
	for (const id of deps.index.getIdsByType('renovation-plan')) {
		const raw = await frontmatter(deps.vault, deps.index.getPath(id));
		const parsed = raw?.renovation ? RenovationSchema.safeParse(raw.renovation) : null;
		if (parsed?.success && parsed.data.subjects.some(item => item.existing?.assetId === assetId || item.planned?.assetId === assetId)) names.push(typeof raw?.name === 'string' ? raw.name : id);
	}
	return ok<readonly string[]>(names);
}
