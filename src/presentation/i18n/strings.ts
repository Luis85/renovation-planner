/**
 * The one lookup every user-facing string goes through.
 *
 * `t` is PURE — the language is an argument, not an import — so the tables stay
 * host-free and a node test asks for any locale without a mock. Callers resolve the
 * language once, from Obsidian's own `getLanguage()`: the app language is the user's
 * choice already, so the plugin follows it rather than growing a language setting of its
 * own — a plugin-local language switch is a recurring review rejection.
 *
 * Lookup is by the exact tag `getLanguage()` returns. Regional fallback (`de-AT` → `de`)
 * arrives with the first regional locale, not before.
 */
import { getLanguage } from 'obsidian';
import { en, type StringKey } from './locales/en';
import { de } from './locales/de';

const LOCALES: Record<string, Partial<Record<StringKey, string>>> = { de };

export function t(language: string, key: StringKey): string {
	return LOCALES[language]?.[key] ?? en[key];
}

/**
 * The app's language, resolved per call from Obsidian's own setting. THE one resolution
 * point: `tr` and `trError` both come through here, so no call site re-decides it and none
 * can drift to a cached value or to a plugin-local language setting (a recurring review
 * rejection). Resolved per call rather than once: cheap, and what keeps a
 * rendered-per-open surface correct after the app language changes.
 */
export function currentLanguage(): string {
	return getLanguage();
}

/** `t` in the app's own language. */
export function tr(key: StringKey): string {
	return t(currentLanguage(), key);
}
