/**
 * The Konva scene's seven layers, in the fixed order SDD §17 draws them (§17's list is
 * the order, not a set — a Zone must paint over the imported plan and under an
 * annotation, and nothing about that is a preference).
 *
 * The ids are this module's alone and are DERIVED from nothing: the array is the
 * declaration and the union comes from it, so the Layers panel, the visibility record and
 * the scene itself cannot each keep their own copy of the list — the same shape
 * `ENTITY_TYPES` and `ZONE_STATUSES` already use.
 *
 * They are internal identifiers rather than persisted data: nothing outside this plugin
 * stores one, and `WorkspaceStore`'s visibility record is ephemeral (§15). A rename costs
 * an i18n key and nothing a user has.
 */
export const KONVA_LAYER_IDS = [
	'background',
	'architecture',
	'zone',
	'construction',
	'asset',
	'annotation',
	'interaction',
] as const;

export type KonvaLayerId = (typeof KONVA_LAYER_IDS)[number];

/**
 * Every layer this slice mounts, visible.
 *
 * Built from `KONVA_LAYER_IDS` rather than written out, so a layer added to the scene
 * cannot be one the Layers panel silently has no entry for.
 */
export function defaultLayerVisibility(): Record<KonvaLayerId, boolean> {
	return Object.fromEntries(KONVA_LAYER_IDS.map((id) => [id, true])) as Record<KonvaLayerId, boolean>;
}
