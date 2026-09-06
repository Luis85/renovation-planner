import type { VaultFileProbe } from '../../ports/VaultFileProbe';
import { err, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanBackgroundRef } from '../../../domain/plan/PlanBackgroundRef';
import { backgroundKindFor } from '../../../domain/plan/PlanBackgroundRef';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { planBackgroundChanged, planCalibrated } from '../../../domain/plan/Plan.events';
import { zoneGeometryChanged } from '../../../domain/zone/Zone.events';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { PlanGeometrySidecar, PlanGeometrySnapshot, PlanGeometryDocument } from '../../ports/PlanGeometrySidecar';
import { checkExpectedVersion, type Loaded } from '../../ports/versioning';
import { markUncompensated, type DispatchOutcome } from '../DispatchOutcome';
import { loadPlan } from './loadPlan';
import { calibrateDocument, type CalibratePlanInput } from './ReversibleCalibratePlan';
import { persistenceError } from '../../errors';

export interface ReferenceBaseline {
	readonly plan: Loaded<Plan>;
	readonly geometry: PlanGeometrySnapshot;
}
export interface ConfigureReferenceInput {
	readonly background: PlanBackgroundRef;
	readonly measurement: Pick<CalibratePlanInput, 'pointA' | 'pointB' | 'knownDistance'>;
}
export interface ReferencePlanServices {
	read(id: PlanId): Promise<Result<ReferenceBaseline, AppError>>;
	command(baseline: ReferenceBaseline, input: ConfigureReferenceInput): {
		execute(): Promise<Result<DispatchOutcome, AppError>>;
		undo(): Promise<Result<DispatchOutcome, AppError>>;
	};
}

/** One history item; exact whole-document expectations deliberately match calibration history. */
class ConfigurePlanReference {
	private current: ReferenceBaseline;
	private readonly before: ReferenceBaseline;
	private after: { plan: Plan; document: PlanGeometryDocument } | null = null;
	private applied = false;
	constructor(private readonly deps: { plans: PlanRepository; geometry: PlanGeometrySidecar; events: EventBus; files: VaultFileProbe },
		baseline: ReferenceBaseline, private readonly input: ConfigureReferenceInput) {
		this.current = baseline;
		this.before = baseline;
	}

	async execute(): Promise<Result<DispatchOutcome, AppError>> {
		if (this.applied) return ok('no-write');
		if (!this.deps.files.fileExists(this.input.background.path)) return err({ category: 'Reference', code: 'plan.background-not-found', message: 'The reference source is missing.' });
		if (this.after === null) {
			if (backgroundKindFor(this.input.background.path) !== this.input.background.kind) {
				return err({ category: 'Validation', code: 'plan.unsupported-background', message: 'Unsupported reference source.' });
			}
			const plan = this.before.plan.entity.withBackground(this.input.background);
			if (!plan.ok) return plan;
			const calibrated = calibrateDocument(this.before.geometry.document, this.input.measurement);
			if (!calibrated.ok) return calibrated;
			this.after = { plan: plan.value, document: calibrated.value };
		}
		const result = await this.write(this.after.plan, this.after.document);
		if (result.ok) this.applied = true;
		return result;
	}

	async undo(): Promise<Result<DispatchOutcome, AppError>> {
		if (!this.applied) return ok('no-write');
		const result = await this.write(this.before.plan.entity, this.before.geometry.document);
		if (result.ok) this.applied = false;
		return result;
	}

	private async write(plan: Plan, document: PlanGeometryDocument): Promise<Result<DispatchOutcome, AppError>> {
		const live = await this.deps.geometry.read(plan.id);
		if (!live.ok) return live;
		const conflict = checkExpectedVersion('plan-geometry', plan.id, live.value.version, this.current.geometry.version);
		if (conflict) return err(conflict);
		const saved = await this.deps.plans.save(plan, this.current.plan.version);
		if (!saved.ok) return saved;
		let written;
		try { written = await this.deps.geometry.write(plan.id, document, this.current.geometry.version); }
		catch (cause) { written = err(persistenceError('plan-geometry.write-failed', 'Reference scale could not be saved.', cause)); }
		if (!written.ok) {
			let restored;
			try { restored = await this.deps.plans.save(this.current.plan.entity, saved.value.version); }
			catch (cause) { restored = err(persistenceError('reference.restore-failed', 'Reference metadata could not be restored.', cause)); }
			if (!restored.ok) return err(markUncompensated(persistenceError('reference.compensation-failed', 'Reference recovery failed. Reopen the floor before editing.', restored.error)));
			this.current = { ...this.current, plan: restored.value };
			return written;
		}
		this.current = { plan: saved.value, geometry: { document, version: written.value } };
		const payload = { planId: plan.id, projectId: plan.projectId };
		await this.deps.events.publish(planBackgroundChanged(payload));
		await this.deps.events.publish(planCalibrated(payload));
		await Promise.all(document.objects.map(object => this.deps.events.publish(zoneGeometryChanged({ ...payload, zoneId: object.id as ZoneId }))));
		return ok('wrote');
	}
}

export function referencePlanServices(plans: PlanRepository, geometry: PlanGeometrySidecar, events: EventBus, files: VaultFileProbe): ReferencePlanServices {
	return {
		async read(id) {
			const plan = await loadPlan(plans, id);
			if (!plan.ok) return plan;
			const snapshot = await geometry.read(id);
			if (!snapshot.ok) return snapshot;
			// `loadPlan` already merged the sidecar's calibration into the entity, and a calibration
			// written between the two awaits left that half stale: the form converted source points
			// with it while the command derived from the snapshot. The snapshot is the ONE
			// observation both halves answer from; `null` keeps the entity's, since no command
			// removes a calibration (a Codex P2 on pull request #85).
			const calibration = snapshot.value.document.calibration;
			const entity = calibration === null ? ok(plan.value.entity) : plan.value.entity.withCalibration(calibration);
			if (!entity.ok) return entity;
			return ok({ plan: { entity: entity.value, version: plan.value.version }, geometry: snapshot.value });
		},
		command: (baseline, input) => new ConfigurePlanReference({ plans, geometry, events, files }, baseline, input),
	};
}
