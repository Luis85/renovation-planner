import { en, type StringKey } from './locales/en';
import { currentLanguage, t } from './strings';
import type { AppError, ErrorCategory } from '../../core/errors/AppError';

/**
 * The ONE place an `AppError` becomes user-facing copy (SDD §66's last step).
 *
 * The mapping is `error.code` → string-table key → `t(language, key)`. It is NEVER the
 * error's own `message` field: that string was written for a log line, in English, at
 * the raise site — a German user reading it would be reading developer text. A code with
 * no table entry falls back through two steps:
 *
 * 1. **Code suffixes** — for codes minted with a dynamic prefix (an entity id or kind),
 *    where the MEANINGFUL half is the suffix. This list is closed and each entry earns
 *    its place by being a sentence a user actually needs; it must not grow into a
 *    second error catalog beside the raise sites.
 * 2. **Category fallback** — one generic, honest sentence per slice-2 category.
 *
 * Presentation renders whatever comes back verbatim: no exception message, stack
 * fragment or file path can reach a user through this function, because none of those
 * things are in the locale tables.
 *
 * SDD §66 names this shape `type ToUserMessage = (language: string, error: AppError)
 * => string`; it stays a function declaration rather than an aliased const, because an
 * exported alias nothing else imports is exactly the dead export this repo refuses.
 */

/** Codes whose prefix varies per entity kind; keyed by the stable suffix. */const CODE_SUFFIX_KEYS: ReadonlyArray<readonly [suffix: string, key: StringKey]> = [
	['schema-version-unsupported', 'error.suffix.schema-version-unsupported'],
	// Each of these is ONE raise site parameterised by kind, so a per-kind entry would answer it
	// for one kind and leave the others on the generic category sentence — which is where every
	// kind was until these rows.
	//
	// **That this list COVERS every such site is asserted rather than described**, by
	// `toUserMessage.test.ts`'s 'every per-kind suffix raised in src/infrastructure/ resolves to
	// something other than its category sentence'. The prose it replaces quoted a grep here and
	// in two other files and read FOUR off it; the grep prints six. A count restated in three
	// places is three chances to be wrong and no chance to notice, and the scan additionally
	// cannot tell a raised CODE from a logger EVENT name — which is why the assertion carries a
	// named exclusion table and this comment carries no number.
	['schema-version-malformed', 'error.suffix.schema-version-malformed'],
	['project-folder-unresolved', 'error.suffix.project-folder-unresolved'],
	['note-id-mismatch', 'error.suffix.note-id-mismatch'],
	['revision-conflict', 'error.suffix.revision-conflict'],
	['external-modification', 'error.suffix.external-modification'],
	['migration-failed', 'error.suffix.migration-failed'],
];

function hasLocaleKey(key: string): key is StringKey {
	return key in en;
}

const CATEGORY_KEYS: Record<ErrorCategory, StringKey> = {
	Domain: 'error.category.domain',
	Validation: 'error.category.validation',
	Persistence: 'error.category.persistence',
	Geometry: 'error.category.geometry',
	Import: 'error.category.import',
	Migration: 'error.category.migration',
	Reference: 'error.category.reference',
	Calculation: 'error.category.calculation',
};

export function toUserMessage(language: string, error: AppError): string {
	if (hasLocaleKey(error.code)) return t(language, error.code);
	for (const [suffix, key] of CODE_SUFFIX_KEYS) {
		if (error.code.endsWith(suffix)) return t(language, key);
	}
	return t(language, CATEGORY_KEYS[error.category]);
}

/**
 * `toUserMessage` in the app's own language — the `tr` of the error path, and the way a
 * component turns a stored `AppError` into copy.
 *
 * The language comes from `currentLanguage()` rather than from a second `getLanguage()` call
 * here, so `strings.ts`'s claim to be the one resolution point stays true. That claim is why
 * this function lives in this file and not beside `tr`: `toUserMessage.ts` already imports
 * from `strings.ts`, and putting it the other way round would be a cycle.
 */
export function trError(error: AppError): string {
	return toUserMessage(currentLanguage(), error);
}
