import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Currency } from '../../core/money/Money';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { AssetRepository } from '../ports/AssetRepository';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RequirementRepository } from '../ports/RequirementRepository';
import type { AssetPriceOverrideRepository } from '../ports/AssetPriceOverrideRepository';
import type { AssetPriceOverride } from '../../domain/asset-price/AssetPriceOverride';
import type { Logger } from '../ports/Logger';
import type { Loaded } from '../ports/versioning';
import type { ZoneRepository } from '../ports/ZoneRepository';
import type { Query } from './Query';
import { buildRequirementRow, type RequirementInspectorDTO } from './buildRequirementRow';

// Re-exported so no consumer's import path moves — the DTO's home is the extracted
// module now, and a rename of a widely-imported type is a different change from an
// extraction.
export type { RequirementInspectorDTO };

/**
 * One bundle instead of six positional collaborators (the max-params budget) — the shape
 * `AssignAssetDeps` and its siblings already take, reached here the day the `Logger` below
 * made this the sixth.
 */
export interface GetRequirementsForZoneDeps {
	readonly requirements: RequirementRepository;
	readonly zones: ZoneRepository;
	readonly assets: AssetRepository;
	readonly projects: ProjectRepository;
	readonly overrides: AssetPriceOverrideRepository;
	/**
	 * For the duplicate diagnostic `winnersBy` demands — the same one
	 * `ListProjectAssetPrices` takes a `Logger` for, and for the same reason.
	 *
	 * Until this member existed the diagnostic on the Inspector path was
	 * `ObsidianAssetPriceOverrideRepository.getForPair`'s own
	 * `logger.warn('asset-price.duplicate-pair', …)`. This query stopped calling
	 * `getForPair`, so without a door here a duplicated pair would resolve silently on the
	 * one surface a user meets it most often.
	 */
	readonly logger: Logger;
}

export class GetRequirementsForZone
	implements
			Query<ZoneId, Result<RequirementInspectorDTO[], RepositoryError>>
{
	private readonly deps: GetRequirementsForZoneDeps;

	constructor(deps: GetRequirementsForZoneDeps) {
		this.deps = deps;
	}

	async execute(zoneId: ZoneId): Promise<Result<RequirementInspectorDTO[], RepositoryError>> {
		const listed = await this.deps.requirements.listByZone(zoneId);
		if (isErr(listed)) return listed;

		// Resolved from each Requirement's OWN `projectId`, never from the queried Zone's.
		// `RecalculateRequirementCommand` reads `requirement.projectId`, so a read model
		// naming a different project would vouch as `current` for a figure that command
		// refuses as `cost.currency-mismatch` — one fact with two derivations, which is
		// the defect this shape exists to make unrepresentable rather than to detect.
		//
		// The two ids agree for anything `AssignAsset` wrote (it takes the Requirement's
		// project FROM the Zone), and nothing enforces it afterwards: `project` and
		// `origin-zone` are independent frontmatter keys that `requirementMapper` reads
		// without a cross-check, and `Requirement.create` validates only the origin KIND.
		// A hand edit parts them, and the row then reads stale — because the recorded
		// unit cost no longer matches the currency of the project that now owns it.
		//
		// Memoized rather than read per row, because they DO agree in the ordinary case:
		// one Zone, one project, one read, which is what the previous shape got right.
		const currencies = new Map<ProjectId, Currency | null>();
		// Keyed on the PROJECT, like the currency memo above, and holding a RESOLUTION rather
		// than one pair's answer: `Map<AssetId, …>` is what keeps a project-keyed memo from
		// answering the first row's asset for every row.
		//
		// **Why not keyed on the pair.** `ObsidianAssetPriceOverrideRepository.getForPair`
		// calls `listByProject` and filters, so one pair lookup hydrates every price note in
		// the project. A pair-keyed memo therefore costs N x M note reads for a zone with N
		// distinct assets in a project holding M overrides, where this shape costs 1 x M —
		// strictly worse at every N > 1 and equal at N = 1.
		const overrideMemo = new Map<ProjectId, ReadonlyMap<AssetId, Loaded<AssetPriceOverride>>>();

		const rows: RequirementInspectorDTO[] = [];
		for (const loaded of listed.value) {
			const currency = await this.projectCurrency(loaded.entity.projectId, currencies);
			if (isErr(currency)) return err(currency.error);
			const row = await buildRequirementRow(this.deps, loaded.entity, currency.value, overrideMemo);
			if (isErr(row)) return row;
			rows.push(row.value);
		}
		return ok(rows);
	}

	private async projectCurrency(
		projectId: ProjectId,
		memo: Map<ProjectId, Currency | null>,
	): Promise<Result<Currency | null, RepositoryError>> {
		// `null` is a CACHED answer (the project is gone), never a miss — nothing stores
		// `undefined`, which is what `Map.get` alone answers for an id never looked up.
		const cached = memo.get(projectId);
		if (cached !== undefined) return ok(cached);

		const project = await this.deps.projects.getById(projectId);
		if (isErr(project)) return err(project.error);
		const currency = project.value?.entity.currency ?? null;
		memo.set(projectId, currency);
		return ok(currency);
	}
}
