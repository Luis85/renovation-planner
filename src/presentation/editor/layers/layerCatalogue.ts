import type { StringKey } from '../../i18n/locales/en';
import type { PlanDto } from '../../read-models/PlanDto';

export type LayerEntryState = 'available' | 'supported-empty';

export interface LayerAction {
	readonly labelKey: StringKey;
	readonly toolId: 'calibrate';
	readonly enabled: boolean;
	readonly reasonKey: StringKey;
}

/** One row's own visibility: what it reads and what a click does. */
export interface LayerToggle {
	readonly visible: () => boolean;
	readonly toggle: () => void;
}

/**
 * Where each row's visibility LIVES, handed in by the panel rather than reached for here, so
 * this stays a pure function of a plan and a bundle of closures. Four are Konva layers in
 * `WorkspaceStore`, one is the renovation session's own flag and one is the store's notes gate.
 */
export interface LayerToggles {
	readonly reference: LayerToggle;
	readonly rooms: LayerToggle;
	readonly walls: LayerToggle;
	readonly assets: LayerToggle;
	/** `null` when the renovation session is not available: no row is offered. */
	readonly planned: LayerToggle | null;
	readonly notes: LayerToggle;
}

export type LayerEntryId = 'reference' | 'rooms' | 'walls' | 'assets' | 'planned' | 'notes';

export interface LayerEntry {
	readonly id: LayerEntryId;
	readonly labelKey: StringKey;
	readonly state: LayerEntryState;
	/** Why the row is `supported-empty`; `null` when it is available. */
	readonly reasonKey: StringKey | null;
	readonly action: LayerAction | null;
	readonly visible: () => boolean;
	readonly toggle: () => void;
}

const AVAILABLE = { state: 'available', reasonKey: null, action: null } as const;

/**
 * The layers the user is offered, in the user's vocabulary (interaction spec §54, §55) and in
 * the M01 mockup's order: Reference plan, Rooms, Walls and openings, Assets, Planned changes,
 * Notes and photos. Sidebar polish, 2026-09-10 — until then rows were keyed by Konva layer id, which put
 * the scene's paint order in front of the user and had no way to say "Planned changes", a
 * visibility that cuts across three Konva layers.
 *
 * Set scale is the calibrate tool's ONLY door since the toolbar went (Task 13); it sits on the
 * thing being calibrated and is disabled, with a reason, while there is nothing to calibrate
 * against. `writesBlocked` (design spec §2.9) joins that reason mechanism rather than adding a
 * second one: with no background, the row's own "no background" reason stays, and the paused
 * reason applies only once there IS a background but writes are blocked anyway.
 *
 * A detail plan's guide (ADR-0028) draws on this layer, so with a guide and no background the
 * row is a live toggle that says what it shows rather than a disabled row claiming there is
 * nothing to see. Set scale's own reason follows `hasGuide` too, for the same reason it follows
 * `writesBlocked`: a second reason mechanism that disagreed with the row's would draw two
 * contradicting sentences under one row (`LayerRow`'s collapse only draws one when the two keys
 * agree) — "shows the parent zone's outline" beside "no reference plan has been added", which
 * PR #143's own merge review found and this fix closes.
 */
export function layerCatalogue(plan: PlanDto | null, toggles: LayerToggles, writesBlocked = false, hasGuide = false): readonly LayerEntry[] {
	if (plan === null) return [];
	const hasReference = plan.background !== null;
	const entries: LayerEntry[] = [
		{
			id: 'reference',
			labelKey: 'editor.layer.reference-plan',
			state: hasReference || hasGuide ? 'available' : 'supported-empty',
			reasonKey: hasReference ? null : hasGuide ? 'editor.layer.reference-plan.guide-only' : 'editor.layer.reference-plan.none',
			action: {
				labelKey: 'editor.layer.reference-plan.set-scale',
				toolId: 'calibrate',
				enabled: hasReference && !writesBlocked,
				reasonKey: hasReference && writesBlocked ? 'editor.paused.reason'
					: hasGuide ? 'editor.layer.reference-plan.guide-only'
					: 'editor.layer.reference-plan.none',
			},
			...toggles.reference,
		},
		{ id: 'rooms', labelKey: 'editor.layer.rooms', ...AVAILABLE, ...toggles.rooms },
		{ id: 'walls', labelKey: 'editor.structure.list', ...AVAILABLE, ...toggles.walls },
		{ id: 'assets', labelKey: 'editor.layer.assets', ...AVAILABLE, ...toggles.assets },
	];
	if (toggles.planned !== null) entries.push({ id: 'planned', labelKey: 'editor.shell.planned-layer', ...AVAILABLE, ...toggles.planned });
	entries.push({ id: 'notes', labelKey: 'editor.shell.notes-layer', ...AVAILABLE, ...toggles.notes });
	return entries;
}
