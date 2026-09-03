import type { StringKey } from '../../i18n/locales/en';
import type { BackgroundStatus } from '../layers/background/BackgroundRenderModel';

/**
 * Task 20's keyed collection over what used to be four independent `<p class="rp-editor-notice">`s
 * in `PlanEditorRoot.vue`, each with its own `v-if` and none of them sharing an identity Vue
 * could track across a re-render. `editorWarnings` is the pure derivation the four conditions
 * already were, stated once as a function of the same three inputs, so `PersistentWarningStrip.vue`
 * can key each row on `w.id` (`:key="w.id"`) rather than on its position in the list — the
 * difference that keeps one warning's live region from being torn down and rebuilt as a sibling
 * warning arrives or clears.
 */
export type WarningId = 'stale' | 'unreadable-zones' | 'background-missing' | 'background-unreadable';

export interface EditorWarning {
	readonly id: WarningId;
	readonly messageKey: StringKey;
	readonly params?: Readonly<Record<string, string>>;
}

/**
 * The three independent facts `PlanEditorRoot.vue` already read before this slice, each
 * carrying its own `v-if` there: a post-command read-back that failed while valid data is
 * still on screen (`stale`), zone notes that refused to load (`unreadableZones`), and the
 * plan's background (`backgroundStatus`).
 */
export interface EditorWarningInput {
	readonly stale: boolean;
	readonly unreadableZones: number;
	readonly backgroundStatus: BackgroundStatus;
}

/**
 * Fixed order: stale, unreadable-zones, background-*. The order used to be the source
 * order of four template blocks; it is a property of this function now, so the strip and
 * any future caller cannot disagree about it.
 *
 * `background-missing` and `background-unreadable` are mutually exclusive by construction
 * — `BackgroundStatus` is a closed union and only one of its four members reaches either
 * branch — which is what keeps this list to at most one background warning, never both.
 */
export function editorWarnings(input: EditorWarningInput): readonly EditorWarning[] {
	const warnings: EditorWarning[] = [];
	if (input.stale) warnings.push({ id: 'stale', messageKey: 'editor.refresh-failed' });
	if (input.unreadableZones > 0) {
		warnings.push({
			id: 'unreadable-zones',
			messageKey: 'editor.some-zones-unreadable',
			params: { count: String(input.unreadableZones) },
		});
	}
	if (input.backgroundStatus === 'missing') {
		warnings.push({ id: 'background-missing', messageKey: 'editor.background-missing' });
	} else if (input.backgroundStatus === 'unreadable') {
		warnings.push({ id: 'background-unreadable', messageKey: 'editor.background-failed' });
	}
	return warnings;
}
