import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetRepository } from '../ports/AssetRepository';

/**
 * The "assign asset" picker's read side. Lists the vault's whole catalogue UNFILTERED —
 * the unit-kind rule lives on the command, which is what enforces it for every caller, and
 * since design slice 19 there is no project to narrow by either: one library serves every
 * project.
 */
export class ListAssets {
	constructor(private readonly assets: AssetRepository) {}

	async execute(): Promise<Result<Asset[], RepositoryError>> {
		const listed = await this.assets.listAll();
		if (isErr(listed)) return listed;
		return ok(listed.value.map((a) => a.entity));
	}
}
