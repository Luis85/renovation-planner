import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { AssetPriceOverrideRepository } from '../ports/AssetPriceOverrideRepository';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { Query } from './Query';

/**
 * Which projects hold their own price for a shared catalogue Asset — design "Asset library
 * overview" §11 item 6, the mark on the *Used in* rows a price edit will NOT reach.
 *
 * `listByAsset` is already the exact lookup, so this costs one read on a selection that
 * performs two. What it adds over the port is the SHAPE the row needs: project ids, deduped.
 *
 * **Deduped rather than resolved.** Uniqueness is on the `(projectId, assetId)` pair and is
 * deliberately not enforced (`AssetPriceOverride`'s own docblock says why: the notes are
 * user-editable and refusing to read a project's prices because a user duplicated a note is
 * worse than reading one and saying so), so the list can name one project twice. Which of the
 * two duplicates WINS is `winningDuplicate`'s question and it is not this one's: both notes
 * name the same project, and this query answers only whether a project overrides at all — so
 * resolving them here would be a second answer to a question the mark never asks.
 *
 * A vault-wide surface asserts no project's own PRICE (§3.5), which is why the amount is not
 * carried: the number on this screen is the shared default, and the mark says only that some
 * project has replaced it.
 */
export class ListOverridingProjects implements Query<AssetId, Result<readonly ProjectId[], RepositoryError>> {
	constructor(private readonly overrides: AssetPriceOverrideRepository) {}

	async execute(assetId: AssetId): Promise<Result<readonly ProjectId[], RepositoryError>> {
		const listed = await this.overrides.listByAsset(assetId);
		// Propagated rather than collapsed into an empty list: "no project overrides this" and
		// "I could not find out" are opposite claims about the safety of the edit the user is
		// about to make, and only one of them is true after a failed read.
		if (isErr(listed)) return listed;
		return ok([...new Set(listed.value.map((loaded) => loaded.entity.projectId))]);
	}
}
