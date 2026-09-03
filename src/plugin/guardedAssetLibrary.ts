import { ok, type Result } from '../core/result/Result';
import type { Query } from '../application/queries/Query';
import type { Logger } from '../application/ports/Logger';
import type { RepositoryError } from '../application/ports/repositoryErrors';
import type { VaultExceptionMapper } from '../application/errors/exceptionMapper';
import { guardQuery } from '../application/errors/guardAgainstThrowing';
import { ListCatalogueEntries, type CatalogueListing } from '../application/queries/ListCatalogueEntries';
import {
	ListAssetOutlines,
	type AssetOutline,
	type ListAssetOutlinesInput,
} from '../application/queries/ListAssetOutlines';
import { ListOverridingProjects } from '../application/queries/ListOverridingProjects';
import type { AssetRepository } from '../application/ports/AssetRepository';
import type { AssetGeometrySidecar } from '../application/ports/AssetGeometrySidecar';
import type { AssetPriceOverrideRepository } from '../application/ports/AssetPriceOverrideRepository';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { AssetId } from '../domain/asset/AssetId';
import type { ProjectId } from '../domain/project/ProjectId';

/**
 * The Asset library's own read side, guarded — its own module rather than a fourth bundle in
 * `guardedServices.ts` for the reason `guardedAssetPrice.ts` already records: that file sat at
 * 378 counted lines against a 400 cap when this arrived, and **a budget bought back by
 * reformatting is a budget that has already been spent**. The seam is the one that file draws
 * anyway — one guarded GROUP per bundle, composed and guarded in one place — so this module is
 * a whole group rather than whatever happened to fit.
 *
 * Nothing about the guarding moved. `VAULT_EXCEPTION_MAPPER` stays in `guardedServices.ts`
 * because it is the one instance every group shares, and it reaches this module the way it
 * reaches every other caller: as the `map` argument the composition root passes.
 *
 * **THREE members, not five.** The library's other two reads — `GetAssetDesign` and
 * `ListRequirementsReferencing` — are already composed and guarded for the designer and for
 * the delete flow, and `assetLibraryDeps` reuses those wrappers rather than building second
 * ones. Two instruments answering one question is what lets two surfaces disagree about one
 * asset.
 */
export interface GuardedAssetLibraryServices {
	readonly assetLibrary: {
		readonly listCatalogue: Query<void, Result<CatalogueListing, RepositoryError>>;
		/**
		 * Answers a `Result` HERE and a bare map at the read model, which is the one place in
		 * this file where a guard changes a query's shape — and it is the boundary doing its
		 * job rather than an inconsistency.
		 *
		 * `ListAssetOutlines` settles per entry and therefore returns no `Result` at all: one
		 * damaged sidecar refuses for its own id and every other id in the batch answers
		 * normally. A FAULT below that query is a different fact — the batch was not read at
		 * all — and it has nowhere to go in a bare map: catching it and answering `new Map()`
		 * would drop every requested id and read back as *no shape yet*, the false absence
		 * §3.4's fifth mark state exists to refuse. So the boundary reports it in the one shape
		 * that can carry it, and `createAssetLibraryQueries` turns that refusal into one
		 * `refused` entry per requested id.
		 */
		readonly listOutlines: Query<
			ListAssetOutlinesInput,
			Result<ReadonlyMap<AssetId, AssetOutline>, RepositoryError>
		>;
		readonly listOverridingProjects: Query<AssetId, Result<readonly ProjectId[], RepositoryError>>;
	};
}

/**
 * Composes the three queries and guards each under its own event name, so a fault names the
 * door it crossed.
 *
 * It takes PORTS and builds the queries itself — `guardAssetDesign`'s shape rather than
 * `guardSlice10`'s — because nothing above this function needs the unguarded ones: no library
 * read is dispatched from inside the application layer, so a second, raw copy at the root
 * would be a copy with no caller. Every port here is one the root already holds; nothing new
 * is constructed beneath them, and `index` is the same instance every repository shares, so
 * `ListCatalogueEntries` counts the notes the index EXCLUDED against the very scan that
 * excluded them.
 *
 * Each guard call is a local `const` first, per `guardedServices.ts`'s own header: assigning
 * one straight into a field of a declared return type gives it a contextual type, and `E` then
 * infers from the TARGET rather than from the query.
 */
export function guardAssetLibrary(
	ports: {
		assets: AssetRepository;
		index: ProjectIndex;
		geometry: AssetGeometrySidecar;
		overrides: AssetPriceOverrideRepository;
	},
	logger: Logger,
	map: VaultExceptionMapper,
): GuardedAssetLibraryServices {
	const catalogue = new ListCatalogueEntries(ports.assets, ports.index);
	const outlines = new ListAssetOutlines(ports.geometry);
	const overriding = new ListOverridingProjects(ports.overrides);
	const listCatalogue = guardQuery(catalogue, 'query.listCatalogueEntries.failed', logger, map);
	// The `Result` shim is an ADAPTER and not a second query: it adds the arm the boundary
	// needs to report a fault in and nothing else, so `ListAssetOutlines` keeps the per-entry
	// contract §3.4 asks of it. `never` as the error parameter is the honest one — the query
	// itself refuses nothing — which leaves `PersistenceError` as the only failure this door
	// can answer, exactly what the mapper produces.
	const listOutlines = guardQuery<ListAssetOutlinesInput, ReadonlyMap<AssetId, AssetOutline>, never>(
		{ execute: async (input: ListAssetOutlinesInput) => ok(await outlines.execute(input)) },
		'query.listAssetOutlines.failed',
		logger,
		map,
	);
	const listOverridingProjects = guardQuery(overriding, 'query.listOverridingProjects.failed', logger, map);
	return { assetLibrary: { listCatalogue, listOutlines, listOverridingProjects } };
}
