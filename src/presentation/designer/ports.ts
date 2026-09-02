/**
 * The asset designer's own presentation-layer ports (Task B7) — the plumbing a Vue component
 * needs from outside itself for something no query or command already gives it.
 *
 * `presentation/designer/` is the Vue tree, and reaching Obsidian's own file suggester from
 * inside it would mean either importing `obsidian` here — which puts a `FuzzySuggestModal`
 * behind `AssetDesignerRoot.vue`'s `overlay` action and makes every node test of that
 * component drag Obsidian's mock along for a control it never asserts on — or reaching for
 * the global `app`, which the marketplace rules refuse outright. A bound port is the third
 * door: `src/plugin/` builds the real one over Obsidian's picker (`assetBackgroundPicker.ts`)
 * and hands it down through `AssetDesignerDeps`, exactly as `PlanEditorCommandServices.zones`
 * hands the Plan Editor a repository port rather than a command.
 */

/**
 * A vault file the designer can point an asset's background at, and enough to open it — the
 * same shape `PlanBackgroundRef` carries, kept as its OWN type for the reason
 * `AssetBackgroundRef`'s own docblock gives: two entities whose backgrounds happen to share a
 * vocabulary today should not be coupled through an import the moment they diverge.
 */
export interface DocumentRef {
	readonly path: string;
	readonly kind: 'image' | 'pdf';
	/** Meaningful only when `kind` is `'pdf'`; `null` otherwise. */
	readonly page: number | null;
}

/**
 * Ask the user to pick one vault file as an asset's background.
 *
 * `null` means "the user closed the picker without choosing", which is the one answer
 * `AssetDesignerRoot`'s empty-state action must not treat as a chosen reference — dispatching
 * `SetAssetBackground` with nothing picked would be the live control acting on data the user
 * never supplied.
 */
export interface BackgroundPicker {
	pick(): Promise<DocumentRef | null>;
}
