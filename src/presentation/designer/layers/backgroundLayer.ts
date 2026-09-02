import type { NodeTransform } from '../../editor/viewport/Viewport';

/**
 * The asset designer's Konva layers: their names and their order (design slice B4).
 *
 * **The background layer used to be drawn EMPTY, and the history is worth keeping because of
 * how it ended.** Task B4 built it with nothing in it and said so — `AssetDesignDto` carried no
 * background reference, so there was nothing to load; the layer existed anyway for
 * `EmptyLayer.vue`'s reason on the plan side, that **the ORDER is the contract**, and a
 * background inserted later would have to land beneath the footprint, the clearance and the
 * anchor. Task B7 then added the field, the schema keys, the mapper and the projection — and
 * named no canvas, so this paragraph went on explaining an emptiness that had stopped having a
 * reason. Each task did what it was told and the render fell between them; a whole-branch
 * review is what found it. The layer draws now, through the plan editor's own
 * `BackgroundLayer.vue`, mounted by `DesignerCanvas` at exactly the position B4 reserved.
 *
 * `designerLayerConfig` lives here rather than in a fifth module because this is the layer with
 * least else to own: every designer layer is a world-space, non-listening node carrying the
 * camera's transform, and four copies of those four lines would be four places to forget when
 * one of them changes. `listening: false` on all of them for SDD §62's reason — no node here
 * is hit-tested, so an inert hit graph would be a second hidden canvas per layer for nothing;
 * Task B5's tools do their own geometry against world points, exactly as `SelectTool` does.
 *
 * The background layer's own node is `BackgroundLayer`'s rather than this function's, because
 * that component owns the `visible` prop and the `<VImage>` inside it. `BACKGROUND_LAYER` below
 * is what keeps its name inside the same union all four are checked against.
 */
/**
 * The four layer names, as a TYPE rather than an `as const` array, because nothing iterates
 * them: `DesignerCanvas` names each one at its own `<VLayer>` and the compiler checks the
 * literal against this union, so a typo there is a build error rather than a silent fifth
 * layer. The array form was tried and is the worse answer twice over — fallow reports the
 * export as unused, and un-exporting it trips `@typescript-eslint/no-unused-vars`'s "assigned
 * a value but only used as a type", which is precisely the true statement about it.
 */
export type DesignerLayerName =
	| 'asset-background'
	| 'asset-footprint'
	| 'asset-clearance'
	| 'asset-anchor'
	| 'asset-gesture';

/**
 * The background layer's name, as a CONSTANT because its node is built by a shared component
 * whose `name` prop is a plain `string` — the one of the four that does not pass through
 * `designerLayerConfig` and so has nothing else checking its literal against the union above.
 * The same `const CANVAS_LABEL: StringKey` idiom `DesignerCanvas` already uses for the one
 * other string it hands to a shared component.
 */
export const BACKGROUND_LAYER: DesignerLayerName = 'asset-background';

/**
 * The gesture layer's name — the one SCREEN-space layer, drawn last, above every world-space
 * one, because a rubber band and a close target are sized in pixels and must not scale with
 * the camera. A constant for `BACKGROUND_LAYER`'s reason: its node is built by a component
 * whose `name` is not checked against this union anywhere else.
 */
export const GESTURE_LAYER: DesignerLayerName = 'asset-gesture';

/** What a designer layer node's `config` holds: its name, its inertness and the camera. */
export interface DesignerLayerConfig extends NodeTransform {
	readonly name: DesignerLayerName;
	readonly listening: false;
}

export function designerLayerConfig(name: DesignerLayerName, transform: NodeTransform): DesignerLayerConfig {
	return { name, listening: false, ...transform };
}
