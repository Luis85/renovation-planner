/**
 * `enMobile`'s German half. German noun capitalization is incompatible with the sentence-case
 * rule the English partial carries, which is why this one sits under `de/` — see
 * `tests/build/localeModuleSentenceCase.test.ts` for how the two scopes are told apart.
 */
export const deMobile = {
	'view.mobile.read-only': 'Auf Mobilgeräten zum Ansehen verfügbar. Änderungen brauchen einen Desktop.',
	// `Öffnen Sie`, not the brief's `Öffne`: `strings.test.ts` refuses a du-form imperative
	// anywhere in this locale, and `Öffne` is one of the ten it names. Watched red before the fix.
	'view.mobile.desktop-only': 'Diese Ansicht ist auf Mobilgeräten nicht verfügbar. Öffnen Sie sie auf einem Desktop.',
} as const;
