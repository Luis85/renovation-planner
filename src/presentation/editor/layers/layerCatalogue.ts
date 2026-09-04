import type { StringKey } from '../../i18n/locales/en';
import type { PlanDto } from '../../read-models/PlanDto';
import type { KonvaLayerId } from '../scene/KonvaLayers';

export type LayerEntryState = 'available' | 'supported-empty';

export interface LayerAction {
	readonly labelKey: StringKey;
	readonly toolId: 'calibrate';
	readonly enabled: boolean;
	readonly reasonKey: StringKey;
}

export interface LayerEntry {
	readonly id: 'reference' | 'rooms';
	readonly konvaLayer: KonvaLayerId;
	readonly labelKey: StringKey;
	readonly state: LayerEntryState;
	/** Why the row is `supported-empty`; `null` when it is available. */
	readonly reasonKey: StringKey | null;
	readonly action: LayerAction | null;
}

/**
 * The layers the user can honestly be offered (design spec §5.3): the Reference plan and the
 * Rooms. The four empty Konva layers and the interaction layer are not here — a row for a layer
 * with no records and no capability is a fake, and `WorkspaceStore` keeps them visible.
 * Set scale is the calibrate tool's ONLY door since the toolbar went (Task 13); it sits on the
 * thing being calibrated and is disabled, with a reason, while there is nothing to calibrate
 * against.
 */
export function layerCatalogue(plan: PlanDto | null): readonly LayerEntry[] {
	if (plan === null) return [];
	const hasReference = plan.background !== null;
	return [
		{
			id: 'reference',
			konvaLayer: 'background',
			labelKey: 'editor.layer.reference-plan',
			state: hasReference ? 'available' : 'supported-empty',
			reasonKey: hasReference ? null : 'editor.layer.reference-plan.none',
			action: {
				labelKey: 'editor.layer.reference-plan.set-scale',
				toolId: 'calibrate',
				enabled: hasReference,
				reasonKey: 'editor.layer.reference-plan.none',
			},
		},
		{ id: 'rooms', konvaLayer: 'zone', labelKey: 'editor.layer.rooms', state: 'available', reasonKey: null, action: null },
	];
}
