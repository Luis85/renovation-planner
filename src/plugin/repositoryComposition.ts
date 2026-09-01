import type { FileManager, MetadataCache, Vault } from 'obsidian';
import type { Currency } from '../core/money/Money';
import { ObsidianAssetRepository } from '../infrastructure/obsidian/repositories/ObsidianAssetRepository';
import { ObsidianRequirementRepository } from '../infrastructure/obsidian/repositories/ObsidianRequirementRepository';
import { IndexLibraryOverlaps } from '../infrastructure/obsidian/repositories/IndexLibraryOverlaps';
import { PlanGeometryStore } from '../infrastructure/obsidian/repositories/PlanGeometryStore';
import { AssetGeometryStore } from '../infrastructure/obsidian/repositories/AssetGeometryStore';
import { ObsidianAssetGeometrySidecar } from '../infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import type { NoteVaultDeps } from '../infrastructure/obsidian/repositories/NoteVaultDeps';
import { ObsidianPlanRepository } from '../infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../infrastructure/obsidian/repositories/ObsidianZoneRepository';

/**
 * The vault collaborators the persistence stack reads and writes through — the raw
 * `app` surface, gathered once so nothing downstream needs the whole `App`.
 *
 * Moved out of `composition-root.ts` alongside `composeRepositories` below, the way
 * `guardedServices.ts` already holds the guarded half of the same seam: this is the
 * UNGUARDED half, the raw repository construction `composeGuarded` then wraps. Re-exported
 * from `composition-root.ts` (`export type { VaultStack }`) so every existing import of it
 * from that module's path keeps working unchanged.
 */
export interface VaultStack {
	readonly vault: Vault;
	readonly fileManager: FileManager;
	readonly metadataCache: MetadataCache;
}

/**
 * The five repositories, the two geometry sidecars and the library-overlap read — built
 * once, unguarded, from the vault stack and the settings a root was composed with.
 * `composeGuarded` in `composition-root.ts` is what wraps the members that leave the root
 * through `PersistenceServices`; this function only constructs them.
 */
export function composeRepositories(
	deps: NoteVaultDeps,
	vault: VaultStack,
	newProjectRoot: string,
	libraryFolder: string,
	defaultCurrency: Currency,
) {
	const geometryStore = new PlanGeometryStore(vault.vault, vault.fileManager, deps.index, deps.migrations, deps.echo);
	// ONE store, two consumers, and the sharing is the point rather than an economy: the
	// asset repository holds it for the DELETE (an asset's note and its sidecar go together)
	// and the design commands write through the port below it, and `KeyedQueues` is per
	// INSTANCE — so a second store built beside this one would split the per-asset lock those
	// two share and leave a delete free to interleave with a design write.
	const assetGeometryStore = new AssetGeometryStore(vault.vault, vault.fileManager, libraryFolder, deps.echo);
	return {
		geometryStore,
		// The port, not the store: `plugin/` is where an infrastructure class becomes the
		// application's own interface, and the design commands are typed against the port.
		assetGeometry: new ObsidianAssetGeometrySidecar(assetGeometryStore),
		// `newProjectRoot` is a real argument, not `deps.projectFolder` read inline — this
		// repository is the only one that ever writes a note whose folder does not already
		// exist to be derived from, so it takes the setting as its own constructor
		// argument rather than through the shared `NoteVaultDeps` field. That field is what
		// Task 7 deletes; reading it here would have left this call site needing a second
		// edit the day it goes.
		projects: new ObsidianProjectRepository(deps, newProjectRoot, libraryFolder, defaultCurrency),
		plans: new ObsidianPlanRepository(deps, geometryStore),
		zones: new ObsidianZoneRepository(deps, geometryStore),
		assets: new ObsidianAssetRepository(deps, libraryFolder, assetGeometryStore),
		requirements: new ObsidianRequirementRepository(deps),
		// §83's third site, which has no door to refuse at: ADR-0013 derives a project's
		// folder from where its `Project.md` sits, so a user moves a project by dragging a
		// folder in Obsidian's file explorer. Composed here rather than passed as a sixth
		// argument to `composeGuarded`, which already sits at `max-params`: this is the
		// bundle built from `deps.index` and the library setting, and both are already here.
		overlaps: new IndexLibraryOverlaps(deps.index, libraryFolder),
		// The CreateProjectCommand's own currency argument. Bundled into this return rather
		// than a sixth composeGuarded parameter — composeGuarded already takes `repositories`
		// whole and destructures it, the same grouping SessionCollaborators argues for above.
		defaultCurrency,
	};
}
