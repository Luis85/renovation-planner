import { inject, type InjectionKey, type Ref } from 'vue';
import type { AssetLibraryDeps } from './AssetLibraryDeps';

/**
 * Everything the Asset library's Vue tree needs from outside itself, provided ONCE by
 * `AssetLibraryView` on the app instance it created (ADR-0004, SDD §12).
 *
 * `AssetLibraryDeps` (Task 9) is everything the composition root can build without knowing
 * which leaf this is; `assetId` and `expanded` are the other half — this view is a SINGLETON
 * whose subject the composition root has never heard of, and Obsidian's own per-leaf view
 * state names it instead (§6.3). This is the join Task 9's own docblock reserves for this
 * file: *"`AssetLibraryContext` (Task 11) is where the two are joined."*
 *
 * **Both are `Ref`s rather than plain values, and that is a structural answer to §6.3's own
 * rule, not a style choice.** §6.3: *"Selection does not remount the Vue tree… The tree
 * updates in place."* A per-subject view that DOES remount on a changed subject
 * (`AssetDesignerContext.assetId`, a plain `string`) can hand it down as an ordinary field,
 * because a changed subject there rebuilds the whole tree and the injected value is rebuilt
 * with it. Here a changed `assetId` or `expanded` set has to reach an ALREADY-MOUNTED tree
 * with nothing else disturbed — and a plain field frozen at the one `provide()` call this view
 * ever makes cannot carry a later write to a component that already read it; only a reactive
 * `Ref` can. `AssetLibraryView` is their one writer, mirroring the "ONE writer of that state"
 * rule `RenovationProjectDeps.navigate`'s own docblock states for its own per-leaf field.
 */
export interface AssetLibraryContext extends AssetLibraryDeps {
	/** The selected asset, or `''` for none — §6.3's own sentinel, read LIVE. */
	readonly assetId: Ref<string>;
	/** The shelf categories currently expanded (§3.2), read LIVE. */
	readonly expanded: Ref<readonly string[]>;
}

export const ASSET_LIBRARY_CONTEXT: InjectionKey<AssetLibraryContext> = Symbol(
	'renovation-planner:asset-library-context',
);

/**
 * Throws rather than answering `undefined`, mirroring `useAssetDesignerContext` and
 * `useRenovationProjectContext`: a library mounted with no query services would draw nothing,
 * or a plausible-looking empty state built on data it should never have seen, and look like an
 * empty catalogue rather than a composition mistake. Failing at mount points at the mistake.
 */
export function useAssetLibraryContext(): AssetLibraryContext {
	const context = inject(ASSET_LIBRARY_CONTEXT);
	if (context === undefined) {
		throw new Error('The asset library was mounted without an AssetLibraryContext.');
	}
	return context;
}
