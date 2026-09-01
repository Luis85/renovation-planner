import { inject, type InjectionKey } from 'vue';
import type { AssetDesignerQueryServices } from '../read-models/assetDesignerQueries';

/**
 * What the composition root hands an asset designer leaf.
 *
 * A bundle of its own rather than a widening of `PlanEditorDeps`: the two surfaces share a
 * gesture surface (Task B1) and a tool context (Task B2) and share nothing about what they
 * ARE. A Plan Editor needs a `BackgroundVault`, a theme subscription and a plan-change source;
 * a designer needs a design to read. Task B7 adds the background picker here, Task B3a the
 * commands.
 */
export interface AssetDesignerDeps {
	readonly queries: AssetDesignerQueryServices;
}

/**
 * Everything the designer's Vue tree needs from outside itself, provided ONCE by
 * `AssetDesignerView` on the app instance it created (ADR-0004, SDD §12).
 *
 * `assetId` is the one member the deps bundle cannot carry, and that is structural rather than
 * stylistic: the composition root composes services and knows nothing about which leaf this is,
 * while the asset is exactly what this leaf IS. The view reads it from Obsidian's own view
 * state and provides the pair.
 *
 * One injection key rather than a prop threaded down, for `PlanEditorContext`'s reason: every
 * member is a property of the LEAF, and a prop chain would make each intermediate component
 * declare things it does not use. `app.provide` and not a module singleton, which is what keeps
 * two designer leaves genuinely independent.
 */
export interface AssetDesignerContext extends AssetDesignerDeps {
	/** The asset this leaf shows. Carried in Obsidian's per-leaf view state, not in the type. */
	readonly assetId: string;
}

export const ASSET_DESIGNER_CONTEXT: InjectionKey<AssetDesignerContext> = Symbol(
	'renovation-planner:asset-designer-context',
);

/**
 * Throws rather than answering `undefined`, mirroring `usePlanEditorContext`: a designer with
 * no asset id and no query service would mount, draw nothing, and look exactly like an asset
 * nobody has designed yet. Failing at mount points at the composition mistake instead.
 */
export function useAssetDesignerContext(): AssetDesignerContext {
	const context = inject(ASSET_DESIGNER_CONTEXT);
	if (context === undefined) {
		throw new Error('The asset designer was mounted without an AssetDesignerContext.');
	}
	return context;
}
