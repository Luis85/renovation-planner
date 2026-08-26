import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { RequirementRepository } from '../ports/RequirementRepository';

export type ReferencedTarget =
	| { readonly kind: 'zone'; readonly zoneId: ZoneId }
	| { readonly kind: 'asset'; readonly assetId: AssetId };

/**
 * The IDs of every requirement referencing the target — what slice 15's
 * delete-confirmation flow shows BEFORE the dialog and owes BACK to the command as
 * `resolvedReferents`, the exact set the user consented to. IDs rather than a count,
 * because the command compares sets, not numbers.
 *
 * §58/§59 route this through a query so presentation never holds a repository handle.
 */
export class ListRequirementsReferencing {
	constructor(
		private readonly requirements: RequirementRepository,
	) {}

	async execute(target: ReferencedTarget): Promise<Result<readonly RequirementId[], RepositoryError>> {
		if (target.kind === 'zone') {
			const listed = await this.requirements.listByZone(target.zoneId);
			if (isErr(listed)) return listed;
			return ok(listed.value.map((r) => r.entity.id));
		}
		const listed = await this.requirements.listByAsset(target.assetId);
		if (isErr(listed)) return listed;
		return ok(listed.value.map((r) => r.entity.id));
	}
}
