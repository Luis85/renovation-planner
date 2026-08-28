import type { StringKey } from '../../i18n/locales/en';

/**
 * PRD §67's four autosave states, its own literal wording preserved in the member names so
 * the type stays traceable to the requirement.
 *
 * `'unsaved-changes'` is UNREACHABLE through `SaveStateStore`'s action surface and is kept
 * anyway — see that store's header for the argument. Slice 6's transaction boundary means an
 * edit IS its command dispatch, so there is no moment where a change has been decided and no
 * command sent. It stays in the type for PRD fidelity and so the indicator renders correctly
 * if a later slice ever introduces a genuine edit buffer.
 */
export type SaveState = 'saved' | 'saving' | 'unsaved-changes' | 'save-error';

/**
 * Each state's copy key. NOT a literal map: `src/presentation/i18n/` already holds the one
 * lookup every user-facing string goes through, with a German table beside it, so a hardcoded
 * label map here would be a second string table — untranslated, and outside the file the
 * locale checks can see.
 */
export const SAVE_STATE_KEYS: Readonly<Record<SaveState, StringKey>> = {
	saved: 'save-state.saved',
	saving: 'save-state.saving',
	'unsaved-changes': 'save-state.unsaved-changes',
	'save-error': 'save-state.save-error',
};
