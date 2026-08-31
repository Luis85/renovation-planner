import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import { UNIT_KIND } from '../../core/units/MeasurementUnit';
import type { ReassignmentTargetDto } from './reassignmentTypes';
import type { ReferencedTarget } from './ListRequirementsReferencing';
import type { AssetRepository } from '../ports/AssetRepository';
import type { ZoneRepository } from '../ports/ZoneRepository';

/**
 * The eligible reassignment targets. Zone case: every other zone in the same project.
 * Asset case: every other area-kind asset in the VAULT, since design slice 19 gave the
 * catalogue no project to be narrowed by. Both exclude the entity being deleted.
 *
 * **That is the whole of the filtering, and the header used to promise more.** It read
 * "already filtered by every rule the delete command would otherwise reject the choice for
 * — so slice 15's picker cannot OFFER a target that fails validation", which stopped being
 * true when the catalogue left the project: this query is handed a `ReferencedTarget`, an
 * asset id with NO project, so for an asset it cannot know which projects' rules a
 * candidate would have to satisfy, and it does not try. What it still does is the three
 * things above — area-kind, not-self, and same-project for a ZONE target, which has a
 * project to be narrowed by.
 *
 * Validation still runs in the command regardless; eligibility here is UX narrowing, not
 * enforcement — and it is narrowing over a SUBSET of the command's rules rather than all
 * of them, which is the difference the old sentence hid. Checked by review: a narrowed
 * comment is not something lint or the suite can see.
 */
export class ListReassignmentTargets {
	constructor(
		private readonly zones: ZoneRepository,
		private readonly assets: AssetRepository,
	) {}

	async execute(
		target: ReferencedTarget,
	): Promise<Result<readonly ReassignmentTargetDto[], RepositoryError>> {
		if (target.kind === 'asset') {
			const listed = await this.assets.getById(target.assetId);
			if (isErr(listed)) return listed;
			if (listed.value === null) return ok([]);
			const all = await this.assets.listAll();
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
