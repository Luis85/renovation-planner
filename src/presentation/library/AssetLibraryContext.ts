import { inject, type DeepReadonly, type InjectionKey, type Ref } from 'vue';
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
 * `Ref` can.
 *
 * **`DeepReadonly<Ref<T>>`, never a bare `Ref<T>`.** `AssetLibraryView` is the one writer of
 * this state, and a bare `Ref` cannot make that true — its own `readonly` modifier freezes the
 * PROPERTY (nobody can do `context.assetId = otherRef`) and leaves `.value` wide open, so any
 * of Tasks 12–14's components could do `context.assetId.value = id` and desynchronise the tree
 * from `AssetLibraryView`'s own copy, after which `getState()` persists one value while the
 * pane draws another. This repository already has both the lesson and the mechanism:
 * `use-field-commit.ts`'s `draft` is `DeepReadonly<Ref<T>>` for the identical reason, and
 * `type-safety.test-d.ts` records that the SHALLOW `Readonly<Ref<T>>` "reads as read-only and
 * is not" — it freezes `.value` and stops there, so `v-model` still unwraps and writes straight
 * past it. `AssetLibraryView` holds the real, writable `Ref`s privately and hands them into this
 * type at the one `provide()` call it makes — NO CAST NEEDED there, because a writable `Ref<T>`
 * is already structurally assignable into a `DeepReadonly<Ref<T>>`-typed slot (the readonly
 * modifiers only narrow what a HOLDER of this type may do, not what may be assigned TO it); see
 * `assetLibraryContext.test-d.ts` for the compile-time proof that a write through the injected
 * type fails.
 */
export interface AssetLibraryContext extends AssetLibraryDeps {
	/** The selected asset, or `''` for none — §6.3's own sentinel, read LIVE. */
	readonly assetId: DeepReadonly<Ref<string>>;
	/** The shelf categories currently expanded (§3.2), read LIVE. */
	readonly expanded: DeepReadonly<Ref<readonly string[]>>;
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
