import { inject, type InjectionKey } from 'vue';
import type { Logger } from '../../application/ports/Logger';
import type { BackgroundVault } from '../editor/layers/background/BackgroundRenderModel';
import type { AssetDesignerQueryServices } from '../read-models/assetDesignerQueries';
import type { AssetDesignerCommandServices } from './designerCommands';
import type { BackgroundPicker } from './ports';

/**
 * What the composition root hands an asset designer leaf.
 *
 * A bundle of its own rather than a widening of `PlanEditorDeps`: the two surfaces share a
 * gesture surface (Task B1), a tool context (Task B2) and — since the designer learned to
 * DRAW the background Task B7 taught it to store — a background pipeline, and share nothing
 * about what they ARE. A Plan Editor needs a theme subscription and a plan-change source; a
 * designer needs a design to read. Task B7 adds the background picker here; the guarded
 * command bundle arrived with the first thing that builds a command out of it, which is design
 * slice B5's tools and not Task B3a.
 *
 * **This bundle's own header said it needed no `BackgroundVault`** — "it takes an `App` and
 * neither a `Workspace` nor a `Vault`, which is the whole difference from its two siblings" —
 * and that was true for exactly as long as the background layer under this surface was empty.
 * Task B7 stored a reference nothing could read back; the vault is what reads it.
 */
export interface AssetDesignerDeps {
	readonly queries: AssetDesignerQueryServices;
	/**
	 * The write side (design slice B5), which this bundle's own header reserved in writing from
	 * the day it was written — *"Task B3b the reversible adapters — the guarded command bundle
	 * arrives with the first thing that builds a command out of it, which Task B3a is not."*
	 * The designer's five tools are that first thing.
	 *
	 * A FACTORY over the leaf's two write ledgers rather than a set of ready-made adapters; see
	 * `AssetDesignerCommandServices`, which carries the argument.
	 */
	readonly commands: AssetDesignerCommandServices;
	/**
	 * Where a THROWN fault on a click-bound dispatch is recorded (Task B3a). Beside the
	 * queries rather than inside them: `reportDispatchFault` is about a door that faulted,
	 * which is not a fact about reading.
	 */
	readonly logger: Logger;
	/**
	 * "Tell me when the design of THIS asset changed" — partially applied per leaf by the view,
	 * exactly as `PlanEditorDeps.onPlanChanged` is. It also carries the index rebuild, which is
	 * what a leaf restored before `onLayoutReady` depends on, and the asset's geometry SIDECAR
	 * changing on disk, which is where the shape actually lives; see
	 * `createAssetDesignChangeSource` for its FOUR lists and why each is separate. (This
	 * sentence said "both lists" while there were three, which is why the count now names the
	 * file that holds it rather than being remembered here.)
	 */
	readonly onDesignChanged: (assetId: string, listener: () => void) => () => void;
	/**
	 * Task B7's port, reserved above in writing since design slice B3. `null` where nothing is
	 * bound — the composition root binds a real one unconditionally today, so this is the
	 * defensive answer rather than a reachable production state, and `AssetDesignerRoot.vue`'s
	 * empty-state action treats it exactly like `planEditor.noBackground` treats an unreachable
	 * hand-off: no button rather than a live control that does nothing.
	 */
	readonly picker: BackgroundPicker | null;
	/**
	 * The three `Vault` members the background pipeline calls, so the spec sheet Task B7 lets a
	 * user CHOOSE is a spec sheet the canvas can DRAW.
	 *
	 * The same slice of Obsidian's `Vault` the Plan Editor takes, and reached through the same
	 * `loadBackground`/`BackgroundLayer` pair rather than a second decode path: a PNG and a PDF
	 * page become one `<v-image>` in exactly one place in this plugin.
	 */
	readonly vault: BackgroundVault;
	/**
	 * Has the initial index scan RUN — zero entries included — rather than "has it found
	 * anything". Asked per hydration and never captured, because it turns true once per session
	 * and a leaf that snapshotted `false` would decline every authoritative miss for the rest of
	 * its life. `RenovationProjectDeps.indexScanCompleted` carries the longer form of why
	 * "populated" is the wrong question.
	 */
	readonly indexScanCompleted: () => boolean;
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
export interface AssetDesignerContext extends Omit<AssetDesignerDeps, 'onDesignChanged'> {
	/** The asset this leaf shows. Carried in Obsidian's per-leaf view state, not in the type. */
	readonly assetId: string;
	/**
	 * The deps' change source with this leaf's asset already bound — the same partial
	 * application `PlanEditorContext.onPlanChanged` is, and for the same reason: the
	 * composition root composes services and knows nothing about which leaf this is, while the
	 * asset is exactly what this leaf IS. A context member still taking an id would be one
	 * every consumer had to re-supply from `assetId` sitting beside it.
	 */
	readonly onDesignChanged: (listener: () => void) => () => void;
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
