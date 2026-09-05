import type { StringKey } from '../../i18n/locales/en';
import type { BackgroundStatus } from '../layers/background/BackgroundRenderModel';

/**
 * Task 20's keyed collection over what used to be four independent `<p class="rp-editor-notice">`s
 * in `PlanEditorRoot.vue`, each with its own `v-if` and none of them sharing an identity Vue
 * could track across a re-render. `editorWarnings` is the pure derivation the four conditions
 * already were, stated once as a function of the same inputs, so `PersistentWarningStrip.vue`
 * can key each row on `w.id` (`:key="w.id"`) rather than on its position in the list — the
 * difference that keeps one warning's live region from being torn down and rebuilt as a sibling
 * warning arrives or clears.
 *
 * **Task 9 (the trust path, design spec §2.3/§2.4/§2.8) is what gives the model actions and a
 * busy state, both self-declared absent through the two slices before it.** `unrecovered` is a
 * fifth row — a write that landed neither whole nor rolled back — and the `stale` row gains Try
 * again beside the Open source note both rows now share: two facts about ONE re-read
 * (`ProjectStore.refreshing`, `retriesFailed`) rather than a separate busy flag per action, per
 * §2.4's own "one flag for two readers".
 */
export type WarningId = 'unrecovered' | 'stale' | 'unreadable-zones' | 'background-missing' | 'background-unreadable';

/**
 * R5 (2026-09-04): the one axis this model carries beyond identity and message. `warning` —
 * what is on screen may be incomplete or out of date; `error` — a read refused, or a write
 * that never resolved, so something the user owns is not (or may not be) on screen.
 */
export type WarningSeverity = 'warning' | 'error';

/**
 * One row's action. `retry` is the refresh, by construction (§2.3) — it re-reads through
 * `runtime.refreshProjection` and takes no command parameter, so it cannot replay a write.
 * `open-source-note` asks the context to open the plan's own note, the one surface every
 * warning here can always hand off to.
 *
 * `busy` is read off the SAME flag the row's message swap already reads
 * (`ProjectStore.refreshing`) rather than a per-action flag of its own: a retry in flight and
 * an open-source-note click racing it are the same "a read is happening" fact, not two.
 */
export interface WarningAction {
	readonly id: 'retry' | 'open-source-note';
	readonly labelKey: StringKey;
	readonly run: () => void;
	readonly busy: boolean;
}

export interface EditorWarning {
	readonly id: WarningId;
	readonly severity: WarningSeverity;
	readonly messageKey: StringKey;
	readonly params?: Readonly<Record<string, string>>;
	/** Absent for a warning with nothing to do about it yet (`unreadable-zones`, `background-*`). */
	readonly actions?: readonly WarningAction[];
}

/**
 * The facts `PlanEditorRoot.vue` reads to build this list: the three pre-existing ones (a
 * post-command read-back that failed while valid data is still on screen, zone notes that
 * refused to load, the plan's background) plus the trust path's own — an unrecovered write
 * (§2.8), whether a re-read is in flight and how many have failed in a row (§2.4) — and the
 * two callbacks every action here dispatches through.
 */
export interface EditorWarningInput {
	readonly unrecoveredWrite: boolean;
	readonly stale: boolean;
	readonly refreshing: boolean;
	readonly retriesFailed: number;
	readonly unreadableZones: number;
	readonly backgroundStatus: BackgroundStatus;
	readonly retry: () => void;
	readonly openSourceNote: () => void;
}

/**
 * Fixed order: unrecovered, stale, unreadable-zones, background-*. `unrecovered` leads
 * because it is the one row naming a write that may still be half-done — the others are all
 * about a READ.
 *
 * `background-missing` and `background-unreadable` are mutually exclusive by construction
 * — `BackgroundStatus` is a closed union and only one of its four members reaches either
 * branch — which is what keeps this list to at most one background warning, never both.
 */
export function editorWarnings(input: EditorWarningInput): readonly EditorWarning[] {
	const warnings: EditorWarning[] = [];
	// Shared by both rows below that offer it: the same busy fact, the same handler, only the
	// unrecovered row overrides `busy` to `false` — nothing to re-read would change that row,
	// so it is never "in flight" the way a retry is.
	const openSourceNote: WarningAction = {
		id: 'open-source-note',
		labelKey: 'editor.warning.open-source-note',
		run: input.openSourceNote,
		busy: input.refreshing,
	};
	if (input.unrecoveredWrite) {
		warnings.push({
			id: 'unrecovered',
			severity: 'error',
			messageKey: 'editor.unrecovered',
			actions: [{ ...openSourceNote, busy: false }],
		});
	}
	if (input.stale) {
		warnings.push({
			id: 'stale',
			severity: 'warning',
			messageKey: input.retriesFailed > 0 ? 'editor.refresh-failed.again' : 'editor.refresh-failed',
			actions: [
				{ id: 'retry', labelKey: 'editor.warning.retry', run: input.retry, busy: input.refreshing },
				openSourceNote,
			],
		});
	}
	if (input.unreadableZones > 0) {
		warnings.push({
			id: 'unreadable-zones',
			severity: 'error',
			messageKey: 'editor.some-zones-unreadable',
			params: { count: String(input.unreadableZones) },
		});
	}
	if (input.backgroundStatus === 'missing') {
		warnings.push({ id: 'background-missing', severity: 'warning', messageKey: 'editor.background-missing' });
	} else if (input.backgroundStatus === 'unreadable') {
		warnings.push({ id: 'background-unreadable', severity: 'error', messageKey: 'editor.background-failed' });
	}
	return warnings;
}
