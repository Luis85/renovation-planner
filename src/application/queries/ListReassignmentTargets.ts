import { isErr, ok, type Result } from '../../core/result/Result';
import type { PersistenceError } from '../../core/errors/AppError';
import { UNIT_KIND } from '../../core/units/MeasurementUnit';
import type { ReassignmentTargetDto } from './reassignmentTypes';
import type { ReferencedTarget } from './ListRequirementsReferencing';
import type { AssetRepository } from '../ports/AssetRepository';
import type { ZoneRepository } from '../ports/ZoneRepository';

/**
 * The eligible reassignment targets, already filtered by every rule the delete command
 * would otherwise reject the choice for — so slice 15's picker cannot OFFER a target that
 * fails validation. Zone case: every other zone in the same project. Asset case: every
 * other area-kind asset in the same project. Both exclude the entity being deleted.
 *
 * Validation still runs in the command regardless; eligibility here is UX narrowing, not
 * enforcement.
 */
export class ListReassignmentTargets {
	constructor(
		private readonly zones: ZoneRepository,
		private readonly assets: AssetRepository,
	) {}

	async execute(
		target: ReferencedTarget,
	): Promise<Result<readonly ReassignmentTargetDto[], PersistenceError>> {
		if (target.kind === 'asset') {
			const listed = await this.assets.getById(target.assetId);
			if (isErr(listed)) return listed;
			if (listed.value === null) return ok([]);
			const projectId = listed.value.entity.projectId;
			const all = await this.assets.listByProject(projectId);
			if (isErr(all)) return all;
			return ok(
				all.value
					.filter((a) => a.entity.id !== target.assetId && UNIT_KIND[a.entity.unit] === 'area')
					.map((a) => ({ id: a.entity.id, label: a.entity.name })),
			);
		}

		const zoneListed = await this.zones.getById(target.zoneId);
		if (isErr(zoneListed)) return zoneListed;
		if (zoneListed.value === null) return ok([]);
		const projectId = zoneListed.value.entity.projectId;
		const all = await this.zones.listByProject(projectId);
		if (isErr(all)) return all;
		return ok(
			all.value
				.filter((z) => z.entity.id !== target.zoneId)
				.map((z) => ({ id: z.entity.id, label: z.entity.name })),
		);
	}
}
