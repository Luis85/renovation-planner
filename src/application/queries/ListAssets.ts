import { isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Asset } from '../../domain/asset/Asset';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { AssetRepository } from '../ports/AssetRepository';

/** The "assign asset" picker's read side. Lists every project asset UNFILTERED — the unit-kind rule lives on the command, which is what enforces it for every caller. */
export class ListAssets {
	constructor(private readonly assets: AssetRepository) {}

	async execute(projectId: ProjectId): Promise<Result<Asset[], RepositoryError>> {
		const listed = await this.assets.listByProject(projectId);
		if (isErr(listed)) return listed;
		return ok(listed.value.map((a) => a.entity));
	}
}
