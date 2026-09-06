import type { DispatchResult } from '../DispatchOutcome';
import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Money, Currency } from '../../../core/money/Money';
import type { Asset } from '../../../domain/asset/Asset';
import type { PlanId } from '../../../domain/plan/PlanId';
import { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import { validDecimal, sourceError, sourceMeasurement, type RequirementSource } from '../../../domain/requirement/RequirementSource';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { RequirementRepository } from '../../ports/RequirementRepository';
import type { ProjectRepository } from '../../ports/ProjectRepository';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { PlanGeometrySidecar } from '../../ports/PlanGeometrySidecar';
import type { Loaded } from '../../ports/versioning';
import type { WriteLedger } from '../../editor/WriteLedger';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';
import { deriveRequirementFigures } from '../requirement/deriveRequirementFigures';
import { resolveEffectiveUnitCost } from '../requirement/resolveEffectiveUnitCost';
import { renovationServices, type RenovationBaseline } from './RenovationCommand';

export interface PlanningDeps {
	plans: PlanRepository; geometry: PlanGeometrySidecar; requirements: RequirementRepository;
	assets: AssetRepository; projects: ProjectRepository; overrides: AssetPriceOverrideRepository; events: EventBus; locks: ReferenceLocks;
}
export interface PlanningBaseline extends RenovationBaseline {
	readonly materials: readonly Loaded<Requirement>[];
	readonly catalogue: readonly { asset: Asset; price: Money }[];
	readonly currency: Currency;
}
export interface MaterialInput {
	readonly id: string; readonly roomId: string; readonly assetId: string;
	readonly waste: string; readonly override: string; readonly source: RequirementSource;
}
export interface PlanningServices {
	read(id: PlanId): Promise<Result<PlanningBaseline, AppError>>;
	material(baseline: PlanningBaseline, input: MaterialInput | { deleteId: string }, ledger: WriteLedger): { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };
}
export async function readPlanning(deps: PlanningDeps, id: PlanId): Promise<Result<PlanningBaseline, AppError>> {
	const baseline = await renovationServices(deps.plans, deps.geometry, deps.events).read(id);
	if (!baseline.ok) return baseline;
	const project = await deps.projects.getById(baseline.value.plan.entity.projectId);
	if (!project.ok) return project;
	if (!project.value) return err(sourceError());
	const assets = await deps.assets.listAll();
	if (!assets.ok) return assets;
	const materials: Loaded<Requirement>[] = [];
	for (const room of baseline.value.geometry.document.objects) {
		const rows = await deps.requirements.listByZone(room.id as ZoneId);
		if (!rows.ok) return rows;
		materials.push(...rows.value);
	}
	const catalogue: { asset: Asset; price: Money }[] = [];
	for (const item of assets.value.loaded) {
		const price = await resolveEffectiveUnitCost(deps.overrides, project.value.entity.id, item.entity);
		if (!price.ok) return price;
		catalogue.push({ asset: item.entity, price: price.value });
	}
	return ok({ ...baseline.value, materials, catalogue, currency: project.value.entity.currency });
}
export function prepareMaterial(baseline: PlanningBaseline, input: MaterialInput): Result<Requirement, AppError> {
	if (!validDecimal(input.waste) || (input.override && !validDecimal(input.override))) return err(sourceError());
	const selected = baseline.catalogue.find(item => item.asset.id === input.assetId);
	if (!selected || input.source.planId !== baseline.plan.entity.id) return err(sourceError());
	const raw = sourceMeasurement(input.source, input.roomId, baseline.geometry.document, selected.asset.unit);
	if (!raw.ok) return raw;
	const before = baseline.materials.find(item => item.entity.id === input.id)?.entity;
	const figures = deriveRequirementFigures({ zoneAreaMm2: 0, rawMeasurement: raw.value, assetUnit: selected.asset.unit,
		unitCost: selected.price, expectedCurrency: baseline.currency, wasteFactor: new Decimal(input.waste), coverage: new Decimal(input.source.coverage),
		quantityOverride: input.override ? { value: new Decimal(input.override), unit: selected.asset.unit } : undefined,
		packaging: input.source.lot ? { lotSize: new Decimal(input.source.lot), ...(input.source.minimum ? { minimumOrder: new Decimal(input.source.minimum) } : {}) } : undefined });
	if (!figures.ok) return figures;
	return Requirement.create({ id: input.id as RequirementId, projectId: baseline.plan.entity.projectId, assetId: input.assetId as AssetId,
		origin: { kind: 'zone', zoneId: input.roomId as ZoneId }, unit: selected.asset.unit, wasteFactor: new Decimal(input.waste), source: input.source,
		requiredDate: before?.requiredDate,
		quantity: { calculated: figures.value.quantity, ...(input.override ? { override: { value: new Decimal(input.override), unit: selected.asset.unit } } : {}) },
		estimatedCost: { calculated: figures.value.estimatedCost, ...(before?.estimatedCost.override ? { override: before.estimatedCost.override } : {}) }, calculatedFrom: figures.value.calculatedFrom });
}
