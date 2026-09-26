import { inject, type InjectionKey } from 'vue';
import type { Logger } from '../../application/ports/Logger';
import type { BackgroundVault } from '../editor/layers/background/BackgroundRenderModel';
import type { EditorViewPreferences } from '../editor/PlanEditorContext';
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
	 * The designer's tools are that first thing.
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
	/**
	 * Obsidian's `css-change`, as a subscription that hands back its own unsubscribe — the same
	 * member `PlanEditorContext` carries, bound by the composition root to the same
	 * `createThemeChangeSource(workspace)`.
	 *
	 * A canvas cannot read a CSS variable, so `resolveThemeTokens` is the bridge and something
	 * has to tell it the bridge is stale. Without this member the designer resolved its palette
	 * once at setup and a user who switched theme with a designer open kept the old one until
	 * the leaf was reopened. A callback rather than the `Workspace` itself, for the reason the
	 * plan editor's own member gives: the components' only interest is "the theme changed,
	 * re-resolve", and handing them a workspace would let any of them reach for the rest of it.
	 */
	readonly onThemeChange: (listener: () => void) => () => void;
	/**
	 * "A vault file appeared, changed, moved or went" — every path, unfiltered, so a surface
	 * drawing a document can notice the document itself moving under it.
	 *
	 * A background is a PNG or a PDF the user put in their vault, which puts it outside every
	 * other change door this bundle carries: `VaultChangeAdapter` reads `.md` and `.rpgeo` and
	 * drops the rest, and a frontmatter reference does not move when the file it names does. So a
	 * replaced or deleted sheet went unnoticed for as long as the surface sat idle — the residual
	 * `BackgroundLayer`'s document key disclosed, and the reason this member is REQUIRED rather
	 * than optional: a surface that mounts that layer has to answer the question.
	 *
	 * Takes NO id, for `onCatalogueChanged`'s reason: there is nothing to filter on here either,
	 * and the subscriber compares the path against the one it is drawing.
	 */
	readonly onVaultFileChanged: (listener: (path: string) => void) => () => void;
	/**
	 * The View menu's Grid and Snap choices on this device (snapping spec 2026-09-15, §5) — the Plan Editor's store
	 * shape under the designer's OWN key, because an asset is worked at a different scale from a plan. Optional for
	 * `PlanEditorDeps.viewPreferences`'s reason: a surface with no slot bound keeps the defaults.
	 */
	readonly viewPreferences?: EditorViewPreferences;
	/**
	 * Open the shared asset library (AD06).
	 *
	 * The designer is reached FROM the library — `AssetInspector`'s "Open in designer" — and there
	 * was no way back but the tab bar. Every designer leaf is titled "Asset designer" whatever
	 * asset it holds (the Plan Editor's convention too), so a user with three of them open cannot
	 * tell them apart from the host chrome alone.
	 *
	 * An `AssetDesignerDeps` member and NOT a leaf-scoped one like `closeLeaf`: the library is a
	 * singleton view the composition root already reveals for the palette command and the project
	 * surface, through the one `revealView(ASSET_LIBRARY_VIEW)` door. Binding to that rather than
	 * adding a second activation is the "one action, every input" rule — a second door with its own
	 * activation looks correct alone and opens a duplicate tab the moment a user uses both.
	 *
	 * OPTIONAL, like `viewPreferences` above and for the reason slice 14's Amendment 1 gives: a
	 * surface with no door bound draws no control for it, rather than a live one that does
	 * nothing. The browser harness and the component suites are exactly that surface.
	 */
	readonly openLibrary?: () => void;
	/**
	 * Take this asset into a plan (AD13) — the designer's forward door, where `openLibrary` above
	 * is its backward one.
	 *
	 * Bound at the composition root to `assetDesignerUsePlan`, which continues into a Plan Editor
	 * the user already has open and otherwise asks through the SAME `PlanSuggestModal` the palette
	 * command uses. That seam is also where the rest of this door's account lives: which plan is
	 * chosen, that a cancelled pick opens and writes nothing, and exactly how far the gesture
	 * currently reaches.
	 *
	 * **Takes no asset id, and the absence is a FACT about the channel rather than an
	 * omission.** The only route into an already-open Plan Editor is its `origin` view state,
	 * whose type (`application/navigation/ProjectDestination`) names a room, a work item or a
	 * cost and has no asset arm — so there is nothing this signature could honestly carry today.
	 * `DesignerUsePlan.vue` carries the change that would give it one.
	 *
	 * OPTIONAL, like `openLibrary` above and for the identical reason — and the question is
	 * answered rather than defaulted into: absence MEANS something here (no navigation composed
	 * behind this mount, which is exactly what the browser harness and the component suites are),
	 * so the control is not drawn rather than drawn dead. Contrast `DesignerInspector`'s
	 * `lockedGraphics`, which is REQUIRED because its absence would mean nothing at all.
	 */
	readonly usePlan?: (assetId: string) => void;
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
	/**
	 * Close THIS leaf — the tab the user is looking at.
	 *
	 * The one thing a designer can offer a user whose ASSET is gone. `GetAssetDesign` refuses an
	 * absent asset with a coded `ReferenceError`, so that arrives in the same slot as a vault
	 * fault — and a retry there re-runs the same lookup for a note that is not coming back,
	 * which is the live control that does nothing this repository refuses everywhere else.
	 * `AssetDesignerRoot` asks `isMissingAsset` to tell the two apart.
	 *
	 * A narrow callback rather than the `WorkspaceLeaf` itself, and NOT an `AssetDesignerDeps`
	 * member: the composition root composes services and knows nothing about which leaf this is,
	 * while the leaf is the VIEW's. Exactly `PlanEditorContext.closeLeaf`, which slice 17 added
	 * for the same state on the other surface and for the same reason — reaching for the global
	 * `app` instead is what the marketplace rules refuse.
	 */
	readonly closeLeaf: () => void;
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
