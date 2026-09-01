import type { NodeTransform } from '../../editor/viewport/Viewport';

/**
 * The asset designer's Konva layers: their names, their order, and the one of them that has no
 * content yet (design slice B4).
 *
 * **The background layer is drawn EMPTY, and that is the shape this module is honest about
 * rather than a gap it papers over.** `AssetDesignDto` carries no background reference — Task
 * B7 adds the field, the schema keys, the mapper and the projection that fills it (see that
 * task's file list, and Task A8's Amendment 1, which records why A8 shipped without it). So
 * there is nothing to load and nothing to draw here today.
 *
 * The layer exists anyway, for `EmptyLayer.vue`'s own reason on the plan side: **the ORDER is
 * the contract.** A background inserted later would have to land beneath the footprint, the
 * clearance and the anchor, and "beneath them" is exactly what an existing empty layer already
 * holds. B7 fills this one rather than finding a place for a new one.
 *
 * `designerLayerConfig` lives here rather than in a fifth module because this is the layer with
 * nothing else to own: every designer layer is a world-space, non-listening node carrying the
 * camera's transform, and four copies of those four lines would be four places to forget when
 * one of them changes. `listening: false` on all of them for SDD §62's reason — no node here
 * is hit-tested, so an inert hit graph would be a second hidden canvas per layer for nothing;
 * Task B5's tools do their own geometry against world points, exactly as `SelectTool` does.
 */
/**
 * The four layer names, as a TYPE rather than an `as const` array, because nothing iterates
 * them: `DesignerCanvas` names each one at its own `<VLayer>` and the compiler checks the
 * literal against this union, so a typo there is a build error rather than a silent fifth
 * layer. The array form was tried and is the worse answer twice over — fallow reports the
 * export as unused, and un-exporting it trips `@typescript-eslint/no-unused-vars`'s "assigned
 * a value but only used as a type", which is precisely the true statement about it.
 */
export type DesignerLayerName = 'asset-background' | 'asset-footprint' | 'asset-clearance' | 'asset-anchor';

/** What a designer layer node's `config` holds: its name, its inertness and the camera. */
export interface DesignerLayerConfig extends NodeTransform {
	readonly name: DesignerLayerName;
	readonly listening: false;
}

export function designerLayerConfig(name: DesignerLayerName, transform: NodeTransform): DesignerLayerConfig {
	return { name, listening: false, ...transform };
}
