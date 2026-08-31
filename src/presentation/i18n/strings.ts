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

/**
 * One pass over the template filling `{name}` holes. An UNMATCHED hole is left standing as
 * `{name}` rather than blanked: a visible hole is a bug report, an empty string is a silent
 * one. `params` is optional, so every existing two-argument call is unchanged — which the
 * compiler enforces rather than a sweep.
 *
 * ONE KEY PER LABEL, never a translated fragment concatenated with a name: word order and
 * the punctuation around an interpolated name are the translator's to choose
 * ([[Multilanguage]]).
 */
export function t(language: string, key: StringKey, params?: Readonly<Record<string, string>>): string {
	const template = LOCALES[language]?.[key] ?? en[key];
	if (params === undefined) return template;
	return template.replace(/\{(\w+)\}/g, (hole, name: string) => params[name] ?? hole);
}

/**
 * The app's language, resolved per call from Obsidian's own setting. THE one resolution
 * point, and that is a LINT RULE rather than a sentence: `LANGUAGE_RESOLUTION_BAN` in
 * `eslint.config.mjs` refuses a named `getLanguage` import from `obsidian`, and any
 * `.getLanguage` member access, everywhere in `src/` except this one file — so a second call
 * site fails `npm run lint` instead of resting on somebody having counted. `tr` and
 * `trError` coming through here is what makes the rule affordable, not what makes the claim
 * true; the earlier version of this paragraph offered the first as the reason for the
 * second, which it never entailed.
 *
 * **Narrower than "the language is decided once"**: the rule sees the two doors
 * `getLanguage` comes through, not a language decided some other way — a hard-coded `'de'`,
 * or the plugin-local language setting that is a recurring review rejection. Those stay a
 * review catch. `tests/build/language-resolution-boundary.test.ts` pins both halves.
 *
 * Resolved per call rather than once: cheap, and what keeps a rendered-per-open surface
 * correct after the app language changes.
 */
export function currentLanguage(): string {
	return getLanguage();
}

/** `t` in the app's own language. */
export function tr(key: StringKey, params?: Readonly<Record<string, string>>): string {
	return t(currentLanguage(), key, params);
}
